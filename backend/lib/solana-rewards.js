"use strict";

const fs = require("fs");
const bs58 = require("bs58");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { Token, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

const DEFAULT_RPC =
  process.env.SOLANA_RPC ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";
const DEFAULT_COMMITMENT = process.env.SOLANA_COMMITMENT || "confirmed";

let cachedConnection = null;
let cachedSigner;
let cachedCapsMint;

function getConnection() {
  if (!cachedConnection) {
    cachedConnection = new Connection(DEFAULT_RPC, DEFAULT_COMMITMENT);
  }
  return cachedConnection;
}

function loadSecretKeyFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error("invalid_signer_keypair_file");
  }
  return Uint8Array.from(parsed);
}

function getRewardSigner() {
  if (cachedSigner !== undefined) {
    return cachedSigner;
  }

  const signerPath = process.env.REALAI_SIGNER_PATH || process.env.SERVER_KEYPAIR_PATH;
  if (signerPath) {
    cachedSigner = Keypair.fromSecretKey(loadSecretKeyFromFile(signerPath));
    return cachedSigner;
  }

  const base58Secret = process.env.SERVER_SECRET_KEY;
  if (base58Secret) {
    const decoded = bs58.decode(String(base58Secret).trim());
    if (decoded.length !== 64) {
      throw new Error("invalid_server_secret_length");
    }
    cachedSigner = Keypair.fromSecretKey(decoded);
    return cachedSigner;
  }

  throw new Error("reward_signer_unconfigured");
}

function hasRewardSigner() {
  try {
    return !!getRewardSigner();
  } catch {
    return false;
  }
}

function getCapsMintPublicKey() {
  if (cachedCapsMint) {
    return cachedCapsMint;
  }

  const mintAddress = process.env.CAPS_MINT || process.env.TOKEN_MINT;
  if (!mintAddress) {
    throw new Error("caps_mint_unconfigured");
  }

  cachedCapsMint = new PublicKey(mintAddress);
  return cachedCapsMint;
}

function getCapsTokenClient() {
  return new Token(
    getConnection(),
    getCapsMintPublicKey(),
    TOKEN_PROGRAM_ID,
    getRewardSigner()
  );
}

function getCapsDecimals() {
  const parsed = Number.parseInt(process.env.CAPS_TOKEN_DECIMALS || "9", 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) {
    throw new Error("invalid_caps_token_decimals");
  }
  return parsed;
}

function toRawAmount(amountTokens) {
  if (!Number.isFinite(amountTokens) || amountTokens <= 0) {
    throw new Error("invalid_caps_amount");
  }

  const scale = 10 ** getCapsDecimals();
  const rawAmount = Math.round(amountTokens * scale);
  if (!Number.isSafeInteger(rawAmount) || rawAmount <= 0) {
    throw new Error("invalid_caps_raw_amount");
  }

  return rawAmount;
}

async function transferCapsTokens(destinationWallet, amountTokens) {
  if (!destinationWallet || typeof destinationWallet !== "string") {
    throw new Error("invalid_destination_wallet");
  }

  const destination = new PublicKey(destinationWallet);
  const signer = getRewardSigner();
  const token = getCapsTokenClient();
  const rawAmount = toRawAmount(amountTokens);

  const sourceAccount = await token.getOrCreateAssociatedAccountInfo(signer.publicKey);
  const destinationAccount = await token.getOrCreateAssociatedAccountInfo(destination);
  const sourceBalance = await getConnection().getTokenAccountBalance(sourceAccount.address);
  const available = Number.parseInt(sourceBalance.value.amount, 10);

  if (!Number.isFinite(available) || available < rawAmount) {
    throw new Error("insufficient_treasury_caps");
  }

  const signature = await token.transfer(
    sourceAccount.address,
    destinationAccount.address,
    signer.publicKey,
    [signer],
    rawAmount
  );

  return {
    ok: true,
    signature,
    amount: amountTokens,
    rawAmount,
    mint: getCapsMintPublicKey().toBase58(),
    sourceTokenAccount: sourceAccount.address.toBase58(),
    destinationTokenAccount: destinationAccount.address.toBase58(),
    signer: signer.publicKey.toBase58(),
  };
}

function isCapsRewardsConfigured() {
  try {
    getCapsMintPublicKey();
    getRewardSigner();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getCapsMintPublicKey,
  getConnection,
  getRewardSigner,
  hasRewardSigner,
  isCapsRewardsConfigured,
  transferCapsTokens,
};