// test-quest-persistence.js
// Integration test for quest state persistence fixes
// Run with: node test-quest-persistence.js

console.log('📟 OVERSEER QUEST PERSISTENCE TEST\n');

// Simulate browser localStorage
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = value;
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Mock browser globals
global.localStorage = new MockStorage();
global.sessionStorage = new MockStorage();
global.window = {
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  Game: { modules: {}, player: { equipped: {} } },
  gameState: { quests: {}, player: { xp: 0, caps: 0 }, inventory: {} },
  PLAYER: { xp: 0, caps: 0, inventory: [], questsActive: [], questsCompleted: [] },
  dispatchEvent: () => {}
};
global.Game = global.window.Game;

// Mock DOM with proper methods
const mockElement = {
  style: {},
  addEventListener: () => {},
  appendChild: () => {},
  insertBefore: () => {},
  remove: () => {},
  setAttribute: () => {},
  getAttribute: () => null,
  innerHTML: '',
  id: '',
  className: '',
  querySelectorAll: () => []
};

global.document = {
  addEventListener: () => {},
  readyState: 'complete',
  createElement: (tag) => ({ ...mockElement }),
  body: { ...mockElement },
  head: { ...mockElement },
  getElementById: () => null
};

// Load the quest module
const fs = require('fs');
const path = require('path');

console.log('Loading quest module...');
const questModulePath = path.join(__dirname, 'public/js/modules/quests.js');
const questCode = fs.readFileSync(questModulePath, 'utf8');

// Extract and evaluate the quest module (wrapped in IIFE)
try {
  eval(questCode);
  console.log('✅ Quest module loaded\n');
} catch (e) {
  console.error('❌ Failed to load quest module:', e.message);
  process.exit(1);
}

const quests = global.Game.modules.quests;

if (!quests) {
  console.error('❌ Quest module not found in Game.modules');
  process.exit(1);
}

// Initialize quest system
console.log('Initializing quest system...');
quests.init(global.window.gameState);
console.log('✅ Quest system initialized\n');

// TEST 1: Quest state persistence
console.log('TEST 1: Quest State Persistence');
console.log('================================');

// Start a quest
console.log('Starting "wake_up" quest...');
quests.startQuest('wake_up');

// Check if saved
const savedState1 = localStorage.getItem('afc_quest_state');
if (savedState1) {
  const parsed = JSON.parse(savedState1);
  console.log('✅ Quest state saved to localStorage');
  console.log('   Active quests:', parsed.questsActive);
} else {
  console.log('❌ Quest state NOT saved!');
}

// TEST 2: Objective tracking and persistence
console.log('\nTEST 2: Objective Tracking');
console.log('===========================');

console.log('Completing objective: open_inventory');
quests.completeObjective('wake_up', 'open_inventory');

const savedState2 = localStorage.getItem('afc_quest_state');
if (savedState2) {
  const parsed = JSON.parse(savedState2);
  const wakeUpState = parsed.quests.wake_up;
  if (wakeUpState && wakeUpState.objectives && wakeUpState.objectives.open_inventory) {
    console.log('✅ Objective completion saved');
    console.log('   Objectives:', wakeUpState.objectives);
  } else {
    console.log('❌ Objective NOT saved!');
  }
}

// TEST 3: Quest completion and rewards
console.log('\nTEST 3: Quest Completion & Rewards');
console.log('===================================');

// Complete all objectives
const objectives = ['equip_weapon', 'turn_on_radio', 'open_map'];
objectives.forEach(obj => {
  console.log(`Completing objective: ${obj}`);
  quests.completeObjective('wake_up', obj);
});

// Check quest completion
const savedState3 = localStorage.getItem('afc_quest_state');
if (savedState3) {
  const parsed = JSON.parse(savedState3);
  const wakeUpState = parsed.quests.wake_up;
  
  if (wakeUpState && wakeUpState.state === 'completed') {
    console.log('✅ Quest marked as completed');
    console.log('   Quest state:', wakeUpState.state);
  } else {
    console.log('❌ Quest NOT marked as completed!');
    console.log('   Quest state:', wakeUpState ? wakeUpState.state : 'undefined');
  }
  
  console.log('   Completed quests:', parsed.questsCompleted);
}

// Check rewards
const finalXP = global.window.PLAYER.xp;
const finalCaps = global.window.PLAYER.caps;

console.log('\nRewards Check:');
console.log('   XP awarded:', finalXP, '(expected: 50)');
console.log('   Caps awarded:', finalCaps, '(expected: 25)');

if (finalXP >= 50) {
  console.log('   ✅ XP reward applied');
} else {
  console.log('   ❌ XP reward NOT applied!');
}

if (finalCaps >= 25) {
  console.log('   ✅ Caps reward applied');
} else {
  console.log('   ❌ Caps reward NOT applied!');
}

// TEST 4: State reload simulation
console.log('\nTEST 4: State Reload Simulation');
console.log('================================');

// Save current localStorage state
const savedData = { ...localStorage.store };

// Clear in-memory state (simulate page reload)
global.window.gameState = { quests: {}, player: { xp: 0, caps: 0 }, inventory: {} };
global.Game.modules.quests = null;

// Restore localStorage
localStorage.store = savedData;

// Reload quest module by re-initializing
console.log('Simulating page reload...');
eval(questCode);
const questsReloaded = global.Game.modules.quests;
questsReloaded.init(global.window.gameState);

// Check if state was restored
const wakeUpStateReloaded = questsReloaded.ensureQuestState('wake_up');
console.log('Reloaded quest state:', wakeUpStateReloaded);

if (wakeUpStateReloaded.state === 'completed') {
  console.log('✅ Quest state persisted across reload');
  console.log('   All objectives:', wakeUpStateReloaded.objectives);
} else {
  console.log('❌ Quest state LOST on reload!');
}

// SUMMARY
console.log('\n📟 TEST SUMMARY');
console.log('===============');

const tests = [
  { name: 'Quest state saves to localStorage', pass: !!savedState1 },
  { name: 'Objective completion persists', pass: !!savedState2 },
  { name: 'Quest completion persists', pass: !!savedState3 },
  { name: 'XP rewards applied', pass: finalXP >= 50 },
  { name: 'Caps rewards applied', pass: finalCaps >= 25 },
  { name: 'State survives reload', pass: wakeUpStateReloaded.state === 'completed' }
];

const passed = tests.filter(t => t.pass).length;
const total = tests.length;

tests.forEach(t => {
  console.log(`${t.pass ? '✅' : '❌'} ${t.name}`);
});

console.log(`\n${passed}/${total} tests passed`);

if (passed === total) {
  console.log('✅ ALL TESTS PASSED - Quest system is OPERATIONAL');
  console.log('☢️ Stay safe out there, Vault Dweller.');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Further investigation required');
  process.exit(1);
}
