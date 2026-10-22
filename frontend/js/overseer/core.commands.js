// core.commands.js
// Extended command set for Overseer Terminal
// ---------------------------------------------------------------------------

(function () {
  "use strict";
  
  // Ensure overseerHandlers exists for other modules to add commands
  if (!window.overseerHandlers) window.overseerHandlers = {};
  
  // Expose a CommandExt API for the brain to reference
  window.overseerCommandExt = {
    registered: true,
    
    // Get list of all custom commands
    getCommands() {
      return Object.keys(window.overseerHandlers || {});
    }
  };
  
})();
