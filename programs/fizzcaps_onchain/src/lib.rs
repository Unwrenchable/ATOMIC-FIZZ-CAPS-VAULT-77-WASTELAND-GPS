use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, burn, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::{
    instructions::CreateV1CpiBuilder,
    types::{Collection, PrintSupply, TokenStandard},
};
use anchor_lang::solana_program::{program::invoke, system_instruction};
use std::convert::TryFrom;

// Exactly one cluster feature. Cargo unions features with defaults, so an
// empty default is required: `anchor build -- --features devnet` must not
// also turn localnet on.
#[cfg(not(any(feature = "localnet", feature = "devnet", feature = "mainnet")))]
compile_error!("exactly one of features localnet, devnet, mainnet must be set");
#[cfg(any(
    all(feature = "localnet", feature = "devnet"),
    all(feature = "localnet", feature = "mainnet"),
    all(feature = "devnet", feature = "mainnet"),
))]
compile_error!("exactly one of features localnet, devnet, mainnet must be set");

#[cfg(feature = "localnet")]
declare_id!("HnWTnCKuKhJa6cXj4ZocW2D8Jtf4f5QFb6f6UnkF27FB");
#[cfg(feature = "devnet")]
declare_id!("GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc");
#[cfg(feature = "mainnet")]
declare_id!("DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP");

mod voucher;
use voucher::*;
pub use voucher::LootVoucherV1;

/// Packs claim_loot instruction data. The local-validator test calls this
/// from the host crate; nothing in the program invokes it.
pub fn pack_claim_loot(voucher: &LootVoucherV1) -> Vec<u8> {
    let mut data = vec![69, 105, 8, 13, 65, 21, 85, 238];
    data.extend_from_slice(&voucher.try_to_vec().expect("voucher"));
    data
}

/// Marker so `Program<'info, FizzcapsProgram>` resolves to this program id.
#[derive(Clone)]
pub struct FizzcapsProgram;
impl anchor_lang::Id for FizzcapsProgram {
    fn id() -> Pubkey {
        crate::ID
    }
}

// ============ SEEDS ============
const LOOT_MINT_AUTHORITY_SEEDS: &[u8] = b"loot-mint-auth";
const FIZZ_CONFIG_SEEDS: &[u8] = b"fizz-config";
const FIZZ_CURVE_SEEDS: &[u8] = b"fizz-curve";
const FIZZ_SOL_VAULT_SEEDS: &[u8] = b"fizz-sol-vault";
const FIZZ_ADMIN_SEEDS: &[u8] = b"fizz-admin";

// ============ FIZZ.FUN CONSTANTS ============
const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;
const CURVE_SUPPLY: u64 = 800_000_000_000_000_000;
const LP_RESERVE: u64 = 200_000_000_000_000_000;
const GRADUATION_SOL: u64 = 85_000_000_000;
const VIRTUAL_SOL: u64 = 30_000_000_000;
const FEE_BPS: u64 = 100;
const CAPS_DECIMALS: u64 = 1_000_000_000;
const CAPS_TO_LAUNCH: u64 = 1000 * CAPS_DECIMALS;
const CAPS_LAUNCH_FEE: u64 = 100 * CAPS_DECIMALS;
const CAPS_VETERAN_THRESHOLD: u64 = 10_000 * CAPS_DECIMALS;
const CAPS_VETERAN_FEE: u64 = 50 * CAPS_DECIMALS;
const FIZZ_CURVE_SPACE: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
/// discriminator + 4 pubkeys + 4 u64s + bump + paused
const FIZZ_CONFIG_SPACE: usize = 8 + 32 * 4 + 8 * 4 + 1 + 1;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LaunchType {
    CapsStandard,
    CapsVeteran,
    AdminUSDC,
    AdminFree,
}

impl LaunchType {
    fn requires_caps_fee(&self) -> bool {
        matches!(self, Self::CapsStandard | Self::CapsVeteran)
    }

    fn is_admin(&self) -> bool {
        matches!(self, Self::AdminUSDC | Self::AdminFree)
    }
}

