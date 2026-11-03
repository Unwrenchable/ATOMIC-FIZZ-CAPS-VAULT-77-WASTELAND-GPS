#!/usr/bin/env node
// Print the base58 pubkey that fizz_init / fizz_set_server_key must store
// for this cluster. Does not build or send a transaction.
"use strict";

const nacl = require("tweetnacl");
const { decode, encode } = require("../lib/safe-base58");
const {
  assertClusterProgramId,
  serverSecretEnv,
  kmsKeyEnv,
} = require("../lib/voucherV1");

async function main() {
  const cluster = process.env.SOLANA_CLUSTER;
  const programId = process.env.FIZZCAPS_PROGRAM_ID;
  assertClusterProgramId(cluster, programId);

  const kmsId = process.env[kmsKeyEnv(cluster)];
  if (kmsId) {
    const { getPublicKeyFromKms } = require("../lib/kmsSigner");
    const pub = await getPublicKeyFromKms(kmsId);
    process.stdout.write(pub.publicKeyBase58 + "\n");
    return;
  }

  const name = serverSecretEnv(cluster);
  const secretEnv = process.env[name];
  if (!secretEnv) throw new Error(`${name} is not set`);
  const secret = decode(secretEnv);
  if (secret.length !== 64) throw new Error(`${name} must decode to 64 bytes`);
  const kp = nacl.sign.keyPair.fromSecretKey(secret);
  const probe = Buffer.from("fizzcaps-voucher-v1-selfcheck");
  const sig = nacl.sign.detached(probe, kp.secretKey);
  if (!nacl.sign.detached.verify(probe, sig, kp.publicKey)) {
    throw new Error("ed25519 self-check failed");
  }
  process.stdout.write(encode(Buffer.from(kp.publicKey)) + "\n");
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
