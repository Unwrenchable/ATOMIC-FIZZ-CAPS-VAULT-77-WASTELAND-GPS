// public/js/konami.js - Konami Code Easter Egg
(function() {
  'use strict';

  const KONAMI_CODE = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];

  let konamiIndex = 0;
  let konamiActivated = false;

  function showDonationPortal() {
    if (konamiActivated) return;
    konamiActivated = true;

    // Play a sound effect if available
    try {
      const audio = new Audio('/audio/powerup.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}

    // Show notification
    alert('🎮 KONAMI CODE ACTIVATED!\n\n☢️ SECRET DONATION PORTAL UNLOCKED!\n\nHelp keep the Wasteland online!');

    // Open donation page in a popup
    const screenW = window.innerWidth || screen.width;
    const screenH = window.innerHeight || screen.height;

    const width = Math.min(700, Math.max(400, Math.floor(screenW * 0.7)));
    const height = Math.min(800, Math.max(600, Math.floor(screenH * 0.8)));

    const left = Math.floor((screenW - width) / 2);
    const top = Math.floor((screenH - height) / 2);

    const features = [
      'resizable=yes',
      'scrollbars=yes',
      'status=no',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'width=' + width,
      'height=' + height,
      'left=' + left,
      'top=' + top
    ].join(',');

    window.open('/donate.html', 'donation_portal', features);

    // Reset after 5 seconds
    setTimeout(() => {
      konamiActivated = false;
    }, 5000);
  }

  // Listen for konami code
  document.addEventListener('keydown', function(e) {
    if (e.key === KONAMI_CODE[konamiIndex]) {
      konamiIndex++;

      if (konamiIndex === KONAMI_CODE.length) {
        konamiIndex = 0;
        showDonationPortal();
      }
    } else {
      konamiIndex = 0;
    }
  });

  console.log('🎮 Konami Code listener active. Try: ↑↑↓↓←→←→BA');
})();
