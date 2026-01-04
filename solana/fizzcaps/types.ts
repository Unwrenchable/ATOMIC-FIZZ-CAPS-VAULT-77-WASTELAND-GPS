// solana/fizzcaps/types.ts
import { PublicKey } from "@solana/web3.js";

export const FIZZCAPS_PROGRAM_ID = new PublicKey(
  "H6ZtQY3p5rvE3S5ogkkR7vHJH5VYzTc8BTvZ5UAJ7DCB"
);

// claim_loot discriminator from your IDL
export const CLAIM_LOOT_DISCRIMINATOR = Buffer.from([
  69, 105, 8, 13, 65, 21, 85, 238,
]);

export type LootVoucher = {
  lootId: bigint;         // u64
  latitude: number;       // f64
  longitude: number;      // f64
  timestamp: bigint;      // i64
  locationHint: string;   // string
  serverSignature: Uint8Array; // [u8; 64]
};

export type UnsignedLootVoucher = Omit<LootVoucher, "serverSignature">;

// Known program IDs from the IDL
export const SYSTEM_PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111"
);
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
export const INSTRUCTIONS_SYSVAR_ID = new PublicKey(
  "Sysvar1nstructions1111111111111111111111111"
);
export const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// The server_key account is just a Pubkey provided at runtime.
// It must match the pubkey that actually signed the voucher.
