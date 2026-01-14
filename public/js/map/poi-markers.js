/* ============================================================
   POI MARKER ENGINE — Fallout SVG Icons (Drop‑In Replacement)
   ============================================================ */

window.game = window.game || {};
const game = window.game;

(function () {
    "use strict";

    let poiLayer = null;

    // Folder where your SVG icons live
    const ICON_PATH = "/img/icons/";

    // Default icon if POI doesn't specify one
    const DEFAULT_ICON = "poi.svg";

    // ------------------------------------------------------------
    // CREATE LEAFLET ICON
    // ------------------------------------------------------------
    function createIcon(filename) {
        return L.icon({
            iconUrl: ICON_PATH + (filename || DEFAULT_ICON),
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            className: "poi-icon"
        });
    }

    // ------------------------------------------------------------
    // RENDER ALL POIs ON MAP
    // ------------------------------------------------------------
    game.renderPOIs = function () {
        if (!window.game.mapReady || !window.game.map) return;

        // Remove old layer if it exists
        if (poiLayer) {
            poiLayer.remove();
            poiLayer = null;
        }

        // Build new layer
        poiLayer = L.layerGroup();

        game.locations.forEach(loc => {
            if (!loc.lat || !loc.lng) return;

            const icon = createIcon(loc.icon);

            const marker = L.marker([loc.lat, loc.lng], { icon });

            marker.bindTooltip(
                `<b>${loc.name}</b>`,
                { direction: "top", offset: [0, -10] }
            );

            poiLayer.addLayer(marker);
        });

        poiLayer.addTo(window.game.map);
    };

    // ------------------------------------------------------------
    // AUTO‑RENDER WHEN POIs LOAD
    // ------------------------------------------------------------
    window.addEventListener("game:ready", () => {
        setTimeout(() => game.renderPOIs(), 300);
    });

    // ------------------------------------------------------------
    // RE‑RENDER WHEN MAP FINISHES INITIALIZING
    // ------------------------------------------------------------
    window.addEventListener("map:ready", () => {
        setTimeout(() => game.renderPOIs(), 300);
    });

})();
