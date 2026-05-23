const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bs58 = require("bs58");
const fetch = require("node-fetch");
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  Token,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const {
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID,
  createCreateMasterEditionV3Instruction,
  createCreateMetadataAccountV3Instruction,
} = require("@metaplex-foundation/mpl-token-metadata");

const MINTABLES_PATH = path.join(__dirname, "../../public/data/mintables.json");
const DEFAULT_RPC =
  process.env.SOLANA_RPC ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";
const DEFAULT_API_BASE = (
  process.env.PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_PUBLIC_URL ||
  "https://api.atomicfizzcaps.xyz"
).replace(/\/+$/, "");
const DEFAULT_FRONTEND_BASE = (
  process.env.FRONTEND_URL || "https://atomicfizzcaps.xyz"
).replace(/\/+$/, "");

let cachedMintables = null;
let cachedSigner = undefined;

function getMintables() {
  if (cachedMintables) return cachedMintables;
  const raw = fs.readFileSync(MINTABLES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  cachedMintables = Array.isArray(parsed) ? parsed : [];
  return cachedMintables;
}

function secureRandomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("invalid_random_range");
  }
  const value = crypto.randomBytes(4).readUInt32BE(0);
  return value % maxExclusive;
}

function selectMintable(requestedId) {
  const mintables = getMintables();
  if (!mintables.length) {
    throw new Error("mintables_unavailable");
  }

  if (requestedId) {
    const wanted = String(requestedId).trim().toLowerCase();
    const match = mintables.find((item) => {
      return (
        String(item.id || "").toLowerCase() === wanted ||
        String(item.name || "").toLowerCase() === wanted
      );
    });
    if (!match) throw new Error("invalid_mintable_id");
    return match;
  }

  return mintables[secureRandomInt(mintables.length)];
}

function normalizeLocationHint(value) {
  if (typeof value !== "string") return "Uncharted Wasteland";
  const trimmed = value.replace(/[^\w\s.,!-]/g, "").trim();
  return trimmed.slice(0, 120) || "Uncharted Wasteland";
}

function getServerSigner() {
  if (cachedSigner !== undefined) return cachedSigner;

  const keypairPath = process.env.REALAI_SIGNER_PATH || process.env.SERVER_KEYPAIR_PATH;
  if (keypairPath) {
    const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    cachedSigner = Keypair.fromSecretKey(Uint8Array.from(secret));
    return cachedSigner;
  }

  const base58Secret = process.env.SERVER_SECRET_KEY;
  if (base58Secret) {
    const decoded = bs58.decode(base58Secret.trim());
    if (decoded.length !== 64) {
      throw new Error(`invalid_server_secret_length:${decoded.length}`);
    }
    cachedSigner = Keypair.fromSecretKey(decoded);
    return cachedSigner;
  }

  throw new Error("mint_signer_unconfigured");
}

function hasMintSigner() {
  try {
    getServerSigner();
    return true;
  } catch {
    return false;
  }
}

function getConnection() {
  return new Connection(DEFAULT_RPC, "confirmed");
}

function buildMetadataUri(jobId) {
  return `${DEFAULT_API_BASE}/api/mint-item/metadata/${encodeURIComponent(jobId)}`;
}

async function uploadMetadataToNftStorage(metadataJson) {
  const token = process.env.NFT_STORAGE_API_KEY;
  if (!token) return null;

  const response = await fetch("https://api.nft.storage/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadataJson),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`nft_storage_upload_failed:${response.status}:${text.slice(0, 180)}`);
  }

  const json = await response.json();
  const cid = json && json.value && json.value.cid;
  if (!cid) throw new Error("nft_storage_missing_cid");
  return {
    provider: "nft.storage",
    cid,
    uri: `https://nftstorage.link/ipfs/${cid}`,
  };
}

async function uploadMetadataToPinata(metadataJson, jobId) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: {
        name: `afw-${jobId || Date.now()}-metadata`,
      },
      pinataContent: metadataJson,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`pinata_upload_failed:${response.status}:${text.slice(0, 180)}`);
  }

  const json = await response.json();
  const cid = json && json.IpfsHash;
  if (!cid) throw new Error("pinata_missing_cid");
  return {
    provider: "pinata",
    cid,
    uri: `https://gateway.pinata.cloud/ipfs/${cid}`,
  };
}

