import React, { useState, useEffect, useRef } from 'react';
import { Play, Plus, Check, Info, Search, X } from 'lucide-react';
import useThemeStore from '../lib/zustand/themeStore';

const Hero = ({ 
  item, 
  items: propItems,           // NEW: array of items for auto-rotation
  autoRotateInterval = 60000, // NEW: interval in ms (default 1 minute)
  onPlay, 
  onInfo,
  provider = { display_name: 'Netflix', value: 'netflix_id' }, 
  onNavigate 
}) => {
  const primary = useThemeStore((state) => state.primary);
  const [isSaved, setIsSaved] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-rotate logic: enable only if propItems is provided and has more than 1 item
  const autoRotateEnabled = Array.isArray(propItems) && propItems.length > 1;
  const [autoItem, setAutoItem] = useState(autoRotateEnabled && propItems.length > 0 ? propItems[0] : null);
  
  // Interval reference for cleanup
  const intervalRef = useRef(null);

  // Determine which item to display (auto-rotated or static prop)
  const displayItem = autoRotateEnabled ? autoItem : item;

  // Update autoItem when propItems changes (new array reference)
  useEffect(() => {
    if (autoRotateEnabled && propItems.length > 0) {
      setAutoItem(propItems[0]);
      // Reset saved status when items list changes
      setIsSaved(false);
    }
  }, [propItems, autoRotateEnabled]);

  // Set up auto-rotation interval
  useEffect(() => {
    if (!autoRotateEnabled) return;
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Start new interval
    intervalRef.current = setInterval(() => {
      // Pick a random item different from current if possible, otherwise any random
      let newIndex;
      if (propItems.length > 1 && autoItem) {
        let currentIndex = propItems.findIndex(i => i === autoItem);
        if (currentIndex === -1) currentIndex = 0;
        do {
          newIndex = Math.floor(Math.random() * propItems.length);
        } while (propItems.length > 1 && newIndex === currentIndex);
      } else {
        newIndex = Math.floor(Math.random() * propItems.length);
      }
      
      setAutoItem(propItems[newIndex]);
      // Reset "My List" saved state for the new item
      setIsSaved(false);
    }, autoRotateInterval);
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRotateEnabled, propItems, autoItem, autoRotateInterval]);

  // If no displayItem (loading or no data), show skeleton
  if (!displayItem) return <div style={styles.skeletonHero}></div>;

  const title = displayItem.name || displayItem.title || 'Unknown Title';
  const logo = displayItem.logo;
  const bgImage = displayItem.background || displayItem.image;
  const posterImage = displayItem.poster || displayItem.image;
  const year = displayItem.releaseInfo || displayItem.year || '2024';
  const genres = Array.isArray(displayItem.genre) ? displayItem.genre.slice(0, 2) : [];

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      const text = searchQuery.trim();
      if (!text) return;

      if (text.startsWith('https://')) {
        console.log(`Navigating directly to link: ${text}`);
        if (onNavigate) {
          onNavigate('info', { link: text, provider: provider.value });
        }
      } else {
        console.log(`Searching for "${text}" in provider: ${provider.value}`);
        if (onNavigate) {
          onNavigate('scrollList', {
            providerValue: provider.value,
            filter: text,
            title: provider.display_name,
            isSearch: true,
          });
        }
      }
      
      setIsSearchActive(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <style>
        {`
          @media (max-width: 768px) {
            .hero-content-wrapper { flex-direction: column !important; align-items: center !important; gap: 32px !important; padding: 20px 5% 40px !important; }
            .hero-left-content { margin-right: 0 !important; width: 100% !important; max-width: 100% !important; text-align: center !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
            .hero-right-content { margin-top: 0 !important; }
            .hero-metadata-row { justify-content: center !important; }
            .hero-button-row { justify-content: center !important; flex-wrap: wrap !important; }
            .hero-logo { max-width: 140px !important; }
            .hero-title { font-size: 28px !important; text-align: center !important; }
          }
          @media (max-width: 480px) {
            .hero-button-row { gap: 20px !important; }
            .hero-poster-card { width: 130px !important; height: 195px !important; }
          }
          .search-icon-btn:hover {
            background-color: ${primary} !important;
          }
        `}
      </style>
      
      <div style={{ ...styles.heroContainer, backgroundImage: `url(${bgImage})` }}>
        <div style={styles.leftGradient} />
        <div style={styles.bottomGradient} />

        <div style={styles.topRightControls}>
          {isSearchActive ? (
            <div style={styles.searchBarWrapper}>
              <Search size={20} color="#aaa" />
              <input
                autoFocus
                type="text"
                placeholder={`Search in ${provider.display_name}...`}
                style={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
              />
              <button style={styles.clearButton} onClick={() => setIsSearchActive(false)}>
                <X size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <button 
              className="search-icon-btn"
              style={{ ...styles.searchIconBtn, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
              onClick={() => setIsSearchActive(true)}
            >
              <Search size={24} color="#fff" />
            </button>
          )}
        </div>

        <div className="hero-content-wrapper" style={styles.contentWrapper}>
          <div className="hero-left-content" style={styles.leftContent}>
            {logo ? (
              <img src={logo} alt="logo" className="hero-logo" style={styles.logo} />
            ) : (
              <h1 className="hero-title" style={styles.title}>{title}</h1>
            )}

            <div className="hero-metadata-row" style={styles.metadataRow}>
              <span style={{ ...styles.yearBadge, borderColor: primary, color: primary }}>{year}</span>
              {genres.map((g, i) => (
                <span key={i} style={styles.genresText}>{i > 0 && " • "}{g}</span>
              ))}
            </div>

            <div className="hero-button-row" style={styles.buttonRow}>
              <button style={styles.playButton} onClick={() => onPlay && onPlay(displayItem)}>
                <Play size={14} fill="black" />
                <span>PLAY</span>
              </button>

              <button style={styles.iconButton} onClick={() => setIsSaved(!isSaved)}>
                {isSaved ? <Check size={18} /> : <Plus size={18} />}
                <span style={styles.iconLabel}>MY LIST</span>
              </button>

              <button style={styles.iconButton} onClick={() => onInfo && onInfo(displayItem)}>
                <Info size={18} />
                <span style={styles.iconLabel}>INFO</span>
              </button>
            </div>
          </div>

          <div className="hero-right-content" style={styles.rightContent}>
            <div className="hero-poster-card" style={styles.posterCard}>
              <img src={posterImage} alt={title} style={styles.posterImage} />
              <div style={{ ...styles.posterBadge, borderTop: `2px solid ${primary}` }}>
                <span style={{ ...styles.badgeText, color: primary }}>FEATURED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const styles = {
  heroContainer: { height: '62vh', width: '100%', backgroundColor: '#050505', backgroundSize: 'cover', backgroundPosition: 'center 20%', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', fontFamily: 'sans-serif' },
  skeletonHero: { height: '62vh', width: '100%', backgroundColor: '#111' },
  leftGradient: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)', zIndex: 1 },
  bottomGradient: { position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #050505 0%, rgba(5,5,5,0.8) 25%, transparent 100%)', zIndex: 2 },
  topRightControls: { position: 'absolute', top: '20px', right: '5%', zIndex: 10, display: 'flex', alignItems: 'center' },
  searchIconBtn: { border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' },
  searchBarWrapper: { display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '24px', padding: '6px 12px', width: '250px', backdropFilter: 'blur(10px)' },
  searchInput: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '8px', flex: 1, fontSize: '14px' },
  clearButton: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  contentWrapper: { width: '100%', zIndex: 3, padding: '0 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '32px', marginTop: '40px' },
  leftContent: { flex: 1, minWidth: 0, maxWidth: '600px', marginRight: '24px' },
  logo: { width: '160px', height: 'auto', marginBottom: '12px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' },
  title: { fontSize: '32px', fontWeight: '900', color: '#fff', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '-1px', lineHeight: 1.2, wordBreak: 'break-word' },
  metadataRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  yearBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', border: '1px solid', whiteSpace: 'nowrap' },
  genresText: { fontSize: '11px', color: '#aaa', fontWeight: '500', whiteSpace: 'nowrap' },
  buttonRow: { display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' },
  playButton: { backgroundColor: '#fff', color: '#000', border: 'none', padding: '8px 24px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', transition: 'transform 0.1s ease' },
  iconButton: { background: 'none', border: 'none', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0, transition: 'opacity 0.2s ease' },
  iconLabel: { fontSize: '8px', fontWeight: '700', letterSpacing: '0.5px' },
  rightContent: { flexShrink: 0 },
  posterCard: { width: '150px', height: '225px', position: 'relative', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 35px rgba(0,0,0,0.8)', border: '0.5px solid rgba(255,255,255,0.25)', transition: 'transform 0.2s ease' },
  posterImage: { width: '100%', height: '100%', objectFit: 'cover' },
  posterBadge: { position: 'absolute', bottom: 0, width: '100%', padding: '20px 5px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', display: 'flex', justifyContent: 'center' },
  badgeText: { fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }
};

export default Hero;