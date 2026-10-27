//! On-chain loot voucher v1.
//!
//! The signed bytes are rebuilt here. The Ed25519 precompile verifies the
//! signature; this module only checks that the preceding instruction is that
//! precompile, that every offset lives in *that* instruction, and that the
//! pubkey and message match program state. Offsets are read from the header.
//! A duplicate copy of this program elsewhere treated the signature offset as
//! the pubkey offset — do not do that.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use crate::ErrorCode;
use solana_sdk_ids::ed25519_program;
use solana_sha256_hasher::hash;

pub const VOUCHER_DOMAIN: &[u8; 24] = b"FIZZCAPS:LOOT_VOUCHER:v1";
pub const VOUCHER_MSG_LEN: usize = 169;
pub const MAX_HINT_LEN: usize = 64;
/// Security override of the original 3600s draft. A voucher is dead after 5 minutes.
pub const MAX_VOUCHER_TTL_SECS: i64 = 300;
pub const MAX_CLOCK_SKEW_SECS: i64 = 30;

pub const CLUSTER_TAG: u8 = if cfg!(feature = "mainnet") {
    1
} else if cfg!(feature = "devnet") {
    2
} else {
    3
};

pub const VOUCHER_CLAIM_SEED: &[u8] = b"voucher-claim";
pub const LOOT_CLAIM_SEED: &[u8] = b"loot-claim";

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LootVoucherV1 {
    pub voucher_id: [u8; 16],
    pub loot_id: u64,
    pub lat_e6: i32,
    pub lng_e6: i32,
    /// Plaintext hint, max 64 bytes. The message commits sha256(hint), not the text.
    pub location_hint: String,
    pub issued_at: i64,
    pub expires_at: i64,
}

impl LootVoucherV1 {
    pub fn check_shape_and_time(&self, now: i64) -> Result<()> {
        require!(
            self.location_hint.len() <= MAX_HINT_LEN,
            ErrorCode::VoucherBadShape
        );
        require!(
            (-90_000_000..=90_000_000).contains(&self.lat_e6),
            ErrorCode::VoucherBadShape
        );
        require!(
            (-180_000_000..=180_000_000).contains(&self.lng_e6),
            ErrorCode::VoucherBadShape
        );
        require!(self.expires_at > self.issued_at, ErrorCode::VoucherBadShape);
        require!(
            self.expires_at - self.issued_at <= MAX_VOUCHER_TTL_SECS,
            ErrorCode::VoucherTtlTooLong
        );
        require!(
            self.issued_at <= now.saturating_add(MAX_CLOCK_SKEW_SECS),
            ErrorCode::VoucherNotYetValid
        );
        require!(now <= self.expires_at, ErrorCode::VoucherExpired);
        Ok(())
    }

    pub fn message(&self, program_id: &Pubkey, player: &Pubkey) -> [u8; VOUCHER_MSG_LEN] {
        let mut m = [0u8; VOUCHER_MSG_LEN];
        let mut o = 0usize;
        let mut put = |b: &[u8]| {
            m[o..o + b.len()].copy_from_slice(b);
            o += b.len();
        };
        put(VOUCHER_DOMAIN);
        put(&[CLUSTER_TAG]);
        put(program_id.as_ref());
        put(player.as_ref());
        put(&self.voucher_id);
        put(&self.loot_id.to_le_bytes());
        put(&self.lat_e6.to_le_bytes());
        put(&self.lng_e6.to_le_bytes());
        put(hash(self.location_hint.as_bytes()).as_ref());
        put(&self.issued_at.to_le_bytes());
        put(&self.expires_at.to_le_bytes());
        debug_assert_eq!(o, VOUCHER_MSG_LEN);
        m
    }
}

/// Pure parser. Returns (pubkey, signature, message) slices inside `d`.
/// Header (web3.js `Ed25519Program.createInstructionWithPublicKey`):
///   byte 0 num_sigs, byte 1 pad, then one 14-byte offset record of u16s:
///   sig_off, sig_ix, pk_off, pk_ix, msg_off, msg_len, msg_ix.
pub fn parse_ed25519_ix_data(d: &[u8]) -> Result<(&[u8], &[u8], &[u8])> {
    require!(d.len() >= 16, ErrorCode::Ed25519BadLayout);
    require!(d[0] == 1, ErrorCode::Ed25519BadLayout);
    let rd = |o: usize| u16::from_le_bytes([d[o], d[o + 1]]);
    let (sig_off, sig_ix) = (rd(2) as usize, rd(4));
    let (pk_off, pk_ix) = (rd(6) as usize, rd(8));
    let (msg_off, msg_len, msg_ix) = (rd(10) as usize, rd(12) as usize, rd(14));
    require!(
        sig_ix == u16::MAX && pk_ix == u16::MAX && msg_ix == u16::MAX,
        ErrorCode::Ed25519BadLayout
    );
    // The signed payload is a fixed 169-byte voucher. A shorter or longer
    // slice is a different message, even if a prefix happens to match.
    require!(msg_len == VOUCHER_MSG_LEN, ErrorCode::Ed25519BadLayout);
    let pk = checked_slice(d, pk_off, 32)?;
    let sig = checked_slice(d, sig_off, 64)?;
    let msg = checked_slice(d, msg_off, msg_len)?;
    Ok((pk, sig, msg))
}

