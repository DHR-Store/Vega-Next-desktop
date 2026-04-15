import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { providerManager } from '../lib/services/ProviderManager';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import Slider from '../components/Slider';
import Nav from '../components/Nav';

const SearchResults = ({ routeParams, onNavigate, currentTab }) => {
  const query = routeParams?.query || '';
  const { installedProviders } = useContentStore((state) => state);
  const primary = useThemeStore((state) => state.primary);
  const [results, setResults] = useState([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const queue = useRef([]);
  const hasLoadedFirstItem = useRef(false);
  const abortControllerRef = useRef(null);

  const categories = useMemo(() => {
    const cats = new Set();
    installedProviders.forEach(p => {
      const cat = p.category || 'Others';
      cats.add(cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase());
    });
    return ['All', ...Array.from(cats).sort()];
  }, [installedProviders]);

  useEffect(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const { signal } = abortController;

    let isMounted = true;
    setResults([]);
    queue.current = [];
    hasLoadedFirstItem.current = false;
    setLoadingCount(installedProviders.length);

    const flushInterval = setInterval(() => {
      if (queue.current.length > 0 && isMounted) {
        const batch = [...queue.current];
        queue.current = [];
        setResults(prev => [...prev, ...batch]);
      }
    }, 200);

    const fetchProvider = async (provider, idx) => {
      try {
        const posts = await providerManager.getSearchPosts({
          searchQuery: query,
          page: 1,
          providerValue: provider.value,
          signal,
        });
        if (signal.aborted || !isMounted) return;

        setLoadingCount(prev => Math.max(0, prev - 1));

        if (posts && posts.length > 0) {
          const category = provider.category || 'Others';
          const formattedCat = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
          const providerData = {
            id: `${provider.value}-${idx}`,
            title: provider.display_name || provider.name,
            providerValue: provider.value,
            category: formattedCat,
            posts: posts,
            filter: query,
          };
          if (!hasLoadedFirstItem.current) {
            hasLoadedFirstItem.current = true;
            setResults(prev => [...prev, providerData]);
          } else {
            queue.current.push(providerData);
          }
        }
      } catch (err) {
        if (!signal.aborted && isMounted) {
          setLoadingCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    const runSearch = async () => {
      const BATCH_SIZE = 4;
      const STAGGER_DELAY = 100;
      for (let i = 0; i < installedProviders.length; i += BATCH_SIZE) {
        if (signal.aborted) break;
        const batch = installedProviders.slice(i, i + BATCH_SIZE);
        batch.forEach((provider, idx) => fetchProvider(provider, i + idx));
        if (i + BATCH_SIZE < installedProviders.length) {
          await new Promise(r => setTimeout(r, STAGGER_DELAY));
        }
      }
    };

    runSearch();

    return () => {
      isMounted = false;
      clearInterval(flushInterval);
      abortController.abort();
    };
  }, [query, installedProviders]);

  const filteredResults = useMemo(() => {
    if (selectedCategory === 'All') return results;
    return results.filter(r => r.category === selectedCategory);
  }, [results, selectedCategory]);

  if (loadingCount > 0 && results.length === 0) {
    return (
      <div style={styles.center}>
        <Loader2 size={48} color={primary} style={styles.spinner} />
        <p style={{ marginTop: 16, color: '#aaa' }}>
          Searching {loadingCount} provider{loadingCount !== 1 ? 's' : ''} for "{query}"...
        </p>
      </div>
    );
  }

  if (loadingCount === 0 && results.length === 0) {
    return (
      <div style={styles.center}>
        <p>No results found for "{query}".</p>
        <button onClick={() => onNavigate('search')} style={{ ...styles.backButton, color: primary }}>
          ← New Search
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => onNavigate('search')} style={{ ...styles.backButton, color: primary }}>
          <ArrowLeft size={20} /> Back
        </button>
        <h2 style={styles.title}>
          Results for "{query}"
          {loadingCount > 0 && <span style={styles.badge}> ({loadingCount} left)</span>}
        </h2>
        {loadingCount > 0 && <Loader2 size={16} color={primary} style={styles.smallSpinner} />}
      </div>

      {categories.length > 1 && (
        <div style={styles.filterBar}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.filterChip,
                backgroundColor: selectedCategory === cat ? primary : '#1a1a1a',
                color: selectedCategory === cat ? '#fff' : '#aaa',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div style={styles.resultsContainer}>
        {filteredResults.map(provider => (
          <Slider
            key={provider.id}
            title={provider.title}
            posts={provider.posts}
            providerValue={provider.providerValue}
            onNavigate={onNavigate}
            isLoading={false}
            isSearch={true}
            filter={provider.filter}
          />
        ))}
      </div>

      <Nav currentTab={currentTab || 'search'} onTabChange={onNavigate} />
    </div>
  );
};

const styles = {
  container: { height: '100vh', backgroundColor: '#050505', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 },
  backButton: { background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' },
  title: { flex: 1, fontSize: '18px', fontWeight: 'normal', margin: 0 },
  badge: { fontSize: '12px', color: '#888', marginLeft: '8px' },
  smallSpinner: { animation: 'spin 1s linear infinite' },
  filterBar: { padding: '12px 20px', display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid #1a1a1a', flexShrink: 0 },
  filterChip: { padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  resultsContainer: { flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '32px' },
  center: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' },
  spinner: { animation: 'spin 1s linear infinite' },
};

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleSheet);
}

export default SearchResults;