// screens/Home.jsx
import React, { useState, useEffect } from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import { useHomePageData } from '../lib/hooks/useHomePageData';
import ProviderDrawer from '../components/ProviderDrawer';
import Hero from '../components/Hero';
import Nav from '../components/Nav';
import Slider from '../components/Slider';
import ContinueWatching from '../components/ContinueWatching';
import { Menu, Search, Cast, AlertCircle } from 'lucide-react';

const Home = ({ onNavigate, currentTab }) => {
  const { provider } = useContentStore();
  const primary = useThemeStore((state) => state.primary);
  const { data: listData, isLoading, error, refetch } = useHomePageData({ provider });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (listData) console.log("🏠 Home Data Loaded:", listData);
  }, [listData]);

  const safeListData = listData || [];
  const firstSection = safeListData[0] || {};
  const heroPosts = firstSection.Posts || firstSection.list || firstSection.posts || [];
  const heroItem = heroPosts[0] || {
    title: 'Loading Data...',
    image: 'https://placehold.co/1200x600/0a0a0a/333333?text=Fetching+Content...',
    year: '',
    language: ''
  };

  const providerName = provider?.display_name || provider?.name || 'No Provider';
  const providerVersion = provider?.version ? `v${provider.version}` : '';

  return (
    <div style={styles.container}>
      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
        body { overflow-x: hidden; margin: 0; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.iconButton} onClick={() => setIsDrawerOpen(true)}>
            <Menu size={24} />
          </button>
          <h1 style={styles.logo}>
            Vega
            <span style={styles.providerBadge}>
              {providerName} {providerVersion}
            </span>
          </h1>
        </div>
      </div>

      <div style={styles.mainContent}>
        <Hero
          item={heroItem}
          provider={provider}
          onNavigate={onNavigate}
          onPlay={(item) => onNavigate('player', { ...item, provider: provider?.value })}
          onInfo={(item) => onNavigate('info', { ...item, provider: provider?.value })}
        />

        {/* Continue Watching component inserted here */}
        <ContinueWatching onNavigate={onNavigate} />

        <div style={styles.listsContainer}>
          {isLoading ? (
            <div style={styles.loader}>
              <div style={{ ...styles.spinner, borderTopColor: primary }}></div>
              Loading Catalog...
            </div>
          ) : error ? (
            <div style={{ ...styles.errorBox, borderColor: `${primary}40` }}>
              <AlertCircle color={primary} size={40} />
              <h3 style={{ margin: '10px 0 5px 0', color: '#fff' }}>Failed to Load Data</h3>
              <p style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: '14px' }}>
                The provider might be blocked or currently down.
              </p>
              <button onClick={refetch} style={{ ...styles.retryBtn, backgroundColor: primary }}>
                Try Again
              </button>
            </div>
          ) : safeListData.length > 0 ? (
            safeListData.map((section, index) => {
              const postsArray = section.Posts || section.list || section.posts || [];
              if (postsArray.length === 0) return null;
              return (
                <Slider
                  key={`${section.title}-${index}`}
                  title={section.title || "Catalog"}
                  posts={postsArray}
                  filter={section.filter}
                  providerValue={provider?.value}
                  onNavigate={onNavigate}
                  isLoading={isLoading}
                />
              );
            })
          ) : (
            <div style={styles.emptyState}>
              <p>No content found for "{providerName}".</p>
            </div>
          )}
        </div>
      </div>

      <Nav currentTab={currentTab} onTabChange={(tab) => onNavigate(tab)} />
      <ProviderDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
};

const styles = {
  container: { height: '100vh', width: '100vw', backgroundColor: '#050505', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', position: 'relative' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)', zIndex: 10, pointerEvents: 'none' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px', pointerEvents: 'auto' },
  logo: { color: '#fff', fontSize: '22px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '1px' },
  providerBadge: { fontSize: '11px', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', fontWeight: '600', color: '#ccc', letterSpacing: '0.5px' },
  iconButton: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '50%', transition: 'background-color 0.2s' },
  mainContent: { flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: '80px' },
  listsContainer: { padding: '0 24px 24px 24px', marginTop: '-40px', position: 'relative', zIndex: 2, maxWidth: '1800px', margin: '-40px auto 0 auto' },
  loader: { textAlign: 'center', padding: '80px', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', fontSize: '16px' },
  spinner: { width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.1)', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  errorBox: { textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255, 77, 77, 0.05)', borderRadius: '12px', margin: '20px auto', maxWidth: '500px', border: '1px solid' },
  retryBtn: { padding: '10px 24px', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'opacity 0.2s' },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: '#666', fontSize: '16px' }
};

export default Home;