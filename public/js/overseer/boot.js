// overseer/boot.js
// Safe no-op boot file to satisfy legacy script references
// without interfering with overseer.full.js

(function () {
  "use strict";

  // If needed later, you can put lightweight bootstrap logic here.
  // For now, it just logs once and does nothing else.
  if (typeof console !== "undefined") {
    console.log("[Overseer] boot.js loaded (no-op).");
  }
})();
