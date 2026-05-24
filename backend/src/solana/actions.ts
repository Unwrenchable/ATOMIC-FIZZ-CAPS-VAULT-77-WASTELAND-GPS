import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  mintTo
} from '/mnt/c/Users/tsmit/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS/node_modules/@solana/spl-token';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.testnet' });

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const signer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(process.env.REALAI_SIGNER_PATH!, 'utf8')))
);

export const CAPS_MINT = new PublicKey(process.env.CAPS_TOKEN_MINT!);
export const COLLECTION_MINT = new PublicKey(process.env.CAPS_COLLECTION_MINT!);

export async function mintCAPS(toPubkey: string, amount: number) {
  const destination = new PublicKey(toPubkey);

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    signer,
    CAPS_MINT,
    destination
  );

  const signature = await mintTo(
    connection,
    signer,
    CAPS_MINT,
    ata.address,
    signer,
    amount * 1_000_000_000
  );

  return { signature, amount };
}

export async function mintFizzCapNFT(toPubkey: string, name: string, description: string) {
  const metaplex = Metaplex.make(connection).use(keypairIdentity(signer));

  const { nft } = await metaplex.nfts().create({
    uri: "https://arweave.net/default-survivor-metadata.json",
    name,
    symbol: "FIZZCAP",
    sellerFeeBasisPoints: 500,
    collection: COLLECTION_MINT,
  });

  return { mint: nft.address.toString(), name };
}
