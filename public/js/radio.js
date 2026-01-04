// radio.js
// Simple Pip-Boy radio

(function () {
  const stations = {
    wasteland_classics: "/radio/wasteland_classics.mp3",
    atomic_swing: "/radio/atomic_swing.mp3",
    vault77_broadcast: "/radio/vault77_broadcast.mp3",
  };

  let audio = null;
  let current = null;

  function initRadio() {
    audio = document.getElementById("radioPlayer");
    if (!audio) return;

    const buttons = document.querySelectorAll("[data-station]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-station");
        playStation(id);
      });
    });
  }

  function playStation(id) {
    if (!audio || !stations[id]) return;
    if (current === id && !audio.paused) {
      audio.pause();
      return;
    }
    audio.src = stations[id];
    audio.loop = true;
    audio.play().catch(console.error);
    current = id;
  }

  window.addEventListener("load", initRadio);

  window.radio = {
    playStation,
  };
})();
