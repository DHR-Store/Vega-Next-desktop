import React, { useState, useEffect } from 'react';
import Nav from '../../components/Nav'; // Adjust path if needed

// --- localStorage helpers ---
const storage = {
  getBool: (key, defaultValue = false) => {
    const val = localStorage.getItem(key);
    return val === null ? defaultValue : val === 'true';
  },
  setBool: (key, value) => localStorage.setItem(key, String(value)),
};

// --- Toast helper ---
const showToast = (message, duration = 2000) => {
  const existing = document.getElementById('vega-about-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'vega-about-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1f1f1f',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '10px',
    zIndex: 2000,
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    pointerEvents: 'none',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

// --- Version comparison ---
const compareVersions = (localVersion, remoteVersion) => {
  try {
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);
    for (let i = 0; i < Math.max(local.length, remote.length); i++) {
      const l = local[i] || 0;
      const r = remote[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  } catch {
    return false;
  }
};

// --- API check for update ---
const VERCEL_API_DOMAIN = 'https://my-desktop-server.vercel.app'; // Replace with your actual domain
const checkForUpdate = async (setUpdateLoading, autoDownload, showToastMsg = true) => {
  setUpdateLoading(true);
  try {
    const apiUrl = `https://${VERCEL_API_DOMAIN}/api/latest-release`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    const localVersion = process.env.REACT_APP_VERSION || '0.0.1';
    const remoteVersion = data.version;

    if (compareVersions(localVersion, remoteVersion)) {
      const userConfirmed = window.confirm(
        `${data.title || `Update v${remoteVersion} available`}\n\n${data.body || data.releaseNotes || 'New version is ready to download.'}\n\nDownload now?`
      );
      if (userConfirmed) {
        window.open(data.downloadUrl, '_blank');
      }
      if (autoDownload && !userConfirmed) {
        // Only auto-download if user didn't already confirm (avoid double open)
        window.open(data.downloadUrl, '_blank');
      }
    } else {
      if (showToastMsg) showToast('App is up to date');
    }
  } catch (error) {
    console.error('Update check failed', error);
    if (showToastMsg) showToast('Failed to check for update');
  } finally {
    setUpdateLoading(false);
  }
};

// --- Inline styles (consistent with Settings page) ---
const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    backgroundColor: '#050505',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #1a1a1a',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    paddingBottom: '80px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    color: '#aaa',
    fontSize: '14px',
    marginBottom: '8px',
    marginLeft: '8px',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid #262626',
  },
  rowLast: {
    borderBottom: 'none',
  },
  switch: {
    position: 'relative',
    display: 'inline-block',
    width: '48px',
    height: '24px',
  },
};

// --- Switch CSS (injected once globally, avoid duplicates) ---
if (!document.getElementById('vega-about-switch-css')) {
  const style = document.createElement('style');
  style.id = 'vega-about-switch-css';
  style.textContent = `
    .v-switch { position: relative; display: inline-block; width: 48px; height: 24px; }
    .v-switch input { opacity: 0; width: 0; height: 0; }
    .v-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #767577; transition: 0.3s; border-radius: 34px; }
    .v-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; }
    input:checked + .v-slider { background-color: #3b82f6; }
    input:checked + .v-slider:before { transform: translateX(24px); }
  `;
  document.head.appendChild(style);
}

// --- Option Row Component (matching Settings style) ---
const OptionRow = ({ icon, text, onClick, primaryColor = '#3b82f6', isLast = false }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      cursor: 'pointer',
      borderBottom: isLast ? 'none' : '1px solid #262626',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ color: primaryColor, fontSize: '20px' }}>{icon}</span>
      <span style={{ color: 'white', fontSize: '16px' }}>{text}</span>
    </div>
    <span style={{ color: 'gray' }}>›</span>
  </div>
);

