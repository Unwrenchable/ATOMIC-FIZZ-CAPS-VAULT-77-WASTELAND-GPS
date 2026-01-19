// discoveryBanner.js
// ------------------------------------------------------------
// Atomic Fizz Caps – POI Discovery Banner
// Shows a Fallout-style "LOCATION DISCOVERED" popup
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
      `;
      document.head.appendChild(style);
    },

    trigger(loc) {
      if (!loc || !loc.id) return;

      // Only show once per session
      if (this.discovered.has(loc.id)) return;
      this.discovered.add(loc.id);

      const nameEl = this.element.querySelector(".name");
      nameEl.textContent = loc.name || "Unknown Location";

      this.element.classList.add("show");

      setTimeout(() => {
        this.element.classList.remove("show");
      }, 2500);
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

