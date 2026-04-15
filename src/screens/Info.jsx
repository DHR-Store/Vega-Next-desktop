// screens/Info.jsx
import React, { useCallback, useMemo, useState } from 'react';
import SeasonList from '../components/SeasonList';
import { settingsStorage } from '../lib/storage';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import { useContentDetails } from '../lib/hooks/useContentInfo';
import { ArrowLeft, Bookmark, BookmarkCheck, PlayCircle, DownloadCloud, MoreVertical, Film, Tv } from 'lucide-react';
import CastInfo from '../components/CastInfo';
import Nav from '../components/Nav';  // ✅ Import bottom navigation

const Toggle = ({ active, onToggle, primaryColor }) => (
  <div onClick={onToggle} style={{ position:'relative', width:'46px', height:'26px', borderRadius:'13px', cursor:'pointer', flexShrink:0, background: active ? primaryColor : '#3a3a3a', transition:'background 0.25s' }}>
    <div style={{ position:'absolute', top:'4px', left: active ? '24px' : '4px', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.5)', transition:'left 0.25s' }} />
  </div>
);

const Pill = ({ children }) => (
  <span style={{ display:'inline-flex', alignItems:'center', padding:'5px 16px', borderRadius:'22px', border:'1.5px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:'13px', fontWeight:500, whiteSpace:'nowrap' }}>{children}</span>
);

const Sk = ({ w, h, r = 8 }) => (
  <div style={{ width:w, height:h, borderRadius:r, background:'rgba(255,255,255,0.06)', animation:'skp 1.4s ease-in-out infinite' }} />
);

export default function Info({ routeParams = {}, onBack, onNavigate, currentTab }) {
  const link = routeParams?.link || routeParams?.url;
  const routeProvider = routeParams?.provider;
  const routePoster = routeParams?.poster || routeParams?.image;
  const { provider: activeProvider } = useContentStore();
  const { primary } = useThemeStore();
  const primaryColor = primary || '#e8522a';
  const { watchList, addToWatchList, removeItem } = useWatchListStore();
  const providerValue = routeProvider || activeProvider?.value || 'vega';
  const { info, meta, isLoading, error, refetch } = useContentDetails(link, providerValue);
  const [useExternalPlayer, setUseExternalPlayer] = useState(() => settingsStorage.getBool('useExternalPlayer') || false);
  const [useExternalDownloader, setUseExternalDownloader] = useState(() => settingsStorage.getBool('useExternalDownloader') || false);

  const isInWatchlist = useMemo(() => watchList.some(i => i.link === link), [watchList, link]);
  const toggleWatchlist = useCallback(() => {
    if (isInWatchlist) removeItem(link);
    else addToWatchList({ title: info?.title || meta?.name || routeParams?.title || 'Unknown', link, poster: meta?.poster || info?.image || routePoster, provider: providerValue });
  }, [isInWatchlist, link, info, meta, routeParams, routePoster, providerValue, removeItem, addToWatchList]);

  const togglePlayer = () => { const v = !useExternalPlayer; setUseExternalPlayer(v); settingsStorage.setBool('useExternalPlayer', v); };
  const toggleDl = () => { const v = !useExternalDownloader; setUseExternalDownloader(v); settingsStorage.setBool('useExternalDownloader', v); };

  const displayTitle = info?.title || meta?.name || routeParams?.title || 'Unknown Title';
  const displaySynopsis = info?.synopsis || meta?.description || 'No storyline available.';
  const displayTags = Array.isArray(info?.tags) ? info.tags : typeof info?.tags === 'string' ? info.tags.split(',').map(t => t.trim()) : meta?.genre || [];
  const displayYear = info?.year || meta?.year || routeParams?.year || '';
  const displayRating = meta?.imdbRating || info?.rating || '';
  const displayDuration = meta?.runtime || '';
  const displayAwards = meta?.awards || info?.awards || '';
  const castList = info?.cast || meta?.cast || [];
  const posterImg = meta?.poster || info?.image || routePoster || 'https://placehold.co/400x600/111/333?text=No+Image';
  const backgroundImg = meta?.background || meta?.poster || info?.image || routePoster || posterImg;
  const logoImg = meta?.logo || null;
  const isMovie = info?.type === 'movie';

  // Robust safeLinkList construction
  let safeLinkList = info?.linkList || info?.seasons;
  if (!safeLinkList || safeLinkList.length === 0) {
    if (info?.episodes && Array.isArray(info.episodes) && info.episodes.length > 0) {
      safeLinkList = [{ title: isMovie ? 'Movie' : 'Episodes', episodes: info.episodes }];
    } else if (info?.directLinks && Array.isArray(info.directLinks) && info.directLinks.length > 0) {
      safeLinkList = [{ title: isMovie ? 'Movie' : 'Links', directLinks: info.directLinks }];
    } else if (link) {
      safeLinkList = [{ title: isMovie ? 'Movie' : 'Play', link: link }];
    } else {
      safeLinkList = [{ title: 'No streams', episodesLink: null }];
    }
  }

  const ROOT = {
    width: '100%',
    height: '100vh',
    background: '#000',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  const TitleBar = () => (
    <div style={{ height:'46px', minHeight:'46px', flexShrink:0, background:'rgba(0,0,0,0.94)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', padding:'0 14px', gap:'8px', zIndex:60 }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 11px', borderRadius:'8px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
        <ArrowLeft size={14} /> Back
      </button>
      <div style={{ display:'flex', alignItems:'center', gap:'5px', color:'#4b5563', fontSize:'13px', overflow:'hidden' }}>
        <span>/</span>
        {isMovie ? <Film size={13} color="#6b7280" /> : <Tv size={13} color="#6b7280" />}
        <span style={{ color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'220px' }}>{displayTitle}</span>
      </div>
      <div style={{ flex:1 }} />
      <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'6px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', color:'#9ca3af' }}>{providerValue}</span>
      <button onClick={toggleWatchlist} style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        {isInWatchlist ? <BookmarkCheck size={17} color={primaryColor} /> : <Bookmark size={17} color="#e5e7eb" />}
      </button>
      <button style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <MoreVertical size={15} color="#9ca3af" />
      </button>
    </div>
  );

  // Loading and error states (unchanged, but Nav will be shown at bottom too)
  if (!link) return (
    <div style={{ ...ROOT, alignItems:'center', justifyContent:'center' }}>
      <TitleBar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px' }}>
        <p style={{ color:'#6b7280' }}>No media link provided.</p>
        <button onClick={onBack} style={{ padding:'8px 20px', borderRadius:'8px', background:primaryColor, color:'#fff', fontWeight:700, border:'none', cursor:'pointer' }}>Go Back</button>
      </div>
      <Nav currentTab={currentTab} onTabChange={(tab) => onNavigate(tab)} />
    </div>
  );

  if (isLoading) return (
    <div style={ROOT}>
      <style>{`@keyframes skp{0%,100%{opacity:.3}50%{opacity:.65}}`}</style>
      <TitleBar />
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        <div style={{ width:'420px', flexShrink:0, overflowY:'auto' }}>
          <Sk w="100%" h={280} r={0} />
          <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:'12px' }}>
            <Sk w="55%" h={32} />
            <div style={{ display:'flex', gap:'7px' }}>{[70,70,90,80].map((w,i)=><Sk key={i} w={w} h={30} r={18} />)}</div>
            <Sk w="100%" h={72} />
          </div>
        </div>
        <div style={{ flex:1, padding:'16px', display:'flex', flexDirection:'column', gap:'10px', borderLeft:'1px solid rgba(255,255,255,0.07)' }}>
          <Sk w="100%" h={50} r={12} />
          {[1,2,3,4,5].map(i=><Sk key={i} w="100%" h={56} r={12} />)}
        </div>
      </div>
      <Nav currentTab={currentTab} onTabChange={(tab) => onNavigate(tab)} />
    </div>
  );

  if (error || !info) return (
    <div style={ROOT}>
      <TitleBar />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', padding:'32px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', maxWidth:'300px' }}>
          <h2 style={{ color:'#ef4444', margin:'0 0 8px', fontSize:'17px' }}>Connection Failed</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 20px' }}>{error?.message || 'Failed to fetch content details.'}</p>
          <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
            <button onClick={onBack} style={{ padding:'8px 18px', borderRadius:'8px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontWeight:600, cursor:'pointer' }}>Go Back</button>
            <button onClick={refetch} style={{ padding:'8px 18px', borderRadius:'8px', background:primaryColor, border:'none', color:'#fff', fontWeight:700, cursor:'pointer' }}>Retry</button>
          </div>
        </div>
      </div>
      <Nav currentTab={currentTab} onTabChange={(tab) => onNavigate(tab)} />
    </div>
  );

  // Main content (success)
  return (
    <div style={ROOT}>
      <style>{`
        @keyframes skp{0%,100%{opacity:.3}50%{opacity:.65}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.13);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22)}
      `}</style>

      <TitleBar />

      <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
        {/* LEFT panel (unchanged) */}
        <div style={{ width:'420px', minWidth:'420px', maxWidth:'420px', flexShrink:0, overflowY:'auto', overflowX:'hidden', background:'#000', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' }}>
          {/* Hero backdrop */}
          <div style={{ position:'relative', width:'100%', height:'280px', flexShrink:0, overflow:'hidden', background:'#0d0d0d' }}>
            <img src={backgroundImg} alt="Backdrop" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} onError={e => { e.currentTarget.style.display='none'; }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 55%, #000 100%)' }} />
            <div style={{ position:'absolute', bottom:'14px', left:'14px', right:'90px' }}>
              {logoImg
                ? <img src={logoImg} alt="Logo" style={{ maxHeight:'68px', objectFit:'contain', objectPosition:'left bottom', display:'block' }} />
                : <h1 style={{ margin:0, fontSize:'30px', fontWeight:800, lineHeight:1.1, color:'#fff', textShadow:'0 2px 16px rgba(0,0,0,0.9)', letterSpacing:'-0.5px' }}>{displayTitle}</h1>
              }
            </div>
            {displayRating && (
              <div style={{ position:'absolute', bottom:'18px', right:'14px', display:'flex', alignItems:'baseline', gap:'1px' }}>
                <span style={{ fontSize:'24px', fontWeight:800, color:'#fff' }}>{displayRating}</span>
                <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', fontWeight:500 }}>/10</span>
              </div>
            )}
          </div>

          {/* Pills row */}
          <div style={{ padding:'14px 14px 8px', display:'flex', flexWrap:'wrap', gap:'7px' }}>
            {displayYear && <Pill>{displayYear}</Pill>}
            {displayDuration && <Pill>{displayDuration}</Pill>}
            {displayTags.map((tag, i) => <Pill key={i}>{tag}</Pill>)}
          </div>

          {displayAwards && (
            <div style={{ padding:'4px 14px 10px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>Awards:</span>
              <span style={{ fontSize:'12px', color:'#e5e7eb', padding:'4px 12px', background:'rgba(255,255,255,0.08)', borderRadius:'20px' }}>{displayAwards}</span>
            </div>
          )}

          <CastInfo cast={castList} title={displayTitle} mediaType={isMovie ? 'movie' : 'tv'} />

          {/* Synopsis header */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px 8px' }}>
            <h2 style={{ margin:0, fontSize:'17px', fontWeight:700, color:'#fff' }}>Synopsis</h2>
            <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 9px', borderRadius:'6px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', color:'#9ca3af' }}>{providerValue}</span>
            <div style={{ flex:1 }} />
            <button style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <PlayCircle size={19} color="#fff" />
            </button>
            <button onClick={toggleWatchlist} style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {isInWatchlist ? <BookmarkCheck size={19} color={primaryColor} /> : <Bookmark size={19} color={primaryColor} />}
            </button>
            <button style={{ width:'36px', height:'36px', borderRadius:'50%', background:'transparent', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <MoreVertical size={19} color="#9ca3af" />
            </button>
          </div>

          <div style={{ margin:'0 14px 12px', padding:'14px 15px', background:'rgba(255,255,255,0.06)', borderRadius:'13px', border:'1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ margin:0, fontSize:'14px', color:'#e5e7eb', lineHeight:1.75 }}>{displaySynopsis}</p>
          </div>

          <div style={{ padding:'6px 14px 20px', display:'flex', alignItems:'center', gap:'18px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <PlayCircle size={17} color={useExternalPlayer ? primaryColor : '#6b7280'} />
              <span style={{ fontSize:'13px', color:'#e5e7eb', fontWeight:500 }}>External Play</span>
              <Toggle active={useExternalPlayer} onToggle={togglePlayer} primaryColor={primaryColor} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <DownloadCloud size={17} color={useExternalDownloader ? primaryColor : '#6b7280'} />
              <span style={{ fontSize:'13px', color:'#e5e7eb', fontWeight:500 }}>External Down</span>
              <Toggle active={useExternalDownloader} onToggle={toggleDl} primaryColor={primaryColor} />
            </div>
          </div>
          <div style={{ height:'8px', flexShrink:0 }} />
        </div>

        {/* RIGHT panel */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', background:'#000', overflowY:'auto', overflowX:'hidden' }}>
          <SeasonList
            LinkList={safeLinkList}
            poster={{ poster: posterImg, background: backgroundImg }}
            type={info?.type || 'movie'}
            metaTitle={displayTitle}
            providerValue={providerValue}
            routeParams={routeParams}
            onNavigate={onNavigate}
            primaryColor={primaryColor}
          />
        </div>
      </div>

      {/* ✅ Bottom Navigation Bar */}
      <Nav currentTab={currentTab} onTabChange={(tab) => onNavigate(tab)} />
    </div>
  );
}