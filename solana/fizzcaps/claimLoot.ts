// solana/fizzcaps/claimLoot.ts
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  Ed25519Program,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  CLAIM_LOOT_DISCRIMINATOR,
  FIZZCAPS_PROGRAM_ID,
  INSTRUCTIONS_SYSVAR_ID,
  METADATA_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  LootVoucher,
} from "./types";
import {
  deriveCapsMintPda,
  deriveLootMintAuthorityPda,
  deriveLootMintPda,
  derivePlayerCapsAta,
  derivePlayerLootAta,
} from "./pda";
import { serializeLootVoucher, serializeVoucherMessage } from "./voucher";

/**
 * Build the Ed25519 verify instruction that your program expects
 * in the instructions sysvar.
 */
export function buildEd25519VerifyIx(
  voucher: LootVoucher,
  serverPubkey: PublicKey
): TransactionInstruction {
  const message = serializeVoucherMessage(voucher);
  if (voucher.serverSignature.length !== 64) {
    throw new Error("serverSignature must be 64 bytes");
  }

  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: serverPubkey.toBytes(),
    message: message,
    signature: Buffer.from(voucher.serverSignature),
  });
}

/**
 * Build the claim_loot instruction from your IDL.
 */
export async function buildClaimLootIx(params: {
  connection: Connection;
  player: PublicKey;
  serverKey: PublicKey;
  voucher: LootVoucher;
  lootMetadata: PublicKey; // PDA for metadata account for the loot mint
}): Promise<TransactionInstruction> {
  const { player, serverKey, voucher, lootMetadata } = params;

  const lootMint = deriveLootMintPda(voucher.lootId);
  const lootMintAuthority = deriveLootMintAuthorityPda();
  const capsMint = deriveCapsMintPda();
  const playerCapsAta = await derivePlayerCapsAta(player);
  const playerLootAta = await derivePlayerLootAta(player, lootMint);

  const data = Buffer.concat([
    CLAIM_LOOT_DISCRIMINATOR,
    serializeLootVoucher(voucher),
  ]);

  const keys = [
    // 0. player
    { pubkey: player, isSigner: true, isWritable: true },
    // 1. player_caps_ata
    { pubkey: playerCapsAta, isSigner: false, isWritable: true },
    // 2. loot_mint (PDA)
    { pubkey: lootMint, isSigner: false, isWritable: true },
    // 3. player_loot_ata
    { pubkey: playerLootAta, isSigner: false, isWritable: true },
    // 4. loot_mint_authority (PDA)
    { pubkey: lootMintAuthority, isSigner: false, isWritable: false },
    // 5. caps_mint (PDA)
    { pubkey: capsMint, isSigner: false, isWritable: false },
    // 6. server_key (plain account, must match signing key)
    { pubkey: serverKey, isSigner: false, isWritable: false },
    // 7. loot_metadata
    { pubkey: lootMetadata, isSigner: false, isWritable: true },
    // 8. system_program
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    // 9. token_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    // 10. associated_token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    // 11. instructions_sysvar
    { pubkey: INSTRUCTIONS_SYSVAR_ID, isSigner: false, isWritable: false },
    // 12. metadata_program
    { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: FIZZCAPS_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * High-level helper: build full transaction with:
 * - Ed25519 verify instruction
 * - claim_loot instruction
 *
 * You still need to:
 * - create metadata PDA for lootMint
 * - set recent blockhash
 * - have the wallet sign and send
 */
export async function buildClaimLootTransaction(params: {
  connection: Connection;
  player: PublicKey;
  serverKey: PublicKey;
  voucher: LootVoucher;
  lootMetadata: PublicKey;
}): Promise<Transaction> {
  const { connection, player, serverKey, voucher, lootMetadata } = params;

  const ed25519Ix = buildEd25519VerifyIx(voucher, serverKey);
  const claimIx = await buildClaimLootIx({
    connection,
    player,
    serverKey,
    voucher,
    lootMetadata,
  });

  const tx = new Transaction();
  // Important: Ed25519 verify must come BEFORE claim_loot
  tx.add(ed25519Ix);
  tx.add(claimIx);

  const { blockhash } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.feePayer = player;

  return tx;
}
