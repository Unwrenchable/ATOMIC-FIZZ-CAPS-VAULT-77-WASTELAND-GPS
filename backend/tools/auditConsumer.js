// backend/tools/auditConsumer.js  (improved core loop)
const os = require('os');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const tmp = require('tmp');
tmp.setGracefulCleanup();

async function s3UploadFromFile(key, filePath) {
  const fileStream = fs.createReadStream(filePath);
  await s3.upload({
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileStream,
    ServerSideEncryption: 'AES256',
  }).promise();
}

function s3KeyForStreamAtTs(stream, ts) {
  const date = new Date(ts);
  const hour = date.toISOString().slice(0, 13).replace(':', '-');
  return `${S3_PREFIX}${stream}/${hour}.ndjson`;
}

let shuttingDown = false;
process.on('SIGINT', () => { shuttingDown = true; console.log('SIGINT received, shutting down...'); });
process.on('SIGTERM', () => { shuttingDown = true; console.log('SIGTERM received, shutting down...'); });

async function processLoop() {
  let checkpoints = await readCheckpoint();
  for (const stream of STREAMS) {
    if (!checkpoints[stream]) checkpoints[stream] = '0-0';
  }

  while (!shuttingDown) {
    try {
      const streamIds = STREAMS.map(s => checkpoints[s] || '0-0');

      const res = await redis.xread(
        'BLOCK', POLL_TIMEOUT_MS,
        'COUNT', 100,
        'STREAMS',
        ...STREAMS,
        ...streamIds
      );

      if (!res) continue;

      for (const [stream, entries] of res) {
        // create a temp file and stream NDJSON into it
        const tmpFile = tmp.fileSync({ prefix: 'audit-', postfix: '.ndjson' });
        const writeStream = fs.createWriteStream(tmpFile.name, { flags: 'a' });

        let lastId = checkpoints[stream];
        let firstEntryTs = null;

        for (const [id, fields] of entries) {
          const obj = {};
          for (let i = 0; i < fields.length; i += 2) {
            const k = fields[i];
            const v = fields[i + 1];
            try {
              obj[k] = JSON.parse(v);
            } catch {
              obj[k] = v;
            }
          }
          obj._id = id;
          obj._stream = stream;

          // attempt to extract a timestamp from the object if present
          if (!firstEntryTs) {
            if (obj.timestamp) firstEntryTs = new Date(obj.timestamp).getTime();
            else {
              // fallback: use Redis stream id timestamp (ms-xxxx)
              const tsPart = id.split('-')[0];
              const tsNum = Number(tsPart);
              if (!Number.isNaN(tsNum)) firstEntryTs = tsNum;
            }
          }

          writeStream.write(JSON.stringify(obj) + '\n');
          lastId = id;
        }

        await new Promise((resW) => writeStream.end(resW));

        // choose key time: firstEntryTs or now
        const keyTs = firstEntryTs || Date.now();
        const key = s3KeyForStreamAtTs(stream, keyTs);

        // upload file
        await s3UploadFromFile(key, tmpFile.name);

        // update checkpoint only after successful upload
        checkpoints[stream] = lastId;
        await writeCheckpoint(checkpoints);

        // cleanup tmp file
        try { tmpFile.removeCallback(); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('[auditConsumer] error:', err && err.message ? err.message : err);
      // exponential backoff with cap
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // final checkpoint flush on shutdown
  try {
    const final = await readCheckpoint();
    await writeCheckpoint(final);
    console.log('Shutdown complete, checkpoints saved.');
  } catch (e) {
    console.error('Error saving final checkpoint:', e);
  }
}

processLoop().catch((err) => {
  console.error('Audit consumer failed:', err && err.message ? err.message : err);
  process.exit(1);
});
