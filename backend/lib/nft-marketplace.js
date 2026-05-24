const {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const { getServerSigner } = require("./nft-minting");

const DEFAULT_RPC =
  process.env.SOLANA_RPC ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const NFT_AMOUNT = "1";
const NFT_DECIMALS = 0;
const mintInfoCache = new Map();

function getConnection() {
  return new Connection(DEFAULT_RPC, "confirmed");
}

function getSettlementMintAddress() {
  const raw =
    process.env.TOKEN_MINT ||
    process.env.CAPS_MINT;
  if (!raw) throw new Error("marketplace_settlement_mint_unconfigured");
  return raw.trim();
}

async function getMintInfo(connection, mintAddress) {
  const key = String(mintAddress);
  if (mintInfoCache.has(key)) return mintInfoCache.get(key);
  const signer = getServerSigner();
  const token = new Token(connection, new PublicKey(mintAddress), TOKEN_PROGRAM_ID, signer);
  const mintInfo = await token.getMintInfo();
  const cached = {
    decimals: mintInfo.decimals,
    supply: mintInfo.supply && mintInfo.supply.toString ? mintInfo.supply.toString() : null,
  };
  mintInfoCache.set(key, cached);
  return cached;
}

async function getAssociatedTokenAddress(mintAddress, ownerAddress) {
  return Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    new PublicKey(mintAddress),
    new PublicKey(ownerAddress)
  );
}

async function getTokenAccountBalanceOrNull(connection, accountAddress) {
  try {
    const balance = await connection.getTokenAccountBalance(new PublicKey(accountAddress));
    return balance;
  } catch {
    return null;
  }
}

async function getParsedAccountInfoOrNull(connection, address) {
  try {
    const response = await connection.getParsedAccountInfo(new PublicKey(address));
    return response && response.value ? response.value : null;
  } catch {
    return null;
  }
}

async function ensureTokenAccountExists(connection, tx, mintAddress, ownerAddress, payerAddress) {
  const ata = await getAssociatedTokenAddress(mintAddress, ownerAddress);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        new PublicKey(mintAddress),
        ata,
        new PublicKey(ownerAddress),
        new PublicKey(payerAddress)
      )
    );
  }
  return ata;
}

async function buildUnsignedTransactionBase(feePayer) {
  const connection = getConnection();
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = new PublicKey(feePayer);
  tx.recentBlockhash = latest.blockhash;
  return { connection, tx, latest };
}

function serializeUnsignedTransaction(tx) {
  return tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).toString("base64");
}

function parseUiAmountToAtomic(value, decimals) {
  const input = String(value == null ? "" : value).trim();
  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error("invalid_price_amount");
  }
  const [wholePart, fractionalPart = ""] = input.split(".");
  if (fractionalPart.length > decimals) {
    throw new Error("price_precision_exceeds_mint_decimals");
  }
  const base = 10n ** BigInt(decimals);
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt((fractionalPart + "0".repeat(decimals)).slice(0, decimals) || "0");
  return (whole * base + fraction).toString();
}

function formatAtomicAmount(amountAtomic, decimals) {
  const base = 10n ** BigInt(decimals);
  const value = BigInt(String(amountAtomic || "0"));
  const whole = value / base;
  const fraction = value % base;
  if (decimals === 0) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return padded ? `${whole.toString()}.${padded}` : whole.toString();
}

function amountFromInstruction(info) {
  if (!info) return null;
  if (info.tokenAmount && info.tokenAmount.amount != null) {
    return String(info.tokenAmount.amount);
  }
  if (info.amount != null) {
    return String(info.amount);
  }
  return null;
}

async function assertOwnerHasToken(connection, ownerAddress, mintAddress, minimumAmountAtomic) {
  const ata = await getAssociatedTokenAddress(mintAddress, ownerAddress);
  const balance = await getTokenAccountBalanceOrNull(connection, ata);
  if (!balance) {
    throw new Error("token_account_missing");
  }
  const current = BigInt(String(balance.value && balance.value.amount ? balance.value.amount : "0"));
  if (current < BigInt(String(minimumAmountAtomic))) {
    throw new Error("insufficient_token_balance");
  }
  return ata;
}

