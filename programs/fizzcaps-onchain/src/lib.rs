#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount, burn, Burn, Transfer},
};
use mpl_token_metadata::{
    instructions::CreateV1CpiBuilder,
    types::{Collection, TokenStandard},
    ID as METADATA_PROGRAM_ID,
};

declare_id!("DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP");

// ============ SEEDS ============
const CAPS_MINT_SEEDS: &[u8] = b"caps-mint";
const LOOT_MINT_AUTHORITY_SEEDS: &[u8] = b"loot-mint-auth";
const FIZZ_CONFIG_SEEDS: &[u8] = b"fizz-config";
const FIZZ_CURVE_SEEDS: &[u8] = b"fizz-curve";
const FIZZ_SOL_VAULT_SEEDS: &[u8] = b"fizz-sol-vault";
const FIZZ_ADMIN_SEEDS: &[u8] = b"fizz-admin";

// ============ FIZZ.FUN CONSTANTS ============
/// Total supply per token: 1 billion with 9 decimals
const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;
/// Tokens available in bonding curve: 800 million
const CURVE_SUPPLY: u64 = 800_000_000_000_000_000;
/// SOL needed to graduate: 85 SOL
const GRADUATION_SOL: u64 = 85_000_000_000;
/// Virtual SOL for initial price: 30 SOL
const VIRTUAL_SOL: u64 = 30_000_000_000;
/// Trading fee: 1% (100 basis points)
const FEE_BPS: u64 = 100;
/// CAPS decimals
const CAPS_DECIMALS: u64 = 1_000_000_000;
/// CAPS required to launch
const CAPS_TO_LAUNCH: u64 = 1000 * CAPS_DECIMALS;
/// Standard launch fee (burned)
const CAPS_LAUNCH_FEE: u64 = 100 * CAPS_DECIMALS;
/// Veteran threshold (10k CAPS)
const CAPS_VETERAN_THRESHOLD: u64 = 10_000 * CAPS_DECIMALS;
/// Veteran launch fee (burned)
const CAPS_VETERAN_FEE: u64 = 50 * CAPS_DECIMALS;

#[program]
pub mod fizzcaps_onchain {
    use super::*;

    // ============ EXISTING: LOOT CLAIM ============
    
