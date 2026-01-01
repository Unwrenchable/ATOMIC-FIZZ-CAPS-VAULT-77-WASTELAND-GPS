#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, MintTo, Token, TokenAccount, burn, Burn},
};
use mpl_token_metadata::{
    instructions::CreateV1CpiBuilder,
    types::{Collection, TokenStandard},
    ID as METADATA_PROGRAM_ID,
};

declare_id!("DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP");

const CAPS_MINT_SEEDS: &[u8] = b"caps-mint";
const LOOT_MINT_AUTHORITY_SEEDS: &[u8] = b"loot-mint-auth";

#[program]
pub mod fizzcaps_onchain {
    use super::*;

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
            &voucher.try_to_vec()?,  // ← Correct Anchor serialization
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
}

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

    // Basic bounds checking to prevent panics
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LootVoucher {
    pub loot_id: u64,
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: i64,
    pub location_hint: String,
    pub server_signature: [u8; 64],
}

#[derive(Accounts)]
#[instruction(voucher: LootVoucher)]
pub struct ClaimLoot<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(mut)]
    pub player_caps_ata: Account<'info, TokenAccount>,

    /// Unique NFT mint per loot claim
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

    /// PDA that signs for mint & metadata
    #[account(
        seeds = [LOOT_MINT_AUTHORITY_SEEDS],
        bump
    )]
    pub loot_mint_authority: UncheckedAccount<'info>,

    #[account(seeds = [CAPS_MINT_SEEDS], bump)]
    pub caps_mint: Account<'info, Mint>,

    /// CHECK: Server verification key (should be constant/known)
    pub server_key: AccountInfo<'info>,

    /// CHECK: Metadata PDA (usually mint + metadata_program)
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