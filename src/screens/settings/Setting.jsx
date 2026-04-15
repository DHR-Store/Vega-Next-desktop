import React, { useState, useEffect, useCallback, useRef } from 'react';
import Nav from '../../components/Nav';
import Extensions from '../Extensions';
import useContentStore from '../../lib/zustand/contentStore';
import Preferences from './Preferences';
import About from './About';
import { DiscordRPC } from '../../lib/services/DiscordRPC';

// ─── Local Storage helpers ─────────────────────────────────────────────────
const storage = {
  get: (key, defaultValue) => {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    try { return JSON.parse(val); } catch { return val; }
  },
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  delete: (key) => localStorage.removeItem(key),
};

// ─── Toast ────────────────────────────────────────────────────────────────
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

// ─── Row helpers ──────────────────────────────────────────────────────────
const InternalOptionRow = ({ icon, text, onClick, primaryColor, isLast = false }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px', cursor: 'pointer',
      borderBottom: isLast ? 'none' : '1px solid #262626',
    }}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ color: primaryColor, fontSize: '20px' }}>{icon}</span>
      <span style={{ color: 'white', fontSize: '16px' }}>{text}</span>
    </div>
    <span style={{ color: 'gray' }}>›</span>
  </div>
);

const ExternalLinkRow = ({ icon, text, url, iconColor, isLast = false }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px', cursor: 'pointer',
        borderBottom: isLast ? 'none' : '1px solid #262626',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: iconColor, fontSize: '20px' }}>{icon}</span>
        <span style={{ color: 'white', fontSize: '16px' }}>{text}</span>
      </div>
      <span style={{ color: 'gray' }}>↗</span>
    </div>
  </a>
);

