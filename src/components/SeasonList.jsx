import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Play, MonitorPlay, Loader2, CheckCircle2, ChevronDown, ExternalLink, Download, Trash2 } from 'lucide-react';
import { cacheStorage, settingsStorage } from '../lib/storage';
import { providerManager } from '../lib/services/ProviderManager';
import { useEpisodes } from '../lib/hooks/useEpisodes';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchHistoryStore from '../lib/zustand/watchHistoryStore';
import useDownloadedStore from '../lib/zustand/downloadedStore';
import DownloadBottomSheet from './DownloadBottomSheet';
import { getLocalFilePath, ifExists } from '../lib/file/ifExists';
import { cancelDownload } from '../lib/downloader';

const { ipcRenderer } = window.require
  ? window.require('electron')
  : { send: () => {}, invoke: async () => [] };

/* ─── Skeleton ──────────────────────────────────────────────────────── */
const Sk = ({ h = 56 }) => (
  <div className="season-sk" style={{ height: `${h}px` }} />
);

const getEpisodeLink = (ep) => {
  if (!ep) return null;
  return ep.link || ep.url || ep.href || ep.file || ep.path || (ep.source && ep.source.url) || null;
};

const getEpisodeTitle = (ep, idx) => {
  if (!ep) return `Episode ${idx + 1}`;
  return ep.title || ep.name || ep.label || `Episode ${idx + 1}`;
};

/* ─── Circular Download Button (matches Image 1) ────────────────────── */
/**
 * Shows a dashed ring when idle, and a solid sweeping arc when downloading.
 * Long-press (600 ms) or right-click calls onLongPress.
 */
