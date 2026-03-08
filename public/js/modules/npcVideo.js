// public/js/modules/npcVideo.js — Grok NPC Video Feed
// Adds an optional "📡 VIDEO FEED" button to NPC dialog portraits.
// On click, requests an AI-generated video of the NPC from the backend
// and displays it inside the portrait container, Pip-Boy style.
(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // ----------------------------------------------------------------
  // Internal state
  // ----------------------------------------------------------------
  var _state = null; // { npcId, npcName, portrait, dialogText }
  var _btn   = null; // reference to the injected button element

  // ----------------------------------------------------------------
  // Utility: safe HTML escape (falls back to a local impl if global
  // escapeHtml is not available — matches the global one in convention)
  // ----------------------------------------------------------------
  function safeEscape(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(str));
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ----------------------------------------------------------------
  // Get auth token from window.authToken (set by wallet auth flow)
  // ----------------------------------------------------------------
  function getAuthHeader() {
    var token = window.authToken || (window.Game && Game.authToken);
    if (token && typeof token === 'string') {
      return { Authorization: 'Bearer ' + token };
    }
    return {};
  }

  // ----------------------------------------------------------------
  // Get or create the VIDEO FEED button inside #dialogPortraitContainer
  // ----------------------------------------------------------------
  function getOrCreateButton(container) {
    // Reuse existing button if it belongs to this container
    if (_btn && container.contains(_btn)) return _btn;

    // Remove any stale button from a previous dialog
    var stale = container.querySelector('.npc-video-btn');
    if (stale) stale.remove();

    var btn = document.createElement('button');
    btn.className = 'npc-video-btn';
    btn.setAttribute('aria-label', 'Generate AI video of this NPC');

    // Pip-Boy green terminal style — matches inline style requirements
    btn.style.cssText = [
      'color: #00ff41',
      'background: rgba(0,20,10,0.8)',
      'border: 1px solid #00ff41',
      'font-size: 10px',
      'padding: 3px 6px',
      'cursor: pointer',
      'position: absolute',
      'bottom: 4px',
      'right: 4px',
      'z-index: 10',
      'font-family: inherit',
      'letter-spacing: 0.05em',
    ].join(';');

    btn.textContent = '📡 VIDEO FEED';
    container.style.position = 'relative'; // ensure absolute positioning works
    container.appendChild(btn);

    btn.addEventListener('click', _onButtonClick);
    _btn = btn;
    return btn;
  }

  // ----------------------------------------------------------------
  // Button click handler
  // ----------------------------------------------------------------
  function _onButtonClick() {
    if (!_state) return;

    var container = document.getElementById('dialogPortraitContainer');
    if (!container) return;

    // Disable button while transmitting
    _btn.disabled = true;
    _btn.textContent = '⏳ TRANSMITTING...';

    // Clone the portrait's current DOM tree so we can restore it safely on error
    // (cloneNode avoids any innerHTML re-parsing / XSS risk)
    var savedClone = container.cloneNode(true);

    // POST to backend
    var payload = {
      npcId:      _state.npcId,
      npcName:    _state.npcName,
      portrait:   _state.portrait   || '',
      dialogText: _state.dialogText || '',
    };

    fetch('/api/npc/video/generate', {
      method:  'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body:    JSON.stringify(payload),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.url) {
          _showVideo(container, data.url);
        } else {
          _showSignalLost(container, savedClone);
        }
      })
      .catch(function (err) {
        console.warn('[npcVideo] fetch error:', err);
        _showSignalLost(container, savedClone);
      });
  }

  // ----------------------------------------------------------------
  // Display the generated video in the portrait container
  // ----------------------------------------------------------------
  function _showVideo(container, url) {
    // Build video element
    var video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop',     '');
    video.setAttribute('muted',    '');
    video.setAttribute('controls', '');
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    video.src = url;

    // Unmute toggle button
    var unmuteBtn = document.createElement('button');
    unmuteBtn.style.cssText = [
      'position:absolute',
      'top:4px',
      'left:4px',
      'z-index:11',
      'color:#00ff41',
      'background:rgba(0,20,10,0.8)',
      'border:1px solid #00ff41',
      'font-size:10px',
      'padding:3px 6px',
      'cursor:pointer',
    ].join(';');
    unmuteBtn.textContent = '🔇 UNMUTE';
    unmuteBtn.setAttribute('aria-label', 'Unmute NPC video');
    unmuteBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      unmuteBtn.textContent = video.muted ? '🔇 UNMUTE' : '🔊 MUTE';
    });

    // Replace portrait content (keep relative positioning)
    container.style.position = 'relative';
    // Clear with safe DOM removal — no innerHTML assignment
    while (container.firstChild) { container.removeChild(container.firstChild); }
    container.appendChild(video);
    container.appendChild(unmuteBtn);

    // Re-add VIDEO FEED button as REFRESH
    _btn = null; // force recreation
    var btn = getOrCreateButton(container);
    btn.disabled = false;
    btn.textContent = '🔄 REFRESH FEED';
  }

  // ----------------------------------------------------------------
  // Show a temporary "SIGNAL LOST" message then restore portrait
  // ----------------------------------------------------------------
  function _showSignalLost(container, savedClone) {
    // Show a brief signal-lost overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,10,5,0.85)',
      'color:#00ff41',
      'font-size:12px',
      'z-index:20',
      'pointer-events:none',
      'letter-spacing:0.1em',
    ].join(';');
    // Safe: textContent only — no innerHTML with user data
    overlay.textContent = '📡 SIGNAL LOST';
    container.style.position = 'relative';
    container.appendChild(overlay);

    setTimeout(function () {
      if (!container) return;
      // Restore original portrait via cloned DOM — no innerHTML used
      while (container.firstChild) { container.removeChild(container.firstChild); }
      // Re-attach each saved child from the clone
      while (savedClone.firstChild) {
        container.appendChild(savedClone.firstChild);
      }
      // Re-inject button if dialog is still open
      if (_state) {
        _btn = null;
        var btn = getOrCreateButton(container);
        btn.disabled = false;
        btn.textContent = '📡 VIDEO FEED';
      }
    }, 3000);
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  var NpcVideo = {

    /**
     * Called when a dialog panel opens.
     * Stores the NPC metadata and injects the VIDEO FEED button.
     * Does NOT auto-trigger video generation.
     *
     * @param {Object} dialog  — the dialog definition object from narrative.js
     */
    prepare: function (dialog) {
      if (!dialog) return;

      _state = {
        npcId:      String(dialog.id      || dialog.npcId      || ''),
        npcName:    String(dialog.npcName  || dialog.name       || 'Unknown'),
        portrait:   String(dialog.portrait || dialog.avatarType || ''),
        dialogText: String(dialog.intro    || dialog.text       || dialog.dialogText || ''),
      };

      // Trim dialogText to the validation limit so we don't fail server-side
      if (_state.dialogText.length > 200) {
        _state.dialogText = _state.dialogText.slice(0, 200);
      }

      // Inject button (may already exist from a previous prepare() call)
      var container = document.getElementById('dialogPortraitContainer');
      if (!container) return;

      var btn = getOrCreateButton(container);
      btn.disabled = false;
      btn.textContent = '📡 VIDEO FEED';
    },

    /**
     * Called when the dialog panel closes.
     * Removes the button and clears internal state.
     */
    clear: function () {
      _state = null;
      if (_btn) {
        try { _btn.remove(); } catch (e) { /* ignore */ }
        _btn = null;
      }
    },
  };

  Game.modules.NpcVideo = NpcVideo;
  console.log('[npcVideo] module registered');
})();
