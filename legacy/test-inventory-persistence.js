#!/usr/bin/env node
// Test inventory persistence across reload/zone changes

const assert = require('assert');

// Mock browser environment
global.window = {
  localStorage: new Map(),
  dispatchEvent: () => {},
  addEventListener: () => {}
};

global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  hidden: false
};

global.localStorage = {
  getItem: (key) => global.window.localStorage.get(key) || null,
  setItem: (key, val) => global.window.localStorage.set(key, val),
  removeItem: (key) => global.window.localStorage.delete(key)
};

global.console.log = (...args) => {
  if (process.env.DEBUG) console.error(...args);
};

// Load the modules
global.Game = { player: {}, modules: {} };
require('./public/js/game/player-state.js');
require('./public/js/game/inventory-actions.js');

console.error('\n📟 OVERSEER BROADCAST: Testing Inventory Persistence System\n');

// Test 1: Add item and verify it's in inventory
console.error('Test 1: Adding item to inventory...');
const testItem = {
  id: 'test_weapon',
  name: 'Test Laser Rifle',
  type: 'weapon',
  damage: 50
};

const result = Game.giveItem(testItem, 1);
assert.ok(result, 'Failed to add item');

const state = Game.modules.PlayerState.getState();
assert.ok(state.inventory.length > 0, 'Inventory is empty after adding item');
assert.ok(state.inventory.some(i => i.id === 'test_weapon'), 'Test item not found in inventory');
console.error('✓ Item added successfully');

// Test 2: Verify localStorage persistence
console.error('\nTest 2: Checking localStorage persistence...');
const savedData = localStorage.getItem('afc_unified_player_state_v2');
assert.ok(savedData, 'No data saved to localStorage');

const parsed = JSON.parse(savedData);
assert.ok(Array.isArray(parsed.inventory), 'Inventory not an array in saved data');
assert.ok(parsed.inventory.length > 0, 'Inventory empty in saved data');
assert.ok(parsed.inventory.some(i => i.id === 'test_weapon'), 'Test item not in saved data');
console.error('✓ Data persisted to localStorage');

// Test 3: Simulate reload
console.error('\nTest 3: Simulating page reload...');
// Reset state
global.Game = { player: {}, modules: {} };
delete require.cache[require.resolve('./public/js/game/player-state.js')];
delete require.cache[require.resolve('./public/js/game/inventory-actions.js')];

// Reload modules
require('./public/js/game/player-state.js');
require('./public/js/game/inventory-actions.js');

const reloadedState = Game.modules.PlayerState.getState();
assert.ok(reloadedState.inventory.length > 0, 'Inventory lost after reload');
assert.ok(reloadedState.inventory.some(i => i.id === 'test_weapon'), 'Test item lost after reload');
console.error('✓ Inventory persisted across reload');

// Test 4: Add another item (simulating zone change)
console.error('\nTest 4: Adding item after "zone change"...');
const item2 = {
  id: 'stimpak',
  name: 'Stimpak',
  type: 'consumable'
};

Game.giveItem(item2, 1);
const zoneState = Game.modules.PlayerState.getState();
assert.ok(zoneState.inventory.length === 2, `Expected 2 items, got ${zoneState.inventory.length}`);
assert.ok(zoneState.inventory.some(i => i.id === 'test_weapon'), 'Original item lost');
assert.ok(zoneState.inventory.some(i => i.id === 'stimpak'), 'New item not added');
console.error('✓ Items persist across zone changes');

// Test 5: Equip item and verify persistence
console.error('\nTest 5: Testing equipped item persistence...');
const weapon = zoneState.inventory.find(i => i.id === 'test_weapon');
Game.modules.PlayerState.equipItem(weapon);

const equippedState = Game.modules.PlayerState.getState();
assert.ok(equippedState.equipped.weapon, 'Weapon not equipped');
assert.strictEqual(equippedState.equipped.weapon.id, 'test_weapon', 'Wrong item equipped');
console.error('✓ Item equipped successfully');

// Verify equipped persists in localStorage
const savedEquipped = JSON.parse(localStorage.getItem('afc_unified_player_state_v2'));
assert.ok(savedEquipped.equipped.weapon, 'Equipped weapon not saved');
assert.strictEqual(savedEquipped.equipped.weapon.id, 'test_weapon', 'Wrong equipped weapon saved');
console.error('✓ Equipped item persisted to localStorage');

// Test 6: Simulate another reload to verify equipped items persist
console.error('\nTest 6: Verifying equipped items persist across reload...');
global.Game = { player: {}, modules: {} };
delete require.cache[require.resolve('./public/js/game/player-state.js')];
delete require.cache[require.resolve('./public/js/game/inventory-actions.js')];

require('./public/js/game/player-state.js');
require('./public/js/game/inventory-actions.js');

const reloadedEquipped = Game.modules.PlayerState.getState();
assert.ok(reloadedEquipped.equipped.weapon, 'Equipped weapon lost after reload');
assert.strictEqual(reloadedEquipped.equipped.weapon.id, 'test_weapon', 'Wrong weapon after reload');
console.error('✓ Equipped items persist across reload');

// Test 7: Test stacking
console.error('\nTest 7: Testing item stacking...');
Game.giveItem({ id: 'stimpak', name: 'Stimpak', type: 'consumable' }, 5);
const stackState = Game.modules.PlayerState.getState();
const stimpak = stackState.inventory.find(i => i.id === 'stimpak');
assert.ok(stimpak, 'Stimpak not found');
assert.strictEqual(stimpak.quantity, 6, `Expected 6 stimpaks, got ${stimpak.quantity}`);
console.error('✓ Items stack correctly');

console.error('\n✅ ALL TESTS PASSED - Inventory system working correctly!\n');
console.error('Stay safe out there, Vault Dweller. ☢️\n');
