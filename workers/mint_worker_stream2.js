// workers/mint_worker_stream2.js
// Robust Redis Stream consumer using XREADGROUP + XAUTOCLAIM + XACK patterns

const os = require('os');
const { redis, key } = require('../backend/lib/redis');
const { signMessageStub } = require('./kms_stub');

const STREAM_KEY = key('mint:queue:stream');
const GROUP = 'mint_workers_v2';
const CONSUMER = `worker-${os.hostname()}-${process.pid}`;

async function ensureGroup() {
  try {
    await redis.client.sendCommand(['XGROUP', 'CREATE', STREAM_KEY, GROUP, '0', 'MKSTREAM']);
    console.log('[mint_worker_stream2] created consumer group');
  } catch (e) {
    // ignore if exists
  }
}

async function processEntry(id, fields) {
  try {
    const jsonStr = fields[1];
    const job = JSON.parse(jsonStr);

    console.log('[mint_worker_stream2] processing', id, job);

    // Simulate signing via KMS stub
    const signature = signMessageStub(Buffer.from(JSON.stringify(job)));

    // Update audit record
    const auditKey = job.auditKey;
    const raw = await redis.get(auditKey);
    const audit = raw ? JSON.parse(raw) : {};
    audit.tx = { txId: `tx-${Date.now()}`, signature, status: 'success' };
    audit.processedAt = Date.now();
    await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });

    // Acknowledge
    await redis.client.sendCommand(['XACK', STREAM_KEY, GROUP, id]);
    console.log('[mint_worker_stream2] acknowledged', id);
    return true;
  } catch (err) {
    console.error('[mint_worker_stream2] process error', err && err.message ? err.message : err);
    return false;
  }
}

async function claimPending() {
  try {
    // Claim pending messages idle > 60s
    const res = await redis.client.sendCommand(['XAUTOCLAIM', STREAM_KEY, GROUP, CONSUMER, '60000', '0-0', 'COUNT', '10']);
    // res format: [nextId, [[id, [field, value]], ...]]
    if (!res) return [];
    const entries = res[1] || [];
    const jobs = [];
    for (const entry of entries) {
      const id = entry[0];
      const fields = entry[1];
      const ok = await processEntry(id, fields);
      if (ok) jobs.push(id);
    }
    return jobs;
  } catch (e) {
    console.error('[mint_worker_stream2] claim pending error', e && e.message ? e.message : e);
    return [];
  }
}

async function loop() {
  await ensureGroup();
  while (true) {
    try {
      // First try to claim pending
      await claimPending();

      // Read new messages
      const res = await redis.client.sendCommand(['XREADGROUP','GROUP', GROUP, CONSUMER, 'COUNT','5','BLOCK','5000','STREAMS', STREAM_KEY, '>']);
      if (!res) continue;
      const entries = res[0][1];
      for (const entry of entries) {
        const id = entry[0];
        const fields = entry[1];
        await processEntry(id, fields);
      }
    } catch (err) {
      console.error('[mint_worker_stream2] loop error', err && err.message ? err.message : err);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

if (require.main === module) {
  console.log('[mint_worker_stream2] starting');
  loop();
}

module.exports = { loop, processEntry };