async function getMarketplaceConfig() {
  const connection = getConnection();
  const serverSigner = getServerSigner();
  const settlementMint = getSettlementMintAddress();
  const settlementMintInfo = await getMintInfo(connection, settlementMint);
  const escrowWallet = serverSigner.publicKey.toBase58();
  const escrowPaymentAta = (
    await getAssociatedTokenAddress(settlementMint, escrowWallet)
  ).toBase58();
  return {
    connection,
    serverSigner,
    escrowWallet,
    settlementMint,
    settlementDecimals: settlementMintInfo.decimals,
    escrowPaymentAta,
  };
}

async function buildListingEscrowTransaction(sellerWallet, nftMint) {
  const { connection, escrowWallet } = await getMarketplaceConfig();
  const sellerAta = await assertOwnerHasToken(connection, sellerWallet, nftMint, NFT_AMOUNT);
  const { tx } = await buildUnsignedTransactionBase(sellerWallet);
  const escrowAta = await ensureTokenAccountExists(connection, tx, nftMint, escrowWallet, sellerWallet);

  tx.add(
    Token.createTransferCheckedInstruction(
      TOKEN_PROGRAM_ID,
      sellerAta,
      new PublicKey(nftMint),
      escrowAta,
      new PublicKey(sellerWallet),
      [],
      NFT_AMOUNT,
      NFT_DECIMALS
    )
  );

  return {
    escrowWallet,
    sellerAta: sellerAta.toBase58(),
    escrowAta: escrowAta.toBase58(),
    serializedTx: serializeUnsignedTransaction(tx),
  };
}

async function buildBuyerPaymentTransaction(buyerWallet, amountAtomic) {
  const {
    connection,
    settlementMint,
    settlementDecimals,
    escrowWallet,
  } = await getMarketplaceConfig();
  const buyerAta = await assertOwnerHasToken(connection, buyerWallet, settlementMint, amountAtomic);
  const { tx } = await buildUnsignedTransactionBase(buyerWallet);
  const escrowPaymentAta = await ensureTokenAccountExists(
    connection,
    tx,
    settlementMint,
    escrowWallet,
    buyerWallet
  );

  tx.add(
    Token.createTransferCheckedInstruction(
      TOKEN_PROGRAM_ID,
      buyerAta,
      new PublicKey(settlementMint),
      escrowPaymentAta,
      new PublicKey(buyerWallet),
      [],
      amountAtomic,
      settlementDecimals
    )
  );

  return {
    buyerAta: buyerAta.toBase58(),
    escrowPaymentAta: escrowPaymentAta.toBase58(),
    settlementMint,
    settlementDecimals,
    serializedTx: serializeUnsignedTransaction(tx),
  };
}

async function verifyTransferToEscrowSignature({
  signature,
  ownerWallet,
  mintAddress,
  destinationAta,
  amountAtomic,
}) {
  const { connection } = await getMarketplaceConfig();
  const tx = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) return { ok: false, reason: "transaction_failed_or_missing" };

  const instructions = tx.transaction?.message?.instructions || [];
  const matched = instructions.some((instruction) => {
    if (!instruction || instruction.program !== "spl-token" || !instruction.parsed) return false;
    if (
      instruction.parsed.type !== "transferChecked" &&
      instruction.parsed.type !== "transfer"
    ) {
      return false;
    }
    const info = instruction.parsed.info || {};
    return (
      String(info.destination || "") === String(destinationAta) &&
      String(info.mint || mintAddress) === String(mintAddress) &&
      String(info.authority || info.multisigAuthority || "") === String(ownerWallet) &&
      amountFromInstruction(info) === String(amountAtomic)
    );
  });

  if (!matched) {
    return { ok: false, reason: "expected_transfer_not_found" };
  }

  const balance = await getTokenAccountBalanceOrNull(connection, destinationAta);
  if (!balance) {
    return { ok: false, reason: "escrow_account_missing_after_transfer" };
  }
  if (BigInt(String(balance.value.amount || "0")) < BigInt(String(amountAtomic))) {
    return { ok: false, reason: "escrow_balance_too_low" };
  }

  return { ok: true, tx };
}

