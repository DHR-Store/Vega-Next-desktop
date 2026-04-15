import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search as SearchIcon, X, Clock, Trash2 } from 'lucide-react';
import Nav from '../components/Nav';
import useThemeStore from '../lib/zustand/themeStore';
import useSearchStore from '../lib/zustand/searchStore';

const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

const Search = ({ currentTab, onNavigate }) => {
  const primary = useThemeStore((state) => state.primary);
  const { history: searchHistory, addToHistory, removeHistoryItem, clearHistory } = useSearchStore();
  
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Execute search (navigate to results page)
  const performSearch = (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    addToHistory(trimmed);
    setShowDropdown(false);
    setInputValue('');
    onNavigate('searchResults', { query: trimmed });
  };

  // Fetch suggestions from TMDB
  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingSuggestions(true);
    try {
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();

      if (data.results && Array.isArray(data.results)) {
        const filtered = data.results
          .filter(item => item.media_type !== 'person' || item.known_for_department === 'Acting')
          .slice(0, 8);
        setSuggestions(filtered);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('TMDB suggestions error:', err);
      }
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Debounced input handler
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.searchSection} ref={containerRef}>
          <div style={styles.searchBar}>
            <SearchIcon size={20} color="#888" />
            <input
              type="text"
              placeholder="Search movies, TV shows, people..."
              style={styles.input}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && performSearch(inputValue)}
              onFocus={() => inputValue.trim() && suggestions.length > 0 && setShowDropdown(true)}
              autoFocus
            />
            {inputValue && (
              <X size={20} color="#888" style={{ cursor: 'pointer' }} onClick={() => setInputValue('')} />
            )}
          </div>
          <button 
            onClick={() => performSearch(inputValue)} 
            style={{ ...styles.searchButton, backgroundColor: primary }}
          >
            Search
          </button>

          {/* Suggestions Dropdown */}
          {showDropdown && (
            <div style={styles.dropdown}>
              {isLoadingSuggestions ? (
                <div style={styles.dropdownItem}>Loading...</div>
              ) : suggestions.length === 0 ? (
                <div style={styles.dropdownItem}>No suggestions</div>
              ) : (
                suggestions.map((item) => {
                  let title = item.title || item.name;
                  let year = '';
                  if (item.media_type === 'movie') year = item.release_date?.slice(0,4);
                  else if (item.media_type === 'tv') year = item.first_air_date?.slice(0,4);
                  const mediaLabel = item.media_type === 'movie' ? 'Movie' : item.media_type === 'tv' ? 'TV' : 'Person';
                  const imageUrl = item.poster_path || item.profile_path
                    ? `${TMDB_IMAGE_BASE}${item.poster_path || item.profile_path}`
                    : null;

                  return (
                    <div
                      key={item.id}
                      style={styles.suggestionItem}
                      onClick={() => performSearch(title)}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt={title} style={styles.suggestionImage} />
                      ) : (
                        <div style={styles.suggestionImagePlaceholder}>
                          <SearchIcon size={16} color="#666" />
                        </div>
                      )}
                      <div style={styles.suggestionInfo}>
                        <div style={styles.suggestionTitle}>{title}</div>
                        <div style={styles.suggestionMeta}>
                          <span style={{ ...styles.mediaBadge, backgroundColor: primary }}>{mediaLabel}</span>
                          {year && <span>{year}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </header>

      <main style={styles.content}>
        {searchHistory.length === 0 ? (
          <div style={styles.placeholder}>
            <p>🔍 Type a title and press Enter or click Search</p>
            <p style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>
              Your recent searches will appear here
            </p>
          </div>
        ) : (
          <div style={styles.historyContainer}>
            <div style={styles.historyHeader}>
              <h3 style={styles.historyTitle}>Recent Searches</h3>
              <button 
                onClick={clearHistory} 
                style={{ ...styles.clearHistoryBtn, color: primary }}
              >
                <Trash2 size={14} /> Clear All
              </button>
            </div>
            <div style={styles.historyList}>
              {searchHistory.map((item, idx) => (
                <div key={idx} style={styles.historyItem}>
                  <button
                    onClick={() => performSearch(item)}
                    style={styles.historyItemContent}
                  >
                    <Clock size={16} color={primary} />
                    <span style={styles.historyText}>{item}</span>
                  </button>
                  <button
                    onClick={() => removeHistoryItem(item)}
                    style={styles.removeHistoryBtn}
                  >
                    <X size={14} color="#888" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

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
  header: {
    padding: '20px',
    borderBottom: '1px solid #1a1a1a',
    flexShrink: 0,
  },
  searchSection: {
    position: 'relative',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#1a1a1a',
    padding: '10px 15px',
    borderRadius: '8px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    outline: 'none',
    fontSize: '16px',
  },
  searchButton: {
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    zIndex: 1000,
    maxHeight: '400px',
    overflowY: 'auto',
  },
  dropdownItem: {
    padding: '12px 16px',
    color: '#ccc',
    borderBottom: '1px solid #2a2a2a',
  },
  suggestionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #2a2a2a',
    transition: 'background 0.1s',
  },
  suggestionImage: {
    width: '40px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: '4px',
    backgroundColor: '#2a2a2a',
  },
  suggestionImagePlaceholder: {
    width: '40px',
    height: '60px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
    marginBottom: '4px',
  },
  suggestionMeta: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
    color: '#888',
  },
  mediaBadge: {
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  placeholder: {
    textAlign: 'center',
    color: '#888',
    marginTop: '40px',
  },
  historyContainer: {
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  historyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
  },
  clearHistoryBtn: {
    background: 'rgba(255,99,71,0.15)',
    border: 'none',
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    borderRadius: '8px',
    padding: '8px 12px',
    border: '1px solid #1a1a1a',
  },
  historyItemContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'left',
  },
  historyText: {
    color: '#fff',
    fontSize: '14px',
  },
  removeHistoryBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
  },
};

export default Search;