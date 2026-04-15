import React, { useState, useEffect, useCallback, useRef } from 'react';
import Nav from '../../components/Nav';

// Safely get Electron modules (works with or without preload)
const getElectron = () => {
  try {
    if (window.require) {
      const { ipcRenderer, shell } = window.require('electron');
      return { ipcRenderer, shell };
    }
    // Fallback for web mode (development without Electron)
    return { ipcRenderer: null, shell: null };
  } catch (e) {
    console.warn('Electron not available:', e);
    return { ipcRenderer: null, shell: null };
  }
};

const { ipcRenderer, shell } = getElectron();

// ─── Local Storage ─────────────────────────────────────────────────────
const storage = {
  get: (key, defaultValue) => {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    try { return JSON.parse(val); } catch { return val; }
  },
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
};

// ─── Toast ────────────────────────────────────────────────────────────
const showToast = (message, duration = 2500) => {
  const existing = document.getElementById('vega-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'vega-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    backgroundColor: '#1f1f1f', color: '#fff', padding: '10px 20px',
    borderRadius: '10px', zIndex: 9999, fontSize: '14px',
    fontFamily: 'system-ui, sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

// ─── Helpers ──────────────────────────────────────────────────────────
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// ─── Main Component ───────────────────────────────────────────────────
const Downloads = ({ onNavigate, currentTab }) => {
  const [downloads, setDownloads] = useState([]);
  const pollingIntervals = useRef({});

  const loadDownloads = useCallback(() => {
    setDownloads(storage.get('vega_downloads', []));
  }, []);

  const saveDownloads = useCallback((newDownloads) => {
    storage.set('vega_downloads', newDownloads);
    setDownloads(newDownloads);
  }, []);

  const updateDownload = useCallback((jobId, updates) => {
    setDownloads(prev => {
      const newList = prev.map(d => d.jobId === jobId ? { ...d, ...updates } : d);
      storage.set('vega_downloads', newList);
      return newList;
    });
  }, []);

  const removeDownload = useCallback((jobId) => {
    setDownloads(prev => {
      const newList = prev.filter(d => d.jobId !== jobId);
      storage.set('vega_downloads', newList);
      return newList;
    });
    if (pollingIntervals.current[jobId]) {
      clearInterval(pollingIntervals.current[jobId]);
      delete pollingIntervals.current[jobId];
    }
  }, []);

  const startPolling = useCallback((jobId) => {
    if (!ipcRenderer) return;
    if (pollingIntervals.current[jobId]) clearInterval(pollingIntervals.current[jobId]);
    const interval = setInterval(async () => {
      try {
        const progress = await ipcRenderer.invoke('download:getProgress', jobId);
        if (progress) {
          updateDownload(jobId, {
            progress: progress.percent || 0,
            speed: progress.speed,
            receivedBytes: progress.received,
            totalBytes: progress.total,
            status: progress.status,
            outputPath: progress.outputPath,
          });
          if (progress.status === 'completed' || progress.status === 'error') {
            clearInterval(interval);
            delete pollingIntervals.current[jobId];
            if (progress.status === 'completed') showToast('Download completed');
            else if (progress.status === 'error') showToast('Download failed');
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
        clearInterval(interval);
        delete pollingIntervals.current[jobId];
      }
    }, 1000);
    pollingIntervals.current[jobId] = interval;
  }, [updateDownload]);

  useEffect(() => {
    loadDownloads();
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, [loadDownloads]);

  useEffect(() => {
    downloads.forEach(d => {
      if ((d.status === 'downloading' || d.status === 'paused') && !pollingIntervals.current[d.jobId]) {
        startPolling(d.jobId);
      }
    });
  }, [downloads, startPolling]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handlePause = async (jobId) => {
    if (!ipcRenderer) return;
    try {
      await ipcRenderer.invoke('download:pause', jobId);
      updateDownload(jobId, { status: 'paused' });
      showToast('Paused');
    } catch (err) { showToast('Failed to pause'); }
  };

  const handleResume = async (jobId) => {
    if (!ipcRenderer) return;
    try {
      await ipcRenderer.invoke('download:resume', jobId);
      updateDownload(jobId, { status: 'downloading' });
      startPolling(jobId);
      showToast('Resumed');
    } catch (err) { showToast('Failed to resume'); }
  };

  const handleCancel = async (jobId) => {
    if (!ipcRenderer) return;
    try {
      await ipcRenderer.invoke('download:cancel', jobId);
      removeDownload(jobId);
      showToast('Cancelled');
    } catch (err) { showToast('Failed to cancel'); }
  };

  const handleOpenFile = (filePath) => {
    if (!shell) return;
    shell.showItemInFolder(filePath).catch(() => showToast('Cannot open folder'));
  };

  const handleClearCompleted = () => {
    saveDownloads(downloads.filter(d => d.status !== 'completed'));
    showToast('Cleared completed');
  };

  // ─── Styles (same as Settings) ───────────────────────────────────────
  const styles = {
    container: { height: '100vh', width: '100vw', backgroundColor: '#050505', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
    header: { padding: '20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '16px' },
    backButton: { background: 'none', border: 'none', color: '#3b82f6', fontSize: '24px', cursor: 'pointer', padding: '0 8px' },
    title: { margin: 0, fontSize: '24px' },
    content: { flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '80px' },
    section: { marginBottom: '24px' },
    sectionTitle: { color: '#aaa', fontSize: '14px', marginBottom: '8px', marginLeft: '8px' },
    card: { backgroundColor: '#1A1A1A', borderRadius: '12px', overflow: 'hidden' },
    downloadItem: { padding: '16px', borderBottom: '1px solid #262626' },
    downloadTitle: { fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' },
    downloadMeta: { fontSize: '12px', color: '#aaa', marginBottom: '8px' },
    progressBar: { height: '4px', backgroundColor: '#333', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#3b82f6', width: '0%', transition: 'width 0.2s' },
    buttonGroup: { display: 'flex', gap: '12px', marginTop: '12px' },
    button: { background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 12px', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px' },
    buttonDanger: { background: 'rgba(239,68,68,0.2)', color: '#ef4444' },
    buttonSuccess: { background: 'rgba(34,197,94,0.2)', color: '#22c55e' },
    emptyState: { textAlign: 'center', color: '#aaa', padding: '40px' },
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => onNavigate('settings')}>←</button>
        <h2 style={styles.title}>Downloads</h2>
        {downloads.some(d => d.status === 'completed') && (
          <button onClick={handleClearCompleted} style={{ marginLeft: 'auto', background: '#262626', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#3b82f6', cursor: 'pointer' }}>
            Clear Completed
          </button>
        )}
      </header>
      <main style={styles.content}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Active & Completed</div>
          <div style={styles.card}>
            {downloads.length === 0 ? (
              <div style={styles.emptyState}>No downloads yet.</div>
            ) : (
              downloads.map(d => (
                <div key={d.jobId} style={styles.downloadItem}>
                  <div style={styles.downloadTitle}>{d.title || d.fileName}</div>
                  <div style={styles.downloadMeta}>
                    {d.totalBytes ? formatBytes(d.totalBytes) : 'Unknown size'}
                    {d.speed && ` • ${formatBytes(d.speed)}/s`}
                    {d.status === 'completed' && ' • Completed'}
                    {d.status === 'error' && ' • Error'}
                  </div>
                  {d.status === 'downloading' && (
                    <>
                      <div style={styles.progressBar}>
                        <div style={{ ...styles.progressFill, width: `${d.progress || 0}%` }} />
                      </div>
                      <div style={styles.buttonGroup}>
                        <button style={styles.button} onClick={() => handlePause(d.jobId)}>Pause</button>
                        <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => handleCancel(d.jobId)}>Cancel</button>
                      </div>
                    </>
                  )}
                  {d.status === 'paused' && (
                    <div style={styles.buttonGroup}>
                      <button style={{ ...styles.button, ...styles.buttonSuccess }} onClick={() => handleResume(d.jobId)}>Resume</button>
                      <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => handleCancel(d.jobId)}>Cancel</button>
                    </div>
                  )}
                  {d.status === 'completed' && (
                    <div style={styles.buttonGroup}>
                      <button style={styles.button} onClick={() => handleOpenFile(d.outputPath)}>Show in Folder</button>
                      <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => removeDownload(d.jobId)}>Remove</button>
                    </div>
                  )}
                  {d.status === 'error' && (
                    <div style={styles.buttonGroup}>
                      <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => removeDownload(d.jobId)}>Dismiss</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <Nav currentTab={currentTab} onTabChange={onNavigate} />
    </div>
  );
};

export default Downloads;