// scripts/smoke-test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');

async function loadKeypair(keypairPath) {
  const p = keypairPath || path.join(os.homedir(), '.config', 'solana', 'id.json');
  const raw = fs.readFileSync(p, 'utf8');
  const arr = JSON.parse(raw);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

async function main() {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const programIdStr = process.env.PROGRAM_ID;
  if (!programIdStr) {
    console.error('ERROR: PROGRAM_ID environment variable is required.');
    process.exit(1);
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const programId = new PublicKey(programIdStr);

  console.log('RPC URL:', rpcUrl);
  console.log('Program ID:', programId.toBase58());

  // 1) Check program account exists
  const accountInfo = await connection.getAccountInfo(programId);
  if (!accountInfo) {
    console.error('Program account not found on the configured cluster.');
    process.exit(2);
  }
  console.log('Program account found. Lamports:', accountInfo.lamports, 'Owner:', accountInfo.owner.toBase58());

  // 2) Load payer keypair
  let payer;
  try {
    payer = await loadKeypair(process.env.KEYPAIR_PATH);
  } catch (err) {
    console.error('Failed to load keypair:', err.message);
    process.exit(3);
  }
  console.log('Using payer:', payer.publicKey.toBase58());

  // 3) Build a harmless transaction that targets the program
  //    We use a 0-lamport SystemProgram.transfer to the program id as a generic ping.
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: programId,
      lamports: 0
    })
  );

  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed'
    });
    console.log('Transaction submitted. Signature:', sig);
    // Optionally fetch confirmation details
    const conf = await connection.getConfirmedTransaction(sig);
    console.log('Confirmed slot:', conf ? conf.slot : 'unknown');
    console.log('Smoke test succeeded.');
    process.exit(0);
  } catch (err) {
    console.error('Transaction failed:', err.message || err);
    process.exit(4);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(99);
});
