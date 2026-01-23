// discoveryBanner.js
// ------------------------------------------------------------
// Atomic Fizz Caps – POI Discovery Banner
// Shows a Fallout-style "LOCATION DISCOVERED" popup
// Also enables permanent labels on discovered locations
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const discovery = {
    element: null,
    discovered: new Set(),

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap) {
        console.warn("discoveryBanner: worldmap not ready");
        return;
      }

      this.createUI();

      // Patch POI click handler
      const originalClick = worldmap.onLocationClick.bind(worldmap);

      worldmap.onLocationClick = (loc) => {
        originalClick(loc);
        this.trigger(loc);
      };

      console.log("discoveryBanner: initialized");
    },

    createUI() {
      const el = document.createElement("div");
      el.id = "poiDiscoveryBanner";
      el.innerHTML = `
        <div class="banner-inner">
          <span class="label">LOCATION DISCOVERED</span>
          <span class="name"></span>
        </div>
      `;
      document.body.appendChild(el);
      this.element = el;

      const style = document.createElement("style");
      style.textContent = `
        #poiDiscoveryBanner {
          position: fixed;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 12px 24px;
          border: 1px solid #00ff41;
          background: rgba(0, 0, 0, 0.75);
          color: #00ff41;
          font-family: 'VT323', monospace;
          text-shadow: 0 0 6px #00ff41;
          opacity: 0;
          pointer-events: none;
          z-index: 9999;
          transition: opacity 0.4s ease;
        }

        #poiDiscoveryBanner .banner-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        #poiDiscoveryBanner .label {
          font-size: 18px;
          margin-bottom: 4px;
        }

        #poiDiscoveryBanner .name {
          font-size: 24px;
        }

        #poiDiscoveryBanner.show {
          opacity: 1;
        }
        
        /* Discovered location marker styling */
        .poi-marker-discovered {
          position: relative;
        }
        
        .poi-marker-discovered::after {
          content: '';
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: #00ff41;
          border-radius: 50%;
          box-shadow: 0 0 4px #00ff41;
        }
      `;
      document.head.appendChild(style);
    },

    trigger(loc) {
      if (!loc || !loc.id) return;

      // Check if already discovered
      const wasDiscovered = this.discovered.has(loc.id);
      
      // Mark as discovered
      this.discovered.add(loc.id);
      
      // Update the marker to show permanent label
      this.markAsDiscovered(loc);

      // Only show banner on first discovery
      if (wasDiscovered) return;

      const nameEl = this.element.querySelector(".name");
      nameEl.textContent = loc.name || "Unknown Location";

      this.element.classList.add("show");

      setTimeout(() => {
        this.element.classList.remove("show");
      }, 2500);
    },
    
    // Mark a location marker as discovered - enables permanent label
    markAsDiscovered(loc) {
      if (!loc || !loc.id) return;
      
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.poiMarkers) return;
      
      // Find the marker for this location
      const poiEntry = worldmap.poiMarkers.find(p => p.loc && p.loc.id === loc.id);
      if (!poiEntry || !poiEntry.marker) return;
      
      const marker = poiEntry.marker;
      
      // Add discovered class to the marker element
      const el = marker.getElement();
      if (el && !el.classList.contains('poi-marker-discovered')) {
        el.classList.add('poi-marker-discovered');
      }
      
      // Make the tooltip permanent so the label is always visible
      try {
        // Unbind existing tooltip and rebind as permanent
        const tooltip = marker.getTooltip();
        if (tooltip) {
          const content = tooltip.getContent();
          marker.unbindTooltip();
          marker.bindTooltip(content, {
            permanent: true,
            direction: 'top',
            offset: [0, -14],
            className: 'poi-label-tooltip poi-label-discovered'
          });
        }
      } catch (e) {
        console.warn("discoveryBanner: failed to update marker label", e);
      }
    },
    
    // Check if a location is discovered
    isDiscovered(locId) {
      return this.discovered.has(locId);
    }
  };

  Game.modules.discoveryBanner = discovery;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      discovery.init();
    } catch (e) {
      console.error("discoveryBanner: init failed", e);
    }
  });
})();