fn launch_fee_for(launch_type: LaunchType) -> u64 {
    match launch_type {
        LaunchType::CapsVeteran => CAPS_VETERAN_FEE,
        LaunchType::CapsStandard => CAPS_LAUNCH_FEE,
        LaunchType::AdminUSDC | LaunchType::AdminFree => 0,
    }
}

fn calculate_buy_return(
    sol_amount: u64,
    sol_reserve: u64,
    token_reserve: u64,
) -> Result<(u64, u64, u64)> {
    let fee = sol_amount
        .checked_mul(FEE_BPS)
        .and_then(|n| n.checked_div(10_000))
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let sol_after_fee = sol_amount
        .checked_sub(fee)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    let virtual_sol = (sol_reserve as u128)
        .checked_add(VIRTUAL_SOL as u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let reserve = token_reserve as u128;
    let k = virtual_sol
        .checked_mul(reserve)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_sol = virtual_sol
        .checked_add(sol_after_fee as u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_tokens = k.checked_div(new_sol).ok_or(ErrorCode::ArithmeticOverflow)?;
    let tokens_out = reserve
        .checked_sub(new_tokens)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok((
        fee,
        sol_after_fee,
        u64::try_from(tokens_out).map_err(|_| ErrorCode::ArithmeticOverflow)?,
    ))
}

fn calculate_sell_return(
    token_amount: u64,
    sol_reserve: u64,
    token_reserve: u64,
) -> Result<(u64, u64, u64)> {
    let virtual_sol = (sol_reserve as u128)
        .checked_add(VIRTUAL_SOL as u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let reserve = token_reserve as u128;
    let k = virtual_sol
        .checked_mul(reserve)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_tokens = reserve
        .checked_add(token_amount as u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_sol = k.checked_div(new_tokens).ok_or(ErrorCode::ArithmeticOverflow)?;
    let sol_out_gross = virtual_sol
        .checked_sub(new_sol)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let capped = sol_out_gross.min(sol_reserve as u128);
    let fee = capped
        .checked_mul(FEE_BPS as u128)
        .and_then(|n| n.checked_div(10_000))
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let sol_out = capped
        .checked_sub(fee)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok((
        u64::try_from(capped).map_err(|_| ErrorCode::ArithmeticOverflow)?,
        u64::try_from(fee).map_err(|_| ErrorCode::ArithmeticOverflow)?,
        u64::try_from(sol_out).map_err(|_| ErrorCode::ArithmeticOverflow)?,
    ))
}

#[program]
pub mod fizzcaps_onchain {
    use super::*;

    // ============ LOOT CLAIM ============

    pub fn claim_loot(ctx: Context<ClaimLoot>, voucher: LootVoucherV1) -> Result<()> {
        let fee_amount = 100 * 10u64.pow(9);
        let now = Clock::get()?.unix_timestamp;

        voucher.check_shape_and_time(now)?;
        require!(!ctx.accounts.config.paused, ErrorCode::ClaimsPaused);
        require!(
            ctx.accounts.config.server_key != Pubkey::default(),
            ErrorCode::WrongVoucherSigner
        );

        let msg_bytes = voucher.message(&crate::ID, &ctx.accounts.player.key());
        verify_voucher_ed25519(
            &ctx.accounts.instructions_sysvar.to_account_info(),
            &ctx.accounts.config.server_key,
            &msg_bytes,
        )?;

        // Mint must be a fresh 0-decimal NFT. Mint and freeze authority are both
        // the loot PDA. CreateV1 clears freeze. Checked before the burn.
        let loot_mint = &ctx.accounts.loot_mint;
        require!(loot_mint.decimals == 0, ErrorCode::BadLootMint);
        require!(loot_mint.supply == 0, ErrorCode::BadLootMint);
        require!(
            loot_mint.mint_authority
                == anchor_lang::solana_program::program_option::COption::Some(
                    ctx.accounts.loot_mint_authority.key(),
                ),
            ErrorCode::BadLootMint
        );
        // CreateV1 rejects an NFT whose freeze authority is already none, then
        // clears it. The only acceptable pre-state is our PDA, so a player
        // cannot keep freeze rights after the CPI.
        require!(
            loot_mint.freeze_authority
                == anchor_lang::solana_program::program_option::COption::Some(
                    ctx.accounts.loot_mint_authority.key(),
                ),
            ErrorCode::BadLootMint
        );

        let vc = &mut ctx.accounts.voucher_claim;
        vc.voucher_id = voucher.voucher_id;
        vc.player = ctx.accounts.player.key();
        vc.loot_id = voucher.loot_id;
        vc.claimed_at = now;
        vc.bump = ctx.bumps.voucher_claim;

        let lc = &mut ctx.accounts.loot_claim;
        lc.loot_id = voucher.loot_id;
        lc.player = ctx.accounts.player.key();
        lc.voucher_id = voucher.voucher_id;
        lc.claimed_at = now;
        lc.bump = ctx.bumps.loot_claim;

        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.caps_mint.to_account_info(),
                    from: ctx.accounts.player_caps_ata.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            fee_amount,
        )?;

        let bump = ctx.bumps.loot_mint_authority;
        anchor_spl::token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.loot_mint.to_account_info(),
                    to: ctx.accounts.player_loot_ata.to_account_info(),
                    authority: ctx.accounts.loot_mint_authority.to_account_info(),
                },
                &[&[LOOT_MINT_AUTHORITY_SEEDS, &[bump]]],
            ),
            1,
        )?;

        // "Fizz Cache #" (12) + u64 decimal (at most 20) = 32. No coordinates:
        // Metaplex rejects a longer name, and the coordinates are already in the voucher.
        let name = format!("Fizz Cache #{}", voucher.loot_id);
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        let uri = format!(
            "https://atomicfizzcaps.xyz/loot/{}.json",
            voucher.loot_id
        );
        require!(uri.len() <= 200, ErrorCode::UriTooLong);

        // as_signer = false: the mint account already exists. No collection —
        // Pubkey::default() is not a collection NFT and fails CreateV1.
        CreateV1CpiBuilder::new(&ctx.accounts.metadata_program)
            .metadata(&ctx.accounts.loot_metadata)
            .mint(&ctx.accounts.loot_mint.to_account_info(), false)
            .authority(&ctx.accounts.loot_mint_authority)
            .payer(&ctx.accounts.player)
            .update_authority(&ctx.accounts.loot_mint_authority, true)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.instructions_sysvar.to_account_info())
            .spl_token_program(Some(&ctx.accounts.token_program.to_account_info()))
            .master_edition(Some(&ctx.accounts.master_edition.to_account_info()))
            .token_standard(TokenStandard::NonFungible)
            .name(name)
            .symbol("FIZZLOOT".to_string())
            .uri(uri)
            .seller_fee_basis_points(0)
            .decimals(0)
            .print_supply(PrintSupply::Zero)
            .is_mutable(false)
            .primary_sale_happened(true)
            .invoke_signed(&[&[LOOT_MINT_AUTHORITY_SEEDS, &[bump]]])?;

        ctx.accounts.loot_mint.reload()?;
        // CreateV1 moves freeze authority onto the master edition. A player key
        // must not be left holding it. PrintSupply::Zero means that edition
        // cannot print copies.
        require!(
            ctx.accounts.loot_mint.freeze_authority
                == anchor_lang::solana_program::program_option::COption::Some(
                    ctx.accounts.master_edition.key(),
                ),
            ErrorCode::BadLootMint
        );
        require!(ctx.accounts.loot_mint.supply == 1, ErrorCode::BadLootMint);

        msg!(
            "Loot #{} claimed by {} at ({}, {})",
            voucher.loot_id,
            ctx.accounts.player.key(),
            voucher.lat_e6,
            voucher.lng_e6
        );

        Ok(())
    }

    // ============ FIZZ.FUN: CONFIG / ADMIN ============

    pub fn fizz_init(ctx: Context<FizzInit>) -> Result<()> {
        // The Program account is pinned to this program id. Its ProgramData
        // must be the one the loader recorded, and that record's upgrade
        // authority must be the signer. Otherwise anyone can front-run
        // fizz_init and install their own server_key.
        let program_data_address = ctx
            .accounts
            .program
            .programdata_address()?
            .ok_or(ErrorCode::InvalidUpgradeAuthority)?;
        require_keys_eq!(
            program_data_address,
            ctx.accounts.program_data.key(),
            ErrorCode::InvalidUpgradeAuthority
        );
        require!(
            ctx.accounts.program_data.upgrade_authority_address
                == Some(ctx.accounts.authority.key()),
            ErrorCode::InvalidUpgradeAuthority
        );
        require!(
            ctx.accounts.server_key.key() != Pubkey::default(),
            ErrorCode::WrongVoucherSigner
        );
        // Existing mint, chosen by the upgrade authority. decimals == 9 is
        // also a constraint on FizzInit so a 0-decimal stand-in cannot be stored.
        require!(
            ctx.accounts.caps_mint.decimals == 9,
            ErrorCode::InvalidCapsMint
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.caps_mint = ctx.accounts.caps_mint.key();
        config.server_key = ctx.accounts.server_key.key();
        config.total_tokens_launched = 0;
        config.total_volume_sol = 0;
        config.total_caps_burned = 0;
        config.admin_usdc_launches = 0;
        config.bump = ctx.bumps.config;
        config.paused = false;

        msg!("Fizz.fun initialized! Treasury: {}", config.treasury);
        Ok(())
    }

    /// Claims must already be paused. Rotate, point the backend at the new
    /// cluster key, then unpause. See docs/deployment/CLAIM_LOOT_VOUCHER_V1.md.
    pub fn fizz_set_server_key(ctx: Context<FizzSetServerKey>, new_server_key: Pubkey) -> Result<()> {
        require!(ctx.accounts.config.paused, ErrorCode::MustPauseBeforeRotate);
        require!(
            new_server_key != Pubkey::default(),
            ErrorCode::WrongVoucherSigner
        );
        let old = ctx.accounts.config.server_key;
        ctx.accounts.config.server_key = new_server_key;
        emit!(ServerKeyRotated {
            old,
            new: new_server_key,
        });
        Ok(())
    }

    pub fn fizz_set_paused(ctx: Context<FizzSetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(ProgramPauseSet {
            paused,
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    pub fn fizz_add_admin(ctx: Context<FizzAddAdmin>) -> Result<()> {
        let admin_record = &mut ctx.accounts.admin_record;
        admin_record.admin = ctx.accounts.admin.key();
        admin_record.added_at = Clock::get()?.unix_timestamp;
        admin_record.is_active = true;
        admin_record.bump = ctx.bumps.admin_record;

        msg!("Fizz.fun admin added: {}", admin_record.admin);
        Ok(())
    }

    pub fn fizz_remove_admin(ctx: Context<FizzRemoveAdmin>) -> Result<()> {
        let admin_record = &mut ctx.accounts.admin_record;
        admin_record.is_active = false;

        msg!("Fizz.fun admin removed: {}", admin_record.admin);
        Ok(())
    }

    // ============ TOKEN CREATION ============

    pub fn fizz_create_token(
        ctx: Context<FizzCreateToken>,
        name: String,
        symbol: String,
        uri: String,
        launch_type: LaunchType,
    ) -> Result<()> {
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);
        require!(uri.len() <= 200, ErrorCode::UriTooLong);

        let config = &mut ctx.accounts.config;
        let fee_amount = launch_fee_for(launch_type);

        if launch_type.requires_caps_fee() {
            let required_balance = match launch_type {
                LaunchType::CapsVeteran => CAPS_VETERAN_THRESHOLD,
                _ => CAPS_TO_LAUNCH,
            };
            require!(
                ctx.accounts.player_caps_ata.amount >= required_balance,
                ErrorCode::InsufficientCaps
            );
            burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.caps_mint.to_account_info(),
                        from: ctx.accounts.player_caps_ata.to_account_info(),
                        authority: ctx.accounts.authority.to_account_info(),
                    },
                ),
                fee_amount,
            )?;
            config.total_caps_burned = config
                .total_caps_burned
                .checked_add(fee_amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        } else if launch_type.is_admin() {
            require!(
                ctx.accounts.authority.key() == config.authority,
                ErrorCode::UnauthorizedLaunch
            );
            config.admin_usdc_launches = config
                .admin_usdc_launches
                .checked_add(1)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        config.total_tokens_launched = config
            .total_tokens_launched
            .checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        CreateV1CpiBuilder::new(&ctx.accounts.metadata_program)
            .metadata(&ctx.accounts.metadata)
            .mint(&ctx.accounts.mint.to_account_info(), true)
            .authority(&ctx.accounts.authority)
            .payer(&ctx.accounts.authority)
            .update_authority(&ctx.accounts.authority, true)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.instructions_sysvar)
            .token_standard(TokenStandard::Fungible)
            .name(name)
            .symbol(symbol)
            .uri(uri)
            .seller_fee_basis_points(0)
            .creators(vec![])
            .collection(Collection {
                verified: false,
                key: Pubkey::default(),
            })
            .is_mutable(false)
            .primary_sale_happened(true)
            .invoke()?;

        ctx.accounts.bonding_curve.authority = ctx.accounts.authority.key();
        ctx.accounts.bonding_curve.token_mint = ctx.accounts.mint.key();
        ctx.accounts.bonding_curve.token_vault = ctx.accounts.token_vault.key();
        ctx.accounts.bonding_curve.sol_vault = ctx.accounts.sol_vault.key();
        ctx.accounts.bonding_curve.total_supply = TOTAL_SUPPLY;
        ctx.accounts.bonding_curve.lp_reserve = LP_RESERVE;
        ctx.accounts.bonding_curve.token_reserve = CURVE_SUPPLY;
        ctx.accounts.bonding_curve.sol_reserve = 0;
        ctx.accounts.bonding_curve.graduated_at = 0;
        ctx.accounts.bonding_curve.launch_type = launch_type;
        ctx.accounts.bonding_curve.bump = ctx.bumps.bonding_curve;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    FIZZ_CURVE_SEEDS,
                    ctx.accounts.mint.key().as_ref(),
                    &[ctx.accounts.bonding_curve.bump],
                ]],
            ),
            CURVE_SUPPLY,
        )?;

        msg!("Fizz.fun token created: {}", ctx.accounts.mint.key());
        Ok(())
    }

    pub fn fizz_buy_tokens(
        ctx: Context<FizzBuyTokens>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        require!(sol_amount > 0, ErrorCode::InvalidTradeAmount);
        require!(ctx.accounts.bonding_curve.graduated_at == 0, ErrorCode::BondingCurveGraduated);

        let (fee_amount, sol_after_fee, tokens_out) = calculate_buy_return(
            sol_amount,
            ctx.accounts.bonding_curve.sol_reserve,
            ctx.accounts.bonding_curve.token_reserve,
        )?;
        require!(tokens_out > 0, ErrorCode::InvalidTradeAmount);
        require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);
        require!(
            tokens_out <= ctx.accounts.bonding_curve.token_reserve,
            ErrorCode::InsufficientLiquidity
        );

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.sol_vault.key(),
                sol_amount,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.sol_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        if fee_amount > 0 {
            **ctx.accounts.sol_vault.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
            **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee_amount;
        }

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_ata.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    FIZZ_CURVE_SEEDS,
                    ctx.accounts.mint.key().as_ref(),
                    &[ctx.accounts.bonding_curve.bump],
                ]],
            ),
            tokens_out,
        )?;

        ctx.accounts.bonding_curve.sol_reserve = ctx
            .accounts
            .bonding_curve
            .sol_reserve
            .checked_add(sol_after_fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        ctx.accounts.bonding_curve.token_reserve = ctx
            .accounts
            .bonding_curve
            .token_reserve
            .checked_sub(tokens_out)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        ctx.accounts.config.total_volume_sol = ctx
            .accounts
            .config
            .total_volume_sol
            .checked_add(sol_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        if ctx.accounts.bonding_curve.graduated_at == 0
            && ctx.accounts.bonding_curve.sol_reserve >= GRADUATION_SOL
        {
            ctx.accounts.bonding_curve.graduated_at = Clock::get()?.unix_timestamp;
            msg!(
                "Fizz.fun token {} graduated! at {}",
                ctx.accounts.bonding_curve.token_mint,
                ctx.accounts.bonding_curve.graduated_at
            );
        }

        msg!(
            "Fizz.fun buy: {} lamports -> {} tokens on {}",
            sol_amount,
            tokens_out,
            ctx.accounts.bonding_curve.token_mint
        );
        Ok(())
    }

    pub fn fizz_sell_tokens(
        ctx: Context<FizzSellTokens>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        require!(token_amount > 0, ErrorCode::InvalidTradeAmount);
        require!(ctx.accounts.bonding_curve.graduated_at == 0, ErrorCode::BondingCurveGraduated);

        let (sol_before_fee, fee_amount, sol_out) = calculate_sell_return(
            token_amount,
            ctx.accounts.bonding_curve.sol_reserve,
            ctx.accounts.bonding_curve.token_reserve,
        )?;
        require!(sol_out > 0, ErrorCode::InvalidTradeAmount);
        require!(sol_out >= min_sol_out, ErrorCode::SlippageExceeded);
        require!(
            sol_before_fee <= ctx.accounts.bonding_curve.sol_reserve,
            ErrorCode::InsufficientLiquidity
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_ata.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        require!(
            ctx.accounts.sol_vault.to_account_info().lamports() >= sol_before_fee,
            ErrorCode::InsufficientLiquidity
        );

        **ctx.accounts.sol_vault.to_account_info().try_borrow_mut_lamports()? -= sol_out;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_out;
        if fee_amount > 0 {
            **ctx.accounts.sol_vault.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
            **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee_amount;
        }

        ctx.accounts.bonding_curve.sol_reserve = ctx
            .accounts
            .bonding_curve
            .sol_reserve
            .checked_sub(sol_before_fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        ctx.accounts.bonding_curve.token_reserve = ctx
            .accounts
            .bonding_curve
            .token_reserve
            .checked_add(token_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        ctx.accounts.config.total_volume_sol = ctx
            .accounts
            .config
            .total_volume_sol
            .checked_add(sol_before_fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        msg!(
            "Fizz.fun sell: {} tokens -> {} lamports on {}",
            token_amount,
            sol_out,
            ctx.accounts.bonding_curve.token_mint
        );
        Ok(())
    }
}

// ============ STRUCTS, ACCOUNTS, HELPERS, ERRORS ============

#[derive(Accounts)]
#[instruction(voucher: LootVoucherV1)]
pub struct ClaimLoot<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        seeds = [FIZZ_CONFIG_SEEDS],
        bump = config.bump,
    )]
    pub config: Account<'info, FizzConfig>,

    #[account(
        mut,
        address = config.caps_mint @ ErrorCode::InvalidCapsMint,
    )]
    pub caps_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = caps_mint,
        token::authority = player,
    )]
    pub player_caps_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub loot_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = loot_mint,
        token::authority = player,
    )]
    pub player_loot_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for minting loot NFTs. Seeds + bump enforce correctness.
    #[account(
        seeds = [LOOT_MINT_AUTHORITY_SEEDS],
        bump
    )]
    pub loot_mint_authority: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata PDA. Seeds bind it to this mint; CreateV1 fills it.
    #[account(
        mut,
        seeds = [
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            loot_mint.key().as_ref(),
        ],
        seeds::program = metadata_program,
        bump,
    )]
    pub loot_metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex master edition PDA. CreateV1 writes it for PrintSupply::Zero.
    #[account(
        mut,
        seeds = [
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            loot_mint.key().as_ref(),
            b"edition",
        ],
        seeds::program = metadata_program,
        bump,
    )]
    pub master_edition: UncheckedAccount<'info>,

    #[account(
        init,
        payer = player,
        space = VoucherClaim::SIZE,
        seeds = [VOUCHER_CLAIM_SEED, voucher.voucher_id.as_ref()],
        bump,
    )]
    pub voucher_claim: Account<'info, VoucherClaim>,

    #[account(
        init,
        payer = player,
        space = LootClaim::SIZE,
        seeds = [LOOT_CLAIM_SEED, &voucher.loot_id.to_le_bytes()],
        bump,
    )]
    pub loot_claim: Account<'info, LootClaim>,

    pub token_program: Program<'info, Token>,

    /// CHECK: Metaplex token metadata program id is pinned.
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Instructions sysvar. The id is pinned; the verifier reads it.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

