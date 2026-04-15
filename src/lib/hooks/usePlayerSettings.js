// src/lib/hooks/usePlayerSettings.js
import { useCallback, useRef, useState } from 'react';
import usePlayerStore from '../zustand/playerStore';

// =============================================================================
// usePlayerProgress
// =============================================================================
/**
 * Tracks video playback position and syncs it to:
 *  1. The watch-history store (updatePlaybackInfo) — unchanged behaviour.
 *  2. The player store (updatePlaybackProgress) — throttled to every 5 s so
 *     the persisted resume position stays fresh without flooding the store.
 *
 * Fixed vs original JS:
 *  - Added `lastSavedPositionRef` throttle guard (was missing, present in TS).
 *  - Added `updatePlaybackProgress` call so the store knows the position.
 *  - `handleProgress` now accepts both {currentTime, seekableDuration} (RN
 *    video) and a plain number so the web Player can call it from timeupdate.
 */
export const usePlayerProgress = ({
  activeEpisode,
  routeParams,
  playbackRate,
  updatePlaybackInfo,
}) => {
  const { updatePlaybackProgress } = usePlayerStore();

  // In-memory ref for instant reads (e.g. saving on unmount)
  const videoPositionRef = useRef({ position: 0, duration: 0 });
  // Throttle: only write to store / cacheStorage every 5 seconds
  const lastSavedPositionRef = useRef(0);

  /**
   * Works with both:
   *   - React Native Video:  handleProgress({ currentTime, seekableDuration })
   *   - Web timeupdate:      handleProgress({ currentTime, duration })
   *     or plain:            handleProgress(currentTimeNumber)
   */
  const handleProgress = useCallback(
    (e) => {
      // Normalise argument — accept object or plain number
      const currentTime =
        typeof e === 'number' ? e : (e?.currentTime ?? 0);
      const seekableDuration =
        typeof e === 'number' ? 0 : (e?.seekableDuration ?? e?.duration ?? 0);

      // Always keep the ref up to date for instant reads
      videoPositionRef.current = { position: currentTime, duration: seekableDuration };

      // ── Watch-history update (existing behaviour, unchanged) ─────────────
      if (routeParams?.episodeList && routeParams?.linkIndex !== undefined) {
        updatePlaybackInfo(
          routeParams.episodeList[routeParams.linkIndex].link,
          { currentTime, duration: seekableDuration, playbackRate },
        );
      }

      // ── Throttled store write (every 5 seconds) ──────────────────────────
      // Prevents flooding the Zustand store (and localStorage serialisation)
      // on every animation frame / timeupdate event.
      if (Math.abs(currentTime - lastSavedPositionRef.current) >= 5) {
        lastSavedPositionRef.current = currentTime;
        updatePlaybackProgress(currentTime); // → persisted to playerStore
      }
    },
    [routeParams, playbackRate, updatePlaybackInfo, updatePlaybackProgress],
  );

  return { videoPositionRef, handleProgress };
};

// =============================================================================
// usePlayerSettings
// =============================================================================
/**
 * All ephemeral UI state lives here (showControls, lock, fullscreen …).
 * Settings that must survive a page refresh (playbackRate, videoFit) are
 * read from — and written back to — the playerStore automatically.
 *
 * @param {Function|null} externalSetToast
 *   Optional. If the consuming component manages its own toast, pass its setter
 *   here and the internal toast state won't be used.
 *
 * Fixed vs original JS:
 *  - `playbackRate` now initialised from store; setter syncs store.
 *  - `resizeMode` now initialised from store (`videoFit`); setter syncs store.
 *  - Added `handleResizeMode` (was in TS, missing from JS).
 *  - Added internal toast management (was missing from JS; TS had it).
 *  - `activeTab` default changed from 'Server' → 'audio' (matches Player.jsx).
 *  - `setPlaybackRate` and `setResizeMode` are now stable wrapped callbacks
 *    instead of raw setState, so consumers don't need separate store calls.
 */
