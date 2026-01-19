(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const weatherOverlay = {
    pane: null,
    overlayEl: null,
    currentType: null,
    lastUpdate: 0,
    updateInterval: 5000, // ms

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("weatherOverlay: worldmap not ready");
        return;
      }

      // Create a custom Leaflet pane ABOVE tiles but BELOW markers
      this.pane = worldmap.map.createPane("weatherPane");
      this.pane.style.zIndex = 450;
      this.pane.style.pointerEvents = "none";

      // Create overlay element
      this.overlayEl = document.createElement("div");
      this.overlayEl.id = "weatherOverlay";
      this.pane.appendChild(this.overlayEl);

      // Inject CSS
      this.injectStyles();

      // Hook into map movement + periodic updates
      worldmap.map.on("moveend", () => this.updateWeather());
      setInterval(() => this.updateWeather(), this.updateInterval);

      console.log("weatherOverlay: initialized");
    },

    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        #weatherOverlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        /* Radiation storm */
        .weather-radstorm {
          background: radial-gradient(circle at center,
            rgba(0,255,65,0.25),
            rgba(0,255,65,0.05),
            rgba(0,255,65,0)
          );
          animation: radPulse 3s infinite ease-in-out;
        }

        @keyframes radPulse {
          0% { opacity: 0.2; }
          50% { opacity: 0.35; }
          100% { opacity: 0.2; }
        }

        /* Fog */
        .weather-fog {
          backdrop-filter: blur(3px);
          background: rgba(200, 255, 200, 0.05);
        }

        /* Dust storm */
        .weather-dust {
          background: rgba(255, 200, 100, 0.12);
        }

        /* Rain static */
        .weather-rain {
          background-image: url('/img/weather/static.png');
          background-size: cover;
          opacity: 0.25;
          animation: rainFlicker 0.2s infinite;
        }

        @keyframes rainFlicker {
          0% { opacity: 0.15; }
          50% { opacity: 0.3; }
          100% { opacity: 0.15; }
        }

        /* Gamma lightning */
        .weather-gamma {
          background: rgba(0,255,65,0.15);
          animation: gammaFlash 4s infinite;
        }

        @keyframes gammaFlash {
          0%, 90% { opacity: 0.05; }
          92% { opacity: 0.8; }
          100% { opacity: 0.05; }
        }
      `;
      document.head.appendChild(style);
    },

    updateWeather() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) return;

      const pos = worldmap.gs?.player?.position;
      if (!pos) return;

      // Ask your existing weather engine
      let weather = null;
      try {
        weather = Game.modules.world.weather.at(
          Game.modules.world.state || worldmap.gs.worldState || worldmap.gs,
          {
            biome: "auto",
            continent: "north_america",
            lat: pos.lat,
            lng: pos.lng
          }
        );
      } catch (e) {
        console.warn("weatherOverlay: weather lookup failed", e);
        return;
      }

      if (!weather || !weather.type) return;

      this.applyWeather(weather.type);
    },

    applyWeather(type) {
      if (type === this.currentType) return;
      this.currentType = type;

      const el = this.overlayEl;
      el.className = ""; // reset

      switch (type) {
        case "radstorm":
          el.classList.add("weather-radstorm");
          el.style.opacity = 1;
          break;

        case "fog":
          el.classList.add("weather-fog");
          el.style.opacity = 1;
          break;

        case "dust":
          el.classList.add("weather-dust");
          el.style.opacity = 1;
          break;

        case "rain":
          el.classList.add("weather-rain");
          el.style.opacity = 1;
          break;

        case "gamma_lightning":
          el.classList.add("weather-gamma");
          el.style.opacity = 1;
          break;

        default:
          el.style.opacity = 0;
      }
    }
  };

  Game.modules.weatherOverlay = weatherOverlay;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      weatherOverlay.init();
    } catch (e) {
      console.error("weatherOverlay: init failed", e);
    }
  });
})();
