// src/lib/services/DiscordRPC.js
// ──────────────────────────────────────────────────────────────────────────────
// Discord Rich Presence service – Electron + OAuth2 tokens.
// Uses window.require to avoid Vite ESM/CJS conflicts.
// ──────────────────────────────────────────────────────────────────────────────

let RPCClient = null;

// Safely load discord-rpc using Electron's Node.js require
if (typeof window !== 'undefined' && window.require) {
  try {
    const discordRPC = window.require('discord-rpc');
    RPCClient = discordRPC.Client;
    console.log('[DiscordRPC] discord-rpc loaded successfully');
  } catch (err) {
    console.error('[DiscordRPC] Failed to load discord-rpc:', err);
  }
}

const CLIENT_ID = '1488041405824635001';
const VEGA_SMALL_ICON = '1488247100549365781';
const FALLBACK_LARGE_ICON = '1488154301208465508';

class DiscordRPCService {
  constructor() {
    this.rpc = null;
    this.connected = false;
    this.token = null;
    this.pendingPresence = null;
    this.isUpdating = false;
  }

  /**
   * Connect to Discord using an OAuth2 access token.
   * @param {string} accessToken - Token with 'rpc.activities.write' scope
   */
  async connect(accessToken) {
    if (!accessToken || accessToken.length < 20) {
      console.warn('[DiscordRPC] Invalid token, skipping connect');
      return;
    }
    if (this.connected && this.token === accessToken) {
      console.log('[DiscordRPC] Already connected with this token');
      return;
    }

    // Disconnect any existing session
    await this.disconnect();

    if (!RPCClient) {
      console.error('[DiscordRPC] discord-rpc Client not available');
      return;
    }

    this.token = accessToken;
    this.rpc = new RPCClient({ transport: 'ipc' });

    try {
      await this.rpc.login({ clientId: CLIENT_ID, accessToken: this.token });
      this.connected = true;
      console.log('[DiscordRPC] Connected successfully');

      // Apply any queued presence
      if (this.pendingPresence) {
        const p = this.pendingPresence;
        this.pendingPresence = null;
        await this.updatePresence(p.title, p.state, p.startTime, p.endTime, p.posterUrl, p.providerName);
      }
    } catch (err) {
      console.error('[DiscordRPC] Connection failed:', err.message || err);
      this.connected = false;
      this.rpc = null;
      this.token = null;
    }
  }

  /**
   * Disconnect from Discord and clear presence.
   */
  async disconnect() {
    if (this.rpc) {
      try {
        await this.rpc.clearActivity();
        this.rpc.destroy();
      } catch (err) {
        // Ignore errors during destroy
      }
      this.rpc = null;
    }
    this.connected = false;
    this.token = null;
    this.pendingPresence = null;
    console.log('[DiscordRPC] Disconnected');
  }

  /**
   * Update Rich Presence with current media information.
   * @param {string} title - Video title (details)
   * @param {string} stateText - Additional state (e.g., "Provider - Anime")
   * @param {number} startTime - Unix timestamp (ms) when playback started
   * @param {number} endTime - Unix timestamp (ms) when video ends
   * @param {string} posterUrl - Poster image URL (ignored, kept for API compatibility)
   * @param {string} providerName - Name of the content provider
   */
  async updatePresence(title, stateText, startTime, endTime, posterUrl, providerName) {
    if (!this.connected || !this.rpc) {
      // Queue presence for when we become ready
      this.pendingPresence = { title, state: stateText, startTime, endTime, posterUrl, providerName };
      return;
    }

    if (this.isUpdating) {
      this.pendingPresence = { title, state: stateText, startTime, endTime, posterUrl, providerName };
      return;
    }

    this.isUpdating = true;
    try {
      const safeTitle = (title && title.length >= 2) ? title : 'Watching Video';
      const displayProvider = providerName || 'Vega';
      const finalState = `Provider - ${displayProvider} | ${stateText || ''}`;

      const activity = {
        details: safeTitle.slice(0, 128),
        state: finalState.slice(0, 128),
        startTimestamp: startTime ? Math.floor(startTime / 1000) : undefined,
        endTimestamp: endTime ? Math.floor(endTime / 1000) : undefined,
        largeImageKey: FALLBACK_LARGE_ICON,
        largeImageText: safeTitle,
        smallImageKey: VEGA_SMALL_ICON,
        smallImageText: 'Vega Next',
        instance: false,
      };

      await this.rpc.setActivity(activity);
      console.log('[DiscordRPC] Presence updated:', safeTitle);
    } catch (err) {
      console.error('[DiscordRPC] Failed to update presence:', err.message || err);
    } finally {
      this.isUpdating = false;
      // Process any new presence that was queued while we were updating
      if (this.pendingPresence) {
        const p = this.pendingPresence;
        this.pendingPresence = null;
        await this.updatePresence(p.title, p.state, p.startTime, p.endTime, p.posterUrl, p.providerName);
      }
    }
  }

  /**
   * Clear the current presence (stop showing "Watching").
   */
  async clearPresence() {
    if (this.connected && this.rpc) {
      try {
        await this.rpc.clearActivity();
        console.log('[DiscordRPC] Presence cleared');
      } catch (err) {
        console.error('[DiscordRPC] Failed to clear presence:', err.message || err);
      }
    }
  }
}

// Export a singleton instance
export const DiscordRPC = new DiscordRPCService();