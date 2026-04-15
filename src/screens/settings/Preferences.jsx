import React, { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import useThemeStore from '../../lib/zustand/themeStore';

// --- Simple Toast ---
const showToast = (message, duration = 2000) => {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#333',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '8px',
    zIndex: 2000,
    fontSize: '14px',
    fontFamily: 'sans-serif',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

// --- Simple event emitter ---
class EventEmitter {
  constructor() {
    this.events = {};
  }
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(data));
    }
  }
  on(event, cb) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
  }
}
const deviceEventEmitter = new EventEmitter();

// --- localStorage helpers (for non‑theme preferences) ---
const storage = {
  getBool: (key, defaultValue = false) => {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val === 'true';
  },
  setBool: (key, value) => localStorage.setItem(key, String(value)),
  getString: (key, defaultValue = '') => localStorage.getItem(key) || defaultValue,
  setString: (key, value) => localStorage.setItem(key, value),
  getArray: (key, defaultValue = []) => {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  },
  setArray: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
};

// --- Theme constants ---
const themes = [
  { name: 'Default', color: '#FF6347' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Custom', color: 'custom' },
];

// --- DNS providers ---
const dnsProviders = [
  { name: 'Default (ISP/System)', value: '' },
  { name: 'Cloudflare (1.1.1.1)', value: 'https://cloudflare-dns.com/dns-query' },
  { name: 'Google (8.8.8.8)', value: 'https://dns.google/dns-query' },
  { name: 'AdGuard (AdBlock)', value: 'https://dns.adguard-dns.com/dns-query' },
  { name: 'Quad9 (Security)', value: 'https://dns.quad9.net/dns-query' },
  { name: 'Custom', value: 'custom' },
];

// --- User Agents ---
const userAgents = [
  { name: 'Default (Chrome)', value: '' },
  { name: 'Chrome (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { name: 'Firefox (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0' },
  { name: 'Safari (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15' },
  { name: 'iPhone (iOS)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1' },
  { name: 'Custom', value: 'custom' },
];

const Preferences = ({ onNavigate, currentTab, onBack }) => {
  // --- Zustand theme store ---
  const { primary, isCustom, setPrimary, setCustom } = useThemeStore();

  // Local state for custom color input (only used when isCustom === true)
  const [customColor, setCustomColor] = useState(primary);

  // Sync customColor with store when primary changes (e.g., on app load)
  useEffect(() => {
    if (isCustom) setCustomColor(primary);
  }, [primary, isCustom]);

  // --- All other preferences (stored directly in localStorage) ---
  const [hapticFeedback, setHapticFeedback] = useState(storage.getBool('hapticFeedback', true));
  const [showTabBarLables, setShowTabBarLables] = useState(storage.getBool('showTabBarLables', false));
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(storage.getBool('showHamburgerMenu', true));
  const [showRecentlyWatched, setShowRecentlyWatched] = useState(storage.getBool('showRecentlyWatched', false));
  const [disableDrawer, setDisableDrawer] = useState(storage.getBool('disableDrawer', false));
  const [alwaysUseExternalDownload, setAlwaysUseExternalDownload] = useState(storage.getBool('alwaysExternalDownloader', false));
  const [dnsUrl, setDnsUrl] = useState(storage.getString('dnsUrl', ''));
  const [userAgent, setUserAgent] = useState(storage.getString('userAgent', ''));
  const [openExternalPlayer, setOpenExternalPlayer] = useState(storage.getBool('useExternalPlayer', false));
  const [showMediaControls, setShowMediaControls] = useState(storage.getBool('showMediaControls', true));
  const [hideSeekButtons, setHideSeekButtons] = useState(storage.getBool('hideSeekButtons', false));
  const [enableSwipeGesture, setEnableSwipeGesture] = useState(storage.getBool('enableSwipeGesture', true));
  const [excludedQualities, setExcludedQualities] = useState(storage.getArray('ExcludedQualities', []));

  // Helper for boolean preferences (non‑theme)
  const updateBool = (key, stateSetter, value) => {
    storage.setBool(key, value);
    stateSetter(value);
  };

  // --- Theme handlers (update Zustand store + legacy localStorage) ---
  const handleThemeChange = (selectedTheme) => {
    if (selectedTheme.name === 'Custom') {
      setCustom(true);
      setPrimary(customColor);
      // Legacy storage (optional, for backward compatibility)
      storage.setBool('isCustomTheme', true);
      storage.setString('primaryColor', customColor);
      storage.setString('customColor', customColor);
    } else {
      setCustom(false);
      setPrimary(selectedTheme.color);
      storage.setBool('isCustomTheme', false);
      storage.setString('primaryColor', selectedTheme.color);
      storage.setString('customColor', selectedTheme.color);
    }
  };

  const handleCustomColorSubmit = (e) => {
    const color = e.target.value;
    // Basic hex validation
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      showToast('Invalid hex color');
      return;
    }
    setCustomColor(color);
    storage.setString('customColor', color);
    if (isCustom) {
      setPrimary(color);
      storage.setString('primaryColor', color);
    }
  };

  // --- Quality toggle ---
  const toggleQuality = (quality) => {
    const newExcluded = excludedQualities.includes(quality)
      ? excludedQualities.filter(q => q !== quality)
      : [...excludedQualities, quality];
    setExcludedQualities(newExcluded);
    storage.setArray('ExcludedQualities', newExcluded);
  };

  // Tab bar labels event
  const handleTabBarLabelsToggle = (val) => {
    updateBool('showTabBarLables', setShowTabBarLables, val);
    deviceEventEmitter.emit('changeTabBarLabel', val);
    showToast('Restart App to Apply Changes');
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: '#050505',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header with back button */}
      <header style={{
        padding: '20px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              textAlign: 'center'
            }}
          >
            ←
          </button>
        )}
        <h2 style={{ margin: 0, fontSize: '24px' }}>Preferences</h2>
      </header>

      {/* Scrollable content */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
      }}>
        {/* Appearance Section */}
        <div className="section" style={{ marginBottom: '24px' }}>
          <div className="section-title" style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px', marginLeft: '8px' }}>Appearance</div>
          <div className="card" style={{ backgroundColor: '#1A1A1A', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Theme Selector - now using Zustand store values */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span style={{ color: '#fff' }}>Theme</span>
              <div style={{ width: '150px' }}>
                {isCustom ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Hex Color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      onBlur={handleCustomColorSubmit}
                      style={{ background: '#262626', border: 'none', borderRadius: '8px', padding: '4px 8px', color: '#fff', fontSize: '14px', width: '100px' }}
                    />
                    <button
                      onClick={() => {
                        setCustom(false);
                        setPrimary('#FF6347');
                        storage.setBool('isCustomTheme', false);
                        storage.setString('primaryColor', '#FF6347');
                      }}
                      style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={primary}
                    onChange={(e) => {
                      const selected = themes.find(t => t.color === e.target.value);
                      if (selected) handleThemeChange(selected);
                    }}
                    style={{ background: '#262626', border: 'none', borderRadius: '8px', padding: '6px', color: '#fff', width: '100%' }}
                  >
                    {themes.map(theme => (
                      <option key={theme.color} value={theme.color}>{theme.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Haptic Feedback */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Haptic Feedback</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hapticFeedback}
                  onChange={(e) => updateBool('hapticFeedback', setHapticFeedback, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {/* Show Tab Bar Labels */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Show Tab Bar Labels</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showTabBarLables}
                  onChange={(e) => handleTabBarLabelsToggle(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {/* Show Hamburger Menu */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Show Hamburger Menu</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showHamburgerMenu}
                  onChange={(e) => updateBool('showHamburgerMenu', setShowHamburgerMenu, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {/* Show Recently Watched */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Show Recently Watched</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showRecentlyWatched}
                  onChange={(e) => updateBool('showRecentlyWatched', setShowRecentlyWatched, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {/* Disable Drawer */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Disable Drawer</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={disableDrawer}
                  onChange={(e) => updateBool('disableDrawer', setDisableDrawer, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {/* Always Use External Downloader */}
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
              <span>Always Use External Downloader</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={alwaysUseExternalDownload}
                  onChange={(e) => updateBool('alwaysExternalDownloader', setAlwaysUseExternalDownload, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Custom Cloud Features */}
        <div className="section" style={{ marginBottom: '24px' }}>
          <div className="section-title" style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px', marginLeft: '8px' }}>Custom Cloud Features</div>
          <div className="card" style={{ backgroundColor: '#1A1A1A', borderRadius: '12px', padding: '16px' }}>
            {/* DNS DoH */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '8px', color: '#fff' }}>Custom DNS (DoH)</div>
              <select
                value={dnsProviders.some(p => p.value === dnsUrl) ? dnsUrl : 'custom'}
                onChange={(e) => {
                  const selected = dnsProviders.find(p => p.value === e.target.value);
                  if (selected && selected.value !== 'custom') {
                    setDnsUrl(selected.value);
                    storage.setString('dnsUrl', selected.value);
                    showToast(`DNS: ${selected.name}`);
                  }
                }}
                style={{ background: '#262626', border: 'none', borderRadius: '8px', padding: '8px', color: '#fff', width: '100%' }}
              >
                {dnsProviders.map(provider => (
                  <option key={provider.value} value={provider.value}>{provider.name}</option>
                ))}
              </select>

              {(dnsUrl === 'custom' || (!dnsProviders.some(d => d.value === dnsUrl) && dnsUrl !== '')) && (
                <div style={{ marginTop: '12px' }}>
                  <input
                    type="text"
                    placeholder="https://..."
                    defaultValue={dnsUrl}
                    onBlur={(e) => {
                      const val = e.target.value;
                      setDnsUrl(val);
                      storage.setString('dnsUrl', val);
                      showToast('Custom DNS Saved');
                    }}
                    style={{ background: '#262626', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', width: '100%' }}
                  />
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Enter a valid DNS-over-HTTPS URL.</div>
                </div>
              )}
            </div>

            {/* User Agent */}
            <div>
              <div style={{ marginBottom: '8px', color: '#fff' }}>User Agent</div>
              <select
                value={userAgents.some(ua => ua.value === userAgent) ? userAgent : 'custom'}
                onChange={(e) => {
                  const selected = userAgents.find(ua => ua.value === e.target.value);
                  if (selected && selected.value !== 'custom') {
                    setUserAgent(selected.value);
                    storage.setString('userAgent', selected.value);
                    showToast(`Applied: ${selected.name}`);
                  }
                }}
                style={{ background: '#262626', border: 'none', borderRadius: '8px', padding: '8px', color: '#fff', width: '100%' }}
              >
                {userAgents.map(ua => (
                  <option key={ua.value} value={ua.value}>{ua.name}</option>
                ))}
              </select>

              {(userAgent === 'custom' || (!userAgents.some(ua => ua.value === userAgent) && userAgent !== '')) && (
                <input
                  type="text"
                  placeholder="Enter custom User-Agent..."
                  defaultValue={userAgent}
                  onBlur={(e) => {
                    const val = e.target.value;
                    setUserAgent(val);
                    storage.setString('userAgent', val);
                    showToast('Custom UA Saved');
                  }}
                  style={{ background: '#262626', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', width: '100%', marginTop: '12px' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Player Settings */}
        <div className="section" style={{ marginBottom: '24px' }}>
          <div className="section-title" style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px', marginLeft: '8px' }}>Player</div>
          <div className="card" style={{ backgroundColor: '#1A1A1A', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Always Use External Player</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={openExternalPlayer}
                  onChange={(e) => updateBool('useExternalPlayer', setOpenExternalPlayer, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Media Controls</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showMediaControls}
                  onChange={(e) => updateBool('showMediaControls', setShowMediaControls, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #262626' }}>
              <span>Hide Seek Buttons</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideSeekButtons}
                  onChange={(e) => updateBool('hideSeekButtons', setHideSeekButtons, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
              <span>Enable Swipe Gestures</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={enableSwipeGesture}
                  onChange={(e) => updateBool('enableSwipeGesture', setEnableSwipeGesture, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Quality Settings */}
        <div className="section" style={{ marginBottom: '24px' }}>
          <div className="section-title" style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px', marginLeft: '8px' }}>Quality</div>
          <div className="card" style={{ backgroundColor: '#1A1A1A', borderRadius: '12px', padding: '16px' }}>
            <div style={{ marginBottom: '12px', color: '#fff' }}>Excluded Qualities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['360p', '480p', '720p'].map(quality => (
                <button
                  key={quality}
                  onClick={() => toggleQuality(quality)}
                  style={{
                    backgroundColor: excludedQualities.includes(quality) ? primary : '#262626',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar - uses themeStore for active color */}
      <Nav currentTab={currentTab} onTabChange={onNavigate} />
    </div>
  );
};

// --- CSS for toggle switch ---
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #767577;
    transition: 0.3s;
    border-radius: 34px;
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
  input:checked + .slider {
    background-color: #3b82f6;
  }
  input:checked + .slider:before {
    transform: translateX(24px);
  }
`;
document.head.appendChild(styleSheet);

export default Preferences;