async function resolveMetadataUri(metadataJson, jobId) {
  // Prefer IPFS providers when configured; fallback to API-hosted JSON.
  // This keeps minting live even if an IPFS provider has transient failures.
  if (process.env.NFT_STORAGE_API_KEY) {
    try {
      const uploaded = await uploadMetadataToNftStorage(metadataJson);
      if (uploaded) return uploaded;
    } catch (err) {
      console.warn("[nft-minting] NFT.Storage upload failed:", err.message);
    }
  }

  if (process.env.PINATA_JWT) {
    try {
      const uploaded = await uploadMetadataToPinata(metadataJson, jobId);
      if (uploaded) return uploaded;
    } catch (err) {
      console.warn("[nft-minting] Pinata upload failed:", err.message);
    }
  }

  return {
    provider: "api",
    cid: null,
    uri: buildMetadataUri(jobId),
  };
}

function buildCollection() {
  const collectionAddress = process.env.CAPS_COLLECTION_MINT || process.env.METAPLEX_COLLECTION_ADDRESS;
  if (!collectionAddress) return null;
  try {
    return {
      verified: false,
      key: new PublicKey(collectionAddress),
    };
  } catch {
    return null;
  }
}

function buildMetadataJson(auditRecord) {
  const item = auditRecord.item || {};
  const stats = item.baseStats || {};
  const attributes = [
    { trait_type: "Rarity", value: item.rarity || "common" },
    { trait_type: "Type", value: item.type || "gear" },
    { trait_type: "Spawn POI", value: item.spawnPOI || auditRecord.locationHint || "Unknown" },
    { trait_type: "Required Level", value: String(item.levelRequirement || 1) },
    { trait_type: "Game", value: "Atomic Fizz Caps" },
  ];

  Object.keys(stats)
    .slice(0, 8)
    .forEach((key) => {
      attributes.push({
        trait_type: key,
        value: String(stats[key]),
      });
    });

  if (auditRecord.latitude != null && auditRecord.longitude != null) {
    attributes.push({
      trait_type: "Claim Coordinates",
      value: `${auditRecord.latitude},${auditRecord.longitude}`,
    });
  }

  return {
    name: item.name || "Atomic Fizz Caps Relic",
    symbol: "FIZZ",
    description:
      item.description ||
      `${item.name || "Wasteland relic"} recovered from ${auditRecord.locationHint || "the wastes"}.`,
    image: `${DEFAULT_FRONTEND_BASE}/favicon.ico`,
    external_url: `${DEFAULT_FRONTEND_BASE}/wallet`,
    attributes,
    properties: {
      category: "image",
      files: [
        {
          uri: `${DEFAULT_FRONTEND_BASE}/favicon.ico`,
          type: "image/x-icon",
        },
      ],
      creators: [],
    },
  };
}

function getMetadataAccounts(mintPublicKey) {
  const metadata = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];

  const masterEdition = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];

  return { metadata, masterEdition };
}

async function mintNftForJob(job) {
  const wallet = new PublicKey(job.wallet);
  const payer = getServerSigner();
  const connection = getConnection();
  const item = job.item || selectMintable(job.itemId || job.mintableId);
  const jobId = job.jobId || job.itemId;
  const collection = buildCollection();

  const token = await Token.createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    0,
    TOKEN_PROGRAM_ID
  );

  const ownerTokenAccount = await token.getOrCreateAssociatedAccountInfo(wallet);
  await token.mintTo(ownerTokenAccount.address, payer.publicKey, [payer], 1);

  const { metadata, masterEdition } = getMetadataAccounts(token.publicKey);
  const metadataJson = buildMetadataJson({ ...job, item });
  const metadataLocation = await resolveMetadataUri(metadataJson, jobId);
  const metadataUri = metadataLocation.uri;
  const metadataTx = new Transaction().add(
    createCreateMetadataAccountV3Instruction(
      {
        metadata,
        mint: token.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: metadataJson.name.slice(0, 32),
            symbol: metadataJson.symbol.slice(0, 10),
            uri: metadataUri,
            sellerFeeBasisPoints: 500,
            creators: null,
            collection,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      }
    ),
    createCreateMasterEditionV3Instruction(
      {
        edition: masterEdition,
        mint: token.publicKey,
        updateAuthority: payer.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        metadata,
      },
      {
        createMasterEditionArgs: {
          maxSupply: 0,
        },
      }
    )
  );

  const metadataSignature = await sendAndConfirmTransaction(connection, metadataTx, [payer], {
    commitment: "confirmed",
  });

  await token.setAuthority(token.publicKey, null, "MintTokens", payer);

  return {
    mintAddress: token.publicKey.toBase58(),
    tokenAccount: ownerTokenAccount.address.toBase58(),
    signature: metadataSignature,
    metadataUri,
    metadataProvider: metadataLocation.provider,
    metadataCid: metadataLocation.cid,
    metadataJson,
    item,
  };
}

module.exports = {
  buildMetadataJson,
  buildMetadataUri,
  getMintables,
  getServerSigner,
  hasMintSigner,
  mintNftForJob,
  normalizeLocationHint,
  selectMintable,
};