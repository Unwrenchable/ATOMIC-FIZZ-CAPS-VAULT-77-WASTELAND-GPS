(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const compassModule = {
    element: null,
    needle: null,
    degreeLabel: null,
    lastHeading: 0,
    hasInit: false,
    retryTimeout: null,

    init() {
      if (this.hasInit) return;
      this.createCompassUI();

      // Hook into worldmap heading updates
      const worldmap = Game.modules.worldmap;
      if (!worldmap || typeof worldmap.setPlayerHeading !== "function") {
        console.warn("compass: worldmap not loaded yet");
        if (!this.retryTimeout) {
          this.retryTimeout = setTimeout(() => {
            this.retryTimeout = null;
            this.init();
          }, 500);
        }
        return;
      }

      // Monkey-patch setPlayerHeading to also update compass
      const originalSetHeading = worldmap.setPlayerHeading.bind(worldmap);

      worldmap.setPlayerHeading = (deg) => {
        originalSetHeading(deg);
        this.updateCompass(deg);
      };

      // Sync to current heading if already set
      if (worldmap.lastHeading !== undefined) {
        this.updateCompass(worldmap.lastHeading);
      }

      this.hasInit = true;
      console.log("compass: initialized");
    },

    onPipboyReady() {
      this.init();
    },

    createCompassUI() {
      if (document.getElementById("pipboyCompass")) return;

      const mapPanel = document.getElementById("panel-map");

      // Compact circular compass rose widget
      const widget = document.createElement("div");
      widget.id = "pipboyCompass";
      widget.setAttribute("aria-label", "Pip-Boy compass");
      widget.innerHTML = `
        <svg id="pipboyCompassSvg" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"
             role="img" aria-label="Compass rose showing player heading">
          <title>Compass – north tip is red, rotates to show travel direction</title>
          <!-- Outer ring -->
          <circle cx="30" cy="30" r="28" stroke="#00ff41" stroke-width="1.5" fill="rgba(0,0,0,0.72)"/>
          <!-- Tick marks at 45° increments -->
          <line x1="30" y1="3"  x2="30" y2="9"  stroke="#00ff41" stroke-width="1.2" opacity="0.7"/>
          <line x1="30" y1="51" x2="30" y2="57" stroke="#00ff41" stroke-width="1.2" opacity="0.7"/>
          <line x1="3"  y1="30" x2="9"  y2="30" stroke="#00ff41" stroke-width="1.2" opacity="0.7"/>
          <line x1="51" y1="30" x2="57" y2="30" stroke="#00ff41" stroke-width="1.2" opacity="0.7"/>
          <!-- Cardinal labels (fixed, do not rotate) -->
          <text x="30" y="14" text-anchor="middle" class="compass-label" fill="#ff4d4d" aria-label="North">N</text>
          <text x="30" y="52" text-anchor="middle" class="compass-label" fill="#00ff41" aria-label="South">S</text>
          <text x="51" y="33" text-anchor="middle" class="compass-label" fill="#00ff41" aria-label="East">E</text>
          <text x="9"  y="33" text-anchor="middle" class="compass-label" fill="#00ff41" aria-label="West">W</text>
          <!--
            Needle group – rotates with heading (0°=N, 90°=E, 180°=S, 270°=W).
            Viewbox is 60×60; centre is (30,30).
            North tip polygon: apex at (30,8)  → 22px above centre, base at y=30 ±3px wide.
            South tip polygon: apex at (30,52) → 22px below centre, same base width.
          -->
          <g id="pipboyCompassNeedle" transform="rotate(0 30 30)">
            <!-- North tip: red -->
            <polygon points="30,8 27,30 33,30" fill="#ff4d4d" opacity="0.95"/>
            <!-- South tip: dark green (counter-weight) -->
            <polygon points="30,52 27,30 33,30" fill="#004d00" opacity="0.85"/>
            <!-- Centre hub -->
            <circle cx="30" cy="30" r="2.5" fill="#00ff41" stroke="#004d00" stroke-width="0.8"/>
          </g>
        </svg>
        <div id="pipboyCompassDeg" class="compass-deg">000°</div>
      `;

      const target = mapPanel || document.body;
      target.appendChild(widget);
      if (mapPanel) mapPanel.classList.add("has-compass");
      this.element = widget;
      this.needle = widget.querySelector("#pipboyCompassNeedle");
      this.degreeLabel = widget.querySelector("#pipboyCompassDeg");

      // Inject styles
      const style = document.createElement("style");
      style.textContent = `
        #pipboyCompass {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 60px;
          z-index: 510;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        #pipboyCompassSvg {
          width: 60px;
          height: 60px;
          filter: drop-shadow(0 0 4px rgba(0,255,65,0.45));
        }

        #pipboyCompass .compass-label {
          font-family: 'VT323', monospace;
          font-size: 10px;
          text-shadow: 0 0 3px currentColor;
        }

        #pipboyCompassNeedle {
          transition: transform 0.2s linear;
        }

        .compass-deg {
          font-family: 'VT323', monospace;
          font-size: 11px;
          color: #00ff41;
          text-shadow: 0 0 4px #00ff41;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(0,255,65,0.35);
          border-radius: 2px;
          padding: 0 3px;
          line-height: 1.3;
          letter-spacing: 1px;
        }
      `;
      document.head.appendChild(style);
    },

    updateCompass(heading) {
      // Normalize to 0–360 range (handles negative input from atan2)
      const deg = ((heading % 360) + 360) % 360;
      this.lastHeading = deg;

      if (!this.needle) return;

      // Rotate needle so its north tip (polygon pointing up at 0°) aligns with heading
      this.needle.setAttribute("transform", `rotate(${deg} 30 30)`);

      if (this.degreeLabel) {
        this.degreeLabel.textContent = String(Math.round(deg)).padStart(3, "0") + "°";
      }
    }
  };

  Game.modules.compass = compassModule;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      // Defer until boot completes
    } catch (e) {
      console.error("compass: init failed", e);
    }
  });
})();
