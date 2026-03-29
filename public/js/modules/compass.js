(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Compass module — feeds real device compass heading directly into the
  // player-marker arrow so the arrow on the map rotates with the device.
  // No overlay widget is created; the player marker IS the compass.
  const compassModule = {
    hasInit: false,
    retryTimeout: null,
    lastHeading: 0,
    _orientationHandler: null,

    init() {
      if (this.hasInit) return;

      const worldmap = Game.modules.worldmap;
      if (!worldmap || typeof worldmap.setPlayerHeading !== "function") {
        console.warn("[compass] worldmap not ready yet, retrying…");
        if (!this.retryTimeout) {
          this.retryTimeout = setTimeout(() => {
            this.retryTimeout = null;
            this.init();
          }, 500);
        }
        return;
      }

      this._startOrientationWatch(worldmap);
      this.hasInit = true;
      console.log("[compass] initialized (device-orientation → player marker)");
    },

    onPipboyReady() {
      this.init();
    },

    // Attach deviceorientation listener and pipe heading to worldmap.
    _startOrientationWatch(worldmap) {
      if (this._orientationHandler) return;

      const self = this;

      const handler = (evt) => {
        let heading = null;

        // iOS: webkitCompassHeading = degrees clockwise from true north
        if (typeof evt.webkitCompassHeading === "number" && !isNaN(evt.webkitCompassHeading)) {
          heading = evt.webkitCompassHeading;
        } else if (typeof evt.alpha === "number" && !isNaN(evt.alpha)) {
          // Standard API: alpha=0 is north, increases counterclockwise.
          // Convert to clockwise-from-north bearing used by setPlayerHeading.
          heading = (360 - evt.alpha) % 360;
        }

        if (heading === null) return;

        self.lastHeading = heading;
        worldmap.setPlayerHeading(heading);
      };

      this._orientationHandler = handler;

      // iOS 13+ requires an explicit permission grant triggered by a user gesture.
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const requestOnGesture = () => {
          DeviceOrientationEvent.requestPermission()
            .then((permission) => {
              if (permission === "granted") {
                window.addEventListener("deviceorientationabsolute", handler, { passive: true });
                window.addEventListener("deviceorientation", handler, { passive: true });
                console.log("[compass] iOS orientation permission granted");
              } else {
                console.warn("[compass] iOS orientation permission denied");
              }
            })
            .catch((err) => console.warn("[compass] orientation permission error:", err));
          document.removeEventListener("touchstart", requestOnGesture);
          document.removeEventListener("click", requestOnGesture);
        };
        // Trigger permission request on first tap or click.
        // Manual cross-removal ensures whichever event fires first also
        // unregisters the other listener.
        document.addEventListener("touchstart", requestOnGesture);
        document.addEventListener("click", requestOnGesture);
      } else if (typeof DeviceOrientationEvent !== "undefined") {
        // Non-iOS: start listening immediately.
        // Prefer the absolute variant (Android Chrome); fall back to generic.
        window.addEventListener("deviceorientationabsolute", handler, { passive: true });
        window.addEventListener("deviceorientation", handler, { passive: true });
      }
    },

    destroy() {
      if (this._orientationHandler) {
        window.removeEventListener("deviceorientationabsolute", this._orientationHandler);
        window.removeEventListener("deviceorientation", this._orientationHandler);
        this._orientationHandler = null;
      }
    }
  };

  Game.modules.compass = compassModule;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      // Initialization is deferred; boot.js calls onPipboyReady() after setup.
    } catch (e) {
      console.error("[compass] init error:", e);
    }
  });
})();

