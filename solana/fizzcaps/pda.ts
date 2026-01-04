// solana/fizzcaps/pda.ts
import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  FIZZCAPS_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./types";
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Seed prefixes from your IDL
const CAPS_MINT_SEED = Buffer.from("caps-mint", "utf8");
const LOOT_MINT_AUTH_SEED = Buffer.from("loot-mint-auth", "utf8");

/**
 * CAPS mint PDA
 * seeds: ["caps-mint"]
 */
export function deriveCapsMintPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CAPS_MINT_SEED],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

/**
 * Loot mint PDA
 * seeds: ["loot-mint-auth", loot_id (u64 LE)]
 *
 * Note: The IDL shows loot_mint as a PDA using this seed and the LootVoucher.loot_id arg.
 */
export function deriveLootMintPda(lootId: bigint): PublicKey {
  const lootIdBuf = Buffer.alloc(8);
  lootIdBuf.writeBigUInt64LE(lootId);

  const [pda] = PublicKey.findProgramAddressSync(
    [LOOT_MINT_AUTH_SEED, lootIdBuf],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

/**
 * Loot mint authority PDA
 * seeds: ["loot-mint-auth"]
 */
export function deriveLootMintAuthorityPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [LOOT_MINT_AUTH_SEED],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

/**
 * Player CAPS ATA (standard SPL ATA)
 */
export async function derivePlayerCapsAta(
  player: PublicKey
): Promise<PublicKey> {
  const capsMint = deriveCapsMintPda();
  return getAssociatedTokenAddress(capsMint, player, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

/**
 * Player loot ATA (standard SPL ATA for the loot mint)
 */
export async function derivePlayerLootAta(
  player: PublicKey,
  lootMint: PublicKey
): Promise<PublicKey> {
  return getAssociatedTokenAddress(lootMint, player, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}
