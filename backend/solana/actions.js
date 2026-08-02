"use strict";

require("dotenv").config();

const fs = require("fs");
const bs58 = require("bs58").default;
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");
const { Metaplex, keypairIdentity } = require("@metaplex-foundation/js");

// ---------------------------------------------
// SOLANA CONNECTION
// ---------------------------------------------
const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.devnet.solana.com",
  "confirmed"
);

// ---------------------------------------------
// TREASURY (CAPS DISPENSER)
// ---------------------------------------------
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.TREASURY_PRIVATE_KEY))
);

const TREASURY_PUBLIC_KEY = treasury.publicKey.toBase58();

// ---------------------------------------------
// REWARD SIGNER (NFT + CAPS MINT AUTHORITY)
// ---------------------------------------------
let signer = null;

function loadSigner() {
  if (signer) return signer;

  if (process.env.SERVER_SECRET_KEY) {
    const decoded = bs58.decode(process.env.SERVER_SECRET_KEY.trim());
    signer = Keypair.fromSecretKey(Uint8Array.from(decoded));
  } else if (process.env.REALAI_SIGNER_PATH) {
    const raw = fs.readFileSync(process.env.REALAI_SIGNER_PATH, "utf8");
    signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } else {
    throw new Error("No signer configured: set SERVER_SECRET_KEY or REALAI_SIGNER_PATH");
  }

  return signer;
}

// ---------------------------------------------
// MINT ADDRESSES
// ---------------------------------------------
const CAPS_MINT = new PublicKey(process.env.CAPS_MINT);
const COLLECTION_MINT = new PublicKey(process.env.CAPS_COLLECTION_MINT);

// ---------------------------------------------
// CAPS TOKEN MINTING
// ---------------------------------------------
async function mintCAPS(toPubkey, amount) {
  const destination = new PublicKey(toPubkey);
  const signerKeypair = loadSigner();

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    signerKeypair,
    CAPS_MINT,
    destination
  );

  const signature = await mintTo(
    connection,
    signerKeypair,
    CAPS_MINT,
    ata.address,
    signerKeypair,
    amount * 1_000_000_000
  );

  return { signature, amount };
}

// ---------------------------------------------
// NFT MINTING (FizzCap Collection)
// ---------------------------------------------
async function mintFizzCapNFT(toPubkey, name, description) {
  const signerKeypair = loadSigner();

  const metaplex = Metaplex.make(connection).use(
    keypairIdentity(signerKeypair)
  );

  const { nft } = await metaplex.nfts().create({
    uri: "https://arweave.net/default-survivor-metadata.json",
    name,
    symbol: "FIZZCAP",
    sellerFeeBasisPoints: 500,
    collection: COLLECTION_MINT,
  });

  return {
    mint: nft.address.toString(),
    name,
  };
}

module.exports = {
  connection,
  treasury,
  TREASURY_PUBLIC_KEY,
  get signer() {
    return loadSigner();
  },
  CAPS_MINT,
  COLLECTION_MINT,
  mintCAPS,
  mintFizzCapNFT,
};
