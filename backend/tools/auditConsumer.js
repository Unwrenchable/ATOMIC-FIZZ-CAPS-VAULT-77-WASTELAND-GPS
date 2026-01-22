// backend/tools/auditConsumer.js
const Redis = require("ioredis");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const REDIS_URL = process.env.REDIS_URL;
const S3_BUCKET = process.env.AUDIT_S3_BUCKET;
const S3_PREFIX = process.env.AUDIT_S3_PREFIX || "audit/";
const STREAMS = (process.env.AUDIT_STREAMS || "stream:keys:audit,stream:cooldowns:audit,stream:voucher:events").split(",");
const CHECKPOINT_KEY = "audit:consumer:checkpoint";
const POLL_TIMEOUT_MS = 5000;

if (!REDIS_URL) throw new Error("REDIS_URL required");
if (!S3_BUCKET) throw new Error("AUDIT_S3_BUCKET required");

const redis = new Redis(REDIS_URL);
const s3 = new AWS.S3();

async function readCheckpoint() {
  const raw = await redis.get(CHECKPOINT_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeCheckpoint(obj) {
  await redis.set(CHECKPOINT_KEY, JSON.stringify(obj));
}

function s3KeyForStream(stream, ts) {
  const date = new Date(ts);
  const hour = date.toISOString().slice(0, 13).replace(":", "-");
  return `${S3_PREFIX}${stream}/${hour}.ndjson`;
}

async function uploadToS3(key, body) {
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ServerSideEncryption: "AES256",
  }).promise();
}

async function process() {
  let checkpoints = await readCheckpoint();
  for (const stream of STREAMS) {
    if (!checkpoints[stream]) checkpoints[stream] = "0-0";
  }

  while (true) {
    try {
      // XREAD BLOCK
      const res = await redis.xread(
        "BLOCK",
        POLL_TIMEOUT_MS,
        "COUNT",
        100,
        "STREAMS",
        ...STREAMS,
        ...STREAMS.map((s) => checkpoints[s])
      );

      if (!res) continue;

      for (const [stream, entries] of res) {
        // entries: [[id, [field, value, ...]], ...]
        const lines = [];
        let lastId = checkpoints[stream];
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
          lines.push(JSON.stringify(obj));
          lastId = id;
        }
        // upload lines as ndjson to S3 (append by writing to a temp file then uploading)
        if (lines.length) {
          const key = s3KeyForStream(stream, Date.now());
          const body = lines.join("\n") + "\n";
          await uploadToS3(key, body);
          checkpoints[stream] = lastId;
          await writeCheckpoint(checkpoints);
        }
      }
    } catch (err) {
      console.error("[auditConsumer] error:", err && err.message ? err.message : err);
      // backoff
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

process().catch((err) => {
  console.error("Audit consumer failed:", err && err.message ? err.message : err);
  process.exit(1);
});
