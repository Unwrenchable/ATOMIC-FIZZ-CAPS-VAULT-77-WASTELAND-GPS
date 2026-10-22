// backend/api/vitals-rules.js
// Shared B.L.A.S.T.E.D. (internal S/P/E/C/I/A/L) allocation rules.
"use strict";
const VITALS_KEYS = ["S", "P", "E", "C", "I", "A", "L"];
// 7 stats at 1 + 21 creator points.
const MAX_VITALS_TOTAL = 28;

function total(sp) {
  return VITALS_KEYS.reduce((acc, k) => acc + (Number(sp && sp[k]) || 0), 0);
}

// An update may not raise the total above the creator cap. Profiles that already
// sit above it (legacy all-5 defaults = 35, respec resets) may keep or lower it,
// never inflate it.
function checkUpdateTotal(nextSpecial, currentSpecial) {
  const next = total(nextSpecial);
  const allowed = Math.max(MAX_VITALS_TOTAL, total(currentSpecial));
  return { ok: next <= allowed, total: next, allowed };
}

module.exports = { VITALS_KEYS, MAX_VITALS_TOTAL, total, checkUpdateTotal };
