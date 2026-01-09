// solana/fizzcaps/client.ts
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import type { LootVoucher } from "./types";
import {
  serializeLootVoucher,
  serializeVoucherMessage,
} from "./voucher";
import {
  deriveCapsMintPda,
  deriveLootMintPda,
  deriveLootMintAuthorityPda,
  deriveAta,
} from "./pda";
import { buildClaimLootInstructions } from "./claimLoot";
import { METADATA_PROGRAM_ID } from "./types";

/**
 * Derive Metaplex metadata PDA for a mint.
 *
 * seeds: ["metadata", metadata_program_id, mint]
 */
export function deriveMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata", "utf8"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return pda;
}

export type BuildClaimLootTxParams = {
  connection: Connection;
  player: PublicKey;
  serverKey: PublicKey;
  voucher: LootVoucher;
};

/**
 * High-level helper:
 * - derives all PDAs
 * - builds Ed25519 + claim_loot instructions
 * - returns a ready-to-sign Transaction
 */
export async function buildClaimLootTransaction(
  params: BuildClaimLootTxParams
): Promise<Transaction> {
  const { connection, player, serverKey, voucher } = params;

  const capsMint = deriveCapsMintPda();
  const lootMint = deriveLootMintPda(voucher.lootId);
  const lootMintAuthority = deriveLootMintAuthorityPda();

  const playerCapsAta = await deriveAta(player, capsMint);
  const playerLootAta = await deriveAta(player, lootMint);

  const lootMetadata = deriveMetadataPda(lootMint);

  const voucherMessage = serializeVoucherMessage({
    lootId: voucher.lootId,
    latitude: voucher.latitude,
    longitude: voucher.longitude,
    timestamp: voucher.timestamp,
    locationHint: voucher.locationHint,
  });

  const voucherData = serializeLootVoucher(voucher);

  const ixs = buildClaimLootInstructions({
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
  });

  const tx = new Transaction();
  tx.add(...ixs);

  tx.feePayer = player;
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;

  return tx;
}
