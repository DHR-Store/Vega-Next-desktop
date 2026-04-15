import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { providerManager } from '../services/ProviderManager';

export const useStream = ({ activeEpisode, routeParams, provider, enabled = true }) => {
  const [selectedStream, setSelectedStream] = useState({ server: '', link: '', type: '', headers: {} });
  const [externalSubs, setExternalSubs] = useState([]);

  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stream', activeEpisode?.link || routeParams?.link, routeParams?.type, provider],
    queryFn: async () => {
      let targetLink = activeEpisode?.link || activeEpisode?.url || routeParams?.link || routeParams?.url;
      if (!targetLink) throw new Error("No video link provided to extract.");

      // Detect local file (Windows path or file://)
      const isLocalFile = targetLink.startsWith('file://') || targetLink.match(/^[a-zA-Z]:\\/);
      if (isLocalFile) {
        let fileUrl = targetLink;
        if (!fileUrl.startsWith('file://')) {
          fileUrl = `file:///${targetLink.replace(/\\/g, '/')}`;
        }
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

      console.log('[useStream] Fetching streams for:', targetLink);
      const streams = await providerManager.getStream({
        link: targetLink,
        type: routeParams?.type || 'movie',
        providerValue: provider
      });

      if (!streams || streams.length === 0) {
        throw new Error('No playable streams found on this server.');
      }

      // Extract subtitles and ensure each stream preserves its headers
      const allSubs = [];
      const enrichedStreams = streams.map(stream => {
        if (stream.subtitles && Array.isArray(stream.subtitles)) {
          stream.subtitles.forEach(sub => {
            allSubs.push({
              ...sub,
              uri: sub.url || sub.uri,
              language: sub.language || 'en',
              title: sub.label || sub.language || 'External subtitle'
            });
          });
        }
        // Ensure headers object exists (default empty)
        if (!stream.headers) stream.headers = {};
        return stream;
      });

      setExternalSubs(allSubs);
      setSelectedStream(enrichedStreams[0]);
      return enrichedStreams;
    },
    enabled: enabled && !!(activeEpisode?.link || routeParams?.link) && !!provider,
    retry: false,
    staleTime: 5 * 60 * 1000,
    onError: (err) => {
      console.error('[useStream] Error fetching streams:', err);
      setSelectedStream({ server: '', link: '', type: '', headers: {} });
      setExternalSubs([]);
    }
  });

  return {
    streamData,
    isLoading,
    error,
    refetch,
    selectedStream,
    setSelectedStream,
    externalSubs,
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
    setPlaybackRate
  };
};