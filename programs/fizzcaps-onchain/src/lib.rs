use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, MintTo, burn},
};
use mpl_token_metadata::{
    instructions::CreateV1CpiBuilder,
    types::{TokenStandard, Collection},
    ID as METADATA_PROGRAM_ID,
};
use solana_program::sysvar::instructions::{Instructions as SysvarInstructions, load_instruction_at_checked, load_current_index_checked};

declare_id!("GDGexnGtZPoD1aHv6qg8hjeSspujwWnxJCtdrrj2gKpP");

const CAPS_MINT_SEEDS: &[u8] = b"caps-mint";
const TREASURY_SEEDS: &[u8] = b"treasury";
const LOOT_MINT_AUTHORITY_SEEDS: &[u8] = b"loot-mint-auth";

#[program]
pub mod fizzcaps_onchain {
    use super::*;

    pub fn initialize_caps(ctx: Context<InitializeCaps>) -> Result<()> {
        let amount = 77_777_777_u64
            .checked_mul(10u64.pow(9))
            .ok_or(ProgramError::InvalidArgument)?;

        anchor_spl::token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.caps_mint.to_account_info(),
                    to: ctx.accounts.treasury_ata.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[&[CAPS_MINT_SEEDS, &[ctx.bumps.mint_authority]]],
            ),
            amount,
        )?;

        CreateV1CpiBuilder::new(&ctx.accounts.metadata_program)
            .metadata(&ctx.accounts.metadata)
            .mint(&ctx.accounts.caps_mint.to_account_info(), true)
            .authority(&ctx.accounts.mint_authority)
            .payer(&ctx.accounts.payer)
            .update_authority(&ctx.accounts.mint_authority, true)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.instructions)
            .token_standard(TokenStandard::Fungible)
            .decimals(9)
            .name("$CAPS - Atomic Fizz Caps".to_string())
            .symbol("CAPS".to_string())
            .uri("https://atomicfizzcaps.xyz/metadata/caps.json".to_string())
            .seller_fee_basis_points(0)
            .creators(vec![])
            .collection(Collection { verified: false, key: Pubkey::default() })
            .is_mutable(true)
            .primary_sale_happened(false)
            .invoke_signed(&[&[CAPS_MINT_SEEDS, &[ctx.bumps.mint_authority]]])?;

        msg!("$CAPS initialized: 77,777,777 tokens minted to treasury PDA!");

        Ok(())
    }

    pub fn revoke_mint_authority(ctx: Context<RevokeMintAuthority>) -> Result<()> {
        anchor_spl::token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::SetAuthority {
                    account_or_mint: ctx.accounts.caps_mint.to_account_info(),
                    current_authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[&[CAPS_MINT_SEEDS, &[ctx.bumps.mint_authority]]],
            ),
            anchor_spl::token::AuthorityType::MintTokens,
            None,
        )?;

        msg!("Mint authority revoked — $CAPS supply is now permanently fixed at 77,777,777!");

        Ok(())
    }

    pub fn claim_loot(ctx: Context<ClaimLoot>, voucher: LootVoucher) -> Result<()> {
        let fee_amount = 100 * 10u64.pow(9); // 100 $CAPS burn fee

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

        verify_ed25519_signature(
            &ctx.accounts.instructions_sysvar,
            &ctx.accounts.server_key.key().to_bytes(),
            &voucher.serialize(),
            &voucher.server_signature,
        )?;

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
            .collection(Collection { verified: false, key: Pubkey::default() })
            .is_mutable(false)
            .primary_sale_happened(true)
            .invoke_signed(&[&[LOOT_MINT_AUTHORITY_SEEDS, &[ctx.bumps.loot_mint_authority]]])?;

        msg!("Loot claimed by {} at ({}, {})!", ctx.accounts.player.key(), voucher.latitude, voucher.longitude);

        Ok(())
    }
}

