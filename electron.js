import { app, BrowserWindow, ipcMain, Notification, session } from "electron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { exec } from "child_process";
import util from "util";
import axios from "axios";
import { EventEmitter } from "events";

// ==================== GLOBAL FIXES ====================
app.commandLine.appendSwitch('ignore-certificate-errors');
app.userAgentFallback = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let activePlayerProcess = null;

// ==================== GLOBAL REFERER + AUTO-REFERER SYSTEM ====================
let globalReferer = null;
let globalOrigin = null;
let refererSequence = 0;
let activeRefererToken = 0;

// Auto-referer mode: when active, every request gets a Referer equal to its own URL
let autoRefererActive = false;
let autoRefererToken = 0;
// ============================================================================

// ==================== DOWNLOAD MANAGER ====================
const activeDownloads = new Map();
const downloadsDbPath = path.join(app.getPath('userData'), 'downloads.json');
const lastProgressSend = new Map();
const PROGRESS_THROTTLE_MS = 250;

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024)         return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function sendDownloadNotification(jobId, { title, status, totalBytes = 0, downloadedBytes = 0 }) {
  if (status === 'progress') return;
  if (global._notifMap && global._notifMap[jobId]) {
    try { global._notifMap[jobId].close(); } catch(e) {}
    delete global._notifMap[jobId];
  }
  let notifTitle, body, silent, timeoutType;
  switch (status) {
    case 'started':
      notifTitle = 'Download Started';
      body = title;
      silent = false;
      timeoutType = 'default';
      break;
    case 'completed':
      notifTitle = 'Download Complete ✓';
      body = `${title}\n${formatBytes(totalBytes || downloadedBytes)}`;
      silent = false;
      timeoutType = 'default';
      break;
    case 'error':
      notifTitle = 'Download Failed ✗';
      body = title;
      silent = false;
      timeoutType = 'default';
      break;
    case 'cancelled':
      notifTitle = 'Download Cancelled';
      body = title;
      silent = false;
      timeoutType = 'default';
      break;
    default: return;
  }
  const opts = { title: notifTitle, body, silent, timeoutType };
  if (status === 'started') {
    opts.actions = [{ type: 'button', text: 'Cancel' }];
    opts.closeButtonText = 'Dismiss';
  }
  const notif = new Notification(opts);
  if (status === 'started') {
    notif.on('action', (event, index) => {
      if (index === 0) cancelDownloadById(jobId);
    });
    if (!global._notifMap) global._notifMap = {};
    global._notifMap[jobId] = notif;
  }
  notif.show();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (status === 'started') mainWindow.setProgressBar(0.01);
    else if (status === 'completed' || status === 'error' || status === 'cancelled')
      mainWindow.setProgressBar(-1);
  }
}

function sendProgressToRenderer(jobId, percent, downloadedBytes, totalBytes) {
  const now = Date.now();
  const last = lastProgressSend.get(jobId) || 0;
  if (now - last >= PROGRESS_THROTTLE_MS) {
    lastProgressSend.set(jobId, now);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', { jobId, percent, downloadedBytes, totalBytes });
    }
  }
  if (mainWindow && !mainWindow.isDestroyed() && percent > 0) {
    mainWindow.setProgressBar(percent / 100);
  }
}

async function cancelDownloadById(jobId) {
  const download = activeDownloads.get(jobId);
  if (download) {
    if (download.controller) download.controller.abort();
    if (download.process)    download.process.kill();
    if (download.fileStream) download.fileStream.destroy();
    activeDownloads.delete(jobId);
  }
  const metadata = loadDownloadsMetadata();
  if (metadata[jobId]) {
    try { fs.unlinkSync(metadata[jobId].outputPath); } catch(e) {}
    delete metadata[jobId];
    saveDownloadsMetadata(metadata);
  }
  lastProgressSend.delete(jobId);
  if (global._notifMap && global._notifMap[jobId]) {
    try { global._notifMap[jobId].close(); } catch(e) {}
    delete global._notifMap[jobId];
  }
  sendDownloadNotification(jobId, { title: metadata[jobId]?.title || 'Download', status: 'cancelled' });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download:cancelled', jobId);
  }
}

function getVegaDownloadsFolder() {
  const folder = path.join(app.getPath('desktop'), 'Vega_Next-win');
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function loadDownloadsMetadata() {
  if (!fs.existsSync(downloadsDbPath)) return {};
  try { return JSON.parse(fs.readFileSync(downloadsDbPath, 'utf-8')); }
  catch(e) { return {}; }
}

function saveDownloadsMetadata(meta) {
  fs.writeFileSync(downloadsDbPath, JSON.stringify(meta, null, 2));
}

function getBundledFfmpegPath() {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, "build", "extraResources");
  return path.join(base, "ffmpeg", "ffmpeg.exe");
}

