// screens/WatchHistory.jsx
import React, { useEffect, useState } from 'react';
import useWatchHistoryStore from '../lib/zustand/watchHistoryStore';
import useThemeStore from '../lib/zustand/themeStore';
import { mainStorage } from '../lib/storage/StorageService';

const WatchHistory = ({ onNavigate }) => {
  const { primary } = useThemeStore((state) => state);
  const { history, clearHistory } = useWatchHistoryStore((state) => state);
  const [progressData, setProgressData] = useState({});

  // Remove duplicates by link
  const uniqueHistory = React.useMemo(() => {
    const seen = new Set();
    return history.filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });
  }, [history]);

  // Load progress percentages
  useEffect(() => {
    const loadProgress = () => {
      const map = {};
      uniqueHistory.forEach((item) => {
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
  }, [uniqueHistory]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Watch History</h1>
        {uniqueHistory.length > 0 && (
          <button onClick={clearHistory} style={styles.clearBtn}>
            Clear all
          </button>
        )}
      </div>

      {uniqueHistory.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: '48px' }}>📜</span>
          <p>No watch history</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {uniqueHistory.map((item) => {
            const progress = progressData[item.link] || 0;
            const isWatched = progress >= 100;
            return (
              <div
                key={item.link}
                style={styles.gridItem}
                onClick={() =>
                  onNavigate('info', {
                    link: item.link,
                    provider: item.provider,
                    poster: item.poster,
                  })
                }
              >
                <div style={styles.imageWrapper}>
                  <img
                    src={
                      item.poster ||
                      'https://via.placeholder.com/200x300?text=No+Image'
                    }
                    alt={item.title}
                    style={styles.poster}
                  />
                  {/* Progress bar at bottom */}
                  <div style={styles.progressBarBg}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${progress}%`,
                        backgroundColor: primary,
                      }}
                    />
                  </div>

                  {/* Percentage badge (0 < progress < 100) */}
                  {progress > 0 && progress < 100 && (
                    <div style={styles.percentBadge}>
                      <div
                        style={{
                          ...styles.percentFill,
                          width: `${progress}%`,
                          backgroundColor: `${primary}cc`,
                        }}
                      />
                      <span style={styles.percentText}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                  )}

                  {/* Watched badge (progress >= 100) */}
                  {isWatched && (
                    <div style={styles.watchedBadge}>
                      <span>✓</span>
                    </div>
                  )}
                </div>
                <div style={styles.itemTitle}>{item.title}</div>
                {item.episodeTitle && (
                  <div style={styles.episodeTitle}>{item.episodeTitle}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#050505',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  title: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: 'bold',
    margin: 0,
  },
  clearBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '20px',
    color: '#fff',
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    marginTop: '80px',
    color: '#aaa',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '20px',
  },
  gridItem: { cursor: 'pointer' },
  imageWrapper: {
    position: 'relative',
    borderRadius: '8px',
    overflow: 'hidden',
    aspectRatio: '2/3',
    backgroundColor: '#1a1a1a',
  },
  poster: { width: '100%', height: '100%', objectFit: 'cover' },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  progressFill: { height: '100%' },
  percentBadge: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    width: '45px',
    height: '18px',
    borderRadius: '9px',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderLeft: `2px solid`, // primary color added dynamically
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
  watchedBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: '20px',
    padding: '4px 6px',
    border: `1px solid`, // primary color added dynamically
    fontSize: '14px',
    color: '#fff',
  },
  itemTitle: {
    color: '#fff',
    marginTop: '8px',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'center',
  },
  episodeTitle: {
    color: '#aaa',
    fontSize: '12px',
    textAlign: 'center',
  },
};

export default WatchHistory;