async function settleEscrowedTrade(trade, buyerWallet) {
  const {
    connection,
    serverSigner,
    settlementMint,
    settlementDecimals,
  } = await getMarketplaceConfig();
  const nftMint = new PublicKey(trade.nftMint);
  const escrowNftAta = new PublicKey(trade.escrowAta);
  const escrowPaymentAta = new PublicKey(trade.escrowPaymentAta);
  const sellerWallet = trade.seller;
  const { tx } = await buildUnsignedTransactionBase(serverSigner.publicKey.toBase58());

  const buyerNftAta = await ensureTokenAccountExists(
    connection,
    tx,
    trade.nftMint,
    buyerWallet,
    serverSigner.publicKey.toBase58()
  );
  const sellerPaymentAta = await ensureTokenAccountExists(
    connection,
    tx,
    settlementMint,
    sellerWallet,
    serverSigner.publicKey.toBase58()
  );

  tx.add(
    Token.createTransferCheckedInstruction(
      TOKEN_PROGRAM_ID,
      escrowNftAta,
      nftMint,
      buyerNftAta,
      serverSigner.publicKey,
      [],
      NFT_AMOUNT,
      NFT_DECIMALS
    )
  );
  tx.add(
    Token.createTransferCheckedInstruction(
      TOKEN_PROGRAM_ID,
      escrowPaymentAta,
      new PublicKey(settlementMint),
      sellerPaymentAta,
      serverSigner.publicKey,
      [],
      String(trade.priceAtomic),
      settlementDecimals
    )
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [serverSigner], {
    commitment: "confirmed",
  });

  return {
    signature,
    buyerNftAta: buyerNftAta.toBase58(),
    sellerPaymentAta: sellerPaymentAta.toBase58(),
  };
}

async function returnEscrowedNftToSeller(trade) {
  const { connection, serverSigner } = await getMarketplaceConfig();
  const { tx } = await buildUnsignedTransactionBase(serverSigner.publicKey.toBase58());
  const sellerAta = await ensureTokenAccountExists(
    connection,
    tx,
    trade.nftMint,
    trade.seller,
    serverSigner.publicKey.toBase58()
  );

  tx.add(
    Token.createTransferCheckedInstruction(
      TOKEN_PROGRAM_ID,
      new PublicKey(trade.escrowAta),
      new PublicKey(trade.nftMint),
      sellerAta,
      serverSigner.publicKey,
      [],
      NFT_AMOUNT,
      NFT_DECIMALS
    )
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [serverSigner], {
    commitment: "confirmed",
  });

  return {
    signature,
    sellerAta: sellerAta.toBase58(),
  };
}

async function escrowAccountStillHoldsNft(escrowAta) {
  const connection = getConnection();
  const balance = await getTokenAccountBalanceOrNull(connection, escrowAta);
  return !!balance && BigInt(String(balance.value.amount || "0")) >= 1n;
}

async function getTokenAccountOwner(address) {
  const connection = getConnection();
  const value = await getParsedAccountInfoOrNull(connection, address);
  const owner =
    value &&
    value.data &&
    value.data.parsed &&
    value.data.parsed.info &&
    value.data.parsed.info.owner;
  return owner || null;
}

module.exports = {
  NFT_AMOUNT,
  formatAtomicAmount,
  getMarketplaceConfig,
  parseUiAmountToAtomic,
  buildListingEscrowTransaction,
  buildBuyerPaymentTransaction,
  verifyTransferToEscrowSignature,
  settleEscrowedTrade,
  returnEscrowedNftToSeller,
  escrowAccountStillHoldsNft,
  getTokenAccountOwner,
};
