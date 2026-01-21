// live-radio-streaming.js
// ------------------------------------------------------------
// Live Radio Streaming System for Fizzmaster Rex
// Allows admin to broadcast live as the DJ
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const liveRadioStreaming = {
    loaded: false,
    isLive: false,
    streamUrl: null,
    streamType: null, // 'twitch', 'youtube', 'custom', 'direct'
    audioElement: null,
    chatEnabled: false,
    chatMessages: [],
    adminMode: false,

    // Stream configuration
    config: {
      twitch: {
        embedUrl: "https://player.twitch.tv/?channel={CHANNEL}&parent={DOMAIN}&muted=false&autoplay=true",
        chatUrl: "https://www.twitch.tv/embed/{CHANNEL}/chat?parent={DOMAIN}"
      },
      youtube: {
        embedUrl: "https://www.youtube.com/embed/{VIDEO_ID}?autoplay=1&controls=1",
        chatUrl: "https://www.youtube.com/live_chat?v={VIDEO_ID}&embed_domain={DOMAIN}"
      },
      custom: {
        // For custom RTMP/HLS streams
        streamUrl: null
      }
    },

    async init() {
      if (this.loaded) return;

      console.log("[live-radio] Initializing live radio streaming system");

      // Create audio element for live streams
      this.audioElement = document.createElement('audio');
      this.audioElement.id = 'liveRadioStream';
      this.audioElement.preload = 'none';
      this.audioElement.volume = 0.7;
      document.body.appendChild(this.audioElement);

      // Check if user is admin
      this.checkAdminStatus();

      // Listen for live stream events
      this.setupEventListeners();

      // Check for active live stream
      await this.checkLiveStatus();

      this.loaded = true;
      console.log("[live-radio] Live radio system ready");
    },

    checkAdminStatus() {
      // Check if current user is admin (can broadcast)
      if (window.PLAYER && window.PLAYER.role === 'admin') {
        this.adminMode = true;
        console.log("[live-radio] Admin mode enabled - broadcasting available");
        this.createAdminControls();
      }
    },

    async checkLiveStatus() {
      // Check API for current live stream status
      try {
        const response = await fetch('/api/radio/live-status');
        if (response.ok) {
          const data = await response.json();
          if (data.isLive) {
            this.startLiveStream(data.streamUrl, data.streamType, data.metadata);
          }
        }
      } catch (e) {
        console.log("[live-radio] No active live stream");
      }
    },

    setupEventListeners() {
      // Server-sent events for live stream updates
      if (window.EventSource) {
        const eventSource = new EventSource('/api/radio/live-events');
        
        eventSource.addEventListener('stream-started', (e) => {
          const data = JSON.parse(e.data);
          this.startLiveStream(data.url, data.type, data.metadata);
        });

        eventSource.addEventListener('stream-ended', () => {
          this.endLiveStream();
        });

        eventSource.addEventListener('chat-message', (e) => {
          const message = JSON.parse(e.data);
          this.addChatMessage(message);
        });
      }

      // Listen for audio element events
      this.audioElement.addEventListener('play', () => {
        console.log("[live-radio] Live stream playback started");
      });

      this.audioElement.addEventListener('error', (e) => {
        console.error("[live-radio] Stream error:", e);
        this.handleStreamError();
      });
    },

    startLiveStream(url, type = 'custom', metadata = {}) {
      console.log(`[live-radio] Starting live stream: ${type}`);

      this.isLive = true;
      this.streamUrl = url;
      this.streamType = type;

      // Show live indicator
      this.showLiveIndicator(metadata);

      // Notify all players
      this.notifyLiveStart(metadata);

      // Update radio player
      if (window.Game.modules.radioPlayer) {
        Game.modules.radioPlayer.switchToLiveStream(url, type);
      }

      // Enable chat
      this.chatEnabled = true;
      this.showChatInterface();

      // Play live stream audio
      if (type === 'direct' || type === 'custom') {
        this.audioElement.src = url;
        this.audioElement.play().catch(e => {
          console.error("[live-radio] Autoplay failed:", e);
          this.showPlayButton();
        });
      } else if (type === 'twitch' || type === 'youtube') {
        this.embedExternalStream(url, type);
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent('rexLiveStarted', {
        detail: { url, type, metadata }
      }));
    },

    endLiveStream() {
      console.log("[live-radio] Ending live stream");

      this.isLive = false;
      this.streamUrl = null;
      this.streamType = null;
      this.chatEnabled = false;

      // Hide live indicator
      this.hideLiveIndicator();

      // Stop audio
      this.audioElement.pause();
      this.audioElement.src = '';

      // Remove external embeds
      this.removeExternalEmbeds();

      // Hide chat
      this.hideChatInterface();

      // Return to regular programming
      if (window.Game.modules.radioPlayer) {
        Game.modules.radioPlayer.returnToRegularProgramming();
      }

      // Notify players
      this.notifyLiveEnd();

      // Dispatch event
      window.dispatchEvent(new CustomEvent('rexLiveEnded'));
    },

    showLiveIndicator(metadata = {}) {
      // Create or update live indicator in UI
      let indicator = document.getElementById('rex-live-indicator');
      
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'rex-live-indicator';
        indicator.className = 'rex-live-indicator';
        document.body.appendChild(indicator);
      }

      const title = metadata.title || "LIVE FROM THE WASTELAND";
      const host = metadata.host || "Fizzmaster Rex";

      indicator.innerHTML = `
        <div class="live-badge">
          <span class="live-pulse">🔴</span>
          <span class="live-text">LIVE</span>
        </div>
        <div class="live-info">
          <div class="live-host">${host}</div>
          <div class="live-title">${title}</div>
        </div>
        <button id="rex-live-tune-in" class="pipboy-button-small">
          TUNE IN
        </button>
      `;

      indicator.style.display = 'flex';

      // Add click handler to tune in button
      document.getElementById('rex-live-tune-in').addEventListener('click', () => {
        this.tuneInToLive();
      });

      // Add animation
      indicator.classList.add('slide-in');
    },

    hideLiveIndicator() {
      const indicator = document.getElementById('rex-live-indicator');
      if (indicator) {
        indicator.classList.add('slide-out');
        setTimeout(() => {
          indicator.style.display = 'none';
          indicator.classList.remove('slide-out');
        }, 300);
      }
    },

    tuneInToLive() {
      // Open radio tab in Pip-Boy
      if (window.Game.modules.pipboy) {
        Game.modules.pipboy.openTab('radio');
      }

      // Start playing if not already
      if (this.audioElement.paused) {
        this.audioElement.play();
      }
    },

    notifyLiveStart(metadata = {}) {
      const title = metadata.title || "REX IS LIVE!";
      const message = `Fizzmaster Rex is broadcasting LIVE right now! Tune in to Atomic Fizz Radio!`;

      // Pip-Boy notification
      if (window.Game.modules.notifications) {
        Game.modules.notifications.show({
          title: title,
          message: message,
          icon: '🔴',
          duration: 10000,
          sound: '/audio/radio/rex_live_jingle.mp3'
        });
      } else {
        // Fallback to alert
        alert(`🔴 ${title}\n\n${message}`);
      }
    },

    notifyLiveEnd() {
      const message = "Rex has ended the live broadcast. Returning to regular programming.";

      if (window.Game.modules.notifications) {
        Game.modules.notifications.show({
          title: "Live Stream Ended",
          message: message,
          icon: '📻',
          duration: 5000
        });
      }
    },

    showChatInterface() {
      let chatContainer = document.getElementById('rex-live-chat');
      
      if (!chatContainer) {
        chatContainer = document.createElement('div');
        chatContainer.id = 'rex-live-chat';
        chatContainer.className = 'rex-live-chat';
        chatContainer.innerHTML = `
          <div class="chat-header">
            <span class="chat-title">📻 LIVE CHAT</span>
            <button id="chat-close" class="chat-close">✕</button>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-input-container">
            <input 
              type="text" 
              id="chat-input" 
              class="chat-input"
              placeholder="Send a message to Rex..."
              maxlength="200"
            />
            <button id="chat-send" class="chat-send">SEND</button>
          </div>
        `;
        document.body.appendChild(chatContainer);

        // Event listeners
        document.getElementById('chat-close').addEventListener('click', () => {
          chatContainer.classList.toggle('chat-minimized');
        });

        document.getElementById('chat-send').addEventListener('click', () => {
          this.sendChatMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.sendChatMessage();
          }
        });
      }

      chatContainer.style.display = 'flex';
      chatContainer.classList.add('fade-in');
    },

    hideChatInterface() {
      const chatContainer = document.getElementById('rex-live-chat');
      if (chatContainer) {
        chatContainer.classList.add('fade-out');
        setTimeout(() => {
          chatContainer.style.display = 'none';
          chatContainer.classList.remove('fade-out');
        }, 300);
      }
    },

    sendChatMessage() {
      const input = document.getElementById('chat-input');
      const message = input.value.trim();

      if (!message) return;

      const player = window.PLAYER || { name: 'Wastelander', id: 'anon' };

      const chatMessage = {
        userId: player.id,
        username: player.name,
        message: message,
        timestamp: Date.now()
      };

      // Send to server
      fetch('/api/radio/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatMessage)
      }).then(res => {
        if (res.ok) {
          input.value = '';
          console.log("[live-radio] Chat message sent");
        }
      }).catch(e => {
        console.error("[live-radio] Failed to send chat:", e);
      });
    },

    addChatMessage(message) {
      this.chatMessages.push(message);

      const messagesContainer = document.getElementById('chat-messages');
      if (!messagesContainer) return;

      const messageEl = document.createElement('div');
      messageEl.className = 'chat-message';
      
      const isRex = message.username === 'Rex' || message.isHost;
      if (isRex) {
        messageEl.classList.add('chat-message-host');
      }

      const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      messageEl.innerHTML = `
        <span class="chat-timestamp">[${time}]</span>
        <span class="chat-username">${message.username}:</span>
        <span class="chat-text">${this.escapeHtml(message.message)}</span>
      `;

      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Keep only last 100 messages
      if (messagesContainer.children.length > 100) {
        messagesContainer.removeChild(messagesContainer.firstChild);
      }
    },

    embedExternalStream(url, type) {
      // Create iframe for Twitch/YouTube embeds
      let embed = document.getElementById('rex-external-embed');
      
      if (!embed) {
        embed = document.createElement('iframe');
        embed.id = 'rex-external-embed';
        embed.className = 'rex-external-embed';
        embed.allow = 'autoplay; encrypted-media';
        embed.allowFullscreen = true;
        document.body.appendChild(embed);
      }

      if (type === 'twitch') {
        const channel = url.split('/').pop();
        const domain = window.location.hostname;
        embed.src = this.config.twitch.embedUrl
          .replace('{CHANNEL}', channel)
          .replace('{DOMAIN}', domain);
      } else if (type === 'youtube') {
        const videoId = this.extractYouTubeId(url);
        const domain = window.location.hostname;
        embed.src = this.config.youtube.embedUrl
          .replace('{VIDEO_ID}', videoId);
      }

      embed.style.display = 'block';
    },

    removeExternalEmbeds() {
      const embed = document.getElementById('rex-external-embed');
      if (embed) {
        embed.src = '';
        embed.style.display = 'none';
      }
    },

    extractYouTubeId(url) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    },

    // ADMIN CONTROLS
    createAdminControls() {
      // Create admin control panel for starting/stopping streams
      const panel = document.createElement('div');
      panel.id = 'rex-admin-controls';
      panel.className = 'rex-admin-controls';
      panel.innerHTML = `
        <div class="admin-header">
          <h3>🎙️ REX BROADCASTING CONTROLS</h3>
          <button id="admin-toggle">▼</button>
        </div>
        <div class="admin-body" id="admin-body">
          <div class="admin-status">
            Status: <span id="admin-status-text">OFFLINE</span>
          </div>
          
          <div class="admin-section">
            <label>Stream Type:</label>
            <select id="admin-stream-type" class="pipboy-select">
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube Live</option>
              <option value="custom">Custom RTMP/HLS</option>
              <option value="direct">Direct Audio URL</option>
            </select>
          </div>

          <div class="admin-section">
            <label>Stream URL/Channel:</label>
            <input 
              type="text" 
              id="admin-stream-url" 
              class="pipboy-input"
              placeholder="twitch.tv/yourchannel or direct URL"
            />
          </div>

          <div class="admin-section">
            <label>Broadcast Title:</label>
            <input 
              type="text" 
              id="admin-stream-title" 
              class="pipboy-input"
              placeholder="e.g., Late Night with Rex"
              value="LIVE FROM THE WASTELAND"
            />
          </div>

          <div class="admin-actions">
            <button id="admin-go-live" class="pipboy-button">
              🔴 GO LIVE
            </button>
            <button id="admin-end-stream" class="pipboy-button" disabled>
              ⏹️ END STREAM
            </button>
          </div>

          <div class="admin-section">
            <label>Quick Start Presets:</label>
            <button class="admin-preset" data-preset="twitch">Twitch</button>
            <button class="admin-preset" data-preset="youtube">YouTube</button>
            <button class="admin-preset" data-preset="test">Test Stream</button>
          </div>
        </div>
      `;

      document.body.appendChild(panel);

      // Event listeners
      document.getElementById('admin-toggle').addEventListener('click', () => {
        const body = document.getElementById('admin-body');
        body.classList.toggle('collapsed');
      });

      document.getElementById('admin-go-live').addEventListener('click', () => {
        this.adminGoLive();
      });

      document.getElementById('admin-end-stream').addEventListener('click', () => {
        this.adminEndStream();
      });

      // Preset buttons
      document.querySelectorAll('.admin-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const preset = e.target.dataset.preset;
          this.loadPreset(preset);
        });
      });
    },

    async adminGoLive() {
      const type = document.getElementById('admin-stream-type').value;
      const url = document.getElementById('admin-stream-url').value.trim();
      const title = document.getElementById('admin-stream-title').value.trim();

      if (!url) {
        alert("Please enter a stream URL or channel name");
        return;
      }

      const metadata = {
        title: title || "LIVE FROM THE WASTELAND",
        host: "Fizzmaster Rex",
        startTime: Date.now()
      };

      // Send to server to start live stream for all players
      try {
        const response = await fetch('/api/radio/start-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, type, metadata })
        });

        if (response.ok) {
          console.log("[live-radio] Live stream started successfully");
          document.getElementById('admin-status-text').textContent = 'LIVE';
          document.getElementById('admin-status-text').style.color = '#ff0000';
          document.getElementById('admin-go-live').disabled = true;
          document.getElementById('admin-end-stream').disabled = false;
          
          // Start locally too
          this.startLiveStream(url, type, metadata);
        } else {
          alert("Failed to start live stream. Check console for details.");
        }
      } catch (e) {
        console.error("[live-radio] Failed to start stream:", e);
        alert(`Error starting stream: ${e.message}`);
      }
    },

    async adminEndStream() {
      try {
        const response = await fetch('/api/radio/end-live', {
          method: 'POST'
        });

        if (response.ok) {
          console.log("[live-radio] Live stream ended");
          document.getElementById('admin-status-text').textContent = 'OFFLINE';
          document.getElementById('admin-status-text').style.color = '#888';
          document.getElementById('admin-go-live').disabled = false;
          document.getElementById('admin-end-stream').disabled = true;
          
          // End locally too
          this.endLiveStream();
        }
      } catch (e) {
        console.error("[live-radio] Failed to end stream:", e);
      }
    },

    loadPreset(preset) {
      const typeSelect = document.getElementById('admin-stream-type');
      const urlInput = document.getElementById('admin-stream-url');
      const titleInput = document.getElementById('admin-stream-title');

      if (preset === 'twitch') {
        typeSelect.value = 'twitch';
        urlInput.placeholder = 'twitch.tv/yourchannel';
        titleInput.value = "Live from Rex's Studio";
      } else if (preset === 'youtube') {
        typeSelect.value = 'youtube';
        urlInput.placeholder = 'youtube.com/watch?v=VIDEO_ID';
        titleInput.value = "Streaming Live on YouTube";
      } else if (preset === 'test') {
        typeSelect.value = 'direct';
        urlInput.value = 'https://stream.radiojar.com/example.mp3';
        titleInput.value = "Test Broadcast";
      }
    },

    handleStreamError() {
      console.error("[live-radio] Stream error occurred");
      
      if (window.Game.modules.notifications) {
        Game.modules.notifications.show({
          title: "Stream Error",
          message: "Connection to live stream lost. Reconnecting...",
          icon: '⚠️',
          duration: 5000
        });
      }

      // Try to reconnect after delay
      setTimeout(() => {
        if (this.isLive && this.streamUrl) {
          console.log("[live-radio] Attempting reconnect...");
          this.audioElement.load();
          this.audioElement.play();
        }
      }, 5000);
    },

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // Public API
    isStreamLive() {
      return this.isLive;
    },

    getCurrentStreamUrl() {
      return this.streamUrl;
    },

    getStreamType() {
      return this.streamType;
    }
  };

  Game.modules.liveRadioStreaming = liveRadioStreaming;

  // Auto-initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => liveRadioStreaming.init());
  } else {
    liveRadioStreaming.init();
  }

  // Global shorthand
  window.rexLive = liveRadioStreaming;

})();
