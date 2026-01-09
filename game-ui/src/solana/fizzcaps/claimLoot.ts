// solana/fizzcaps/claimLoot.ts
import {
  Ed25519Program,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
    CLAIM_LOOT_DISCRIMINATOR,
    FIZZCAPS_PROGRAM_ID,
    SYSTEM_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    INSTRUCTIONS_SYSVAR_ID,
    METADATA_PROGRAM_ID,
} from "./types";

/**
 * Params for building both Ed25519 + claim_loot instructions.
 */
export type BuildClaimLootIxParams = {
  player: PublicKey;
  playerCapsAta: PublicKey;
  lootMint: PublicKey;
  playerLootAta: PublicKey;
  lootMintAuthority: PublicKey;
  capsMint: PublicKey;
  serverKey: PublicKey;
  lootMetadata: PublicKey;      // Metaplex metadata PDA for lootMint
  voucherData: Uint8Array;      // full Borsh LootVoucher (includes signature)
  voucherMessage: Uint8Array;   // unsigned message that was signed
};

/**
 * Build:
 * 1) Ed25519 verify ix (server_key, server_signature, message)
 * 2) fizzcaps::claim_loot ix with voucher arg
 */
export function buildClaimLootInstructions(
  params: BuildClaimLootIxParams
): TransactionInstruction[] {
  const {
    player,
    playerCapsAta,
    lootMint,
    playerLootAta,
    lootMintAuthority,
    capsMint,
    serverKey,
    lootMetadata,
    voucherData,
    voucherMessage,
  } = params;

  if (voucherData.length < 64) {
    throw new Error("voucherData too short to contain server_signature");
  }

  // server_signature is last 64 bytes of the Borsh struct
  const serverSignature = voucherData.slice(voucherData.length - 64);

  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: serverKey.toBytes(),
    message: voucherMessage,
    signature: serverSignature,
  });

  const claimIx = buildClaimLootInstruction({
    player,
    playerCapsAta,
    lootMint,
    playerLootAta,
    lootMintAuthority,
    capsMint,
    serverKey,
    lootMetadata,
    voucherData,
  });

  return [ed25519Ix, claimIx];
}

/**
 * Low-level fizzcaps::claim_loot instruction builder.
 * Matches the accounts + args order in your IDL.
 */
export function buildClaimLootInstruction(params: {
  player: PublicKey;
  playerCapsAta: PublicKey;
  lootMint: PublicKey;
  playerLootAta: PublicKey;
  lootMintAuthority: PublicKey;
  capsMint: PublicKey;
  serverKey: PublicKey;
  lootMetadata: PublicKey;
  voucherData: Uint8Array;
}): TransactionInstruction {
  const {
    player,
    playerCapsAta,
    lootMint,
    playerLootAta,
    lootMintAuthority,
    capsMint,
    serverKey,
    lootMetadata,
    voucherData,
  } = params;

  // data = discriminator (8 bytes) + Borsh LootVoucher
  const data = new Uint8Array(
    CLAIM_LOOT_DISCRIMINATOR.length + voucherData.length
  );
  data.set(CLAIM_LOOT_DISCRIMINATOR, 0);
  data.set(voucherData, CLAIM_LOOT_DISCRIMINATOR.length);

  const keys = [
    { pubkey: player, isSigner: true, isWritable: true },              // player
    { pubkey: playerCapsAta, isSigner: false, isWritable: true },      // player_caps_ata
    { pubkey: lootMint, isSigner: false, isWritable: true },           // loot_mint (PDA)
    { pubkey: playerLootAta, isSigner: false, isWritable: true },      // player_loot_ata
    { pubkey: lootMintAuthority, isSigner: false, isWritable: false }, // loot_mint_authority (PDA)
    { pubkey: capsMint, isSigner: false, isWritable: false },          // caps_mint (PDA)
    { pubkey: serverKey, isSigner: false, isWritable: false },         // server_key
    { pubkey: lootMetadata, isSigner: false, isWritable: true },       // loot_metadata
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // system_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },  // token_program
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },                                                                 // associated_token_program
    { pubkey: INSTRUCTIONS_SYSVAR_ID, isSigner: false, isWritable: false }, // instructions_sysvar
    { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },    // metadata_program
  ];

  return new TransactionInstruction({
    programId: FIZZCAPS_PROGRAM_ID,
    keys,
    data,
  });
}
