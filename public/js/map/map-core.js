/* ============================================================
   WASTELAND MAP RENDERER — GLOBAL VECTOR MAP (FINAL VERSION)
   ============================================================ */

window.game = window.game || {};
const game = window.game;

(function () {
    let map = null;
    let worldLayer = null;
    let playerMarker = null;

    const mapStatus = document.getElementById("mapStatus");
    const accDot = document.getElementById("accDot");
    const accText = document.getElementById("accText");

    // ------------------------------------------------------------
    // WORLD STYLE (Fallout parchment + ink)
    // ------------------------------------------------------------
    function worldStyle() {
        return {
            color: "#2f3b24",
            weight: 0.6,
            opacity: 0.7,
            fillColor: "#201f18",
            fillOpacity: 0.95
        };
    }

    // ------------------------------------------------------------
    // INIT MAP
    // ------------------------------------------------------------
    function init() {
        if (map) return;

        map = L.map("mapContainer", {
            zoomControl: false,
            attributionControl: false,
            minZoom: 2,
            maxZoom: 10,
            center: [20, 0],
            zoom: 2
        });

        // Load world GeoJSON
        fetch("/data/map/world.geojson")
            .then(res => res.json())
            .then(data => {
                worldLayer = L.geoJSON(data, { style: worldStyle }).addTo(map);
                map.fitBounds(worldLayer.getBounds());
                mapStatus.textContent = "READY";
            })
            .catch(err => {
                console.error("World map failed:", err);
                mapStatus.textContent = "ERROR";
            });

        // Player marker
        playerMarker = L.circleMarker([0, 0], {
            radius: 6,
            color: "#00ff41",
            weight: 2,
            fillColor: "#00ff41",
            fillOpacity: 0.9
        }).addTo(map);

        playerMarker.setStyle({ opacity: 0, fillOpacity: 0 });
    }

    // ------------------------------------------------------------
    // UPDATE PLAYER MARKER (called by worldstate.js)
    // ------------------------------------------------------------
    game.updatePlayerMarker = function (latlng, accuracy) {
        if (!map) init();

        if (!latlng) {
            accText.textContent = "NO SIGNAL";
            accDot.style.background = "red";
            playerMarker.setStyle({ opacity: 0, fillOpacity: 0 });
            return;
        }

        const pos = [latlng.lat, latlng.lng];

        playerMarker.setLatLng(pos);
        playerMarker.setStyle({ opacity: 1, fillOpacity: 0.9 });

        map.setView(pos, 8, { animate: true });

        // Accuracy indicator
        if (accuracy != null) {
            accText.textContent = `±${Math.round(accuracy)}m`;
            accDot.style.background =
                accuracy < 20 ? "#00ff41" :
                accuracy < 60 ? "yellow" : "red";
        }
    };

    // ------------------------------------------------------------
    // AUTO-INIT
    // ------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", init);
})();