async function downloadHls(videoUrl, outputPath, jobId, headers = {}, title = '') {
  const ffmpegPath = getBundledFfmpegPath();
  if (!fs.existsSync(ffmpegPath)) throw new Error('FFmpeg not found');
  let headersArg = '';
  for (const [key, value] of Object.entries(headers)) headersArg += `-headers "${key}: ${value}" `;
  const args = [
    ...(headersArg ? headersArg.trim().split(' ') : []),
    '-i', videoUrl, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-f', 'mp4', '-y', outputPath,
  ].filter(Boolean);
  const ffmpeg = spawn(ffmpegPath, args);
  const emitter = new EventEmitter();
  activeDownloads.set(jobId, { process: ffmpeg, info: { url: videoUrl, outputPath, type: 'hls', headers }, emitter });
  sendDownloadNotification(jobId, { title, status: 'started' });
  let duration = 0, lastTime = 0;
  ffmpeg.stderr.on('data', (data) => {
    const str = data.toString();
    if (duration === 0 && str.includes('Duration:')) {
      const m = str.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (m) duration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
    }
    const tm = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (tm && duration > 0) {
      const current = parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseFloat(tm[3]);
      if (current !== lastTime) {
        lastTime = current;
        const percent = Math.min((current / duration) * 100, 99);
        emitter.emit('progress', { percent, bytes: current, total: duration });
        const meta = loadDownloadsMetadata();
        if (meta[jobId]) {
          meta[jobId].progress = percent;
          meta[jobId].downloadedBytes = current;
          meta[jobId].totalBytes = duration;
          saveDownloadsMetadata(meta);
        }
        sendProgressToRenderer(jobId, percent, current, duration);
      }
    }
  });
  ffmpeg.on('close', (code) => {
    activeDownloads.delete(jobId);
    lastProgressSend.delete(jobId);
    const meta = loadDownloadsMetadata();
    if (meta[jobId]) {
      meta[jobId].status = code === 0 ? 'completed' : 'error';
      if (code === 0) meta[jobId].progress = 100;
      saveDownloadsMetadata(meta);
    }
    if (code === 0) {
      emitter.emit('complete', outputPath);
      sendDownloadNotification(jobId, { title, totalBytes: duration, downloadedBytes: duration, status: 'completed' });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('download:complete', { jobId, outputPath });
    } else {
      emitter.emit('error', new Error(`FFmpeg exited with code ${code}`));
      sendDownloadNotification(jobId, { title, status: 'error' });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('download:error', { jobId, error: `FFmpeg code ${code}` });
    }
  });
  return jobId;
}

async function downloadNormal(url, outputPath, jobId, headers = {}, startByte = 0, title = '') {
  const controller     = new AbortController();
  const requestHeaders = { ...headers };
  if (startByte > 0) requestHeaders['Range'] = `bytes=${startByte}-`;
  
  let response;
  try {
    response = await axios({
      method: 'GET', url, headers: requestHeaders,
      responseType: 'stream', signal: controller.signal,
    });
  } catch (err) {
    const meta = loadDownloadsMetadata();
    if (meta[jobId]) {
      meta[jobId].status = 'error';
      saveDownloadsMetadata(meta);
    }
    sendDownloadNotification(jobId, { title, status: 'error' });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:error', { jobId, error: err.message });
    }
    throw err;
  }

  const contentLength = parseInt(response.headers['content-length'] || '0', 10);
  const totalBytes    = contentLength > 0 ? startByte + contentLength : 0;
  const fileStream = fs.createWriteStream(outputPath, { flags: startByte > 0 ? 'a' : 'w' });
  response.data.pipe(fileStream);
  const emitter = new EventEmitter();
  activeDownloads.set(jobId, { controller, fileStream, info: { url, outputPath, type: 'normal', headers, startByte }, emitter });
  sendDownloadNotification(jobId, { title, status: 'started' });
  
  let downloadedBytes = startByte;
  response.data.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    const percent = totalBytes > 0 ? Math.min((downloadedBytes / totalBytes) * 100, 99) : 0;
    emitter.emit('progress', { percent, bytes: downloadedBytes, total: totalBytes });
    const meta = loadDownloadsMetadata();
    if (meta[jobId]) {
      meta[jobId].progress = percent;
      meta[jobId].downloadedBytes = downloadedBytes;
      meta[jobId].totalBytes = totalBytes;
      saveDownloadsMetadata(meta);
    }
    sendProgressToRenderer(jobId, percent, downloadedBytes, totalBytes);
  });
  
  return new Promise((resolve, reject) => {
    fileStream.on('finish', () => {
      activeDownloads.delete(jobId);
      lastProgressSend.delete(jobId);
      const meta = loadDownloadsMetadata();
      if (meta[jobId]) {
        meta[jobId].status = 'completed';
        meta[jobId].progress = 100;
        meta[jobId].downloadedBytes = downloadedBytes;
        saveDownloadsMetadata(meta);
      }
      emitter.emit('complete', outputPath);
      sendDownloadNotification(jobId, { title, totalBytes, downloadedBytes, status: 'completed' });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('download:complete', { jobId, outputPath });
      resolve();
    });
    
    fileStream.on('error', (err) => {
      activeDownloads.delete(jobId);
      lastProgressSend.delete(jobId);
      const meta = loadDownloadsMetadata();
      if (meta[jobId]) meta[jobId].status = 'error';
      saveDownloadsMetadata(meta);
      emitter.emit('error', err);
      sendDownloadNotification(jobId, { title, status: 'error' });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('download:error', { jobId, error: err.message });
      reject(err);
    });
    
    response.data.on('error', (err) => {
      sendDownloadNotification(jobId, { title, status: 'error' });
      reject(err);
    });
  });
}

