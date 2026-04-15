import React, { useState, useEffect } from 'react';

// --- localStorage helpers ---
const storage = {
  getDisabledProviders: () => {
    const val = localStorage.getItem('disabledProviders');
    return val ? JSON.parse(val) : [];
  },
  setDisabledProviders: (list) => localStorage.setItem('disabledProviders', JSON.stringify(list)),
  toggleProvider: (providerId) => {
    const current = storage.getDisabledProviders();
    let updated;
    if (current.includes(providerId)) {
      updated = current.filter(id => id !== providerId);
    } else {
      updated = [...current, providerId];
    }
    storage.setDisabledProviders(updated);
    return updated;
  },
  enableAllProviders: () => storage.setDisabledProviders([]),
};

// --- Provider list (same as your constants) ---
const providersList = [
  { value: 'provider1', name: 'Provider 1', flag: '🇺🇸', type: 'Movies' },
  { value: 'provider2', name: 'Provider 2', flag: '🇬🇧', type: 'Series' },
  { value: 'provider3', name: 'Provider 3', flag: '🇮🇳', type: 'Anime' },
  // add more as needed
];

const DisableProviders = () => {
  const [disabledProviders, setDisabledProviders] = useState([]);

  useEffect(() => {
    setDisabledProviders(storage.getDisabledProviders());
  }, []);

  const toggleProvider = (providerId) => {
    const newDisabled = storage.toggleProvider(providerId);
    setDisabledProviders([...newDisabled]);
  };

  const enableAll = () => {
    storage.enableAllProviders();
    setDisabledProviders([]);
  };

  // Simple toast
  const showToast = (msg) => {
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      background: '#333', color: '#fff', padding: '8px 16px', borderRadius: '8px', zIndex: 2000
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  return (
    <div style={{ backgroundColor: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', margin: 0 }}>Disable Providers</h2>
        <button
          onClick={enableAll}
          style={{ background: '#262626', border: 'none', padding: '8px 16px', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
        >
          Enable All
        </button>
      </div>

      <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>
        Disabled providers won't appear in search results
      </div>

      <div style={{ backgroundColor: '#1A1A1A', borderRadius: '12px', overflow: 'hidden' }}>
        {providersList.map((provider, index) => {
          const isEnabled = !disabledProviders.includes(provider.value);
          return (
            <div
              key={provider.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: index !== providersList.length - 1 ? '1px solid #262626' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#262626', padding: '8px', borderRadius: '8px', fontSize: '24px' }}>
                  {provider.flag}
                </div>
                <div>
                  <div style={{ fontWeight: '500' }}>{provider.name}</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>{provider.type || 'Content Provider'}</div>
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleProvider(provider.value)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '16px' }}>
        Changes will apply to new searches
      </div>
    </div>
  );
};

// Inject switch CSS (same as before)
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

export default DisableProviders;