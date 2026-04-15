// components/ContinueWatching.jsx
import React, { useState, useEffect, useMemo } from 'react';
import useWatchHistoryStore from '../lib/zustand/watchHistoryStore';
import { mainStorage } from '../lib/storage/StorageService';
import useThemeStore from '../lib/zustand/themeStore';

const MovieCard = React.memo(({ item, progress, isSelected, selectionMode, primary, onPress, onLongPress }) => {
  const [imageUri, setImageUri] = useState(item?.poster);
  const [imageError, setImageError] = useState(false);

  const fetchImdbImage = async () => {
    if (!item.title) return;
    try {
      const query = item.title.toLowerCase().trim();
      const firstChar = query.charAt(0);
      const url = `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(query)}.json`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.d?.[0]?.i?.imageUrl) {
        setImageUri(data.d[0].i.imageUrl);
      }
    } catch (err) {
      console.warn('IMDb fetch error', err);
    }
  };

  useEffect(() => {
    if (!item.poster) fetchImdbImage();
  }, [item.poster, item.title]);

  return (
    <div
      onClick={onPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      style={styles.card}
    >
      <div style={styles.imageContainer}>
        <img
          src={imageUri || 'https://via.placeholder.com/100x150?text=No+Image'}
          alt={item.title}
          style={styles.poster}
          onError={() => {
            if (!imageError) {
              setImageError(true);
              fetchImdbImage();
            }
          }}
        />
        {selectionMode && (
          <div style={styles.checkboxContainer}>
            <div
              style={{
                ...styles.checkbox,
                backgroundColor: isSelected ? primary : 'rgba(255,255,255,0.3)',
                borderColor: '#fff',
              }}
            >
              {isSelected && <span style={styles.checkmark}>✓</span>}
            </div>
          </div>
        )}
        {isSelected && <div style={styles.selectionOverlay} />}
        {/* Progress bar at bottom */}
        <div style={styles.progressBarContainer}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: primary,
            }}
          />
        </div>
        {/* Percentage badge (only when 0 < progress < 100) */}
        {progress > 0 && progress < 100 && (
          <div style={styles.percentBadge}>
            <div
              style={{
                ...styles.percentFill,
                width: `${progress}%`,
                backgroundColor: `${primary}cc`,
              }}
            />
            <span style={styles.percentText}>{Math.round(progress)}%</span>
          </div>
        )}
      </div>
      <div style={styles.title}>{item.title}</div>
    </div>
  );
});

const ContinueWatching = ({ onNavigate }) => {
  const { primary } = useThemeStore((state) => state);
  const { history, removeItem } = useWatchHistoryStore((state) => state);
  const [progressData, setProgressData] = useState({});
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const recentItems = useMemo(() => {
    const seen = new Set();
    return history
      .filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      })
      .slice(0, 10);
  }, [history]);

  // Load progress percentages
  useEffect(() => {
    const loadProgress = () => {
      const map = {};
      recentItems.forEach((item) => {
        const key = `watch_history_progress_${item.link}`;
        const stored = mainStorage.getString(key);
        let percent = 0;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.percentage) percent = parsed.percentage;
            else if (parsed.currentTime && parsed.duration)
              percent = (parsed.currentTime / parsed.duration) * 100;
          } catch (e) {}
        } else if (item.currentTime && item.duration) {
          percent = (item.currentTime / item.duration) * 100;
        }
        map[item.link] = Math.min(100, Math.max(0, percent));
      });
      setProgressData(map);
    };
    loadProgress();
  }, [recentItems]);

  const toggleSelection = (link) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(link)) newSet.delete(link);
      else newSet.add(link);
      if (newSet.size === 0) setSelectionMode(false);
      return newSet;
    });
  };

  const handleLongPress = (link) => {
    if (!selectionMode) setSelectionMode(true);
    toggleSelection(link);
  };

  const handlePress = (item) => {
    if (selectionMode) {
      toggleSelection(item.link);
    } else {
      onNavigate('info', {
        link: item.link,
        provider: item.provider,
        poster: item.poster,
      });
    }
  };

  const deleteSelected = () => {
    recentItems.forEach((item) => {
      if (selectedItems.has(item.link)) removeItem(item);
    });
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  if (recentItems.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={{ ...styles.heading, color: primary }}>Continue Watching</h2>
        {selectionMode && selectedItems.size > 0 && (
          <div style={styles.selectionInfo}>
            <span>{selectedItems.size} selected</span>
            <button onClick={deleteSelected} style={styles.deleteBtn}>
              🗑️
            </button>
          </div>
        )}
      </div>
      <div style={styles.horizontalScroll}>
        {recentItems.map((item) => (
          <MovieCard
            key={item.link}
            item={item}
            progress={progressData[item.link] || 0}
            isSelected={selectedItems.has(item.link)}
            selectionMode={selectionMode}
            primary={primary}
            onPress={() => handlePress(item)}
            onLongPress={() => handleLongPress(item.link)}
          />
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: { margin: '24px 0 32px 0' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px 12px 24px',
  },
  heading: { fontSize: '24px', fontWeight: 'bold', margin: 0 },
  selectionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#fff',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
  },
  horizontalScroll: {
    display: 'flex',
    overflowX: 'auto',
    gap: '16px',
    padding: '0 24px',
    scrollbarWidth: 'thin',
  },
  card: { width: '100px', cursor: 'pointer', flexShrink: 0 },
  imageContainer: {
    position: 'relative',
    width: '100px',
    height: '150px',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  poster: { width: '100%', height: '100%', objectFit: 'cover' },
  checkboxContainer: { position: 'absolute', top: '8px', right: '8px', zIndex: 2 },
  checkbox: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '1px solid white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: 'white', fontSize: '12px', fontWeight: 'bold' },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressFill: { height: '100%', transition: 'width 0.2s' },
  percentBadge: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    width: '45px',
    height: '18px',
    borderRadius: '9px',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderLeft: `2px solid`, // primary color will be added inline
  },
  percentFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 0,
  },
  percentText: {
    position: 'relative',
    zIndex: 1,
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: '18px',
    display: 'block',
  },
  title: {
    color: '#fff',
    fontSize: '12px',
    textAlign: 'center',
    marginTop: '8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default ContinueWatching;