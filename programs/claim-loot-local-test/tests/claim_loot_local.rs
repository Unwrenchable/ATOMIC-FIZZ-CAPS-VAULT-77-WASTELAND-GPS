//! Executed local-validator coverage for claim_loot.
//!
//! cargo test -p fizzcaps_onchain --features localnet --test claim_loot_local -- --nocapture
//!
//! Loads the SBF build and the Metaplex program. One test walks a rejected
//! 0-decimal caps mint, the happy path, a replay, a wrong signer, and a
//! transaction with no Ed25519 instruction.
//! The program dependency is built with `--features localnet`.

use fizzcaps_onchain::LootVoucherV1;
use solana_program_test::*;
use solana_sdk::{
    account::Account,
    bpf_loader_upgradeable::{self, UpgradeableLoaderState},
    clock::Clock,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    rent::Rent,
    signature::{Keypair, Signer},
    system_instruction, system_program,
    transaction::Transaction,
};
use spl_associated_token_account::{
    get_associated_token_address, instruction as ata,
};
use spl_token::instruction as token_ix;
use std::str::FromStr;

const FIZZ_INIT_DISC: [u8; 8] = [202, 46, 241, 160, 166, 172, 121, 12];
const MINT_LEN: usize = 82;
const METAPLEX: &str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

fn read_so(name: &str) -> Vec<u8> {
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace = manifest.join("../..");
    let candidates = [
        workspace.join(format!("target/deploy/{name}.so")),
        manifest.join(format!("target/deploy/{name}.so")),
        manifest.join(format!("tests/fixtures/{name}.so")),
        workspace.join(format!("anchor-tests/fixtures/{name}.so")),
    ];
    for path in &candidates {
        if let Ok(bytes) = std::fs::read(path) {
            if !bytes.is_empty() {
                return bytes;
            }
        }
    }
    panic!("missing {name}.so (looked in target/deploy and tests/fixtures)");
}

fn ed25519_ix(pubkey: &[u8; 32], signature: &[u8; 64], message: &[u8]) -> Instruction {
    let mut data = Vec::with_capacity(16 + 32 + 64 + message.len());
    data.push(1);
    data.push(0);
    let pk_off: u16 = 16;
    let sig_off: u16 = 48;
    let msg_off: u16 = 112;
    let msg_len = u16::try_from(message.len()).unwrap();
    for value in [sig_off, u16::MAX, pk_off, u16::MAX, msg_off, msg_len, u16::MAX] {
        data.extend_from_slice(&value.to_le_bytes());
    }
    data.extend_from_slice(pubkey);
    data.extend_from_slice(signature);
    data.extend_from_slice(message);
    Instruction {
        program_id: solana_sdk::ed25519_program::id(),
        accounts: vec![],
        data,
    }
}

fn loader_account(data: Vec<u8>, executable: bool) -> Account {
    let rent = Rent::default();
    Account {
        lamports: rent.minimum_balance(data.len()).max(1),
        data,
        owner: bpf_loader_upgradeable::id(),
        executable,
        rent_epoch: 0,
    }
}

fn program_accounts(program_id: &Pubkey, elf: &[u8], upgrade_authority: &Pubkey) -> (Pubkey, Account, Account) {
    let (programdata_address, _) =
        Pubkey::find_program_address(&[program_id.as_ref()], &bpf_loader_upgradeable::id());
    let mut programdata = bincode::serialize(&UpgradeableLoaderState::ProgramData {
        slot: 0,
        upgrade_authority_address: Some(*upgrade_authority),
    })
    .unwrap();
    programdata.extend_from_slice(elf);
    let program = bincode::serialize(&UpgradeableLoaderState::Program {
        programdata_address,
    })
    .unwrap();
    (
        programdata_address,
        loader_account(program, true),
        loader_account(programdata, false),
    )
}

struct World {
    context: ProgramTestContext,
    program_id: Pubkey,
    authority: Keypair,
    caps_mint: Pubkey,
    config: Pubkey,
    loot_mint_authority: Pubkey,
    player_caps_ata: Pubkey,
    metaplex: Pubkey,
}

async fn refresh(context: &mut ProgramTestContext) {
    context.last_blockhash = context
        .banks_client
        .get_latest_blockhash()
        .await
        .unwrap();
}

async fn send(context: &mut ProgramTestContext, ixs: &[Instruction], signers: &[&Keypair]) {
    refresh(context).await;
    let payer = context.payer.insecure_clone();
    let blockhash = context.last_blockhash;
    let mut all: Vec<&Keypair> = vec![&payer];
    all.extend_from_slice(signers);
    let tx = Transaction::new_signed_with_payer(ixs, Some(&payer.pubkey()), &all, blockhash);
    context.banks_client.process_transaction(tx).await.unwrap();
}

