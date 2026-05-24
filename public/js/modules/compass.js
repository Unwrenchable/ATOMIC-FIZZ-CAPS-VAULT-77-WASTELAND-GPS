<<<<<<< HEAD
(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Compass module — feeds real device compass heading directly into the
  // player-marker arrow so the arrow on the map rotates with the device.
  // No overlay widget is created; the player marker IS the compass.

  // Minimum heading change (degrees) required before dispatching a new rotation
  // to the map marker. Filters sub-threshold sensor noise so the arrow does
  // not jitter when the player is stationary.
  const MIN_DISPATCH_DEG = 3;

  // Exponential moving-average alpha for heading smoothing (0 < α ≤ 1).
  // Lower = smoother but more latency; 0.15 is responsive enough for a compass
  // while damping high-frequency sensor chatter.
  const SMOOTH_ALPHA = 0.15;

  const compassModule = {
    hasInit: false,
    retryTimeout: null,
    lastHeading: 0,
    _orientationHandler: null,
    _absoluteHandler: null,
    _seenAbsolute: false,    // true once deviceorientationabsolute fires a valid reading
    _smoothedHeading: null,  // current EMA-smoothed heading (null before first reading)
    _dispatchedHeading: null, // last heading actually sent to worldmap

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

    // Apply circular exponential moving average and return smoothed heading.
    // Uses the same shortest-path delta as setPlayerHeading so wrap-around
    // (e.g. 359°→1°) is handled correctly.
    _smooth(raw) {
      if (this._smoothedHeading === null) {
        this._smoothedHeading = raw;
        return raw;
      }
      let delta = raw - this._smoothedHeading;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this._smoothedHeading = (this._smoothedHeading + SMOOTH_ALPHA * delta + 360) % 360;
      return this._smoothedHeading;
    },

    // Smooth incoming raw heading and only forward to worldmap when the
    // change exceeds MIN_DISPATCH_DEG. Eliminates sensor-noise jitter.
    _dispatch(raw, worldmap) {
      const smoothed = this._smooth(raw);
      this.lastHeading = smoothed;

      if (this._dispatchedHeading !== null) {
        let diff = Math.abs(smoothed - this._dispatchedHeading);
        if (diff > 180) diff = 360 - diff;
        if (diff < MIN_DISPATCH_DEG) return;
      }

      this._dispatchedHeading = smoothed;
      worldmap.setPlayerHeading(smoothed);
    },

    // Attach deviceorientation listener and pipe heading to worldmap.
    _startOrientationWatch(worldmap) {
      if (this._orientationHandler) return;

      const self = this;

      // Parse a raw heading from a DeviceOrientationEvent (or DeviceOrientationAbsolute).
      function extractHeading(evt) {
        if (typeof evt.webkitCompassHeading === "number" && !isNaN(evt.webkitCompassHeading)) {
          // iOS: clockwise from true north directly.
          return evt.webkitCompassHeading;
        }
        if (typeof evt.alpha === "number" && !isNaN(evt.alpha)) {
          // Standard API: alpha=0 is north, increases counter-clockwise.
          return (360 - evt.alpha) % 360;
        }
        return null;
      }

      // Handler for deviceorientationabsolute (Android Chrome, more accurate).
      // Marks that an absolute event has been seen so the fallback generic handler
      // stops firing — prevents both listeners from updating the marker on every frame.
      const absoluteHandler = (evt) => {
        const heading = extractHeading(evt);
        if (heading === null) return;
        self._seenAbsolute = true;
        self._dispatch(heading, worldmap);
      };

      // Handler for the generic deviceorientation event (iOS + fallback).
      // Skipped once deviceorientationabsolute starts delivering readings, because
      // both events fire on Android Chrome and processing both causes a double-jerk
      // on every sensor frame.
      const genericHandler = (evt) => {
        if (self._seenAbsolute) return;
        const heading = extractHeading(evt);
        if (heading === null) return;
        self._dispatch(heading, worldmap);
      };

      this._absoluteHandler = absoluteHandler;
      this._orientationHandler = genericHandler;

      // iOS 13+ requires an explicit permission grant triggered by a user gesture.
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const requestOnGesture = () => {
          DeviceOrientationEvent.requestPermission()
            .then((permission) => {
              if (permission === "granted") {
                window.addEventListener("deviceorientationabsolute", absoluteHandler, { passive: true });
                window.addEventListener("deviceorientation", genericHandler, { passive: true });
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
        window.addEventListener("deviceorientationabsolute", absoluteHandler, { passive: true });
        window.addEventListener("deviceorientation", genericHandler, { passive: true });
      }
    },

    destroy() {
      if (this._absoluteHandler) {
        window.removeEventListener("deviceorientationabsolute", this._absoluteHandler);
        this._absoluteHandler = null;
      }
      if (this._orientationHandler) {
        window.removeEventListener("deviceorientation", this._orientationHandler);
        this._orientationHandler = null;
      }
    }
  };

  Game.modules.compass = compassModule;

  window.addEventListener("map-ready", () => {
    try {
      compassModule.init();
    } catch (e) {
      console.error("[compass] init error:", e);
    }
  });
})();

=======
(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Compass module — feeds real device compass heading directly into the
  // player-marker arrow so the arrow on the map rotates with the device.
  // No overlay widget is created; the player marker IS the compass.

  // Minimum heading change (degrees) required before dispatching a new rotation
  // to the map marker. Filters sub-threshold sensor noise so the arrow does
  // not jitter when the player is stationary.
  const MIN_DISPATCH_DEG = 3;

  // Exponential moving-average alpha for heading smoothing (0 < α ≤ 1).
  // Lower = smoother but more latency; 0.15 is responsive enough for a compass
  // while damping high-frequency sensor chatter.
  const SMOOTH_ALPHA = 0.15;

  const compassModule = {
    hasInit: false,
    retryTimeout: null,
    lastHeading: 0,
    _orientationHandler: null,
    _absoluteHandler: null,
    _seenAbsolute: false,    // true once deviceorientationabsolute fires a valid reading
    _smoothedHeading: null,  // current EMA-smoothed heading (null before first reading)
    _dispatchedHeading: null, // last heading actually sent to worldmap

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

    // Apply circular exponential moving average and return smoothed heading.
    // Uses the same shortest-path delta as setPlayerHeading so wrap-around
    // (e.g. 359°→1°) is handled correctly.
    _smooth(raw) {
      if (this._smoothedHeading === null) {
        this._smoothedHeading = raw;
        return raw;
      }
      let delta = raw - this._smoothedHeading;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this._smoothedHeading = (this._smoothedHeading + SMOOTH_ALPHA * delta + 360) % 360;
      return this._smoothedHeading;
    },

    // Smooth incoming raw heading and only forward to worldmap when the
    // change exceeds MIN_DISPATCH_DEG. Eliminates sensor-noise jitter.
    _dispatch(raw, worldmap) {
      const smoothed = this._smooth(raw);
      this.lastHeading = smoothed;

      if (this._dispatchedHeading !== null) {
        let diff = Math.abs(smoothed - this._dispatchedHeading);
        if (diff > 180) diff = 360 - diff;
        if (diff < MIN_DISPATCH_DEG) return;
      }

      this._dispatchedHeading = smoothed;
      worldmap.setPlayerHeading(smoothed);
    },

    // Attach deviceorientation listener and pipe heading to worldmap.
    _startOrientationWatch(worldmap) {
      if (this._orientationHandler) return;

      const self = this;

      // Parse a raw heading from a DeviceOrientationEvent (or DeviceOrientationAbsolute).
      function extractHeading(evt) {
        if (typeof evt.webkitCompassHeading === "number" && !isNaN(evt.webkitCompassHeading)) {
          // iOS: clockwise from true north directly.
          return evt.webkitCompassHeading;
        }
        if (typeof evt.alpha === "number" && !isNaN(evt.alpha)) {
          // Standard API: alpha=0 is north, increases counter-clockwise.
          return (360 - evt.alpha) % 360;
        }
        return null;
      }

      // Handler for deviceorientationabsolute (Android Chrome, more accurate).
      // Marks that an absolute event has been seen so the fallback generic handler
      // stops firing — prevents both listeners from updating the marker on every frame.
      const absoluteHandler = (evt) => {
        const heading = extractHeading(evt);
        if (heading === null) return;
        self._seenAbsolute = true;
        self._dispatch(heading, worldmap);
      };

      // Handler for the generic deviceorientation event (iOS + fallback).
      // Skipped once deviceorientationabsolute starts delivering readings, because
      // both events fire on Android Chrome and processing both causes a double-jerk
      // on every sensor frame.
      const genericHandler = (evt) => {
        if (self._seenAbsolute) return;
        const heading = extractHeading(evt);
        if (heading === null) return;
        self._dispatch(heading, worldmap);
      };

      this._absoluteHandler = absoluteHandler;
      this._orientationHandler = genericHandler;
      const DeviceOrientationCtor = window.DeviceOrientationEvent;

      // iOS 13+ requires an explicit permission grant triggered by a user gesture.
      if (
        typeof DeviceOrientationCtor !== "undefined" &&
        typeof DeviceOrientationCtor.requestPermission === "function"
      ) {
        const requestOnGesture = () => {
          DeviceOrientationCtor.requestPermission()
            .then((permission) => {
              if (permission === "granted") {
                window.addEventListener("deviceorientationabsolute", absoluteHandler, { passive: true });
                window.addEventListener("deviceorientation", genericHandler, { passive: true });
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
      } else if (typeof DeviceOrientationCtor !== "undefined") {
        // Non-iOS: start listening immediately.
        window.addEventListener("deviceorientationabsolute", absoluteHandler, { passive: true });
        window.addEventListener("deviceorientation", genericHandler, { passive: true });
      }
    },

    destroy() {
      if (this._absoluteHandler) {
        window.removeEventListener("deviceorientationabsolute", this._absoluteHandler);
        this._absoluteHandler = null;
      }
      if (this._orientationHandler) {
        window.removeEventListener("deviceorientation", this._orientationHandler);
        this._orientationHandler = null;
      }
    }
  };

  Game.modules.compass = compassModule;

  window.addEventListener("map-ready", () => {
    try {
      compassModule.init();
    } catch (e) {
      console.error("[compass] init error:", e);
    }
  });
})();

>>>>>>> sync/main-reconcile-20260524-081701
