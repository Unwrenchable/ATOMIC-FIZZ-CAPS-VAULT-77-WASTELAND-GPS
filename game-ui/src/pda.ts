import { PublicKey } from "@solana/web3.js";
import { FIZZCAPS_PROGRAM_ID } from "../client";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export function deriveLootMintPda(lootId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loot_mint"), Buffer.from(lootId)],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

export function derivePlayerPda(player: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), player.toBuffer()],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

export function deriveVoucherPda(voucherId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("voucher"), Buffer.from(voucherId)],
    FIZZCAPS_PROGRAM_ID
  );
  return pda;
}

export async function derivePlayerLootAta(
  player: PublicKey,
  lootMint: PublicKey
) {
  return getAssociatedTokenAddress(lootMint, player);
}
