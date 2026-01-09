import { createSolanaRpc, devnet } from "@solana/rpc";
import { Address } from "@solana/addresses";

// Create RPC client
export const rpc = createSolanaRpc(
  devnet(process.env.SOLANA_RPC || "https://api.devnet.solana.com")
);

// Validate GAME_VAULT env var
const vaultEnv = process.env.GAME_VAULT;
if (!vaultEnv) {
  throw new Error("Missing environment variable: GAME_VAULT");
}

// Export validated vault address
export const VAULT = Address.fromString(vaultEnv);
