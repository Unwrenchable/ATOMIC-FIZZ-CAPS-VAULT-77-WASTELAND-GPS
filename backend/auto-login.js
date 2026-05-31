#!/usr/bin/env node

const fs = require("fs");
const fetch = require("node-fetch");
const nacl = require("tweetnacl");
// Safe bs58 loader for Node 16–24
function loadBs58() {
  const b = require("bs58");
  if (b && typeof b.encode === "function") return b;
  if (b && b.default && typeof b.default.encode === "function") return b.default;
  throw new Error("bs58 encode not found");
}
const bs58 = loadBs58();

if (process.argv.length < 3) {
  console.error("Usage: node auto-login.js <WALLET_PUBLIC_KEY>");
  process.exit(1);
}

const wallet = process.argv[2];
const BASE = "http://localhost:3000/api/auth";

async function main() {
  console.log("🔑 Wallet:", wallet);

  // STEP 1 — GET NONCE
  console.log("📡 Requesting nonce...");
  const nonceRes = await fetch(`${BASE}/nonce/${wallet}`);
  const nonceJson = await nonceRes.json();

  if (!nonceJson.ok) {
    console.error("❌ Failed to get nonce:", nonceJson);
    process.exit(1);
  }

  const nonce = nonceJson.nonce;
  console.log("📝 Nonce:", nonce);

  // STEP 2 — SIGN MESSAGE USING LOCAL KEYPAIR FILE
  console.log("✍️ Signing message using ~/.config/solana/id.json ...");

  const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
  const keypairRaw = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const secretKey = Uint8Array.from(keypairRaw);

  const message = Buffer.from(`Atomic Fizz Caps login: ${nonce}`, "utf8");
  const signatureBytes = nacl.sign.detached(message, secretKey);
  const signature = bs58.encode(signatureBytes);

  console.log("🖋 Signature:", signature);

  // STEP 3 — VERIFY SIGNATURE
  console.log("📬 Sending signature to /verify...");
  const verifyRes = await fetch(`${BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: wallet,
      signature,
    }),
  });

  const verifyJson = await verifyRes.json();
  console.log("🔍 Verify response:", verifyJson);

  if (!verifyJson.ok) {
    console.error("❌ Login failed:", verifyJson);
    process.exit(1);
  }

  const sessionId = verifyJson.sessionId;
  console.log("🎉 SESSION ID:", sessionId);

  fs.writeFileSync("session.txt", sessionId);
  console.log("💾 Saved sessionId to session.txt");
}

main();
