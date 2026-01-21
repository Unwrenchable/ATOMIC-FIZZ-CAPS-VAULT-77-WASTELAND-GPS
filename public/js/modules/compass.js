(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const compassModule = {
    element: null,
    lastHeading: 0,

    init() {
      this.createCompassUI();

      // Hook into worldmap heading updates
      const worldmap = Game.modules.worldmap;
      if (!worldmap) {
        console.warn("compass: worldmap not loaded yet");
        return;
      }

      // Monkey‑patch setPlayerHeading to also update compass
      const originalSetHeading = worldmap.setPlayerHeading.bind(worldmap);

      worldmap.setPlayerHeading = (deg) => {
        originalSetHeading(deg);
        this.updateCompass(deg);
      };

      console.log("compass: initialized");
    },

    createCompassUI() {
      // Create container
      const bar = document.createElement("div");
      bar.id = "pipboyCompass";
      bar.innerHTML = `
        <div class="compass-inner">
          <div class="compass-marks">
            N&nbsp;&nbsp;NE&nbsp;&nbsp;E&nbsp;&nbsp;SE&nbsp;&nbsp;S&nbsp;&nbsp;SW&nbsp;&nbsp;W&nbsp;&nbsp;NW&nbsp;&nbsp;N
          </div>
        </div>
      `;

      document.body.appendChild(bar);
      this.element = bar;

      // Style
      const style = document.createElement("style");
      style.textContent = `
        #pipboyCompass {
          position: fixed;
          top: 45px;
          left: 50%;
          transform: translateX(-50%);
          width: 260px;
          height: 28px;
          overflow: hidden;
          z-index: 9999;
          pointer-events: none;
          border: 1px solid #00ff41;
          background: rgba(0, 0, 0, 0.35);
          font-family: 'VT323', monospace;
          color: #00ff41;
          text-shadow: 0 0 4px #00ff41;
        }

        #pipboyCompass .compass-inner {
          width: 520px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s linear;
        }

        #pipboyCompass .compass-marks {
          white-space: nowrap;
          font-size: 18px;
          letter-spacing: 4px;
        }
      `;
      document.head.appendChild(style);
    },

    updateCompass(heading) {
      this.lastHeading = heading;

      if (!this.element) return;

      // Convert heading to horizontal offset
      // 360 degrees = full width of compass text
      const offset = (heading / 360) * 260;

      const inner = this.element.querySelector(".compass-inner");
      if (inner) {
        inner.style.transform = `translateX(${-offset}px)`;
      }
    }
  };

  Game.modules.compass = compassModule;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      compassModule.init();
    } catch (e) {
      console.error("compass: init failed", e);
    }
  });
})();
