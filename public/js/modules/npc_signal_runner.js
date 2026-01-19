// npc_signal_runner.js
// ------------------------------------------------------------
// Handcrafted Story NPC: The Signal Runner
// Minimal version — only used for Wake Up encounter for now
// No HQ logic, no endgame logic, no proximity triggers
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const SignalRunner = {
    id: "signal_runner",
    name: "The Signal Runner",

    // Early-game encounter dialog (Wake Up quest)
    introLines: [
      "Easy… your pulse is spiking. That’s normal after a wake signal.",
      "You weren’t supposed to wake up here. Not like this.",
      "I’ve been tracking your signal since the moment you slipped into this timeline."
    ],

    // Create her NPC entity (handcrafted, not generator-based)
    createNPC(position) {
      return {
        id: "signal_runner",
        name: "The Signal Runner",
        type: "story_npc",
        unique: true,
        position
      };
    }
  };

  Game.modules.SignalRunner = SignalRunner;
})();
