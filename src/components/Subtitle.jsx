import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Subtitles, Upload, X, Check } from 'lucide-react';

/**
 * SubtitleManager for Video.js player
 * Manages external .srt/.vtt subtitles with proper memory cleanup
 */
const SubtitleManager = ({ player, onTrackChange }) => {
  const [tracks, setTracks] = useState([]);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  // Store blob URLs for later revocation
  const blobUrlsRef = useRef(new Map()); // trackId -> blobUrl

  // Helper: Extract language from filename (e.g., "movie.en.srt" -> "en")
  const extractLanguageFromFilename = (filename) => {
    const match = filename.match(/\.([a-z]{2,3})(?:\.|$)/i);
    return match ? match[1].toLowerCase() : 'en';
  };

  // Update internal tracks state from player
  const updateTracksState = useCallback(() => {
    if (!player) return;
    const textTracks = player.textTracks();
    const trackList = [];
    let currentActiveId = null;
    for (let i = 0; i < textTracks.length; i++) {
      const tt = textTracks[i];
      // Skip native captions that are not remote (optional)
      if (tt.kind === 'captions' || tt.kind === 'subtitles') {
        trackList.push({
          id: tt.id,
          label: tt.label,
          language: tt.language,
          enabled: tt.mode === 'showing',
        });
        if (tt.mode === 'showing') currentActiveId = tt.id;
      }
    }
    setTracks(trackList);
    setActiveTrackId(currentActiveId);
  }, [player]);

  // Cleanup blob URL for a specific track
  const revokeBlobUrl = (trackId) => {
    const url = blobUrlsRef.current.get(trackId);
    if (url) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(trackId);
    }
  };

  // Add subtitle from File object
  const addSubtitleFromFile = async (file) => {
    if (!player) return;
    setError(null);

    // Validate file type
    if (!file.name.match(/\.(srt|vtt)$/i)) {
      setError('Only .srt or .vtt files are supported');
      return;
    }

    try {
      // Create blob URL
      const url = URL.createObjectURL(file);
      const label = file.name.replace(/\.[^/.]+$/, ''); // remove extension
      const language = extractLanguageFromFilename(file.name);

      // Add remote text track (third param false = do not fire addtrack event manually)
      const track = player.addRemoteTextTrack({
        kind: 'captions',
        label: label,
        language: language,
        src: url,
        mode: 'showing',
      }, false);

      const trackId = track.track.id;
      // Store blob URL for later cleanup
      blobUrlsRef.current.set(trackId, url);

      // Activate this track (disable others)
      const allTracks = player.textTracks();
      for (let i = 0; i < allTracks.length; i++) {
        allTracks[i].mode = allTracks[i].id === trackId ? 'showing' : 'disabled';
      }

      setActiveTrackId(trackId);
      if (onTrackChange) onTrackChange(trackId);
      setShowMenu(false);
      setError(null);
    } catch (err) {
      console.error('Failed to add subtitle:', err);
      setError('Failed to load subtitle file');
    }
  };

  // Remove subtitle by track id
  const removeSubtitle = (trackId) => {
    if (!player) return;
    const tracksList = player.textTracks();
    for (let i = 0; i < tracksList.length; i++) {
      if (tracksList[i].id === trackId) {
        // Revoke blob URL before removing
        revokeBlobUrl(trackId);
        player.removeRemoteTextTrack(tracksList[i]);
        break;
      }
    }

    // If the removed track was active, try to activate the first remaining track
    if (activeTrackId === trackId) {
      const remainingTracks = player.textTracks();
      let newActiveId = null;
      for (let i = 0; i < remainingTracks.length; i++) {
        if (remainingTracks[i].kind === 'captions' || remainingTracks[i].kind === 'subtitles') {
          remainingTracks[i].mode = 'showing';
          newActiveId = remainingTracks[i].id;
          break;
        }
      }
      setActiveTrackId(newActiveId);
      if (onTrackChange) onTrackChange(newActiveId);
    }
  };

  // Activate a specific subtitle track
  const setActive = (trackId) => {
    if (!player) return;
    const allTracks = player.textTracks();
    for (let i = 0; i < allTracks.length; i++) {
      if (allTracks[i].kind === 'captions' || allTracks[i].kind === 'subtitles') {
        allTracks[i].mode = allTracks[i].id === trackId ? 'showing' : 'disabled';
      }
    }
    setActiveTrackId(trackId);
    if (onTrackChange) onTrackChange(trackId);
    setShowMenu(false);
  };

  // Handle file input change
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) addSubtitleFromFile(file);
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Set up player event listeners
  useEffect(() => {
    if (!player) return;

    // Initial sync
    const onMetadata = () => updateTracksState();
    player.on('loadedmetadata', onMetadata);

    const textTrackList = player.textTracks();
    // Listen for track changes
    textTrackList.addEventListener('addtrack', updateTracksState);
    textTrackList.addEventListener('removetrack', updateTracksState);
    textTrackList.addEventListener('change', updateTracksState);

    // Sync immediately if player already has metadata
    if (player.readyState() >= 1) updateTracksState();

    // Cleanup
    return () => {
      player.off('loadedmetadata', onMetadata);
      textTrackList.removeEventListener('addtrack', updateTracksState);
      textTrackList.removeEventListener('removetrack', updateTracksState);
      textTrackList.removeEventListener('change', updateTracksState);

      // Revoke all remaining blob URLs
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, [player, updateTracksState]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Subtitles menu"
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Subtitles size={20} />
        <span style={{ fontSize: '12px' }}>Sub</span>
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '0',
            width: '280px',
            backgroundColor: 'rgba(20,20,20,0.95)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            zIndex: 200,
          }}
        >
          <div
            style={{
              padding: '10px',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong>Subtitles</strong>
            <button
              onClick={() => setShowMenu(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {/* Upload button */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                cursor: 'pointer',
                borderBottom: '1px solid #2a2a2a',
              }}
            >
              <Upload size={16} />
              Upload .srt/.vtt
              <input
                type="file"
                accept=".srt,.vtt"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>

            {/* Error message */}
            {error && (
              <div style={{ padding: '8px 12px', color: '#ff9999', fontSize: '12px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Track list */}
            {tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: '1px solid #2a2a2a',
                }}
              >
                <button
                  onClick={() => setActive(track.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    flex: 1,
                    textAlign: 'left',
                  }}
                  aria-label={`Activate subtitle ${track.label}`}
                >
                  {track.label}
                  {activeTrackId === track.id && (
                    <Check size={14} style={{ display: 'inline', marginLeft: 8 }} />
                  )}
                </button>
                <button
                  onClick={() => removeSubtitle(track.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff4d4d',
                    cursor: 'pointer',
                  }}
                  aria-label={`Remove subtitle ${track.label}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            {tracks.length === 0 && !error && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
                No subtitles
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleManager;