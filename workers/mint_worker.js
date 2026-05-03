// workers/mint_worker.js
// Real worker that processes queued NFT mints and writes the on-chain result
// back to the audit record for frontend polling.

const { redis, key } = require('../backend/lib/redis');
const { mintNftForJob } = require('../backend/lib/nft-minting');

async function retry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`[mint_worker] Attempt ${i + 1} failed`, err.message);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries reached');
}

async function processJob(job) {
  console.log('[mint_worker] processing job', job);

  try {
    const result = await retry(() => mintNftForJob(job), 3, 1500);

    const raw = await redis.get(job.auditKey);
    const audit = raw ? JSON.parse(raw) : {};
    audit.status = 'minted';
    audit.item = result.item;
    audit.itemId = result.item.id;
    audit.mintAddress = result.mintAddress;
    audit.signature = result.signature;
    audit.tokenAccount = result.tokenAccount;
    audit.metadataUri = result.metadataUri;
    audit.processedAt = Date.now();
    await redis.set(job.auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });
    console.log('[mint_worker] minted NFT for', job.wallet, result.mintAddress);
  } catch (err) {
    console.error('[mint_worker] failed to process job', err.message);
    try {
      const raw = await redis.get(job.auditKey);
      const audit = raw ? JSON.parse(raw) : {};
      audit.status = 'error';
      audit.error = err.message;
      audit.processedAt = Date.now();
      await redis.set(job.auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });
    } catch (auditErr) {
      console.error('[mint_worker] failed to update audit with error', auditErr.message);
    }
  }
}

async function runOnce() {
  try {
    const qKey = 'mint:queue:list';
    const qRedisKey = key(qKey);
    const streamKey = key('mint:queue:stream');
    // Use blocking pop (BRPOP) when available for efficient waiting
    // Prefer reading from Redis Stream consumer-style (XREAD) if available
    if (redis.client && typeof redis.client.sendCommand === 'function') {
      try {
        // Read 1 entry from stream with BLOCK 2000 ms
        const res = await redis.client.sendCommand(['XREAD', 'COUNT', '1', 'BLOCK', '2000', 'STREAMS', streamKey, '$']);
        // res format: [[streamKey, [[id, [field, value, ...]]]]]
        if (!res) return null;
        try {
          const entries = res[0][1];
          if (!entries || !entries.length) return null;
          const entry = entries[0];
          const fields = entry[1];
          // fields like ['data', '{...}']
          const jsonStr = fields[1];
          const job = JSON.parse(jsonStr);
          // Acknowledge by trimming stream? For demo we just process
          await processJob(job);
          return job;
        } catch (e) {
          return null;
        }
      } catch (e) {
        // fall back to list-based
      }
    }

    // Fallback: non-blocking RPOP if available
    if (redis.client && typeof redis.client.rPop === 'function') {
      const raw = await redis.client.rPop(qRedisKey);
      if (!raw) return null;
      const job = JSON.parse(raw);
      await processJob(job);
      return job;
    }

    // Last fallback: read entire array, pop first element, write back
    const rawList = await redis.get(qKey) || '[]';
    const arr = JSON.parse(rawList);
    if (!arr.length) return null;
    const job = arr.pop();
    await redis.set(qKey, JSON.stringify(arr));
    await processJob(job);
    return job;
  } catch (err) {
    console.error('[mint_worker] error', err && err.message ? err.message : err);
    return null;
  }
}

async function loop() {
  while (true) {
    const job = await runOnce();
    if (!job) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
  }
}

if (require.main === module) {
  console.log('[mint_worker] starting worker loop');
  loop();
}

module.exports = { runOnce, loop };
