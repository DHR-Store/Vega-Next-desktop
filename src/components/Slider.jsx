import React from 'react';
import useThemeStore from '../lib/zustand/themeStore';

const Slider = ({ title, posts, providerValue, onNavigate, isLoading, isSearch = false, filter = '' }) => {
  const primary = useThemeStore((state) => state.primary);
  const hasItems = posts && posts.length > 0;

  const handleMoreClick = () => {
    onNavigate('scrollList', {
      title: title,
      filter: filter || title,
      providerValue: providerValue,
      isSearch: isSearch
    });
  };

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        {hasItems && !isLoading && (
          <button 
            onClick={handleMoreClick} 
            style={{ ...styles.moreButton, color: primary }}
          >
            more
          </button>
        )}
      </div>

      <div style={styles.sliderContainer}>
        {isLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => <div key={i} style={styles.skeletonCard} />)
        ) : hasItems ? (
          posts.map((item, idx) => (
            <div
              key={idx}
              style={styles.card}
              onClick={() => {
                onNavigate('info', {
                  ...item,
                  link: item.link || item.url || item.href,
                  poster: item.image || item.poster || item.img,
                  provider: providerValue
                });
              }}
            >
              <div
                style={{
                  ...styles.cardImage,
                  backgroundImage: `url(${item.image || item.poster || 'https://placehold.co/150x220/1a1a1a/cccccc?text=No+Image'})`
                }}
              />
              <div style={styles.cardInfo}>
                <h3 style={styles.cardTitle}>{item.title}</h3>
              </div>
            </div>
          ))
        ) : (
          <div style={styles.noData}>No content found.</div>
        )}
      </div>
    </section>
  );
};

const styles = {
  section: { marginBottom: '30px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px', margin: 0 },
  moreButton: { background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  sliderContainer: { display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', minHeight: '100px' },
  card: { minWidth: '140px', maxWidth: '140px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', transition: 'transform 0.2s ease' },
  cardImage: { height: '210px', width: '140px', borderRadius: '8px', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#1a1a1a', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' },
  cardInfo: { padding: '0 4px' },
  cardTitle: { fontSize: '14px', margin: 0, color: '#e5e5e5', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  skeletonCard: { minWidth: '140px', height: '210px', borderRadius: '8px', backgroundColor: '#1f1f1f', animation: 'pulse 1.5s infinite' },
  noData: { color: '#666', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }
};

// Add pulse animation globally (optional, you can also include in your global CSS)
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
`;
document.head.appendChild(styleSheet);

export default Slider;