fn verify_ed25519_signature(
    instructions_sysvar: &UncheckedAccount<'info>,
    expected_pubkey: &[u8],
    message: &[u8],
    signature: &[u8; 64],
) -> Result<()> {
    let ixns = instructions_sysvar.to_account_info();
    let current_idx = load_current_index_checked(&ixns)? as usize;
    if current_idx == 0 { return err!(ErrorCode::NoEd25519Ix); }

    let ed_ix = load_instruction_at_checked(current_idx - 1, &ixns)?;
    if ed_ix.program_id != solana_program::ed25519_program::id() {
        return err!(ErrorCode::InvalidEd25519Program);
    }

    let data = ed_ix.data;
    if data.len() < 16 || data[0] != 1 { return err!(ErrorCode::InvalidEd25519Data); }

    let pubkey_offset = u16::from_le_bytes([data[2], data[3]]) as usize;
    let sig_offset = u16::from_le_bytes([data[4], data[5]]) as usize;
    let msg_offset = u16::from_le_bytes([data[6], data[7]]) as usize;
    let msg_len = u16::from_le_bytes([data[8], data[9]]) as usize;

    if &data[pubkey_offset..pubkey_offset + 32] != expected_pubkey { return err!(ErrorCode::WrongPubkey); }
    if &data[sig_offset..sig_offset + 64] != signature { return err!(ErrorCode::WrongSignature); }
    if &data[msg_offset..msg_offset + msg_len] != message { return err!(ErrorCode::WrongMessage); }

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

impl LootVoucher {
    pub fn serialize(&self) -> Vec<u8> {
        let mut data = Vec::new();
        self.serialize(&mut Serializer::new(&mut data)).unwrap();
        data
    }
}

#[derive(Accounts)]
pub struct InitializeCaps<'info> {
    #[account(init, payer = payer, mint::decimals = 9, mint::authority = mint_authority, seeds = [CAPS_MINT_SEEDS], bump)]
    pub caps_mint: Account<'info, Mint>,
    #[account(init_if_needed, payer = payer, associated_token::mint = caps_mint, associated_token::authority = treasury)]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(seeds = [CAPS_MINT_SEEDS], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(seeds = [TREASURY_SEEDS], bump)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub instructions: UncheckedAccount<'info>,
    pub metadata_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RevokeMintAuthority<'info> {
    #[account(mut, seeds = [CAPS_MINT_SEEDS], bump)]
    pub caps_mint: Account<'info, Mint>,
    #[account(seeds = [CAPS_MINT_SEEDS], bump)]
    pub mint_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimLoot<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, associated_token::mint = caps_mint, associated_token::authority = player)]
    pub player_caps_ata: Account<'info, TokenAccount>,
    #[account(init, payer = player, mint::decimals = 0, mint::authority = loot_mint_authority)]
    pub loot_mint: Account<'info, Mint>,
    #[account(init_if_needed, payer = player, associated_token::mint = loot_mint, associated_token::authority = player)]
    pub player_loot_ata: Account<'info, TokenAccount>,
    #[account(seeds = [LOOT_MINT_AUTHORITY_SEEDS], bump)]
    pub loot_mint_authority: UncheckedAccount<'info>,
    #[account(seeds = [CAPS_MINT_SEEDS], bump)]
    pub caps_mint: Account<'info, Mint>,
    /// CHECK: Server pubkey
    pub server_key: AccountInfo<'info>,
    #[account(mut)]
    pub loot_metadata: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(address = METADATA_PROGRAM_ID)]
    pub metadata_program: UncheckedAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("No Ed25519 instruction found")]
    NoEd25519Ix,
    #[msg("Invalid Ed25519 program")]
    InvalidEd25519Program,
    #[msg("Invalid Ed25519 data")]
    InvalidEd25519Data,
    #[msg("Wrong pubkey")]
    WrongPubkey,
    #[msg("Wrong signature")]
    WrongSignature,
    #[msg("Wrong message")]
    WrongMessage,
}
