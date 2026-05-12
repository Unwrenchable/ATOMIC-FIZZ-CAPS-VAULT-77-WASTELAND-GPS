const fetch = require('node-fetch');
const assert = require('assert');
const { redis, key } = require('../backend/lib/redis');
const BASE = process.env.BACKEND_URL || 'http://localhost:3000';

(async () => {
  try {
    // create a fake token via API helper
    const token = 'test-token-123';
    const setRes = await fetch(BASE + '/api/quests-store/admin/set-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, value: '1', ttl: 60 })
    });
    const setText = await setRes.text();
    console.log('admin set-token response:', setRes.status, setText.slice(0,200));

    // call prove endpoint
    const res = await fetch(BASE + '/api/quests-store/prove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: 'testwallet', questId: 'saitama_main_arc', proof: { type: 'token', value: token } })
    });
    const text = await res.text();
    console.log('prove response raw:', res.status, text.slice(0,200));
    const json = JSON.parse(text);
    assert(json.ok === true && json.proven === true);
    console.log('prove endpoint accepted valid token proof');

    // now call reveal, should succeed
    const r2 = await fetch(BASE + '/api/quests-store/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: 'testwallet', questId: 'saitama_main_arc' })
    });
    const j2 = await r2.json();
    assert(j2.ok === true && j2.quest && j2.quest.id === 'saitama_main_arc');
    console.log('reveal returned quest after proof');

    process.exit(0);
  } catch (e) {
    console.error('quests_prove tests failed', e);
    process.exit(1);
  }
})();
