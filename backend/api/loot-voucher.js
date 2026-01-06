// backend/api/loot-voucher.js
const router = require("express").Router();
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const { serializeVoucherMessage } = require("../lib/gps");

const SERVER_SECRET_KEY = bs58.decode(process.env.SERVER_SECRET_KEY);
const SERVER_KEYPAIR = nacl.sign.keyPair.fromSecretKey(SERVER_SECRET_KEY);

router.post("/api/loot-voucher", (req, res) => {
  try {
    // For now, static loot; later tie to world/POIs
    const lootId = 1n;
    const latitude = 36.1699;
    const longitude = -115.1398;
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const locationHint = "Vault 77 — Sector C";

    const unsignedVoucher = {
      lootId,
      latitude,
      longitude,
      timestamp,
      locationHint,
    };

    const message = serializeVoucherMessage(unsignedVoucher);
    const signature = nacl.sign.detached(message, SERVER_KEYPAIR.secretKey);

    res.json({
      lootId: lootId.toString(),
      latitude,
      longitude,
      timestamp: timestamp.toString(),
      locationHint,
      serverSignature: Array.from(signature),
      serverKey: bs58.encode(SERVER_KEYPAIR.publicKey),
    });
  } catch (err) {
    console.error("Voucher error:", err);
    res.status(500).send("Failed to generate voucher");
  }
});

module.exports = router;