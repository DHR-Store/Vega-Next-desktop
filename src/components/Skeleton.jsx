import React from 'react';
import useThemeStore from '../lib/zustand/themeStore';

const SkeletonLoader = ({
  width,
  height,
  style = {},
  darkMode = true,
  marginVertical = 8,
  useThemeAccent = false, // optional: use theme primary color as background
}) => {
  const primary = useThemeStore((state) => state.primary);

  // Helper: convert hex to rgba with opacity
  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Determine background color
  let backgroundColor;
  if (useThemeAccent) {
    backgroundColor = hexToRgba(primary, 0.15); // 15% opacity theme color
  } else {
    backgroundColor = darkMode ? '#333333' : '#E0E0E0';
  }

  return (
    <div
      className="rounded-lg opacity-70 animate-pulse"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        marginTop: marginVertical,
        marginBottom: marginVertical,
        backgroundColor,
        ...style,
      }}
    />
  );
};

// Ensure pulse animation exists (if not already in global CSS)
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .animate-pulse {
    animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;
if (!document.querySelector('#skeleton-styles')) {
  styleSheet.id = 'skeleton-styles';
  document.head.appendChild(styleSheet);
}

export default SkeletonLoader;