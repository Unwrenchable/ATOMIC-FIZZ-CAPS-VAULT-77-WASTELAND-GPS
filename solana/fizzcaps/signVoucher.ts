// server/fizzcaps/signVoucher.ts
import nacl from "tweetnacl";
import { UnsignedLootVoucher, LootVoucher } from "../../solana/fizzcaps/types";
import { serializeVoucherMessage } from "../../solana/fizzcaps/voucher";

/**
 * Load server keypair however you store it.
 * This example assumes a 64-byte secret key in base64 in env.
 */
function loadServerKeypair(): nacl.SignKeyPair {
  const secretKeyB64 = process.env.FIZZCAPS_SERVER_SECRET_KEY_BASE64;
  if (!secretKeyB64) {
    throw new Error("FIZZCAPS_SERVER_SECRET_KEY_BASE64 not set");
  }
  const secretKey = Buffer.from(secretKeyB64, "base64");
  if (secretKey.length !== 64) {
    throw new Error("Expected 64-byte Ed25519 secret key");
  }
  const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
  return keypair;
}

/**
 * Server: create a LootVoucher, sign it, and return the full struct.
 */
export function signLootVoucher(unsigned: UnsignedLootVoucher): LootVoucher {
  const keypair = loadServerKeypair();
  const message = serializeVoucherMessage(unsigned);
  const signature = nacl.sign.detached(new Uint8Array(message), keypair.secretKey);

  return {
    ...unsigned,
    serverSignature: signature,
  };
}
