const fs = require("fs");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
const { Keypair, Connection, PublicKey, Transaction, TransactionInstruction } =
  anchor.web3;

const PROGRAM_ID = new PublicKey("DETVnjSWAoDtANfs3xse2c4DEryGsWuS6bsxL3oU2bgn");
const CAPS_MINT = new PublicKey("CAPS47Gjzx5R1g8HeNjG8n1jPLETSgfqXwq8mUak9rP1");
const IDL = require("../target/idl/fizzcaps_onchain.json");

function resolveWalletPath() {
  const candidates = [
    process.env.ANCHOR_WALLET,
    process.env.REALAI_AGENT_KEYPAIR,
    path.resolve(process.cwd(), "test-ledger/faucet-keypair.json"),
    path.resolve(process.cwd(), "keys/realai_treasury.json"),
    path.resolve(process.cwd(), "keys/realai_treasury_vanity.json"),
    path.join(process.env.HOME || "", ".config/solana/id.json"),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function loadWallet() {
  const walletPath = resolveWalletPath();
  if (!walletPath) {
    throw new Error(
      "No wallet keypair found. Set ANCHOR_WALLET or REALAI_AGENT_KEYPAIR, or add a local keypair file."
    );
  }

  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(walletPath, "utf8"))
  );

  return {
    wallet: new anchor.Wallet(Keypair.fromSecretKey(secretKey)),
    walletPath,
  };
}

async function main() {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.SOLANA_RPC_URL ||
    process.env.SOLANA_RPC ||
    "https://api.devnet.solana.com";
  const { wallet: signerWallet, walletPath } = loadWallet();
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, signerWallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const wallet = provider.wallet.publicKey;
  const coder = new anchor.BorshCoder(IDL);

  const amount = new anchor.BN(1_000_000_000); // 1 token (adjust for your decimals)

  console.log("🔥 Testing cross-chain burn...");
  console.log("RPC:", rpcUrl);
  console.log("Wallet:", wallet.toBase58());
  console.log("Keypair:", walletPath);

  try {
    const tokenAccount = await anchor.utils.token.associatedAddress({
      mint: CAPS_MINT,
      owner: wallet,
    });
    const [walletBalance, tokenAccountInfo] = await Promise.all([
      connection.getBalance(wallet),
      connection.getAccountInfo(tokenAccount),
    ]);

    if (walletBalance <= 0) {
      throw new Error(
        `Wallet ${wallet.toBase58()} has no devnet SOL. Fund it before running the burn test.`
      );
    }

    if (!tokenAccountInfo) {
      throw new Error(
        `CAPS token account ${tokenAccount.toBase58()} does not exist for wallet ${wallet.toBase58()}.`
      );
    }

    const config = PublicKey.findProgramAddressSync(
      [Buffer.from("fizz-config")],
      PROGRAM_ID
    )[0];
    const instructionData = coder.instruction.encode("burn_for_crosschain", {
      amount,
      target_chain: "base",
      target_address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: wallet, isSigner: true, isWritable: true },
          { pubkey: CAPS_MINT, isSigner: false, isWritable: true },
          { pubkey: tokenAccount, isSigner: false, isWritable: true },
          { pubkey: config, isSigner: false, isWritable: true },
          {
            pubkey: anchor.utils.token.TOKEN_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: instructionData,
      })
    );

    const tx = await provider.sendAndConfirm(transaction);

    console.log("✅ Burn successful! Tx:", tx);
  } catch (e) {
    console.error("❌ Burn failed:", e.message || e);
  }
}

main().catch(console.error);
