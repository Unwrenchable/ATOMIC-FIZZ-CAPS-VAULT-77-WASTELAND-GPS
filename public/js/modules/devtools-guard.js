// DevTools Guard - Security Module for Atomic Fizz Caps
// Implements multiple layers of protection against inspection
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    enabled: true,
    blockKeyboardShortcuts: true,
    detectResize: true,
    warnInConsole: true
  };

  // Guard state
  let devToolsOpen = false;
  let warningShown = false;

  // ============================================================
  // CONSOLE WARNING
  // ============================================================
  function showConsoleWarning() {
    if (warningShown) return;
    warningShown = true;

    // Clear console
    console.clear();

    // Style warning
    const warningStyle = [
      'color: #ff0000',
      'font-size: 24px',
      'font-weight: bold',
      'text-shadow: 2px 2px 4px rgba(255,0,0,0.5)'
    ].join(';');

    const infoStyle = [
      'color: #ffaa00',
      'font-size: 14px'
    ].join(';');

    const messageStyle = [
      'color: #00ff00',
      'font-size: 12px',
      'font-family: monospace'
    ].join(';');

    console.log('%c☢️ VAULT-TEC SECURITY ALERT ☢️', warningStyle);
    console.log('%c⚠️ UNAUTHORIZED ACCESS DETECTED', infoStyle);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', messageStyle);
    console.log('%cThis application is protected by Vault-Tec security protocols.', messageStyle);
    console.log('%cAny attempt to reverse-engineer, decompile, or extract', messageStyle);
    console.log('%cconfidential data is logged and may result in termination.', messageStyle);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', messageStyle);
    console.log('%c"Your cooperation is appreciated, Vault Dweller."', infoStyle);
    console.log('%c                    - Vault-Tec Corporation', messageStyle);
  }

  // ============================================================
  // KEYBOARD SHORTCUT BLOCKING
  // ============================================================
  function setupKeyboardBlocking() {
    if (!CONFIG.blockKeyboardShortcuts) return;

    document.addEventListener('keydown', function(e) {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Ctrl+Shift+I (Chrome DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Ctrl+Shift+J (Chrome Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Ctrl+Shift+C (Chrome Inspect Element)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Cmd+Option+I (Mac DevTools)
      if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Cmd+Option+J (Mac Console)
      if (e.metaKey && e.altKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }

      // Cmd+Option+U (Mac View Source)
      if (e.metaKey && e.altKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        showConsoleWarning();
        return false;
      }
    }, true);
  }

  // ============================================================
  // WINDOW SIZE DETECTION
  // ============================================================
  function setupResizeDetection() {
    if (!CONFIG.detectResize) return;

    const threshold = 160; // DevTools usually adds ~160px

    function checkResize() {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      const wasOpen = devToolsOpen;
      devToolsOpen = widthDiff > threshold || heightDiff > threshold;

      if (devToolsOpen && !wasOpen) {
        onDevToolsOpened();
      }
    }

    // Check on resize
    window.addEventListener('resize', checkResize);

    // Periodic check
    setInterval(checkResize, 1000);
  }

  // ============================================================
  // DEVTOOLS OPENED HANDLER
  // ============================================================
  function onDevToolsOpened() {
    if (CONFIG.warnInConsole) {
      showConsoleWarning();
    }

    // Dispatch event for other modules to react
    window.dispatchEvent(new CustomEvent('devToolsOpened', {
      detail: { timestamp: Date.now() }
    }));
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  function init() {
    if (!CONFIG.enabled) return;

    setupKeyboardBlocking();
    setupResizeDetection();

    // Initial console warning
    if (CONFIG.warnInConsole) {
      // Delay to ensure console is ready
      setTimeout(showConsoleWarning, 1000);
    }
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose minimal API
  window.VaultTecSecurity = {
    isDevToolsOpen: function() { return devToolsOpen; },
    showWarning: showConsoleWarning
  };

})();
