import React, { useEffect, useState } from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import { extensionManager } from '../lib/services/ExtensionManager';
import { Download, Trash2, Loader2, ArrowLeft, Search, Plus, Database, Blocks, X } from 'lucide-react';
import Nav from '../components/Nav';

const Extensions = ({ onBack, onNavigate, currentTab }) => {
  const { installedProviders, installProvider, uninstallProvider } = useContentStore();
  const primary = useThemeStore((state) => state.primary);
  
  const [activeTab, setActiveTab] = useState('extensions');
  const [availableProviders, setAvailableProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installingTarget, setInstallingTarget] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeRepo, setActiveRepo] = useState('All');
  
  const [repos, setRepos] = useState([]);
  const [newRepoInput, setNewRepoInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      setRepos(extensionManager.getRepos());
      const data = await extensionManager.fetchManifest();
      setAvailableProviders(data || []);
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInstall = async (provider) => {
    setInstallingTarget(provider.value);
    const success = await extensionManager.installExtension(provider);
    if (success) {
      installProvider(provider);
    } else {
      alert("Failed to download provider script. Please check your internet connection or the repository source.");
    }
    setInstallingTarget(null);
  };

  const handleAddRepo = (e) => {
    if (e) e.preventDefault();
    if (!newRepoInput.trim()) return;
    
    const added = extensionManager.addRepo(newRepoInput);
    if (added) {
      setNewRepoInput('');
      loadData();
    } else {
      alert("Repository already exists or format is invalid. Use 'owner/repo'.");
    }
  };

  const handleRemoveRepo = (repoPath) => {
    if (window.confirm(`Remove repository ${repoPath}?`)) {
      extensionManager.removeRepo(repoPath);
      if (activeRepo === repoPath) setActiveRepo('All');
      loadData();
    }
  };

  const categories = ['All', ...new Set(availableProviders.map(p => p.category).filter(Boolean))];

  const filteredProviders = availableProviders.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesRepo = activeRepo === 'All' || p.repo === activeRepo;
    return matchesSearch && matchesCategory && matchesRepo;
  });

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; }
          .hide-scroll::-webkit-scrollbar { display: none; }
          .repo-card:hover { border-color: ${primary} !important; }
        `}
      </style>

      <header style={styles.header}>
        <div style={styles.headerTop}>
          <button style={styles.iconBtn} onClick={onBack}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <h1 style={styles.title}>Extensions</h1>
        </div>
        
        <div style={styles.tabs}>
          <button 
            style={{...styles.tab, ...(activeTab === 'extensions' ? {...styles.activeTab, borderBottomColor: primary, color: primary} : {})}} 
            onClick={() => setActiveTab('extensions')}
          >
            <Blocks size={18} /> Browse
          </button>
          <button 
            style={{...styles.tab, ...(activeTab === 'repos' ? {...styles.activeTab, borderBottomColor: primary, color: primary} : {})}} 
            onClick={() => setActiveTab('repos')}
          >
            <Database size={18} /> Sources
          </button>
        </div>
      </header>

      <div style={styles.content}>
        {loading ? (
          <div style={styles.center}>
            <Loader2 className="spin" size={32} color={primary} />
            <span style={{marginTop: 10, color: '#888'}}>Syncing repositories...</span>
          </div>
        ) : activeTab === 'extensions' ? (
          <>
            <div style={styles.searchContainer}>
              <Search size={18} color="#888" style={{marginLeft: 12}}/>
              <input 
                style={styles.searchInput}
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {activeRepo !== 'All' && (
              <div style={styles.repoFilterBanner}>
                <span>Showing source: <strong>{activeRepo}</strong></span>
                <button 
                  style={{...styles.clearFilterBtn, color: primary}} 
                  onClick={() => setActiveRepo('All')}
                >
                  <X size={16} /> Clear
                </button>
              </div>
            )}

            <div style={styles.categoryScroll} className="hide-scroll">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  style={{...styles.categoryPill, ...(activeCategory === cat ? {...styles.activeCategoryPill, color: primary, borderColor: `${primary}80`, backgroundColor: `${primary}10`} : {})}}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {filteredProviders.length === 0 ? (
              <div style={{...styles.center, color: '#888'}}>No extensions match your filters.</div>
            ) : (
              <div style={styles.list}>
                {filteredProviders.map(provider => {
                  const isInstalled = (installedProviders || []).find(p => p.value === provider.value);
                  const isInstalling = installingTarget === provider.value;

                  return (
                    <div key={provider.value} style={styles.card}>
                      <div style={styles.leftSection}>
                        {provider.icon ? (
                          <img src={provider.icon} alt={provider.name} style={styles.icon} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={styles.fallbackIcon}>{provider.name.charAt(0)}</div>
                        )}

                        <div style={styles.info}>
                          <h3 style={styles.name}>
                            {provider.name} <span style={styles.version}>v{provider.version}</span>
                          </h3>
                          <div style={styles.badgeContainer}>
                            <span style={{...styles.badge, color: primary, backgroundColor: `${primary}20`}}>{provider.type || 'Global'}</span>
                            {provider.category && (
                              <span style={styles.categoryBadge}>{provider.category}</span>
                            )}
                            <span style={styles.repoBadge} title={`Source: ${provider.repo}`}>
                              {provider.repo?.split('/')[0]}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {isInstalled ? (
                        <button style={{...styles.uninstallBtn, color: primary, borderColor: `${primary}80`}} onClick={() => uninstallProvider(provider.value)}>
                          <Trash2 size={16} /> Uninstall
                        </button>
                      ) : (
                        <button 
                          style={{...styles.installBtn, backgroundColor: primary, opacity: isInstalling ? 0.7 : 1}} 
                          onClick={() => handleInstall(provider)} 
                          disabled={isInstalling}
                        >
                          {isInstalling ? <Loader2 className="spin" size={16} /> : <Download size={16} />} 
                          {isInstalling ? 'Installing' : 'Install'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={styles.repoView}>
            <div style={styles.addRepoBox}>
              <h3 style={{marginTop: 0, fontSize: 16}}>Add Custom Source</h3>
              <p style={{color: '#888', fontSize: 13, marginBottom: 12}}>Enter a GitHub repository shorthand (e.g., <code>vega-org/plugins</code>).</p>
              
              <form onSubmit={handleAddRepo} style={{display: 'flex', gap: 10}}>
                <input 
                  style={{...styles.searchInput, flex: 1, paddingLeft: 12}} 
                  placeholder="owner/repo" 
                  value={newRepoInput}
                  onChange={(e) => setNewRepoInput(e.target.value)}
                />
                <button type="submit" style={{...styles.installBtn, backgroundColor: primary}}>
                  <Plus size={18} /> Add
                </button>
              </form>
            </div>

            <h3 style={{fontSize: 16, marginTop: 20, marginBottom: 10}}>Active Repositories</h3>
            <div style={styles.list}>
              {repos.map(repo => {
                const isDefault = extensionManager.defaultRepos?.includes(repo);
                return (
                  <div 
                    key={repo} 
                    className="repo-card"
                    style={{...styles.card, cursor: 'pointer', transition: '0.2s'}}
                    onClick={() => {
                      setActiveRepo(repo);
                      setActiveTab('extensions');
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                      <Database size={20} color={isDefault ? primary : "#888"} />
                      <div style={styles.info}>
                        <span style={{fontWeight: 'bold', fontSize: 15}}>{repo}</span>
                        <span style={{fontSize: 12, color: '#888'}}>
                          {isDefault ? 'Official Default' : 'User Added'} • Click to view extensions
                        </span>
                      </div>
                    </div>
                    {!isDefault && (
                      <button 
                        style={{...styles.iconBtnDanger, color: primary}} 
                        onClick={(e) => {
                          e.stopPropagation(); 
                          handleRemoveRepo(repo);
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 50 }}>
        <Nav 
          currentTab={currentTab === 'extensions' ? 'settings' : (currentTab || 'settings')} 
          onTabChange={(tab) => {
            if (typeof onNavigate === 'function') {
              onNavigate(tab);
            } else {
              console.warn("onNavigate prop is missing in Extensions.jsx!");
            }
          }} 
        />
      </div>
    </div>
  );
};

const styles = {
  container: { position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: '#050505', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
  
  header: { borderBottom: '1px solid #1a1a1a', backgroundColor: 'rgba(10,10,10,0.9)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  headerTop: { padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' },
  iconBtn: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 5 },
  iconBtnDanger: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, backgroundColor: 'rgba(255,77,77,0.1)', borderRadius: 8 },
  title: { fontSize: '20px', margin: 0, fontWeight: 'bold' },
  
  tabs: { display: 'flex', gap: '20px', padding: '0 20px' },
  tab: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '10px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid transparent' },
  activeTab: { borderBottomWidth: 2 },

  content: { padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '80px' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  
  searchContainer: { display: 'flex', alignItems: 'center', backgroundColor: '#111', borderRadius: '10px', border: '1px solid #222', flexShrink: 0 },
  searchInput: { flex: 1, backgroundColor: 'transparent', border: 'none', color: '#fff', padding: '12px', fontSize: '15px', outline: 'none' },
  
  repoFilterBanner: { backgroundColor: 'rgba(77, 166, 255, 0.1)', color: '#4da6ff', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', flexShrink: 0, border: '1px solid rgba(77, 166, 255, 0.2)' },
  clearFilterBtn: { background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' },

  categoryScroll: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px', flexShrink: 0 },
  categoryPill: { backgroundColor: '#111', color: '#aaa', border: '1px solid #222', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', fontWeight: '500' },
  activeCategoryPill: { borderWidth: 1 },

  repoView: { display: 'flex', flexDirection: 'column' },
  addRepoBox: { backgroundColor: '#111', border: '1px solid #222', padding: '16px', borderRadius: '12px' },

  card: { backgroundColor: '#111', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #222' },
  leftSection: { display: 'flex', alignItems: 'center', gap: '15px', overflow: 'hidden' },
  
  icon: { width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', backgroundColor: '#222', flexShrink: 0 },
  fallbackIcon: { width: '45px', height: '45px', borderRadius: '8px', backgroundColor: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#fff', flexShrink: 0 },
  
  info: { display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' },
  name: { fontSize: '16px', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  version: { fontSize: '12px', color: '#888', fontWeight: 'normal' },
  
  badgeContainer: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  badge: { fontSize: '11px', backgroundColor: 'rgba(255, 77, 77, 0.1)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' },
  categoryBadge: { fontSize: '11px', color: '#4da6ff', backgroundColor: 'rgba(77, 166, 255, 0.1)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' },
  repoBadge: { fontSize: '11px', color: '#aaa', backgroundColor: '#222', padding: '2px 8px', borderRadius: '4px', textTransform: 'lowercase' },
  
  installBtn: { color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s', fontSize: '13px' },
  uninstallBtn: { backgroundColor: 'rgba(255,77,77,0.1)', border: '1px solid', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s', fontSize: '13px' },
  
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '50px' }
};

export default Extensions;