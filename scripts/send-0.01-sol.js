// scripts/send-0.01-sol.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  PublicKey
} = require('@solana/web3.js');

(async () => {
  try {
    const rpc = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const kpPath = process.env.KEYPAIR_PATH || path.join(os.homedir(), '.config', 'solana', 'id.json');
    const recipient = process.env.RECIPIENT_PUBKEY || 'H6ZtQY3p5rvE3S5ogkkR7vHJH5VYzTc8BTvZ5UAJ7DCB';
    const amountSol = parseFloat(process.env.AMOUNT_SOL || '0.01');

    if (!fs.existsSync(kpPath)) {
      console.error('Keypair not found at', kpPath);
      process.exit(1);
    }

    const secret = JSON.parse(fs.readFileSync(kpPath, 'utf8'));
    const payer = Keypair.fromSecretKey(Uint8Array.from(secret));
    const conn = new Connection(rpc, 'confirmed');

    console.log('Payer:', payer.publicKey.toBase58());
    console.log('Sending', amountSol, 'SOL to', recipient, 'via', rpc);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(recipient),
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL)
      })
    );

    const sig = await sendAndConfirmTransaction(conn, tx, [payer], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed'
    });

    console.log('Transfer confirmed. Signature:', sig);
    process.exit(0);
  } catch (err) {
    console.error('Transfer failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
