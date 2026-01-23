// ============================================================
// POI MARKER ENGINE — TILE MAP VERSION (FINAL)
// ============================================================

window.Game = window.Game || {};
const Game = window.Game;

(function () {
  "use strict";

  let markers = {};

  // ============================================================
  // ICON FALLBACK MAPPING (Enhanced for Fallout authenticity)
  // Maps iconKey values that don't have SVG files to existing icons
  // ============================================================
  const ICON_FALLBACK_MAP = {
    // NPCs/Characters
    'drifter': 'ghost',
    'courier': 'player',
    'wanderer': 'ghost',
    'settler': 'settlement',
    'wastelander': 'ghost',
    'survivor': 'player',
    
    // Factions without dedicated icons
    'followers': 'medical',
    'institute': 'lab',
    'minutemen': 'settlement',
    'railroad': 'tunnel',
    'brotherhood': 'bos',
    'enclave_faction': 'enclave',
    'ncr_faction': 'ncr',
    'legion_faction': 'legion',
    'gunners': 'raider',
    'super_mutants': 'enemy',
    
    // Trading/Commerce
    'trader': 'trading',
    'merchant': 'market',
    'vendor': 'shop',
    'caravan_stop': 'caravan',
    'general_store': 'store',
    
    // Location types without dedicated icons
    'office': 'city',
    'apartment': 'city',
    'residential': 'town',
    'industrial': 'factory',
    'research': 'lab',
    'science': 'lab',
    'medical_center': 'hospital',
    'clinic_building': 'clinic',
    'military_base': 'military',
    'army': 'military',
    'navy': 'military',
    'air_force': 'airport',
    'vault_entrance': 'vault',
    'vault_door': 'vault',
    'underground': 'tunnel',
    'subway': 'metro',
    'train': 'station',
    'bus': 'station',
    'gas': 'gasstation',
    'fuel_station': 'gasstation',
    'motel_sign': 'motel',
    'inn': 'motel',
    'bar_tavern': 'bar',
    'saloon': 'bar',
    'restaurant_cafe': 'restaurant',
    'food': 'restaurant',
    'church_chapel': 'church',
    'religious': 'religion',
    'cemetery_graveyard': 'cemetery',
    'grave': 'graveyard',
    'farm_field': 'farm',
    'agricultural': 'farm',
    'forest_woods': 'forest',
    'wilderness_wild': 'wilderness',
    'mountain_peak': 'mountain',
    'hill': 'mountain',
    'water_body': 'water',
    'lake': 'water',
    'river': 'water',
    'ocean': 'water',
    'dam': 'power',
    'power_plant': 'power',
    'nuclear': 'reactor',
    'radiation': 'rad',
    'danger_zone': 'danger',
    'hazard': 'danger',
    'warning': 'danger',
    'raider_camp': 'raider',
    'bandit': 'raider',
    'gang': 'raider',
    'ghoul_area': 'ghoul',
    'feral': 'ghoul',
    'boss_area': 'boss',
    'boss_fight': 'boss',
    'legendary': 'boss',
    'quest_marker': 'quest',
    'mission': 'quest',
    'objective': 'quest',
    'sidequest_marker': 'sidequest',
    'loot_cache': 'loot',
    'treasure': 'loot',
    'stash': 'loot',
    'supply_depot': 'supply',
    'resources': 'supply',
    'tools': 'toolbox',
    'workshop': 'toolbox',
    'scrap': 'scrapyard',
    'junk': 'junkyard',
    
    // Null/Invalid fallback
    'null': 'poi',
    'undefined': 'poi',
    '': 'poi',
    'unknown': 'poi',
    'default': 'poi',
    'generic': 'poi'
  };

  // Get valid icon name with fallback
  function getValidIcon(iconKey) {
    if (!iconKey || iconKey === 'null' || iconKey === 'undefined') {
      return 'poi';
    }
    return ICON_FALLBACK_MAP[iconKey] || iconKey;
  }

  // ------------------------------------------------------------
  // ICON FACTORY (SVG icons from /img/icons/*.svg)
  // ------------------------------------------------------------
  function createIcon(poi) {
    const rarityClass =
      poi.rarity === "legendary" ? "pipboy-rarity-legendary" :
      poi.rarity === "epic" ? "pipboy-rarity-epic" :
      "";

    // Use icon or iconKey with proper fallback
    const rawIconKey = poi.icon || poi.iconKey || "poi";
    const iconName = getValidIcon(rawIconKey);

    return L.divIcon({
      className: `pipboy-marker pipboy-marker-svg ${rarityClass}`,
      html: `<img src="/img/icons/${iconName}.svg" />`,
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
      // Try multiple data sources for POI data
      let pois = [];
      
      // First try the main poi.json
      try {
        const res = await fetch("/data/poi.json");
        const poiData = await res.json();
        
        // Handle grouped structure (strip, freeside, outer_vegas, etc.)
        if (poiData && typeof poiData === 'object' && !Array.isArray(poiData)) {
          Object.values(poiData).forEach(group => {
            if (Array.isArray(group)) {
              pois.push(...group);
            }
          });
        } else if (Array.isArray(poiData)) {
          pois = poiData;
        }
      } catch (e) {
        console.warn("POI engine: failed to load poi.json, trying fallout_pois.json");
      }

      // If no POIs, try fallout_pois.json as fallback
      if (pois.length === 0) {
        try {
          const res = await fetch("/data/fallout_pois.json");
          const falloutPois = await res.json();
          
          if (falloutPois && typeof falloutPois === 'object' && !Array.isArray(falloutPois)) {
            Object.values(falloutPois).forEach(group => {
              if (Array.isArray(group)) {
                pois.push(...group);
              }
            });
          } else if (Array.isArray(falloutPois)) {
            pois = falloutPois;
          }
        } catch (e) {
          console.warn("POI engine: failed to load fallout_pois.json");
        }
      }

      if (pois.length === 0) {
        console.warn("POI engine: no POI data found");
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