#[account]
pub struct FizzConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub caps_mint: Pubkey,
    pub server_key: Pubkey,
    pub total_tokens_launched: u64,
    pub total_volume_sol: u64,
    pub total_caps_burned: u64,
    pub admin_usdc_launches: u64,
    pub bump: u8,
    /// When set, claim_loot rejects. Rotation of server_key requires this.
    pub paused: bool,
}

#[account]
pub struct FizzAdminRecord {
    pub admin: Pubkey,
    pub added_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct FizzInit<'info> {
    #[account(
        init,
        payer = authority,
        space = FIZZ_CONFIG_SPACE,
        seeds = [FIZZ_CONFIG_SEEDS],
        bump
    )]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury wallet; only its key is stored.
    pub treasury: UncheckedAccount<'info>,

    /// Existing SPL mint. The upgrade authority supplies it; this program stores
    /// the address and rejects anything other than 9 decimals.
    #[account(
        mut,
        constraint = caps_mint.decimals == 9 @ ErrorCode::InvalidCapsMint
    )]
    pub caps_mint: Account<'info, Mint>,

    /// CHECK: Off-chain server public key. The upgrade authority chooses it;
    /// the account itself only needs to exist so the key can be read.
    pub server_key: UncheckedAccount<'info>,

    pub program: Program<'info, FizzcapsProgram>,

    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FizzSetServerKey<'info> {
    #[account(mut, has_one = authority)]
    pub config: Account<'info, FizzConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FizzSetPaused<'info> {
    #[account(mut, has_one = authority)]
    pub config: Account<'info, FizzConfig>,
    pub authority: Signer<'info>,
}

