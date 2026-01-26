(function () {
  "use strict";

  // ============================================================
  // CONFIG
  // ============================================================

  const RADIO_CONFIG = {
    minTracksBetweenEvents: 1,
    maxTracksBetweenEvents: 3,
    crossfadeDuration: 2000,
    knobSelector: "#radioKnob",
    staticDuration: 500, // Duration of static noise during tuning (ms)
    stations: [
      {
        id: "atomic_fizz_radio",
        name: "Atomic Fizz Radio",
        frequency: 91.5,
        playlistUrl: "/audio/radio/playlist.json",
        stationUrl: "/audio/radio/station.json"
      },
      {
        id: "mojave_nights",
        name: "Mojave Nights",
        frequency: 97.3,
        playlistUrl: "/audio/radio/playlist-mojave.json",
        stationUrl: "/audio/radio/station-mojave.json"
      },
      {
        id: "wasteland_swing",
        name: "Wasteland Swing",
        frequency: 103.7,
        playlistUrl: "/audio/radio/playlist-swing.json",
        stationUrl: "/audio/radio/station-swing.json"
      }
    ]
  };

  // ============================================================
  // UTILS
  // ============================================================

  const randInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const pickRandom = arr =>
    !arr || !arr.length ? null : arr[Math.floor(Math.random() * arr.length)];

  const safeFetchJSON = async (url, fallback = null) => {
    try {
      // Normalize input: accept strings or simple objects that reference a URL/file
      let input = url;
      if (typeof input === 'object' && input !== null) {
        if (typeof input.url === 'string') input = input.url;
        else if (typeof input.file === 'string') input = input.file;
        else if (typeof input.stationUrl === 'string') input = input.stationUrl;
        else {
          console.warn('[Radio] safeFetchJSON received non-string object, returning fallback', input);
          return fallback;
        }
      }

      if (typeof input !== 'string') {
        console.warn('[Radio] safeFetchJSON received invalid URL type, returning fallback', input);
        return fallback;
      }

      const fullUrl = input.startsWith('/api/') ? `${window.API_BASE}${input}` : input;
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[Radio] Failed to fetch ${typeof url === 'string' ? url : JSON.stringify(url)}:`, err);
      return fallback;
    }
  };

  // ============================================================
  // AtomicFizzStation — handles station metadata + content
  // ============================================================

  class AtomicFizzStation {
    constructor(meta) {
      this.id = meta.id;
      this.name = meta.name;
      this.frequency = meta.frequency || 87.5;
      this.playlistUrl = meta.playlistUrl;
      this.stationUrl = meta.stationUrl;

      this.playlist = [];
      this.station = null;

      this.dj = null;
      this.bumpers = [];
      this.ads = [];
      this.psas = [];
      this.lore = [];

      this.ready = false;
    }

    async load() {
      console.log(`[Radio] Loading station: ${this.name}`);

      const playlist = await safeFetchJSON(this.playlistUrl, []);
      const station = await safeFetchJSON(this.stationUrl, {});

      this.playlist = Array.isArray(playlist)
        ? playlist
        : playlist.tracks || [];

      this.station = station;

      const linked = [
        ["dj", "clips"],
        ["bumpers", "bumpers"],
        ["ads", "ads"],
        ["psas", "psas"],
        ["lore", "lore"]
      ];

      const promises = linked.map(async ([key, field]) => {
        const url = station[key];
        if (!url) return;

        const data = await safeFetchJSON(url, null);
        if (!data) return;

        if (key === "dj") {
          this.dj = data;
        } else {
          this[key] = data[field] || [];
        }
      });

      await Promise.all(promises);

      this.ready = true;
      console.log(`[Radio] Station ready: ${this.name}`);
    }

    // Random content getters
    getRandomTrack() { return pickRandom(this.playlist); }
    getRandomDJIntro() { return this.dj?.clips?.intros ? pickRandom(this.dj.clips.intros) : null; }
    getRandomDJOutro() { return this.dj?.clips?.outros ? pickRandom(this.dj.clips.outros) : null; }
    getRandomBumper() { return pickRandom(this.bumpers); }
    getRandomAd() { return pickRandom(this.ads); }
    getRandomPSA() { return pickRandom(this.psas); }
    getRandomLore() { return pickRandom(this.lore); }
  }

  // ============================================================
  // AtomicFizzRadioPlayer — multi-station engine
  // ============================================================

  class AtomicFizzRadioPlayer {
    constructor(config) {
      this.config = config;
      this.stations = new Map();
      this.currentStationId = null;

      // Two audio elements for crossfade
      this.audioA = new Audio();
      this.audioB = new Audio();
      this.audioA.volume = 0.7;
      this.audioB.volume = 0.0;

      this.activeAudio = this.audioA;
      this.inactiveAudio = this.audioB;

      this.tracksSinceEvent = 0;
      this.nextEventAt = randInt(
        config.minTracksBetweenEvents,
        config.maxTracksBetweenEvents
      );

      this.isFading = false;
      this.isPlayingEvent = false;
      this.fadeInterval = null;
      this.staticAudio = null;

      this._bindEvents();
      this._initStations();
      this._createDialUI();
    }

    // ------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------

    _bindEvents() {
      const onEnded = () => {
        if (!this.isFading) this._onTrackEnded();
      };

      this.audioA.addEventListener("ended", onEnded);
      this.audioB.addEventListener("ended", onEnded);

      if (this.config.knobSelector) {
        const knob = document.querySelector(this.config.knobSelector);
        if (knob) {
          knob.addEventListener("click", () => this.cycleStation());
        }
      }

      const cycleBtn = document.getElementById("radioCycleBtn");
      if (cycleBtn) {
        cycleBtn.addEventListener("click", () => this.cycleStation());
      }
    }

    async _initStations() {
      console.log("[Radio] Initializing stations…");

      for (const meta of this.config.stations) {
        const station = new AtomicFizzStation(meta);
        this.stations.set(meta.id, station);
        station.load().catch(err =>
          console.warn(`[Radio] Failed to load station ${meta.id}:`, err)
        );
      }

      if (this.config.stations.length > 0) {
        this.currentStationId = this.config.stations[0].id;
      }

      setTimeout(() => this.start(), 1000);
    }

    get currentStation() {
      return this.stations.get(this.currentStationId) || null;
    }

    // ------------------------------------------------------------
    // Start Radio
    // ------------------------------------------------------------

    start() {
      const station = this.currentStation;
      this._updateStationDisplay();
      if (!station || !station.ready) {
        console.warn("[Radio] No ready station to start");
        return;
      }

      console.log(`[Radio] Starting station: ${station.name}`);

      // ⭐ QUEST HOOK: Wake Up → turn_on_radio
      Game.quests?.completeObjective("wake_up", "turn_on_radio");

      this._playNext();
    }

    // ------------------------------------------------------------
    // Station Switching
    // ------------------------------------------------------------

    cycleStation() {
      const ids = Array.from(this.stations.keys());
      if (!ids.length) return;

      const idx = ids.indexOf(this.currentStationId);
      const nextIdx = (idx + 1) % ids.length;
      
      const fromStation = this.currentStation;
      this.currentStationId = ids[nextIdx];
      const toStation = this.currentStation;

      console.log(`[Radio] Switched to station: ${toStation?.name || "Unknown"}`);
      
      // ⚠️ CRITICAL FIX: Properly stop all audio playback
      // Clear any active crossfade intervals
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }

      // Stop and reset both audio elements
      this.audioA.pause();
      this.audioA.currentTime = 0;
      this.audioA.src = "";
      
      this.audioB.pause();
      this.audioB.currentTime = 0;
      this.audioB.src = "";

      // Reset volumes
      this.audioA.volume = 0.7;
      this.audioB.volume = 0.0;

      // Reset active/inactive pointers
      this.activeAudio = this.audioA;
      this.inactiveAudio = this.audioB;
      this.isFading = false;

      // Update UI with animation
      this._updateStationDisplay();
      this._animateDial(fromStation, toStation);
      
      // Play static noise during tuning
      this._playStaticNoise();

      // Start playing the new station after static
      setTimeout(() => {
        this._playNext(true);
      }, this.config.staticDuration);
    }

    _updateStationDisplay() {
      const label = document.getElementById("currentStation");
      if (!label) return;
      const station = this.currentStation;
      label.textContent = station?.name || "NO SIGNAL";
    }

    // ------------------------------------------------------------
    // Playback Logic
    // ------------------------------------------------------------

    _onTrackEnded() {
      if (this.isPlayingEvent) {
        this.isPlayingEvent = false;
        this._playNext();
        return;
      }

      this.tracksSinceEvent++;

      if (this.tracksSinceEvent >= this.nextEventAt) {
        this._playEvent();
      } else {
        this._playNext();
      }
    }

    _playNext(forceMusic = false) {
      const station = this.currentStation;
      if (!station?.ready) {
        console.warn("[Radio] Station not ready");
        return;
      }

      if (!forceMusic && this.tracksSinceEvent >= this.nextEventAt) {
        this._playEvent();
        return;
      }

      const track = station.getRandomTrack();
      if (!track) {
        console.warn("[Radio] No tracks available");
        return;
      }

      this.tracksSinceEvent++;
      this._setSourceAndPlay(track.file, false);
    }

    _playEvent() {
      const station = this.currentStation;
      if (!station?.ready) {
        this._playNext(true);
        return;
      }

      const eventTypes = ["djIntro", "bumper", "ad", "psa", "lore"];
      const type = pickRandom(eventTypes);

      let file = null;

      switch (type) {
        case "djIntro": file = station.getRandomDJIntro(); break;
        case "bumper": file = station.getRandomBumper()?.file; break;
        case "ad": file = station.getRandomAd()?.file; break;
        case "psa": file = station.getRandomPSA()?.file; break;
        case "lore": file = station.getRandomLore()?.file; break;
      }

      if (!file) {
        this.tracksSinceEvent = 0;
        this.nextEventAt = randInt(
          this.config.minTracksBetweenEvents,
          this.config.maxTracksBetweenEvents
        );
        this._playNext(true);
        return;
      }

      this.isPlayingEvent = true;
      this.tracksSinceEvent = 0;
      this.nextEventAt = randInt(
        this.config.minTracksBetweenEvents,
        this.config.maxTracksBetweenEvents
      );

      this._setSourceAndPlay(file, true);
    }

    // ------------------------------------------------------------
    // Audio Handling
    // ------------------------------------------------------------

    _setSourceAndPlay(file, isEvent) {
      const station = this.currentStation;
      if (!station) return;

      const active = this.activeAudio;
      const inactive = this.inactiveAudio;

      inactive.pause();
      inactive.currentTime = 0;

      const src =
        file.startsWith("/") || file.startsWith("http")
          ? file
          : `/audio/radio/tracks/${file}`;

      inactive.src = src;

      console.log(`[Radio] Playing: ${src}`);

      this._crossfade(active, inactive, () => {
        this.activeAudio = inactive;
        this.inactiveAudio = active;
      });

      inactive.play().catch(e => console.warn("[Radio] Play error:", e));
    }

    _crossfade(fromAudio, toAudio, onComplete) {
      this.isFading = true;

      const duration = this.config.crossfadeDuration;
      const steps = 20;
      const stepTime = duration / steps;

      let step = 0;

      const fromStartVol = fromAudio.volume;
      const toStartVol = toAudio.volume;
      const targetVol = 0.7;

      const fadeInterval = setInterval(() => {
        step++;
        const t = step / steps;

        fromAudio.volume = fromStartVol * (1 - t);
        toAudio.volume = toStartVol + (targetVol - toStartVol) * t;

        if (step >= steps) {
          clearInterval(fadeInterval);
          fromAudio.volume = 0.0;
          toAudio.volume = targetVol;
          this.isFading = false;
          if (typeof onComplete === "function") onComplete();
        }
      }, stepTime);
      
      // Store reference to interval for cleanup
      this.fadeInterval = fadeInterval;
    }

    // ------------------------------------------------------------
    // Vintage 50s Radio Dial UI
    // ------------------------------------------------------------

    _createDialUI() {
      // Check if dial container already exists or if we should create it
      const existingDial = document.getElementById("radioDialContainer");
      if (existingDial) return;

      // Find the radio controls container to inject the dial
      const radioControls = document.getElementById("radioControls");
      if (!radioControls) {
        console.warn("[Radio] Cannot create dial: #radioControls not found");
        return;
      }

      // Create the dial HTML structure
      const dialHTML = `
        <div id="radioDialContainer" class="radio-dial-container">
          <div class="radio-dial">
            <div class="radio-dial-face">
              <div class="radio-frequency-markers">
                ${this._generateFrequencyMarkers()}
              </div>
              <div class="radio-needle" id="radioNeedle"></div>
              <div class="radio-center-knob"></div>
            </div>
          </div>
          <div class="radio-station-display">
            <div class="radio-station-name" id="radioStationName">ATOMIC FIZZ RADIO</div>
            <div class="radio-frequency-display" id="radioFrequencyDisplay">91.5 FM</div>
          </div>
        </div>
      `;

      // Insert before the station label or at the beginning
      const stationLabel = document.getElementById("currentStation");
      if (stationLabel && stationLabel.parentNode === radioControls) {
        stationLabel.insertAdjacentHTML("beforebegin", dialHTML);
      } else {
        radioControls.insertAdjacentHTML("afterbegin", dialHTML);
      }

      // Initialize needle position
      this._updateStationIndicator();
    }

    _generateFrequencyMarkers() {
      // Generate frequency markers from 87.5 to 108.0 FM
      let markers = "";
      const frequencies = [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108];
      
      frequencies.forEach((freq, index) => {
        const angle = -135 + (index * 27); // Distribute across 270 degrees
        markers += `
          <div class="frequency-marker" style="transform: rotate(${angle}deg)">
            <span class="frequency-text">${freq}</span>
          </div>
        `;
      });

      return markers;
    }

    _animateDial(fromStation, toStation) {
      const needle = document.getElementById("radioNeedle");
      if (!needle) return;

      const dialContainer = document.getElementById("radioDialContainer");
      if (dialContainer) {
        dialContainer.classList.add("radio-tuning");
        setTimeout(() => {
          dialContainer.classList.remove("radio-tuning");
        }, this.config.staticDuration);
      }

      // Calculate needle rotation based on frequency
      const minFreq = 87.5;
      const maxFreq = 108.0;
      const angleRange = 270; // Degrees of rotation (-135 to +135)

      const toFreq = toStation?.frequency || 91.5;
      const progress = (toFreq - minFreq) / (maxFreq - minFreq);
      const angle = -135 + (progress * angleRange);

      // Animate the needle
      needle.style.transform = `rotate(${angle}deg)`;

      // Update station indicator
      this._updateStationIndicator();
    }

    _updateStationIndicator() {
      const station = this.currentStation;
      if (!station) return;

      const nameDisplay = document.getElementById("radioStationName");
      const freqDisplay = document.getElementById("radioFrequencyDisplay");

      if (nameDisplay) {
        nameDisplay.textContent = station.name.toUpperCase();
      }

      if (freqDisplay) {
        freqDisplay.textContent = `${station.frequency} FM`;
      }

      // Also update needle position if not animating
      const needle = document.getElementById("radioNeedle");
      if (needle && !needle.style.transform) {
        const minFreq = 87.5;
        const maxFreq = 108.0;
        const angleRange = 270;
        const progress = (station.frequency - minFreq) / (maxFreq - minFreq);
        const angle = -135 + (progress * angleRange);
        needle.style.transform = `rotate(${angle}deg)`;
      }
    }

    _playStaticNoise() {
      // Create synthetic static noise using Web Audio API
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.warn("[Radio] Web Audio API not supported for static noise");
        return;
      }

      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create white noise buffer
        const bufferSize = audioContext.sampleRate * (this.config.staticDuration / 1000);
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        // Generate white noise using crypto for quality
        const noiseData = new Uint8Array(bufferSize);
        window.crypto.getRandomValues(noiseData);
        
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (noiseData[i] / 128) - 1.0;
        }

        // Create source and gain nodes
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = 0.15; // Quiet static
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Play the static
        source.start(0);

        // Clean up after playing
        setTimeout(() => {
          try {
            source.stop();
            audioContext.close();
          } catch (e) {
            console.warn("[Radio] Error stopping static:", e);
          }
        }, this.config.staticDuration);

      } catch (err) {
        console.warn("[Radio] Failed to play static noise:", err);
      }
    }
  }

  // ============================================================
  // GLOBAL HOOK
  // ============================================================

  window.AtomicFizzRadioPlayer = AtomicFizzRadioPlayer;

  window.addEventListener("pipboyReady", () => {
    // ⚠️ SINGLETON PROTECTION: Prevent multiple radio player instances
    // The pipboyReady event can be dispatched multiple times (boot.js + pipboy.js)
    // Only create one radio player instance to prevent audio overlap
    if (window._radioPlayer) {
      console.log("[Radio] Radio player already initialized, skipping duplicate initialization");
      return;
    }
    
    try {
      console.log("[Radio] Pip‑Boy ready → starting AtomicFizzRadioPlayer");
      window._radioPlayer = new AtomicFizzRadioPlayer(RADIO_CONFIG);
    } catch (e) {
      console.warn("[Radio] Failed to start radio player:", e);
    }
  });
})();
