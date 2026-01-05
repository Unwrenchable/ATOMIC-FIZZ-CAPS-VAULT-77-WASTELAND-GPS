import { PublicKey } from "@solana/web3.js";
import {
  FIZZCAPS_PROGRAM_ID,
} from "./types";
import { getAssociatedTokenAddress } from "@solana/spl-token";
/**
 * caps_mint PDA
 * Seeds: ["caps-mint"]
 */
export function deriveCapsMintPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("caps-mint", "utf8")],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

/**
 * loot_mint PDA
 * IDL: seeds const "loot-mint-auth" + arg voucher.loot_id (u64)
 *
 * Note: on-chain this PDA is used as the loot_mint account.
 */
export function deriveLootMintPda(lootId: bigint): PublicKey {
  const lootIdBuf = Buffer.alloc(8);
  lootIdBuf.writeBigUInt64LE(lootId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loot-mint-auth", "utf8"), lootIdBuf],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

/**
 * loot_mint_authority PDA
 * IDL: seeds const "loot-mint-auth"
 */
export function deriveLootMintAuthorityPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loot-mint-auth", "utf8")],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

/**
 * Associated token account for any (owner, mint) pair.
 * Used for player_caps_ata and player_loot_ata.
 */
export function deriveAta(
  owner: PublicKey,
  mint: PublicKey
): PublicKey {
  return getAssociatedTokenAddress(mint, owner);
}

