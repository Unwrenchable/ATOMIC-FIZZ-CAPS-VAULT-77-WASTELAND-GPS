// public/js/modules/npcVideo.js — Per-Node NPC Video Feed
// Videos auto-play when a dialog node renders, swap as conversation branches.
// Pre-baked MP4s served from CDN via /data/npc-videos.json manifest (v2).
// Falls back to live xAI generation when no pre-baked video exists for a node.
(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // ----------------------------------------------------------------
  // Internal state
  // ----------------------------------------------------------------
  var _npcState   = null;   // { npcId, npcName, portrait } — set on dialog open
  var _manifest   = null;   // cached /data/npc-videos.json npcs map
  var _currentVid = null;   // active <video> element
  var _container  = null;   // #dialogPortraitContainer ref
  var _savedHTML  = null;   // original portrait innerHTML for restore

  // ----------------------------------------------------------------
  // Safe HTML escape
  // ----------------------------------------------------------------
  function safeEscape(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(str));
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ----------------------------------------------------------------
  // Auth header for live generation fallback
  // ----------------------------------------------------------------
  function getAuthHeader() {
    var token = window.authToken || (window.Game && Game.authToken);
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  // ----------------------------------------------------------------
  // Load and cache the manifest once
  // ----------------------------------------------------------------
  function _loadManifest() {
    if (_manifest !== null) return Promise.resolve(_manifest);
    return fetch('/data/npc-videos.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        _manifest = (data && data.npcs) ? data.npcs : {};
        return _manifest;
      })
      .catch(function () { _manifest = {}; return _manifest; });
  }

  // ----------------------------------------------------------------
  // Look up a pre-baked video path: npcId + nodeId
  // Manifest v2 format: { npcs: { npcId: { nodeId: "/path.mp4" } } }
  // Also accepts fallback legacy format: { npcs: { npcId: { path: "/path.mp4" } } }
  // ----------------------------------------------------------------
  function _getPrebakedPath(npcId, nodeId, manifest) {
    var npcEntry = manifest && manifest[npcId];
    if (!npcEntry) return null;

    // v2: per-node map
    if (nodeId && typeof npcEntry[nodeId] === 'string') return npcEntry[nodeId];

    // v2: "intro" is the default fallback within an NPC's node map
    if (typeof npcEntry['intro'] === 'string') return npcEntry['intro'];

    // legacy v1: single path per NPC
    if (typeof npcEntry.path === 'string') return npcEntry.path;

    return null;
  }

  // ----------------------------------------------------------------
  // Inject or update the video element inside the portrait container.
  // Saves the original portrait markup so we can restore it on close.
  // ----------------------------------------------------------------
  function _injectVideo(videoUrl) {
    _container = document.getElementById('dialogPortraitContainer');
    if (!_container) return;

    // Save original portrait once per dialog session
    if (_savedHTML === null) {
      _savedHTML = _container.innerHTML;
    }

    // Pause/remove previous video cleanly
    _removeCurrentVideo();

    // Build video element
    var vid = document.createElement('video');
    vid.autoplay = true;
    vid.loop     = true;
    vid.muted    = true;
    vid.playsInline = true;
    vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;';
    vid.src = videoUrl;

    // Mute toggle button
    var muteBtn = document.createElement('button');
    muteBtn.style.cssText = [
      'position:absolute', 'bottom:4px', 'left:4px', 'z-index:12',
      'color:#00ff41', 'background:rgba(0,20,10,0.85)',
      'border:1px solid #00ff41', 'font-size:9px',
      'padding:2px 5px', 'cursor:pointer', 'font-family:inherit',
    ].join(';');
    muteBtn.textContent = '🔇';
    muteBtn.setAttribute('aria-label', 'Toggle video audio');
    muteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      vid.muted = !vid.muted;
      muteBtn.textContent = vid.muted ? '🔇' : '🔊';
    });

    // Skip / restore portrait button
    var skipBtn = document.createElement('button');
    skipBtn.style.cssText = [
      'position:absolute', 'bottom:4px', 'right:4px', 'z-index:12',
      'color:#888', 'background:rgba(0,10,5,0.8)',
      'border:1px solid #444', 'font-size:9px',
      'padding:2px 5px', 'cursor:pointer', 'font-family:inherit',
    ].join(';');
    skipBtn.textContent = '✕ SKIP';
    skipBtn.setAttribute('aria-label', 'Skip video and restore portrait');
    skipBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      _restorePortrait();
    });

    // Replace portrait content
    _container.style.position = 'relative';
    while (_container.firstChild) { _container.removeChild(_container.firstChild); }
    _container.appendChild(vid);
    _container.appendChild(muteBtn);
    _container.appendChild(skipBtn);

    _currentVid = vid;

    // On ended: loop is on so this fires only on error — restore portrait
    vid.addEventListener('error', function () {
      console.warn('[npcVideo] video error, restoring portrait');
      _restorePortrait();
    });
  }

  // ----------------------------------------------------------------
  // Remove active video element without wiping container
  // ----------------------------------------------------------------
  function _removeCurrentVideo() {
    if (_currentVid) {
      try { _currentVid.pause(); _currentVid.src = ''; } catch (_) {}
      _currentVid = null;
    }
  }

  // ----------------------------------------------------------------
  // Restore the original NPC portrait
  // ----------------------------------------------------------------
  function _restorePortrait() {
    _removeCurrentVideo();
    if (_container && _savedHTML !== null) {
      _container.innerHTML = _savedHTML;
    }
    _savedHTML = null;
  }

  // ----------------------------------------------------------------
  // Fetch a live xAI video and inject it (fallback when no prebake)
  // ----------------------------------------------------------------
  function _fetchLiveVideo(npcId, npcName, portrait, dialogText) {
    if (!npcId) return;

    var payload = {
      npcId:      npcId,
      npcName:    npcName    || 'Unknown',
      portrait:   portrait   || '',
      dialogText: (dialogText || '').slice(0, 200),
    };

    fetch('/api/npc/video/generate', {
      method:  'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body:    JSON.stringify(payload),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.url) {
          _injectVideo(data.url);
        }
        // If no URL — silently leave portrait as-is
      })
      .catch(function (err) {
        console.warn('[npcVideo] live generation error:', err);
      });
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  var NpcVideo = {

    /**
     * Called by narrative.js when a dialog panel OPENS.
     * Stores NPC metadata for later node video lookups.
     * Kicks off manifest prefetch so first node plays instantly.
     *
     * @param {Object} dialog — full dialog definition object
     */
    prepare: function (dialog) {
      if (!dialog) return;

      _savedHTML  = null;   // reset so portrait saves fresh on first node
      _currentVid = null;

      _npcState = {
        npcId:    String(dialog.id      || dialog.npcId  || ''),
        npcName:  String(dialog.npcName || dialog.npc    || dialog.name || 'Unknown'),
        portrait: String(dialog.portrait || dialog.avatarType || ''),
      };

      // Prefetch manifest so playForNode() has it ready
      _loadManifest();
    },

    /**
     * Called by narrative.js each time a node renders.
     * Auto-plays the matching pre-baked video, or falls back to live generation.
     *
     * @param {Object} node   — the dialog node being rendered
     * @param {Object} dialog — full dialog definition
     */
    playForNode: function (node, dialog) {
      if (!node || !_npcState) return;

      var npcId  = _npcState.npcId;
      var nodeId = node.id || '';

      // Strip HTML from node text for prompt context
      var rawText = (node.text || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

      _loadManifest().then(function (manifest) {
        var prebakedPath = _getPrebakedPath(npcId, nodeId, manifest);

        if (prebakedPath) {
          console.log('[npcVideo] pre-baked:', npcId, nodeId, prebakedPath);
          _injectVideo(prebakedPath);
        } else {
          // Fallback: live generation — fire-and-forget (portrait stays until video arrives)
          console.log('[npcVideo] no prebake for', npcId, nodeId, '— requesting live generation');
          _fetchLiveVideo(npcId, _npcState.npcName, _npcState.portrait, rawText);
        }
      });
    },

    /**
     * Called by narrative.js when the dialog panel CLOSES.
     * Cleans up video and restores portrait.
     */
    clear: function () {
      _restorePortrait();
      _npcState   = null;
      _container  = null;
      _savedHTML  = null;
    },
  };

  Game.modules.NpcVideo = NpcVideo;
  console.log('[npcVideo] module registered (v2 — per-node auto-play)');
})();
