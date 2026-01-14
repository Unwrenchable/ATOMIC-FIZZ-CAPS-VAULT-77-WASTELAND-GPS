/* ============================================================
   WASTELAND MAP ENGINE — GLOBAL VECTOR MAP (FINAL VERSION)
   ============================================================ */

if (!window.Game) window.Game = {};
if (!Game.map) Game.map = {};

Game.map.engine = (function () {
  let map = null;
  let worldLayer = null;
  let playerMarker = null;

  const mapStatus = document.getElementById("mapStatus");
  const gpsBadge = document.getElementById("gpsBadge");
  const accDot = document.getElementById("accDot");
  const accText = document.getElementById("accText");

  /* ------------------------------------------------------------
     STYLE: Pip‑Boy green vector style
     ------------------------------------------------------------ */
  function worldStyle() {
    return {
      color: "#2f3b24",
      weight: 0.6,
      opacity: 0.7,
      fillColor: "#201f18",
      fillOpacity: 0.95
    };
  }

  /* ------------------------------------------------------------
     Initialize the map
     ------------------------------------------------------------ */
  function init() {
    if (map) return map;

    map = L.map("mapContainer", {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
      minZoom: 2,
      maxZoom: 10,
      center: [20, 0],
      zoom: 2
    });

    // Load world GeoJSON
    fetch("/data/map/world.geojson")
      .then((res) => res.json())
      .then((data) => {
        worldLayer = L.geoJSON(data, { style: worldStyle }).addTo(map);
        map.fitBounds(worldLayer.getBounds());
        mapStatus.textContent = "READY";
      })
      .catch((err) => {
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

    startGPS();

    return map;
  }

  /* ------------------------------------------------------------
     GPS tracking
     ------------------------------------------------------------ */
  function startGPS() {
    if (!navigator.geolocation) {
      accText.textContent = "GPS UNSUPPORTED";
      return;
    }

    accText.textContent = "GPS LOCKING...";

    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        updatePlayer(lat, lng, acc);
      },
      (err) => {
        accText.textContent = "GPS ERROR";
        console.warn("GPS error:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }

  /* ------------------------------------------------------------
     Update player marker + center map
     ------------------------------------------------------------ */
  function updatePlayer(lat, lng, accuracy) {
    const pos = [lat, lng];

    playerMarker.setLatLng(pos);
    playerMarker.setStyle({ opacity: 1, fillOpacity: 0.9 });

    map.setView(pos, 8, { animate: true });

    accText.textContent = `±${Math.round(accuracy)}m`;
    accDot.style.background = accuracy < 20 ? "#00ff41" : accuracy < 60 ? "yellow" : "red";
  }

  /* ------------------------------------------------------------
     Public API
     ------------------------------------------------------------ */
  return {
    init,
    updatePlayer
  };
})();

/* Auto‑init when panel loads */
document.addEventListener("DOMContentLoaded", () => {
  Game.map.engine.init();
});
