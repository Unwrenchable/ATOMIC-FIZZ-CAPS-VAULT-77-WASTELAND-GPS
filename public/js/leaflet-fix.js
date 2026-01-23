// public/js/leaflet-fix.js
// Fix Leaflet default marker icons to use Pip-Boy style SVG instead of missing PNG files
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    // Generate Pip-Boy style marker SVG (green glowing dot) with unique filter ID
    function createPipboyMarkerSVG(size, blur, uniqueId) {
      const center = size / 2;
      const outerR = size / 4;
      const midR = size / 6;
      const innerR = size / 12;
      return `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <filter id="glow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${blur}" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <circle cx="${center}" cy="${center}" r="${outerR}" fill="#00ff41" filter="url(#glow-${uniqueId})" opacity="0.9"/>
          <circle cx="${center}" cy="${center}" r="${midR}" fill="#00ff41"/>
          <circle cx="${center}" cy="${center}" r="${innerR}" fill="#0a1a0a"/>
        </svg>
      `)}`;
    }

    const pipboyMarkerSVG = createPipboyMarkerSVG(24, 2, '1x');
    const pipboyMarkerSVG2x = createPipboyMarkerSVG(48, 3, '2x');

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
