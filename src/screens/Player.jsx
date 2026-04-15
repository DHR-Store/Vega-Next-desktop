import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Hls from 'hls.js';
import {
  Play, Pause, Loader2, AlertCircle, ChevronLeft,
  Settings, Maximize, PictureInPicture, Volume2, VolumeX, Check,
  Gauge, Monitor, Music, RefreshCw, Subtitles, Upload, Search,
  Server, List, SkipForward,
} from 'lucide-react';
import { useStream, usePlayerSettings } from '../lib/hooks/useStream';
import { useEpisodes } from '../lib/hooks/useEpisodes';
import pako from 'pako';
import usePlayerStore from '../lib/zustand/playerStore';
import useThemeStore from '../lib/zustand/themeStore';
import { DiscordRPC } from '../lib/services/DiscordRPC';

// ─── Storage helpers ──────────────────────────────────────────────────────────
const storage = {
  get: (key, def) => {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    try { return JSON.parse(v); } catch { return v; }
  },
};

// ─── Electron detection ───────────────────────────────────────────────────────
// window.electronAPI is injected by preload.js via contextBridge.
// When running in a plain browser (dev/web build) it will be undefined,
// so every call is guarded with optional-chaining (?.) to keep the component
// fully functional in both environments.
const isElectron = () =>
  typeof window !== 'undefined' && typeof window.electronAPI?.isElectron === 'function';

/**
 * Register stream-specific headers with the Electron main process so that
 * session.webRequest.onBeforeSendHeaders can inject them into every CDN
 * request (m3u8 playlist + every .ts segment).
 *
 * WHY:  Chromium's XHR/fetch spec marks Referer, Origin, and User-Agent as
 *       "forbidden request headers" — calling xhr.setRequestHeader() with
 *       them silently fails even inside Electron's renderer. The only safe
 *       way to send them is from the main process via webRequest.
 *
 * @param {string} streamUrl - The full HLS or MP4 URL being played.
 * @param {Record<string,string>} headers - Headers from the stream object.
 */
function registerElectronHeaders(streamUrl, headers = {}) {
  if (!isElectron()) return;

  try {
    const urlObj     = new URL(streamUrl);
    // Match the exact host so we don't over-inject headers on unrelated domains
    const urlPattern = `${urlObj.protocol}//${urlObj.hostname}/*`;

    // Build the header map: start with provider-supplied headers, then fill
    // in sensible defaults for anything that wasn't provided.
    const mergedHeaders = { ...headers };

    if (!mergedHeaders.Referer && !mergedHeaders.referer) {
      mergedHeaders.Referer = urlObj.origin + '/';
    }
    if (!mergedHeaders.Origin && !mergedHeaders.origin) {
      mergedHeaders.Origin = urlObj.origin;
    }

    console.log('[Player] Registering Electron headers for', urlPattern, mergedHeaders);
    window.electronAPI.setStreamHeaders(mergedHeaders, urlPattern);
  } catch (err) {
    // URL parse failed (e.g. local file:// path) — fall back to global pattern
    console.warn('[Player] Could not derive URL pattern, using <all_urls>:', err.message);
    window.electronAPI.setStreamHeaders(headers, '<all_urls>');
  }
}

/**
 * Proxy-fetch the m3u8 playlist through Node.js (Electron only).
 * Falls back to a regular fetch() in the browser.
 * Returns { ok, text } or throws.
 *
 * This handles the edge-case where the INITIAL playlist URL returns 403
 * even before hls.js gets involved — because the first browser fetch still
 * can't set Referer. We fetch the text in Node, turn it into a Blob URL,
 * and hand that to hls.js instead.
 */
async function safeFetchM3u8(url, headers = {}) {
  if (isElectron() && window.electronAPI?.proxyFetch) {
    const result = await window.electronAPI.proxyFetch(url, headers);
    if (!result.ok) {
      throw new Error(`Proxy fetch failed: HTTP ${result.status} for ${url}`);
    }
    // Convert the number[] body back to a string
    const text = new TextDecoder().decode(new Uint8Array(result.body));
    return { ok: true, text, contentType: result.contentType };
  }
  // Web/browser fallback
  const res  = await fetch(url);
  const text = await res.text();
  return { ok: res.ok, text, contentType: res.headers.get('content-type') || '' };
}

