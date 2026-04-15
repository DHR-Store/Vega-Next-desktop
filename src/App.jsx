// App.jsx (modified sections)
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useThemeStore from './lib/zustand/themeStore';
import NBoard from './nboard';  // ✅ import the new component

// Screen Imports (unchanged)
import Home from './screens/Home';
import Search from './screens/Search';
import SearchResults from './screens/SearchResults';
import Watchlist from './screens/Watchlist';
import Settings from './screens/settings/Setting';
import Extensions from './screens/Extensions';
import Info from './screens/Info'; 
import Player from './screens/Player';
import ScrollList from './screens/ScrollList';
import About from './screens/settings/About'; 
import Download from './screens/settings/Download'; 


const queryClient = new QueryClient();

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [lastMainTab, setLastMainTab] = useState('home');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false); // ✅ new state
  const primary = useThemeStore((state) => state.primary);

  // Check first-time user
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('vegaNextOnboarded');
    if (!hasOnboarded) {
      setShowOnboard(true);
    }
  }, []);

  // Apply theme color
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', primary);
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', primary);
  }, [primary]);

  const handleNavigate = (screen, item = null) => {
    setSelectedItem(item);
    if (['home', 'search', 'watchlist', 'settings'].includes(screen)) {
      setLastMainTab(screen);
    }
    setCurrentScreen(screen);
  };

  const handleOnboardClose = () => {
    setShowOnboard(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <style>
        {`
          * {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
          }
          input, textarea {
            user-select: text;
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
          }
        `}
      </style>

      {/* Onboarding overlay - only first time */}
      {showOnboard && <NBoard onClose={handleOnboardClose} />}

      {/* Existing screens - they will be rendered underneath but overlay blocks interaction */}
      {currentScreen === 'home' && <Home currentTab={currentScreen} onNavigate={handleNavigate} />}
      {currentScreen === 'search' && <Search currentTab={currentScreen} onNavigate={handleNavigate} />}
      {currentScreen === 'searchResults' && (
        <SearchResults 
          routeParams={selectedItem} 
          onNavigate={handleNavigate} 
          onBack={() => handleNavigate(lastMainTab)} 
          currentTab={lastMainTab}
        />
      )}
      {currentScreen === 'About' && <About onNavigate={handleNavigate} currentTab={currentScreen} />}
      {currentScreen === 'Download' && <Download onNavigate={handleNavigate} currentTab={currentScreen} />}
      {currentScreen === 'watchlist' && <Watchlist currentTab={currentScreen} onNavigate={handleNavigate} />}
      {currentScreen === 'settings' && <Settings currentTab={currentScreen} onNavigate={handleNavigate} />}
      {currentScreen === 'info' && (
        <Info 
          item={selectedItem} 
          routeParams={selectedItem} 
          onNavigate={handleNavigate} 
          onBack={() => handleNavigate(lastMainTab)} 
          currentTab={lastMainTab}
        />
      )}
      {currentScreen === 'extensions' && (
        <Extensions 
          currentTab={currentScreen} 
          onNavigate={handleNavigate} 
          onBack={() => handleNavigate(lastMainTab)} 
        />
      )}
      {currentScreen === 'scrollList' && (
        <ScrollList 
          routeParams={selectedItem} 
          onNavigate={handleNavigate} 
          onBack={() => handleNavigate(lastMainTab)} 
          currentTab={lastMainTab}
        />
      )}
      {currentScreen === 'player' && (
        <Player
          routeParams={selectedItem}
          onBack={() => {
            let infoParams = selectedItem;
            if (selectedItem?.seriesLink) {
              infoParams = {
                link: selectedItem.seriesLink,
                title: selectedItem.seriesTitle,
                provider: selectedItem.seriesProvider,
                poster: selectedItem.seriesPoster,
              };
            }
            handleNavigate('info', infoParams);
          }}
        />
      )}
    </QueryClientProvider>
  );
}

export default App;