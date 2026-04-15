import React from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import { CheckCircle2, X } from 'lucide-react';

const ProviderDrawer = ({ isOpen, onClose }) => {
  const { provider, setProvider, installedProviders } = useContentStore();
  const primary = useThemeStore((state) => state.primary);

  return (
    <>
      {/* Background Overlay */}
      {isOpen && <div style={styles.overlay} onClick={onClose} />}

      {/* Drawer */}
      <div style={{ ...styles.drawer, right: isOpen ? 0 : '-350px' }}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Select Provider</h2>
            <p style={styles.subtitle}>Choose your content source</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div style={styles.list}>
          {installedProviders.map((item) => {
            const isActive = provider?.value === item.value;
            const displayName = item.display_name || item.name || 'Unknown Provider';
            const version = item.version ? `v${item.version}` : '';

            return (
              <div
                key={item.value}
                onClick={() => {
                  setProvider(item);
                  onClose();
                }}
                style={{
                  ...styles.providerItem,
                  borderColor: isActive ? primary : '#333',
                  backgroundColor: isActive ? `${primary}1A` : '#1a1a1a', // 10% opacity (1A in hex)
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Provider Icon or Fallback */}
                  {item.icon ? (
                    <img
                      src={item.icon}
                      alt={displayName}
                      style={styles.iconImage}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      ...styles.iconFallback,
                      backgroundColor: isActive ? primary : '#333',
                      display: item.icon ? 'none' : 'flex',
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div style={styles.itemName}>{displayName}</div>
                    {version && <div style={styles.itemVersion}>{version}</div>}
                  </div>
                </div>
                {isActive && <CheckCircle2 size={20} color={primary} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  drawer: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    width: '320px',
    backgroundColor: '#0f0f0f',
    borderLeft: '1px solid #222',
    transition: 'right 0.3s ease',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #222',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: '18px',
    margin: 0,
  },
  subtitle: {
    color: '#888',
    fontSize: '12px',
    margin: '4px 0 0 0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  list: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  providerItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  iconImage: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    objectFit: 'cover',
    backgroundColor: '#222',
  },
  iconFallback: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  itemName: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: '500',
  },
  itemVersion: {
    color: '#888',
    fontSize: '12px',
    marginTop: '2px',
  },
};

export default ProviderDrawer;