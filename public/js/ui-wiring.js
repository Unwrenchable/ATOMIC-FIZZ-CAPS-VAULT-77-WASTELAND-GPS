// public/js/ui-wiring.js
document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('bottom-drawer');
  const toggle = document.getElementById('drawer-toggle');

  if (toggle) {
    toggle.addEventListener('click', () => {
      drawer.classList.toggle('hidden');
      setTimeout(() => {
        if (window._map) window._map.invalidateSize();
      }, 260);
    });
  }

  // Add your other UI wiring code here (wallet buttons, GPS, etc.)
  // Example:
  document.getElementById('connectWallet')?.addEventListener('click', async () => {
    // your wallet connect code
  });

  console.log("UI wiring complete");
});