    pub fn claim_loot(ctx: Context<ClaimLoot>, voucher: LootVoucher) -> Result<()> {
        let fee_amount = 100 * 10u64.pow(9);

        // 1. Burn the $CAPS fee
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

        // 2. Verify server Ed25519 signature
        verify_ed25519_signature(
            &ctx.accounts.instructions_sysvar,
            &ctx.accounts.server_key.key().to_bytes(),
            &voucher.try_to_vec()?,
            &voucher.server_signature,
        )?;

        // 3. Mint 1 Loot NFT to player
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

        // 4. Create Metadata for the NFT
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

    // ============ FIZZ.FUN: TOKEN LAUNCHPAD ============

    /// Initialize Fizz.fun configuration
    pub fn fizz_init(ctx: Context<FizzInit>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.caps_mint = ctx.accounts.caps_mint.key();
        config.total_tokens_launched = 0;
        config.total_volume_sol = 0;
        config.total_caps_burned = 0;
        config.admin_usdc_launches = 0;
        config.bump = ctx.bumps.config;
        
        msg!("Fizz.fun initialized! Treasury: {}", config.treasury);
        Ok(())
    }

    /// Add an admin (only authority)
    pub fn fizz_add_admin(ctx: Context<FizzManageAdmin>, admin: Pubkey) -> Result<()> {
        let admin_record = &mut ctx.accounts.admin_record;
        admin_record.admin = admin;
        admin_record.added_at = Clock::get()?.unix_timestamp;
        admin_record.is_active = true;
        admin_record.bump = ctx.bumps.admin_record;
        
        msg!("Fizz.fun admin added: {}", admin);
        Ok(())
    }

    /// Launch a new token (requires 1000+ CAPS)
    /// Name/symbol/uri emitted in event for off-chain indexing (saves rent!)
    pub fn fizz_create_token(
        ctx: Context<FizzCreateToken>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        // Validate inputs
        require!(name.len() <= 32, FizzError::NameTooLong);
        require!(symbol.len() <= 10, FizzError::SymbolTooLong);
        require!(uri.len() <= 200, FizzError::UriTooLong);

        // 1. Verify CAPS balance >= 1000
        let caps_balance = ctx.accounts.creator_caps_ata.amount;
        require!(caps_balance >= CAPS_TO_LAUNCH, FizzError::InsufficientCapsToLaunch);

        // 2. Calculate launch fee (veterans get discount)
        let launch_fee = if caps_balance >= CAPS_VETERAN_THRESHOLD {
            CAPS_VETERAN_FEE
        } else {
            CAPS_LAUNCH_FEE
        };

        // 3. Burn CAPS launch fee
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.caps_mint.to_account_info(),
                    from: ctx.accounts.creator_caps_ata.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            launch_fee,
        )?;

        // 4. Initialize bonding curve (minimal on-chain data for cheap rent)
        let curve = &mut ctx.accounts.bonding_curve;
        curve.creator = ctx.accounts.creator.key();
        curve.token_mint = ctx.accounts.token_mint.key();
        curve.sol_reserve = 0;
        curve.token_reserve = CURVE_SUPPLY;
        curve.graduated = false;
        curve.created_at = Clock::get()?.unix_timestamp;
        curve.launch_type = FizzLaunchType::CapsStandard;
        curve.bump = ctx.bumps.bonding_curve;

        // 5. Mint total supply to curve vault
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    FIZZ_CURVE_SEEDS,
                    ctx.accounts.token_mint.key().as_ref(),
                    &[curve.bump],
                ]],
            ),
            TOTAL_SUPPLY,
        )?;

        // 6. Update config
        let config = &mut ctx.accounts.config;
        config.total_tokens_launched += 1;
        config.total_caps_burned += launch_fee;

        emit!(FizzTokenCreated {
            mint: ctx.accounts.token_mint.key(),
            creator: ctx.accounts.creator.key(),
            name,
            symbol,
            launch_type: FizzLaunchType::CapsStandard,
            caps_burned: launch_fee,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Admin launch with USDC (pre-mainnet bootstrap)
    pub fn fizz_create_token_admin(
        ctx: Context<FizzCreateTokenAdmin>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        require!(name.len() <= 32, FizzError::NameTooLong);
        require!(symbol.len() <= 10, FizzError::SymbolTooLong);
        require!(uri.len() <= 200, FizzError::UriTooLong);
        require!(ctx.accounts.admin_record.is_active, FizzError::AdminInactive);

        // Initialize bonding curve (minimal on-chain data, no CAPS burn for admin)
        let curve = &mut ctx.accounts.bonding_curve;
        curve.creator = ctx.accounts.creator.key();
        curve.token_mint = ctx.accounts.token_mint.key();
        curve.sol_reserve = 0;
        curve.token_reserve = CURVE_SUPPLY;
        curve.graduated = false;
        curve.created_at = Clock::get()?.unix_timestamp;
        curve.launch_type = FizzLaunchType::AdminUSDC; // Clearly marked!
        curve.bump = ctx.bumps.bonding_curve;

        // Mint total supply to curve vault
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    FIZZ_CURVE_SEEDS,
                    ctx.accounts.token_mint.key().as_ref(),
                    &[curve.bump],
                ]],
            ),
            TOTAL_SUPPLY,
        )?;

        // Update config
        let config = &mut ctx.accounts.config;
        config.total_tokens_launched += 1;
        config.admin_usdc_launches += 1;

        emit!(FizzTokenCreatedAdmin {
            mint: ctx.accounts.token_mint.key(),
            creator: ctx.accounts.creator.key(),
            name,
            symbol,
            launch_type: FizzLaunchType::AdminUSDC,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Buy tokens from bonding curve (NO CAPS REQUIRED - anyone can trade!)
    pub fn fizz_buy(ctx: Context<FizzBuyTokens>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.bonding_curve;
        require!(!curve.graduated, FizzError::TokenGraduated);
        require!(sol_amount > 0, FizzError::ZeroAmount);

        // Calculate fee (1%)
        let fee = sol_amount.checked_mul(FEE_BPS).unwrap().checked_div(10000).unwrap();
        let sol_after_fee = sol_amount.checked_sub(fee).unwrap();

        // Calculate tokens out (constant product AMM)
        let virtual_sol = curve.sol_reserve.checked_add(VIRTUAL_SOL).unwrap();
        let k = virtual_sol.checked_mul(curve.token_reserve).unwrap();
        let new_sol = virtual_sol.checked_add(sol_after_fee).unwrap();
        let new_tokens = k.checked_div(new_sol).unwrap();
        let tokens_out = curve.token_reserve.checked_sub(new_tokens).unwrap();

        require!(tokens_out >= min_tokens_out, FizzError::SlippageExceeded);
        require!(tokens_out <= curve.token_reserve, FizzError::InsufficientLiquidity);

        // Transfer SOL from buyer to curve vault
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.curve_sol_vault.to_account_info(),
                },
            ),
            sol_after_fee,
        )?;

        // Transfer fee to treasury
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;

        // Transfer tokens to buyer
        let curve_bump = curve.bump;
        let token_mint_key = curve.token_mint;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.curve_token_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_ata.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    FIZZ_CURVE_SEEDS,
                    token_mint_key.as_ref(),
                    &[curve_bump],
                ]],
            ),
            tokens_out,
        )?;

        // Update state
        curve.sol_reserve = curve.sol_reserve.checked_add(sol_after_fee).unwrap();
        curve.token_reserve = curve.token_reserve.checked_sub(tokens_out).unwrap();

        let config = &mut ctx.accounts.config;
        config.total_volume_sol = config.total_volume_sol.checked_add(sol_amount).unwrap();

        // Check graduation
        if curve.sol_reserve >= GRADUATION_SOL {
            emit!(FizzReadyToGraduate {
                mint: curve.token_mint,
                sol_raised: curve.sol_reserve,
            });
        }

        emit!(FizzTokenBought {
            mint: curve.token_mint,
            buyer: ctx.accounts.buyer.key(),
            sol_amount: sol_after_fee,
            tokens_received: tokens_out,
        });

        Ok(())
    }

    /// Sell tokens back to curve (NO CAPS REQUIRED)
    pub fn fizz_sell(ctx: Context<FizzSellTokens>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.bonding_curve;
        require!(!curve.graduated, FizzError::TokenGraduated);
        require!(token_amount > 0, FizzError::ZeroAmount);

        // Calculate SOL out
        let virtual_sol = curve.sol_reserve.checked_add(VIRTUAL_SOL).unwrap();
        let k = virtual_sol.checked_mul(curve.token_reserve).unwrap();
        let new_tokens = curve.token_reserve.checked_add(token_amount).unwrap();
        let new_sol = k.checked_div(new_tokens).unwrap();
        let sol_out_gross = virtual_sol.checked_sub(new_sol).unwrap();
        let sol_out_gross = std::cmp::min(sol_out_gross, curve.sol_reserve);

        // Calculate fee
        let fee = sol_out_gross.checked_mul(FEE_BPS).unwrap().checked_div(10000).unwrap();
        let sol_out = sol_out_gross.checked_sub(fee).unwrap();

        require!(sol_out >= min_sol_out, FizzError::SlippageExceeded);

        // Transfer tokens to curve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_ata.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Transfer SOL to seller (from PDA)
        **ctx.accounts.curve_sol_vault.try_borrow_mut_lamports()? -= sol_out;
        **ctx.accounts.seller.try_borrow_mut_lamports()? += sol_out;

        // Transfer fee to treasury
        **ctx.accounts.curve_sol_vault.try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += fee;

        // Update state
        curve.sol_reserve = curve.sol_reserve.checked_sub(sol_out_gross).unwrap();
        curve.token_reserve = curve.token_reserve.checked_add(token_amount).unwrap();

        emit!(FizzTokenSold {
            mint: curve.token_mint,
            seller: ctx.accounts.seller.key(),
            tokens_sold: token_amount,
            sol_received: sol_out,
        });

        Ok(())
    }

    /// Graduate token to LP (when 85 SOL reached)
    pub fn fizz_graduate(ctx: Context<FizzGraduate>) -> Result<()> {
        let curve = &mut ctx.accounts.bonding_curve;
        require!(!curve.graduated, FizzError::AlreadyGraduated);
        require!(curve.sol_reserve >= GRADUATION_SOL, FizzError::NotReadyToGraduate);

        // Creator bonus (7%)
        let creator_bonus = curve.sol_reserve.checked_mul(7).unwrap().checked_div(100).unwrap();

        // Transfer bonus to creator
        **ctx.accounts.curve_sol_vault.try_borrow_mut_lamports()? -= creator_bonus;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += creator_bonus;

        // Mark graduated
        curve.graduated = true;
        curve.graduated_at = Some(Clock::get()?.unix_timestamp);

        emit!(FizzTokenGraduated {
            mint: curve.token_mint,
            creator: curve.creator,
            sol_raised: curve.sol_reserve,
            creator_bonus,
        });

        msg!("🎓 {} graduated! Creator bonus: {} lamports", curve.symbol, creator_bonus);
        Ok(())
    }
}

