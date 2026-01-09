// game-state.js
// Centralized state container so modules can cooperate

window.gameState = {
  player: {
    level: 1,
    hp: 100,
    maxHp: 100,
    caps: 0,
    xp: 0,
    position: { lat: 36.1699, lng: -115.1398 },
    equipped: {
      weapon: null,
      armor: null,
    },
  },
  inventory: {
    weapons: [],
    ammo: [],
    armor: [],
    consumables: [],
    questItems: [],
    misc: [],
  },
  quests: {
    // questId -> { state, currentStepIndex }
  },
  encounters: {
    active: null, // { encounter, enemyIndex, enemyHp[] }
  },
};
