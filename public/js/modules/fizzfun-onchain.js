(function () {
  "use strict";

  const DEFAULT_PROGRAM_ID = "GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc";
  const METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
  const TOKEN_METADATA_PROGRAM_ID = new solanaWeb3.PublicKey(METADATA_PROGRAM_ID);
  const PROGRAM_ID = new solanaWeb3.PublicKey(window.FIZZ_FUN_PROGRAM_ID || DEFAULT_PROGRAM_ID);
  const TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID;
  const ATA_PROGRAM_ID = splToken.ASSOCIATED_TOKEN_PROGRAM_ID;
  const RENT_SYSVAR_ID = new solanaWeb3.PublicKey("SysvarRent111111111111111111111111111111111");
  const INSTRUCTIONS_SYSVAR_ID = new solanaWeb3.PublicKey("Sysvar1nstructions1111111111111111111111111");
  const textEncoder = new TextEncoder();

  const IX = {
    launch: new Uint8Array([40, 219, 5, 6, 35, 246, 29, 86]),
    buy: new Uint8Array([252, 7, 94, 113, 33, 6, 132, 207]),
    sell: new Uint8Array([167, 33, 177, 238, 229, 29, 66, 136]),
  };

  function concatBytes() {
    const arrays = Array.from(arguments);
    const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
      out.set(arr, offset);
      offset += arr.length;
    }
    return out;
  }

  function encodeU64(value) {
    const out = new Uint8Array(8);
    const view = new DataView(out.buffer);
    view.setBigUint64(0, BigInt(Math.floor(Number(value))), true);
    return out;
  }

  function encodeString(value) {
    const bytes = textEncoder.encode(String(value));
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, bytes.length, true);
    return concatBytes(len, bytes);
  }

  function encodeLaunchType(launchType) {
    const map = {
      CapsStandard: 0,
      CapsVeteran: 1,
      AdminUSDC: 2,
      AdminFree: 3,
    };
    return new Uint8Array([map[launchType] ?? 0]);
  }

  function derivePda(seedParts) {
    return solanaWeb3.PublicKey.findProgramAddressSync(seedParts, PROGRAM_ID)[0];
  }

  function deriveConfigPda() {
    return derivePda([textEncoder.encode("fizz-config")]);
  }

  function deriveCurvePda(mintPubkey) {
    return derivePda([textEncoder.encode("fizz-curve"), mintPubkey.toBuffer()]);
  }

  function deriveSolVaultPda(mintPubkey) {
    return derivePda([textEncoder.encode("fizz-sol-vault"), mintPubkey.toBuffer()]);
  }

  function deriveMetadataPda(mintPubkey) {
    return solanaWeb3.PublicKey.findProgramAddressSync(
      [textEncoder.encode("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    )[0];
  }

  function deriveAta(owner, mint) {
    return splToken.getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ATA_PROGRAM_ID
    );
  }

  async function getConnection() {
    return new solanaWeb3.Connection(window.SOLANA_RPC || "https://api.devnet.solana.com", "confirmed");
  }

  async function ensureConfig() {
    if (window.__AF_FIZZ_CONFIG_PROMISE__) {
      await window.__AF_FIZZ_CONFIG_PROMISE__;
    }
    if (!window.CAPS_MINT || !window.TREASURY_WALLET) {
      throw new Error("Fizz.fun config is still loading. Try again in a moment.");
    }
    return {
      capsMint: new solanaWeb3.PublicKey(window.CAPS_MINT),
      treasuryWallet: new solanaWeb3.PublicKey(window.TREASURY_WALLET),
      programId: PROGRAM_ID,
    };
  }

  function amountToLamports(amount, isToken) {
    const raw = Number(amount);
    if (!Number.isFinite(raw) || raw <= 0) {
      throw new Error("Invalid amount");
    }
    return BigInt(Math.floor(raw * 1e9));
  }

  async function buildLaunchTransaction(params) {
    const { walletAddress, name, symbol, uri, launchType = "CapsStandard" } = params;
    const { capsMint } = await ensureConfig();
    const connection = await getConnection();
    const wallet = new solanaWeb3.PublicKey(walletAddress);
    const mint = solanaWeb3.Keypair.generate();
    const bondingCurve = deriveCurvePda(mint.publicKey);
    const solVault = deriveSolVaultPda(mint.publicKey);
    const configPda = deriveConfigPda();
    const metadata = deriveMetadataPda(mint.publicKey);
    const tokenVault = deriveAta(bondingCurve, mint.publicKey);
    const playerCapsAta = deriveAta(wallet, capsMint);
    const launchData = concatBytes(
      IX.launch,
      encodeString(name),
      encodeString(symbol),
      encodeString(uri),
      encodeLaunchType(launchType)
    );

    const mintRent = await connection.getMinimumBalanceForRentExemption(splToken.MINT_SIZE);
    const tx = new solanaWeb3.Transaction();
    tx.add(
      solanaWeb3.SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: mint.publicKey,
        space: splToken.MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      splToken.createInitializeMintInstruction(
        mint.publicKey,
        9,
        bondingCurve,
        bondingCurve,
        TOKEN_PROGRAM_ID
      ),
      new solanaWeb3.TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: wallet, isSigner: true, isWritable: true },
          { pubkey: capsMint, isSigner: false, isWritable: false },
          { pubkey: playerCapsAta, isSigner: false, isWritable: true },
          { pubkey: bondingCurve, isSigner: false, isWritable: true },
          { pubkey: solVault, isSigner: false, isWritable: true },
          { pubkey: mint.publicKey, isSigner: false, isWritable: true },
          { pubkey: metadata, isSigner: false, isWritable: true },
          { pubkey: tokenVault, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ATA_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
          { pubkey: INSTRUCTIONS_SYSVAR_ID, isSigner: false, isWritable: false },
        ],
        data: launchData,
      })
    );

    tx.feePayer = wallet;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.partialSign(mint);
    return { transaction: tx, mintPubkey: mint.publicKey.toBase58() };
  }

  async function buildTradeTransaction(params) {
    const { walletAddress, mintAddress, direction, amount, minOut = 0 } = params;
    const { treasuryWallet } = await ensureConfig();
    const connection = await getConnection();
    const wallet = new solanaWeb3.PublicKey(walletAddress);
    const mint = new solanaWeb3.PublicKey(mintAddress);
    const bondingCurve = deriveCurvePda(mint);
    const solVault = deriveSolVaultPda(mint);
    const configPda = deriveConfigPda();
    const tokenVault = deriveAta(bondingCurve, mint);
    const walletAta = deriveAta(wallet, mint);
    const tradeAmount = amountToLamports(amount, direction === "buy");
    const minOutRaw = amountToLamports(minOut || 0, direction === "buy");
    const data = concatBytes(
      direction === "buy" ? IX.buy : IX.sell,
      encodeU64(tradeAmount),
      encodeU64(minOutRaw)
    );

    const tx = new solanaWeb3.Transaction().add(
      new solanaWeb3.TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: wallet, isSigner: true, isWritable: true },
          { pubkey: bondingCurve, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: tokenVault, isSigner: false, isWritable: true },
          { pubkey: walletAta, isSigner: false, isWritable: true },
          { pubkey: solVault, isSigner: false, isWritable: true },
          { pubkey: treasuryWallet, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ATA_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
        ],
        data,
      })
    );

    tx.feePayer = wallet;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    return { transaction: tx };
  }

  async function signAndSendTransaction(tx) {
    const connection = await getConnection();
    const signed = await window.solana.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  }

  window.FizzFunOnChain = {
    buildLaunchTransaction,
    buildTradeTransaction,
    signAndSendTransaction,
    deriveCurvePda,
    deriveSolVaultPda,
    deriveConfigPda,
    deriveAta,
  };
})();