// ============ HELPER FUNCTIONS ============

fn verify_ed25519_signature<'info>(
    instructions_sysvar: &AccountInfo<'info>,
    expected_pubkey: &[u8],
    message: &[u8],
    signature: &[u8; 64],
) -> Result<()> {
    use anchor_lang::solana_program::sysvar::instructions::{
        load_current_index_checked,
        load_instruction_at_checked,
    };

    let current_idx = load_current_index_checked(instructions_sysvar)? as usize;
    if current_idx == 0 {
        return err!(ErrorCode::NoEd25519Ix);
    }

    let ed_ix = load_instruction_at_checked(current_idx - 1, instructions_sysvar)?;
    if ed_ix.program_id != anchor_lang::solana_program::ed25519_program::id() {
        return err!(ErrorCode::InvalidEd25519Program);
    }

    let data = ed_ix.data;
    if data.len() < 16 || data[0] != 1 {
        return err!(ErrorCode::InvalidEd25519Data);
    }

    let pubkey_offset = u16::from_le_bytes([data[2], data[3]]) as usize;
    let sig_offset = u16::from_le_bytes([data[4], data[5]]) as usize;
    let msg_offset = u16::from_le_bytes([data[6], data[7]]) as usize;
    let msg_len = u16::from_le_bytes([data[8], data[9]]) as usize;

    if pubkey_offset + 32 > data.len()
        || sig_offset + 64 > data.len()
        || msg_offset + msg_len > data.len()
    {
        return err!(ErrorCode::InvalidEd25519Data);
    }

    if &data[pubkey_offset..pubkey_offset + 32] != expected_pubkey {
        return err!(ErrorCode::WrongPubkey);
    }
    if &data[sig_offset..sig_offset + 64] != signature {
        return err!(ErrorCode::WrongSignature);
    }
    if &data[msg_offset..msg_offset + msg_len] != message {
        return err!(ErrorCode::WrongMessage);
    }

    Ok(())
}

