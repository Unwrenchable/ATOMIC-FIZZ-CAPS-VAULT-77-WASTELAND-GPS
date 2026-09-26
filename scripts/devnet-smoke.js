/*
  scripts/devnet-smoke.js
  - Requires an existing keypair file (KEYPAIR_PATH or ~/.config/solana/id.json)
  - Requests a 2 SOL airdrop on devnet
  - Verifies the program account exists
  - Submits a harmless 0-lamport transaction to the program
  - Prints structured output and exits with nonzero on failure

  This script never creates, writes, or embeds a private key.
*/
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';

(async () => {
  try {
    const rpc = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const programIdStr = process.env.PROGRAM_ID;
    if (!programIdStr) {
      console.error('ERROR: PROGRAM_ID environment variable is required.');
      process.exit(1);
    }
    const kpPath = process.env.KEYPAIR_PATH || path.join(os.homedir(), '.config', 'solana', 'id.json');

    if (!fs.existsSync(kpPath)) {
      console.error('ERROR: Keypair file not found at', kpPath);
      console.error('Set KEYPAIR_PATH to a Solana keypair JSON file, or create ~/.config/solana/id.json (for example: solana-keygen new --outfile ~/.config/solana/id.json).');
      console.error('This smoke test does not create or embed a private key.');
      process.exit(1);
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
