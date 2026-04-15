// src/nboard.jsx
import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Zap, Shield, Tv, ArrowRight } from 'lucide-react';
import useThemeStore from './lib/zustand/themeStore';

const VEGA_NEXT_APP_URL = 'https://vega-next.com/download'; // Replace with actual download URL

const NBoard = ({ onClose }) => {
  const primary = useThemeStore((state) => state.primary);
  const [visible, setVisible] = useState(true);

  const handleContinue = () => {
    setVisible(false);
    localStorage.setItem('vegaNextOnboarded', 'true');
    if (onClose) onClose();
  };

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={handleContinue}>
          <X size={20} color="#fff" />
        </button>

        <div style={styles.iconContainer}>
          <Tv size={48} color={primary} />
        </div>

        <h1 style={styles.title}>Welcome to <span style={{ color: primary }}>Vega-Next</span></h1>
        <p style={styles.subtitle}>Your ultimate streaming companion</p>

        <div style={styles.featureGrid}>
          <div style={styles.featureItem}>
            <Zap size={24} color={primary} />
            <span>Lightning fast</span>
          </div>
          <div style={styles.featureItem}>
            <Shield size={24} color={primary} />
            <span>Ad-free experience</span>
          </div>
          <div style={styles.featureItem}>
            <Smartphone size={24} color={primary} />
            <span>Cross-platform sync</span>
          </div>
        </div>

        <div style={styles.androidCard}>
          <div style={styles.androidHeader}>
            <Smartphone size={22} color={primary} />
            <strong>Get the Android App</strong>
          </div>
          <p style={styles.androidText}>
            Enjoy Vega-Next on your phone or tablet with offline downloads, 
            casting, and personalized recommendations.
          </p>
          <a 
            href={VEGA_NEXT_APP_URL} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ ...styles.downloadBtn, backgroundColor: primary }}
          >
            <Download size={18} />
            Download for Android
          </a>
          <p style={styles.note}>APK available • Regular updates • 100% safe</p>
        </div>

        <button 
          style={{ ...styles.continueBtn, borderColor: primary, color: primary }}
          onClick={handleContinue}
        >
          Continue to App <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    backdropFilter: 'blur(8px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    fontFamily: 'sans-serif',
  },
  modal: {
    maxWidth: '500px',
    width: '100%',
    backgroundColor: '#111',
    borderRadius: '24px',
    padding: '28px 24px 32px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    position: 'relative',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  iconContainer: {
    marginBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0 0 8px',
    color: '#fff',
  },
  subtitle: {
    fontSize: '14px',
    color: '#aaa',
    marginBottom: '28px',
  },
  featureGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  featureItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#ddd',
  },
  androidCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '28px',
    textAlign: 'center',
  },
  androidHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '12px',
    fontSize: '18px',
    color: '#fff',
  },
  androidText: {
    fontSize: '13px',
    color: '#bbb',
    marginBottom: '18px',
    lineHeight: 1.4,
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '40px',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  note: {
    fontSize: '10px',
    color: '#666',
    marginTop: '12px',
  },
  continueBtn: {
    background: 'transparent',
    border: '2px solid',
    borderRadius: '40px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
};

export default NBoard;