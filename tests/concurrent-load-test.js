#!/usr/bin/env node
// tests/concurrent-load-test.js
// -----------------------------------------------------------------------
// Atomic Fizz Caps — Concurrent Player Load Test & Bug Hunter v1.0.0
// -----------------------------------------------------------------------
// Simulates up to 1,000 concurrent worldwide players across 6 archetypes,
// hammering all 31+ game API systems to surface bugs, exploits, race
// conditions, balance issues, and performance bottlenecks.
//
// Usage:
//   node tests/concurrent-load-test.js [options]
//
// Options:
//   --base-url <url>      Target base URL (default: http://localhost:3000)
//   --players <n>         Number of virtual players (default: 50; max: 1000)
//   --batch-size <n>      Concurrent batch size (default: 25)
//   --timeout <ms>        Per-request timeout in ms (default: 8000)
//   --report <path>       Output JSON report path (default: /tmp/load-test-report.json)
//
// Does NOT require jest/mocha — runs under plain Node.js 20+.
// -----------------------------------------------------------------------
'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const crypto = require('crypto');

// -----------------------------------------------------------------------
// CLI / Config
// -----------------------------------------------------------------------
function argAfter(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
}

const BASE_URL     = argAfter('--base-url', process.env.PLAYTEST_BASE_URL || 'http://localhost:3000');
const PLAYER_COUNT = Math.min(1000, Math.max(1, parseInt(argAfter('--players',    '50'),  10)));
const BATCH_SIZE   = Math.min(100,  Math.max(1, parseInt(argAfter('--batch-size', '25'),  10)));
const REQ_TIMEOUT  = parseInt(argAfter('--timeout', '8000'), 10);
const REPORT_PATH  = argAfter('--report', process.env.LOAD_REPORT_PATH
  || path.join(os.tmpdir(), 'load-test-report.json'));

// -----------------------------------------------------------------------
// Player archetype definitions
// Each archetype drives a distinct behaviour pattern exercising different
// game systems and attack surfaces.
// -----------------------------------------------------------------------
const ARCHETYPES = [
  'newbie',       // first session, low level, learns basics
  'veteran',      // high-level, full inventory, faction rep
  'exploiter',    // fuzzes for IDOR, race conditions, negative values
  'speedrunner',  // rapid sequential requests, tests cooldown enforcement
  'collector',    // focuses on NFTs, mintables, scavenging
  'raider',       // faction raids, battles, nukes, pvp
];

// -----------------------------------------------------------------------
// GPS coordinate pools — worldwide distribution
// -----------------------------------------------------------------------
const WORLD_COORDS = [
  { lat:  40.7128,  lng: -74.0060,  region: 'New York, USA'      },
  { lat:  51.5074,  lng:  -0.1278,  region: 'London, UK'         },
  { lat:  35.6762,  lng: 139.6503,  region: 'Tokyo, Japan'       },
  { lat: -33.8688,  lng: 151.2093,  region: 'Sydney, Australia'  },
  { lat:  48.8566,  lng:   2.3522,  region: 'Paris, France'      },
  { lat:  55.7558,  lng:  37.6173,  region: 'Moscow, Russia'     },
  { lat: -23.5505,  lng: -46.6333,  region: 'São Paulo, Brazil'  },
  { lat:  28.7041,  lng:  77.1025,  region: 'Delhi, India'       },
  { lat:  31.2304,  lng: 121.4737,  region: 'Shanghai, China'    },
  { lat:  -1.2921,  lng:  36.8219,  region: 'Nairobi, Kenya'     },
  { lat:  19.4326,  lng: -99.1332,  region: 'Mexico City, Mexico'},
  { lat:  37.7749,  lng:-122.4194,  region: 'San Francisco, USA' },
  { lat:  52.2297,  lng:  21.0122,  region: 'Warsaw, Poland'     },
  { lat:  1.3521,   lng: 103.8198,  region: 'Singapore'          },
  { lat:  25.2048,  lng:  55.2708,  region: 'Dubai, UAE'         },
];

