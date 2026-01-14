// pipboy-style.js
// Custom Fallout Pip‑Boy map theme for ATOMIC FIZZ CAPS

export const pipboyStyle = [
  {
    featureType: "all",
    elementType: "labels.text.fill",
    stylers: [
      { saturation: 36 },
      { color: "#00ff2a" },     // brighter Pip‑Boy green
      { lightness: 20 }
    ]
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [
      { visibility: "on" },
      { color: "#001900" },     // deep CRT shadow
      { lightness: 10 }
    ]
  },
  {
    featureType: "all",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }]
  },

  // Administrative regions
  {
    featureType: "administrative",
    elementType: "geometry.fill",
    stylers: [{ color: "#003d0a" }]
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [
      { color: "#007a1c" },
      { weight: 1.2 }
    ]
  },

  // Natural landscape
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#0b4f14" }]
  },

  // Man‑made landscape
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#004f0f" }]
  },

  // POIs
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#006b12" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#00ff33" }]
  },

  // Parks
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#005f16" }]
  },

  // Roads
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#00991f" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#000000" }]
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.fill",
    stylers: [{ color: "#00ff1c" }]
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#001400" }]
  },

  // Transit
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#003d0a" }]
  },

  // Water
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#001700" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#009922" }]
  }
];
