// scripts/test_mint_claim.js
// Simple Node script to exercise the /api/mint-item dev and prod flows

const fetch = require('node-fetch');

async function testDevClaim() {
  const url = process.env.BACKEND_URL || 'http://localhost:3000';
  const res = await fetch(url + '/api/mint-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: 'testdevwallet' })
  });
  const json = await res.json();
  console.log('DEV CLAIM RESPONSE:', json);
}

async function testProdClaim() {
  const url = process.env.BACKEND_URL || 'http://localhost:3000';
  const adminSecret = process.env.ADMIN_MINT_SECRET || 'changeme';
  const res = await fetch(url + '/api/mint-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ADMIN-MINT': adminSecret },
    body: JSON.stringify({ wallet: 'prodwallet' })
  });
  const json = await res.json();
  console.log('PROD CLAIM RESPONSE:', json);
}

(async () => {
  console.log('Testing dev claim...');
  await testDevClaim();
  console.log('\nTesting prod claim (with ADMIN_MINT_SECRET env)...');
  await testProdClaim();
})();
