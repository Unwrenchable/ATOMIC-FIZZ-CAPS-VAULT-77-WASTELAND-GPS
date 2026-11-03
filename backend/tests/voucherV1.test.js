"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const nacl = require("tweetnacl");
const {
  buildVoucherMessageV1,
  toE6,
  MAX_VOUCHER_TTL_SECS,
  VOUCHER_MSG_LEN,
  assertClusterProgramId,
  assertDistinctClusterKeys,
  serverSecretEnv,
  PROGRAM_ID_BY_CLUSTER,
} = require("../lib/voucherV1");

const GOLDEN_PATH = path.join(
  __dirname,
  "..",
  "..",
  "anchor-tests",
  "fixtures",
  "voucher_v1_golden.json"
);
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));

test("golden message matches the committed fixture", () => {
  const message = buildVoucherMessageV1({
    cluster: "localnet",
    programId: golden.programId,
    player: golden.player,
    voucherId: golden.voucherIdHex,
    lootId: golden.lootId,
    latE6: golden.latE6,
    lngE6: golden.lngE6,
    locationHint: golden.locationHint,
    issuedAt: golden.issuedAt,
    expiresAt: golden.expiresAt,
  });
  assert.equal(message.length, VOUCHER_MSG_LEN);
  assert.equal(message.toString("hex"), golden.messageHex);
  assert.equal(golden.publicKeyOffset, 16);
  assert.equal(golden.signatureOffset, 48);
  assert.equal(golden.messageOffset, 112);
  assert.equal(golden.messageLength, 169);
  assert.equal(golden.expiresAt - golden.issuedAt, 300);
});

test("toE6 rounds halves away from zero", () => {
  assert.equal(toE6(1.0000005), 1000001);
  assert.equal(toE6(-1.0000005), -1000001);
  assert.equal(toE6(37.774929), 37774929);
  assert.equal(toE6(-122.419416), -122419416);
});

test("hint longer than 64 bytes is rejected and TTL cap is 300", () => {
  assert.equal(MAX_VOUCHER_TTL_SECS, 300);
  assert.throws(() =>
    buildVoucherMessageV1({
      cluster: "localnet",
      programId: golden.programId,
      player: golden.player,
      voucherId: golden.voucherIdHex,
      lootId: 1,
      latE6: 0,
      lngE6: 0,
      locationHint: "x".repeat(65),
      issuedAt: 10,
      expiresAt: 20,
    })
  );
  const ok = buildVoucherMessageV1({
    cluster: "localnet",
    programId: golden.programId,
    player: golden.player,
    voucherId: golden.voucherIdHex,
    lootId: 1,
    latE6: 0,
    lngE6: 0,
    locationHint: "x".repeat(64),
    issuedAt: 10,
    expiresAt: 20,
  });
  assert.equal(ok.length, 169);
});

test("cluster program id and distinct keys", () => {
  assert.throws(() => assertClusterProgramId("devnet", PROGRAM_ID_BY_CLUSTER.localnet));
  assert.doesNotThrow(() =>
    assertClusterProgramId("devnet", PROGRAM_ID_BY_CLUSTER.devnet)
  );
  const prev = {
    a: process.env.SERVER_SECRET_KEY_DEVNET,
    b: process.env.SERVER_SECRET_KEY_MAINNET,
  };
  process.env.SERVER_SECRET_KEY_DEVNET = "same-secret";
  process.env.SERVER_SECRET_KEY_MAINNET = "same-secret";
  assert.throws(() => assertDistinctClusterKeys(), /distinct/);
  process.env.SERVER_SECRET_KEY_DEVNET = "devnet-secret";
  process.env.SERVER_SECRET_KEY_MAINNET = "mainnet-secret";
  assert.doesNotThrow(() => assertDistinctClusterKeys());
  if (prev.a === undefined) delete process.env.SERVER_SECRET_KEY_DEVNET;
  else process.env.SERVER_SECRET_KEY_DEVNET = prev.a;
  if (prev.b === undefined) delete process.env.SERVER_SECRET_KEY_MAINNET;
  else process.env.SERVER_SECRET_KEY_MAINNET = prev.b;
});

