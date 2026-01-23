// public/js/leaflet-fix.js
// Fix Leaflet default marker icons to use Pip-Boy style SVG instead of missing PNG files
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    // Pip-Boy style marker SVG (green glowing dot) as data URL
    const pipboyMarkerSVG = `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        <circle cx="12" cy="12" r="6" fill="#00ff41" filter="url(#glow)" opacity="0.9"/>
        <circle cx="12" cy="12" r="4" fill="#00ff41"/>
        <circle cx="12" cy="12" r="2" fill="#0a1a0a"/>
      </svg>
    `)}`;

    // Larger version for retina displays
    const pipboyMarkerSVG2x = `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <defs>
          <filter id="glow2x" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        <circle cx="24" cy="24" r="12" fill="#00ff41" filter="url(#glow2x)" opacity="0.9"/>
        <circle cx="24" cy="24" r="8" fill="#00ff41"/>
        <circle cx="24" cy="24" r="4" fill="#0a1a0a"/>
      </svg>
    `)}`;

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
