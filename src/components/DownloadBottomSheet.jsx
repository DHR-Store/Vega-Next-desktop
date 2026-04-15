import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { providerManager } from '../lib/services/ProviderManager';
import useThemeStore from '../lib/zustand/themeStore';
import useDownloadedStore from '../lib/zustand/downloadedStore';

const { ipcRenderer } = window.require
  ? window.require('electron')
  : { send: () => {}, invoke: async () => {}, on: () => {}, removeListener: () => {} };

const DownloadBottomSheet = ({
  isOpen,
  onClose,
  link,
  type,
  providerValue,
  title,
  fileName,
  externalPlayers = [],
  onLaunchExternalPlayer = null,
  onDownloadProgress = null,   // (percent: number, jobId: string|null) => void
  onDownloadComplete = null,   // () => void
  onDownloadError    = null,   // () => void
}) => {
  const { primary } = useThemeStore();
  const { markAsDownloaded } = useDownloadedStore();

  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState([]);
  const accent = primary || '#e8522a';

  // Store active download jobId to listen for its progress
  const activeJobIdRef = useRef(null);
  const progressListenerRef = useRef(null);
  const completeListenerRef = useRef(null);
  const errorListenerRef = useRef(null);

  // Fetch servers when sheet opens
  useEffect(() => {
    if (!isOpen) {
      setServers([]);
      return;
    }
    const fetchServers = async () => {
      setLoading(true);
      try {
        const streams = await providerManager.getStream({ link, type, providerValue });
        setServers(streams);
      } catch (err) {
        console.error('Failed to fetch servers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServers();
  }, [isOpen, link, type, providerValue]);

  // Cleanup IPC listeners when component unmounts or sheet closes
  useEffect(() => {
    return () => {
      if (progressListenerRef.current) {
        ipcRenderer.removeListener('download:progress', progressListenerRef.current);
      }
      if (completeListenerRef.current) {
        ipcRenderer.removeListener('download:complete', completeListenerRef.current);
      }
      if (errorListenerRef.current) {
        ipcRenderer.removeListener('download:error', errorListenerRef.current);
      }
    };
  }, []);

  const handleSelectServer = async (server) => {
    onClose();

    // Start download via IPC directly (no renderer notifications)
    try {
      const jobId = await ipcRenderer.invoke('download:start', {
        url: server.link,
        fileName,
        fileType: server.type || 'mp4',
        title,
        headers: server.headers || {},
      });

      activeJobIdRef.current = jobId;

      // Set up progress listener for this job
      const onProgress = (event, { jobId: evJobId, percent, downloadedBytes, totalBytes }) => {
        if (evJobId === jobId) {
          onDownloadProgress?.(percent, jobId);
        }
      };
      progressListenerRef.current = onProgress;
      ipcRenderer.on('download:progress', onProgress);

      // Set up completion listener
      const onComplete = (event, { jobId: evJobId, outputPath }) => {
        if (evJobId === jobId) {
          markAsDownloaded(fileName);
          onDownloadComplete?.();
          // Cleanup listeners
          ipcRenderer.removeListener('download:progress', onProgress);
          ipcRenderer.removeListener('download:complete', onComplete);
          ipcRenderer.removeListener('download:error', onError);
          activeJobIdRef.current = null;
        }
      };
      completeListenerRef.current = onComplete;
      ipcRenderer.on('download:complete', onComplete);

      // Set up error listener
      const onError = (event, { jobId: evJobId, error }) => {
        if (evJobId === jobId) {
          onDownloadError?.();
          ipcRenderer.removeListener('download:progress', onProgress);
          ipcRenderer.removeListener('download:complete', onComplete);
          ipcRenderer.removeListener('download:error', onError);
          activeJobIdRef.current = null;
        }
      };
      errorListenerRef.current = onError;
      ipcRenderer.on('download:error', onError);

    } catch (err) {
      console.error('Failed to start download:', err);
      onDownloadError?.();
    }
  };

  const handleExternalPlayerLaunch = (player, streamUrl) => {
    onClose();
    if (onLaunchExternalPlayer) onLaunchExternalPlayer(player, streamUrl);
    else if (ipcRenderer.send) ipcRenderer.send('launch-player', player, streamUrl);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: '#1a1a1a', borderRadius: '20px 20px 0 0',
          paddingBottom: '32px', animation: 'slideUp 0.25s ease-out',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
        </div>

        <div style={{ padding: '12px 20px 20px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
            Select Server To Download
          </h3>
        </div>

        <div style={{
          overflowY: 'auto', flex: 1, padding: '0 16px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '40px 0', gap: '12px',
            }}>
              <Loader2 size={28} style={{ color: accent, animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#9ca3af', fontSize: '15px' }}>Fetching servers…</span>
            </div>
          ) : servers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#ef4444', padding: '40px 0', fontSize: '15px' }}>
              No servers found
            </p>
          ) : (
            <>
              {servers.map((server, idx) => (
                <button
                  key={`dl-${idx}`}
                  onClick={() => handleSelectServer(server)}
                  onContextMenu={(e) => { e.preventDefault(); navigator.clipboard.writeText(server.link); }}
                  style={{
                    width: '100%', padding: '18px 20px',
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px', color: '#fff',
                    fontSize: '16px', fontWeight: 500,
                    textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                >
                  {server.server || `Server ${idx + 1}`}
                </button>
              ))}

              {onLaunchExternalPlayer && externalPlayers.length > 0 && (
                <>
                  <div style={{
                    margin: '8px 0 4px', fontSize: '11px', fontWeight: 600,
                    color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em',
                    textTransform: 'uppercase', paddingLeft: '4px',
                  }}>
                    Play with External Player
                  </div>
                  {servers.map((server, sIdx) => (
                    <React.Fragment key={`ext-${sIdx}`}>
                      <button
                        onClick={() => handleExternalPlayerLaunch(
                          { name: 'Bundled VLC', path: '', type: 'bundled-vlc' }, server.link
                        )}
                        style={{
                          width: '100%', padding: '18px 20px',
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '14px', color: '#fff',
                          fontSize: '16px', fontWeight: 500,
                          textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s',
                        }}
                      >
                        📀 Bundled VLC — {server.server || `Server ${sIdx + 1}`}
                      </button>
                      {externalPlayers.map((player, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleExternalPlayerLaunch(player, server.link)}
                          style={{
                            width: '100%', padding: '18px 20px',
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '14px', color: '#fff',
                            fontSize: '16px', fontWeight: 500,
                            textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s',
                          }}
                        >
                          🎬 {player.name} — {server.server || `Server ${sIdx + 1}`}
                        </button>
                      ))}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>
    </>
  );
};

export default DownloadBottomSheet;