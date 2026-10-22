use anchor_lang::prelude::*;

declare_id!("PlaYer1111111111111111111111111111111111111");

#[program]
pub mod atomic_fizz_players {
    use super::*;

    pub fn init_player(ctx: Context<InitPlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        player.owner = ctx.accounts.authority.key();
        player.caps_earned = 0;
        player.xp = 0;
        player.level = 1;
        player.radiation = 0;
        player.last_event_id = "".to_string();
        player.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn record_event(
        ctx: Context<RecordEvent>,
        caps_delta: i64,
        xp_delta: i64,
        radiation_delta: i16,
        event_id: String,
    ) -> Result<()> {
        let player = &mut ctx.accounts.player;

        if caps_delta > 0 {
            player.caps_earned = player.caps_earned.saturating_add(caps_delta as u64);
        }

        if xp_delta > 0 {
            player.xp = player.xp.saturating_add(xp_delta as u64);
        }

        if radiation_delta != 0 {
            let new_rad = (player.radiation as i32) + (radiation_delta as i32);
            player.radiation = new_rad.clamp(0, u16::MAX as i32) as u16;
        }

        if player.xp / 100 > player.level as u64 {
            player.level = (player.xp / 100) as u16;
        }

        player.last_event_id = event_id;
        player.last_updated = Clock::get()?.unix_timestamp;

        Ok(())
    }
}

#[account]
pub struct Player {
    pub owner: Pubkey,
    pub caps_earned: u64,
    pub xp: u64,
    pub level: u16,
    pub radiation: u16,
    pub last_event_id: String,
    pub last_updated: i64,
}

impl Player {
    pub const MAX_LEN: usize = 32 + 8 + 8 + 2 + 2 + 4 + 64 + 8;
}

#[derive(Accounts)]
pub struct InitPlayer<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Player::MAX_LEN,
        seeds = [b"player", authority.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordEvent<'info> {
    #[account(
        mut,
        seeds = [b"player", authority.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,

    pub authority: Signer<'info>,
}
