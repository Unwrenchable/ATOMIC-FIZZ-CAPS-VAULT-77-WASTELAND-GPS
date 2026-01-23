// public/js/leaflet-fix.js
// Fix Leaflet default marker icons to use Pip-Boy style SVG instead of missing PNG files
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    // Marker size constants
    const MARKER_SIZE = 24;
    const MARKER_SIZE_RETINA = MARKER_SIZE * 2;

    // Generate Pip-Boy style marker SVG with contained glow (no bleed, no animation)
    function createPipboyMarkerSVG(size) {
      const center = size / 2;
      const outerR = size * 0.42;  // Outer glow ring
      const midR = size * 0.33;    // Mid glow ring  
      const innerR = size * 0.25;  // Main solid circle
      const coreR = size * 0.12;   // Dark center dot
      
      return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${center}" cy="${center}" r="${outerR}" fill="#00ff41" opacity="0.15"/>
  <circle cx="${center}" cy="${center}" r="${midR}" fill="#00ff41" opacity="0.3"/>
  <circle cx="${center}" cy="${center}" r="${innerR}" fill="#00ff41" opacity="0.9"/>
  <circle cx="${center}" cy="${center}" r="${coreR}" fill="#0a1a0a"/>
</svg>`)}`;
    }

    const pipboyMarkerSVG = createPipboyMarkerSVG(MARKER_SIZE);
    const pipboyMarkerSVG2x = createPipboyMarkerSVG(MARKER_SIZE_RETINA);

    // Shadow is not needed for Pip-Boy style markers, use transparent
    const transparentShadow = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: pipboyMarkerSVG2x,
      iconUrl: pipboyMarkerSVG,
      shadowUrl: transparentShadow,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
      shadowSize: [0, 0]
    });
    console.log("[leaflet-fix] Pip-Boy style default markers configured");
  }
});