// ============ DATA STRUCTURES ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LootVoucher {
    pub loot_id: u64,
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: i64,
    pub location_hint: String,
    pub server_signature: [u8; 64],
}

/// Launch type for transparency (stored on-chain)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum FizzLaunchType {
    CapsStandard,  // Regular launch (100 CAPS burned)
    CapsVeteran,   // Veteran launch (50 CAPS burned)
    AdminUSDC,     // Admin bootstrap (USDC paid off-chain)
    AdminFree,     // Official tokens
}

/// Fizz.fun global config
#[account]
pub struct FizzConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub caps_mint: Pubkey,
    pub total_tokens_launched: u64,
    pub total_volume_sol: u64,
    pub total_caps_burned: u64,
    pub admin_usdc_launches: u64,
    pub bump: u8,
}

/// Admin record
#[account]
pub struct FizzAdminRecord {
    pub admin: Pubkey,
    pub added_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

/// Bonding curve state - OPTIMIZED for minimal rent (~0.002 SOL)
/// Name, symbol, URI stored off-chain (indexed from events)
#[account]
pub struct FizzBondingCurve {
    pub creator: Pubkey,      // 32 bytes
    pub token_mint: Pubkey,   // 32 bytes
    pub sol_reserve: u64,     // 8 bytes
    pub token_reserve: u64,   // 8 bytes
    pub graduated: bool,      // 1 byte
    pub created_at: i64,      // 8 bytes
    pub launch_type: FizzLaunchType, // 1 byte
    pub bump: u8,             // 1 byte
    // TOTAL: 8 (discriminator) + 32 + 32 + 8 + 8 + 1 + 8 + 1 + 1 = 99 bytes
    // Rent: ~0.0016 SOL
}

// ============ ACCOUNT CONTEXTS ============

#[derive(Accounts)]
#[instruction(voucher: LootVoucher)]
pub struct ClaimLoot<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(mut)]
    pub player_caps_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = player,
        mint::decimals = 0,
        mint::authority = loot_mint_authority,
        seeds = [LOOT_MINT_AUTHORITY_SEEDS, voucher.loot_id.to_le_bytes().as_ref()],
        bump
    )]
    pub loot_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = loot_mint,
        associated_token::authority = player
    )]
    pub player_loot_ata: Account<'info, TokenAccount>,

    #[account(seeds = [LOOT_MINT_AUTHORITY_SEEDS], bump)]
    pub loot_mint_authority: UncheckedAccount<'info>,

    #[account(seeds = [CAPS_MINT_SEEDS], bump)]
    pub caps_mint: Account<'info, Mint>,

    /// CHECK: Server verification key
    pub server_key: AccountInfo<'info>,

    /// CHECK: Metadata PDA
    #[account(mut)]
    pub loot_metadata: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(address = METADATA_PROGRAM_ID)]
    pub metadata_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct FizzInit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1,
        seeds = [FIZZ_CONFIG_SEEDS],
        bump
    )]
    pub config: Account<'info, FizzConfig>,

    /// CHECK: Treasury wallet
    pub treasury: AccountInfo<'info>,

    pub caps_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(admin: Pubkey)]