// ==================== EXTERNAL PLAYER LOGIC (System only) ====================
async function detectExternalPlayers() {
  const players = [];
  if (process.platform !== "win32") return players;
  const getRegValue = async (key, valueName) => {
    try {
      const { stdout } = await execPromise(`reg query "${key}" /v "${valueName}"`);
      const match = stdout.match(/REG_(?:SZ|EXPAND_SZ)\s+(.*)/);
      return match ? match[1].trim() : null;
    } catch { return null; }
  };
  const vlcPath = (await getRegValue("HKLM\\SOFTWARE\\VideoLAN\\VLC", "")) || (await getRegValue("HKCU\\SOFTWARE\\VideoLAN\\VLC", ""));
  if (vlcPath && fs.existsSync(vlcPath)) players.push({ name: "VLC (System)", path: vlcPath, type: "vlc" });
  const mpvPaths = ["C:\\Program Files\\mpv\\mpv.com", "C:\\Program Files\\mpv\\mpv.exe", "C:\\Program Files (x86)\\mpv\\mpv.exe"];
  for (const p of mpvPaths) if (fs.existsSync(p)) { players.push({ name: "MPV", path: p, type: "mpv" }); break; }
  const potPath = await getRegValue("HKLM\\SOFTWARE\\Daum\\PotPlayer", "InstallDir");
  if (potPath && fs.existsSync(path.join(potPath, "PotPlayer.exe"))) players.push({ name: "PotPlayer", path: path.join(potPath, "PotPlayer.exe"), type: "potplayer" });
  const mpcPath = (await getRegValue("HKLM\\SOFTWARE\\MPC-HC\\MPC-HC", "ExePath")) || (await getRegValue("HKCU\\SOFTWARE\\MPC-HC\\MPC-HC", "ExePath"));
  if (mpcPath && fs.existsSync(mpcPath)) players.push({ name: "MPC-HC", path: mpcPath, type: "mpc-hc" });
  const wmpPath = "C:\\Program Files\\Windows Media Player\\wmplayer.exe";
  if (fs.existsSync(wmpPath)) players.push({ name: "Windows Media Player", path: wmpPath, type: "wmp" });
  return players;
}

async function resolveStreamUrl(url) {
  if (!url || !url.startsWith('vega-local://')) return url;
  const fileName = url.replace('vega-local://', '');
  const folder   = getVegaDownloadsFolder();
  try {
    const files = await fs.promises.readdir(folder);
    const found = files.find(f => f.startsWith(fileName));
    if (found) return path.join(folder, found);
  } catch(e) {}
  return url;
}

async function launchPlayer(playerInfo, videoUrl) {
  const { path: playerPath, type } = playerInfo;
  const resolvedUrl = await resolveStreamUrl(videoUrl);
  if (activePlayerProcess) try { activePlayerProcess.kill(); } catch(e) {}
  activePlayerProcess = null;
  let args = [];
  if (type === "vlc") args = [resolvedUrl];
  else if (type === "mpv") args = [resolvedUrl, "--no-terminal", "--keep-open=yes"];
  else args = [resolvedUrl];
  const options = { detached: true, stdio: "ignore" };
  if (!fs.existsSync(playerPath)) return false;
  activePlayerProcess = spawn(playerPath, args, options);
  activePlayerProcess.unref();
  return true;
}

