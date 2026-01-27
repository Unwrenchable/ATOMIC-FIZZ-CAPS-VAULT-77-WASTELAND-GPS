// core.quest_mapintel.js
// Quest and map intelligence for Overseer awareness
// ---------------------------------------------------------------------------

(function () {
  "use strict";
  
  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;
  
  // Quest/Map intel command
  handlers.intel = function (args) {
    const sub = (args[0] || "").toLowerCase();
    
    if (!sub) {
      window.overseerSay("INTEL SUBSYSTEM ONLINE");
      window.overseerSay("  intel quests  - Show active quests");
      window.overseerSay("  intel nearby  - Show nearby POIs");
      window.overseerSay("  intel region  - Show current region info");
      return;
    }
    
    if (sub === "quests") {
      const quests = window.game?.quests?.active || [];
      if (!quests.length) {
        window.overseerSay("No active quests logged in system.");
        return;
      }
      window.overseerSay("ACTIVE QUESTS:");
      quests.forEach(q => {
        window.overseerSay(`  - ${q.title || q.id} [${q.state || "active"}]`);
      });
      return;
    }
    
    if (sub === "nearby") {
      const nearby = window.game?.getNearbyPOIs?.() || [];
      if (!nearby.length) {
        window.overseerSay("No points of interest detected in vicinity.");
        return;
      }
      window.overseerSay("NEARBY POINTS OF INTEREST:");
      nearby.forEach(poi => {
        window.overseerSay(`  - ${poi.name} (${poi.distance || "?"}m)`);
      });
      return;
    }
    
    if (sub === "region") {
      const loc = window.overseerWorldState?.player?.location || {};
      window.overseerSay(`CURRENT REGION: ${loc.regionId || loc.name || "Unknown"}`);
      if (loc.lat && loc.lng) {
        window.overseerSay(`COORDINATES: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
      }
      return;
    }
    
    window.overseerSay("Unknown intel subcommand. Try: quests, nearby, region");
  };
  
})();