pub fn checked_slice(d: &[u8], off: usize, len: usize) -> Result<&[u8]> {
    let end = off
        .checked_add(len)
        .ok_or(error!(ErrorCode::Ed25519BadLayout))?;
    d.get(off..end).ok_or(error!(ErrorCode::Ed25519BadLayout))
}

pub fn verify_voucher_ed25519(
    ix_sysvar: &AccountInfo,
    expected_signer: &Pubkey,
    expected_msg: &[u8],
) -> Result<()> {
    require!(
        expected_msg.len() == VOUCHER_MSG_LEN,
        ErrorCode::VoucherMessageMismatch
    );
    let cur = load_current_index_checked(ix_sysvar)? as usize;
    let cur_ix = load_instruction_at_checked(cur, ix_sysvar)?;
    // CPI into this program would show the caller's program id here.
    require_keys_eq!(cur_ix.program_id, crate::ID, ErrorCode::CpiNotAllowed);
    require!(cur > 0, ErrorCode::MissingEd25519Ix);
    let ed = load_instruction_at_checked(cur - 1, ix_sysvar)?;
    require_keys_eq!(
        ed.program_id,
        ed25519_program::ID,
        ErrorCode::MissingEd25519Ix
    );
    require!(ed.accounts.is_empty(), ErrorCode::Ed25519BadLayout);
    let (pk, _sig, msg) = parse_ed25519_ix_data(&ed.data)?;
    require!(pk == expected_signer.as_ref(), ErrorCode::WrongVoucherSigner);
    require!(msg == expected_msg, ErrorCode::VoucherMessageMismatch);
    Ok(())
}

#[account]
pub struct VoucherClaim {
    pub voucher_id: [u8; 16],
    pub player: Pubkey,
    pub loot_id: u64,
    pub claimed_at: i64,
    pub bump: u8,
}

impl VoucherClaim {
    pub const SIZE: usize = 8 + 16 + 32 + 8 + 8 + 1;
}

/// One successful mint per loot_id. A second voucher for the same cache
/// cannot init this PDA, so it cannot mint a second NFT.
#[account]
pub struct LootClaim {
    pub loot_id: u64,
    pub player: Pubkey,
    pub voucher_id: [u8; 16],
    pub claimed_at: i64,
    pub bump: u8,
}

impl LootClaim {
    pub const SIZE: usize = 8 + 8 + 32 + 16 + 8 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::solana_program::{
        account_info::AccountInfo,
        pubkey::Pubkey,
        sysvar::instructions::{
            self, construct_instructions_data, store_current_index_checked, BorrowedAccountMeta,
            BorrowedInstruction,
        },
    };
    #[cfg(feature = "localnet")]
    use std::str::FromStr;

    fn assert_code(err: anchor_lang::error::Error, expected: ErrorCode) {
        let got = match &err {
            anchor_lang::error::Error::AnchorError(e) => e.error_code_number,
            anchor_lang::error::Error::ProgramError(e) => {
                panic!("unexpected program error: {e:?}")
            }
        };
        let want: anchor_lang::error::Error = expected.into();
        let want = match want {
            anchor_lang::error::Error::AnchorError(e) => e.error_code_number,
            anchor_lang::error::Error::ProgramError(_) => panic!("expected anchor error"),
        };
        assert_eq!(got, want, "{err:?}");
    }

