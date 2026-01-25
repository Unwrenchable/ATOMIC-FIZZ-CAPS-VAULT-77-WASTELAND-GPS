// workers/mint_worker.js
// Simple worker that processes items from the Redis list `afw:mint:queue:list`.
// It demonstrates safe dequeue (RPOP/LPOP), processes job, marks audit with fake tx

const { redis, key } = require('../backend/lib/redis');

async function processJob(job) {
  console.log('[mint_worker] processing job', job);
  // Simulate on-chain mint: wait a bit
  await new Promise(r => setTimeout(r, 1000));

  // Mark audit record with simulated tx
  const auditKey = job.auditKey;
  const tx = {
    txId: `tx-${Date.now()}-${Math.floor(Math.random()*10000)}`,
    mintedAt: Date.now(),
    status: 'success'
  };

  try {
    const raw = await redis.get(auditKey);
    const audit = raw ? JSON.parse(raw) : {};
    audit.tx = tx;
    audit.processedAt = Date.now();
    await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });
    console.log('[mint_worker] audit updated for', job.itemId, tx.txId);
  } catch (err) {
    console.error('[mint_worker] failed to update audit', err && err.message ? err.message : err);
  }
}

async function runOnce() {
  try {
    const qKey = key('mint:queue:list');
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
      const raw = await redis.client.rPop(qKey);
      if (!raw) return null;
      const job = JSON.parse(raw);
      await processJob(job);
      return job;
    }

    // Last fallback: read entire array, pop first element, write back
    const rawList = await redis.get(qKey) || '[]';
    const arr = JSON.parse(rawList);
    if (!arr.length) return null;
    const job = arr.shift();
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