async fn send_expect(
    context: &mut ProgramTestContext,
    ixs: &[Instruction],
    signers: &[&Keypair],
    needle: &str,
) {
    refresh(context).await;
    let payer = context.payer.insecure_clone();
    let blockhash = context.last_blockhash;
    let mut all: Vec<&Keypair> = vec![&payer];
    all.extend_from_slice(signers);
    let tx = Transaction::new_signed_with_payer(ixs, Some(&payer.pubkey()), &all, blockhash);
    let meta = context
        .banks_client
        .process_transaction_with_metadata(tx)
        .await
        .expect("banks metadata");
    let logs = meta
        .metadata
        .map(|m| m.log_messages.join("\n"))
        .unwrap_or_default();
    let err = meta.result.expect_err("transaction succeeded");
    let text = format!("{err:?}\n{logs}");
    assert!(text.contains(needle), "expected {needle} in:\n{text}");
}

fn pda(program_id: &Pubkey, seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, program_id).0
}

fn claim_accounts(
    world: &World,
    loot_mint: &Pubkey,
    player_loot_ata: &Pubkey,
    metadata: &Pubkey,
    master_edition: &Pubkey,
    voucher_claim: &Pubkey,
    loot_claim: &Pubkey,
    voucher: &LootVoucherV1,
) -> Instruction {
    Instruction {
        program_id: world.program_id,
        accounts: vec![
            AccountMeta::new(world.authority.pubkey(), true),
            AccountMeta::new_readonly(world.config, false),
            AccountMeta::new(world.caps_mint, false),
            AccountMeta::new(world.player_caps_ata, false),
            AccountMeta::new(*loot_mint, false),
            AccountMeta::new(*player_loot_ata, false),
            AccountMeta::new_readonly(world.loot_mint_authority, false),
            AccountMeta::new(*metadata, false),
            AccountMeta::new(*master_edition, false),
            AccountMeta::new(*voucher_claim, false),
            AccountMeta::new(*loot_claim, false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(world.metaplex, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(solana_sdk::sysvar::instructions::id(), false),
        ],
        data: fizzcaps_onchain::pack_claim_loot(voucher),
    }
}

fn prepare_loot(
    payer: &Pubkey,
    player: &Pubkey,
    loot_mint: &Pubkey,
    loot_mint_authority: &Pubkey,
    rent: &Rent,
) -> Vec<Instruction> {
    vec![
        system_instruction::create_account(
            payer,
            loot_mint,
            rent.minimum_balance(MINT_LEN),
            MINT_LEN as u64,
            &spl_token::id(),
        ),
        token_ix::initialize_mint(
            &spl_token::id(),
            loot_mint,
            loot_mint_authority,
            Some(loot_mint_authority),
            0,
        )
        .unwrap(),
        ata::create_associated_token_account(payer, player, loot_mint, &spl_token::id()),
    ]
}

fn voucher_for(loot_id: u64, now: i64, voucher_id: [u8; 16]) -> LootVoucherV1 {
    LootVoucherV1 {
        voucher_id,
        loot_id,
        lat_e6: 37_774_929,
        lng_e6: -122_419_416,
        location_hint: "Cinder Basin Cache".to_string(),
        issued_at: now.saturating_sub(5),
        expires_at: now.saturating_sub(5) + 300,
    }
}

fn fizz_init_ix(
    program_id: &Pubkey,
    config: &Pubkey,
    authority: &Pubkey,
    caps_mint: &Pubkey,
    server: &Pubkey,
    programdata: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*config, false),
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(*authority, false),
            AccountMeta::new(*caps_mint, false),
            AccountMeta::new_readonly(*server, false),
            AccountMeta::new_readonly(*program_id, false),
            AccountMeta::new_readonly(*programdata, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: FIZZ_INIT_DISC.to_vec(),
    }
}

async fn run_claim(world: &mut World, voucher: &LootVoucherV1, signer: &Keypair, ed25519: bool, expect: Option<&str>) {
    let loot_mint = Keypair::new();
    let player = world.authority.pubkey();
    let player_loot_ata = get_associated_token_address(&player, &loot_mint.pubkey());
    let metadata = pda(
        &world.metaplex,
        &[b"metadata", world.metaplex.as_ref(), loot_mint.pubkey().as_ref()],
    );
    let master_edition = pda(
        &world.metaplex,
        &[
            b"metadata",
            world.metaplex.as_ref(),
            loot_mint.pubkey().as_ref(),
            b"edition",
        ],
    );
    let voucher_claim = pda(&world.program_id, &[b"voucher-claim", voucher.voucher_id.as_ref()]);
    let loot_claim = pda(&world.program_id, &[b"loot-claim", &voucher.loot_id.to_le_bytes()]);
    let rent = world.context.banks_client.get_rent().await.unwrap();
    let mut ixs = prepare_loot(
        &world.context.payer.pubkey(),
        &player,
        &loot_mint.pubkey(),
        &world.loot_mint_authority,
        &rent,
    );
    if ed25519 {
        let message = voucher.message(&world.program_id, &player);
        let sig = signer.sign_message(&message);
        let mut sig_bytes = [0u8; 64];
        sig_bytes.copy_from_slice(sig.as_ref());
        ixs.push(ed25519_ix(&signer.pubkey().to_bytes(), &sig_bytes, &message));
    }
    ixs.push(claim_accounts(
        world,
        &loot_mint.pubkey(),
        &player_loot_ata,
        &metadata,
        &master_edition,
        &voucher_claim,
        &loot_claim,
        voucher,
    ));
    let authority = world.authority.insecure_clone();
    if let Some(needle) = expect {
        send_expect(&mut world.context, &ixs, &[&authority, &loot_mint], needle).await;
    } else {
        send(&mut world.context, &ixs, &[&authority, &loot_mint]).await;
    }
}

#[tokio::test]
async fn happy_path_replay_wrong_signer_and_missing_ed25519() {
    let program_id = fizzcaps_onchain::ID;
    let authority = Keypair::new();
    let server = Keypair::new();
    let elf = read_so("fizzcaps_onchain");
    let mpl = read_so("mpl_token_metadata");
    let metaplex = Pubkey::from_str(METAPLEX).unwrap();
    let (programdata, program_account, programdata_account) =
        program_accounts(&program_id, &elf, &authority.pubkey());

    let mut pt = ProgramTest::default();
    pt.prefer_bpf(true);
    pt.add_account(program_id, program_account);
    pt.add_account(programdata, programdata_account);
    pt.add_account(
        metaplex,
        Account {
            lamports: Rent::default().minimum_balance(mpl.len()).max(1),
            data: mpl,
            owner: solana_sdk::bpf_loader::id(),
            executable: true,
            rent_epoch: 0,
        },
    );

    let mut context = pt.start_with_context().await;
    let payer_pk = context.payer.pubkey();
    let clock: Clock = context.banks_client.get_sysvar().await.unwrap();
    let now = clock.unix_timestamp.max(10);

    send(
        &mut context,
        &[system_instruction::transfer(
            &payer_pk,
            &authority.pubkey(),
            2_000_000_000,
        )],
        &[],
    )
    .await;

    let rent = context.banks_client.get_rent().await.unwrap();
    let bad_mint = Keypair::new();
    send(
        &mut context,
        &[
            system_instruction::create_account(
                &payer_pk,
                &bad_mint.pubkey(),
                rent.minimum_balance(MINT_LEN),
                MINT_LEN as u64,
                &spl_token::id(),
            ),
            token_ix::initialize_mint(&spl_token::id(), &bad_mint.pubkey(), &authority.pubkey(), None, 0)
                .unwrap(),
        ],
        &[&bad_mint],
    )
    .await;

    let config = pda(&program_id, &[b"fizz-config"]);
    send_expect(
        &mut context,
        &[fizz_init_ix(
            &program_id,
            &config,
            &authority.pubkey(),
            &bad_mint.pubkey(),
            &server.pubkey(),
            &programdata,
        )],
        &[&authority],
        "InvalidCapsMint",
    )
    .await;

    let caps_mint_kp = Keypair::new();
    send(
        &mut context,
        &[
            system_instruction::create_account(
                &payer_pk,
                &caps_mint_kp.pubkey(),
                rent.minimum_balance(MINT_LEN),
                MINT_LEN as u64,
                &spl_token::id(),
            ),
            token_ix::initialize_mint(
                &spl_token::id(),
                &caps_mint_kp.pubkey(),
                &authority.pubkey(),
                None,
                9,
            )
            .unwrap(),
        ],
        &[&caps_mint_kp],
    )
    .await;
    send(
        &mut context,
        &[fizz_init_ix(
            &program_id,
            &config,
            &authority.pubkey(),
            &caps_mint_kp.pubkey(),
            &server.pubkey(),
            &programdata,
        )],
        &[&authority],
    )
    .await;

    let player_caps_ata = get_associated_token_address(&authority.pubkey(), &caps_mint_kp.pubkey());
    send(
        &mut context,
        &[
            ata::create_associated_token_account(
                &payer_pk,
                &authority.pubkey(),
                &caps_mint_kp.pubkey(),
                &spl_token::id(),
            ),
            token_ix::mint_to(
                &spl_token::id(),
                &caps_mint_kp.pubkey(),
                &player_caps_ata,
                &authority.pubkey(),
                &[],
                1_000_000_000_000,
            )
            .unwrap(),
        ],
        &[&authority],
    )
    .await;

    let mut world = World {
        context,
        program_id,
        authority,
        caps_mint: caps_mint_kp.pubkey(),
        config,
        loot_mint_authority: pda(&program_id, &[b"loot-mint-auth"]),
        player_caps_ata,
        metaplex,
    };

    let happy = voucher_for(42, now, [7u8; 16]);
    run_claim(&mut world, &happy, &server, true, None).await;
    run_claim(&mut world, &happy, &server, true, Some("already in use")).await;

    let same_loot = voucher_for(42, now, [8u8; 16]);
    run_claim(&mut world, &same_loot, &server, true, Some("already in use")).await;

    let wrong = voucher_for(43, now, [9u8; 16]);
    let imposter = Keypair::new();
    run_claim(&mut world, &wrong, &imposter, true, Some("WrongVoucherSigner")).await;

    let bare = voucher_for(44, now, [10u8; 16]);
    run_claim(&mut world, &bare, &server, false, Some("MissingEd25519Ix")).await;
}