#[event]
pub struct ServerKeyRotated {
    pub old: Pubkey,
    pub new: Pubkey,
}

#[event]
pub struct ProgramPauseSet {
    pub paused: bool,
    pub authority: Pubkey,
}

#[derive(Accounts)]
pub struct FizzAddAdmin<'info> {
    #[account(mut, has_one = authority)]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Admin wallet being added; only its key is stored.
    pub admin: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1 + 1,
        seeds = [FIZZ_ADMIN_SEEDS, admin.key().as_ref()],
        bump
    )]
    pub admin_record: Account<'info, FizzAdminRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FizzRemoveAdmin<'info> {
    #[account(mut, has_one = authority)]
    pub config: Account<'info, FizzConfig>,

    pub authority: Signer<'info>,

    /// CHECK: Admin wallet being removed; only its key is stored.
    pub admin: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [FIZZ_ADMIN_SEEDS, admin.key().as_ref()],
        bump = admin_record.bump
    )]
    pub admin_record: Account<'info, FizzAdminRecord>,
}

#[derive(Accounts)]
pub struct FizzCreateToken<'info> {
    #[account(mut)]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(address = config.caps_mint)]
    pub caps_mint: Account<'info, Mint>,

    #[account(mut)]
    pub player_caps_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        space = FIZZ_CURVE_SPACE,
        seeds = [FIZZ_CURVE_SEEDS, mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(
        init,
        payer = authority,
        seeds = [FIZZ_SOL_VAULT_SEEDS, mint.key().as_ref()],
        bump,
        space = 0
    )]
    /// CHECK: PDA-owned SOL vault for the curve; seeds and bump enforce the address.
    pub sol_vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: Metaplex metadata PDA for the new mint; created and validated by CPI.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve
    )]
    pub token_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: Metaplex token metadata program; CPI enforces correctness.
    pub metadata_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Instructions sysvar; read-only, used for CPI/verification.
    pub instructions_sysvar: UncheckedAccount<'info>,
}