pub struct FizzManageAdmin<'info> {
    #[account(mut, constraint = config.authority == authority.key() @ FizzError::NotAuthority)]
    pub authority: Signer<'info>,

    #[account(seeds = [FIZZ_CONFIG_SEEDS], bump = config.bump)]
    pub config: Account<'info, FizzConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1 + 1,
        seeds = [FIZZ_ADMIN_SEEDS, admin.as_ref()],
        bump
    )]
    pub admin_record: Account<'info, FizzAdminRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct FizzCreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut, seeds = [FIZZ_CONFIG_SEEDS], bump = config.bump)]
    pub config: Account<'info, FizzConfig>,

    #[account(
        mut,
        associated_token::mint = caps_mint,
        associated_token::authority = creator,
    )]
    pub creator_caps_ata: Account<'info, TokenAccount>,

    #[account(mut, address = config.caps_mint)]
    pub caps_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = bonding_curve,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 1 + 1, // 99 bytes = ~0.0016 SOL rent
        seeds = [FIZZ_CURVE_SEEDS, token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve,
    )]
    pub curve_token_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct FizzCreateTokenAdmin<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut, seeds = [FIZZ_CONFIG_SEEDS], bump = config.bump)]
    pub config: Account<'info, FizzConfig>,

    #[account(
        seeds = [FIZZ_ADMIN_SEEDS, creator.key().as_ref()],
        bump = admin_record.bump,
        constraint = admin_record.is_active @ FizzError::AdminInactive
    )]
    pub admin_record: Account<'info, FizzAdminRecord>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = bonding_curve,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 1 + 1, // 99 bytes = ~0.0016 SOL rent
        seeds = [FIZZ_CURVE_SEEDS, token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve,
    )]
    pub curve_token_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FizzBuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut, seeds = [FIZZ_CONFIG_SEEDS], bump = config.bump)]
    pub config: Account<'info, FizzConfig>,

    #[account(
        mut,
        seeds = [FIZZ_CURVE_SEEDS, bonding_curve.token_mint.as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(mut, seeds = [FIZZ_SOL_VAULT_SEEDS, bonding_curve.token_mint.as_ref()], bump)]
    pub curve_sol_vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    /// CHECK: Treasury
    #[account(mut, address = config.treasury)]
    pub treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FizzSellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [FIZZ_CURVE_SEEDS, bonding_curve.token_mint.as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(mut, seeds = [FIZZ_SOL_VAULT_SEEDS, bonding_curve.token_mint.as_ref()], bump)]
    pub curve_sol_vault: AccountInfo<'info>,

    #[account(mut)]
    pub seller_token_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    /// CHECK: Treasury
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FizzGraduate<'info> {
    #[account(
        mut,
        seeds = [FIZZ_CURVE_SEEDS, bonding_curve.token_mint.as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, FizzBondingCurve>,

    /// CHECK: Creator gets bonus
    #[account(mut, address = bonding_curve.creator)]
    pub creator: AccountInfo<'info>,

    /// CHECK: SOL vault
    #[account(mut, seeds = [FIZZ_SOL_VAULT_SEEDS, bonding_curve.token_mint.as_ref()], bump)]
    pub curve_sol_vault: AccountInfo<'info>,

    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

// ============ EVENTS ============

#[event]
pub struct FizzTokenCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub launch_type: FizzLaunchType,
    pub caps_burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct FizzTokenCreatedAdmin {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub launch_type: FizzLaunchType,
    pub timestamp: i64,
}

#[event]
pub struct FizzTokenBought {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
}

#[event]
pub struct FizzTokenSold {
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub tokens_sold: u64,
    pub sol_received: u64,
}

#[event]
pub struct FizzReadyToGraduate {
    pub mint: Pubkey,
    pub sol_raised: u64,
}

#[event]
pub struct FizzTokenGraduated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub sol_raised: u64,
    pub creator_bonus: u64,
}

