// tests/mint_stream_worker.test.js
// Test enqueuing into stream and running worker.processStreamEntry directly
const { redis, key } = require('../backend/lib/redis');
const { processStreamEntry } = require('../workers/mint_worker_stream');

(async () => {
  try {
    const queueStream = key('mint:queue:stream');
    const itemId = `test-${Date.now()}`;
    const auditKey = key(`mint:audit:${itemId}`);
    const job = { type: 'mint', itemId, wallet: 'testwallet', auditKey };
    // write audit placeholder
    await redis.set(auditKey, JSON.stringify({ itemId, wallet: 'testwallet' }), { EX: 60 });
    // push job into stream
    if (redis.client && typeof redis.client.sendCommand === 'function') {
      await redis.client.sendCommand(['XADD', queueStream, '*', 'data', JSON.stringify(job)]);
    } else {
      await redis.set(key('mint:queue:list'), JSON.stringify([job]));
    }

    // Now call processStreamEntry via finding last entry id
    const res = await redis.client.sendCommand(['XREVRANGE', queueStream, '+', '-', 'COUNT', '1']);
    if (res && res[0] && res[0][0]) {
      const id = res[0][0];
      const fields = res[0][1];
      await processStreamEntry(id, fields);
      console.log('mint_stream_worker test processed', id);
    } else {
      console.log('no stream entry found to process');
    }

    process.exit(0);
  } catch (e) {
    console.error('mint_stream_worker test failed', e);
    process.exit(1);
  }
})();
