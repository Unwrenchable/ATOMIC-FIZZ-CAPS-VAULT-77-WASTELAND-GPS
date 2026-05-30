// pipboy-style.js
// Pocket-Boy style configuration and theming utilities
// ------------------------------------------------------------

(function () {
  "use strict";

  // Default Pocket-Boy color themes
  const PIPBOY_THEMES = {
    green: { primary: "#00ff00", secondary: "#003300", accent: "#00cc00" },
    amber: { primary: "#ffb000", secondary: "#331a00", accent: "#cc8800" },
    blue: { primary: "#00ffff", secondary: "#003333", accent: "#00cccc" },
    white: { primary: "#ffffff", secondary: "#333333", accent: "#cccccc" }
  };

  // Current theme (default: green)
  let currentTheme = "green";

  /**
   * Get current Pocket-Boy theme colors
   * @returns {Object} Theme color object
   */
  function getTheme() {
    return PIPBOY_THEMES[currentTheme] || PIPBOY_THEMES.green;
  }

  /**
   * Set Pocket-Boy theme
   * @param {string} themeName - Theme name (green, amber, blue, white)
   */
  function setTheme(themeName) {
    if (PIPBOY_THEMES[themeName]) {
      currentTheme = themeName;
      applyTheme();
    }
  }

  /**
   * Apply current theme to CSS variables
   */
  function applyTheme() {
    const theme = getTheme();
    const root = document.documentElement;
    if (root) {
      root.style.setProperty("--pipboy-primary", theme.primary);
      root.style.setProperty("--pipboy-secondary", theme.secondary);
      root.style.setProperty("--pipboy-accent", theme.accent);
    }
  }

  // Expose globally
  window.pipboyStyle = {
    themes: PIPBOY_THEMES,
    getTheme,
    setTheme,
    applyTheme
  };

})();
