use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, burn, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::{
    instructions::CreateV1CpiBuilder,
    types::{Collection, TokenStandard},
};
use anchor_lang::solana_program::{program::invoke, system_instruction};
use std::convert::TryFrom;

declare_id!("GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc");

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

    let virtual_sol = u128::from(sol_reserve)
        .checked_add(u128::from(VIRTUAL_SOL))
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let reserve = u128::from(token_reserve);
    let k = virtual_sol
        .checked_mul(reserve)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_sol = virtual_sol
        .checked_add(u128::from(sol_after_fee))
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_tokens = k / new_sol;
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
    let virtual_sol = u128::from(sol_reserve)
        .checked_add(u128::from(VIRTUAL_SOL))
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let reserve = u128::from(token_reserve);
    let k = virtual_sol
        .checked_mul(reserve)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_tokens = reserve
        .checked_add(u128::from(token_amount))
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let new_sol = k / new_tokens;
    let sol_out_gross = virtual_sol
        .checked_sub(new_sol)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let capped = sol_out_gross.min(u128::from(sol_reserve));
    let fee = capped
        .checked_mul(u128::from(FEE_BPS))
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

    pub fn claim_loot(ctx: Context<ClaimLoot>, voucher: LootVoucher) -> Result<()> {
        let fee_amount = 100 * 10u64.pow(9);

        // Voucher TTL
        let now = Clock::get()?.unix_timestamp;
        let voucher_age = now.saturating_sub(voucher.timestamp);
        let max_age: i64 = 3600;
        require!(
            voucher_age >= 0 && voucher_age <= max_age,
            ErrorCode::VoucherExpired
        );

        // Burn CAPS fee
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

        // Verify Ed25519 signature (stub – replace with real logic if desired)
        verify_ed25519_signature(
            &ctx.accounts.instructions_sysvar,
            &ctx.accounts.server_key.key().to_bytes(),
            &voucher.try_to_vec()?,
            &voucher.server_signature,
        )?;

        // Mint Loot NFT
        anchor_spl::token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.loot_mint.to_account_info(),
                    to: ctx.accounts.player_loot_ata.to_account_info(),
                    authority: ctx.accounts.loot_mint_authority.to_account_info(),
                },
                &[&[LOOT_MINT_AUTHORITY_SEEDS, &[ctx.bumps.loot_mint_authority]]],
            ),
            1,
        )?;

        let name = format!(
            "Fizz Cache #{} @ ({:.4},{:.4}) {}",
            voucher.loot_id, voucher.latitude, voucher.longitude, voucher.location_hint
        );

        // Metadata
        CreateV1CpiBuilder::new(&ctx.accounts.metadata_program)
            .metadata(&ctx.accounts.loot_metadata)
            .mint(&ctx.accounts.loot_mint.to_account_info(), true)
            .authority(&ctx.accounts.loot_mint_authority)
            .payer(&ctx.accounts.player)
            .update_authority(&ctx.accounts.loot_mint_authority, true)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.instructions_sysvar)
            .token_standard(TokenStandard::NonFungible)
            .name(name)
            .symbol("FIZZLOOT".to_string())
            .uri(format!("https://atomicfizzcaps.xyz/loot/{}.json", voucher.loot_id))
            .seller_fee_basis_points(0)
            .creators(vec![])
            .collection(Collection {
                verified: false,
                key: Pubkey::default(),
            })
            .is_mutable(false)
            .primary_sale_happened(true)
            .invoke_signed(&[&[LOOT_MINT_AUTHORITY_SEEDS, &[ctx.bumps.loot_mint_authority]]])?;

        msg!(
            "Loot #{} claimed by {} at ({:.4}, {:.4})!",
            voucher.loot_id,
            ctx.accounts.player.key(),
            voucher.latitude,
            voucher.longitude
        );

        Ok(())
    }

    // ============ FIZZ.FUN: CONFIG / ADMIN ============

    pub fn fizz_init(ctx: Context<FizzInit>) -> Result<()> {
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

        msg!("Fizz.fun initialized! Treasury: {}", config.treasury);
        Ok(())
    }

    pub fn fizz_add_admin(ctx: Context<FizzManageAdmin>) -> Result<()> {
        let admin_record = &mut ctx.accounts.admin_record;
        admin_record.admin = ctx.accounts.admin.key();
        admin_record.added_at = Clock::get()?.unix_timestamp;
        admin_record.is_active = true;
        admin_record.bump = ctx.bumps.admin_record;

        msg!("Fizz.fun admin added: {}", admin_record.admin);
        Ok(())
    }

    pub fn fizz_remove_admin(ctx: Context<FizzManageAdmin>) -> Result<()> {
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
                "Fizz.fun token {} graduated at {}",
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LootVoucher {
    pub loot_id: u64,
    pub latitude: f64,
    pub longitude: f64,
    pub location_hint: String,
    pub timestamp: i64,
    pub server_signature: Vec<u8>,
}

// Stubbed verifier – compiles and runs, but does not enforce signatures.
// Replace with real Ed25519 verification if you want strict checks.
fn verify_ed25519_signature(
    _instructions_sysvar: &AccountInfo,
    _server_pubkey: &[u8; 32],
    _message: &[u8],
    _signature: &Vec<u8>,
) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimLoot<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(mut)]
    pub caps_mint: Account<'info, Mint>,

    #[account(mut)]
    pub player_caps_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub loot_mint: Account<'info, Mint>,

    #[account(mut)]
    pub player_loot_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for minting loot NFTs. Seeds + bump enforce correctness.
    #[account(
        seeds = [LOOT_MINT_AUTHORITY_SEEDS],
        bump
    )]
    pub loot_mint_authority: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata account for the loot mint. PDA is derived and enforced by the CPI.
    #[account(mut)]
    pub loot_metadata: UncheckedAccount<'info>,

    /// CHECK: Off-chain signer public key; only used for signature verification.
    pub server_key: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,

    /// CHECK: Metaplex token metadata program; CPI enforces correctness.
    pub metadata_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Instructions sysvar used for verification; read-only.
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
        space = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1,
        seeds = [FIZZ_CONFIG_SEEDS],
        bump
    )]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury wallet; only its key is stored.
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub caps_mint: Account<'info, Mint>,

    /// CHECK: Off-chain server public key; used only for verification.
    pub server_key: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FizzManageAdmin<'info> {
    #[account(mut, has_one = authority)]
    pub config: Account<'info, FizzConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Admin wallet being added/removed; only its key is stored.
    pub admin: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 32 + 8 + 1 + 1,
        seeds = [FIZZ_ADMIN_SEEDS, admin.key().as_ref()],
        bump
    )]
    pub admin_record: Account<'info, FizzAdminRecord>,

    pub system_program: Program<'info, System>,
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
        init_if_needed,
        payer = buyer,
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

    #[account(address = config.treasury)]
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

    #[account(address = config.treasury)]
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
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Insufficient CAPS balance")]
    InsufficientCaps,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
}