// ============ ERRORS ============

#[error_code]
pub enum ErrorCode {
    #[msg("No Ed25519 Verify instruction found in transaction")]
    NoEd25519Ix,
    #[msg("Instruction is not from the Ed25519 program")]
    InvalidEd25519Program,
    #[msg("Invalid Ed25519 instruction data format")]
    InvalidEd25519Data,
    #[msg("Ed25519 pubkey does not match expected server key")]
    WrongPubkey,
    #[msg("Ed25519 signature does not match")]
    WrongSignature,
    #[msg("Ed25519 signed message does not match voucher")]
    WrongMessage,
}

#[error_code]
pub enum FizzError {
    #[msg("Must hold at least 1000 CAPS to launch tokens")]
    InsufficientCapsToLaunch,
    #[msg("Token has already graduated")]
    TokenGraduated,
    #[msg("Token has already graduated")]
    AlreadyGraduated,
    #[msg("Token needs 85 SOL to graduate")]
    NotReadyToGraduate,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Not authorized")]
    NotAuthority,
    #[msg("Admin is inactive")]
    AdminInactive,
    #[msg("Name too long (max 32)")]
    NameTooLong,
    #[msg("Symbol too long (max 10)")]
    SymbolTooLong,
    #[msg("URI too long (max 200)")]
    UriTooLong,
}