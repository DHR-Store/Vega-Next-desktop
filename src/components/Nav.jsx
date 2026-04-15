import React from 'react';
import { Home, Search, Bookmark, Settings } from 'lucide-react';
import useThemeStore from '../lib/zustand/themeStore';

const Nav = ({ currentTab, onTabChange }) => {
  const primary = useThemeStore((state) => state.primary);

  return (
    <nav style={styles.navbar}>
      <button 
        style={{ ...styles.navButton, color: currentTab === 'home' ? primary : '#888' }}
        onClick={() => onTabChange('home')}
      >
        <Home size={24} />
        <span style={styles.navLabel}>Home</span>
      </button>

      <button 
        style={{ ...styles.navButton, color: currentTab === 'search' ? primary : '#888' }}
        onClick={() => onTabChange('search')}
      >
        <Search size={24} />
        <span style={styles.navLabel}>Search</span>
      </button>

      <button 
        style={{ ...styles.navButton, color: currentTab === 'watchlist' ? primary : '#888' }}
        onClick={() => onTabChange('watchlist')}
      >
        <Bookmark size={24} />
        <span style={styles.navLabel}>Watchlist</span>
      </button>

      <button 
        style={{ ...styles.navButton, color: currentTab === 'settings' ? primary : '#888' }}
        onClick={() => onTabChange('settings')}
      >
        <Settings size={24} />
        <span style={styles.navLabel}>Settings</span>
      </button>
    </nav>
  );
};

const styles = {
  navbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65px',
    backgroundColor: '#0a0a0a',
    borderTop: '1px solid #1a1a1a',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 50,
  },
  navButton: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  navLabel: {
    fontSize: '10px',
    fontWeight: '500',
  }
};

export default Nav;