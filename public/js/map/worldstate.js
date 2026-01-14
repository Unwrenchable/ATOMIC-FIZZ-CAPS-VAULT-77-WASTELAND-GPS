(function () {
    "use strict";

    // ------------------------------------------------------------
    // GLOBAL GAME NAMESPACE
    // ------------------------------------------------------------
    window.game = window.game || {};
    const game = window.game;

    // Player worldstate
    game.player = game.player || {
        hp: 100,
        rads: 0,
        caps: 0,
        faction: "UNALIGNED",
        location: {
            id: "unknown",
            name: "WASTELAND",
            lat: null,
            lng: null
        }
    };

    // POI storage
    game.locations = [];
    game.markers = {};

    // GPS state
    let playerLatLng = null;
    let lastAccuracy = 999;

    // SCAN radius (meters)
    const SCAN_RADIUS = 500;

    // SCAN cooldown
    let lastScan = 0;
    const SCAN_COOLDOWN = 1500; // ms

    // ------------------------------------------------------------
    // LOAD FALLOUT POIs
    // ------------------------------------------------------------
    async function loadPOIs() {
        try {
            const res = await fetch("/data/fallout_pois.json");
            const data = await res.json();
            game.locations = data;
            console.log(`Loaded ${data.length} POIs`);
        } catch (err) {
            console.error("Failed to load fallout_pois.json", err);
        }
    }

    // ------------------------------------------------------------
    // GPS TRACKING
    // ------------------------------------------------------------
    navigator.geolocation?.watchPosition(
        p => {
            lastAccuracy = p.coords.accuracy || 999;

            playerLatLng = {
                lat: p.coords.latitude,
                lng: p.coords.longitude
            };

            game.player.location = {
                id: "world_position",
                name: "WASTELAND",
                lat: playerLatLng.lat,
                lng: playerLatLng.lng
            };

            if (typeof game.updatePlayerMarker === "function") {
                game.updatePlayerMarker(playerLatLng);
            }

            game.sendLocationToTerminal?.();
        },
        err => {
            console.warn("GPS unavailable:", err);

            game.player.location = {
                id: "gps_denied",
                name: "NO SIGNAL",
                lat: null,
                lng: null
            };

            if (typeof game.updatePlayerMarker === "function") {
                game.updatePlayerMarker(null);
            }

            game.sendLocationToTerminal?.();
        },
        { enableHighAccuracy: true }
    );

    // ------------------------------------------------------------
    // SCAN LOGIC
    // ------------------------------------------------------------
    game.getNearbyPOIs = function () {
        if (!playerLatLng || !Array.isArray(game.locations)) return [];

        const now = Date.now();
        if (now - lastScan < SCAN_COOLDOWN) {
            return game._lastScanResults || [];
        }
        lastScan = now;

        const hasLeaflet = typeof L !== "undefined";

        const results = game.locations
            .map(loc => {
                if (loc.lat == null || loc.lng == null) return null;

                let dist;
                if (hasLeaflet) {
                    dist = L.latLng(playerLatLng.lat, playerLatLng.lng)
                        .distanceTo(L.latLng(loc.lat, loc.lng));
                } else {
                    dist = haversine(playerLatLng, loc);
                }

                return { id: loc.id, name: loc.name, distance: dist };
            })
            .filter(Boolean)
            .filter(p => p.distance <= SCAN_RADIUS)
            .sort((a, b) => a.distance - b.distance);

        game._lastScanResults = results;
        return results;
    };

    // ------------------------------------------------------------
    // HAVERSINE FALLBACK
    // ------------------------------------------------------------
    function haversine(a, b) {
        const R = 6371000;
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLng = (b.lng - a.lng) * Math.PI / 180;
        const lat1 = a.lat * Math.PI / 180;
        const lat2 = b.lat * Math.PI / 180;

        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(h));
    }

    // ------------------------------------------------------------
    // OVERSEER TERMINAL INTEGRATION
    // ------------------------------------------------------------
    game.sendStatusToTerminal = function () {
        window.dispatchEvent(
            new CustomEvent("game:event", {
                detail: {
                    type: "status",
                    payload: {
                        hp: game.player.hp,
                        rads: game.player.rads,
                        caps: game.player.caps,
                        faction: game.player.faction
                    }
                }
            })
        );
    };

    game.sendInventoryToTerminal = function () {
        window.dispatchEvent(
            new CustomEvent("game:event", {
                detail: {
                    type: "inventory",
                    payload: { items: game.inventory || [] }
                }
            })
        );
    };

    game.sendMapInfoToTerminal = function () {
        window.dispatchEvent(
            new CustomEvent("game:event", {
                detail: {
                    type: "map_scan",
                    payload: { nearby: game.getNearbyPOIs() }
                }
            })
        );
    };

    game.sendLocationToTerminal = function () {
        window.dispatchEvent(
            new CustomEvent("game:event", {
                detail: {
                    type: "location",
                    payload: game.player.location
                }
            })
        );
    };

    game.sendCapsToTerminal = function () {
        window.dispatchEvent(
            new CustomEvent("game:event", {
                detail: {
                    type: "caps",
                    payload: { caps: game.player.caps }
                }
            })
        );
    };

    game.sendVbotToTerminal = function (message) {
        window.dispatchEvent(
            new CustomEvent("game:event", {
                detail: { type: "vbot", payload: { message } }
            })
        );
    };

    // ------------------------------------------------------------
    // TERMINAL COMMAND LISTENER
    // ------------------------------------------------------------
    window.addEventListener("overseer:command", e => {
        const { type, payload } = e.detail;

        switch (type) {
            case "terminal_ready":
                game.sendStatusToTerminal();
                game.sendLocationToTerminal();
                game.sendMapInfoToTerminal();
                game.sendInventoryToTerminal();
                game.sendCapsToTerminal();
                break;

            case "status":
                game.sendStatusToTerminal();
                break;

            case "inventory":
                game.sendInventoryToTerminal();
                break;

            case "map_scan":
                game.sendMapInfoToTerminal();
                break;

            case "location":
                game.sendLocationToTerminal();
                break;

            case "caps":
                game.sendCapsToTerminal();
                break;

            case "vbot":
                game.sendVbotToTerminal(
                    payload?.text || "ONLINE. AWAITING DIRECTIVES."
                );
                break;

            default:
                break;
        }
    });

    // ------------------------------------------------------------
    // BOOT
    // ------------------------------------------------------------
    loadPOIs().then(() => {
        window.dispatchEvent(new CustomEvent("game:ready"));
    });

})();
