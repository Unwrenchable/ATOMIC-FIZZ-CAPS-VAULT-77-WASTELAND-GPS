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

        /* Rain particles */
        .weather-rain {
          background: 
            radial-gradient(circle at 25% 25%, rgba(0, 255, 65, 0.1) 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, rgba(0, 255, 65, 0.1) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(0, 255, 65, 0.05) 1px, transparent 1px),
            linear-gradient(45deg, transparent 40%, rgba(0, 255, 65, 0.02) 50%, transparent 60%);
          background-size: 4px 4px, 6px 6px, 8px 8px, 20px 20px;
          opacity: 0.25;
          animation: rainFlicker 0.2s infinite;
          position: relative;
        }

        .weather-rain::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            radial-gradient(2px 4px at 20px 30px, #00ff41, transparent),
            radial-gradient(2px 4px at 40px 70px, #00ff41, transparent),
            radial-gradient(2px 4px at 90px 40px, #00ff41, transparent),
            radial-gradient(2px 4px at 130px 80px, #00ff41, transparent),
            radial-gradient(2px 4px at 160px 30px, #00ff41, transparent);
          background-repeat: repeat;
          background-size: 200px 100px;
          animation: rainFall 0.5s linear infinite;
          opacity: 0.6;
        }

        @keyframes rainFall {
          0% { transform: translateY(-100px); }
          100% { transform: translateY(100vh); }
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

      // Guard: ensure weather engine exists and has the expected API
      if (!Game.modules || !Game.modules.world || !Game.modules.world.weather || typeof Game.modules.world.weather.at !== 'function') {
        if (!this._warnedMissingWeather) {
          console.warn('weatherOverlay: weather engine unavailable; skipping weather updates');
          this._warnedMissingWeather = true;
        }
        return;
      }

      // Ask your existing weather engine (defensive)
      try {
        const state = Game.modules.world.state || worldmap.gs.worldState || worldmap.gs;
        const weather = Game.modules.world.weather.at(state, {
          biome: "auto",
          continent: "north_america",
          lat: pos.lat,
          lng: pos.lng
        });

        if (!weather || !weather.type) return;

        // Ensure overlay element exists before applying
        if (!this.overlayEl) return;

        this.applyWeather(weather.type);

        // Update STAT panel weather display
        const statWeatherEl = document.getElementById("stat-weather");
        if (statWeatherEl) {
          const displayType = weather.type.charAt(0).toUpperCase() + weather.type.slice(1);
          statWeatherEl.textContent = displayType;
        }
      } catch (e) {
        // Log once to avoid spamming console during map interactions
        if (!this._warnedWeatherError) {
          console.warn('weatherOverlay: weather lookup failed', e && e.message ? e.message : e);
          this._warnedWeatherError = true;
        }
        return;
      }
    },

    applyWeather(type) {
      if (type === this.currentType) return;
      this.currentType = type;

      const el = this.overlayEl;
      el.className = ""; // reset

      switch (type) {
        case "radiation storm":
        case "radstorm":
          el.classList.add("weather-radstorm");
          el.style.opacity = 1;
          break;

        case "fog":
          el.classList.add("weather-fog");
          el.style.opacity = 1;
          break;

        case "rain":
          el.classList.add("weather-rain");
          el.style.opacity = 1;
          break;

        case "dust":
          el.classList.add("weather-dust");
          el.style.opacity = 1;
          break;

        case "gamma_lightning":
          el.classList.add("weather-gamma");
          el.style.opacity = 1;
          break;

        case "clear":
        default:
          el.style.opacity = 0;
      }
    }
  };

  Game.modules.weatherOverlay = weatherOverlay;

  // Wait for map-ready event to ensure the map pane exists before creating overlays
  window.addEventListener("map-ready", () => {
    // Small delay to ensure map is fully initialized
    setTimeout(() => {
      try {
        weatherOverlay.init();
      } catch (e) {
        console.error("weatherOverlay: init failed", e);
      }
    }, 500);
  });
})();

