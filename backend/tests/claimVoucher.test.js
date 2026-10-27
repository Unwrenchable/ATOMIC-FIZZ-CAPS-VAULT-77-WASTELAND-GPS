"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

delete process.env.REDIS_URL;
delete process.env.REDIS;
process.env.SOLANA_CLUSTER = "localnet";
process.env.FIZZCAPS_PROGRAM_ID = "HnWTnCKuKhJa6cXj4ZocW2D8Jtf4f5QFb6f6UnkF27FB";
process.env.CLAIM_VOUCHER_IP_MAX = "100";
process.env.CLAIM_VOUCHER_COOLDOWN_SECONDS = "300";

const kp = nacl.sign.keyPair();
const encode = typeof bs58.encode === "function" ? bs58.encode : bs58.default.encode;
process.env.SERVER_SECRET_KEY_LOCALNET = encode(Buffer.from(kp.secretKey));
for (const name of [
  "SERVER_SECRET_KEY_DEVNET",
  "SERVER_SECRET_KEY_MAINNET",
  "KMS_SIGNING_KEY_ID_DEVNET",
  "KMS_SIGNING_KEY_ID_LOCALNET",
  "KMS_SIGNING_KEY_ID_MAINNET",
  "ONCHAIN_VOUCHERS",
]) {
  delete process.env[name];
}

const express = require("express");
const {
  buildClaimAuthMessage,
  stableLootId,
} = require("../api/claim-voucher");

const LOOT_ID = "the_dimming_expanse_north_america_0";
const SITE_LAT = 16.365019;
const SITE_LNG = -90.892145;

function walletFrom(pair) {
  return encode(Buffer.from(pair.publicKey));
}

function signClaim(pair, fields) {
  const message = buildClaimAuthMessage(fields);
  const signature = Buffer.from(
    nacl.sign.detached(Buffer.from(message, "utf8"), pair.secretKey)
  ).toString("base64");
  return { message, signature };
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function app() {
  const expressApp = express();
  expressApp.use(express.json());
  expressApp.use("/api/claim-voucher", require("../api/claim-voucher"));
  return expressApp;
}

async function post(server, urlPath, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

test("claim-voucher ignores body wallet and uses the site coordinates", async (t) => {
  const server = await listen(app());
  t.after(() => server.close());
  const player = nacl.sign.keyPair();
  const wallet = walletFrom(player);
  const nonceRes = await post(server, "/api/claim-voucher/nonce", {});
  assert.equal(nonceRes.status, 200);
  assert.equal(nonceRes.json.nonce.length, 64);
  const issuedAt = Math.floor(Date.now() / 1000);
  const signed = signClaim(player, {
    wallet,
    lootId: LOOT_ID,
    nonce: nonceRes.json.nonce,
    issuedAt,
    latitude: String(SITE_LAT),
    longitude: String(SITE_LNG),
  });
  const other = walletFrom(nacl.sign.keyPair());
  const claimed = await post(server, "/api/claim-voucher", {
    wallet: other,
    message: signed.message,
    signature: signed.signature,
  });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.json));
  assert.equal(claimed.json.voucher.lootId, String(stableLootId(LOOT_ID)));
  const { toE6 } = require("../lib/voucherV1");
  assert.equal(claimed.json.voucher.latE6, toE6(SITE_LAT));
  assert.equal(claimed.json.voucher.lngE6, toE6(SITE_LNG));
  assert.equal(claimed.json.voucher.locationHint, "The Dimming Expanse");
  assert.equal(claimed.json.voucher.voucherId.length, 32);
  assert.notEqual(claimed.json.voucher.player, other);
  const { buildVoucherMessageV1 } = require("../lib/voucherV1");
  const message = buildVoucherMessageV1({
    cluster: "localnet",
    programId: claimed.json.programId,
    player: wallet,
    voucherId: claimed.json.voucher.voucherId,
    lootId: claimed.json.voucher.lootId,
    latE6: claimed.json.voucher.latE6,
    lngE6: claimed.json.voucher.lngE6,
    locationHint: claimed.json.voucher.locationHint,
    issuedAt: claimed.json.voucher.issuedAt,
    expiresAt: claimed.json.voucher.expiresAt,
  });
  const sig = Buffer.from(claimed.json.signature, "base64");
  const serverPub = bs58.decode
    ? bs58.decode(claimed.json.serverPubkey)
    : bs58.default.decode(claimed.json.serverPubkey);
  assert.equal(sig.length, 64);
  assert.ok(nacl.sign.detached.verify(message, sig, serverPub));

  const replay = await post(server, "/api/claim-voucher", {
    message: signed.message,
    signature: signed.signature,
  });
  assert.equal(replay.status, 401);
  assert.equal(replay.json.error, "nonce_rejected");

  const again = await post(server, "/api/claim-voucher/nonce", {});
  const second = signClaim(player, {
    wallet,
    lootId: LOOT_ID,
    nonce: again.json.nonce,
    issuedAt,
    latitude: String(SITE_LAT),
    longitude: String(SITE_LNG),
  });
  const cooled = await post(server, "/api/claim-voucher", second);
  assert.equal(cooled.status, 429);
  assert.equal(cooled.json.error, "cooldown");
});

test("claim-voucher rejects a wrong signer, a far player, and a missing nonce", async (t) => {
  const server = await listen(app());
  t.after(() => server.close());
  const player = nacl.sign.keyPair();
  const wallet = walletFrom(player);
  const nonceRes = await post(server, "/api/claim-voucher/nonce", {});
  const issuedAt = Math.floor(Date.now() / 1000);
  const fields = {
    wallet,
    lootId: LOOT_ID,
    nonce: nonceRes.json.nonce,
    issuedAt,
    latitude: "0",
    longitude: "0",
  };
  const signed = signClaim(player, fields);
  const far = await post(server, "/api/claim-voucher", signed);
  assert.equal(far.status, 403);
  assert.equal(far.json.error, "not_near_poi");

  const stranger = nacl.sign.keyPair();
  const forged = signClaim(stranger, { ...fields, wallet });
  const bad = await post(server, "/api/claim-voucher", forged);
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error, "bad_signature");

  const fresh = await post(server, "/api/claim-voucher/nonce", {});
  const unused = signClaim(player, {
    wallet,
    lootId: LOOT_ID,
    nonce: "ab".repeat(32),
    issuedAt,
    latitude: String(SITE_LAT),
    longitude: String(SITE_LNG),
  });
  assert.notEqual(unused.nonce, fresh.json.nonce);
  const missing = await post(server, "/api/claim-voucher", unused);
  assert.equal(missing.status, 401);
  assert.equal(missing.json.error, "nonce_rejected");
});
