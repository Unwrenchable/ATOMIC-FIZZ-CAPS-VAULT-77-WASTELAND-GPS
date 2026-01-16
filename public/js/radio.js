// ------------------------------------------------------------
// Atomic Fizz Radio — Complete Drop‑In Module
// ------------------------------------------------------------
// This file handles:
// - Radio engine
// - Playlist loading
// - Station loading
// - Auto‑start when Pip‑Boy is ready
// - Zero conflicts with map, wallet, quests, UI
// ------------------------------------------------------------

(function () {
  "use strict";

  class AtomicFizzRadio {
    constructor(playlistUrl, stationUrl) {
      this.audio = new Audio();
      this.audio.volume = 0.7;
      this.audio.loop = false;

      this.playlist = [];
      this.station = {};
      this.currentTrack = 0;

      Promise.all([
        fetch(playlistUrl).then(r => r.json()),
        fetch(stationUrl).then(r => r.json())
      ])
        .then(([playlist, station]) => {
          this.playlist = playlist.tracks || [];
          this.station = station || {};
          console.log("[Radio] Loaded playlist + station");
          this.playRandom();
        })
        .catch(err => console.warn("[Radio] Failed to load:", err));
    }

    playRandom() {
      if (!this.playlist.length) {
        console.warn("[Radio] No tracks available");
        return;
      }

      this.currentTrack = Math.floor(Math.random() * this.playlist.length);
      const track = this.playlist[this.currentTrack];

      this.audio.src = `/audio/radio/tracks/${track.file}`;
      this.audio.play().catch(e => console.warn("[Radio] Play error:", e));

      this.audio.onended = () => this.playRandom();
    }
  }

  // Expose globally
  window.AtomicFizzRadio = AtomicFizzRadio;

  // ------------------------------------------------------------
  // AUTO‑START WHEN PIP‑BOY IS READY
  // ------------------------------------------------------------
  window.addEventListener("pipboyReady", () => {
    try {
      console.log("[Radio] Pip‑Boy ready → starting radio");
      window._radio = new AtomicFizzRadio(
        "/audio/radio/playlist.json",
        "/audio/radio/station.json"
      );
    } catch (e) {
      console.warn("[Radio] Failed to start:", e);
    }
  });

})();
