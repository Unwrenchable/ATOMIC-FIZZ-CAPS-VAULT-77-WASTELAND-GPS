#!/usr/bin/env node
// Test the new getInventory method

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

console.error('\n📟 OVERSEER BROADCAST: Testing getInventory() Method\n');

// Test 1: Verify getInventory method exists
console.error('Test 1: Checking if getInventory() method exists...');
assert.ok(Game.modules.PlayerState.getInventory, 'getInventory method not found');
assert.strictEqual(typeof Game.modules.PlayerState.getInventory, 'function', 'getInventory is not a function');
console.error('✓ getInventory() method exists');

// Test 2: Get inventory (should be empty initially)
console.error('\nTest 2: Getting empty inventory...');
const emptyInventory = Game.modules.PlayerState.getInventory();
assert.ok(Array.isArray(emptyInventory), 'getInventory did not return an array');
assert.strictEqual(emptyInventory.length, 0, 'Initial inventory should be empty');
console.error('✓ Empty inventory returned correctly');

// Test 3: Add items and retrieve via getInventory
console.error('\nTest 3: Adding items and retrieving via getInventory()...');
Game.modules.PlayerState.addItem({ id: 'laser_rifle', name: 'Laser Rifle', type: 'weapon' }, 1);
Game.modules.PlayerState.addItem({ id: 'stimpak', name: 'Stimpak', type: 'consumable' }, 5);

const inventory = Game.modules.PlayerState.getInventory();
assert.strictEqual(inventory.length, 2, `Expected 2 items, got ${inventory.length}`);
assert.ok(inventory.some(i => i.id === 'laser_rifle'), 'Laser rifle not in inventory');
assert.ok(inventory.some(i => i.id === 'stimpak'), 'Stimpak not in inventory');
console.error('✓ Items retrieved correctly via getInventory()');

// Test 4: Verify it returns the actual state array (not a copy)
console.error('\nTest 4: Verifying getInventory returns state reference...');
const inv1 = Game.modules.PlayerState.getInventory();
const inv2 = Game.modules.PlayerState.getInventory();
// Both should reference the same internal array
assert.strictEqual(inv1, inv2, 'getInventory should return the same array reference');
console.error('✓ getInventory returns consistent reference');

// Test 5: Check that Game.player.inventory also points to same data
console.error('\nTest 5: Checking Game.player.inventory sync...');
assert.ok(Game.player.inventory, 'Game.player.inventory not set');
assert.ok(Array.isArray(Game.player.inventory), 'Game.player.inventory is not an array');
assert.strictEqual(Game.player.inventory.length, 2, 'Game.player.inventory has wrong length');
console.error('✓ Game.player.inventory synced correctly');

console.error('\n✅ ALL TESTS PASSED - getInventory() working correctly!\n');
console.error('Stay safe out there, Vault Dweller. ☢️\n');
