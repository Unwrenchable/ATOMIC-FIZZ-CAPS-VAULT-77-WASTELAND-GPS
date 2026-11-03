/**
 * Claim a Fizz cache on-chain.
 * Message layout is a copy of backend/lib/voucherV1.js. Keep them identical.
 * Canonical builder: backend/lib/voucherV1.js. This file exists because the
 * wallet page has no bundler.
 *
 * Transaction order: optional compute-budget, create mint, init mint,
 * player loot ATA, Ed25519, claim_loot. Nothing may sit between Ed25519 and
 * claim_loot. Two PDAs (voucher-claim and loot-claim) each take ~0.0015 SOL.
 */
/* global splToken */
(function () {
  "use strict";

  if (typeof solanaWeb3 === "undefined") {
    console.warn("[claim-loot] solanaWeb3 missing; claim client not installed");
    return;
  }

  const web3 = solanaWeb3;
  const TOKEN_PROGRAM_ID = new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const INSTRUCTIONS_SYSVAR = new web3.PublicKey("Sysvar1nstructions1111111111111111111111111");
  const MINT_SIZE = 82;
  const PROGRAM_ID_BY_CLUSTER = {
    "mainnet-beta": "DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP",
    devnet: "GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc",
    localnet: "HnWTnCKuKhJa6cXj4ZocW2D8Jtf4f5QFb6f6UnkF27FB",
  };
  const CLUSTER_TAG = { "mainnet-beta": 1, devnet: 2, localnet: 3 };
  const DOMAIN = new Uint8Array([
    70, 73, 90, 90, 67, 65, 80, 83, 58, 76, 79, 79, 84, 95, 86, 79, 85, 67, 72, 69, 82, 58, 118, 49,
  ]);
  const CLAIM_LOOT_DISC = new Uint8Array([69, 105, 8, 13, 65, 21, 85, 238]);
  const RENT_NOTE =
    "Two claim accounts (voucher + loot id) each lock about 0.0015 SOL of rent. FizzTec is not responsible for rent you forget to reclaim, citizen.";

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function u32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value, true);
    return out;
  }

  function u64(value) {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
    return out;
  }

  function i32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setInt32(0, Number(value), true);
    return out;
  }

  function i64(value) {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigInt64(0, BigInt(value), true);
    return out;
  }

  async function sha256(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(digest);
  }

  async function buildVoucherMessageV1(fields) {
    const tag = CLUSTER_TAG[fields.cluster];
    if (!tag) throw new Error("unknown cluster");
    const hint = new TextEncoder().encode(String(fields.locationHint));
    if (hint.length > 64) throw new Error("location hint longer than 64 bytes");
    const voucherId = hexToBytes(fields.voucherId);
    if (voucherId.length !== 16) throw new Error("voucherId");
    const message = concatBytes([
      DOMAIN,
      new Uint8Array([tag]),
      new web3.PublicKey(fields.programId).toBytes(),
      new web3.PublicKey(fields.player).toBytes(),
      voucherId,
      u64(fields.lootId),
      i32(fields.latE6),
      i32(fields.lngE6),
      await sha256(hint),
      i64(fields.issuedAt),
      i64(fields.expiresAt),
    ]);
    if (message.length !== 169) throw new Error("layout drift");
    return message;
  }

  function base64ToBytes(value) {
    const bin = atob(value);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function hexToBytes(hex) {
    const clean = String(hex).replace(/^0x/, "");
    if (clean.length % 2 !== 0) throw new Error("hex");
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function encodeVoucher(voucher) {
    const hint = new TextEncoder().encode(String(voucher.locationHint));
    const voucherId = hexToBytes(voucher.voucherId);
    return concatBytes([
      CLAIM_LOOT_DISC,
      voucherId,
      u64(voucher.lootId),
      i32(voucher.latE6),
      i32(voucher.lngE6),
      u32(hint.length),
      hint,
      i64(voucher.issuedAt),
      i64(voucher.expiresAt),
    ]);
  }

  function derivePda(programId, seeds) {
    return web3.PublicKey.findProgramAddressSync(seeds, programId)[0];
  }

  function associatedTokenAddress(mint, owner) {
    return web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
  }

  /**
   * Build the claim transaction. `signature` is the 64-byte server signature
   * (base64 or bytes) over buildVoucherMessageV1(voucher fields).
   */
  async function buildClaimTransaction(params) {
    const cluster = params.cluster;
    const programId = new web3.PublicKey(
      params.programId || PROGRAM_ID_BY_CLUSTER[cluster]
    );
    const player = new web3.PublicKey(params.player);
    const capsMint = new web3.PublicKey(params.capsMint);
    const lootMint = params.lootMintKeypair;
    if (!lootMint || !lootMint.publicKey) throw new Error("lootMintKeypair required");
    const serverPubkey = new web3.PublicKey(params.serverPubkey);
    const signature =
      typeof params.signature === "string"
        ? base64ToBytes(params.signature)
        : new Uint8Array(params.signature);
    if (signature.length !== 64) throw new Error("signature must be 64 bytes");

    const message = await buildVoucherMessageV1({
      cluster,
      programId: programId.toBase58(),
      player: player.toBase58(),
      voucherId: params.voucher.voucherId,
      lootId: params.voucher.lootId,
      latE6: params.voucher.latE6,
      lngE6: params.voucher.lngE6,
      locationHint: params.voucher.locationHint,
      issuedAt: params.voucher.issuedAt,
      expiresAt: params.voucher.expiresAt,
    });

    const config = derivePda(programId, [new TextEncoder().encode("fizz-config")]);
    const lootMintAuthority = derivePda(programId, [new TextEncoder().encode("loot-mint-auth")]);
    const voucherClaim = derivePda(programId, [
      new TextEncoder().encode("voucher-claim"),
      hexToBytes(params.voucher.voucherId),
    ]);
    const lootClaim = derivePda(programId, [
      new TextEncoder().encode("loot-claim"),
      u64(params.voucher.lootId),
    ]);
    const metadata = derivePda(METADATA_PROGRAM_ID, [
      new TextEncoder().encode("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      lootMint.publicKey.toBuffer(),
    ]);
    const masterEdition = derivePda(METADATA_PROGRAM_ID, [
      new TextEncoder().encode("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      lootMint.publicKey.toBuffer(),
      new TextEncoder().encode("edition"),
    ]);
    const playerCapsAta = associatedTokenAddress(capsMint, player);
    const playerLootAta = associatedTokenAddress(lootMint.publicKey, player);

    const tx = new web3.Transaction();
    if (params.computeUnits !== 0) {
      const units = params.computeUnits || 400000;
      tx.add(web3.ComputeBudgetProgram.setComputeUnitLimit({ units }));
    }
    const lamports = await params.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    tx.add(
      web3.SystemProgram.createAccount({
        fromPubkey: player,
        newAccountPubkey: lootMint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    if (typeof splToken !== "undefined" && splToken.createInitializeMintInstruction) {
      tx.add(
        splToken.createInitializeMintInstruction(
          lootMint.publicKey,
          0,
          lootMintAuthority,
          lootMintAuthority,
          TOKEN_PROGRAM_ID
        )
      );
      tx.add(
        splToken.createAssociatedTokenAccountInstruction(
          player,
          playerLootAta,
          player,
          lootMint.publicKey
        )
      );
    } else {
      throw new Error("splToken is required to initialize the loot mint");
    }

    tx.add(
      web3.Ed25519Program.createInstructionWithPublicKey({
        publicKey: serverPubkey.toBytes(),
        message,
        signature,
      })
    );

    const keys = [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: capsMint, isSigner: false, isWritable: true },
      { pubkey: playerCapsAta, isSigner: false, isWritable: true },
      { pubkey: lootMint.publicKey, isSigner: false, isWritable: true },
      { pubkey: playerLootAta, isSigner: false, isWritable: true },
      { pubkey: lootMintAuthority, isSigner: false, isWritable: false },
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: masterEdition, isSigner: false, isWritable: true },
      { pubkey: voucherClaim, isSigner: false, isWritable: true },
      { pubkey: lootClaim, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
    ];
    tx.add(new web3.TransactionInstruction({
      programId,
      keys,
      data: encodeVoucher(params.voucher),
    }));

    const edIndex = tx.instructions.length - 2;
    const claimIndex = tx.instructions.length - 1;
    if (tx.instructions[claimIndex].programId.equals(programId) !== true) {
      throw new Error("claim instruction was not last");
    }
    if (!tx.instructions[edIndex].programId.equals(web3.Ed25519Program.programId)) {
      throw new Error("Ed25519 instruction must sit immediately before claim_loot");
    }

    return {
      transaction: tx,
      signers: [lootMint],
      rentNote: RENT_NOTE,
      accounts: {
        config,
        lootMintAuthority,
        voucherClaim,
        lootClaim,
        metadata,
        masterEdition,
        playerCapsAta,
        playerLootAta,
      },
    };
  }

  const api = {
    buildVoucherMessageV1,
    buildClaimTransaction,
    RENT_NOTE,
    PROGRAM_ID_BY_CLUSTER,
    CLAIM_LOOT_DISC,
  };
  if (typeof window !== "undefined") window.FizzClaimLoot = api;
})();
