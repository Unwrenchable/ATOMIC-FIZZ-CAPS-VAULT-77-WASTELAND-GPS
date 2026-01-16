// /js/overseer/handlers.js
// Custom Overseer Commands (experimental zones, etc.)

window.overseerHandlers = {

  zones() {
    overseerSay("EXPERIMENTAL ZONES:");
    overseerSay(" - WORMHOLE BRIDGE (LOCKED)");
    overseerSay(" - NUKE TESTING GROUNDS (LOCKED)");
    overseerSay(" - SECTOR 7 (CLASSIFIED)");
    overseerSay("");
    overseerSay("TYPE 'bridge' OR 'nuke' FOR DETAILS.");
  },

  bridge() {
    overseerSay("> ACCESSING WORMHOLE BRIDGE SUBSYSTEM...");
    overseerSay("> STATUS: SEALED");
    overseerSay("> CLEARANCE LEVEL OMEGA REQUIRED");
    overseerSay("> TYPE 'bridge.unlock' TO REQUEST AUTHORIZATION.");
  },

  "bridge.unlock"() {
    overseerSay("> REQUESTING AUTHORIZATION...");
    setTimeout(() => {
      overseerSay("> AUTHORIZATION GRANTED.");
      overseerSay("> OPENING WORMHOLE BRIDGE INTERFACE...");
      setTimeout(() => {
        window.open("/experimental/bridge/portal.html", "_blank");
      }, 800);
    }, 1200);
  },

  nuke() {
    overseerSay("> ACCESSING NUCLEAR TESTING GROUNDS...");
    overseerSay("> STATUS: LOCKED");
    overseerSay("> RADIATION LEVELS: CRITICAL");
    overseerSay("> TYPE 'nuke.unlock' TO OVERRIDE SAFETY LOCKS.");
  },

  "nuke.unlock"() {
    overseerSay("> WARNING: OVERRIDING SAFETY LOCKS...");
    setTimeout(() => {
      overseerSay("> LOCKS DISENGAGED.");
      overseerSay("> OPENING TESTING GROUNDS INTERFACE...");
      setTimeout(() => {
        window.open("/experimental/nuke/index.html", "_blank");
      }, 800);
    }, 1500);
  }
};
