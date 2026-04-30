// workers/mint_worker.js
// Simple worker that processes items from the Redis list `afw:mint:queue:list`.
// It signs loot vouchers with KMS and marks audit with signed voucher

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { redis, key } = require('../backend/lib/redis');
const { signMessage } = require('./kms_stub');
const anchor = require('@coral-xyz/anchor');

// Load IDL
const idlPath = path.join(__dirname, '../programs/fizzcaps-onchain/target/idl/fizzcaps_onchain.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const coder = new anchor.Coder(idl);

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
    // Create LootVoucher
    const loot_id = BigInt(job.itemId);
    const voucher = {
      loot_id: loot_id,
      latitude: job.latitude,
      longitude: job.longitude,
      timestamp: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
      location_hint: job.locationHint || '',
      server_signature: null
    };

    // Serialize voucher data for signing (without signature) using Borsh
    const voucherData = {
      loot_id: voucher.loot_id,
      latitude: voucher.latitude,
      longitude: voucher.longitude,
      timestamp: voucher.timestamp,
      location_hint: voucher.location_hint,
      server_signature: new Uint8Array(64) // dummy for serialization
    };
    const message = coder.types.encode('LootVoucher', voucherData);

    // Sign with KMS (with retries)
    const signatureHex = await retry(() => {
      try {
        return signMessage(message);
      } catch (err) {
        throw new Error(`KMS signing failed: ${err.message}`);
      }
    }, 3, 1000);

    // Convert hex signature to [u8;64] array
    const sigBuffer = Buffer.from(signatureHex, 'hex');
    if (sigBuffer.length !== 64) {
      throw new Error(`Invalid signature length: ${sigBuffer.length}`);
    }
    voucher.server_signature = Array.from(sigBuffer);

    // Mark audit record with signed voucher
    const auditKey = job.auditKey;
    const tx = {
      txId: `signed-voucher-${loot_id}-${Date.now()}`,
      voucher: voucher,
      mintedAt: Date.now(),
      status: 'signed'
    };

    const raw = await redis.get(auditKey);
    const audit = raw ? JSON.parse(raw) : {};
    audit.tx = tx;
    audit.processedAt = Date.now();
    await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });
    console.log('[mint_worker] audit updated for', loot_id, tx.txId);
  } catch (err) {
    console.error('[mint_worker] failed to process job', err.message);
    // Optionally, mark audit with error status
    try {
      const auditKey = job.auditKey;
      const raw = await redis.get(auditKey);
      const audit = raw ? JSON.parse(raw) : {};
      audit.tx = {
        status: 'error',
        error: err.message,
        processedAt: Date.now()
      };
      await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });
    } catch (auditErr) {
      console.error('[mint_worker] failed to update audit with error', auditErr.message);
    }
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
