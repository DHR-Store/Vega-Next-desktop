import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { providerManager } from '../services/ProviderManager';
import { settingsStorage } from '../storage';
import { ifExists } from '../file/ifExists';

const { ipcRenderer } = window.require
  ? window.require('electron')
  : { invoke: async () => {} };

const notify = (message) => {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(message);
    } else {
      console.warn('[useStream]', message);
    }
  } catch (_) {
    console.warn('[useStream]', message);
  }
};

export const useStream = ({
  activeEpisode,
  routeParams,
  provider,
  enabled = true,
}) => {
  const [selectedStream, setSelectedStream] = useState({
    server: '',
    link: '',
    type: '',
    headers: {},
  });
  const [externalSubs, setExternalSubs] = useState([]);
  const [skipAttemptCount, setSkipAttemptCount] = useState(0);

  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stream', activeEpisode?.link || routeParams?.link, routeParams?.type, provider],
    queryFn: async ({ signal }) => {
      let targetLink = activeEpisode?.link || activeEpisode?.url || routeParams?.link || routeParams?.url;
      if (!targetLink) throw new Error("No video link provided to extract.");

      // 1. Local file
      const isLocalFile = targetLink.startsWith('file://') || /^[a-zA-Z]:\\/.test(targetLink);
      if (isLocalFile) {
        let fileUrl = targetLink;
        if (!fileUrl.startsWith('file://')) fileUrl = `file:///${targetLink.replace(/\\/g, '/')}`;
        const mockStream = {
          server: 'Local File',
          link: fileUrl,
          type: 'mp4',
          quality: 'Downloaded',
          headers: {},
        };
        setSelectedStream(mockStream);
        setExternalSubs([]);
        return [mockStream];
      }

      // 2. Downloaded file
      if (routeParams?.primaryTitle && routeParams?.secondaryTitle) {
        const fileName = (
          routeParams.primaryTitle +
          routeParams.secondaryTitle +
          (activeEpisode?.title || '')
        ).replaceAll(/[^a-zA-Z0-9]/g, '_');
        const exists = await ifExists(fileName);
        if (exists) {
          const downloadedStream = {
            server: 'Downloaded',
            link: exists,
            type: 'mp4',
            headers: {},
          };
          setSelectedStream(downloadedStream);
          return [downloadedStream];
        }
      }

      // ---------------------------------------------------------------
      // 3. Fetch streams with fallback to auto-referer
      // ---------------------------------------------------------------
      const STREAM_FETCH_TIMEOUT = 10000;

      // Helper to create a timed controller
      const createTimedController = () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), STREAM_FETCH_TIMEOUT);
        // Link React Query's signal
        signal.addEventListener('abort', () => controller.abort());
        return { controller, timeoutId };
      };

      // Helper to fetch streams with a given referer mode
      const fetchStreams = async () => {
        const { controller, timeoutId } = createTimedController();
        try {
          const data = await providerManager.getStream({
            link: targetLink,
            type: routeParams?.type || 'movie',
            providerValue: routeParams?.providerValue || provider,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return data;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      let data = null;
      let refererToken = null;
      let autoRefererToken = null;

      // ---- Attempt 1: with global referer ----
      try {
        if (ipcRenderer.invoke) {
          refererToken = await ipcRenderer.invoke('set-global-referer', targetLink);
        }
        data = await fetchStreams();
      } catch (err) {
        console.warn('[useStream] First attempt failed, trying auto-referer:', err.message);
      } finally {
        // Clear global referer (no matter success or failure of attempt 1)
        if (ipcRenderer.invoke && refererToken !== null) {
          await ipcRenderer.invoke('clear-global-referer', refererToken);
        }
      }

      // ---- Attempt 2: with auto-referer if first attempt gave no streams ----
      if (!data || data.length === 0) {
        try {
          if (ipcRenderer.invoke) {
            autoRefererToken = await ipcRenderer.invoke('enable-auto-referer');
          }
          data = await fetchStreams();
        } catch (err) {
          console.error('[useStream] Auto-referer attempt also failed:', err);
          throw err; // rethrow to let React Query handle the error
        } finally {
          if (ipcRenderer.invoke && autoRefererToken !== null) {
            await ipcRenderer.invoke('disable-auto-referer', autoRefererToken);
          }
        }
      }

      // If still no streams, throw an error
      if (!data || data.length === 0) {
        throw new Error('No streams available');
      }

      // Filter qualities
      const excludedQualities = settingsStorage.getExcludedQualities() || [];
      const filteredQualities = data.filter(
        (stream) => !excludedQualities.includes(stream?.quality + 'p')
      );
      const streams = filteredQualities.length > 0 ? filteredQualities : data;

      // Extract subs & ensure headers
      const allSubs = [];
      const enrichedStreams = streams.map((stream) => {
        if (stream.subtitles && Array.isArray(stream.subtitles)) {
          stream.subtitles.forEach((sub) => {
            allSubs.push({
              ...sub,
              uri: sub.url || sub.uri,
              language: sub.language || 'en',
              title: sub.label || sub.language || 'External subtitle',
            });
          });
        }
        if (!stream.headers) stream.headers = {};
        return stream;
      });

      setExternalSubs(allSubs);
      return enrichedStreams;
    },
    enabled: enabled && !!(activeEpisode?.link || routeParams?.link) && !!provider,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    onError: (err) => {
      console.error('[useStream] Error fetching streams:', err);
      setSelectedStream({ server: '', link: '', type: '', headers: {} });
      setExternalSubs([]);
      notify('No stream found, try again later');
    },
  });

  // ── Auto‑select first non‑hubcloud stream ──────────────────────
  useEffect(() => {
    if (streamData && streamData.length > 0) {
      let initialStream = streamData[0];
      let index = 0;
      let skippedHubcloud = false;

      while (
        initialStream &&
        initialStream.server?.toLowerCase() === 'hubcloud' &&
        index < streamData.length - 1
      ) {
        index++;
        initialStream = streamData[index];
        skippedHubcloud = true;
      }

      if (initialStream) {
        setSelectedStream(initialStream);
        setSkipAttemptCount(0);
        if (skippedHubcloud) notify('Skipped hubcloud server');
      }
    }
  }, [streamData]);

  // ── Switch to next stream ──────────────────────────────────────
  const switchToNextStream = useCallback(() => {
    if (!streamData || streamData.length === 0) return false;

    const currentIndex = streamData.findIndex(
      (s) => s.link === selectedStream.link && s.server === selectedStream.server
    );

    let nextIndex = currentIndex + 1;
    let nextStream = streamData[nextIndex];
    let skippedHubcloud = false;

    while (
      nextStream &&
      nextStream.server?.toLowerCase() === 'hubcloud' &&
      nextIndex < streamData.length - 1
    ) {
      nextIndex++;
      nextStream = streamData[nextIndex];
      skippedHubcloud = true;
    }

    if (nextStream) {
      setSelectedStream(nextStream);
      setSkipAttemptCount(0);
      notify('Video could not be played, trying next server');
      if (skippedHubcloud) notify('Skipped hubcloud server');
      return true;
    }
    return false;
  }, [streamData, selectedStream]);

  const handleStreamLoadFailure = useCallback(() => {
    if (skipAttemptCount === 0) {
      setSkipAttemptCount(1);
      console.log('[useStream] Stream load failure, attempting next server.');
      return switchToNextStream();
    }
    console.log('[useStream] Already attempted to skip this stream.');
    return false;
  }, [skipAttemptCount, switchToNextStream]);

  return {
    streamData,
    isLoading,
    error,
    refetch,
    selectedStream,
    setSelectedStream,
    externalSubs,
    switchToNextStream: handleStreamLoadFailure,
  };
};

export const usePlayerSettings = () => {
  const [showControls, setShowControls] = useState(true);
  const [isPlayerLocked, setIsPlayerLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const toggleLock = () => {
    const newLockState = !isPlayerLocked;
    setIsPlayerLocked(newLockState);
    if (!newLockState) setShowControls(true);
  };

  return {
    showControls,
    setShowControls,
    isPlayerLocked,
    toggleLock,
    isFullscreen,
    setIsFullscreen,
    playbackRate,
    setPlaybackRate,
  };
};