// --- Main About Component ---
const About = ({ onNavigate, currentTab }) => {
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(storage.getBool('autoDownload', true));
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(storage.getBool('autoCheckUpdate', true));
  const [backgroundNotifications, setBackgroundNotifications] = useState(storage.getBool('backgroundNotifications', false));

  const appVersion = process.env.REACT_APP_VERSION || '0.0.1';
  const primaryColor = '#3b82f6';

  // Auto-check on mount
  useEffect(() => {
    if (autoCheckUpdate) {
      checkForUpdate(setUpdateLoading, autoDownload, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoDownloadToggle = (val) => {
    setAutoDownload(val);
    storage.setBool('autoDownload', val);
    showToast(val ? 'Auto-download enabled' : 'Auto-download disabled');
  };

  const handleAutoCheckToggle = (val) => {
    setAutoCheckUpdate(val);
    storage.setBool('autoCheckUpdate', val);
    showToast(val ? 'Auto-check on start enabled' : 'Auto-check on start disabled');
  };

  const handleBackgroundToggle = (val) => {
    setBackgroundNotifications(val);
    storage.setBool('backgroundNotifications', val);
    showToast(val ? 'Background notifications (mock) enabled' : 'Disabled');
  };

  const handleManualCheck = () => {
    checkForUpdate(setUpdateLoading, autoDownload, true);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>About</h2>
        <div style={{ color: '#aaa', marginTop: '4px', fontSize: '14px' }}>
          App information and updates
        </div>
      </header>

      <main style={styles.content}>
        {/* Version */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Version</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <span>Current Version</span>
              <span style={{ color: '#ccc', fontFamily: 'monospace' }}>v{appVersion}</span>
            </div>
          </div>
        </div>

        {/* Background Notifications (mock) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Notifications</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: primaryColor, fontSize: '20px' }}>🔔</span>
                <div>
                  <div>Background Notifications</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    Receive notifications even when the app is closed (web demo – mock only)
                  </div>
                </div>
              </div>
              <label className="v-switch">
                <input
                  type="checkbox"
                  checked={backgroundNotifications}
                  onChange={(e) => handleBackgroundToggle(e.target.checked)}
                />
                <span className="v-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Auto Install Updates */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Update Settings</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: primaryColor, fontSize: '20px' }}>⚡</span>
                <span>Auto Install Updates</span>
              </div>
              <label className="v-switch">
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => handleAutoDownloadToggle(e.target.checked)}
                />
                <span className="v-slider"></span>
              </label>
            </div>
            <div style={{ ...styles.row, ...styles.rowLast }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: primaryColor, fontSize: '20px' }}>🔄</span>
                <div>
                  <div>Check Updates on Start</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    Automatically check for updates when app starts
                  </div>
                </div>
              </div>
              <label className="v-switch">
                <input
                  type="checkbox"
                  checked={autoCheckUpdate}
                  onChange={(e) => handleAutoCheckToggle(e.target.checked)}
                />
                <span className="v-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Manual Check Button */}
        <div style={styles.section}>
          <button
            onClick={handleManualCheck}
            disabled={updateLoading}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              color: '#fff',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: updateLoading ? 'not-allowed' : 'pointer',
              opacity: updateLoading ? 0.6 : 1,
              width: '100%',
            }}
          >
            <span>🔍 Check for Updates</span>
            <span>›</span>
          </button>
        </div>

        {/* Additional Info Links (matching Settings style) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Resources</div>
          <div style={styles.card}>
            <OptionRow
              icon="🐙"
              text="GitHub Repository"
              onClick={() => window.open('https://github.com/DHR-Store/Vega-Next', '_blank')}
              primaryColor={primaryColor}
            />
            <OptionRow
              icon="📢"
              text="Report Issues / Suggestions"
              onClick={() => window.open('https://radio-nu-five.vercel.app/', '_blank')}
              primaryColor={primaryColor}
            />
            <OptionRow
              icon="🤖"
              text="Vega-Next AI Help"
              onClick={() => window.open('https://vega-next-ai.vercel.app/', '_blank')}
              primaryColor={primaryColor}
            />
            <OptionRow
              icon="❤️"
              text="DHR-Store"
              onClick={() => window.open('https://dhr-store.vercel.app/', '_blank')}
              primaryColor="#ff69b4"
              isLast
            />
          </div>
        </div>

        {/* Credits */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Credits</div>
          <div style={styles.card}>
            <div style={{ padding: '16px', color: '#aaa', fontSize: '13px', lineHeight: 1.5 }}>
              Vega-Next – Modern media experience.<br />
              Built with React, Electron, and community love.
            </div>
          </div>
        </div>
      </main>

      {/* Navigation Bar */}
      <Nav currentTab={currentTab} onTabChange={onNavigate} />
    </div>
  );
};

export default About;