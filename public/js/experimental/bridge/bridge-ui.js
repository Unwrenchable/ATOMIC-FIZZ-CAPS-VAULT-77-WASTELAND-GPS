// experimental/bridge/bridge-ui.js
// Staged BRIDGE UI (inactive until imported)

(function () {
  console.log("[BRIDGE] Experimental BRIDGE UI loaded (inactive)");

  window.BridgeUI = {
    renderBridgePanel() {
      console.warn("[BRIDGE] renderBridgePanel called but BRIDGE UI is inactive");
    }
  };
})();
