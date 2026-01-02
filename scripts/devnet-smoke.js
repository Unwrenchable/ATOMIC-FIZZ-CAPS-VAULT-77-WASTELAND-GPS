/*
  scripts/devnet-smoke.js
  - Creates keypair file if missing (uses the secret you provided)
  - Requests a 2 SOL airdrop on devnet
  - Verifies the program account exists
  - Submits a harmless 0-lamport transaction to the program
  - Prints structured output and exits with nonzero on failure
*/
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');

(async () => {
  try {
    const rpc = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const programIdStr = process.env.PROGRAM_ID;
    if (!programIdStr) {
      console.error('ERROR: PROGRAM_ID environment variable is required.');
      process.exit(1);
    }
    const kpPath = process.env.KEYPAIR_PATH || path.join(os.homedir(), '.config', 'solana', 'id.json');

    // If keypair missing, write the secret you provided (replace array if needed)
    if (!fs.existsSync(kpPath)) {
      const secret = [254,79,234,24,201,200,182,28,131,85,146,80,125,5,22,98,34,212,129,174,20,143,27,169,16,1,48,117,152,130,160,5,239,40,20,92,60,83,144,20,176,175,95,74,94,25,230,125,98,228,4,139,216,217,205,92,126,238,142,150,163,189,122,152];
      fs.mkdirSync(path.dirname(kpPath), { recursive: true });
      fs.writeFileSync(kpPath, JSON.stringify(secret));
      fs.chmodSync(kpPath, 0o600);
      console.log('Wrote keypair to', kpPath);
    }

    const conn = new Connection(rpc, 'confirmed');
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8'))));
    console.log('Using payer:', kp.publicKey.toBase58());

    // Airdrop 2 SOL
    console.log('Requesting airdrop (2 SOL) to payer...');
    const sigA = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sigA, 'confirmed');
    console.log('Airdrop signature:', sigA);

    // Check program account
    const programId = new PublicKey(programIdStr);
    const info = await conn.getAccountInfo(programId);
    if (!info) {
      console.error('Program account not found on RPC:', rpc);
      process.exit(2);
    }
    console.log('Program found. Lamports:', info.lamports, 'Owner:', info.owner.toBase58());

    // Submit harmless 0-lamport transfer to program as a ping
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: kp.publicKey,
        toPubkey: programId,
        lamports: 0
      })
    );

    const sig = await sendAndConfirmTransaction(conn, tx, [kp], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed'
    });
    console.log('Smoke tx signature:', sig);
    console.log('Smoke test succeeded.');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err && err.message ? err.message : err);
    process.exit(99);
  }
})();