// -----------------------------------------------------------------------
// Tiny HTTP client (no third-party deps)
// -----------------------------------------------------------------------
function httpRequest(method, urlStr, body, extraHeaders = {}) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch (_) {
      resolve({ status: 0, body: null, raw: '', durationMs: 0, error: 'invalid url' });
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: parsed.hostname,
      port    : parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path    : parsed.pathname + parsed.search,
      method,
      headers : {
        'Content-Type' : 'application/json',
        'Accept'       : 'application/json',
        ...extraHeaders,
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const t0 = Date.now();
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { /* non-JSON body */ }
        resolve({ status: res.statusCode, body: json, raw: data, durationMs: Date.now() - t0, error: null });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, body: null, raw: '', durationMs: Date.now() - t0, error: err.message });
    });
    req.setTimeout(REQ_TIMEOUT, () => {
      req.destroy();
      resolve({ status: 0, body: null, raw: '', durationMs: REQ_TIMEOUT, error: 'timeout' });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function get(urlPath, headers)        { return httpRequest('GET',    BASE_URL + urlPath, null, headers); }
function post(urlPath, body, headers) { return httpRequest('POST',   BASE_URL + urlPath, body, headers); }
function _del(urlPath, body, headers)  { return httpRequest('DELETE', BASE_URL + urlPath, body, headers); }

// -----------------------------------------------------------------------
// Deterministic mock wallet generator (NOT real keys)
// -----------------------------------------------------------------------
function mockWallet(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest('hex');
  return 'AFL' + hash.slice(0, 41);  // 44-char base-58-lookalike, never real
}

// -----------------------------------------------------------------------
// Bug report accumulator
// -----------------------------------------------------------------------
const bugs = [];
const perfSamples = [];
let totalRequests = 0;
let totalErrors   = 0;
let totalTimeouts = 0;

const SEVERITIES = { critical: 4, high: 3, medium: 2, low: 1 };

function recordBug({ id, title, severity, system, archetype, wallet, reproSteps, suggestedFix, evidence }) {
  const existing = bugs.find(b => b.id === id);
  if (existing) {
    existing.occurrences++;
    return;
  }
  bugs.push({ id, title, severity, system, archetype, wallet, reproSteps, suggestedFix, evidence, occurrences: 1 });
}

function recordPerf(system, durationMs) {
  perfSamples.push({ system, durationMs });
}

// -----------------------------------------------------------------------
// GAME SYSTEM TESTS — one function per system (31 systems)
// -----------------------------------------------------------------------

async function testHealth(ctx) {
  const r = await get('/api/health');
  trackRequest(r, 'health');
  if (r.error === 'timeout') {
    recordBug({
      id: 'health_timeout',
      title: 'Health endpoint timed out',
      severity: 'critical',
      system: 'health',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['GET /api/health', `Timeout after ${REQ_TIMEOUT}ms`],
      suggestedFix: 'Check Redis/database connectivity; ensure health check is non-blocking.',
      evidence: `timeout after ${REQ_TIMEOUT}ms`,
    });
  } else if (r.status !== 200 && r.status !== 0) {
    recordBug({
      id: 'health_non_200',
      title: `Health endpoint returned ${r.status}`,
      severity: 'high',
      system: 'health',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['GET /api/health', `Got HTTP ${r.status}`],
      suggestedFix: 'Ensure /api/health always returns 200 with a JSON status body.',
      evidence: r.raw.slice(0, 200),
    });
  }
  return r;
}

async function testLocations(ctx) {
  const r = await get('/api/locations');
  trackRequest(r, 'locations');
  if (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) {
    recordBug({
      id: 'locations_empty',
      title: 'Locations API returns empty array — world map has no POIs',
      severity: 'high',
      system: 'locations',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['GET /api/locations', 'Observe empty []'],
      suggestedFix: 'Seed fallout_pois.json or ensure the location generation script has been run.',
      evidence: '[]',
    });
  }
  return r;
}

async function testPlayerProfile(ctx) {
  // Test own profile
  const r = await get(`/api/player?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'player');

  // IDOR test: try to access a DIFFERENT wallet's profile using ctx's session
  if (ctx.archetype === 'exploiter') {
    const victimWallet = mockWallet('victim-' + ctx.id);
    const idorR = await get(`/api/player?wallet=${victimWallet}`, ctx.authHeader);
    trackRequest(idorR, 'player-idor');
    if (idorR.status === 200 && idorR.body && idorR.body.wallet === victimWallet) {
      recordBug({
        id: 'player_idor',
        title: 'IDOR: Unauthenticated access to another player profile',
        severity: 'critical',
        system: 'player',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [
          `GET /api/player?wallet=${victimWallet}`,
          'Use session token from a different wallet',
          'Observe: victim profile data returned',
        ],
        suggestedFix: 'Verify that authMiddleware enforces req.player.wallet === queried wallet. Never trust wallet from query string.',
        evidence: JSON.stringify(idorR.body).slice(0, 200),
      });
    }
  }
  return r;
}

async function testCaps(ctx) {
  const r = await get(`/api/caps?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'caps');

  if (ctx.archetype === 'exploiter') {
    // Try negative cap drain
    const negR = await post('/api/caps', { wallet: ctx.wallet, amount: -999999, action: 'drain' }, ctx.authHeader);
    trackRequest(negR, 'caps-exploit');
    if (negR.status === 200 && negR.body && negR.body.ok) {
      recordBug({
        id: 'caps_negative_amount',
        title: 'Caps endpoint accepts negative amounts — potential infinite token exploit',
        severity: 'critical',
        system: 'caps',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [
          'POST /api/caps with { amount: -999999 }',
          'Observe: 200 OK with ok:true',
        ],
        suggestedFix: 'Validate amount > 0 server-side before processing any caps transaction.',
        evidence: JSON.stringify(negR.body).slice(0, 200),
      });
    }
  }
  return r;
}

async function testCooldowns(ctx) {
  const r = await get(`/api/cooldowns?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'cooldowns');

  if (ctx.archetype === 'speedrunner') {
    // Rapid-fire to detect missing cooldown enforcement
    const promises = Array.from({ length: 5 }, () =>
      post('/api/location-claim', {
        wallet: ctx.wallet,
        locationId: 'loc_' + crypto.randomInt(0, 10),
        lat: ctx.coord.lat,
        lng: ctx.coord.lng,
      }, ctx.authHeader)
    );
    const results = await Promise.all(promises);
    trackRequests(results, 'location-claim-rapid');
    const successCount = results.filter(r2 => r2.status === 200 && r2.body && r2.body.ok).length;
    if (successCount > 1) {
      recordBug({
        id: 'cooldown_race_location_claim',
        title: 'Race condition: Multiple simultaneous location claims succeed (cooldown not atomic)',
        severity: 'high',
        system: 'cooldowns',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [
          'Fire 5 concurrent POST /api/location-claim with same wallet',
          `Observe: ${successCount} of 5 returned 200 OK`,
        ],
        suggestedFix: 'Use a Redis SET NX (atomic check-and-set) or Lua script to enforce cooldown atomically, preventing race conditions.',
        evidence: `${successCount}/5 concurrent claims accepted`,
      });
    }
  }
  return r;
}

async function testQuests(ctx) {
  const r = await get('/api/quests');
  trackRequest(r, 'quests');
  if (r.status === 200) {
    const count = Array.isArray(r.body) ? r.body.length
      : (r.body && typeof r.body === 'object' ? Object.keys(r.body).length : 0);
    if (count === 0) {
      recordBug({
        id: 'quests_empty',
        title: 'Quest database is empty — players have no objectives',
        severity: 'medium',
        system: 'quests',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: ['GET /api/quests', 'Observe empty response'],
        suggestedFix: 'Populate quests.json or ensure Redis-backed quest data is seeded on startup.',
        evidence: '{}',
      });
    }
  }
  return r;
}

async function testMintables(_ctx) {
  const r = await get('/api/mintables');
  trackRequest(r, 'mintables');
  return r;
}

async function testLocationClaim(ctx) {
  if (ctx.archetype === 'exploiter') {
    // Try claiming with someone else's wallet
    const victimWallet = mockWallet('victim2-' + ctx.id);
    const r = await post('/api/location-claim', {
      wallet: victimWallet,
      locationId: 'test_loc_001',
      lat: ctx.coord.lat,
      lng: ctx.coord.lng,
    }, ctx.authHeader);  // ctx.authHeader is for ctx.wallet, not victimWallet
    trackRequest(r, 'location-claim-idor');
    if (r.status === 200 && r.body && r.body.ok) {
      recordBug({
        id: 'location_claim_wallet_idor',
        title: 'IDOR: Location claim allows wallet spoofing via request body',
        severity: 'critical',
        system: 'location-claim',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [
          'POST /api/location-claim with a different wallet in body than the authenticated wallet',
          'Observe: claim succeeds for the spoofed wallet',
        ],
        suggestedFix: 'Always use req.player.wallet from auth middleware; never trust wallet from req.body.',
        evidence: JSON.stringify(r.body).slice(0, 200),
      });
    }
  }
  return null;
}

async function testFactions(ctx) {
  const r = await get('/data/factions.json');
  trackRequest(r, 'factions');
  if (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) {
    recordBug({
      id: 'factions_empty',
      title: 'Factions data is empty — faction system inactive',
      severity: 'medium',
      system: 'factions',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['GET /data/factions.json', 'Observe []'],
      suggestedFix: 'Ensure factions.json is populated with valid faction definitions.',
      evidence: '[]',
    });
  }
  return r;
}

async function testFactionRaids(ctx) {
  if (ctx.archetype !== 'raider') return null;
  const r = await post('/api/faction-raids', {
    wallet: ctx.wallet,
    factionId: 'raiders',
    targetLat: ctx.coord.lat,
    targetLng: ctx.coord.lng,
  }, ctx.authHeader);
  trackRequest(r, 'faction-raids');
  return r;
}

async function testBattles(ctx) {
  if (ctx.archetype === 'raider' || ctx.archetype === 'veteran') {
    const r = await get('/js/modules/battles.js');
    trackRequest(r, 'battles');
    if (r.status === 404) {
      recordBug({
        id: 'battles_module_missing',
        title: 'battles.js module not served — battle system unavailable',
        severity: 'high',
        system: 'battles',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: ['GET /js/modules/battles.js', 'Observe 404'],
        suggestedFix: 'Ensure public/js/modules/battles.js exists and static middleware is serving public/.',
        evidence: '404 Not Found',
      });
    }
    return r;
  }
  return null;
}

async function testDungeon(ctx) {
  if (ctx.archetype !== 'veteran' && ctx.archetype !== 'raider') return null;
  const r = await get('/api/dungeon');
  trackRequest(r, 'dungeon');
  return r;
}

async function testCompanions(ctx) {
  const r = await get(`/api/companions?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'companions');
  return r;
}

async function testMutations(ctx) {
  const r = await get(`/api/mutations?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'mutations');
  return r;
}

async function testCrafting(ctx) {
  if (ctx.archetype !== 'veteran' && ctx.archetype !== 'collector') return null;
  // Try crafting with an invalid (0-quantity) recipe — balance guard
  const r = await post('/api/fuse', {
    wallet: ctx.wallet,
    itemIds: [],
  }, ctx.authHeader);
  trackRequest(r, 'fuse');
  if (r.status === 200 && r.body && r.body.ok) {
    recordBug({
      id: 'fuse_empty_recipe',
      title: 'Crafting (fuse) endpoint accepts empty itemIds array',
      severity: 'medium',
      system: 'crafting',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['POST /api/fuse with { itemIds: [] }', 'Observe 200 OK'],
      suggestedFix: 'Validate itemIds is a non-empty array with a minimum length check.',
      evidence: JSON.stringify(r.body).slice(0, 200),
    });
  }
  return r;
}

async function testScavenger(ctx) {
  if (ctx.archetype !== 'collector') return null;
  const r = await get('/api/scavenger');
  trackRequest(r, 'scavenger');
  return r;
}

async function testMintItem(ctx) {
  if (ctx.archetype !== 'exploiter') return null;
  // Attempt to mint with a non-existent itemId to test input validation
  const r = await post('/api/mint-item', {
    wallet: ctx.wallet,
    itemId: '../../../../etc/passwd',  // path traversal probe
  }, ctx.authHeader);
  trackRequest(r, 'mint-item');
  if (r.status === 200 && r.body && r.body.ok) {
    recordBug({
      id: 'mint_item_path_traversal',
      title: 'mint-item endpoint does not sanitize itemId (path traversal probe accepted)',
      severity: 'critical',
      system: 'mint-item',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [
        'POST /api/mint-item with itemId: "../../../../etc/passwd"',
        'Observe: 200 OK returned',
      ],
      suggestedFix: 'Whitelist itemId against known item IDs. Reject any value not found in the items catalog.',
      evidence: JSON.stringify(r.body).slice(0, 200),
    });
  }
  return r;
}

async function testScrapNft(ctx) {
  if (ctx.archetype !== 'exploiter') return null;
  // Try scrapping with an empty/null mintAddress
  const r = await post('/api/scrap-nft', {
    wallet: ctx.wallet,
    mintAddress: null,
  }, ctx.authHeader);
  trackRequest(r, 'scrap-nft');
  if (r.status === 200 && r.body && r.body.ok) {
    recordBug({
      id: 'scrap_nft_null_mint',
      title: 'scrap-nft accepts null mintAddress — potential logic error',
      severity: 'high',
      system: 'scrap-nft',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['POST /api/scrap-nft with { mintAddress: null }', 'Observe 200 OK'],
      suggestedFix: 'Validate mintAddress is a non-empty string matching a valid Solana pubkey format.',
      evidence: JSON.stringify(r.body).slice(0, 200),
    });
  }
  return r;
}

async function testXp(ctx) {
  const r = await get(`/api/xp?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'xp');

  if (ctx.archetype === 'exploiter') {
    // Try XP injection with a huge value
    const injectR = await post('/api/xp', {
      wallet: ctx.wallet,
      xp: 999999999,
      source: 'debug',
    }, ctx.authHeader);
    trackRequest(injectR, 'xp-inject');
    if (injectR.status === 200 && injectR.body && injectR.body.ok) {
      recordBug({
        id: 'xp_injection',
        title: 'XP endpoint accepts arbitrary XP injection — progression exploit',
        severity: 'critical',
        system: 'xp',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [
          'POST /api/xp with { xp: 999999999, source: "debug" }',
          'Observe: 200 OK; player instantly max-level',
        ],
        suggestedFix: 'Restrict XP grants to internal server logic only; require signed source tokens or remove the POST endpoint entirely.',
        evidence: JSON.stringify(injectR.body).slice(0, 200),
      });
    }
  }
  return r;
}

async function testGps(ctx) {
  const r = await post('/api/gps', {
    wallet: ctx.wallet,
    lat: ctx.coord.lat,
    lng: ctx.coord.lng,
  }, ctx.authHeader);
  trackRequest(r, 'gps');

  if (ctx.archetype === 'exploiter') {
    // GPS spoofing: teleport to a known high-value POI
    const spoofR = await post('/api/gps', {
      wallet: ctx.wallet,
      lat: 0.0,
      lng: 0.0,
    }, ctx.authHeader);
    trackRequest(spoofR, 'gps-spoof');
    // Can't easily detect exploit here — record as a test note
  }
  return r;
}

async function testGeofence(ctx) {
  const r = await post('/api/geofence', {
    wallet: ctx.wallet,
    lat: ctx.coord.lat,
    lng: ctx.coord.lng,
  }, ctx.authHeader);
  trackRequest(r, 'geofence');
  return r;
}

async function testNpcContext(ctx) {
  const npcs = ['siren', 'courier', 'rex', 'dolores', 'arnie'];
  const npc = npcs[ctx.id % npcs.length];
  const r = await get(`/api/npc-context/${npc}`);
  trackRequest(r, 'npc-context');
  if (r.status === 404) {
    recordBug({
      id: `npc_context_missing_${npc}`,
      title: `NPC context not found for "${npc}" — dialog will be broken`,
      severity: 'medium',
      system: 'npc-context',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [`GET /api/npc-context/${npc}`, 'Observe 404'],
      suggestedFix: `Ensure npc-context.js includes an entry for "${npc}" or verify npc_video_lore_overrides.json contains it.`,
      evidence: '404',
    });
  }
  return r;
}

async function testOverseerProxy(ctx) {
  if (ctx.id % 10 !== 0) return null;  // only 10% of players hit this to avoid spam
  const r = await post('/api/overseer', {
    message: `Player ${ctx.id} asking the Overseer for guidance`,
    wallet: ctx.wallet,
  });
  trackRequest(r, 'overseer');
  return r;
}

async function testPlayerNFTs(ctx) {
  const r = await get(`/api/player-nfts?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'player-nfts');
  return r;
}

async function testCamp(ctx) {
  const r = await get(`/api/camp?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'camp');
  return r;
}

async function testNukes(ctx) {
  if (ctx.archetype !== 'raider') return null;
  // Attempt nuke launch with invalid coords — balance / exploit test
  const r = await post('/api/nukes', {
    wallet: ctx.wallet,
    lat: ctx.coord.lat,
    lng: ctx.coord.lng,
    code: '00000000',  // weak launch code
  }, ctx.authHeader);
  trackRequest(r, 'nukes');
  if (r.status === 200 && r.body && r.body.ok) {
    recordBug({
      id: 'nuke_weak_code_accepted',
      title: 'Nuke launch accepted a trivial launch code (00000000)',
      severity: 'high',
      system: 'nukes',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [
        'POST /api/nukes with { code: "00000000" }',
        'Observe: nuke launch succeeds',
      ],
      suggestedFix: 'Enforce secure launch codes: require a cryptographically random code obtained from a specific quest chain.',
      evidence: JSON.stringify(r.body).slice(0, 200),
    });
  }
  return r;
}

async function testLootVoucher(ctx) {
  const level = ctx.archetype === 'veteran' ? 50 : ctx.archetype === 'newbie' ? 1 : 10;
  const r = await get(`/api/loot-voucher?wallet=${ctx.wallet}&level=${level}`, ctx.authHeader);
  trackRequest(r, 'loot-voucher');

  if (ctx.archetype === 'exploiter') {
    // Try extremely high level to test loot scaling bounds
    const r2 = await get(`/api/loot-voucher?wallet=${ctx.wallet}&level=99999`, ctx.authHeader);
    trackRequest(r2, 'loot-voucher-overflow');
    if (r2.status === 200 && r2.body && r2.body.ok) {
      recordBug({
        id: 'loot_voucher_level_overflow',
        title: 'Loot voucher accepts absurdly high level — loot table may overflow',
        severity: 'medium',
        system: 'loot-voucher',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [
          'GET /api/loot-voucher?level=99999',
          'Observe: voucher issued for impossible level',
        ],
        suggestedFix: 'Clamp level to max(1, min(playerLevel, MAX_LEVEL)) server-side.',
        evidence: JSON.stringify(r2.body).slice(0, 200),
      });
    }
  }
  return r;
}

async function testRedeemVoucher(ctx) {
  if (ctx.archetype !== 'exploiter') return null;
  // Attempt replay attack: reuse a fake voucher token
  const r = await post('/api/redeem-voucher', {
    wallet: ctx.wallet,
    voucherToken: 'REPLAYED_TOKEN_12345',
  }, ctx.authHeader);
  trackRequest(r, 'redeem-voucher');
  if (r.status === 200 && r.body && r.body.ok) {
    recordBug({
      id: 'voucher_replay_attack',
      title: 'Voucher redemption accepted a clearly fake/replayed token',
      severity: 'critical',
      system: 'redeem-voucher',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [
        'POST /api/redeem-voucher with { voucherToken: "REPLAYED_TOKEN_12345" }',
        'Observe: redemption succeeds',
      ],
      suggestedFix: 'Verify voucher tokens using HMAC or store one-time-use tokens in Redis with DEL-on-use semantics.',
      evidence: JSON.stringify(r.body).slice(0, 200),
    });
  }
  return r;
}

async function testQuestEndings(ctx) {
  if (ctx.archetype !== 'veteran' && ctx.archetype !== 'speedrunner') return null;
  const r = await get(`/api/quest-endings?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'quest-endings');
  return r;
}

async function testSettings(ctx) {
  const r = await get(`/api/settings?wallet=${ctx.wallet}`, ctx.authHeader);
  trackRequest(r, 'settings');
  return r;
}

async function testRotation(_ctx) {
  const r = await get('/api/rotation');
  trackRequest(r, 'rotation');
  return r;
}

async function testFrontendConfig(ctx) {
  const r = await get('/api/config/frontend');
  trackRequest(r, 'frontend-config');
  if (r.status !== 0 && (r.status !== 200 || !r.body)) {
    recordBug({
      id: 'frontend_config_missing',
      title: 'Frontend config endpoint not returning valid JSON',
      severity: 'medium',
      system: 'frontend-config',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: ['GET /api/config/frontend', `Got HTTP ${r.status}`],
      suggestedFix: 'Ensure /api/config/frontend is mounted in server.js and returns a valid JSON object.',
      evidence: r.raw.slice(0, 200),
    });
  }
  return r;
}

async function testStaticAssets(ctx) {
  if (ctx.id % 20 !== 0) return null;  // 5% of players check statics
  const assets = [
    '/js/modules/quests.js',
    '/js/modules/economy.js',
    '/js/modules/factions.js',
    '/js/modules/vats.js',
    '/js/modules/dungeon.js',
    '/data/items/items_common.json',
    '/data/factions/factions_expanded.json',
  ];
  const toCheck = assets[ctx.id % assets.length];
  const r = await get(toCheck);
  trackRequest(r, 'static-assets');
  if (r.status === 404) {
    recordBug({
      id: `static_asset_404_${toCheck.replace(/\//g, '_').replace(/\./g, '_')}`,
      title: `Static asset not found: ${toCheck}`,
      severity: 'medium',
      system: 'static-assets',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [`GET ${toCheck}`, 'Observe 404'],
      suggestedFix: `Ensure the file exists at public${toCheck} and the static middleware serves public/.`,
      evidence: '404',
    });
  }
  return r;
}

async function testAdminEndpointProtection(ctx) {
  if (ctx.archetype !== 'exploiter') return null;
  // Try to access admin endpoints without credentials
  const adminPaths = [
    '/api/admin/mintables',
    '/api/admin/player',
    '/api/keys-admin',
  ];
  for (const adminPath of adminPaths) {
    const r = await get(adminPath);
    trackRequest(r, 'admin-protection');
    if (r.status === 200) {
      recordBug({
        id: `admin_unprotected_${adminPath.replace(/\//g, '_')}`,
        title: `Admin endpoint ${adminPath} accessible without authentication`,
        severity: 'critical',
        system: 'admin',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [`GET ${adminPath} (no auth header)`, 'Observe: 200 OK'],
        suggestedFix: 'Apply admin auth middleware to all /api/admin/* and /api/keys-admin routes.',
        evidence: `HTTP 200 from ${adminPath}`,
      });
    }
  }
}

async function testDoubleSpendCaps(ctx) {
  if (ctx.archetype !== 'exploiter' && ctx.archetype !== 'speedrunner') return null;
  // Fire two simultaneous claim attempts for the same location
  const locationId = 'race_test_loc_001';
  const [r1, r2] = await Promise.all([
    post('/api/location-claim', { wallet: ctx.wallet, locationId, lat: ctx.coord.lat, lng: ctx.coord.lng }, ctx.authHeader),
    post('/api/location-claim', { wallet: ctx.wallet, locationId, lat: ctx.coord.lat, lng: ctx.coord.lng }, ctx.authHeader),
  ]);
  trackRequests([r1, r2], 'double-spend');
  if (r1.status === 200 && r2.status === 200 && r1.body?.ok && r2.body?.ok) {
    recordBug({
      id: 'double_claim_race_condition',
      title: 'Double-spend: Two concurrent location claims both succeed',
      severity: 'critical',
      system: 'location-claim',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [
        'Send two simultaneous POST /api/location-claim for the same locationId',
        'Observe: both return 200 OK',
      ],
      suggestedFix: 'Use Redis SETNX / SET NX EX for atomically checking and setting the claim, ensuring only one succeeds.',
      evidence: `r1=${r1.status}, r2=${r2.status}`,
    });
  }
}

async function testSqlInjection(ctx) {
  if (ctx.archetype !== 'exploiter') return null;
  // Test a sample of query params for injection probes
  const probes = [
    `/api/player?wallet=' OR 1=1 --`,
    `/api/quests?id=1 UNION SELECT * FROM players`,
    `/api/npc-context/siren'; DROP TABLE npcs; --`,
  ];
  for (const probe of probes) {
    const r = await get(probe);
    trackRequest(r, 'sql-injection-probe');
    // If we get a 500, it might indicate an unhandled exception (not necessarily SQLi but worth flagging)
    if (r.status === 500) {
      recordBug({
        id: 'unhandled_500_on_injection_probe',
        title: `Unhandled 500 error on injection probe: ${probe.slice(0, 60)}`,
        severity: 'high',
        system: 'input-validation',
        archetype: ctx.archetype,
        wallet: ctx.wallet,
        reproSteps: [`GET ${probe}`, 'Observe: HTTP 500 Internal Server Error'],
        suggestedFix: 'Add global error handler middleware. Validate and sanitize all query parameters before use.',
        evidence: r.raw.slice(0, 200),
      });
    }
  }
}

async function testPerformanceUnderLoad(ctx) {
  // Pick a random high-traffic endpoint and measure latency
  const endpoints = ['/api/health', '/api/locations', '/api/quests', '/api/config/frontend'];
  const ep = endpoints[ctx.id % endpoints.length];
  const r = await get(ep);
  trackRequest(r, 'perf-probe');
  if (r.durationMs > 3000 && r.status !== 0) {
    recordBug({
      id: `slow_endpoint_${ep.replace(/\//g, '_').replace(/\./g, '_')}`,
      title: `Slow response on ${ep}: ${r.durationMs}ms (threshold: 3000ms)`,
      severity: 'medium',
      system: 'performance',
      archetype: ctx.archetype,
      wallet: ctx.wallet,
      reproSteps: [`GET ${ep}`, `Response took ${r.durationMs}ms`],
      suggestedFix: 'Add Redis caching for this endpoint; or review database query complexity.',
      evidence: `${r.durationMs}ms`,
    });
  }
}

// -----------------------------------------------------------------------
// Request tracking helpers
// -----------------------------------------------------------------------
function trackRequest(r, system) {
  totalRequests++;
  if (r.error === 'timeout') totalTimeouts++;
  else if (r.error)          totalErrors++;
  if (r.durationMs) recordPerf(system, r.durationMs);
}

function trackRequests(results, system) {
  results.forEach(r => trackRequest(r, system));
}

// -----------------------------------------------------------------------
// Virtual player session — runs all relevant tests for one archetype
// -----------------------------------------------------------------------
async function runPlayerSession(playerId) {
  const archetype = ARCHETYPES[playerId % ARCHETYPES.length];
  const coord     = WORLD_COORDS[playerId % WORLD_COORDS.length];
  const wallet    = mockWallet(playerId);
  // Simulate a fake session token (real auth would need wallet signing)
  const fakeSessionId = crypto.createHash('sha256').update(wallet + ':session').digest('hex');
  const authHeader = { Authorization: `Bearer ${fakeSessionId}` };

  const ctx = { id: playerId, archetype, coord, wallet, authHeader };

  try {
    // All archetypes run these core checks
    await testHealth(ctx);
    await testFrontendConfig(ctx);
    await testLocations(ctx);
    await testQuests(ctx);
    await testMintables(ctx);
    await testFactions(ctx);
    await testRotation(ctx);

    // Authenticated / player-specific checks
    await testPlayerProfile(ctx);
    await testCaps(ctx);
    await testCooldowns(ctx);
    await testXp(ctx);
    await testPlayerNFTs(ctx);
    await testCamp(ctx);
    await testSettings(ctx);
    await testNpcContext(ctx);
    await testGps(ctx);
    await testGeofence(ctx);
    await testCompanions(ctx);
    await testMutations(ctx);
    await testLootVoucher(ctx);
    await testQuestEndings(ctx);
    await testStaticAssets(ctx);
    await testOverseerProxy(ctx);
    await testPerformanceUnderLoad(ctx);

    // Archetype-specific / exploit paths
    await testLocationClaim(ctx);
    await testFactionRaids(ctx);
    await testBattles(ctx);
    await testDungeon(ctx);
    await testCrafting(ctx);
    await testScavenger(ctx);
    await testMintItem(ctx);
    await testScrapNft(ctx);
    await testRedeemVoucher(ctx);
    await testNukes(ctx);
    await testAdminEndpointProtection(ctx);
    await testDoubleSpendCaps(ctx);
    await testSqlInjection(ctx);
  } catch (err) {
    // Swallow individual player errors to keep the batch running
    recordBug({
      id: `player_session_crash_${playerId}`,
      title: `Player session ${playerId} crashed with an unhandled exception`,
      severity: 'high',
      system: 'test-runner',
      archetype,
      wallet,
      reproSteps: [`Run player session for archetype "${archetype}" (id=${playerId})`],
      suggestedFix: 'Investigate server-side exception; ensure all endpoints have try/catch and return proper error responses.',
      evidence: err.message,
    });
  }
}

// -----------------------------------------------------------------------
// Batch runner — respects BATCH_SIZE for controlled concurrency
// -----------------------------------------------------------------------
async function runAllPlayers() {
  let completed = 0;
  for (let i = 0; i < PLAYER_COUNT; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, PLAYER_COUNT); j++) {
      batch.push(runPlayerSession(j));
    }
    await Promise.all(batch);
    completed += batch.length;
    process.stdout.write(`\r  Simulated ${completed}/${PLAYER_COUNT} players...`);
  }
  process.stdout.write('\n');
}

