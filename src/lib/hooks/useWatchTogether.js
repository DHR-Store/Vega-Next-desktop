import { useState, useEffect, useCallback } from 'react';
// ⚠️ WEB FIX: Changed from 'pusher-js/react-native' to standard web pusher
import Pusher from 'pusher-js'; 

const PUSHER_APP_KEY = '4d88bbd01476b51eb07c';
const PUSHER_APP_CLUSTER = 'ap2';

export const useWatchTogether = (videoId, watchTogetherMode, playerRef, setChatLog) => {
  const [channel, setChannel] = useState(null);
  const [senderId] = useState(`User-${Math.floor(Math.random() * 10000)}`);

  useEffect(() => {
    if (!watchTogetherMode || !videoId) return;

    const pusherClient = new Pusher(PUSHER_APP_KEY, {
      cluster: PUSHER_APP_CLUSTER,
    });

    const newChannel = pusherClient.subscribe(`presence-video-${videoId}`);
    setChannel(newChannel);

    newChannel.bind('client-sync-event', (data) => {
      if (data.senderId === senderId) return;

      if (setChatLog) {
        setChatLog((prev) => [
          `[Sync: ${data.senderId}] ${data.type.toUpperCase()} to ${data.time.toFixed(1)}s`,
          ...prev,
        ]);
      }

      if (playerRef?.current) {
        if (data.type === 'seek' || data.type === 'play') {
          playerRef.current.seek(data.time);
        }
        if (data.type === 'pause') {
          // You'll need to link this to your player state depending on your implementation
          // playerRef.current.pause(); 
        }
      }
    });

    newChannel.bind('client-chat-message', (data) => {
      if (setChatLog) {
        setChatLog((prev) => [`${data.senderId}: ${data.message}`, ...prev]);
      }
    });

    return () => {
      if (newChannel) {
        newChannel.unbind_all();
        pusherClient.unsubscribe(`presence-video-${videoId}`);
        pusherClient.disconnect();
      }
    };
  }, [videoId, watchTogetherMode, senderId, playerRef, setChatLog]);

  const sendSyncEvent = useCallback(
    (type, time) => {
      if (channel) {
        const data = { type, time, senderId };
        channel.trigger('client-sync-event', data);
        
        if (setChatLog) {
          setChatLog(prev => [
            `[Sync: You] ${type.toUpperCase()} to ${time.toFixed(1)}s`,
            ...prev,
          ]);
        }
      }
    },
    [channel, senderId, setChatLog]
  );

  const sendChat = useCallback(
    (message) => {
      if (channel) {
        const data = { senderId, message };
        channel.trigger('client-chat-message', data);
        
        if (setChatLog) {
          setChatLog(prev => [`You [${senderId}]: ${message}`, ...prev]);
        }
      }
    },
    [channel, senderId, setChatLog]
  );

  return {
    sendSyncEvent,
    sendChat,
    senderId
  };
};