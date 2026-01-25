// tests/quests_store.test.js
const fetch = require('node-fetch');
const assert = require('assert');
const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

async function testPlaceholders() {
  const res = await fetch(BASE + '/api/quests-store/placeholders');
  const json = await res.json();
  assert(json.ok === true);
  assert(Array.isArray(json.placeholders));
  console.log('placeholders test passed');
}

(async () => {
  try {
    await testPlaceholders();
  } catch (e) {
    console.error('quests_store tests failed', e);
    process.exit(1);
  }
  process.exit(0);
})();
