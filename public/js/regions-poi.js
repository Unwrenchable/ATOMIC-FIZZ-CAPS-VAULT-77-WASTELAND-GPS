// regions-poi.js
// Clean, fixed, non-duplicated version

(function () {
  const gs = window.gameState;

  const REGIONS = [
    {
      id: "mojave",
      name: "Mojave Wasteland",
      center: { lat: 36.1699, lng: -115.1398 },
      radiusKm: 60,
      mapStyle: "desert_ruins_explorer",
    },
    {
      id: "rad_zone",
      name: "Irradiated Basin",
      center: { lat: 35.5, lng: -114.8 },
      radiusKm: 40,
      mapStyle: "rad_zone_red_ocean",
    },
    {
      id: "vault_region",
      name: "Vault Corridor",
      center: { lat: 36.1, lng: -115.2 },
      radiusKm: 20,
      mapStyle: "vaulttec_blue_terminal",
    },
  ];

  const POIS = [
    {
      id: "helios_one",
      name: "HELIOS One",
      lat: 36.068,
      lng: -115.017,
      radiusMeters: 150,
      questTriggers: ["quest_echoes_dam_step2"],
      itemTriggers: [],
    },
    {
      id: "vault77",
      name: "Vault 77 Entrance",
      lat: 36.05,
      lng: -115.2,
      radiusMeters: 120,
      questTriggers: ["quest_vault77_open"],
      itemTriggers: ["vault77_keycard"],
    },
  ];

  function haversineKm(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function getCurrentRegion() {
    const pos = gs.player.position;
    let best = null;
    let bestDist = Infinity;

    REGIONS.forEach((r) => {
      const dist = haversineKm(pos, r.center);
      if (dist < r.radiusKm && dist < bestDist) {
        best = r;
        bestDist = dist;
      }
    });

    return best;
  }

  function getNearbyPOIs(maxDistanceMeters = 500) {
    const pos = gs.player.position;
    const out = [];

    POIS.forEach((p) => {
      const distKm = haversineKm(pos, { lat: p.lat, lng: p.lng });
      const distM = distKm * 1000;
      if (distM <= (p.radiusMeters || maxDistanceMeters)) {
        out.push({ poi: p, distanceMeters: distM });
      }
    });

    return out;
  }

  window.world = {
    REGIONS,
    POIS,
    getCurrentRegion,
    getNearbyPOIs,
  };
})();
