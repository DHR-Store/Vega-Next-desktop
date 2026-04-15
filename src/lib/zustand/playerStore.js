// src/lib/zustand/playerStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePlayerStore = create(
  persist(
    (set, get) => ({
      // ─── Current media info (persisted for resume) ───────────────────────────
      currentMedia: null,       // { title, link, poster, duration }

      // ─── Session playback state (NOT persisted) ──────────────────────────────
      isPlaying: false,
      isMiniPlayerVisible: false,
      progress: 0,              // 0-1 float

      // ─── Resume position (persisted) ─────────────────────────────────────────
      elapsedTime: 0,           // seconds – written every 5 s from Player

      // ─── Persisted player settings ────────────────────────────────────────────
      volume: 1,                // 0-1
      isMuted: false,
      playbackRate: 1,          // e.g. 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2 | 3
      videoFit: 'contain',      // 'contain' | 'cover' | 'fill'
      selectedAudioTrackId: null,

      // ─── Persisted server/stream selection ────────────────────────────────────
      // Stores the last selected stream URL so the user's preferred server is
      // automatically restored when they reopen the same media.
      selectedStreamLink: null,

      // ─── Media actions ────────────────────────────────────────────────────────

      /**
       * Call once when a new stream starts playing.
       * If it's the SAME media link, elapsed time & progress are preserved so
       * the player can resume from where the user left off.
       * If it's genuinely new media, both are reset to zero.
       */
      playMedia: (media) => {
        const { currentMedia } = get();
        const isSameMedia = currentMedia?.link === media.link;
        set({
          currentMedia: media,
          isPlaying: true,
          isMiniPlayerVisible: true,
          // Only reset progress for new content
          ...(isSameMedia
            ? {}
            : { elapsedTime: 0, progress: 0 }),
        });
      },

      /**
       * Call when resuming the SAME media (e.g. returning to Player from
       * another screen). Does NOT reset elapsedTime.
       */
      resumeMedia: (media) =>
        set({ currentMedia: media, isPlaying: true, isMiniPlayerVisible: true }),

      togglePlayPause: () =>
        set((state) => ({ isPlaying: !state.isPlaying })),

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      toggleMiniPlayer: (visible) =>
        set({ isMiniPlayerVisible: visible }),

      /**
       * Throttle this to once every ~5 s from the Player's timeupdate handler.
       * Also called immediately on unmount / back navigation to prevent position loss.
       */
      updatePlaybackProgress: (elapsedTime) => {
        const { currentMedia } = get();
        const progress =
          currentMedia?.duration ? elapsedTime / currentMedia.duration : 0;
        set({ elapsedTime, progress });
      },

      resetPlayer: () =>
        set({
          currentMedia: null,
          isPlaying: false,
          progress: 0,
          elapsedTime: 0,
          selectedStreamLink: null,
        }),

      // ─── Settings actions ─────────────────────────────────────────────────────

      /** Set volume 0-1. Automatically marks as muted when volume reaches 0. */
      setVolume: (volume) =>
        set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume === 0 }),

      /** Toggle muted without changing stored volume level. */
      toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),

      setMuted: (isMuted) => set({ isMuted }),

      setPlaybackRate: (playbackRate) => set({ playbackRate }),

      /** Cycle or set video fit mode. */
      setVideoFit: (videoFit) => set({ videoFit }),
      cycleVideoFit: () => {
        const modes = ['contain', 'cover', 'fill'];
        const { videoFit } = get();
        const next = modes[(modes.indexOf(videoFit) + 1) % modes.length];
        set({ videoFit: next });
        return next;
      },

      setSelectedAudioTrackId: (selectedAudioTrackId) =>
        set({ selectedAudioTrackId }),

      /** Persist the selected server/stream URL across sessions. */
      setSelectedStreamLink: (link) => set({ selectedStreamLink: link }),
    }),
    {
      name: 'player-storage',
      partialize: (state) => ({
        // Persisted across sessions
        currentMedia: state.currentMedia,
        elapsedTime: state.elapsedTime,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        videoFit: state.videoFit,
        selectedAudioTrackId: state.selectedAudioTrackId,
        selectedStreamLink: state.selectedStreamLink,   // ← NEW: remember server
        // NOT persisted: isPlaying, isMiniPlayerVisible, progress
      }),
    }
  )
);

export default usePlayerStore;