// ==================== ELECTRON WINDOW & IPC ====================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on("second-instance", () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

function createWindow() {
  const devURL = "http://127.0.0.1:5173";
  mainWindow = new BrowserWindow({
    width: 1280, height: 720, title: "Vega-Next 🎬", autoHideMenuBar: true,
    webPreferences: { 
      nodeIntegration: true, 
      contextIsolation: false, 
      webSecurity: false,
      webviewTag: true
    },
  });
  if (!app.isPackaged) {
    const loadDev = () => { mainWindow.loadURL(devURL).catch(() => setTimeout(loadDev, 1000)); };
    loadDev();
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html")).catch(console.error);
  }
}

app.whenReady().then(async () => {
  createWindow();
  const externalPlayers = await detectExternalPlayers();

  // ==================== WEB REQUEST HANDLER ====================
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      // If auto-referer mode is active, make every request refer to itself
      if (autoRefererActive) {
        console.log('[auto-referer] Self-referer for:', details.url);
        details.requestHeaders['Referer'] = details.url;
        try {
          details.requestHeaders['Origin'] = new URL(details.url).origin;
        } catch (_) {}
        callback({ requestHeaders: details.requestHeaders });
        return;
      }

      // Otherwise use the global referer/origin if set
      if (globalReferer || globalOrigin) {
        console.log('[onBeforeSendHeaders] URL:', details.url);
        if (globalReferer) {
          console.log('   -> Injecting Referer:', globalReferer);
          details.requestHeaders['Referer'] = globalReferer;
        }
        if (globalOrigin) {
          console.log('   -> Injecting Origin:', globalOrigin);
          details.requestHeaders['Origin'] = globalOrigin;
        }
      }
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // ==================== IPC: GLOBAL REFERER ====================
  ipcMain.handle('set-global-referer', (event, referer) => {
    refererSequence++;
    globalReferer = referer;
    try {
      globalOrigin = new URL(referer).origin;
    } catch {
      globalOrigin = referer;
    }
    activeRefererToken = refererSequence;
    console.log(`[IPC] Global referer set (token ${refererSequence}): ${referer}`);
    return refererSequence;
  });

  ipcMain.handle('clear-global-referer', (event, token) => {
    if (activeRefererToken === token) {
      console.log(`[IPC] Global referer cleared (token ${token})`);
      globalReferer = null;
      globalOrigin = null;
      activeRefererToken = 0;
    } else {
      console.log(`[IPC] Ignoring clear for stale token ${token} (active=${activeRefererToken})`);
    }
  });

  // ==================== IPC: AUTO-REFERER ====================
  ipcMain.handle('enable-auto-referer', () => {
    if (!autoRefererActive) {
      autoRefererActive = true;
      autoRefererToken = Date.now();
      console.log('[IPC] Auto-referer mode enabled');
    }
    return autoRefererToken;
  });

  ipcMain.handle('disable-auto-referer', (event, token) => {
    if (autoRefererActive && token === autoRefererToken) {
      autoRefererActive = false;
      console.log('[IPC] Auto-referer mode disabled');
    }
  });
  // ==============================================================

  ipcMain.on("launch-player", async (event, playerInfo, videoUrl) => { await launchPlayer(playerInfo, videoUrl); });
  ipcMain.handle("get-external-players", async () => externalPlayers);

  // ==================== SEARCH INSTALLED APP HANDLER ====================
  ipcMain.handle('search-system-app', async (event, query) => {
    if (process.platform !== "win32") return null;
    const searchName = query.toLowerCase().trim().replace(/\.exe$/i, '');
    if (fs.existsSync(query) && query.toLowerCase().endsWith('.exe')) {
      return { name: path.parse(query).name.toUpperCase(), path: query, type: 'custom' };
    }
    const regKey = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${searchName}.exe`;
    try {
      const { stdout } = await execPromise(`reg query "${regKey}" /ve`);
      const match = stdout.match(/REG_(?:SZ|EXPAND_SZ)\s+(.*)/i);
      if (match) {
        const appPath = match[1].trim();
        if (fs.existsSync(appPath)) {
          return { name: path.parse(appPath).name.toUpperCase(), path: appPath, type: 'custom' };
        }
      }
    } catch (e) { /* not found */ }
    try {
      const safeQuery = searchName.replace(/'/g, "''");
      const psScript = [
        `$ErrorActionPreference='SilentlyContinue'`,
        `$search='${safeQuery}'`,
        `$path1 = Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs'`,
        `$path2 = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'`,
        `$paths = @($path1, $path2)`,
        `$lnk = Get-ChildItem -Path $paths -Recurse -Filter "*$search*.lnk" -ErrorAction SilentlyContinue | Select-Object -First 1`,
        `if ($lnk) {`,
        `  $target = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk.FullName).TargetPath`,
        `  if ($target -match '\\.exe$') { Write-Output $target }`,
        `}`
      ].join('\n');
      const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');
      const psExe = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
      const { stdout } = await execPromise(`"${psExe}" -NoProfile -EncodedCommand ${base64Script}`);
      const exePath = stdout.trim();
      if (exePath && fs.existsSync(exePath) && exePath.toLowerCase().endsWith('.exe')) {
        return { name: path.parse(exePath).name.toUpperCase(), path: exePath, type: 'custom' };
      }
    } catch (e) {
      console.log('Start Menu search skipped:', e.message);
    }
    const fallbacks = [
      `C:\\Program Files\\DAUM\\PotPlayer\\PotPlayer64.exe`,
      `C:\\Program Files\\DAUM\\PotPlayer\\PotPlayer.exe`,
      `C:\\Program Files (x86)\\DAUM\\PotPlayer\\PotPlayer.exe`,
      `C:\\Program Files\\VideoLAN\\VLC\\vlc.exe`,
      `C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe`,
      `C:\\Program Files\\mpv\\mpv.exe`,
      `C:\\Program Files\\MPC-HC\\mpc-hc64.exe`,
      `C:\\Program Files (x86)\\MPC-HC\\mpc-hc.exe`,
    ];
    for (let p of fallbacks) {
      if (p.toLowerCase().includes(searchName) && fs.existsSync(p)) {
        return { name: path.parse(p).name.toUpperCase(), path: p, type: 'custom' };
      }
    }
    return null;
  });

  // ==================== VEGA FOLDER & FILE IPC ====================
  ipcMain.handle('get-vega-folder', () => getVegaDownloadsFolder());
  ipcMain.handle('check-file-exists', async (event, fileName) => {
    const folder = getVegaDownloadsFolder();
    try { return (await fs.promises.readdir(folder)).some(f => f.startsWith(fileName)); }
    catch { return false; }
  });
  ipcMain.handle('get-file-path', async (event, fileName) => {
    const folder = getVegaDownloadsFolder();
    const files  = await fs.promises.readdir(folder);
    const found  = files.find(f => f.startsWith(fileName));
    return found ? path.join(folder, found) : null;
  });
  ipcMain.handle('delete-file', async (event, filePath) => {
    try { await fs.promises.unlink(filePath); return true; }
    catch(err) { console.error('Delete failed:', err); return false; }
  });

  ipcMain.on('show-notification', (event, { title, body }) => {
    new Notification({ title, body, silent: false }).show();
  });

  // ==================== DOWNLOAD IPC ====================
  ipcMain.handle("download:start", async (event, { url, fileName, fileType, title, headers }) => {
    const jobId      = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const vegaFolder = getVegaDownloadsFolder();
    const outputPath = path.join(vegaFolder, `${fileName}.${fileType}`);
    const isHls      = fileType === 'm3u8' || fileType === 'hls';
    const meta = loadDownloadsMetadata();
    meta[jobId] = {
      fileName, title, url, fileType, outputPath,
      status: 'downloading', progress: 0,
      totalBytes: 0, downloadedBytes: 0, startTime: Date.now(),
    };
    saveDownloadsMetadata(meta);
    if (isHls) downloadHls(url, outputPath, jobId, headers, title).catch(console.error);
    else       downloadNormal(url, outputPath, jobId, headers, 0, title).catch(console.error);
    return jobId;
  });

  ipcMain.handle("download:cancel", async (event, jobId) => {
    await cancelDownloadById(jobId);
    return true;
  });
  ipcMain.handle("download:getProgress", async (event, jobId) => {
    return loadDownloadsMetadata()[jobId] || null;
  });
  ipcMain.handle("download:getAll", async () => loadDownloadsMetadata());
  ipcMain.handle("download:removeCompleted", async (event, jobId) => {
    const meta = loadDownloadsMetadata();
    if (meta[jobId]?.status === 'completed') {
      delete meta[jobId];
      saveDownloadsMetadata(meta);
    }
    return true;
  });

  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (activePlayerProcess) try { activePlayerProcess.kill(); } catch(e) {}
  if (process.platform !== "darwin") app.quit();
});