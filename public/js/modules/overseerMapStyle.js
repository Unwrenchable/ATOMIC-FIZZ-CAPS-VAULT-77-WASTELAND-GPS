// overseerMapStyle.js
// Fallout-style map style engine for Atomic Fizz Caps
(function () {
  "use strict";

  // Map style definitions (add more as needed)
  const TILE_STYLES = {
    pipboy: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'pipboy-map-tiles'
      }
    },
    winter: {
      url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png",
      options: {
        attribution: '© Stadia Maps, OpenMapTiles',
        maxZoom: 19,
        className: 'winter-map-tiles'
      }
    },
    desert: {
      url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
      options: {
        attribution: '© Stadia Maps, OpenMapTiles',
        maxZoom: 19,
        className: 'desert-map-tiles'
      }
    },
    none: {
      url: null,
      options: {}
    }
  };

  // Holds the current tile layer
  let currentLayer = null;
  let mapRef = null;

  function setStyle(styleName) {
    if (!window.Game || !Game.modules || !Game.modules.worldmap) {
      console.warn('[overseerMapStyle] worldmap module not ready');
      return;
    }
    mapRef = Game.modules.worldmap.map;
    if (!mapRef) {
      console.warn('[overseerMapStyle] map not initialized');
      return;
    }
    const style = TILE_STYLES[styleName] || TILE_STYLES.pipboy;
    // Remove existing custom tile layer
    if (currentLayer && mapRef.hasLayer(currentLayer)) {
      mapRef.removeLayer(currentLayer);
    }
    if (style.url) {
      currentLayer = L.tileLayer(style.url, style.options);
      currentLayer.addTo(mapRef);
    } else {
      currentLayer = null;
    }
    // Optionally update UI to reflect active style
    document.body.setAttribute('data-map-style', styleName);
    console.log(`[overseerMapStyle] Set map style: ${styleName}`);
  }

  // Expose API
  window.overseerMapStyle = { setStyle };
})();
