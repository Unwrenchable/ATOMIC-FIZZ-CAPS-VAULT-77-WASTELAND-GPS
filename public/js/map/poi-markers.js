// ============================================================
// POI MARKER ENGINE — TILE MAP VERSION (FINAL)
// ============================================================

window.Game = window.Game || {};
const Game = window.Game;

(function () {
  "use strict";

  let markers = {};

  // ------------------------------------------------------------
  // ICON FACTORY (SVG icons from /img/icons/*.svg)
  // ------------------------------------------------------------
  function createIcon(poi) {
    const rarityClass =
      poi.rarity === "legendary" ? "pipboy-rarity-legendary" :
      poi.rarity === "epic" ? "pipboy-rarity-epic" :
      "";

    return L.divIcon({
      className: `pipboy-marker pipboy-marker-svg ${rarityClass}`,
      html: `<img src="/img/icons/${poi.icon || "poi"}.svg" />`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  // ------------------------------------------------------------
  // LOAD + RENDER POIs
  // ------------------------------------------------------------
  Game.loadPOIMarkers = async function (map) {
    if (!map) return;

    try {
      const res = await fetch("/data/map/fallout_pois.json");
      const pois = await res.json();

      if (!Array.isArray(pois)) {
        console.error("POI file invalid:", pois);
        return;
      }

      pois.forEach(poi => {
        if (poi.lat == null || poi.lng == null) return;

        const marker = L.marker([poi.lat, poi.lng], {
          icon: createIcon(poi)
        }).addTo(map);

        marker.bindTooltip(
          `<b>${poi.name}</b>`,
          { direction: "top", offset: [0, -10] }
        );

        markers[poi.id] = marker;
      });

      Game.markers = markers;
      console.log(`POI engine: loaded ${Object.keys(markers).length} markers`);

    } catch (err) {
      console.error("POI engine failed:", err);
    }
  };

})();
