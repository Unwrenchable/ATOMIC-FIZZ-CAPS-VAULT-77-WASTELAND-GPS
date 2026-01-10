// ======================================================================
//  MAP UI LAYER (HYBRID MODE)
//  This file ONLY handles Leaflet UI, markers, tiles, and visual map.
//  It depends on map-core.js for logic, GPS, POIs, and worldstate.
// ======================================================================

(function () {
    "use strict";

    // Ensure game namespace exists
    window.game = window.game || {};
    const game = window.game;

    // Leaflet map instance
    let map = null;

    // Player marker
    let playerMarker = null;

    // POI markers
    const poiMarkers = {};

    // Mojave defaults
    const MOJAVE_CENTER = [36.1147, -115.1728];
    const MOJAVE_ZOOM = 11;

    // ------------------------------------------------------------
    // ICONS (Pip‑Boy style)
    // ------------------------------------------------------------
    function getPipboyIcon(loc) {
        return L.divIcon({
            className: `pipboy-icon pipboy-${loc.iconKey || "poi"}`,
            iconSize: [24, 24],
            html: `<div class="pipboy-dot"></div>`
        });
    }

    // ------------------------------------------------------------
    // INITIALIZE LEAFLET MAP
    // ------------------------------------------------------------
    game.initMapUI = async function () {
        if (map) return; // Already initialized

        map = L.map("map", {
            zoomControl: false,
            attributionControl: false
        }).setView(MOJAVE_CENTER, MOJAVE_ZOOM);

        // CRT overlay
        const mapEl = document.getElementById("map");
        if (mapEl) mapEl.classList.add("map-crt");

        // Tile layer
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19 }
        ).addTo(map);

        // Load POIs from map-core.js
        if (Array.isArray(game.locations)) {
            game.locations.forEach(loc => {
                const marker = L.marker([loc.lat, loc.lng], {
                    icon: getPipboyIcon(loc),
                    title: loc.name
                })
                .addTo(map)
                .on("click", () => game.attemptClaim?.(loc));

                poiMarkers[loc.id] = marker;
            });
        }

        // Mark already claimed POIs
        if (game.player?.claimed) {
            Object.keys(poiMarkers).forEach(id => {
                if (game.player.claimed.has(id)) {
                    const m = poiMarkers[id];
                    if (m._icon) m._icon.classList.add("claimed");
                }
            });
        }

        console.log("Map UI initialized");
    };

    // ------------------------------------------------------------
    // UPDATE PLAYER MARKER (called by map-core.js)
    // ------------------------------------------------------------
    game.updatePlayerMarker = function (latlng) {
        if (!map) return; // UI not loaded yet

        if (!playerMarker) {
            playerMarker = L.circleMarker(latlng, {
                radius: 10,
                color: "#00ff41",
                fillOpacity: 0.9
            })
            .addTo(map)
            .bindPopup("You");
        } else {
            playerMarker.setLatLng(latlng);
        }
    };

    // ------------------------------------------------------------
    // CLAIM SYSTEM UI HOOKS
    // ------------------------------------------------------------
    game.markClaimedUI = function (id) {
        const m = poiMarkers[id];
        if (m?._icon) m._icon.classList.add("claimed");
    };

    // ------------------------------------------------------------
    // BUTTONS (center, recenter Mojave)
    // ------------------------------------------------------------
    const centerBtn = document.getElementById("centerBtn");
    if (centerBtn) {
        centerBtn.onclick = () => {
            if (playerMarker) {
                map.flyTo(playerMarker.getLatLng(), 17);
            }
        };
    }

    const recenterBtn = document.getElementById("recenterMojave");
    if (recenterBtn) {
        recenterBtn.onclick = () => {
            map.setView(MOJAVE_CENTER, MOJAVE_ZOOM);
        };
    }

    // ------------------------------------------------------------
    // AUTO‑INIT WHEN MAP TAB IS OPENED
    // ------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        const mapTab = document.getElementById("mapTab");
        if (!mapTab) return;

        mapTab.addEventListener("click", () => {
            setTimeout(() => game.initMapUI(), 50);
        });
    });

})();
