import React, { useEffect, useState, useRef, useCallback } from 'react';
import { providerManager } from '../lib/services/ProviderManager';
import { ChevronLeft, Grid, List as ListIcon, Loader2 } from 'lucide-react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import Nav from '../components/Nav';

const ScrollList = ({ routeParams, onNavigate, onBack, currentTab }) => {
  const { filter, providerValue, isSearch = false } = routeParams || {};
  const activeProvider = useContentStore(state => state.provider);
  const actualProvider = providerValue || activeProvider?.value;
  const primary = useThemeStore(state => state.primary);

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewType, setViewType] = useState(1); // 1 = Grid, 2 = List

  const abortControllerRef = useRef(null);
  const observer = useRef();
  const lastElementRef = useCallback((node) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((prevPage) => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);

  // Reset when filter or provider changes
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
  }, [filter, actualProvider, isSearch]);

  // Fetch data
  useEffect(() => {
    let isMounted = true;
    if (!actualProvider) return;

    const fetchPosts = async () => {
      setIsLoading(true);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const { signal } = abortController;

      try {
        let newPosts;
        if (isSearch) {
          newPosts = await providerManager.getSearchPosts({
            searchQuery: filter,
            page,
            providerValue: actualProvider,
            signal
          });
        } else {
          newPosts = await providerManager.getPosts({
            filter,
            page,
            providerValue: actualProvider,
            signal
          });
        }

        if (signal.aborted || !isMounted) return;

        if (!newPosts || newPosts.length === 0) {
          setHasMore(false);
        } else {
          setPosts((prev) => {
            if (page === 1) return newPosts;
            const existingLinks = new Set(prev.map(p => p.link));
            const uniqueNewPosts = newPosts.filter(p => !existingLinks.has(p.link));
            return [...prev, ...uniqueNewPosts];
          });
        }
      } catch (error) {
        if (!signal.aborted && isMounted) {
          console.error('[ScrollList] Failed to fetch posts:', error);
          setHasMore(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPosts();

    return () => {
      isMounted = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [filter, actualProvider, page, isSearch]);

  const handleItemClick = (item) => {
    onNavigate('info', {
      link: item.link,
      providerValue: item.provider || actualProvider,
      poster: item.image,
    });
  };

  // Helper to format string like "Category/web-series/netflix/" into "Netflix"
  const formatTitle = (rawText) => {
    if (!rawText) return 'Catalog';
    // Split by '/', remove empty strings (from trailing slashes), and get the last part
    const lastPart = rawText.split('/').filter(Boolean).pop();
    // Replace hyphens/underscores with spaces and capitalize each word
    return lastPart
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onBack} style={styles.iconButton}>
            <ChevronLeft size={28} color="#fff" />
          </button>
          <h1 style={{ ...styles.title, color: primary }}>
            {formatTitle(filter)}
          </h1>
        </div>
        <button onClick={() => setViewType(viewType === 1 ? 2 : 1)} style={styles.iconButton}>
          {viewType === 1 ? <ListIcon size={24} color="#fff" /> : <Grid size={24} color="#fff" />}
        </button>
      </header>

      <main style={styles.scrollArea}>
        {posts.length === 0 && !isLoading ? (
          <div style={styles.centerContainer}>
            <p style={{ color: '#888', fontSize: '18px' }}>No Content Found</p>
          </div>
        ) : (
          <div style={viewType === 1 ? styles.gridContainer : styles.listContainer}>
            {posts.map((item, index) => {
              const isLastElement = posts.length === index + 1;
              return (
                <div
                  key={`${item.link}-${index}`}
                  ref={isLastElement ? lastElementRef : null}
                  style={viewType === 1 ? styles.gridCard : styles.listCard}
                  onClick={() => handleItemClick(item)}
                >
                  <img
                    src={item.image || 'https://placehold.jp/24/363636/ffffff/150x225.png?text=No+Image'}
                    alt={item.title}
                    style={viewType === 1 ? styles.gridImage : styles.listImage}
                    onError={(e) => { e.target.src = 'https://placehold.jp/24/363636/ffffff/150x225.png?text=Error'; }}
                  />
                  <div style={styles.titleContainer}>
                    <p style={viewType === 1 ? styles.gridTitle : { ...styles.listTitle, color: primary }}>
                      {item.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
            <Loader2 size={32} color={primary} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </main>

      <Nav currentTab={currentTab} onTabChange={onNavigate} />
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
  },
  header: {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderBottom: '1px solid #222',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    paddingBottom: '85px', // space for nav bar
  },
  centerContainer: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '15px',
  },
  gridCard: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s',
  },
  gridImage: {
    width: '100%',
    aspectRatio: '2/3',
    objectFit: 'cover',
    borderRadius: '8px',
    backgroundColor: '#1a1a1a',
  },
  gridTitle: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#ccc',
    textAlign: 'center',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  listCard: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: '8px',
    padding: '10px',
    transition: 'background-color 0.2s',
  },
  listImage: {
    width: '80px',
    aspectRatio: '2/3',
    objectFit: 'cover',
    borderRadius: '6px',
    backgroundColor: '#1a1a1a',
  },
  titleContainer: {
    flex: 1,
    paddingLeft: '15px',
  },
  listTitle: {
    fontSize: '16px',
    fontWeight: '500',
    margin: 0,
  },
};

// Add keyframes for spinner animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default ScrollList;