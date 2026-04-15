// screens/Watchlist.jsx
import React, { useState, useEffect, useCallback } from 'react';
import useWatchListStore from '../lib/zustand/watchListStore';
import useThemeStore from '../lib/zustand/themeStore';
import Nav from '../components/Nav';

// Helper: Base64 encode/decode for UTF-8 strings
const b64EncodeUnicode = (str) => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode('0x' + p1)
    ));
  } catch (e) {
    console.error('Encoding error:', e);
    return '';
  }
};

const b64DecodeUnicode = (str) => {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), (c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
  } catch (e) {
    console.error('Decoding error:', e);
    return null;
  }
};

const Watchlist = ({ onNavigate, currentTab }) => {
  const { primary } = useThemeStore((state) => state);
  const { watchList, removeItem, addToWatchList } = useWatchListStore((state) => state);
  const [selectedItems, setSelectedItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [importLink, setImportLink] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Responsive grid state
  const [numColumns, setNumColumns] = useState(4);
  const [itemWidth, setItemWidth] = useState(150);

  // Calculate grid layout based on window width
  useEffect(() => {
    const updateLayout = () => {
      const containerPadding = 24; // px
      const itemSpacing = 16; // px
      const minItemWidth = 130;
      const availableWidth = window.innerWidth - containerPadding * 2;
      let columns = Math.floor((availableWidth + itemSpacing) / (minItemWidth + itemSpacing));
      columns = Math.max(1, Math.min(columns, 6));
      const width = (availableWidth - itemSpacing * (columns - 1)) / columns;
      setNumColumns(columns);
      setItemWidth(width);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  // Toggle selection (right-click or long press)
  const toggleSelect = (item) => {
    const already = selectedItems.some(i => i.link === item.link);
    if (already) {
      setSelectedItems(selectedItems.filter(i => i.link !== item.link));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  // Handle right-click on item
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    toggleSelect(item);
  };

  // Normal click – if selection mode active, toggle; else navigate
  const handleItemClick = (item) => {
    if (selectedItems.length > 0) {
      toggleSelect(item);
    } else {
      onNavigate('info', {
        link: item.link,
        provider: item.provider,
        poster: item.poster,
      });
    }
  };

  // Share selected items
  const handleShare = async () => {
    if (selectedItems.length === 0) {
      alert('No items selected');
      return;
    }
    try {
      const jsonStr = JSON.stringify(selectedItems);
      const encoded = b64EncodeUnicode(jsonStr);
      const shareUrl = `${window.location.origin}/share?data=${encoded}`;
      // Use Web Share API if available, else copy to clipboard
      if (navigator.share) {
        await navigator.share({
          title: 'My Watchlist',
          text: 'Check out my Vega watchlist!',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Share link copied to clipboard');
      }
      setSelectedItems([]);
    } catch (err) {
      console.error('Share error:', err);
      alert('Failed to generate share link');
    }
  };

  // Import from shared link
  const importWatchlist = useCallback(async () => {
    if (!importLink.trim() || !importLink.includes('data=')) {
      alert('Invalid link – must contain ?data=...');
      return;
    }
    setIsImporting(true);
    try {
      const dataParam = importLink.split('data=')[1];
      if (!dataParam) throw new Error('No data parameter');
      const urlDecoded = decodeURIComponent(dataParam);
      const decoded = b64DecodeUnicode(urlDecoded);
      if (!decoded) throw new Error('Base64 decode failed');
      const items = JSON.parse(decoded);
      if (!Array.isArray(items)) throw new Error('Not an array');
      let importedCount = 0;
      for (const item of items) {
        if (!watchList.some(existing => existing.link === item.link)) {
          addToWatchList(item);
          importedCount++;
        }
      }
      alert(importedCount ? `✅ Imported ${importedCount} items` : 'All items already in watchlist');
      setModalVisible(false);
      setImportLink('');
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import. Link may be corrupted.');
    } finally {
      setIsImporting(false);
    }
  }, [importLink, watchList, addToWatchList]);

  // Clear selection
  const cancelSelection = () => setSelectedItems([]);

  return (
    <div style={styles.container}>
      {/* Selection Toolbar */}
      {selectedItems.length > 0 && (
        <div style={{ ...styles.selectionBar, backgroundColor: '#111' }}>
          <button onClick={cancelSelection} style={styles.cancelBtn}>Cancel</button>
          <span style={{ color: primary, fontWeight: 'bold' }}>{selectedItems.length} selected</span>
          <button onClick={handleShare} style={styles.shareBtn}>
            <span role="img" aria-label="share">📤</span> Share
          </button>
        </div>
      )}

      <div style={styles.content}>
        <h1 style={{ ...styles.title, color: primary }}>My Watchlist</h1>

        {watchList.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: '64px' }}>📭</span>
            <p>Your watchlist is empty</p>
            <button onClick={() => onNavigate('home')} style={{ ...styles.addBtn, backgroundColor: primary }}>
              Browse Content
            </button>
          </div>
        ) : (
          <div style={styles.gridContainer}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
                gap: '16px',
                width: '100%',
              }}
            >
              {watchList.map((item) => {
                const isSelected = selectedItems.some(i => i.link === item.link);
                return (
                  <div
                    key={item.link}
                    onClick={() => handleItemClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    style={{
                      ...styles.card,
                      border: isSelected ? `2px solid ${primary}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={styles.imageWrapper}>
                      <img
                        src={item.poster || 'https://via.placeholder.com/200x300?text=No+Image'}
                        alt={item.title}
                        style={styles.poster}
                      />
                      {isSelected && <div style={styles.selectedOverlay} />}
                    </div>
                    <div style={styles.cardTitle}>{item.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Import Button */}
        <button
          onClick={() => setModalVisible(true)}
          style={{ ...styles.fab, backgroundColor: primary }}
        >
          📥
        </button>
      </div>

      {/* Import Modal */}
      {modalVisible && (
        <div style={styles.modalOverlay} onClick={() => setModalVisible(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: primary }}>Import Watchlist</h3>
            <input
              type="text"
              placeholder="Paste share link here..."
              value={importLink}
              onChange={(e) => setImportLink(e.target.value)}
              style={styles.input}
            />
            <div style={styles.modalButtons}>
              <button onClick={importWatchlist} disabled={isImporting} style={styles.importBtn}>
                {isImporting ? 'Importing...' : 'Import'}
              </button>
              <button onClick={() => setModalVisible(false)} style={styles.cancelModalBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Nav currentTab={currentTab} onTabChange={(tab) => onNavigate(tab)} />
    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    backgroundColor: '#050505',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  selectionBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    zIndex: 20,
    borderBottom: '1px solid #333',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
  },
  shareBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px 80px 24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '24px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: '16px',
    color: '#aaa',
  },
  addBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '30px',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  gridContainer: {
    width: '100%',
  },
  card: {
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'transform 0.2s',
  },
  imageWrapper: {
    position: 'relative',
    aspectRatio: '2/3',
    backgroundColor: '#1a1a1a',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    border: '2px solid',
    borderRadius: '8px',
  },
  cardTitle: {
    textAlign: 'center',
    fontSize: '13px',
    marginTop: '8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0 4px',
  },
  fab: {
    position: 'fixed',
    bottom: '80px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    padding: '24px',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '450px',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '12px',
    margin: '16px 0',
    backgroundColor: '#333',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  importBtn: {
    backgroundColor: '#e50914',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  cancelModalBtn: {
    backgroundColor: '#555',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default Watchlist;