// public/js/leaflet-fix.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/images/marker-icon-2x.png',
      iconUrl: '/images/marker-icon.png',
      shadowUrl: '/images/marker-shadow.png'
    });
    console.log("Leaflet marker icons fixed");
  }
});
