/**
 * Localnet claim_loot coverage. T1 (Metaplex order, name, freeze authority,
 * supply, both PDAs, CAPS burn) is the merge gate executed by
 * .github/workflows/claim-loot-t1.yml.
 *
 * N14 (CPI from a second program) is not deployed here. The forged
 * instructions-sysvar unit test in voucher.rs executes that check.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as nacl from "tweetnacl";

const v1 = require("../../backend/lib/voucherV1");

const METAPLEX_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const BPF_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const FEE = 100n * 1_000_000_000n;

describe("claim_loot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.FizzcapsOnchain as Program;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const server = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
  const serverPubkey = new PublicKey(server.publicKey);
  const nextServer = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(8));
  const nextServerPubkey = new PublicKey(nextServer.publicKey);

  let capsMint: PublicKey;
  let config: PublicKey;
  let lootMintAuthority: PublicKey;
  let playerCapsAta: PublicKey;

  function pda(seeds: Buffer[]) {
    return PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  }

  async function chainNow(): Promise<number> {
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    return blockTime ?? Math.floor(Date.now() / 1000);
  }

  function signVoucher(fields: any, keypair = server) {
    const message = v1.buildVoucherMessageV1({
      cluster: "localnet",
      programId: program.programId.toBase58(),
      ...fields,
    });
    const signature = nacl.sign.detached(message, keypair.secretKey);
    return { message, signature: Buffer.from(signature) };
  }

  async function claimIx(player: PublicKey, voucher: any, lootMint: PublicKey) {
    const playerLootAta = getAssociatedTokenAddressSync(lootMint, player);
    const voucherClaim = pda([
      Buffer.from("voucher-claim"),
      Buffer.from(voucher.voucherId, "hex"),
    ]);
    const lootClaim = pda([
      Buffer.from("loot-claim"),
      Buffer.from(new BN(voucher.lootId).toArray("le", 8)),
    ]);
    const metadata = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METAPLEX_ID.toBuffer(), lootMint.toBuffer()],
      METAPLEX_ID
    )[0];
    const masterEdition = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METAPLEX_ID.toBuffer(), lootMint.toBuffer(), Buffer.from("edition")],
      METAPLEX_ID
    )[0];
    const ix = await program.methods
      .claimLoot({
        voucherId: Array.from(Buffer.from(voucher.voucherId, "hex")),
        lootId: new BN(voucher.lootId),
        latE6: voucher.latE6,
        lngE6: voucher.lngE6,
        locationHint: voucher.locationHint,
        issuedAt: new BN(voucher.issuedAt),
        expiresAt: new BN(voucher.expiresAt),
      })
      .accounts({
        player,
        config,
        capsMint,
        playerCapsAta: getAssociatedTokenAddressSync(capsMint, player),
        lootMint,
        playerLootAta,
        lootMintAuthority,
        lootMetadata: metadata,
        masterEdition,
        voucherClaim,
        lootClaim,
        tokenProgram: TOKEN_PROGRAM_ID,
        metadataProgram: METAPLEX_ID,
        systemProgram: SystemProgram.programId,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
    return { ix, playerLootAta, voucherClaim, lootClaim, metadata, masterEdition };
  }

  async function freshVoucher(player: PublicKey, lootId: number) {
    const now = await chainNow();
    return {
      player: player.toBase58(),
      voucherId: Buffer.from(nacl.randomBytes(16)).toString("hex"),
      lootId,
      latE6: 37_774_929,
      lngE6: -122_419_416,
      locationHint: "Cinder Basin Cache",
      issuedAt: now - 5,
      expiresAt: now - 5 + 300,
    };
  }

  function ed25519Ix(message: Buffer, signature: Buffer, pubkey = server.publicKey) {
    return Ed25519Program.createInstructionWithPublicKey({
      publicKey: Buffer.from(pubkey),
      message,
      signature,
    });
  }

  async function sendClaim(playerKp: Keypair, voucher: any, keypair = server) {
    const lootMint = Keypair.generate();
    const built = await claimIx(playerKp.publicKey, voucher, lootMint.publicKey);
    const signed = signVoucher(voucher, keypair);
    const rent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction();
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: playerKp.publicKey,
        newAccountPubkey: lootMint.publicKey,
        space: MINT_SIZE,
        lamports: rent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        lootMint.publicKey,
        0,
        lootMintAuthority,
        lootMintAuthority
      ),
      createAssociatedTokenAccountInstruction(
        playerKp.publicKey,
        built.playerLootAta,
        playerKp.publicKey,
        lootMint.publicKey
      ),
      ed25519Ix(signed.message, signed.signature, keypair.publicKey),
      built.ix
    );
    const ed = tx.instructions.length - 2;
    if (!tx.instructions[ed].programId.equals(Ed25519Program.programId)) {
      throw new Error("Ed25519 instruction is not immediately before claim_loot");
    }
    await provider.sendAndConfirm(tx, [playerKp, lootMint]);
    return { ...built, lootMint: lootMint.publicKey };
  }

  function textOf(err: any): string {
    return [
      err?.message,
      err?.error?.errorCode?.code,
      ...(err?.logs || []),
      ...(err?.transactionLogs || []),
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function expectFail(fn: () => Promise<unknown>, needle: string) {
    try {
      await fn();
    } catch (err) {
      const text = textOf(err);
      if (!text.includes(needle)) {
        throw new Error(`expected ${needle} in:\n${text}`);
      }
      return;
    }
    throw new Error(`expected failure containing ${needle}`);
  }

  before(async () => {
    const sig = await provider.connection.requestAirdrop(serverPubkey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    const treasury = Keypair.generate();
    const tSig = await provider.connection.requestAirdrop(treasury.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(tSig);

    capsMint = await createMint(provider.connection, payer, payer.publicKey, null, 9);
    config = pda([Buffer.from("fizz-config")]);
    lootMintAuthority = pda([Buffer.from("loot-mint-auth")]);
    const [programData] = PublicKey.findProgramAddressSync(
      [program.programId.toBuffer()],
      BPF_LOADER
    );
    await program.methods
      .fizzInit()
      .accounts({
        config,
        authority: payer.publicKey,
        treasury: treasury.publicKey,
        capsMint,
        serverKey: serverPubkey,
        program: program.programId,
        programData,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      capsMint,
      payer.publicKey
    );
    playerCapsAta = ata.address;
    await mintTo(provider.connection, payer, capsMint, playerCapsAta, payer, 1_000_000_000_000);
  });

  it("T1 mints one NFT, burns 100 CAPS, and records both PDAs", async () => {
    const before = await getAccount(provider.connection, playerCapsAta);
    const voucher = await freshVoucher(payer.publicKey, 42);
    const claimed = await sendClaim(payer, voucher);
    const after = await getAccount(provider.connection, playerCapsAta);
    const lootAta = await getAccount(provider.connection, claimed.playerLootAta);
    const mint = await getMint(provider.connection, claimed.lootMint);
    const meta = await provider.connection.getAccountInfo(claimed.metadata);
    const voucherPda = await provider.connection.getAccountInfo(claimed.voucherClaim);
    const lootPda = await provider.connection.getAccountInfo(claimed.lootClaim);

    if (before.amount - after.amount !== FEE) throw new Error("CAPS burn mismatch");
    if (lootAta.amount !== 1n) throw new Error("loot balance");
    if (mint.decimals !== 0 || mint.supply !== 1n) {
      throw new Error("mint constraints were not preserved through CreateV1");
    }
    if (!mint.freezeAuthority?.equals(claimed.masterEdition)) {
      throw new Error("freeze authority was not moved to the master edition");
    }
    if (!mint.mintAuthority?.equals(lootMintAuthority)) throw new Error("mint authority");
    const name = "Fizz Cache #42";
    if (!meta || !Buffer.from(meta.data).includes(Buffer.from(name))) {
      throw new Error("metadata name missing");
    }
    if (!voucherPda || !lootPda) throw new Error("replay PDAs missing");
  });

  it("rejects a second claim of the same voucher id", async () => {
    const voucher = await freshVoucher(payer.publicKey, 100);
    await sendClaim(payer, voucher);
    await expectFail(() => sendClaim(payer, voucher), "already in use");
  });

  it("rejects a second voucher for the same loot id", async () => {
    const first = await freshVoucher(payer.publicKey, 101);
    await sendClaim(payer, first);
    const second = await freshVoucher(payer.publicKey, 101);
    await expectFail(() => sendClaim(payer, second), "already in use");
  });

  it("N3 tampered time fields do not match the signed message", async () => {
    const voucher = await freshVoucher(payer.publicKey, 102);
    const signed = signVoucher(voucher);
    const tampered = { ...voucher, issuedAt: voucher.issuedAt - 1, expiresAt: voucher.expiresAt + 1 };
    const lootMint = Keypair.generate();
    const built = await claimIx(payer.publicKey, tampered, lootMint.publicKey);
    const rent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: lootMint.publicKey,
        space: MINT_SIZE,
        lamports: rent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(lootMint.publicKey, 0, lootMintAuthority, null),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        built.playerLootAta,
        payer.publicKey,
        lootMint.publicKey
      ),
      ed25519Ix(signed.message, signed.signature),
      built.ix
    );
    await expectFail(
      () => provider.sendAndConfirm(tx, [payer, lootMint]),
      "VoucherMessageMismatch"
    );
  });

  it("N17 rejects a mint with a freeze authority", async () => {
    const voucher = await freshVoucher(payer.publicKey, 103);
    const lootMint = Keypair.generate();
    const built = await claimIx(payer.publicKey, voucher, lootMint.publicKey);
    const signed = signVoucher(voucher);
    const rent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: lootMint.publicKey,
        space: MINT_SIZE,
        lamports: rent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(lootMint.publicKey, 0, lootMintAuthority, payer.publicKey),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        built.playerLootAta,
        payer.publicKey,
        lootMint.publicKey
      ),
      ed25519Ix(signed.message, signed.signature),
      built.ix
    );
    await expectFail(() => provider.sendAndConfirm(tx, [payer, lootMint]), "BadLootMint");
  });

  it("N16 does not leave a voucher PDA when the burn fails", async () => {
    const poor = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(poor.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      capsMint,
      poor.publicKey
    );
    await mintTo(provider.connection, payer, capsMint, ata.address, payer, 50);
    const voucher = await freshVoucher(poor.publicKey, 104);
    const voucherClaim = pda([
      Buffer.from("voucher-claim"),
      Buffer.from(voucher.voucherId, "hex"),
    ]);
    await expectFail(() => sendClaim(poor, voucher), "insufficient");
    const left = await provider.connection.getAccountInfo(voucherClaim);
    if (left) throw new Error("voucher PDA survived a failed burn");
  });

  it("T2 pauses, rotates, and rejects the old key", async () => {
    await expectFail(
      () =>
        program.methods
          .fizzSetServerKey(nextServerPubkey)
          .accounts({ config, authority: payer.publicKey })
          .rpc(),
      "MustPauseBeforeRotate"
    );
    await program.methods
      .fizzSetPaused(true)
      .accounts({ config, authority: payer.publicKey })
      .rpc();
    const paused = await freshVoucher(payer.publicKey, 105);
    await expectFail(() => sendClaim(payer, paused), "ClaimsPaused");
    await program.methods
      .fizzSetServerKey(nextServerPubkey)
      .accounts({ config, authority: payer.publicKey })
      .rpc();
    await program.methods
      .fizzSetPaused(false)
      .accounts({ config, authority: payer.publicKey })
      .rpc();
    const oldKey = await freshVoucher(payer.publicKey, 106);
    await expectFail(() => sendClaim(payer, oldKey, server), "WrongVoucherSigner");
    const rotated = await freshVoucher(payer.publicKey, 107);
    await sendClaim(payer, rotated, nextServer);
  });

  it("N19 a non-authority cannot rotate the server key", async () => {
    const stranger = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(stranger.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    await expectFail(
      () =>
        program.methods
          .fizzSetServerKey(serverPubkey)
          .accounts({ config, authority: stranger.publicKey })
          .signers([stranger])
          .rpc(),
      "ConstraintHasOne"
    );
  });
});