const Player = ({ routeParams = {}, onBack }) => {
  const primary = useThemeStore((s) => s.primary);

  // ─── Active episode state ─────────────────────────────────────────────────
  const [activeEpisode, setActiveEpisode] = useState(routeParams);

  const displayTitle = activeEpisode?.metaTitle || activeEpisode?.title || routeParams?.metaTitle || routeParams?.title || 'Unknown';
  const episodeTitle = activeEpisode?.metaTitle ? (activeEpisode?.title || '') : '';
  const isLocalFile  = routeParams?.isLocal === true && routeParams?.link?.startsWith('file://');

  const [currentEpIndex, setCurrentEpIndex] = useState(routeParams?.linkIndex ?? 0);

  // ─── Store ────────────────────────────────────────────────────────────────
  const {
    volume: storedVolume, isMuted: storedIsMuted, playbackRate: storedPlaybackRate,
    videoFit: storedVideoFit, selectedAudioTrackId: storedAudioTrackId,
    elapsedTime: storedElapsedTime, selectedStreamLink: storedStreamLink,
    playMedia, updatePlaybackProgress,
    setVolume: storeSetVolume, setMuted: storeSetMuted,
    setPlaybackRate: storeSetPlaybackRate, cycleVideoFit: storeCycleVideoFit,
    setSelectedAudioTrackId: storeSetAudioTrackId, setSelectedStreamLink: storeSetStreamLink,
  } = usePlayerStore();

  // ─── Stream ───────────────────────────────────────────────────────────────
  const { streamData, isLoading, error, selectedStream, setSelectedStream } = useStream({
    activeEpisode: isLocalFile ? null : activeEpisode,
    routeParams:   isLocalFile ? {} : routeParams,
    provider:      isLocalFile ? null : (activeEpisode?.provider || routeParams?.provider),
    enabled:       !isLocalFile,
  });

  useEffect(() => {
    if (isLocalFile && routeParams?.link) {
      setSelectedStream({ link: routeParams.link, server: 'Local File', type: 'mp4', quality: 'Downloaded', headers: {} });
    }
  }, [isLocalFile, routeParams?.link]); // eslint-disable-line

  useEffect(() => {
    if (!streamData?.length || !storedStreamLink) return;
    const match = streamData.find((s) => s.link === storedStreamLink);
    if (match && match.link !== selectedStream?.link) setSelectedStream(match);
  }, [streamData]); // eslint-disable-line

  // ─── Episodes ─────────────────────────────────────────────────────────────
  const propsEpisodeList = useMemo(() => {
    const list = routeParams?.episodeList;
    return Array.isArray(list) && list.length > 0 ? list : null;
  }, []); // eslint-disable-line

  const episodesLink  = routeParams?.episodesLink || routeParams?.episodes || activeEpisode?.episodesLink || null;
  const providerValue = routeParams?.provider?.value || routeParams?.provider || routeParams?.providerValue || null;

  const { data: fetchedEpisodes = [], isFetching: episodesFetching } = useEpisodes(
    episodesLink,
    providerValue,
    !propsEpisodeList && !!episodesLink && !!providerValue
  );

  const episodes = useMemo(
    () => propsEpisodeList || fetchedEpisodes,
    [propsEpisodeList, fetchedEpisodes]
  );

  const nextEpisode = currentEpIndex >= 0 && currentEpIndex < episodes.length - 1
    ? episodes[currentEpIndex + 1]
    : null;

  const getEpisodeLabel = (ep, idx) =>
    ep?.title || ep?.name || `Episode ${ep?.number || ep?.episode || idx + 1}`;

  // ─── Player settings hook ─────────────────────────────────────────────────
  const { showControls, setShowControls, isPlayerLocked } = usePlayerSettings();

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const videoRef             = useRef(null);
  const playerRef            = useRef(null);
  const containerRef         = useRef(null);
  const controlsTimeoutRef   = useRef(null);
  const hlsRef               = useRef(null);
  const retryCountRef        = useRef(0);
  const subtitleUrlsRef      = useRef([]);
  const progressSaveTimerRef = useRef(null);

  // ─── Discord RPC refs ─────────────────────────────────────────────────────
  const discordLastStartRef  = useRef(0);
  const discordWasPlayingRef = useRef(false);
  const DISCORD_SEEK_THRESHOLD = 2000;

  // ─── Ephemeral state ──────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [playerError, setPlayerError] = useState(false);
  const [isRetrying, setIsRetrying]   = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // ─── Persisted settings ───────────────────────────────────────────────────
  const [isMuted, setIsMuted]           = useState(storedIsMuted);
  const [volume, setVolume]             = useState(storedVolume);
  const [playbackRate, setPlaybackRate] = useState(storedPlaybackRate);
  const [videoFit, setVideoFit]         = useState(storedVideoFit);
  const [currentAudioTrackId, setCurrentAudioTrackId] = useState(storedAudioTrackId);

  // ─── Audio / subtitle state ───────────────────────────────────────────────
  const [audioTracks, setAudioTracks]                       = useState([]);
  const [refreshingAudio, setRefreshingAudio]               = useState(false);
  const [subtitleTracks, setSubtitleTracks]                 = useState([]);
  const [currentSubtitleTrackId, setCurrentSubtitleTrackId] = useState('off');

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings]         = useState(false);
  const [activeTab, setActiveTab]               = useState('audio');
  const [showStreamMenu, setShowStreamMenu]     = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showSearchPanel, setShowSearchPanel]   = useState(false);
  const [showEpisodes, setShowEpisodes]         = useState(false);
  const [searchQuery, setSearchQuery]           = useState(displayTitle || '');
  const [searchLang, setSearchLang]             = useState('eng');
  const [searchSeason, setSearchSeason]         = useState('');
  const [searchEpisode, setSearchEpisode]       = useState('');
  const [searchResults, setSearchResults]       = useState([]);
  const [searchLoading, setSearchLoading]       = useState(false);
  const [searchError, setSearchError]           = useState('');

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const subLanguages = [
    { name: 'English', id: 'eng' }, { name: 'Spanish', id: 'spa' },
    { name: 'French', id: 'fre' }, { name: 'German', id: 'ger' },
    { name: 'Italian', id: 'ita' }, { name: 'Portuguese', id: 'por' },
    { name: 'Russian', id: 'rus' }, { name: 'Chinese', id: 'chi' },
    { name: 'Japanese', id: 'jpn' }, { name: 'Korean', id: 'kor' },
    { name: 'Arabic', id: 'ara' }, { name: 'Hindi', id: 'hin' },
  ];

  // ─── Quality / format helpers ─────────────────────────────────────────────
  const getStreamQuality = (stream) => {
    if (!stream) return 'Unknown';
    if (stream.quality) return stream.quality;
    if (stream.resolution) return stream.resolution;
    if (stream.height) return `${stream.height}p`;
    if (stream.label) return stream.label;
    const text = `${stream.server || ''} ${stream.type || ''} ${stream.link || ''}`.toLowerCase();
    const patterns = [
      { regex: /\b(4320p?|8k)\b/i, label: '8K' },
      { regex: /\b(2160p?|4k)\b/i, label: '4K' },
      { regex: /\b(1440p?|2k)\b/i, label: '2K' },
      { regex: /\b(1080p?|fullhd|fhd)\b/i, label: '1080p' },
      { regex: /\b(720p?|hd)\b/i, label: '720p' },
      { regex: /\b(480p?|ntsc|sd)\b/i, label: '480p' },
      { regex: /\b(360p?)\b/i, label: '360p' },
    ];
    for (const p of patterns) { if (p.regex.test(text)) return p.label; }
    return stream.type ? stream.type.toUpperCase() : 'Auto';
  };

  const getStreamFormat = (stream) => {
    if (!stream) return '';
    const type = stream.type || stream.container || '';
    if (type) return type.toUpperCase();
    const ext = (stream.link || '').split('.').pop().split('?')[0];
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext.toLowerCase())) return ext.toUpperCase();
    return '';
  };

  // ─── Discord RPC – Effect 1: connect / disconnect ─────────────────────────
  useEffect(() => {
    const savedToken = storage.get('discord_token', '');
    if (savedToken && savedToken.length > 20) {
      DiscordRPC.connect(savedToken);
    }
    return () => { DiscordRPC.disconnect(); };
  }, []); // eslint-disable-line

  // ─── Discord RPC – Effect 2: update presence ──────────────────────────────
  useEffect(() => {
    if (!duration) return;
    const poster    = routeParams?.poster || activeEpisode?.poster || null;
    const provider  = routeParams?.providerValue || routeParams?.provider || null;
    const mainTitle = displayTitle;
    const subState  = episodeTitle || 'Watching Now';

    if (isPlaying) {
      const nowMs       = Date.now();
      const startTimeMs = Math.floor(nowMs - currentTime * 1000);
      const endTimeMs   = Math.floor(startTimeMs + duration * 1000);
      const shifted     = Math.abs(startTimeMs - discordLastStartRef.current) > DISCORD_SEEK_THRESHOLD;
      if (shifted || !discordWasPlayingRef.current) {
        discordLastStartRef.current  = startTimeMs;
        discordWasPlayingRef.current = true;
        DiscordRPC.updatePresence(mainTitle, subState, startTimeMs, endTimeMs, poster, provider);
      }
    } else {
      if (discordWasPlayingRef.current || discordLastStartRef.current !== 0) {
        discordWasPlayingRef.current = false;
        discordLastStartRef.current  = 0;
        DiscordRPC.updatePresence(mainTitle, `Paused – ${subState}`, undefined, undefined, poster, provider);
      }
    }
  }, [isPlaying, duration, currentTime]); // eslint-disable-line

  // ─── Audio track handling ─────────────────────────────────────────────────
  const refreshAudioTracks = useCallback(() => {
    if (hlsRef.current?.audioTracks?.length > 0) {
      const hlsTracks = hlsRef.current.audioTracks.map((t, i) => ({
        id: i, label: t.name || t.language || `Audio ${i + 1}`,
        language: t.language, enabled: hlsRef.current.audioTrack === i,
      }));
      setAudioTracks(hlsTracks);
      setCurrentAudioTrackId(hlsRef.current.audioTrack);
      setRefreshingAudio(false);
      return;
    }
    if (!playerRef.current) return;
    const trackList = [];
    let selectedId  = null;
    const tracks    = playerRef.current.audioTracks();
    if (tracks?.length > 0) {
      for (let i = 0; i < tracks.length; i++) {
        trackList.push({ id: tracks[i].id || i, label: tracks[i].label || tracks[i].language || `Track ${i + 1}`, language: tracks[i].language, enabled: tracks[i].enabled });
        if (tracks[i].enabled) selectedId = tracks[i].id || i;
      }
    } else {
      const ve = videoRef.current;
      if (ve?.audioTracks?.length > 0) {
        for (let i = 0; i < ve.audioTracks.length; i++) {
          const t = ve.audioTracks[i];
          trackList.push({ id: i, label: t.label || `Audio ${i + 1}`, language: t.language, enabled: t.enabled });
          if (t.enabled) selectedId = i;
        }
      }
    }
    setAudioTracks(trackList);
    if (selectedId !== null) setCurrentAudioTrackId(selectedId);
    setRefreshingAudio(false);
  }, []);

  const changeAudioTrack = useCallback((trackId) => {
    if (hlsRef.current?.audioTracks?.length > 0) {
      hlsRef.current.audioTrack = trackId;
    } else if (playerRef.current) {
      const tracks = playerRef.current.audioTracks();
      if (tracks?.length > 0) {
        for (let i = 0; i < tracks.length; i++) tracks[i].enabled = tracks[i].id === trackId || i === trackId;
      } else {
        const ve = videoRef.current;
        if (ve?.audioTracks) {
          for (let i = 0; i < ve.audioTracks.length; i++) ve.audioTracks[i].enabled = i === trackId;
        }
      }
    }
    setCurrentAudioTrackId(trackId);
    storeSetAudioTrackId(trackId);
    setShowSettings(false);
  }, [storeSetAudioTrackId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if ((playerRef.current || hlsRef.current) && audioTracks.length === 0) refreshAudioTracks();
      else if (audioTracks.length > 0) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [audioTracks.length, refreshAudioTracks]);

  // ─── Subtitle handling ────────────────────────────────────────────────────
  const refreshSubtitleTracks = useCallback(() => {
    if (!playerRef.current) return;
    const tracks    = playerRef.current.textTracks();
    const trackList = [];
    let activeId    = 'off';
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
        const id = tracks[i].id || `${tracks[i].label}-${i}`;
        trackList.push({ id, label: tracks[i].label || `Subtitle ${i + 1}`, language: tracks[i].language, mode: tracks[i].mode });
        if (tracks[i].mode === 'showing') activeId = id;
      }
    }
    setSubtitleTracks(trackList);
    setCurrentSubtitleTrackId(activeId);
  }, []);

  const addSubtitleFromFile = useCallback((file) => {
    if (!playerRef.current) return;
    const url      = URL.createObjectURL(file);
    subtitleUrlsRef.current.push(url);
    const label    = file.name.replace(/\.[^/.]+$/, '');
    const language = (file.name.match(/\.([a-z]{2,3})(?:\.|$)/i) || [])[1] || 'en';
    playerRef.current.addRemoteTextTrack({ kind: 'subtitles', label, language, src: url }, false);
    setTimeout(() => {
      const tracks = playerRef.current.textTracks();
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === label) tracks[i].mode = 'showing';
        else if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') tracks[i].mode = 'hidden';
      }
      refreshSubtitleTracks();
    }, 200);
    setShowSubtitleMenu(false);
  }, [refreshSubtitleTracks]);

  const addSubtitleFromUrl = useCallback(async (result) => {
    const subtitleUrl = result.SubDownloadLink;
    if (!subtitleUrl) return;
    try {
      const response = await fetch(subtitleUrl);
      if (!response.ok) throw new Error('Failed to download subtitle');
      let blob = await response.blob();
      if (subtitleUrl.endsWith('.gz')) {
        const ab  = await blob.arrayBuffer();
        const dec = pako.inflate(new Uint8Array(ab), { to: 'string' });
        blob = new Blob([dec], { type: 'text/vtt' });
      }
      const url      = URL.createObjectURL(blob);
      subtitleUrlsRef.current.push(url);
      const label    = `${result.SubLanguageID} - ${result.MovieName?.slice(0, 30)}`;
      const language = result.ISO639 || 'en';
      if (playerRef.current) {
        playerRef.current.addRemoteTextTrack({ kind: 'subtitles', label, language, src: url }, false);
        setTimeout(() => {
          const tracks = playerRef.current.textTracks();
          for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].label === label) tracks[i].mode = 'showing';
            else if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') tracks[i].mode = 'hidden';
          }
          refreshSubtitleTracks();
        }, 200);
      }
      setShowSubtitleMenu(false);
      setShowSearchPanel(false);
    } catch (err) {
      console.error('Failed to add subtitle:', err);
      alert('Could not load subtitle');
    }
  }, [refreshSubtitleTracks]);

  const removeSubtitleTrack = useCallback((trackId) => {
    if (!playerRef.current) return;
    const remoteTracks = playerRef.current.remoteTextTracks();
    for (let i = 0; i < remoteTracks.length; i++) {
      const t  = remoteTracks[i];
      const id = t.id || `${t.label}-${i}`;
      if (id === trackId) {
        playerRef.current.removeRemoteTextTrack(t);
        if (t.src?.startsWith('blob:')) URL.revokeObjectURL(t.src);
        break;
      }
    }
    if (currentSubtitleTrackId === trackId) setCurrentSubtitleTrackId('off');
    setTimeout(refreshSubtitleTracks, 100);
  }, [currentSubtitleTrackId, refreshSubtitleTracks]);

  const setActiveSubtitle = useCallback((trackId) => {
    if (!playerRef.current) return;
    const tracks = playerRef.current.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
        const id = tracks[i].id || `${tracks[i].label}-${i}`;
        tracks[i].mode = id === trackId && trackId !== 'off' ? 'showing' : 'hidden';
      }
    }
    setCurrentSubtitleTrackId(trackId);
    setShowSubtitleMenu(false);
    refreshSubtitleTracks();
  }, [refreshSubtitleTracks]);

  // ─── Subtitle search ──────────────────────────────────────────────────────
  const searchSubtitles = async () => {
    if (!searchQuery.trim()) { setSearchError('Please enter a title or IMDb ID'); return; }
    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const isImdb = searchQuery.trim().startsWith('tt');
      const url = `https://rest.opensubtitles.org/search${searchEpisode ? '/episode-' + searchEpisode : ''}${(isImdb ? '/imdbid-' : '/query-') + encodeURIComponent(searchQuery.trim().toLowerCase())}${searchSeason ? '/season-' + searchSeason : ''}${searchLang ? '/sublanguageid-' + searchLang : ''}`;
      const res  = await fetch(url, { headers: { 'x-user-agent': 'VLSub 0.10.2' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.length) setSearchError('No subtitles found');
      else setSearchResults(data);
    } catch (err) {
      setSearchError('Failed to search subtitles');
    } finally {
      setSearchLoading(false);
    }
  };

  // ─── Episode selection ────────────────────────────────────────────────────
  const handleEpisodeSelect = useCallback((ep, idx) => {
    if (!ep?.link) return;
    setPlayerError(false);
    setIsRetrying(false);
    if (typeof idx === 'number') setCurrentEpIndex(idx);
    setActiveEpisode({
      ...routeParams,
      link:      ep.link,
      title:     ep.title || ep.name || ep.number || ep.episode || '',
      metaTitle: routeParams?.metaTitle || routeParams?.title,
    });
  }, [routeParams]);

  useEffect(() => {
    if (isPlaying && showEpisodes) {
      const timer = setTimeout(() => setShowEpisodes(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, showEpisodes]);

  // ─── Playback controls ────────────────────────────────────────────────────
  const togglePlay = () => {
    if (playerError || !playerRef.current) return;
    if (isPlaying) playerRef.current.pause();
    else playerRef.current.play();
  };

  const handleMuteToggle = () => {
    if (!playerRef.current) return;
    const newMute = !isMuted;
    playerRef.current.muted(newMute);
    setIsMuted(newMute);
    storeSetMuted(newMute);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!playerRef.current) return;
    playerRef.current.volume(val);
    setVolume(val);
    setIsMuted(val === 0);
    storeSetVolume(val);
  };

  const handleSeek = (e) => {
    if (playerError) return;
    const rect    = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    if (!isNaN(newTime) && playerRef.current) playerRef.current.currentTime(newTime);
  };

  const changePlaybackSpeed = (speed) => {
    if (playerRef.current) playerRef.current.playbackRate(speed);
    setPlaybackRate(speed);
    storeSetPlaybackRate(speed);
    setShowSettings(false);
  };

  const cycleVideoFit = () => {
    const nextMode = storeCycleVideoFit();
    setVideoFit(nextMode);
    if (videoRef.current) videoRef.current.style.objectFit = nextMode;
  };

  const saveProgressNow = useCallback(() => {
    if (playerRef.current) {
      try {
        const t = playerRef.current.currentTime();
        if (t > 5) updatePlaybackProgress(t);
      } catch (_) {}
    }
  }, [updatePlaybackProgress]);

  // ─── Player init ──────────────────────────────────────────────────────────
  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  FIX: Forbidden-header injection for Electron                           ║
  // ║                                                                          ║
  // ║  BEFORE (broken):                                                        ║
  // ║    hls = new Hls({ xhrSetup: (xhr, url) => {                            ║
  // ║      xhr.setRequestHeader('Referer', ...)   // ← silently refused       ║
  // ║      xhr.setRequestHeader('Origin', ...)    // ← silently refused       ║
  // ║      xhr.setRequestHeader('User-Agent', ...)// ← silently refused       ║
  // ║    }})                                                                   ║
  // ║                                                                          ║
  // ║  AFTER (fixed):                                                          ║
  // ║    1. Call registerElectronHeaders() BEFORE initPlayer() runs.          ║
  // ║       This tells the main process to intercept every outgoing request    ║
  // ║       to the CDN domain and inject the headers there — in Node.js,      ║
  // ║       where no forbidden-header restriction exists.                      ║
  // ║    2. hls.js uses a plain Hls() with NO xhrSetup at all.                ║
  // ║       All segment requests go through the webRequest handler in main.js  ║
  // ║       which adds Referer/Origin/User-Agent transparently.               ║
  // ║    3. For Electron: safeFetchM3u8() is used to proxy-fetch the initial  ║
  // ║       playlist through Node.js (handles the edge-case where even the    ║
  // ║       first playlist GET would return 403 without Referer).             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    if (!selectedStream?.link) return;
    const streamUrl = selectedStream.link;
    const isLocal   = streamUrl.startsWith('file://');
    let isMounted   = true;

    setPlayerError(false);
    setIsBuffering(false);
    setAudioTracks([]);
    setSubtitleTracks([]);
    setCurrentSubtitleTrackId('off');
    setCurrentTime(0);
    setDuration(0);

    if (playerRef.current) { playerRef.current.dispose(); playerRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    subtitleUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    subtitleUrlsRef.current = [];

    const initVolume  = storedVolume;
    const initMuted   = storedIsMuted;
    const initRate    = storedPlaybackRate;
    const initFit     = storedVideoFit;
    const isSameMedia = usePlayerStore.getState().currentMedia?.link === streamUrl;
    const initElapsed = isSameMedia ? storedElapsedTime : 0;

    // ── STEP 1: Register headers with Electron BEFORE the player is created ─
    // This ensures that even the very first request hls.js makes (the m3u8
    // playlist fetch) already carries Referer/Origin in the main process
    // webRequest handler. Without this step the playlist returns 403 and
    // hls.js never gets to load segments.
    if (!isLocal) {
      registerElectronHeaders(streamUrl, selectedStream?.headers || {});
    }

    const isHls = streamUrl.includes('.m3u8') || (selectedStream?.type || '').toLowerCase() === 'm3u8';

    const initPlayer = async () => {
      try {
        if (!videoRef.current || !videoRef.current.isConnected) {
          console.warn('[Player] Video element not ready, retrying…');
          setTimeout(initPlayer, 200);
          return;
        }

        const player = videojs(videoRef.current, {
          controls: false, autoplay: true, preload: 'auto', fluid: false,
          playbackRates: playbackSpeeds,
          html5: {
            vhs: { overrideNative: true },
            nativeAudioTracks: false, nativeVideoTracks: false, nativeTextTracks: false,
          },
        });
        playerRef.current = player;
        player.volume(initVolume);
        player.muted(initMuted);
        player.playbackRate(initRate);
        if (videoRef.current) videoRef.current.style.objectFit = initFit;

        if (isLocal) {
          // ── Local file: no headers needed ────────────────────────────────
          player.src({ src: streamUrl, type: 'video/mp4' });
          player.play().catch(e => console.log('Autoplay failed', e));

        } else if (Hls.isSupported() && isHls) {
          // ── HLS stream ───────────────────────────────────────────────────
          //
          // ✅ NO xhrSetup here.  Headers are now injected by the Electron
          //    main process via session.webRequest.onBeforeSendHeaders which
          //    intercepts EVERY request (playlist + all .ts segments) before
          //    Chromium's network stack sends them. That means Referer, Origin,
          //    and User-Agent are always present, even though the browser would
          //    block them if we tried to set them from renderer JS.
          //
          // For non-Electron (plain browser), headers can't be injected this
          // way — but most browser use-cases don't need Referer spoofing since
          // the player is typically served from the same origin as the content.
          // If you need browser support too, consider a local proxy approach.

          let hlsSrc = streamUrl;

          // ── STEP 2 (Electron edge-case): proxy-fetch the initial playlist ─
          // If the CDN checks Referer on the very first request, the browser
          // still sends it WITHOUT Referer (the webRequest handler patches it
          // in the main process, but there can be a brief race on the very
          // first request before the listener is registered). Using proxyFetch
          // eliminates that race by having Node.js do the initial fetch.
          if (isElectron() && window.electronAPI?.proxyFetch) {
            try {
              console.log('[Player] Proxy-fetching initial playlist via Node…');
              const { ok, text } = await safeFetchM3u8(streamUrl, selectedStream?.headers || {});
              if (ok && text) {
                const blob = new Blob([text], { type: 'application/vnd.apple.mpegurl' });
                hlsSrc     = URL.createObjectURL(blob);
                // Remember blob URL so we can revoke it on cleanup
                subtitleUrlsRef.current.push(hlsSrc);
                console.log('[Player] Using proxy-fetched playlist blob:', hlsSrc);
              }
            } catch (proxyErr) {
              // Non-fatal: fall back to the original URL (webRequest handler
              // should cover subsequent requests anyway)
              console.warn('[Player] Proxy fetch failed, using original URL:', proxyErr.message);
              hlsSrc = streamUrl;
            }
          }

          const hls = new Hls({
            // ── hls.js config (header injection removed — handled by main process) ──
            enableWorker:     true,
            lowLatencyMode:   false,
            backBufferLength: 30,
            // Progressive loading — start playing before the full playlist is parsed
            progressive: true,
            // Retry settings
            manifestLoadingMaxRetry:  3,
            levelLoadingMaxRetry:     3,
            fragLoadingMaxRetry:      3,
          });

          hls.loadSource(hlsSrc);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!isMounted) return;
            player.play().catch(e => console.log('Autoplay failed', e));
            setTimeout(refreshAudioTracks, 500);
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (!isMounted) return;
            console.error('[Player] hls.js error:', data);
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                console.warn('[Player] Fatal network error — attempting recovery…');
                hls.startLoad();
              } else {
                setPlayerError(true);
              }
            }
          });

          hlsRef.current = hls;

        } else {
          // ── Direct MP4 / non-HLS stream ──────────────────────────────────
          player.src({ src: streamUrl, type: 'video/mp4' });
          player.play().catch(e => console.log('Autoplay failed', e));
        }

        // ── Player event handlers (unchanged from original) ─────────────────
        player.on('play', () => { if (isMounted) setIsPlaying(true); });
        player.on('pause', () => { if (isMounted) setIsPlaying(false); });
        player.on('volumechange', () => {
          if (!isMounted) return;
          const nm = player.muted(), nv = player.volume();
          setIsMuted(nm); setVolume(nv); storeSetVolume(nv); storeSetMuted(nm);
        });
        player.on('durationchange', () => {
          if (!isMounted) return;
          const d = player.duration();
          if (!d || isNaN(d)) return;
          setDuration(d);
          playMedia({
            title: displayTitle, episodeTitle,
            link:  streamUrl,
            poster: activeEpisode?.poster || routeParams?.poster || null,
            duration: d,
          });
        });
        player.on('loadedmetadata', () => {
          if (!isMounted) return;
          if (initElapsed > 5) player.currentTime(initElapsed);
          refreshAudioTracks();
          refreshSubtitleTracks();
        });
        player.on('timeupdate', () => {
          if (!isMounted) return;
          const t = player.currentTime();
          setCurrentTime(t);
          if (!progressSaveTimerRef.current) {
            progressSaveTimerRef.current = setTimeout(() => {
              updatePlaybackProgress(t);
              progressSaveTimerRef.current = null;
            }, 5000);
          }
        });
        player.on('waiting', () => { if (isMounted) setIsBuffering(true); });
        player.on('playing', () => { if (isMounted) setIsBuffering(false); });
        player.on('error', (e) => { console.error('Video.js error', e); if (isMounted) setPlayerError(true); });
        player.on('canplay', refreshAudioTracks);
        player.on('loadeddata', refreshAudioTracks);

        if (storedAudioTrackId !== null) {
          setTimeout(() => changeAudioTrack(storedAudioTrackId), 1000);
        }
      } catch (err) {
        console.error('Player init error:', err);
        if (isMounted) setPlayerError(true);
      }
    };

    initPlayer();

    return () => {
      isMounted = false;
      if (progressSaveTimerRef.current) {
        clearTimeout(progressSaveTimerRef.current);
        progressSaveTimerRef.current = null;
      }
      if (playerRef.current) {
        try {
          const t = playerRef.current.currentTime();
          if (t > 5) updatePlaybackProgress(t);
        } catch (_) {}
        playerRef.current.dispose();
        playerRef.current = null;
      }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      subtitleUrlsRef.current.forEach(url => URL.revokeObjectURL(url));

      // ── STEP 3: Clear the webRequest header override on unmount ───────────
      // This prevents stale Referer/Origin from bleeding into unrelated network
      // requests after the player is gone (e.g. if the user navigates to the
      // browse screen and loads images from a different domain).
      if (isElectron()) {
        window.electronAPI?.clearStreamHeaders?.();
      }
    };
  }, [selectedStream?.link]); // eslint-disable-line

  // ─── Server switching ─────────────────────────────────────────────────────
  const changeServer = (stream) => {
    saveProgressNow();
    setPlayerError(false);
    setSelectedStream(stream);
    storeSetStreamLink(stream.link);
    setShowStreamMenu(false);
    setShowSettings(false);
    setIsRetrying(false);
  };

  const handleRetry = () => {
    if (retryCountRef.current >= 3) { if (onBack) onBack(); return; }
    setIsRetrying(true);
    retryCountRef.current++;
    setPlayerError(false);
    setTimeout(() => {
      if (streamData?.length > 1 && retryCountRef.current <= streamData.length) {
        const ci = streamData.findIndex(s => s.link === selectedStream?.link);
        setSelectedStream(streamData[(ci + 1) % streamData.length]);
      } else {
        setSelectedStream({ ...selectedStream });
      }
      setIsRetrying(false);
    }, 500);
  };

  // ─── Mouse / control visibility ───────────────────────────────────────────
  const handleMouseMove = () => {
    if (isPlayerLocked || playerError) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings && !showSubtitleMenu && !showStreamMenu && !showEpisodes)
        setShowControls(false);
    }, 3000);
  };

  const handleBack = () => {
    saveProgressNow();
    if (playerRef.current) { playerRef.current.dispose(); playerRef.current = null; }
    if (isElectron()) window.electronAPI?.clearStreamHeaders?.();
    if (onBack) onBack();
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight') { playerRef.current?.currentTime((playerRef.current.currentTime() || 0) + 10); }
      else if (e.code === 'ArrowLeft')  { playerRef.current?.currentTime(Math.max(0, (playerRef.current.currentTime() || 0) - 10)); }
      else if (e.code === 'ArrowUp')    { const v = Math.min(1, (playerRef.current?.volume() || 0) + 0.1); playerRef.current?.volume(v); setVolume(v); }
      else if (e.code === 'ArrowDown')  { const v = Math.max(0, (playerRef.current?.volume() || 0) - 0.1); playerRef.current?.volume(v); setVolume(v); }
      else if (e.code === 'KeyM')       { handleMuteToggle(); }
      else if (e.code === 'KeyF')       { containerRef.current?.requestFullscreen(); }
      else if (e.code === 'Escape')     { setShowSettings(false); setShowEpisodes(false); setShowSubtitleMenu(false); setShowStreamMenu(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatTime = (sec) => {
    if (isNaN(sec) || sec === Infinity || sec < 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const progressPercent     = duration > 0 ? (currentTime / duration) * 100 : 0;
  const getCurrentAudioName = () => audioTracks.find(t => t.id === currentAudioTrackId)?.label ?? null;
  const showNextEpisodeBtn  = !!nextEpisode && progressPercent >= 60;
  const showLoading         = isLoading || isRetrying;
  const showError           = (error || playerError) && !showLoading;
  const hasEpisodeContent   = !isLocalFile && (
    (propsEpisodeList && propsEpisodeList.length > 0) ||
    episodesFetching ||
    episodes.length > 0
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh', backgroundColor: '#000', position: 'fixed', top: 0, left: 0, zIndex: 9999, fontFamily: 'system-ui' }}
      onMouseMove={handleMouseMove}
    >
      {/* VIDEO */}
      <div data-vjs-player style={{ width: '100%', height: '100%' }}>
        <video ref={videoRef} className="video-js" style={{ width: '100%', height: '100%', objectFit: videoFit }} />
      </div>

      {/* LOADING */}
      {showLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <Loader2 size={64} color={primary} style={{ animation: 'spin 1s linear infinite', marginBottom: 24 }} />
          <p style={{ color: '#fff', fontSize: 18 }}>{isRetrying ? 'Switching stream…' : 'Loading…'}</p>
        </div>
      )}

      {/* BUFFERING */}
      {isBuffering && !showLoading && !showError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Loader2 size={48} color={primary} style={{ animation: 'spin 1s linear infinite', opacity: 0.8 }} />
        </div>
      )}

      {/* ERROR */}
      {showError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)', gap: 16 }}>
          <AlertCircle size={64} color={primary} />
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Playback Error</p>
          <p style={{ color: '#aaa', fontSize: 14 }}>{error?.message || 'Could not load the video.'}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleRetry} style={{ padding: '12px 24px', backgroundColor: primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {retryCountRef.current >= 3 ? 'Give Up' : 'Retry'}
            </button>
            <button onClick={handleBack} style={{ padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Go Back
            </button>
          </div>
          {!isLocalFile && streamData?.length > 1 && (
            <button onClick={() => setShowStreamMenu(true)} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: primary, border: `1px solid ${primary}`, borderRadius: '8px', cursor: 'pointer' }}>
              Try different server / quality
            </button>
          )}
        </div>
      )}

      {/* CONTROLS OVERLAY */}
      {!showLoading && !showError && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.8) 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 30px',
          opacity: showControls || !isPlaying || showSettings || showSubtitleMenu || showStreamMenu || showEpisodes ? 1 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: showControls || !isPlaying || showSettings || showSubtitleMenu || showStreamMenu || showEpisodes ? 'auto' : 'none',
        }}>

          {/* TOP BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', display: 'flex' }}>
                <ChevronLeft size={28} color="#fff" />
              </button>
              <div>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{displayTitle}</div>
                {episodeTitle && <div style={{ color: '#ccc', fontSize: '14px' }}>{episodeTitle}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={cycleVideoFit} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Monitor size={16} />
                <span>Fit: {videoFit === 'contain' ? 'Auto' : videoFit === 'cover' ? 'Cover' : 'Fill'}</span>
              </button>
              {hasEpisodeContent && (
                <button
                  onClick={() => setShowEpisodes(!showEpisodes)}
                  style={{
                    background: showEpisodes ? primary : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${showEpisodes ? primary : 'transparent'}`,
                    borderRadius: '8px', padding: '8px 12px',
                    cursor: 'pointer', color: '#fff', fontSize: '12px',
                    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                  }}
                >
                  <List size={16} />
                  <span>Episodes{episodes.length > 0 ? ` (${episodes.length})` : ''}</span>
                  {episodesFetching && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
                </button>
              )}
            </div>
          </div>

          {/* NEXT EPISODE BUTTON */}
          {showNextEpisodeBtn && (
            <div style={{ position: 'absolute', bottom: '120px', right: showEpisodes ? '320px' : '30px', zIndex: 150, transition: 'right 0.3s' }}>
              <button
                onClick={() => handleEpisodeSelect(nextEpisode, currentEpIndex + 1)}
                style={{
                  background: primary, border: 'none', borderRadius: '10px',
                  padding: '12px 20px', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  boxShadow: `0 4px 24px ${primary}55`, fontSize: '14px', fontWeight: 600,
                  animation: 'slideInRight 0.4s ease',
                }}
              >
                <SkipForward size={20} fill="currentColor" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', opacity: 0.8, marginBottom: '2px', letterSpacing: '0.1em' }}>NEXT EPISODE</div>
                  <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getEpisodeLabel(nextEpisode, currentEpIndex + 1)}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* CENTER PLAY */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <button onClick={togglePlay} style={{ background: `${primary}e6`, borderRadius: '50%', padding: '24px', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', boxShadow: `0 4px 20px ${primary}88` }}>
              {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" style={{ marginLeft: 6 }} />}
            </button>
          </div>

          {/* SUBTITLE MENU */}
          {showSubtitleMenu && (
            <div style={{ position: 'absolute', right: '30px', bottom: '90px', width: '380px', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: '12px', overflow: 'hidden', color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 100 }}>
              <div style={{ padding: '12px', borderBottom: '1px solid #333', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Subtitles</span>
                <button onClick={() => setShowSubtitleMenu(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a' }}>
                <button onClick={() => setShowSearchPanel(false)} style={{ flex: 1, padding: '8px', background: !showSearchPanel ? primary : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Upload size={14} /> Upload
                </button>
                <button onClick={() => setShowSearchPanel(true)} style={{ flex: 1, padding: '8px', background: showSearchPanel ? primary : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Search size={14} /> Search Online
                </button>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px 0' }}>
                {!showSearchPanel ? (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}>
                      <Upload size={16} /> Upload .srt/.vtt
                      <input type="file" accept=".srt,.vtt" onChange={e => e.target.files?.[0] && addSubtitleFromFile(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #2a2a2a' }}>
                      <button onClick={() => setActiveSubtitle('off')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', flex: 1 }}>
                        Off {(currentSubtitleTrackId === 'off' || !currentSubtitleTrackId) && <Check size={14} color={primary} style={{ display: 'inline', marginLeft: 8 }} />}
                      </button>
                    </div>
                    {subtitleTracks.map(track => (
                      <div key={track.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #2a2a2a' }}>
                        <button onClick={() => setActiveSubtitle(track.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', flex: 1 }}>
                          {track.label} {currentSubtitleTrackId === track.id && <Check size={14} color={primary} style={{ display: 'inline', marginLeft: 8 }} />}
                        </button>
                        <button onClick={() => removeSubtitleTrack(track.id)} style={{ background: 'none', border: 'none', color: primary, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                    {subtitleTracks.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>No subtitles available</div>}
                  </>
                ) : (
                  <div style={{ padding: '12px' }}>
                    <input type="text" placeholder="Movie / TV Show name or IMDb ID" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: '#333', border: 'none', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <select value={searchLang} onChange={e => setSearchLang(e.target.value)} style={{ flex: 1, padding: '8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
                        {subLanguages.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
                      </select>
                      <input type="number" placeholder="Season" value={searchSeason} onChange={e => setSearchSeason(e.target.value)} style={{ width: '70px', padding: '8px', background: '#333', border: 'none', color: '#fff', borderRadius: '4px' }} />
                      <input type="number" placeholder="Episode" value={searchEpisode} onChange={e => setSearchEpisode(e.target.value)} style={{ width: '70px', padding: '8px', background: '#333', border: 'none', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <button onClick={searchSubtitles} disabled={searchLoading} style={{ width: '100%', padding: '8px', background: primary, border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', marginBottom: '12px' }}>
                      {searchLoading ? 'Searching…' : 'Search'}
                    </button>
                    {searchError && <div style={{ color: '#ff9999', fontSize: '12px', marginBottom: '8px' }}>{searchError}</div>}
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {searchResults.map((res, idx) => (
                        <div key={idx} onClick={() => addSubtitleFromUrl(res)} style={{ padding: '8px', borderBottom: '1px solid #2a2a2a', cursor: 'pointer' }}>
                          <div style={{ fontWeight: 'bold' }}>{res.SubLanguageID} - {res.MovieName?.slice(0, 40)}</div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>{res.SeriesSeason ? `S${res.SeriesSeason}E${res.SeriesEpisode}` : ''} {res.UserNickName}</div>
                        </div>
                      ))}
                      {!searchResults.length && !searchLoading && !searchError && (
                        <div style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>Enter a title and click Search</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS MENU */}
          {showSettings && (
            <div style={{ position: 'absolute', right: '30px', bottom: '90px', width: '340px', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: '12px', overflow: 'hidden', color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 100 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
                <button onClick={() => { setActiveTab('audio'); refreshAudioTracks(); }} style={{ flex: 1, padding: '12px', background: activeTab === 'audio' ? primary : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Music size={16} /> Audio {refreshingAudio && <Loader2 size={12} style={{ animation: 'spin 0.5s linear infinite' }} />}
                </button>
                <button onClick={() => setActiveTab('speed')} style={{ flex: 1, padding: '12px', background: activeTab === 'speed' ? primary : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Speed</button>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '10px 0' }}>
                {activeTab === 'audio' && (
                  audioTracks.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
                      No multiple audio tracks detected.
                      <button onClick={() => { refreshAudioTracks(); setRefreshingAudio(true); setTimeout(() => setRefreshingAudio(false), 500); }} style={{ display: 'block', margin: '12px auto 0', background: primary, border: 'none', padding: '8px 16px', borderRadius: '20px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                        <RefreshCw size={14} style={{ display: 'inline', marginRight: '6px' }} /> Refresh
                      </button>
                    </div>
                  ) : (
                    audioTracks.map(track => (
                      <button key={track.id} onClick={() => changeAudioTrack(track.id)} style={{ width: '100%', padding: '12px 20px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{track.label}</span>
                        {currentAudioTrackId === track.id && <Check size={18} color={primary} />}
                      </button>
                    ))
                  )
                )}
                {activeTab === 'speed' && playbackSpeeds.map(speed => (
                  <button key={speed} onClick={() => changePlaybackSpeed(speed)} style={{ width: '100%', padding: '12px 20px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{speed}x</span>
                    {playbackRate === speed && <Check size={18} color={primary} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STREAM MENU */}
          {!isLocalFile && showStreamMenu && streamData?.length > 0 && (
            <div style={{ position: 'absolute', right: '30px', bottom: '90px', width: '340px', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: '12px', overflow: 'hidden', color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 100 }}>
              <div style={{ padding: '12px', borderBottom: '1px solid #333', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📡 Server & Quality</span>
                <button onClick={() => setShowStreamMenu(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '8px 0' }}>
                {streamData.map((stream, idx) => {
                  const quality    = getStreamQuality(stream);
                  const format     = getStreamFormat(stream);
                  const isSelected = selectedStream?.link === stream.link;
                  return (
                    <button key={idx} onClick={() => changeServer(stream)} style={{ width: '100%', padding: '12px 20px', background: isSelected ? `${primary}33` : 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < streamData.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{stream.server || 'Server'}</span>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>{quality !== 'Auto' ? quality : (format || 'Unknown')}{format && quality !== 'Auto' ? ` • ${format}` : ''}</span>
                      </div>
                      {isSelected && <Check size={18} color={primary} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BOTTOM BAR */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ color: '#fff', fontSize: '14px', minWidth: '50px', fontFamily: 'monospace' }}>{formatTime(currentTime)}</span>
              <div style={{ flex: 1, margin: '0 15px', height: '6px', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '3px', position: 'relative', cursor: 'pointer' }} onClick={handleSeek}>
                <div style={{ height: '100%', backgroundColor: primary, borderRadius: '3px', width: `${progressPercent}%` }} />
                <div style={{ width: '16px', height: '16px', backgroundColor: primary, borderRadius: '50%', position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: `${progressPercent}%` }} />
              </div>
              <span style={{ color: '#fff', fontSize: '14px', minWidth: '50px', fontFamily: 'monospace' }}>{formatTime(duration)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <button onClick={handleMuteToggle} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={handleVolumeChange} style={{ width: '80px', height: '4px', WebkitAppearance: 'none', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', cursor: 'pointer', accentColor: primary }} />
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {!isLocalFile && (
                  <button onClick={() => setShowStreamMenu(!showStreamMenu)} style={{ background: 'none', border: 'none', color: showStreamMenu ? primary : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                    <Server size={20} /> <span>{getStreamQuality(selectedStream) || 'Quality'}</span>
                  </button>
                )}
                <button onClick={() => { setShowSettings(!showSettings); setActiveTab('speed'); }} style={{ background: 'none', border: 'none', color: (showSettings && activeTab === 'speed') ? primary : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                  <Gauge size={20} /> <span>{playbackRate}x</span>
                </button>
                <button onClick={() => setShowSubtitleMenu(!showSubtitleMenu)} style={{ background: 'none', border: 'none', color: showSubtitleMenu ? primary : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Subtitles size={20} /> <span style={{ fontSize: '12px' }}>Sub</span>
                </button>
                {audioTracks.length > 1 && (
                  <button onClick={() => { setShowSettings(!showSettings); setActiveTab('audio'); refreshAudioTracks(); setRefreshingAudio(true); setTimeout(() => setRefreshingAudio(false), 500); }} style={{ background: 'none', border: 'none', color: (showSettings && activeTab === 'audio') ? primary : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                    <Music size={20} /> <span>{getCurrentAudioName() || 'Audio'}</span>
                  </button>
                )}
                <button onClick={cycleVideoFit} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Monitor size={22} /> <span style={{ fontSize: '12px' }}>Fit</span>
                </button>
                <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: showSettings ? primary : '#fff', cursor: 'pointer' }}>
                  <Settings size={24} />
                </button>
                <button onClick={() => videoRef.current?.requestPictureInPicture()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <PictureInPicture size={24} />
                </button>
                <button onClick={() => containerRef.current?.requestFullscreen()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <Maximize size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EPISODES SIDE PANEL */}
      {showEpisodes && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '300px', height: '100%',
          backgroundColor: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column',
          zIndex: 200,
          borderLeft: `1px solid ${primary}44`,
          boxShadow: `-8px 0 32px rgba(0,0,0,0.6)`,
          animation: 'slideInFromRight 0.25s ease',
        }}>
          <div style={{
            padding: '18px 16px', borderBottom: 'rgba(255,255,255,0.08) 1px solid',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: `linear-gradient(135deg, ${primary}22 0%, transparent 100%)`,
          }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>Episodes</div>
              {episodes.length > 0 && (
                <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>
                  {`Episode ${currentEpIndex + 1} of ${episodes.length}`}
                </div>
              )}
            </div>
            <button onClick={() => setShowEpisodes(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
              ✕
            </button>
          </div>

          {episodesFetching ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Loader2 size={32} color={primary} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#888', fontSize: '13px' }}>Loading episodes…</span>
            </div>
          ) : episodes.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '14px' }}>
              No episodes found
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {episodes.map((ep, idx) => {
                const isCurrentEp = idx === currentEpIndex;
                const epNum       = ep.number || ep.episode || idx + 1;
                const epLabel     = ep.title || ep.name || `Episode ${epNum}`;
                return (
                  <button
                    key={ep.link || idx}
                    onClick={() => handleEpisodeSelect(ep, idx)}
                    disabled={isCurrentEp}
                    style={{
                      width: '100%', padding: '14px 16px',
                      background: isCurrentEp ? `linear-gradient(90deg, ${primary}22 0%, transparent 100%)` : 'transparent',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      color: '#fff', textAlign: 'left',
                      cursor: isCurrentEp ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isCurrentEp) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if (!isCurrentEp) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ minWidth: '32px', height: '32px', borderRadius: '50%', background: isCurrentEp ? primary : 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                      {isCurrentEp ? <Play size={14} fill="currentColor" /> : epNum}
                    </span>
                    <span style={{ fontSize: '13px', lineHeight: 1.4, color: isCurrentEp ? '#fff' : '#bbb', fontWeight: isCurrentEp ? 600 : 400, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {epLabel}
                    </span>
                    {isCurrentEp && (
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 'bold', color: primary, letterSpacing: '0.08em', flexShrink: 0, border: `1px solid ${primary}`, borderRadius: '4px', padding: '2px 5px' }}>
                        NOW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideInFromRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        div::-webkit-scrollbar { width: 6px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${primary}; cursor: pointer; }
        .video-js .vjs-text-track-display { font-size: 1.5em !important; pointer-events: none !important; bottom: 12% !important; }
        .video-js .vjs-text-track-cue { background-color: rgba(0,0,0,0.8) !important; color: white !important; border-radius: 6px !important; padding: 0.2em 0.5em !important; }
      `}</style>
    </div>
  );
};

export default Player;