    #[cfg(feature = "localnet")]
    fn hex_decode(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[cfg(feature = "localnet")]
    fn json_string(json: &str, key: &str) -> String {
        let pat = format!("\"{key}\":");
        let i = json.find(&pat).unwrap_or_else(|| panic!("missing {key}"));
        let rest = json[i + pat.len()..].trim_start();
        assert!(rest.starts_with('"'), "{key}");
        let end = rest[1..].find('"').unwrap();
        rest[1..1 + end].to_string()
    }

    #[cfg(feature = "localnet")]
    fn json_i64(json: &str, key: &str) -> i64 {
        let pat = format!("\"{key}\":");
        let i = json.find(&pat).unwrap_or_else(|| panic!("missing {key}"));
        let rest = json[i + pat.len()..].trim_start();
        let end = rest
            .find(|c: char| c != '-' && !c.is_ascii_digit())
            .unwrap();
        rest[..end].parse().unwrap()
    }

    fn sample(issued: i64, expires: i64) -> LootVoucherV1 {
        LootVoucherV1 {
            voucher_id: [7u8; 16],
            loot_id: 42,
            lat_e6: 37_774_929,
            lng_e6: -122_419_416,
            location_hint: "Cinder Basin Cache".to_string(),
            issued_at: issued,
            expires_at: expires,
        }
    }

    fn ed25519_data(pubkey: &[u8], signature: &[u8], message: &[u8], index: u16) -> Vec<u8> {
        assert_eq!(pubkey.len(), 32);
        assert_eq!(signature.len(), 64);
        let pk_off: u16 = 16;
        let sig_off: u16 = 48;
        let msg_off: u16 = 112;
        let mut data = vec![0u8; msg_off as usize + message.len()];
        data[0] = 1;
        let put = |d: &mut [u8], o: usize, v: u16| {
            d[o..o + 2].copy_from_slice(&v.to_le_bytes());
        };
        put(&mut data, 2, sig_off);
        put(&mut data, 4, index);
        put(&mut data, 6, pk_off);
        put(&mut data, 8, index);
        put(&mut data, 10, msg_off);
        put(&mut data, 12, message.len() as u16);
        put(&mut data, 14, index);
        data[16..48].copy_from_slice(pubkey);
        data[48..112].copy_from_slice(signature);
        data[112..].copy_from_slice(message);
        data
    }

    fn finish_verify(
        borrowed: &[BorrowedInstruction],
        current: u16,
        signer: &Pubkey,
        msg: &[u8],
    ) -> Result<()> {
        let mut raw = construct_instructions_data(borrowed);
        #[allow(deprecated)]
        store_current_index_checked(&mut raw, current).unwrap();
        let mut lamports = 0u64;
        let key = instructions::ID;
        let owner = anchor_lang::solana_program::system_program::ID;
        let ai = AccountInfo::new(
            &key,
            false,
            false,
            &mut lamports,
            &mut raw,
            &owner,
            false,
            0,
        );
        verify_voucher_ed25519(&ai, signer, msg)
    }

    fn run_verify(
        program_ids: &[Pubkey],
        datas: &[Vec<u8>],
        current: u16,
        signer: &Pubkey,
        msg: &[u8],
    ) -> Result<()> {
        let borrowed: Vec<BorrowedInstruction> = program_ids
            .iter()
            .zip(datas.iter())
            .map(|(pid, data)| BorrowedInstruction {
                program_id: pid,
                accounts: Vec::new(),
                data: data.as_slice(),
            })
            .collect();
        finish_verify(&borrowed, current, signer, msg)
    }

    #[test]
    fn t_u2_message_is_169_and_hint_cap() {
        let v = sample(1_700_000_000, 1_700_000_300);
        let msg = v.message(&crate::ID, &Pubkey::default());
        assert_eq!(msg.len(), 169);
        let mut long = sample(1_700_000_000, 1_700_000_300);
        long.location_hint = "x".repeat(64);
        assert!(long.check_shape_and_time(1_700_000_100).is_ok());
        assert_eq!(long.message(&crate::ID, &Pubkey::default()).len(), 169);
        long.location_hint = "x".repeat(65);
        assert_code(
            long.check_shape_and_time(1_700_000_100).unwrap_err(),
            ErrorCode::VoucherBadShape,
        );
    }

    #[test]
    fn t_u4_parser_rejects_bad_layouts() {
        assert_code(
            parse_ed25519_ix_data(&[0u8; 15]).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
        let mut zero = ed25519_data(&[1u8; 32], &[2u8; 64], &[3u8; 169], u16::MAX);
        zero[0] = 0;
        assert_code(
            parse_ed25519_ix_data(&zero).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
        zero[0] = 2;
        assert_code(
            parse_ed25519_ix_data(&zero).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
        let foreign = ed25519_data(&[1u8; 32], &[2u8; 64], &[3u8; 169], 1);
        assert_code(
            parse_ed25519_ix_data(&foreign).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
        let mut short_msg = ed25519_data(&[1u8; 32], &[2u8; 64], &[3u8; 169], u16::MAX);
        short_msg[12] = 168;
        short_msg[13] = 0;
        assert_code(
            parse_ed25519_ix_data(&short_msg).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
        let mut oob = ed25519_data(&[1u8; 32], &[2u8; 64], &[3u8; 169], u16::MAX);
        oob[6] = 0xff;
        oob[7] = 0xff;
        assert_code(
            parse_ed25519_ix_data(&oob).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
        assert_code(
            checked_slice(&[0u8; 4], usize::MAX, 1).unwrap_err(),
            ErrorCode::Ed25519BadLayout,
        );
    }

    #[test]
    fn t_u5_time_rules_ttl_300() {
        let now = 1_700_000_100;
        assert!(sample(now - 10, now + 100).check_shape_and_time(now).is_ok());
        assert_code(
            sample(now - 200, now - 1)
                .check_shape_and_time(now)
                .unwrap_err(),
            ErrorCode::VoucherExpired,
        );
        assert_code(
            sample(now + 31, now + 31 + 100)
                .check_shape_and_time(now)
                .unwrap_err(),
            ErrorCode::VoucherNotYetValid,
        );
        assert!(sample(now + 30, now + 30 + 100)
            .check_shape_and_time(now)
            .is_ok());
        assert_code(
            sample(now, now).check_shape_and_time(now).unwrap_err(),
            ErrorCode::VoucherBadShape,
        );
        assert_code(
            sample(now - 10, now - 10 + 301)
                .check_shape_and_time(now)
                .unwrap_err(),
            ErrorCode::VoucherTtlTooLong,
        );
        assert!(sample(now - 10, now - 10 + 300)
            .check_shape_and_time(now)
            .is_ok());
    }

    #[test]
    fn parser_reads_pubkey_offset_not_signature_offset() {
        let pk = [9u8; 32];
        let sig = [8u8; 64];
        let msg = [7u8; 169];
        let data = ed25519_data(&pk, &sig, &msg, u16::MAX);
        assert_eq!(u16::from_le_bytes([data[2], data[3]]), 48);
        assert_eq!(u16::from_le_bytes([data[6], data[7]]), 16);
        let (got_pk, got_sig, got_msg) = parse_ed25519_ix_data(&data).unwrap();
        assert_eq!(got_pk, &data[16..48]);
        assert_eq!(got_sig, &data[48..112]);
        assert_eq!(got_msg, &data[112..]);
        // The broken duplicate reads the signature offset (48) as the pubkey.
        assert_ne!(got_pk, &data[48..80]);
        assert_eq!(got_pk, pk.as_ref());
    }

    #[test]
    fn forged_sysvar_rejects_cpi_missing_signer_and_length() {
        let pk = [4u8; 32];
        let signer = Pubkey::new_from_array(pk);
        let msg = [5u8; 169];
        let ed = ed25519_data(&pk, &[6u8; 64], &msg, u16::MAX);

        let err = run_verify(
            &[ed25519_program::ID, Pubkey::new_from_array([1u8; 32])],
            &[ed.clone(), vec![1, 2, 3]],
            1,
            &signer,
            &msg,
        )
        .unwrap_err();
        assert_code(err, ErrorCode::CpiNotAllowed);

        let err = run_verify(
            &[anchor_lang::solana_program::system_program::ID, crate::ID],
            &[vec![0], vec![1]],
            1,
            &signer,
            &msg,
        )
        .unwrap_err();
        assert_code(err, ErrorCode::MissingEd25519Ix);

        let bad_ix = ed25519_data(&pk, &[6u8; 64], &msg, 1);
        let err = run_verify(
            &[ed25519_program::ID, crate::ID],
            &[bad_ix, vec![1]],
            1,
            &signer,
            &msg,
        )
        .unwrap_err();
        assert_code(err, ErrorCode::Ed25519BadLayout);

        let mut short = ed25519_data(&pk, &[6u8; 64], &msg, u16::MAX);
        short[12] = 168;
        let err = run_verify(
            &[ed25519_program::ID, crate::ID],
            &[short, vec![1]],
            1,
            &signer,
            &msg,
        )
        .unwrap_err();
        assert_code(err, ErrorCode::Ed25519BadLayout);

        let other = ed25519_data(&[3u8; 32], &[6u8; 64], &msg, u16::MAX);
        let err = run_verify(
            &[ed25519_program::ID, crate::ID],
            &[other, vec![1]],
            1,
            &signer,
            &msg,
        )
        .unwrap_err();
        assert_code(err, ErrorCode::WrongVoucherSigner);

        let mut mismatch = msg;
        mismatch[0] ^= 0xff;
        let err = run_verify(
            &[ed25519_program::ID, crate::ID],
            &[ed.clone(), vec![1]],
            1,
            &signer,
            &mismatch,
        )
        .unwrap_err();
        assert_code(err, ErrorCode::VoucherMessageMismatch);

        let stray = Pubkey::new_from_array([9u8; 32]);
        let claim = vec![1u8];
        let borrowed = [
            BorrowedInstruction {
                program_id: &ed25519_program::ID,
                accounts: vec![BorrowedAccountMeta {
                    pubkey: &stray,
                    is_signer: false,
                    is_writable: false,
                }],
                data: ed.as_slice(),
            },
            BorrowedInstruction {
                program_id: &crate::ID,
                accounts: Vec::new(),
                data: claim.as_slice(),
            },
        ];
        let err = finish_verify(&borrowed, 1, &signer, &msg).unwrap_err();
        assert_code(err, ErrorCode::Ed25519BadLayout);

        assert!(run_verify(
            &[ed25519_program::ID, crate::ID],
            &[ed, vec![1]],
            1,
            &signer,
            &msg,
        )
        .is_ok());
    }

    #[test]
    fn loot_id_and_voucher_id_are_different_pdas() {
        let loot_a = Pubkey::find_program_address(
            &[LOOT_CLAIM_SEED, &42u64.to_le_bytes()],
            &crate::ID,
        )
        .0;
        let loot_b = Pubkey::find_program_address(
            &[LOOT_CLAIM_SEED, &43u64.to_le_bytes()],
            &crate::ID,
        )
        .0;
        assert_ne!(loot_a, loot_b);
        let v1 = Pubkey::find_program_address(&[VOUCHER_CLAIM_SEED, &[1u8; 16]], &crate::ID).0;
        let v2 = Pubkey::find_program_address(&[VOUCHER_CLAIM_SEED, &[2u8; 16]], &crate::ID).0;
        assert_ne!(v1, v2);
        assert_ne!(v1, loot_a);
    }

    #[test]
    #[cfg(feature = "localnet")]
    fn t_u1_and_t_u3_golden_fixture() {
        const GOLDEN: &str = include_str!("../../../anchor-tests/fixtures/voucher_v1_golden.json");
        assert_eq!(json_i64(GOLDEN, "messageLength"), 169);
        assert_eq!(json_i64(GOLDEN, "publicKeyOffset"), 16);
        assert_eq!(json_i64(GOLDEN, "signatureOffset"), 48);
        assert_eq!(json_i64(GOLDEN, "messageOffset"), 112);
        let message = hex_decode(&json_string(GOLDEN, "messageHex"));
        assert_eq!(message.len(), 169);
        let mut voucher_id = [0u8; 16];
        voucher_id.copy_from_slice(&hex_decode(&json_string(GOLDEN, "voucherIdHex")));
        let voucher = LootVoucherV1 {
            voucher_id,
            loot_id: json_i64(GOLDEN, "lootId") as u64,
            lat_e6: json_i64(GOLDEN, "latE6") as i32,
            lng_e6: json_i64(GOLDEN, "lngE6") as i32,
            location_hint: json_string(GOLDEN, "locationHint"),
            issued_at: json_i64(GOLDEN, "issuedAt"),
            expires_at: json_i64(GOLDEN, "expiresAt"),
        };
        let program_id = Pubkey::from_str(&json_string(GOLDEN, "programId")).unwrap();
        let player = Pubkey::from_str(&json_string(GOLDEN, "player")).unwrap();
        assert_eq!(program_id, crate::ID);
        assert_eq!(voucher.message(&program_id, &player).to_vec(), message);

        let ix = hex_decode(&json_string(GOLDEN, "ed25519InstructionHex"));
        let (pk, sig, msg) = parse_ed25519_ix_data(&ix).unwrap();
        assert_eq!(pk, hex_decode(&json_string(GOLDEN, "serverPubkeyHex")).as_slice());
        assert_eq!(sig, hex_decode(&json_string(GOLDEN, "signatureHex")).as_slice());
        assert_eq!(msg, message.as_slice());
        assert_eq!(pk, &ix[16..48]);
        assert_ne!(pk, &ix[48..80]);

        let signer = Pubkey::from_str(&json_string(GOLDEN, "serverPubkey")).unwrap();
        assert!(run_verify(
            &[ed25519_program::ID, crate::ID],
            &[ix, vec![9]],
            1,
            &signer,
            &message,
        )
        .is_ok());
    }
}
