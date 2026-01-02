// === Terminal Reward ===
// POST /api/terminal-reward
// Body: { wallet: string (Solana address), amount: integer (tokens, in smallest unit) }
// Enforces cooldown per wallet via Redis and transfers SPL tokens from GAME_VAULT to recipient.

const { Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");

app.post(
  "/api/terminal-reward",
  [
    body("wallet").isString().notEmpty(),
    body("amount").isInt({ min: 1 }),
  ],
  async (req, res) => {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid request", details: errors.array() });
    }

    const wallet = req.body.wallet;
    const amount = Number(req.body.amount);

    // Validate wallet is a valid Solana public key
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(wallet);
    } catch (e) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Cooldown key per wallet
    const cooldownKey = `terminal:cooldown:${wallet}`;

    try {
      // Check cooldown (use SET NX with expiry to atomically claim)
      // If key exists, deny
      const cooldownExists = await redis.get(cooldownKey);
      if (cooldownExists) {
        return res.status(429).json({ error: "Cooldown active. Try again later." });
      }

      // Reserve cooldown immediately (so concurrent requests are blocked)
      // Use SET with NX and EX to avoid race conditions
      const setOk = await redis.set(cooldownKey, "1", "NX", "EX", COOLDOWN);
      if (!setOk) {
        return res.status(429).json({ error: "Cooldown active. Try again later." });
      }

      // Ensure GAME_VAULT has an associated token account for the mint
      // and check balance before attempting transfer
      const vaultAta = await getOrCreateAssociatedTokenAccount(
        connection,
        GAME_VAULT, // payer / signer
        MINT_PUBKEY,
        GAME_VAULT.publicKey
      );

      // Check vault balance
      const vaultBalance = Number(vaultAta.amount || 0);
      if (vaultBalance < amount) {
        // release cooldown early if insufficient funds
        await redis.del(cooldownKey);
        return res.status(400).json({ error: "Vault has insufficient token balance" });
      }

      // Ensure recipient associated token account exists (create if missing)
      const recipientAta = await getOrCreateAssociatedTokenAccount(
        connection,
        GAME_VAULT, // payer for ATA creation (GAME_VAULT pays fees)
        MINT_PUBKEY,
        recipientPubkey
      );

      // Build transfer instruction
      const transferIx = createTransferInstruction(
        vaultAta.address, // source ATA
        recipientAta.address, // destination ATA
        GAME_VAULT.publicKey, // owner of source ATA
        BigInt(amount) // amount as BigInt for safety
      );

      // Build transaction
      const tx = new Transaction().add(transferIx);
      tx.feePayer = GAME_VAULT.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign and send transaction using GAME_VAULT Keypair
      const signedTx = await tx.sign([GAME_VAULT]);
      const rawTx = signedTx.serialize();

      const txSig = await connection.sendRawTransaction(rawTx, { skipPreflight: false, preflightCommitment: "confirmed" });
      await connection.confirmTransaction(txSig, "confirmed");

      // Optionally: update any server-side player state (e.g., add caps) in Redis
      // Example: increment a "caps" field for the player (if you track it)
      try {
        const playerKey = `player:${wallet}`;
        const raw = await redis.get(playerKey);
        if (raw) {
          const pd = JSON.parse(raw);
          pd.caps = (pd.caps || 0) + amount;
          await redis.set(playerKey, JSON.stringify(pd));
        }
      } catch (e) {
        // Non-fatal: log but don't fail the transfer
        console.warn("Failed to update player caps in Redis:", e);
      }

      // Success response (do not leak private keys)
      return res.json({
        success: true,
        tx: txSig,
        message: "Reward transferred. Transaction confirmed.",
      });
    } catch (err) {
      // On error, ensure cooldown is removed so user can retry (unless you prefer to keep it)
      try { await redis.del(cooldownKey); } catch (e) { /* ignore */ }

      console.error("Terminal reward error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);
