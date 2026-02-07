const fetch = require('node-fetch');
const assert = require('assert');
const BASE = process.env.BACKEND_URL || 'http://localhost:3000';

async function testSaitamaLore() {
  const res = await fetch(BASE + '/api/quests-store/lore/saitama');
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error('Invalid JSON response:', text.slice(0, 400));
    throw e;
  }
  assert(json.ok === true);
  assert(json.lore && json.lore.russ);
  console.log('saitama lore test passed');
}

(async () => {
  try {
    await testSaitamaLore();
  } catch (e) {
    console.error('quests_saitama tests failed', e);
    process.exit(1);
  }
  process.exit(0);
})();