// -----------------------------------------------------------------------
// Performance analysis
// -----------------------------------------------------------------------
function analysePerformance() {
  const bySystem = {};
  for (const s of perfSamples) {
    if (!bySystem[s.system]) bySystem[s.system] = [];
    bySystem[s.system].push(s.durationMs);
  }
  const perfReport = [];
  for (const [system, samples] of Object.entries(bySystem)) {
    samples.sort((a, b) => a - b);
    const avg  = Math.round(samples.reduce((s, v) => s + v, 0) / samples.length);
    const p95  = samples[Math.floor(samples.length * 0.95)] || 0;
    const max  = samples[samples.length - 1] || 0;
    perfReport.push({ system, sampleCount: samples.length, avgMs: avg, p95Ms: p95, maxMs: max });

    if (p95 > 5000) {
      recordBug({
        id: `perf_p95_critical_${system}`,
        title: `Performance CRITICAL: p95 latency for "${system}" is ${p95}ms`,
        severity: 'high',
        system,
        archetype: 'all',
        wallet: 'N/A',
        reproSteps: [`Run ${samples.length} concurrent requests to the "${system}" system`, `Observe p95 latency = ${p95}ms`],
        suggestedFix: 'Profile endpoint; add Redis caching, database indexes, or response pagination.',
        evidence: `avg=${avg}ms, p95=${p95}ms, max=${max}ms`,
      });
    }
  }
  return perfReport;
}