const NotificationPrompt = ({ primaryColor }) => {
  const [permission, setPermission] = useState(Notification.permission);
  if (permission === 'granted') return null;
  return (
    <div style={{ backgroundColor: '#1A1A1A', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div
        onClick={async () => {
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result !== 'granted') alert('Please enable notifications in your browser settings.');
          else showToast('Notifications enabled');
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: primaryColor, fontSize: '22px' }}>🔔</span>
          <div>
            <div style={{ color: 'white' }}>Enable Notifications</div>
            <div style={{ color: '#aaa', fontSize: '12px' }}>Receive updates on new content.</div>
          </div>
        </div>
        <span style={{ color: 'gray' }}>›</span>
      </div>
    </div>
  );
};

// ─── Inline styles ────────────────────────────────────────────────────────
const styles = {
  container: { height: '100vh', width: '100vw', backgroundColor: '#050505', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { padding: '20px', borderBottom: '1px solid #1a1a1a' },
  content: { flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '80px' },
  section: { marginBottom: '24px' },
  sectionTitle: { color: '#aaa', fontSize: '14px', marginBottom: '8px', marginLeft: '8px' },
  card: { backgroundColor: '#1A1A1A', borderRadius: '12px', overflow: 'hidden' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' },
  switch: { position: 'relative', display: 'inline-block', width: '48px', height: '24px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#1e1e1e', padding: '28px', borderRadius: '20px', width: '90%', maxWidth: '420px', color: 'white', border: '1px solid rgba(255,255,255,0.08)' },
};

// ─── Switch CSS (injected once) ───────────────────────────────────────────
if (!document.getElementById('vega-switch-css')) {
  const style = document.createElement('style');
  style.id = 'vega-switch-css';
  style.textContent = `
    .v-switch input { opacity: 0; width: 0; height: 0; }
    .v-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #767577; transition: 0.3s; border-radius: 34px; }
    .v-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; }
    input:checked + .v-slider { background-color: #3b82f6; }
    input:checked + .v-slider:before { transform: translateX(24px); }
  `;
  document.head.appendChild(style);
}

// ─── Discord WebView Login Modal (polling with proper cleanup) ───────────
const DiscordLoginModal = ({ visible, onClose, onTokenReceived }) => {
  const webviewRef = useRef(null);
  const intervalRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPolling = () => {
    if (intervalRef.current) stopPolling();
    intervalRef.current = setInterval(() => {
      const webview = webviewRef.current;
      // Don't poll if webview doesn't exist or is being destroyed
      if (!webview || webview.isDestroyed?.()) {
        stopPolling();
        return;
      }
      webview.executeJavaScript('localStorage.getItem("token")')
        .then(token => {
          if (token && token !== 'null' && token.length > 30) {
            const cleanToken = token.replace(/"/g, '');
            stopPolling();               // stop polling immediately
            onTokenReceived(cleanToken); // send token to parent
            onClose();                  // close modal
          }
        })
        .catch(err => {
          // Ignore errors if webview is gone
          if (err.message?.includes('destroyed')) stopPolling();
          else console.warn('Poll error:', err);
        });
    }, 1000);
  };

  useEffect(() => {
    if (!visible) {
      stopPolling();
      setIsReady(false);
      return;
    }
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      setIsReady(true);
      startPolling();
    };

    webview.addEventListener('dom-ready', handleDomReady);
    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      stopPolling();
    };
  }, [visible, onTokenReceived, onClose]);

  if (!visible) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={{
          ...styles.modalContent,
          width: '90%',
          maxWidth: '800px',
          height: '80vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0 }}>Login to Discord</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
        <webview
          ref={webviewRef}
          src="https://discord.com/login"
          style={{ flex: 1 }}
          webpreferences="allowRunningInsecureContent=no, javascript=yes"
          partition="persist:discord"
        />
        {!isReady && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              background: 'rgba(0,0,0,0.7)',
              padding: '10px 20px',
              borderRadius: '8px',
            }}
          >
            Loading Discord login...
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Settings Component ───────────────────────────────────────────────
const Settings = ({ onNavigate, currentTab }) => {
  const [showExtensions, setShowExtensions]   = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [appMode, setAppMode]                 = useState(storage.get('appMode', 'video'));
  const [networkProxyMode, setNetworkProxyMode] = useState(storage.get('networkProxyMode', false));
  const [watchTogetherMode, setWatchTogetherMode] = useState(storage.get('watchTogetherMode', false));
  const [syncLink, setSyncLink]               = useState('');
  const [aiEnabled, setAiEnabled]             = useState(storage.get('isAIEnabled', false));

  // Discord state
  const [discordToken, setDiscordToken]       = useState(storage.get('discord_token', ''));
  const [discordUser, setDiscordUser]         = useState(null);
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [showDiscordManual, setShowDiscordManual] = useState(false);
  const [manualToken, setManualToken]         = useState('');
  const [showDiscordWebView, setShowDiscordWebView] = useState(false);

  // YouTube state
  const [ytProfilePic, setYtProfilePic]       = useState(storage.get('ytProfilePic', null));
  const [showYTLogin, setShowYTLogin]         = useState(false);

  const primaryColor = '#3b82f6';

  const { installedProviders, provider, setProvider } = useContentStore();
  const [selectedProvider, setSelectedProvider] = useState(provider || installedProviders[0] || null);

  // ── Persist settings ──────────────────────────────────────────────────
  useEffect(() => { storage.set('appMode', appMode); }, [appMode]);
  useEffect(() => { storage.set('networkProxyMode', networkProxyMode); }, [networkProxyMode]);
  useEffect(() => { storage.set('watchTogetherMode', watchTogetherMode); }, [watchTogetherMode]);
  useEffect(() => { storage.set('isAIEnabled', aiEnabled); }, [aiEnabled]);
  useEffect(() => { storage.set('discord_token', discordToken); }, [discordToken]);
  useEffect(() => { storage.set('ytProfilePic', ytProfilePic); }, [ytProfilePic]);

  // ── Fetch Discord profile (always Bearer) ──────────────────────────────
  useEffect(() => {
    if (!discordToken) {
      setDiscordUser(null);
      return;
    }
    fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${discordToken}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.id) {
          const avatarUrl = data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${(parseInt(data.discriminator) || 0) % 5}.png`;
          setDiscordUser({ username: data.global_name || data.username, avatarUrl });
        } else {
          setDiscordUser(null);
        }
      })
      .catch(err => {
        console.warn('Discord user fetch failed:', err);
        setDiscordUser(null);
      });
  }, [discordToken]);

  // ── Auto-connect DiscordRPC ───────────────────────────────────────────
  useEffect(() => {
    if (discordToken && discordToken.length > 20) {
      DiscordRPC.connect(discordToken);
    } else {
      DiscordRPC.disconnect();
    }
  }, [discordToken]);

  const { ipcRenderer } = window.require('electron');

 const handleDiscordLogin = () => {
  setShowDiscordWebView(true);
};
  // ── Handlers ─────────────────────────────────────────────────────────

  const handleDiscordTokenReceived = (token) => {
    if (token && token.length > 30 && token !== 'null') {
      setDiscordToken(token);
      storage.set('discord_token', token);
      showToast('Connected to Discord!');
    } else {
      showToast('Failed to get token');
    }
    setShowDiscordWebView(false);
  };

  const handleDiscordDisconnect = useCallback(() => {
    DiscordRPC.disconnect();
    setDiscordToken('');
    setDiscordUser(null);
    showToast('Disconnected from Discord');
  }, []);

  const handleManualTokenSave = useCallback(() => {
    const trimmed = manualToken.trim();
    if (trimmed.length < 20) { showToast('Token looks too short'); return; }
    setDiscordToken(trimmed);
    setShowDiscordManual(false);
    setManualToken('');
    showToast('Discord token saved and connected!');
  }, [manualToken]);

  const toggleNetworkProxy = () => {
    const next = !networkProxyMode;
    setNetworkProxyMode(next);
    showToast(next ? 'Proxy enabled' : 'Proxy disabled');
  };

  const parseSyncLink = (link) => {
    try {
      const params = new URLSearchParams(link.split('?')[1] || link);
      const videoId = params.get('video_id');
      const time    = params.get('time');
      if (videoId && time) {
        return {
          videoId, time: parseInt(time, 10),
          roomId: params.get('roomId'), leader: params.get('leader'),
          infoUrl: params.get('infoUrl'), providerValue: params.get('providerValue'),
          primaryTitle: decodeURIComponent(params.get('primaryTitle') || 'Shared Content'),
        };
      }
    } catch (_) {}
    return null;
  };

  const handleJoinSession = () => {
    if (!syncLink.trim()) { showToast('Please paste a sync link'); return; }
    const parsed = parseSyncLink(syncLink);
    if (parsed) showToast(`Joining session at ${parsed.time}s`);
    else showToast('Invalid sync link format');
  };

  const handlePasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes('video_id=') && text.includes('time=')) {
        setSyncLink(text);
        showToast('Link pasted');
      } else {
        showToast('No valid sync link in clipboard');
      }
    } catch (_) {
      showToast('Failed to read clipboard');
    }
  };

  if (showExtensions) {
    return <Extensions onBack={() => setShowExtensions(false)} onNavigate={onNavigate} currentTab={currentTab} />;
  }
  if (showPreferences) {
    return <Preferences onBack={() => setShowPreferences(false)} onNavigate={onNavigate} currentTab={currentTab} />;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>Settings</h2>
      </header>

      <main style={styles.content}>
        {/* App Mode */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>App Mode</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: primaryColor, fontSize: '22px' }}>📺</span>
                <span>Vega-TV Mode</span>
              </div>
              <label style={styles.switch} className="v-switch">
                <input
                  type="checkbox"
                  checked={appMode === 'vegaTv'}
                  onChange={(e) => {
                    const newMode = e.target.checked ? 'vegaTv' : 'video';
                    setAppMode(newMode);
                    if (newMode === 'vegaTv') onNavigate('VegaTVStack');
                  }}
                />
                <span className="v-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Notifications</div>
          <NotificationPrompt primaryColor={primaryColor} />
        </div>

        {/* Network Proxy */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Network & Connection</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span style={{ color: primaryColor, fontSize: '22px' }}>🛡️</span>
                <div>
                  <div>Secure Proxy (VPN Mode)</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>Bypass ISP blocks via DoH.</div>
                </div>
              </div>
              <label style={styles.switch} className="v-switch">
                <input type="checkbox" checked={networkProxyMode} onChange={toggleNetworkProxy} />
                <span className="v-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Content Provider */}
        {appMode === 'video' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Content Provider</div>
            <div style={styles.card}>
              <div style={{ padding: '16px', overflowX: 'auto', display: 'flex', gap: '12px' }}>
                {installedProviders.map(prov => {
                  const displayName = prov.display_name || prov.name || prov.value;
                  const isSelected  = selectedProvider?.value === prov.value;
                  return (
                    <div
                      key={prov.value}
                      onClick={() => { setSelectedProvider(prov); setProvider(prov); }}
                      style={{
                        minWidth: '100px', padding: '12px', borderRadius: '12px',
                        textAlign: 'center',
                        backgroundColor: isSelected ? '#333' : '#262626',
                        border: `1.5px solid ${isSelected ? primaryColor : '#333'}`,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {prov.icon
                        ? <img src={prov.icon} alt={displayName} style={{ width: '40px', height: '40px', objectFit: 'contain', marginBottom: '8px' }} onError={e => { e.target.style.display = 'none'; }} />
                        : <div style={{ fontSize: '32px', marginBottom: '8px' }}>{prov.type === 'movie' ? '🎬' : prov.type === 'series' ? '📺' : '🎥'}</div>
                      }
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{displayName}</div>
                      {isSelected && <div style={{ color: primaryColor, fontSize: '12px', marginTop: '6px' }}>✓</div>}
                    </div>
                  );
                })}
                {installedProviders.length === 0 && (
                  <div style={{ color: '#aaa', padding: '12px' }}>No providers installed.</div>
                )}
              </div>
              <InternalOptionRow icon="🧩" text="Provider Manager" onClick={() => setShowExtensions(true)} primaryColor={primaryColor} />
              <InternalOptionRow icon="✅" text="Provider Checker" onClick={() => alert('Provider Checker – coming soon')} primaryColor={primaryColor} isLast />
            </div>
          </div>
        )}

        {/* Watch Together */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Watch Together</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: primaryColor, fontSize: '22px' }}>👥</span>
                <span>Enable Watch Together Mode</span>
              </div>
              <label style={styles.switch} className="v-switch">
                <input type="checkbox" checked={watchTogetherMode} onChange={() => setWatchTogetherMode(p => !p)} />
                <span className="v-slider" />
              </label>
            </div>
            {watchTogetherMode && (
              <div style={{ padding: '16px', borderTop: '1px solid #262626' }}>
                <div style={{ marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Paste Sync Link to Join</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="vegaNext://watch?video_id=..."
                    value={syncLink}
                    onChange={e => setSyncLink(e.target.value)}
                    style={{ flex: 1, background: '#222', border: '1px solid #333', padding: '8px 12px', borderRadius: '8px', color: 'white', outline: 'none' }}
                  />
                  <button onClick={handlePasteLink} style={{ background: '#444', border: 'none', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>📋</button>
                  <button onClick={handleJoinSession} style={{ background: primaryColor, border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 600 }}>Join</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Discord Integration (WebView login) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Integrations</div>
          <div style={styles.card}>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '22px' }}>🎮</span>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Discord Rich Presence</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                      {discordUser ? `Connected as ${discordUser.username}` : 'Show what you\'re watching on Discord'}
                    </div>
                  </div>
                </div>
                {discordUser && (
                  <img src={discordUser.avatarUrl} alt="discord avatar"
                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #5865F2' }} />
                )}
              </div>

              {discordUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 12px', background: 'rgba(88,101,242,0.1)', borderRadius: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#23a559' }} />
                  <span style={{ fontSize: '13px', color: '#bbb' }}>Active — presence will update when you play something</span>
                </div>
              )}

              {!discordToken ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={handleDiscordLogin}
                    style={{ background: '#5865F2', border: 'none', padding: '12px', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '100%', fontWeight: 600 }}>
                    🔑 Login with Discord
                  </button>
                  <button onClick={() => setShowDiscordManual(true)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', color: '#aaa', cursor: 'pointer', width: '100%', fontSize: '13px' }}>
                    Enter token manually
                  </button>
                </div>
              ) : (
                <button onClick={handleDiscordDisconnect}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', width: '100%', fontWeight: 600 }}>
                  Disconnect Discord
                </button>
              )}
            </div>
          </div>
        </div>

        {/* YouTube */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>YouTube</div>
          <div style={styles.card}>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {ytProfilePic
                    ? <img src={ytProfilePic} alt="yt" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    : <span style={{ color: '#FF0000', fontSize: '22px' }}>▶️</span>}
                  <span>{ytProfilePic ? 'YouTube Account Connected' : 'YouTube Account & Mod'}</span>
                </div>
                {ytProfilePic && (
                  <button onClick={() => { setYtProfilePic(null); showToast('Logged out of YouTube'); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Logout</button>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '16px' }}>Background play, ad‑blocking, and media extraction.</div>
              {!ytProfilePic
                ? <button onClick={() => setShowYTLogin(true)} style={{ background: '#333', border: 'none', padding: '10px', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '100%' }}>Login to YouTube</button>
                : <button onClick={() => onNavigate('YTHome')} style={{ background: '#FF0000', border: 'none', padding: '10px', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '100%' }}>Open YouTube</button>
              }
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Options</div>
          <div style={styles.card}>
           <InternalOptionRow 
  icon="📥" 
  text="Downloads" 
  onClick={() => onNavigate('Download')}   // ✅ 'Download' (singular)
  primaryColor={primaryColor} 
/>
            <InternalOptionRow icon="📝" text="Subtitle Style" onClick={() => alert('Subtitle preferences')} primaryColor={primaryColor} />
            <InternalOptionRow icon="🕒" text="Watch History" onClick={() => alert('Watch history')} primaryColor={primaryColor} />
            <InternalOptionRow icon="⚙️" text="Preferences" onClick={() => setShowPreferences(true)} primaryColor={primaryColor} isLast />
          </div>
        </div>

        {/* AI */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Vega-Next AI</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span style={{ color: primaryColor, fontSize: '22px' }}>🤖</span>
                <div>
                  <div>Enable Vega-Next AI</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>Smart assistant for movies</div>
                  <button
                    onClick={() => alert('AI Chat History')}
                    style={{ background: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', marginTop: '8px', cursor: 'pointer', color: 'black', fontSize: '13px' }}
                  >
                    View AI Chat History
                  </button>
                </div>
              </div>
              <label style={styles.switch} className="v-switch">
                <input type="checkbox" checked={aiEnabled} onChange={() => setAiEnabled(p => !p)} />
                <span className="v-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Data */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Data Management</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <span>Clear Cache</span>
              <button onClick={() => { localStorage.clear(); showToast('Cache cleared'); }} style={{ background: '#262626', border: 'none', padding: '6px 12px', borderRadius: '8px', color: primaryColor, cursor: 'pointer' }}>🗑️</button>
            </div>
            <div style={{ ...styles.row, borderBottom: 'none' }}>
              <span>Clear Watch History</span>
              <button onClick={() => { storage.delete('watchHistory'); showToast('Watch history cleared'); }} style={{ background: '#262626', border: 'none', padding: '6px 12px', borderRadius: '8px', color: primaryColor, cursor: 'pointer' }}>🗑️</button>
            </div>
          </div>
        </div>

        {/* About */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>About</div>
          <div style={styles.card}>
            <InternalOptionRow icon="ℹ️" text="About" onClick={() => onNavigate('About')} primaryColor={primaryColor} />
            <ExternalLinkRow icon="🐙" text="Give a star" url="https://github.com/DHR-Store/Vega-Next" iconColor={primaryColor} />
            <ExternalLinkRow icon="📢" text="Error and Suggestions" url="https://radio-nu-five.vercel.app/" iconColor={primaryColor} />
            <ExternalLinkRow icon="🤖" text="Vega-Next-AI (Help)" url="https://vega-next-ai.vercel.app/" iconColor={primaryColor} />
            <ExternalLinkRow icon="🎵" text="Kreate" url="https://kreate-that.vercel.app/" iconColor="white" />
            <ExternalLinkRow icon="❤️" text="Go to DHR-Store" url="https://dhr-store.vercel.app/" iconColor="#ff69b4" isLast />
          </div>
        </div>
      </main>

      <Nav currentTab={currentTab} onTabChange={onNavigate} />

      {/* Discord WebView Modal */}
      <DiscordLoginModal
        visible={showDiscordWebView}
        onClose={() => setShowDiscordWebView(false)}
        onTokenReceived={handleDiscordTokenReceived}
      />

      {/* Discord Manual Token Modal */}
      {showDiscordManual && (
        <div style={styles.modalOverlay} onClick={() => setShowDiscordManual(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Enter Discord Token</h3>
              <button onClick={() => setShowDiscordManual(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
              If the login doesn't work, you can paste your Discord token directly.<br />
              <strong style={{ color: '#f59e0b' }}>⚠ Keep your token private.</strong>
            </p>
            <input
              type="password"
              placeholder="Paste your token here…"
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              style={{ width: '100%', background: '#2a2a2a', border: '1px solid #444', padding: '10px 12px', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none', marginBottom: '12px' }}
            />
            <button
              onClick={handleManualTokenSave}
              style={{ background: '#5865F2', border: 'none', padding: '12px', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '100%', fontWeight: 600 }}
            >
              Save & Connect
            </button>
          </div>
        </div>
      )}

      {/* YouTube Login Modal */}
      {showYTLogin && (
        <div style={styles.modalOverlay} onClick={() => setShowYTLogin(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Login to YouTube</h3>
              <button onClick={() => setShowYTLogin(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer' }}>✕</button>
            </div>
            <button
              onClick={() => {
                setYtProfilePic('https://via.placeholder.com/32?text=YT');
                setShowYTLogin(false);
                showToast('Logged in to YouTube (demo)');
              }}
              style={{ background: '#FF0000', border: 'none', padding: '12px', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '100%', fontWeight: 600 }}
            >
              Simulate Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;