// public/js/leaflet-fix.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
      iconUrl: '/leaflet/images/marker-icon.png',
      shadowUrl: '/leaflet/images/marker-shadow.png'
    });
    console.log("Leaflet marker icons fixed");
  }
});