// -----------------------------------------------------------------------
// Bug report formatter
// -----------------------------------------------------------------------
function generateBugReport(perfReport) {
  const sorted = bugs.slice().sort((a, b) =>
    (SEVERITIES[b.severity] || 0) - (SEVERITIES[a.severity] || 0)
  );

  const summary = {
    generated_at     : new Date().toISOString(),
    base_url         : BASE_URL,
    players_simulated: PLAYER_COUNT,
    batch_size       : BATCH_SIZE,
    total_requests   : totalRequests,
    total_errors     : totalErrors,
    total_timeouts   : totalTimeouts,
    bugs_found       : bugs.length,
    critical         : bugs.filter(b => b.severity === 'critical').length,
    high             : bugs.filter(b => b.severity === 'high').length,
    medium           : bugs.filter(b => b.severity === 'medium').length,
    low              : bugs.filter(b => b.severity === 'low').length,
    performance      : perfReport,
    findings         : sorted,
  };

  return summary;
}

// -----------------------------------------------------------------------
// Human-readable console output
// -----------------------------------------------------------------------
function printReport(report) {
  const SEV_ICON = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ATOMIC FIZZ CAPS — LOAD TEST BUG REPORT                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  Target       : ${report.base_url}`);
  console.log(`  Players      : ${report.players_simulated} (batch=${report.batch_size})`);
  console.log(`  Requests     : ${report.total_requests} total | ${report.total_errors} errors | ${report.total_timeouts} timeouts`);
  console.log(`  Bugs Found   : ${report.bugs_found} total`);
  console.log(`    🔴 Critical : ${report.critical}`);
  console.log(`    🟠 High     : ${report.high}`);
  console.log(`    🟡 Medium   : ${report.medium}`);
  console.log(`    🟢 Low      : ${report.low}`);

  if (report.findings.length === 0) {
    console.log('\n  ✅ No bugs detected across all simulated player sessions.\n');
  } else {
    console.log('\n  ── FINDINGS ─────────────────────────────────────────────────\n');
    for (const bug of report.findings) {
      const icon = SEV_ICON[bug.severity] || '⚪';
      console.log(`  ${icon} [${bug.severity.toUpperCase()}] ${bug.id}`);
      console.log(`      Title   : ${bug.title}`);
      console.log(`      System  : ${bug.system}`);
      console.log(`      Archetype: ${bug.archetype}`);
      console.log(`      Repro   : ${bug.reproSteps.join(' → ')}`);
      console.log(`      Fix     : ${bug.suggestedFix}`);
      if (bug.occurrences > 1) console.log(`      Seen    : ${bug.occurrences}x`);
      console.log();
    }
  }

  if (report.performance && report.performance.length > 0) {
    const slowSystems = report.performance.filter(p => p.p95Ms > 1000);
    if (slowSystems.length > 0) {
      console.log('  ── SLOW SYSTEMS (p95 > 1 s) ─────────────────────────────────\n');
      for (const p of slowSystems.sort((a, b) => b.p95Ms - a.p95Ms)) {
        console.log(`  ⏱  ${p.system.padEnd(22)} avg=${p.avgMs}ms  p95=${p.p95Ms}ms  max=${p.maxMs}ms  (n=${p.sampleCount})`);
      }
      console.log();
    }
  }

  console.log(`  📄 Full report: ${REPORT_PATH}`);
  console.log('══════════════════════════════════════════════════════════════\n');
}

// -----------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  VAULT-77 WASTELAND GPS — Concurrent Load Test & Bug Hunter  ║');
  console.log(`║  Players: ${String(PLAYER_COUNT).padEnd(4)} | Batch: ${String(BATCH_SIZE).padEnd(4)} | Target: ${BASE_URL.slice(0, 22).padEnd(22)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Quick reachability check — warn early if backend is down
  const ping = await get('/api/health');
  if (ping.status === 0) {
    console.warn(`  ⚠️  Backend at ${BASE_URL} is not reachable (connection refused or network error).`);
    console.warn('  Run `npm start` or `npm run dev` first, or set --base-url to a live instance.\n');
    console.warn('  Continuing with dry-run (all requests will fail gracefully)...\n');
  }

  console.log(`  Simulating ${PLAYER_COUNT} players across ${ARCHETYPES.length} archetypes...`);
  console.log(`  Archetypes: ${ARCHETYPES.join(', ')}\n`);

  const t0 = Date.now();
  await runAllPlayers();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n  ✅ All player sessions complete in ${elapsed}s`);

  const perfReport = analysePerformance();
  const report = generateBugReport(perfReport);

  try {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  } catch (e) {
    console.error(`  Could not write report to ${REPORT_PATH}: ${e.message}`);
  }

  printReport(report);

  // Exit non-zero if critical bugs found
  const criticalCount = report.critical;
  process.exit(criticalCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[load-test] Fatal error:', err);
  process.exit(1);
});
