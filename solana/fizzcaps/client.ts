// solana/fizzcaps/client.ts

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { LootVoucher, METADATA_PROGRAM_ID } from "./types";
import { deriveLootMintPda } from "./pda";
import { buildClaimLootTransaction } from "./claimLoot";

/**
 * Derive the Metadata PDA for the loot mint.
 * Standard Metaplex Metadata PDA:
 * seeds: ["metadata", metadata_program_id, mint]
 */
export function deriveMetadataPdaForLootMint(
  lootMint: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      lootMint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return pda;
}

/**
 * Build and prepare the full claim_loot transaction:
 * - Derives loot mint PDA
 * - Derives metadata PDA
 * - Adds Ed25519 verify instruction
 * - Adds claim_loot instruction
 */
export async function buildAndPrepareClaimLootTx(params: {
  connection: Connection;
  player: PublicKey;
  serverKey: PublicKey;
  voucher: LootVoucher;
}): Promise<Transaction> {
  const lootMint = deriveLootMintPda(params.voucher.lootId);
  const lootMetadata = deriveMetadataPdaForLootMint(lootMint);

  const tx = await buildClaimLootTransaction({
    connection: params.connection,
    player: params.player,
    serverKey: params.serverKey,
    voucher: params.voucher,
    lootMetadata,
  });

  return tx;
}
