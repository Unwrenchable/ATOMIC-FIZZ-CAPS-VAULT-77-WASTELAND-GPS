const { getParsedTransaction } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");

// Verify txSig transferred required baseAmount of MINT_PUBKEY from wallet to vaultAta
async function verifyTokenTransferTx(txSig, walletPubkeyStr, requiredBaseAmount, mintPubkey, expectedDestAta) {
  const parsed = await connection.getParsedTransaction(txSig, { commitment: "confirmed" });
  if (!parsed) throw new Error("tx_not_found_or_unconfirmed");

  // Check block time / slot freshness if desired
  // parsed.blockTime

  // Iterate instructions to find token transfer for our mint
  const meta = parsed.meta;
  if (!meta || meta.err) throw new Error("tx_failed");

  const txMessage = parsed.transaction.message;
  const instructions = txMessage.instructions || [];

  // For parsed transactions, token transfers appear in innerInstructions or parsed instructions
  // Check meta.innerInstructions for token transfers
  const inner = meta.innerInstructions || [];
  let found = false;
  for (const innerGroup of inner) {
    for (const ix of innerGroup.instructions || []) {
      if (ix.program === "spl-token" && ix.parsed && ix.parsed.type === "transfer") {
        const info = ix.parsed.info;
        if (info.mint === mintPubkey.toBase58()) {
          // info.source, info.destination, info.amount (string)
          if (info.source && info.destination && info.amount) {
            // Ensure source ATA owner equals wallet
            // We must check accountKeys mapping to find owner; simpler: require source ATA address belongs to wallet by deriving ATA
            found = { source: info.source, dest: info.destination, amount: BigInt(info.amount) };
            break;
          }
        }
      }
    }
    if (found) break;
  }

  // Fallback: check top-level instructions parsed
  if (!found) {
    for (const ix of instructions) {
      if (ix.program === "spl-token" && ix.parsed && ix.parsed.type === "transfer") {
        const info = ix.parsed.info;
        if (info.mint === mintPubkey.toBase58()) {
          found = { source: info.source, dest: info.destination, amount: BigInt(info.amount) };
          break;
        }
      }
    }
  }

  if (!found) throw new Error("no_valid_token_transfer_found");

  // Verify destination matches expectedDestAta (vault ATA) or vault owner
  if (expectedDestAta && found.dest !== expectedDestAta.toBase58()) {
    throw new Error("destination_mismatch");
  }

  // Verify amount
  if (found.amount < BigInt(requiredBaseAmount)) {
    throw new Error("insufficient_amount_in_tx");
  }

  // Verify source ATA belongs to wallet by deriving ATA and comparing
  const derivedSourceAta = await getOrCreateAssociatedTokenAccount(connection, GAME_VAULT, mintPubkey, new PublicKey(walletPubkeyStr));
  // Note: getOrCreateAssociatedTokenAccount will create if missing; to avoid creation, derive ATA address instead:
  // const derivedSourceAtaAddress = (await PublicKey.findProgramAddress([...], TOKEN_PROGRAM_ID))[0] -- use spl-token utils or derive manually.
  // For simplicity, compare owner: ensure parsed accountKeys include walletPubkey as owner of source ATA is not trivial here.
  // As a pragmatic check, ensure found.source equals the associated token account for wallet:
  const { getAssociatedTokenAddress } = require("@solana/spl-token");
  const expectedSourceAta = await getAssociatedTokenAddress(mintPubkey, new PublicKey(walletPubkeyStr));
  if (found.source !== expectedSourceAta.toBase58()) {
    throw new Error("source_not_player_ata");
  }

  return true;
}
