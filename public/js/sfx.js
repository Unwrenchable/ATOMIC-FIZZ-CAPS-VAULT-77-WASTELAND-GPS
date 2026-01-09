// public/js/sfx.js
(() => {
  const SOUND_PATHS = {
    click: "/audio/click.wav",
    static: "/audio/static-burst.wav",
    gps: "/audio/gps-scan.wav",
    caps: "/audio/caps-jingle.wav",
    quest: "/audio/quest-ping.wav",
    boot: "/audio/boot-sequence.wav",
    hover: "/audio/ui-hover.wav",
  };

  const sounds = {};
  let enabled = true;
  let booted = false;

  function loadSound(key, src) {
    const audio = new Audio();
    audio.src = src;
    audio.preload = "auto";
    audio.volume = 0.75;
    sounds[key] = audio;
  }

  function safePlay(key) {
    if (!enabled) return;
    const base = sounds[key];
    if (!base) return;

    // clone so overlapping plays work
    const clone = base.cloneNode();
    clone.volume = base.volume;
    clone.play().catch(() => {});
  }

  function init() {
    Object.entries(SOUND_PATHS).forEach(([key, src]) => {
      loadSound(key, src);
    });

    // First user interaction will "unlock" audio on mobile
    const unlock = () => {
      if (booted) return;
      booted = true;
      safePlay("boot");
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
  }

  document.addEventListener("DOMContentLoaded", init);

  window.SFX = {
    play: safePlay,
    enable() {
      enabled = true;
    },
    disable() {
      enabled = false;
    },
  };
})();
