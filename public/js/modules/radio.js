// radio.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Radio Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const stations = {
    wasteland_classics: "/radio/wasteland_classics.mp3",
    atomic_swing: "/radio/atomic_swing.mp3",
    vault77_broadcast: "/radio/vault77_broadcast.mp3"
  };

  const radioModule = {
    audio: null,
    current: null,

    init() {
      this.audio = document.getElementById("radioPlayer");
      if (!this.audio) return;

      const buttons = document.querySelectorAll("[data-station]");
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-station");
          this.play(id);
        });
      });
    },

    play(id) {
      if (!this.audio || !stations[id]) return;

      // Toggle pause if same station
      if (this.current === id && !this.audio.paused) {
        this.audio.pause();
        return;
      }

      this.audio.src = stations[id];
      this.audio.loop = true;
      this.audio.play().catch(console.error);
      this.current = id;
    },

    onOpen() {
      const container = document.getElementById("tab-radio");
      if (!container) return;

      container.innerHTML = `
        <h2>Radio</h2>
        <button data-station="wasteland_classics">Wasteland Classics</button>
        <button data-station="atomic_swing">Atomic Swing</button>
        <button data-station="vault77_broadcast">Vault 77 Broadcast</button>
        <audio id="radioPlayer"></audio>
      `;

      this.init();
    }
  };

  Game.modules.radio = radioModule;
})();
