// tests/mint_worker_stream2.test.js
const { redis, key } = require('../backend/lib/redis');
const { processEntry } = require('../workers/mint_worker_stream2');

(async () => {
  try {
    const streamKey = key('mint:queue:stream');
    const itemId = `test-${Date.now()}`;
    const auditKey = key(`mint:audit:${itemId}`);
    const job = { type: 'mint', itemId, wallet: 'testwallet', auditKey };

    await redis.set(auditKey, JSON.stringify({ itemId, wallet: 'testwallet' }), { EX: 60 });
    // XADD
    await redis.client.sendCommand(['XADD', streamKey, '*', 'data', JSON.stringify(job)]);

    // find latest entry id
    const res = await redis.client.sendCommand(['XREVRANGE', streamKey, '+', '-', 'COUNT', '1']);
    if (res && res[0] && res[0][0]) {
      const id = res[0][0];
      const fields = res[0][1];
      const ok = await processEntry(id, fields);
      console.log('processed', id, ok);
    } else {
      console.log('no entry');
    }
    process.exit(0);
  } catch (e) {
    console.error('test failed', e);
    process.exit(1);
  }
})();