#[account]
pub struct FizzBondingCurve {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub sol_vault: Pubkey,
    pub total_supply: u64,
    pub lp_reserve: u64,
    pub token_reserve: u64,
    pub sol_reserve: u64,
    pub graduated_at: i64,
    pub launch_type: LaunchType,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct FizzBuyTokens<'info> {
    #[account(mut)]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [FIZZ_CURVE_SEEDS, mint.key().as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(address = bonding_curve.token_mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [FIZZ_SOL_VAULT_SEEDS, mint.key().as_ref()],
        bump
    )]
    /// CHECK: Program-owned SOL vault PDA for the curve; address is derived from seeds.
    pub sol_vault: UncheckedAccount<'info>,

    // SEC-AUDIT-005: treasury must be the configured one (and writable: it receives the fee lamports)
    #[account(mut, address = config.treasury @ ErrorCode::InvalidTreasury)]
    /// CHECK: Treasury wallet receives fees.
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FizzSellTokens<'info> {
    #[account(mut)]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [FIZZ_CURVE_SEEDS, mint.key().as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(address = bonding_curve.token_mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller
    )]
    pub seller_token_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [FIZZ_SOL_VAULT_SEEDS, mint.key().as_ref()],
        bump
    )]
    /// CHECK: Program-owned SOL vault PDA for the curve; address is derived from seeds.
    pub sol_vault: UncheckedAccount<'info>,

    // SEC-AUDIT-005: treasury must be the configured one (and writable: it receives the fee lamports)
    #[account(mut, address = config.treasury @ ErrorCode::InvalidTreasury)]
    /// CHECK: Treasury wallet receives fees.
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Symbol too long")]
    SymbolTooLong,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Voucher expired")]
    VoucherExpired,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Unauthorized launch")]
    UnauthorizedLaunch,
    #[msg("Invalid trade amount")]
    InvalidTradeAmount,
    #[msg("Bonding curve has graduated")]
    BondingCurveGraduated,
    #[msg("Treasury does not match config.treasury")]
    InvalidTreasury,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Insufficient CAPS balance")]
    InsufficientCaps,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Voucher not yet valid")]
    VoucherNotYetValid,
    #[msg("Voucher TTL too long")]
    VoucherTtlTooLong,
    #[msg("Voucher failed shape checks")]
    VoucherBadShape,
    #[msg("Missing Ed25519 instruction")]
    MissingEd25519Ix,
    #[msg("Ed25519 instruction layout rejected")]
    Ed25519BadLayout,
    #[msg("Voucher signer does not match config.server_key")]
    WrongVoucherSigner,
    #[msg("Voucher message does not match the signed bytes")]
    VoucherMessageMismatch,
    #[msg("claim_loot must be a top-level instruction")]
    CpiNotAllowed,
    #[msg("CAPS mint must be the configured 9-decimal mint")]
    InvalidCapsMint,
    #[msg("Loot mint must be a fresh NFT controlled by the loot authority")]
    BadLootMint,
    #[msg("Loot claims are paused")]
    ClaimsPaused,
    #[msg("Pause claims before rotating the server key")]
    MustPauseBeforeRotate,
    #[msg("Signer is not the program upgrade authority")]
    InvalidUpgradeAuthority,
}