const CircularDlBtn = ({ progress = 0, isDownloading = false, primaryColor = '#FF6B53', onPress, onLongPress }) => {
  const timerRef = useRef(null);
  const SIZE = 40;
  const R = 13;
  const C = 2 * Math.PI * R;
  const offset = isDownloading ? C - (progress / 100) * C : 0;

  const startLong = (e) => {
    e.preventDefault();
    timerRef.current = setTimeout(() => onLongPress?.(), 600);
  };
  
  const clearLong = () => clearTimeout(timerRef.current);

  return (
    <button
      onClick={onPress}
      onMouseDown={startLong}
      onMouseUp={clearLong}
      onMouseLeave={clearLong}
      onTouchStart={startLong}
      onTouchEnd={clearLong}
      onContextMenu={(e) => { e.preventDefault(); onLongPress?.(); }}
      title={isDownloading ? `${Math.round(progress)}% – Long press to cancel` : 'Download'}
      style={{
        width: SIZE, 
        height: SIZE, 
        borderRadius: 10,
        background: isDownloading ? `${primaryColor}18` : 'rgba(255,255,255,0.07)',
        border: 'none', 
        cursor: 'pointer',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative', 
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      {/* Only render the SVG circles when downloading */}
      {isDownloading && (
        <svg
          width={SIZE} height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Background track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2.5"
          />
          {/* Animated progress arc */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2.5"
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 0.35s ease' }}
          />
        </svg>
      )}
      
      {/* Centre icon */}
      <Download
        size={isDownloading ? 12 : 20}
        color={primaryColor}
        strokeWidth={2.5}
        style={{ position: 'relative', zIndex: 1 }}
      />
    </button>
  );
};

/* ─── Cancel Popup ──────────────────────────────────────────────────── */
const CancelPopup = ({ primaryColor, title, onCancel, onDismiss }) => (
  <div
    onClick={onDismiss}
    style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#1c1c1e', borderRadius: 20, padding: '28px 20px',
        width: '100%', maxWidth: 300,
        boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `${primaryColor}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Download size={24} color={primaryColor} />
      </div>

      <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
        Cancel Download?
      </p>
      <p style={{ color: '#9ca3af', fontSize: 13, margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
        "{title}" will be stopped and removed.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={onDismiss}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.09)', border: 'none',
            color: '#e5e7eb', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Continue
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: '#ef4444', border: 'none',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

/* ─── SeasonList ─────────────────────────────────────────────────────── */
const SeasonList = ({
  LinkList = [],
  poster,
  type,
  metaTitle,
  providerValue,
  routeParams,
  onNavigate,
  primaryColor: propPrimary,
}) => {
  const { primary } = useThemeStore();
  const primaryColor = propPrimary || primary || '#e8522a';

  const watchHistory = useWatchHistoryStore((state) => state);
  const addItem = watchHistory?.addItem || (() => {});
  const { isDownloaded, markAsDownloaded, markAsDeleted } = useDownloadedStore();

  /* ── Per-episode download tracking ─────────────────────────────────── */
  // Shape: { [fileName]: { progress: 0-100, jobId: string|null, status: 'idle'|'downloading'|'completed'|'error' } }
  const [downloadMap, setDownloadMap] = useState({});
  // Long-press cancel popup: { fileName, jobId, title } | null
  const [cancelPopup, setCancelPopup] = useState(null);

  const updateDownload = useCallback((fileName, patch) => {
    setDownloadMap((prev) => ({
      ...prev,
      [fileName]: {
        ...(prev[fileName] ?? { progress: 0, jobId: null, status: 'idle' }),
        ...patch,
      },
    }));
  }, []);

  /* ── Season / episodes state ──────────────────────────────────────── */
  const [activeSeasonIndex, setActiveSeasonIndex] = useState(() => {
    try {
      const cached = cacheStorage.getString(`ActiveSeason${metaTitle + providerValue}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const idx = LinkList?.findIndex((l) => l.title === parsed.title);
        if (idx !== -1 && idx !== undefined) return idx;
      }
    } catch (_) {}
    return 0;
  });

  const activeSeason = LinkList?.[activeSeasonIndex] || LinkList?.[0] || {};
  const hasEpisodesLink = !!activeSeason?.episodesLink;
  const effectiveEpisodesLink = hasEpisodesLink
    ? activeSeason.episodesLink
    : routeParams?.link || null;
  const shouldFetch =
    hasEpisodesLink || (routeParams?.link && !activeSeason.directLinks?.length);

  const { data: fetchedEpisodes = [], isFetching: episodeFetching } = useEpisodes(
    effectiveEpisodesLink, providerValue, shouldFetch
  );

  const [dropOpen, setDropOpen] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [externalPlayerStreams, setExternalPlayerStreams] = useState([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [externalPlayers, setExternalPlayers] = useState([]);
  const [selectedStreamUrl, setSelectedStreamUrl] = useState(null);

  const [showDownloadSheet, setShowDownloadSheet] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  /* ── Load external players ──────────────────────────────────────────── */
  useEffect(() => {
    const loadPlayers = async () => {
      if (ipcRenderer.invoke) {
        const players = await ipcRenderer.invoke('get-external-players');
        setExternalPlayers(players);
      }
    };
    loadPlayers();
  }, []);

  /* ── Episode list derivation ──────────────────────────────────────── */
  const episodeList = useMemo(() => {
    if (shouldFetch && fetchedEpisodes?.length > 0) return fetchedEpisodes;
    if (Array.isArray(activeSeason?.directLinks) && activeSeason.directLinks.length > 0)
      return activeSeason.directLinks;
    if (Array.isArray(activeSeason?.episodes) && activeSeason.episodes.length > 0)
      return activeSeason.episodes;
    if (activeSeason?.link || activeSeason?.url || activeSeason?.href) return [activeSeason];
    if (effectiveEpisodesLink && !episodeFetching && fetchedEpisodes?.length === 0) {
      console.warn(`[SeasonList] Falling back to single episode link: ${effectiveEpisodesLink}`);
      return [{ title: 'Play', link: effectiveEpisodesLink }];
    }
    return [];
  }, [shouldFetch, fetchedEpisodes, activeSeason, episodeFetching, effectiveEpisodesLink]);

  const episodes = useMemo(() => {
    if (!Array.isArray(episodeList)) return [];
    return episodeList.filter((ep) => getEpisodeLink(ep) !== null);
  }, [episodeList]);

  /* ── Check already-downloaded on mount ─────────────────────────────── */
  useEffect(() => {
    const checkDownloads = async () => {
      for (const ep of episodes) {
        const episodeTitle = getEpisodeTitle(ep, 0);
        const fileName = (metaTitle + (activeSeason?.title || '') + episodeTitle).replace(
          /[^a-zA-Z0-9]/g, '_'
        );
        const exists = await ifExists(fileName);
        if (exists) markAsDownloaded(fileName);
      }
    };
    checkDownloads();
  }, [episodes, metaTitle, activeSeason, markAsDownloaded]);

  /* ── Watched-completion check ───────────────────────────────────────── */
  const isCompleted = useCallback((epLink) => {
    if (!epLink) return false;
    try {
      const p = JSON.parse(cacheStorage.getString(epLink) || '{}');
      if (p?.duration && p?.position) return (p.position / p.duration) * 100 > 85;
    } catch (_) {}
    return false;
  }, []);

  /* ── Season change ──────────────────────────────────────────────────── */
  const handleSeasonChange = (idx) => {
    setActiveSeasonIndex(idx);
    setDropOpen(false);
    if (LinkList[idx]) {
      try {
        cacheStorage.setString(
          `ActiveSeason${metaTitle + providerValue}`,
          JSON.stringify(LinkList[idx])
        );
      } catch (_) {}
    }
  };

  /* ── External player flow ───────────────────────────────────────────── */
  const handleExternalPlayer = async (epLink, streamType) => {
    setIsLoadingStreams(true);
    try {
      const streams = await providerManager.getStream({ link: epLink, type: streamType, providerValue });
      if (!streams || streams.length === 0) return alert('No stream available.');
      setExternalPlayerStreams([...streams]);
      setShowServerModal(true);
    } catch (err) {
      console.error('Stream fetch error:', err);
      alert('Failed to extract streams.');
    } finally {
      setIsLoadingStreams(false);
    }
  };

  const launchWithPlayer = (player, streamUrl) => {
    setShowServerModal(false);
    if (ipcRenderer.send) {
      ipcRenderer.send('launch-player', player, streamUrl);
    } else {
      navigator.clipboard.writeText(streamUrl);
      alert(`Could not launch ${player.name}. URL copied to clipboard.`);
    }
  };

  const handleStreamSelect = (stream) => setSelectedStreamUrl(stream.link);

  /* ── Play handler ───────────────────────────────────────────────────── */
  const playHandler = async ({
    linkIndex, playType, primaryTitle, secondaryTitle, seasonTitle, episodeData,
  }) => {
    const episodeObj = episodeData[linkIndex];
    const episodeLink = getEpisodeLink(episodeObj);
    if (!episodeLink) {
      console.error('No playable link found for episode', episodeObj);
      alert('Cannot play: no valid link.');
      return;
    }

    const fileName = (primaryTitle + seasonTitle + secondaryTitle).replace(/[^a-zA-Z0-9]/g, '_');
    const localPath = await getLocalFilePath(fileName);
    const isLocal = localPath !== null;

    if (isLocal) {
      if (onNavigate) {
        onNavigate('player', {
          link: localPath, isLocal: true, provider: providerValue, type: playType,
          title: secondaryTitle, metaTitle: primaryTitle,
          poster: poster?.poster || routeParams?.poster,
          seriesLink: routeParams?.link || routeParams?.url,
          seriesTitle: primaryTitle, seriesProvider: providerValue,
          seriesPoster: poster?.poster || routeParams?.poster,
        });
      }
      return;
    }

    const safeInfoUrl = routeParams?.link || routeParams?.url || '';
    addItem({
      id: safeInfoUrl, link: safeInfoUrl, title: primaryTitle,
      poster: poster?.poster || poster?.background,
      provider: providerValue, lastPlayed: Date.now(),
      episodeTitle: secondaryTitle, playbackRate: 1, currentTime: 0, duration: 1,
    });

    let externalPlayer = false;
    try { externalPlayer = settingsStorage.getBool('useExternalPlayer'); } catch (_) {}

    if (externalPlayer) { handleExternalPlayer(episodeLink, playType); return; }

    if (onNavigate) {
      onNavigate('player', {
        link: episodeLink, provider: providerValue, type: playType,
        title: secondaryTitle, metaTitle: primaryTitle,
        poster: poster?.poster || routeParams?.poster,
        seriesLink: routeParams?.link || routeParams?.url,
        seriesTitle: primaryTitle, seriesProvider: providerValue,
        seriesPoster: poster?.poster || routeParams?.poster,
      });
    }
  };

  /* ── Delete downloaded file ─────────────────────────────────────────── */
  const handleDeleteDownload = async (fileName) => {
    const filePath = await getLocalFilePath(fileName);
    if (filePath && ipcRenderer.invoke) {
      await ipcRenderer.invoke('delete-file', filePath);
      markAsDeleted(fileName);
    }
  };

  /* ── Download progress callbacks (called by DownloadBottomSheet) ─────── */
  const handleDownloadProgress = useCallback(
    (fileName, progress, jobId) => {
      updateDownload(fileName, { progress, jobId, status: 'downloading' });
    },
    [updateDownload]
  );

  const handleDownloadComplete = useCallback(
    (fileName) => {
      updateDownload(fileName, { progress: 100, status: 'completed', jobId: null });
      markAsDownloaded(fileName);
    },
    [updateDownload, markAsDownloaded]
  );

  const handleDownloadError = useCallback(
    (fileName) => {
      updateDownload(fileName, { status: 'error', progress: 0, jobId: null });
    },
    [updateDownload]
  );

  /* ── Cancel download ────────────────────────────────────────────────── */
  const handleCancelDownload = async (fileName, jobId) => {
  setCancelPopup(null);
  if (jobId) {
    try { 
      await ipcRenderer.invoke('download:cancel', jobId);
    } catch (_) {}
  }
  updateDownload(fileName, { progress: 0, jobId: null, status: 'idle' });
};

  /* ── Episode-button long-press refs ─────────────────────────────────── */
  const epLongTimers = useRef({});
  const startEpLong = (fileName, jobId, title) => {
    epLongTimers.current[fileName] = setTimeout(
      () => setCancelPopup({ fileName, jobId, title }),
      600
    );
  };
  const clearEpLong = (fileName) => clearTimeout(epLongTimers.current[fileName]);

  /* ── Early exit ─────────────────────────────────────────────────────── */
  if (!LinkList || LinkList.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
        No streams available.
      </div>
    );
  }

  const isMovie = type === 'movie' || type === 'Movie';

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: '#000', minHeight: '100%' }}>
      <style>{`
        @keyframes skp  { 0%,100%{opacity:.3} 50%{opacity:.65} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
        .season-sk { border-radius:12px; background:rgba(255,255,255,0.06); animation:skp 1.4s ease-in-out infinite; }
        .ep-btn { transition:opacity 0.15s; border-radius:12px; }
        .ep-btn:active { opacity:0.8; }
        .stream-link,.player-link { background:rgba(255,255,255,0.04); transition:background 0.15s; cursor:pointer; }
        .stream-link:hover,.player-link:hover { background:rgba(255,255,255,0.08); }
      `}</style>

      {/* ── Season Dropdown ──────────────────────────────────────────── */}
      <div style={{ padding: '14px 14px 10px', position: 'relative' }}>
        {LinkList.length > 1 ? (
          <>
            <button
              onClick={() => setDropOpen(!dropOpen)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderRadius: '12px', cursor: 'pointer',
                background: 'transparent', border: `1.5px solid rgba(255,255,255,0.18)`,
                color: primaryColor, fontSize: '15px', fontWeight: 700,
              }}
            >
              <span>{activeSeason?.title || `Season ${activeSeasonIndex + 1}`}</span>
              <ChevronDown
                size={18} color={primaryColor}
                style={{ transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </button>
            {dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% - 4px)', left: '14px', right: '14px',
                background: '#161616', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px', overflow: 'hidden', zIndex: 100,
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}>
                {LinkList.map((season, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSeasonChange(idx)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: idx === activeSeasonIndex ? 700 : 500,
                      color: idx === activeSeasonIndex ? primaryColor : '#d1d5db',
                      background: idx === activeSeasonIndex ? primaryColor + '12' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      borderBottom: idx < LinkList.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    {season.title || `Season ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: '14px 18px', borderRadius: '12px',
            border: '1.5px solid rgba(255,255,255,0.18)',
            color: primaryColor, fontSize: '15px', fontWeight: 700,
          }}>
            {isMovie ? 'Movie' : (activeSeason?.title || 'Episodes')}
          </div>
        )}
      </div>

      {/* ── Episode List ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 14px 20px', gap: '10px' }}>
        {episodeFetching && shouldFetch && episodes.length === 0 ? (
          [1, 2, 3, 4].map((i) => <Sk key={i} h={56} />)
        ) : episodes.length > 0 ? (
          episodes.map((item, index) => {
            const episodeLink = getEpisodeLink(item);
            const completed = episodeLink ? isCompleted(episodeLink) : false;
            const isSingleLink = episodes.length === 1 && LinkList.length <= 1;
            const displayTitle = isMovie || isSingleLink ? 'Play' : getEpisodeTitle(item, index);

            const episodeFileName = (metaTitle + (activeSeason?.title || '') + displayTitle)
              .replace(/[^a-zA-Z0-9]/g, '_');
            const downloaded = isDownloaded(episodeFileName);

            // Per-episode download state
            const dl = downloadMap[episodeFileName] ?? { progress: 0, jobId: null, status: 'idle' };
            const isDownloading = dl.status === 'downloading';
            const dlProgress = dl.progress || 0;

            // SVG values for the play-button progress ring
            const R_play = 11;
            const C_play = 2 * Math.PI * R_play;
            const playOffset = C_play - (dlProgress / 100) * C_play;

            return (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: completed ? 0.5 : 1 }}
              >
                {/* ── Episode play button ─────────────────────────────── */}
                <button
                  className="ep-btn"
                  onClick={() => {
                    if (isDownloading) return; // block play while downloading
                    playHandler({
                      linkIndex: index, playType: type, primaryTitle: metaTitle,
                      secondaryTitle: displayTitle, seasonTitle: activeSeason?.title || '',
                      episodeData: episodes,
                    });
                  }}
                  /* Long-press while downloading shows cancel popup */
                  onMouseDown={() => isDownloading && startEpLong(episodeFileName, dl.jobId, displayTitle)}
                  onMouseUp={() => clearEpLong(episodeFileName)}
                  onMouseLeave={() => clearEpLong(episodeFileName)}
                  onTouchStart={() => isDownloading && startEpLong(episodeFileName, dl.jobId, displayTitle)}
                  onTouchEnd={() => clearEpLong(episodeFileName)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (isDownloading) setCancelPopup({ fileName: episodeFileName, jobId: dl.jobId, title: displayTitle });
                  }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 16px', cursor: isDownloading ? 'default' : 'pointer',
                    textAlign: 'left', border: 'none',
                    position: 'relative', overflow: 'hidden', borderRadius: 12,
                    /* Gradient sweep background while downloading */
                    background: isDownloading
                      ? `linear-gradient(to right, ${primaryColor}30 ${dlProgress}%, rgba(255,255,255,0.04) ${dlProgress}%)`
                      : 'rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Shimmer overlay while downloading */}
                  {isDownloading && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: '-50%', width: '35%',
                      background: `linear-gradient(90deg, transparent, ${primaryColor}20, transparent)`,
                      animation: 'shimmer 1.8s ease-in-out infinite',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* ── Left icon: play / circular progress / completed ── */}
                  <div style={{
                    width: 28, height: 28, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {completed ? (
                      <CheckCircle2 size={22} color={primaryColor} />
                    ) : isDownloading ? (
                      /* Circular progress ring with play icon inside */
                      <>
                        <svg width="28" height="28" viewBox="0 0 28 28" style={{ position: 'absolute', inset: 0 }}>
                          {/* Track */}
                          <circle cx="14" cy="14" r={R_play} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                          {/* Progress */}
                          <circle
                            cx="14" cy="14" r={R_play} fill="none"
                            stroke={primaryColor} strokeWidth="2"
                            strokeDasharray={C_play}
                            strokeDashoffset={playOffset}
                            strokeLinecap="round"
                            transform="rotate(-90 14 14)"
                            style={{ transition: 'stroke-dashoffset 0.35s ease' }}
                          />
                        </svg>
                        <Play size={10} color={primaryColor} fill={primaryColor} style={{ position: 'relative', zIndex: 1 }} />
                      </>
                    ) : (
                      <Play size={22} color={primaryColor} fill={primaryColor} />
                    )}
                  </div>

                  {/* ── Title + progress label ── */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: '14px', fontWeight: 500, color: '#e5e7eb',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'block',
                    }}>
                      {displayTitle}
                    </span>
                    {isDownloading && (
                      <span style={{
                        fontSize: '11px', color: primaryColor,
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>
                        Downloading {Math.round(dlProgress)}%
                      </span>
                    )}
                  </div>
                </button>

                {/* ── Download / Delete button ─────────────────────────── */}
                {episodeLink && (
                  <div style={{ flexShrink: 0 }}>
                    {downloaded ? (
                      <button
                        onClick={() => handleDeleteDownload(episodeFileName)}
                        title="Delete downloaded file"
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: 'rgba(255,255,255,0.07)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </button>
                    ) : (
                      <CircularDlBtn
                        progress={dlProgress}
                        isDownloading={isDownloading}
                        primaryColor={primaryColor}
                        onPress={() => {
                          if (isDownloading) return;
                          setSelectedEpisode({ link: episodeLink, title: displayTitle, fileName: episodeFileName });
                          setShowDownloadSheet(true);
                        }}
                        onLongPress={() => {
                          if (isDownloading) {
                            setCancelPopup({ fileName: episodeFileName, jobId: dl.jobId, title: displayTitle });
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            {shouldFetch && !episodeFetching ? 'No episodes found.' : 'No playable content.'}
          </div>
        )}
      </div>

      {/* ── External streams & players modal ─────────────────────────── */}
      {showServerModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '450px',
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>
              Play with External Player
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
              Select a stream server, then choose an external player
            </p>

            {isLoadingStreams ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: '12px' }}>
                <Loader2 size={32} color={primaryColor} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Fetching available streams…</span>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ccc', marginBottom: '8px' }}>
                    📡 Stream Servers
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {externalPlayerStreams.map((stream, idx) => (
                      <div
                        key={idx}
                        className="stream-link"
                        onClick={() => handleStreamSelect(stream)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 16px', borderRadius: '12px',
                          border: selectedStreamUrl === stream.link
                            ? `2px solid ${primaryColor}`
                            : '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>
                          {stream.server || `Server ${idx + 1}`}
                        </span>
                        <MonitorPlay size={18} color={primaryColor} />
                      </div>
                    ))}
                  </div>
                </div>

                {externalPlayers.length > 0 && selectedStreamUrl && (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ccc', marginBottom: '8px' }}>
                      🎬 External Players
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        className="player-link"
                        onClick={() => launchWithPlayer({ name: 'Bundled VLC', path: '', type: 'bundled-vlc' }, selectedStreamUrl)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 16px', borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                        }}
                      >
                        <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '14px' }}>
                          📀 Bundled VLC (built‑in)
                        </span>
                        <ExternalLink size={16} color={primaryColor} />
                      </div>
                      {externalPlayers.map((player, idx) => (
                        <div
                          key={idx}
                          className="player-link"
                          onClick={() => launchWithPlayer(player, selectedStreamUrl)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 16px', borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                          }}
                        >
                          <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '14px' }}>{player.name}</span>
                          <ExternalLink size={16} color={primaryColor} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedStreamUrl === null && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', marginTop: '12px' }}>
                    Please select a stream server first
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShowServerModal(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: '#e5e7eb',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
              Bundled VLC is included – other players are detected from your system.
            </p>
          </div>
        </div>
      )}

      {/* ── Download Bottom Sheet ─────────────────────────────────────── */}
      {selectedEpisode && (
        <DownloadBottomSheet
          isOpen={showDownloadSheet}
          onClose={() => setShowDownloadSheet(false)}
          link={selectedEpisode.link}
          type={type}
          providerValue={providerValue}
          title={`${metaTitle} ${selectedEpisode.title}`}
          fileName={selectedEpisode.fileName}
          externalPlayers={externalPlayers}
          onLaunchExternalPlayer={(player, streamUrl) => {
            setShowDownloadSheet(false);
            launchWithPlayer(player, streamUrl);
          }}
          /* Progress callbacks – wired to SeasonList's download tracking */
          onDownloadProgress={(progress, jobId) =>
            handleDownloadProgress(selectedEpisode.fileName, progress, jobId)
          }
          onDownloadComplete={() => handleDownloadComplete(selectedEpisode.fileName)}
          onDownloadError={() => handleDownloadError(selectedEpisode.fileName)}
        />
      )}

      {/* ── Cancel Download Popup ─────────────────────────────────────── */}
      {cancelPopup && (
        <CancelPopup
          primaryColor={primaryColor}
          title={cancelPopup.title}
          onDismiss={() => setCancelPopup(null)}
          onCancel={() => handleCancelDownload(cancelPopup.fileName, cancelPopup.jobId)}
        />
      )}
    </div>
  );
};

export default SeasonList;