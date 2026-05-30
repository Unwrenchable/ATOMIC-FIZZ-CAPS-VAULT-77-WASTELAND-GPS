// workers/mint_worker_stream.js
// Consumes Redis Stream `afw:mint:queue:stream` and performs the actual NFT mint.

const os = require('os');
const { redis, key } = require('../backend/lib/redis');
const { mintNftForJob } = require('../backend/lib/nft-minting');

const STREAM_KEY = key('mint:queue:stream');
const GROUP = 'mint_workers';
const CONSUMER = `worker-${os.hostname()}-${process.pid}`;

async function ensureGroup() {
  try {
    // MKSTREAM ensures stream exists
    await redis.client.sendCommand(['XGROUP', 'CREATE', STREAM_KEY, GROUP, '$', 'MKSTREAM']);
  } catch (e) {
    // ignore if group exists
  }
}

async function processStreamEntry(id, data) {
  try {
    const jsonStr = Array.isArray(data) ? data[1] : null;
    if (!jsonStr) throw new Error('invalid_stream_payload');
    const job = JSON.parse(jsonStr);
    console.log('[mint_worker_stream] processing job', id, job);

    const result = await mintNftForJob(job);

    // Update audit record
    const auditKey = job.auditKey;
    const raw = await redis.get(auditKey);
    const audit = raw ? JSON.parse(raw) : {};
    audit.status = 'minted';
    audit.item = result.item;
    audit.itemId = result.item.id;
    audit.mintAddress = result.mintAddress;
    audit.signature = result.signature;
    audit.tokenAccount = result.tokenAccount;
    audit.metadataUri = result.metadataUri;
    audit.metadataProvider = result.metadataProvider || 'api';
    audit.metadataCid = result.metadataCid || null;
    audit.processedAt = Date.now();
    await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });

    // Acknowledge the entry
    await redis.client.sendCommand(['XACK', STREAM_KEY, GROUP, id]);

    console.log('[mint_worker_stream] completed', id, result.mintAddress);
    return true;
  } catch (err) {
    console.error('[mint_worker_stream] process error', err && err.message ? err.message : err);
    return false;
  }
}

async function loop() {
  await ensureGroup();
  while (true) {
    try {
      // Read pending messages for this consumer or new ones
      // First read pending (0) to recover unacked entries for this consumer
      const res = await redis.client.sendCommand(['XREADGROUP', 'GROUP', GROUP, CONSUMER, 'COUNT', '5', 'BLOCK', '2000', 'STREAMS', STREAM_KEY, '>']);
      if (!res) continue;
      // res format: [[streamKey, [[id, [field, value]], ...]]]
      const entries = res[0][1];
      for (const entry of entries) {
        const id = entry[0];
        const fields = entry[1];
        await processStreamEntry(id, fields);
      }
    } catch (err) {
      console.error('[mint_worker_stream] loop error', err && err.message ? err.message : err);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

if (require.main === module) {
  console.log('[mint_worker_stream] starting');
  loop();
}

module.exports = { loop, processStreamEntry };