export const usePlayerSettings = (externalSetToast = null) => {
  // ── Pull persisted settings from store ──────────────────────────────────
  const {
    playbackRate: storedPlaybackRate,
    videoFit: storedVideoFit,
    setPlaybackRate: storeSetPlaybackRate,
    setVideoFit: storeSetVideoFit,
    cycleVideoFit: storeCycleVideoFit,
  } = usePlayerStore();

  // ── Ephemeral UI state (never persisted) ────────────────────────────────
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('audio'); // Fixed: was 'Server'
  const [isPlayerLocked, setIsPlayerLocked] = useState(false);
  const [showUnlockButton, setShowUnlockButton] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // ── Persisted settings — local mirror of store values ───────────────────
  // These exist so components can read them reactively without calling
  // usePlayerStore() themselves. They are always kept in sync with the store
  // through the setter wrappers below.
  const [playbackRate, setPlaybackRateLocal] = useState(storedPlaybackRate);
  const [resizeMode, setResizeModeLocal] = useState(storedVideoFit);

  // ── Internal toast state (used only when externalSetToast is not given) ──
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const unlockButtonTimerRef = useRef(null);

  // ── Toast helper ─────────────────────────────────────────────────────────
  /**
   * Show a toast notification.
   * If externalSetToast is provided it delegates there; otherwise it manages
   * its own showToast / toastMessage state (mirrors the TS version).
   */
  const setToast = useCallback(
    (message, duration = 2000) => {
      if (typeof externalSetToast === 'function') {
        externalSetToast(message, duration);
        return;
      }
      setToastMessage(message);
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), duration);
    },
    [externalSetToast],
  );

  // ── Playback rate — syncs local mirror + store ───────────────────────────
  /**
   * Call this everywhere instead of raw setPlaybackRate.
   * Consumer (Player.jsx) no longer needs to also call storeSetPlaybackRate.
   */
  const setPlaybackRate = useCallback(
    (rate) => {
      setPlaybackRateLocal(rate);
      storeSetPlaybackRate(rate);
    },
    [storeSetPlaybackRate],
  );

  // ── Resize / fit mode — syncs local mirror + store ───────────────────────
  /**
   * Direct setter (for external or programmatic changes).
   */
  const setResizeMode = useCallback(
    (mode) => {
      setResizeModeLocal(mode);
      storeSetVideoFit(mode);
    },
    [storeSetVideoFit],
  );

  /**
   * Cycle through fit modes in order: contain → cover → fill → none → …
   * Returns the new mode string so callers can apply it immediately
   * (e.g. set `<video>.style.objectFit`).
   * Fixed: was missing from JS version entirely (present in TS as handleResizeMode).
   */
  const handleResizeMode = useCallback(() => {
    const modeLabels = {
      contain: 'Contain',
      cover: 'Cover',
      fill: 'Fill',
      none: 'Fit',
    };
    const nextMode = storeCycleVideoFit(); // store cycles and returns next value
    setResizeModeLocal(nextMode);
    setToast(`Fit: ${modeLabels[nextMode] ?? nextMode}`, 1500);
    return nextMode; // caller can do: videoRef.style.objectFit = handleResizeMode()
  }, [storeCycleVideoFit, setToast]);

  // ── Player lock ──────────────────────────────────────────────────────────
  const toggleLock = useCallback(() => {
    const newLockState = !isPlayerLocked;
    setIsPlayerLocked(newLockState);

    if (!newLockState) {
      // Unlocking → show controls again
      setShowControls(true);
    } else {
      // Locking → hide the unlock button immediately
      setShowUnlockButton(false);
    }

    if (unlockButtonTimerRef.current) {
      clearTimeout(unlockButtonTimerRef.current);
      unlockButtonTimerRef.current = null;
    }

    setToast(newLockState ? 'Player Locked' : 'Player Unlocked', 2000);
  }, [isPlayerLocked, setToast]);

  // ── Locked-screen tap: reveal/hide the unlock button ────────────────────
  const handleLockedScreenTap = useCallback(() => {
    if (showUnlockButton) {
      setShowUnlockButton(false);
      return;
    }

    setShowUnlockButton(true);

    if (unlockButtonTimerRef.current) clearTimeout(unlockButtonTimerRef.current);
    unlockButtonTimerRef.current = setTimeout(
      () => setShowUnlockButton(false),
      10_000,
    );
  }, [showUnlockButton]);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  const toggleFullScreen = useCallback(() => setIsFullScreen((prev) => !prev), []);

  // ── Return surface ───────────────────────────────────────────────────────
  return {
    // ── UI state ──────────────────────────────────────────────────────────
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    isPlayerLocked,
    showUnlockButton,
    isFullScreen,
    setIsFullScreen,

    // ── Toast ──────────────────────────────────────────────────────────────
    // Exposed so consuming components can render the toast overlay
    toastMessage,
    showToast,
    setToast,

    // ── Persisted settings (store-backed) ─────────────────────────────────
    // Reading: already initialised from store — no extra store call needed
    // Writing: setters below keep both local mirror and store in sync
    playbackRate,
    setPlaybackRate,       // replaces raw setState — also writes to store
    resizeMode,
    setResizeMode,         // replaces raw setState — also writes to store
    handleResizeMode,      // cycle through modes + toast (was missing in JS)

    // ── Actions ────────────────────────────────────────────────────────────
    toggleLock,
    handleLockedScreenTap,
    toggleFullScreen,
    unlockButtonTimerRef,
  };
};