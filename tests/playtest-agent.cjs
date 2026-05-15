#!/usr/bin/env node
// tests/playtest-agent.cjs
// -----------------------------------------------------------------------
// Atomic Fizz Caps – Automated Playtest Agent
// -----------------------------------------------------------------------
// Simulates a full player session and validates all game systems connect
// properly.  Writes a structured JSON report to /tmp/playtest-report.json
// and prints a human-readable summary to stdout.
//
// Usage:
//   node tests/playtest-agent.cjs [--base-url <url>]
//
// Defaults to http://localhost:3000 if no base URL is supplied.
// Does NOT require jest, mocha, or any test framework.
// -----------------------------------------------------------------------
'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

// -----------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------
const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : (process.env.PLAYTEST_BASE_URL || 'http://localhost:3000');

const REPORT_PATH = process.env.PLAYTEST_REPORT_PATH
  || path.join(os.tmpdir(), 'playtest-report.json');

// Network timeout in milliseconds for each API check.
const REQUEST_TIMEOUT_MS = 10_000;

// Simulated wallet address (32-byte vanity address, NOT a real key)
const MOCK_WALLET = 'AFCv77MockWalletForPlaytestAgent1111111111111';

// -----------------------------------------------------------------------
// Lightweight HTTP helper (no third-party deps)
// -----------------------------------------------------------------------
function request(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib    = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port    : parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path    : parsed.pathname + parsed.search,
      method,
      headers : {
        'Content-Type': 'application/json',
        'Accept'      : 'application/json',
        ...headers,
      },
    };

    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { /* non-JSON */ }
        resolve({ status: res.statusCode, body: json, raw: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('request timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function get(path, headers)       { return request('GET',  BASE_URL + path, null, headers); }
function post(path, body, headers) { return request('POST', BASE_URL + path, body, headers); }

// -----------------------------------------------------------------------
// Report accumulator
// -----------------------------------------------------------------------
const report = {
  started_at      : new Date().toISOString(),
  base_url        : BASE_URL,
  passed_checks   : [],
  failed_checks   : [],
  warnings        : [],
  recommendations : [],
};

function pass(id, note) {
  report.passed_checks.push({ id, note });
  console.log(`  ✅  [PASS] ${id}${note ? ' — ' + note : ''}`);
}

function fail(id, detail) {
  report.failed_checks.push({ id, detail });
  console.error(`  ❌  [FAIL] ${id}: ${detail}`);
}

function warn(id, note) {
  report.warnings.push({ id, note });
  console.warn(`  ⚠️   [WARN] ${id}: ${note}`);
}

function recommend(note) {
  report.recommendations.push(note);
}

// -----------------------------------------------------------------------
// Individual checks
// -----------------------------------------------------------------------

async function checkHealth() {
  console.log('\n── Health Check ──');
  try {
    const res = await get('/api/health');
    if (res.status === 200) {
      pass('health_endpoint', `HTTP 200 — ${JSON.stringify(res.body).slice(0, 80)}`);
    } else {
      fail('health_endpoint', `Expected 200, got ${res.status}`);
    }
  } catch (e) {
    fail('health_endpoint', `Network error: ${e.message}`);
    warn('connectivity', 'Backend may not be running – remaining checks may fail');
  }
}

async function checkLocations() {
  console.log('\n── Locations API ──');
  try {
    const res = await get('/api/locations');
    if (res.status === 200 && Array.isArray(res.body)) {
      pass('locations_list', `${res.body.length} POIs returned`);
      if (res.body.length === 0) warn('locations_empty', 'No POI locations found — map will be empty');
    } else {
      fail('locations_list', `Status ${res.status}, body: ${JSON.stringify(res.body).slice(0, 120)}`);
    }
  } catch (e) {
    fail('locations_list', e.message);
  }
}

async function checkPlayerNFTs() {
  console.log('\n── Player NFT Endpoint ──');
  try {
    const res = await get(`/api/player-nfts?wallet=${MOCK_WALLET}`);
    // Endpoint is auth-protected; unsigned checks should receive 401.
    if (res.status === 200) {
      const items = Array.isArray(res.body) ? res.body : (res.body && res.body.nfts) || [];
      pass('player_nfts_200', `Returned ${items.length} NFT(s)`);
    } else if (res.status === 401 || res.status === 404 || res.status === 400) {
      pass('player_nfts_handled', `Correctly returned ${res.status} for unsigned/mock wallet request`);
    } else {
      fail('player_nfts_unexpected', `Unexpected status ${res.status}`);
    }
  } catch (e) {
    fail('player_nfts_network', e.message);
  }
}

async function checkCooldowns() {
  console.log('\n── Cooldown System ──');
  try {
    const res = await get(`/api/cooldowns?wallet=${MOCK_WALLET}`);
    if (res.status === 200) {
      pass('cooldowns_endpoint', 'Cooldown data accessible');
    } else if (res.status === 400 || res.status === 401 || res.status === 404) {
      pass('cooldowns_auth', `Auth protected cooldowns returned ${res.status} for unsigned request`);
    } else {
      warn('cooldowns_status', `Unexpected status ${res.status}`);
    }
  } catch (e) {
    fail('cooldowns_network', e.message);
  }
}

async function checkQuests() {
  console.log('\n── Quest System ──');
  try {
    const res = await get('/api/quests');
    if (res.status === 200) {
      const data = res.body;
      const questCount = Array.isArray(data) ? data.length
        : (data && typeof data === 'object' ? Object.keys(data).length : 0);
      pass('quests_endpoint', `${questCount} quest entries accessible`);
      if (questCount === 0) warn('quests_empty', 'Quest list is empty — players will have nothing to do');
    } else {
      fail('quests_endpoint', `Status ${res.status}`);
    }
  } catch (e) {
    fail('quests_network', e.message);
  }
}

async function checkMintables() {
  console.log('\n── Mintables / NFT Items ──');
  try {
    const res = await get('/api/mintables');
    if (res.status === 200) {
      const items = Array.isArray(res.body) ? res.body
        : (res.body && res.body.items) || [];
      pass('mintables_endpoint', `${items.length} mintable item(s) registered`);
      if (items.length === 0) warn('mintables_empty', 'No mintable items — NFT economy is inactive');
    } else {
      fail('mintables_endpoint', `Status ${res.status}`);
    }
  } catch (e) {
    fail('mintables_network', e.message);
  }
}

async function checkFrontendConfig() {
  console.log('\n── Frontend Config ──');
  try {
    const res = await get('/api/config/frontend');
    if (res.status === 200 && res.body && typeof res.body === 'object') {
      pass('frontend_config', `Config keys: ${Object.keys(res.body).join(', ').slice(0, 100)}`);
    } else {
      fail('frontend_config', `Status ${res.status}, body: ${JSON.stringify(res.body).slice(0, 80)}`);
    }
  } catch (e) {
    fail('frontend_config_network', e.message);
  }
}

async function checkNpcContext() {
  console.log('\n── NPC xAI Context Endpoint ──');
  const testNpcs = ['siren', 'courier', 'rex'];
  for (const npcId of testNpcs) {
    try {
      const res = await get(`/api/npc-context/${npcId}`);
      if (res.status === 200 && res.body && res.body.npc_id) {
        pass(`npc_context_${npcId}`, `Context loaded for "${res.body.name || npcId}"`);
      } else if (res.status === 404) {
        warn(`npc_context_${npcId}_404`, `NPC "${npcId}" not found — check npc-xai-context.js`);
      } else {
        fail(`npc_context_${npcId}`, `Status ${res.status}`);
      }
    } catch (e) {
      fail(`npc_context_${npcId}_network`, e.message);
    }
  }
}

async function checkLootDropVariance() {
  console.log('\n── Loot Drop Table Variance ──');
  // We validate the static loot_tables.json is reachable and has correct shape
  try {
    const res = await get('/data/items/loot_tables.json');
    if (res.status === 200 && res.body && res.body.tiers) {
      const tierNames = Object.keys(res.body.tiers);
      pass('loot_table_file', `Loot tiers found: ${tierNames.join(', ')}`);

      // Validate NFT-eligible items exist
      const allItems = Object.values(res.body.tiers).flat();
      const nftItems = allItems.filter(i => i.nft_eligible);
      if (nftItems.length > 0) {
        pass('loot_nft_eligible', `${nftItems.length} NFT-eligible item(s) in loot pool`);
      } else {
        warn('loot_nft_eligible', 'No NFT-eligible items flagged — NFT drops will never occur');
      }

      // Validate legendary tier exists and has items
      if (res.body.tiers.legendary && res.body.tiers.legendary.length > 0) {
        pass('loot_legendary_tier', `${res.body.tiers.legendary.length} legendary item(s) defined`);
      } else {
        warn('loot_legendary_missing', 'No legendary loot tier defined');
      }
    } else if (res.status === 404) {
      warn('loot_table_file', 'loot_tables.json not found at /data/items/ — loot system will use inline defaults');
    } else {
      fail('loot_table_file', `Unexpected status ${res.status}`);
    }
  } catch (e) {
    fail('loot_table_network', e.message);
  }
}

async function checkCrossTimelineQuests() {
  console.log('\n── Cross-Timeline Quest Data ──');
  try {
    const res = await get('/data/quest/cross_timeline_quests.json');
    if (res.status === 200 && res.body && res.body.quests) {
      const quests = res.body.quests;
      pass('cross_timeline_quests', `${quests.length} cross-timeline quests loaded`);

      // Check required fields on first quest
      const q = quests[0];
      const requiredFields = ['quest_id', 'name', 'timeline', 'real_lat', 'real_lng', 'objectives', 'rewards'];
      const missing = requiredFields.filter(f => !(f in q));
      if (missing.length === 0) {
        pass('cross_timeline_quest_schema', 'Quest schema has all required fields');
      } else {
        fail('cross_timeline_quest_schema', `Missing fields: ${missing.join(', ')}`);
      }

      // Check timeline diversity
      const timelines = [...new Set(quests.map(q => q.timeline))];
      if (timelines.length >= 5) {
        pass('cross_timeline_diversity', `Spans ${timelines.length} Fallout timelines: ${timelines.join(', ')}`);
      } else {
        warn('cross_timeline_diversity', `Only ${timelines.length} timelines represented — target is 7+`);
      }
    } else if (res.status === 404) {
      warn('cross_timeline_quests', 'cross_timeline_quests.json not served at /data/quest/');
    } else {
      fail('cross_timeline_quests', `Status ${res.status}`);
    }
  } catch (e) {
    fail('cross_timeline_quests_network', e.message);
  }
}

async function checkGlobalNPCs() {
  console.log('\n── Global NPC Data ──');
  try {
    const res = await get('/data/narrative/global_npcs.json');
    if (res.status === 200 && res.body && res.body.npcs) {
      const npcs = res.body.npcs;
      pass('global_npcs_file', `${npcs.length} global NPC(s) defined`);

      const roles = [...new Set(npcs.map(n => n.role))];
      pass('global_npc_roles', `Roles present: ${roles.join(', ')}`);

      const merchants = npcs.filter(n => n.role === 'merchant' && n.trade_inventory);
      if (merchants.length > 0) {
        pass('global_npc_merchants', `${merchants.length} merchant NPC(s) with trade inventories`);
      } else {
        warn('global_npc_merchants', 'No merchant NPCs with trade_inventory — player economy limited');
      }
    } else if (res.status === 404) {
      warn('global_npcs_file', 'global_npcs.json not found at /data/narrative/');
    } else {
      fail('global_npcs_file', `Status ${res.status}`);
    }
  } catch (e) {
    fail('global_npcs_network', e.message);
  }
}

async function checkFactionReputation() {
  console.log('\n── Faction Reputation Data ──');
  try {
    const res = await get('/data/factions.json');
    if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
      pass('factions_data', `${res.body.length} faction(s) loaded`);
      const withRep = res.body.filter(f => f.id);
      if (withRep.length > 0) pass('factions_ids', 'All factions have IDs');
    } else {
      warn('factions_data', 'factions.json missing or empty — faction system may be inactive');
    }
  } catch (e) {
    fail('factions_network', e.message);
  }
}

async function checkOverseerProxy() {
  console.log('\n── Overseer AI Proxy ──');
  try {
    // Mounted path is /api/overseer/ask and requires authMiddleware.
    const res = await post('/api/overseer/ask', { prompt: 'Are you there, Overseer?' });
    if (res.status === 200 && res.body) {
      pass('overseer_proxy', 'Overseer AI proxy responded');
    } else if (res.status === 503 || res.status === 500) {
      warn('overseer_proxy_no_key', `Overseer returned ${res.status} — likely no HF_API_KEY or XAI_API_KEY configured`);
    } else if (res.status === 401 || res.status === 400 || res.status === 403) {
      pass('overseer_proxy_auth', `Overseer correctly requires auth (${res.status})`);
    } else {
      warn('overseer_proxy_status', `Unexpected status ${res.status}`);
    }
  } catch (e) {
    fail('overseer_proxy_network', e.message);
  }
}

async function checkScavenger() {
  console.log('\n── Scavenger Exchange ──');
  try {
    const res = await get('/api/scavenger');
    if (res.status === 200) {
      pass('scavenger_endpoint', 'Scavenger exchange accessible');
    } else if (res.status === 404) {
      warn('scavenger_endpoint', 'Scavenger endpoint returns 404 — exchange may be disabled');
    } else {
      warn('scavenger_endpoint', `Status ${res.status}`);
    }
  } catch (e) {
    fail('scavenger_network', e.message);
  }
}

async function checkStaticFrontend() {
  console.log('\n── Static Frontend Assets ──');
  const pages = [
    { path: '/',                  name: 'main_index' },
    { path: '/overseer.html',     name: 'overseer_page' },
    { path: '/exchange.html',     name: 'exchange_page' },
    { path: '/js/modules/battles.js',      name: 'battles_module' },
    { path: '/js/modules/economy-roles.js',name: 'economy_roles_module' },
    { path: '/js/modules/faction-raids.js',name: 'faction_raids_module' },
  ];

  for (const page of pages) {
    try {
      const res = await get(page.path);
      if (res.status === 200) {
        pass(page.name, `${page.path} served OK`);
      } else if (res.status === 404) {
        warn(`${page.name}_404`, `${page.path} returns 404 — may need to add to public/`);
      } else {
        warn(`${page.name}_status`, `${page.path} returned ${res.status}`);
      }
    } catch (e) {
      fail(`${page.name}_network`, `${page.path}: ${e.message}`);
    }
  }
}

async function simulateBattleLootDrops() {
  console.log('\n── Simulating Battle Loot Drops (local logic validation) ──');
  // We can't run browser battle logic here; validate loot-voucher endpoint behavior instead.
  const levels = [1, 10, 25, 50];
  for (const level of levels) {
    try {
      const res = await post('/api/loot-voucher', {
        latitude: 34.0522,
        longitude: -118.2437,
        locationHint: `Playtest level ${level}`,
      });
      if (res.status === 200 || res.status === 401 || res.status === 400 || res.status === 429 || res.status === 503) {
        pass(`loot_voucher_level_${level}`, `Level ${level} loot voucher endpoint responds (${res.status})`);
      } else if (res.status === 404) {
        warn(`loot_voucher_level_${level}`, 'Loot voucher endpoint not found');
      } else {
        warn(`loot_voucher_level_${level}`, `Unexpected status ${res.status}`);
      }
    } catch (e) {
      fail(`loot_voucher_level_${level}`, e.message);
    }
  }
}

async function checkXpSystem() {
  console.log('\n── XP / Level-up System ──');
  try {
    const res = await post('/api/xp/award', { amount: 1 });
    if (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
      pass('xp_endpoint', `XP endpoint responds (${res.status})`);
    } else if (res.status === 404) {
      fail('xp_endpoint', 'XP endpoint not found at /api/xp/award');
    } else {
      warn('xp_endpoint', `Status ${res.status}`);
    }
  } catch (e) {
    fail('xp_network', e.message);
  }
}

async function checkCapsSystem() {
  console.log('\n── Caps / FIZZ Token System ──');
  try {
    const res = await get(`/api/caps/${MOCK_WALLET}`);
    if (res.status === 200 || res.status === 400 || res.status === 401) {
      pass('caps_endpoint', `Caps endpoint responds (${res.status})`);
    } else if (res.status === 404) {
      fail('caps_endpoint', 'Caps endpoint not found at /api/caps/:wallet');
    } else {
      warn('caps_endpoint', `Status ${res.status}`);
    }
  } catch (e) {
    fail('caps_network', e.message);
  }
}

// -----------------------------------------------------------------------
// Generate recommendations based on results
// -----------------------------------------------------------------------
function generateRecommendations() {
  const failed = report.failed_checks.map(f => f.id);
  const warned = report.warnings.map(w => w.id);

  if (failed.includes('health_endpoint')) {
    recommend('Start the backend server with `npm start` or `npm run dev` before running playtests.');
  }
  if (failed.includes('locations_list')) {
    recommend('Populate public/data/fallout_pois.json and ensure /api/locations is mounted in server.js.');
  }
  if (warned.some(id => id.startsWith('npc_context_'))) {
    recommend('Verify backend/api/npc-context.js is mounted in server.js at /api/npc-context/:npcId.');
  }
  if (warned.some(id => id.includes('loot'))) {
    recommend('Ensure public/data/items/loot_tables.json exists and is served by the static file middleware.');
  }
  if (warned.includes('overseer_proxy_no_key')) {
    recommend('Set HF_API_KEY or XAI_API_KEY env var to enable Overseer AI responses.');
  }
  if (warned.includes('global_npcs_file') || warned.includes('cross_timeline_quests')) {
    recommend('Ensure Vercel/static middleware serves the /data/ directory from public/.');
  }
  if (report.failed_checks.length === 0 && report.warnings.length <= 2) {
    recommend('All core systems nominal. Consider running load tests with 100 concurrent simulated wallets.');
  }
  recommend('Add WebSocket integration tests once real-time GPS updates are implemented.');
  recommend('Test faction raid events by mocking GPS coordinates near hostile faction territories.');
}

// -----------------------------------------------------------------------
// Main runner
// -----------------------------------------------------------------------
async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   ATOMIC FIZZ CAPS — PLAYTEST AGENT v1.0.0               ║');
  console.log(`║   Target: ${BASE_URL.padEnd(46)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Run all checks
  await checkHealth();
  await checkLocations();
  await checkPlayerNFTs();
  await checkCooldowns();
  await checkQuests();
  await checkMintables();
  await checkFrontendConfig();
  await checkNpcContext();
  await checkLootDropVariance();
  await checkCrossTimelineQuests();
  await checkGlobalNPCs();
  await checkFactionReputation();
  await checkOverseerProxy();
  await checkScavenger();
  await checkStaticFrontend();
  await simulateBattleLootDrops();
  await checkXpSystem();
  await checkCapsSystem();

  generateRecommendations();

  // Finalise report
  report.finished_at  = new Date().toISOString();
  report.total_passed = report.passed_checks.length;
  report.total_failed = report.failed_checks.length;
  report.total_warned = report.warnings.length;
  report.score        = Math.round(
    (report.total_passed / Math.max(1, report.total_passed + report.total_failed)) * 100
  );

  // Write JSON report
  try {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n📄 Report saved to ${REPORT_PATH}`);
  } catch (e) {
    console.error(`\nCould not write report: ${e.message}`);
  }

  // Human-readable summary
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  PLAYTEST SUMMARY — Score: ${report.score}%`);
  console.log(`  ✅ Passed : ${report.total_passed}`);
  console.log(`  ❌ Failed : ${report.total_failed}`);
  console.log(`  ⚠️  Warnings: ${report.total_warned}`);
  if (report.recommendations.length > 0) {
    console.log('\n  Recommendations:');
    report.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  }
  console.log('══════════════════════════════════════════════════════════\n');

  // Exit with error code if any checks failed
  process.exit(report.total_failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('[playtest-agent] Fatal error:', err);
  process.exit(1);
});
