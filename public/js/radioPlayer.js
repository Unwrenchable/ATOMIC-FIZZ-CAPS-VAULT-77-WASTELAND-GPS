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
    stations: [
      {
        id: "atomic_fizz_radio",
        name: "Atomic Fizz Radio",
        playlistUrl: "/audio/radio/playlist.json",
        stationUrl: "/audio/radio/station.json"
      },
      {
        id: "mojave_nights",
        name: "Mojave Nights",
        playlistUrl: "/audio/radio/playlist-mojave.json",
        stationUrl: "/audio/radio/station-mojave.json"
      },
      {
        id: "wasteland_swing",
        name: "Wasteland Swing",
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
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[Radio] Failed to fetch ${url}:`, err);
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

      this._bindEvents();
      this._initStations();
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
      this.currentStationId = ids[nextIdx];

      const station = this.currentStation;
      console.log(`[Radio] Switched to station: ${station?.name || "Unknown"}`);
      this._updateStationDisplay();

      this.audioA.pause();
      this.audioB.pause();
      this._playNext(true);
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
    }
  }

  // ============================================================
  // GLOBAL HOOK
  // ============================================================

  window.AtomicFizzRadioPlayer = AtomicFizzRadioPlayer;

  window.addEventListener("pipboyReady", () => {
    try {
      console.log("[Radio] Pip‑Boy ready → starting AtomicFizzRadioPlayer");
      window._radioPlayer = new AtomicFizzRadioPlayer(RADIO_CONFIG);
    } catch (e) {
      console.warn("[Radio] Failed to start radio player:", e);
    }
  });
})();
