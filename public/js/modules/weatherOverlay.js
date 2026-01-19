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

