// ------------------------------------------------------------
// Atomic Fizz RadioPlayer — Multi‑Station, DJ, Bumpers, Ads, PSAs, Lore
// ------------------------------------------------------------
// Features:
// - Multi‑station support (radio knob style)
// - Playlist loading per station
// - DJ intros / outros
// - Station bumpers
// - Ads + PSAs
// - Lore drops
// - Randomized interleaving
// - Simple crossfade between tracks
// - Auto‑start when Pip‑Boy is ready
// ------------------------------------------------------------

(function () {
  "use strict";

  // ------------------------------------------------------------
  // CONFIG
  // ------------------------------------------------------------

  const RADIO_CONFIG = {
    // How often (in tracks) to insert non‑music content
    minTracksBetweenEvents: 1,
    maxTracksBetweenEvents: 3,

    // Crossfade duration in ms
    crossfadeDuration: 2000,

    // DOM element for the "radio knob" (optional)
    knobSelector: "#radioKnob",

    // Stations (you can add more later)
    stations: [
      {
        id: "atomic_fizz_radio",
        name: "Atomic Fizz Radio",
        playlistUrl: "/audio/radio/playlist.json",
        stationUrl: "/audio/radio/station.json"
      }
      // Add more stations here if desired
    ]
  };

  // ------------------------------------------------------------
  // UTILS
  // ------------------------------------------------------------

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ------------------------------------------------------------
  // AtomicFizzStation — handles one station's content
  // ------------------------------------------------------------

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
      const [playlist, station] = await Promise.all([
        fetch(this.playlistUrl).then(r => r.json()),
        fetch(this.stationUrl).then(r => r.json())
      ]);

      // playlist can be array or { tracks: [...] }
      this.playlist = Array.isArray(playlist) ? playlist : (playlist.tracks || []);

      this.station = station || {};

      // Optional linked JSONs from station.json
      const djUrl = this.station.dj;
      const bumpersUrl = this.station.bumpers;
      const adsUrl = this.station.ads;
      const psasUrl = this.station.psas;
      const loreUrl = this.station.lore;

      const promises = [];

      if (djUrl) {
        promises.push(
          fetch(djUrl)
            .then(r => r.json())
            .then(dj => {
              this.dj = dj;
            })
            .catch(() => {})
        );
      }

      if (bumpersUrl) {
        promises.push(
          fetch(bumpersUrl)
            .then(r => r.json())
            .then(b => {
              this.bumpers = b.bumpers || [];
            })
            .catch(() => {})
        );
      }

      if (adsUrl) {
        promises.push(
          fetch(adsUrl)
            .then(r => r.json())
            .then(a => {
              this.ads = a.ads || [];
            })
            .catch(() => {})
        );
      }

      if (psasUrl) {
        promises.push(
          fetch(psasUrl)
            .then(r => r.json())
            .then(p => {
              this.psas = p.psas || [];
            })
            .catch(() => {})
        );
      }

      if (loreUrl) {
        promises.push(
          fetch(loreUrl)
            .then(r => r.json())
            .then(l => {
              this.lore = l.lore || [];
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);

      this.ready = true;
      console.log(`[Radio] Station loaded: ${this.name}`);
    }

    getRandomTrack() {
      return pickRandom(this.playlist);
    }

    getRandomDJIntro() {
      if (!this.dj || !this.dj.clips || !this.dj.clips.intros) return null;
      return pickRandom(this.dj.clips.intros);
    }

    getRandomDJOutro() {
      if (!this.dj || !this.dj.clips || !this.dj.clips.outros) return null;
      return pickRandom(this.dj.clips.outros);
    }

    getRandomBumper() {
      return pickRandom(this.bumpers);
    }

    getRandomAd() {
      return pickRandom(this.ads);
    }

    getRandomPSA() {
      return pickRandom(this.psas);
    }

    getRandomLore() {
      return pickRandom(this.lore);
    }
  }

  // ------------------------------------------------------------
  // AtomicFizzRadioPlayer — multi‑station, crossfade, events
  // ------------------------------------------------------------

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
      this.audioA.loop = false;
      this.audioB.loop = false;

      this.activeAudio = this.audioA;
      this.inactiveAudio = this.audioB;

      this.tracksSinceEvent = 0;
      this.nextEventAt = randInt(
        this.config.minTracksBetweenEvents,
        this.config.maxTracksBetweenEvents
      );

      this.isFading = false;
      this.isPlayingEvent = false;

      this._bindEvents();
      this._initStations();
    }

    _bindEvents() {
      // When active audio ends, decide what to play next
      const onEnded = () => {
        if (this.isFading) return;
        this._onTrackEnded();
      };

      this.audioA.addEventListener("ended", onEnded);
      this.audioB.addEventListener("ended", onEnded);

      // Optional: radio knob UI
      if (this.config.knobSelector) {
        const knob = document.querySelector(this.config.knobSelector);
        if (knob) {
          knob.addEventListener("click", () => this.cycleStation());
        }
      }
    }

    async _initStations() {
      for (const meta of this.config.stations) {
        const station = new AtomicFizzStation(meta);
        this.stations.set(meta.id, station);
        station.load().catch(err => {
          console.warn("[Radio] Failed to load station:", meta.id, err);
        });
      }

      // Default to first station
      if (this.config.stations.length > 0) {
        this.currentStationId = this.config.stations[0].id;
      }

      // Wait a bit for station load, then start
      setTimeout(() => {
        this.start();
      }, 1000);
    }

    get currentStation() {
      if (!this.currentStationId) return null;
      return this.stations.get(this.currentStationId) || null;
    }

    start() {
      const station = this.currentStation;
      if (!station || !station.ready) {
        console.warn("[Radio] No ready station to start");
        return;
      }
      console.log(`[Radio] Starting station: ${station.name}`);
      this._playNext();
    }

    cycleStation() {
      const ids = Array.from(this.stations.keys());
      if (!ids.length) return;

      const idx = ids.indexOf(this.currentStationId);
      const nextIdx = (idx + 1) % ids.length;
      this.currentStationId = ids[nextIdx];

      const station = this.currentStation;
      console.log(`[Radio] Switched to station: ${station ? station.name : "Unknown"}`);

      // Hard switch: stop current and start new
      this.audioA.pause();
      this.audioB.pause();
      this._playNext(true);
    }

    _onTrackEnded() {
      if (this.isPlayingEvent) {
        // Event finished, go back to music
        this.isPlayingEvent = false;
        this._playNext();
      } else {
        // Music finished, decide if we play event or another track
        this.tracksSinceEvent++;
        if (this.tracksSinceEvent >= this.nextEventAt) {
          this._playEvent();
        } else {
          this._playNext();
        }
      }
    }

    _playNext(forceMusic = false) {
      const station = this.currentStation;
      if (!station || !station.ready) {
        console.warn("[Radio] Station not ready");
        return;
      }

      if (!forceMusic && this.tracksSinceEvent >= this.nextEventAt) {
        this._playEvent();
        return;
      }

      const track = station.getRandomTrack();
      if (!track) {
        console.warn("[Radio] No tracks available for station");
        return;
      }

      this.tracksSinceEvent++;
      this._setSourceAndPlay(track.file, false);
    }

    _playEvent() {
      const station = this.currentStation;
      if (!station || !station.ready) {
        this._playNext(true);
        return;
      }

      // Decide what kind of event to play
      const eventTypes = ["djIntro", "bumper", "ad", "psa", "lore"];
      const type = pickRandom(eventTypes);

      let file = null;

      switch (type) {
        case "djIntro": {
          const intro = station.getRandomDJIntro();
          file = intro || null;
          break;
        }
        case "bumper": {
          const bumper = station.getRandomBumper();
          file = bumper && bumper.file ? bumper.file : null;
          break;
        }
        case "ad": {
          const ad = station.getRandomAd();
          file = ad && ad.file ? ad.file : null;
          break;
        }
        case "psa": {
          const psa = station.getRandomPSA();
          file = psa && psa.file ? psa.file : null;
          break;
        }
        case "lore": {
          const lore = station.getRandomLore();
          file = lore && lore.file ? lore.file : null;
          break;
        }
      }

      if (!file) {
        // If no event available, reset counters and go back to music
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

    _setSourceAndPlay(file, isEvent) {
      const station = this.currentStation;
      if (!station) return;

      const active = this.activeAudio;
      const inactive = this.inactiveAudio;

      // Prepare inactive audio with new source
      inactive.pause();
      inactive.currentTime = 0;

      // If file is already absolute path, use as is; otherwise assume /audio/radio/...
      const src =
        file.startsWith("/") || file.startsWith("http")
          ? file
          : `/audio/radio/tracks/${file}`;

      inactive.src = src;

      // Crossfade
      this._crossfade(active, inactive, () => {
        // After crossfade, swap roles
        this.activeAudio = inactive;
        this.inactiveAudio = active;
      });

      inactive
        .play()
        .catch(e => console.warn("[Radio] Play error:", e));
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

  // ------------------------------------------------------------
  // GLOBAL HOOK
  // ------------------------------------------------------------

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