test("browser claim client rebuilds the golden message", async () => {
  const solanaWeb3 = require("@solana/web3.js");
  const code = fs.readFileSync(
    path.join(__dirname, "..", "..", "frontend", "js", "modules", "claim-loot-onchain.js"),
    "utf8"
  );
  const sandbox = {
    console,
    solanaWeb3,
    crypto,
    TextEncoder,
    Uint8Array,
    Buffer,
    window: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const message = await sandbox.window.FizzClaimLoot.buildVoucherMessageV1({
    cluster: "localnet",
    programId: golden.programId,
    player: golden.player,
    voucherId: golden.voucherIdHex,
    lootId: golden.lootId,
    latE6: golden.latE6,
    lngE6: golden.lngE6,
    locationHint: golden.locationHint,
    issuedAt: golden.issuedAt,
    expiresAt: golden.expiresAt,
  });
  assert.equal(Buffer.from(message).toString("hex"), golden.messageHex);
  assert.match(sandbox.window.FizzClaimLoot.RENT_NOTE, /0\.0015/);
});

function bootLootVoucher(extraEnv) {
  return spawnSync(
    process.execPath,
    ["-e", "require('./api/loot-voucher.js')"],
    {
      cwd: path.join(__dirname, ".."),
      env: { PATH: process.env.PATH, ...extraEnv },
      encoding: "utf8",
      timeout: 15000,
    }
  );
}

test("loot-voucher refuses to load without a cluster", () => {
  const result = bootLootVoucher({});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SOLANA_CLUSTER|FIZZCAPS_PROGRAM_ID|unknown cluster/);
});

test("loot-voucher local self-check passes and a bad algorithm does not", () => {
  const kp = nacl.sign.keyPair();
  const bs58 = require("bs58");
  const encode = typeof bs58.encode === "function" ? bs58.encode : bs58.default.encode;
  const secret = encode(Buffer.from(kp.secretKey));
  const ok = bootLootVoucher({
    SOLANA_CLUSTER: "devnet",
    FIZZCAPS_PROGRAM_ID: PROGRAM_ID_BY_CLUSTER.devnet,
    [serverSecretEnv("devnet")]: secret,
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout + ok.stderr, /self-check ok/);

  const bad = bootLootVoucher({
    SOLANA_CLUSTER: "devnet",
    FIZZCAPS_PROGRAM_ID: PROGRAM_ID_BY_CLUSTER.devnet,
    [serverSecretEnv("devnet")]: secret,
    ONCHAIN_VOUCHERS: "true",
    KMS_SIGNING_ALGORITHM: "ECDSA_SHA_256",
  });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /ED25519_SHA_512/);
});

test("kms signer returns the raw 32-byte key and signs RAW ed25519", async () => {
  const {
    setKmsSdkForTests,
    setClientForTests,
    getPublicKeyFromKms,
    signMessageWithKms,
  } = require("../lib/kmsSigner");
  const raw = Buffer.alloc(32, 9);
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]);
  class SignCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class GetPublicKeyCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class KMSClient {}
  setKmsSdkForTests({ KMSClient, SignCommand, GetPublicKeyCommand });
  setClientForTests({
    send: async (cmd) => {
      if (cmd instanceof GetPublicKeyCommand) {
        return { PublicKey: der, SigningAlgorithms: ["ED25519_SHA_512"] };
      }
      if (cmd instanceof SignCommand) {
        assert.equal(cmd.input.MessageType, "RAW");
        assert.equal(cmd.input.SigningAlgorithm, "ED25519_SHA_512");
        return { Signature: Buffer.alloc(64, 4) };
      }
      throw new Error("unexpected command");
    },
  });
  const pub = await getPublicKeyFromKms("alias/test");
  const bs58 = require("bs58");
  const decode = typeof bs58.decode === "function" ? bs58.decode : bs58.default.decode;
  assert.deepEqual(Buffer.from(decode(pub.publicKeyBase58)), raw);
  const signed = await signMessageWithKms(Buffer.from("probe"), "alias/test");
  assert.equal(signed.signatureBytes.length, 64);
  setClientForTests(null);
  setKmsSdkForTests(null);
});

