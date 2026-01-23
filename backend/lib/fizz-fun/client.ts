/**
 * Fizz.fun Client Library
 * TypeScript client for interacting with the Fizz.fun token launchpad
 */

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Program constants
export const FIZZ_FUN_PROGRAM_ID = new PublicKey(process.env.FIZZ_FUN_PROGRAM_ID || 'FizzFun111111111111111111111111111111111111');
export const CAPS_MINT = new PublicKey(process.env.CAPS_MINT || 'CAPSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

// Bonding curve constants
export const TOTAL_SUPPLY = 1_000_000_000_000_000_000n; // 1B with 9 decimals
export const CURVE_SUPPLY = 800_000_000_000_000_000n;   // 800M
export const LP_RESERVE = 200_000_000_000_000_000n;     // 200M
export const GRADUATION_SOL = 85_000_000_000n;          // 85 SOL
export const VIRTUAL_SOL = 30_000_000_000n;             // 30 SOL
export const FEE_BPS = 100n;                            // 1%

// CAPS requirements
export const CAPS_TO_LAUNCH = 1000n * 1_000_000_000n;   // 1000 CAPS
export const CAPS_TO_TRADE = 0n;                         // No CAPS required to trade!
export const CAPS_LAUNCH_FEE = 100n * 1_000_000_000n;   // 100 CAPS burned
export const CAPS_VETERAN_FEE = 50n * 1_000_000_000n;   // 50 CAPS for veterans

/**
 * Launch type for transparency
 */
export enum LaunchType {
    CapsStandard = 'CapsStandard',
    CapsVeteran = 'CapsVeteran',
    AdminUSDC = 'AdminUSDC',
    AdminFree = 'AdminFree'
}

/**
 * Token data from bonding curve
 */
export interface TokenData {
    mint: PublicKey;
    creator: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    solReserve: bigint;
    tokenReserve: bigint;
    totalSupply: bigint;
    graduated: boolean;
    graduatedAt: number | null;
    createdAt: number;
    launchType: LaunchType;
}

/**
 * Access tier for UI display
 */
export interface AccessTier {
    canTrade: boolean;
    canLaunch: boolean;
    isVeteran: boolean;
    isAdmin: boolean;
    launchFee: number;
    tier: 'outsider' | 'wastelander' | 'veteran' | 'elite' | 'overseer';
    capsBalance: number;
}

/**
 * Fizz.fun Client
 */
export class FizzFunClient {
    private connection: Connection;
    private program: Program | null = null;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    /**
     * Get access tier for a wallet
     */
    async getAccessTier(wallet: PublicKey): Promise<AccessTier> {
        const capsBalance = await this.getCapsBalance(wallet);
        const capsHuman = Number(capsBalance) / 1e9;

        const canTrade = true; // Anyone can trade!
        const canLaunch = capsHuman >= 1000;
        const isVeteran = capsHuman >= 10000;
        const isAdmin = false; // Check admin list separately

        let tier: AccessTier['tier'] = 'outsider';
        if (capsHuman >= 1000000) tier = 'overseer';
        else if (capsHuman >= 100000) tier = 'elite';
        else if (capsHuman >= 10000) tier = 'veteran';
        else if (capsHuman >= 1000) tier = 'wastelander';

        return {
            canTrade,
            canLaunch,
            isVeteran,
            isAdmin,
            launchFee: isVeteran ? 50 : 100,
            tier,
            capsBalance: capsHuman
        };
    }

    /**
     * Get CAPS balance for a wallet
     */
    async getCapsBalance(wallet: PublicKey): Promise<bigint> {
        try {
            const ata = await getAssociatedTokenAddress(CAPS_MINT, wallet);
            const balance = await this.connection.getTokenAccountBalance(ata);
            return BigInt(balance.value.amount);
        } catch {
            return 0n;
        }
    }

    /**
     * Calculate tokens received for SOL input
     */
    calculateBuyReturn(solAmount: bigint, solReserve: bigint, tokenReserve: bigint): bigint {
        const virtualSol = solReserve + VIRTUAL_SOL;
        const k = virtualSol * tokenReserve;
        const fee = (solAmount * FEE_BPS) / 10000n;
        const solAfterFee = solAmount - fee;
        const newSol = virtualSol + solAfterFee;
        const newTokens = k / newSol;
        return tokenReserve - newTokens;
    }

    /**
     * Calculate SOL received for token input
     */
    calculateSellReturn(tokenAmount: bigint, solReserve: bigint, tokenReserve: bigint): bigint {
        const virtualSol = solReserve + VIRTUAL_SOL;
        const k = virtualSol * tokenReserve;
        const newTokens = tokenReserve + tokenAmount;
        const newSol = k / newTokens;
        const solOutGross = virtualSol - newSol;
        const capped = solOutGross > solReserve ? solReserve : solOutGross;
        const fee = (capped * FEE_BPS) / 10000n;
        return capped - fee;
    }

    /**
     * Calculate current token price in SOL (per token with 9 decimals)
     */
    calculatePrice(solReserve: bigint, tokenReserve: bigint): number {
        const virtualSol = Number(solReserve + VIRTUAL_SOL);
        const tokens = Number(tokenReserve);
        return virtualSol / tokens;
    }

    /**
     * Calculate market cap in SOL
     */
    calculateMarketCap(solReserve: bigint, tokenReserve: bigint): number {
        const price = this.calculatePrice(solReserve, tokenReserve);
        return price * Number(TOTAL_SUPPLY) / 1e9;
    }

    /**
     * Get graduation progress (0-100%)
     */
    getGraduationProgress(solReserve: bigint): number {
        return Math.min(100, Number((solReserve * 100n) / GRADUATION_SOL));
    }

    /**
     * Check if token is ready to graduate
     */
    isReadyToGraduate(solReserve: bigint): boolean {
        return solReserve >= GRADUATION_SOL;
    }

    /**
     * Derive bonding curve PDA
     */
    deriveBondingCurve(mint: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('bonding_curve'), mint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );
    }

    /**
     * Derive SOL vault PDA
     */
    deriveSolVault(mint: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('sol_vault'), mint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );
    }

    /**
     * Derive config PDA
     */
    deriveConfig(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('config')],
            FIZZ_FUN_PROGRAM_ID
        );
    }

    /**
     * Derive admin record PDA
     */
    deriveAdminRecord(admin: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('admin'), admin.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );
    }

    /**
     * Get token data from chain
     */
    async getTokenData(mint: PublicKey): Promise<TokenData | null> {
        try {
            const [bondingCurve] = this.deriveBondingCurve(mint);
            const accountInfo = await this.connection.getAccountInfo(bondingCurve);
            
            if (!accountInfo) return null;
            
            // In production: decode using IDL/Borsh
            // This is a placeholder
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Get trending tokens
     */
    async getTrendingTokens(limit: number = 20): Promise<TokenData[]> {
        // In production: use getProgramAccounts or indexer
        // This is a placeholder
        return [];
    }

    /**
     * Format price for display
     */
    formatPrice(price: number): string {
        if (price < 0.000001) return price.toExponential(2);
        if (price < 0.001) return price.toFixed(9);
        if (price < 1) return price.toFixed(6);
        return price.toFixed(4);
    }

    /**
     * Format SOL amount for display
     */
    formatSol(lamports: bigint): string {
        const sol = Number(lamports) / 1e9;
        if (sol < 0.001) return `${(sol * 1000).toFixed(3)} mSOL`;
        return `${sol.toFixed(4)} SOL`;
    }

    /**
     * Format token amount for display
     */
    formatTokens(amount: bigint): string {
        const tokens = Number(amount) / 1e9;
        if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`;
        if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
        if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(2)}K`;
        return tokens.toFixed(2);
    }

    /**
     * Get lore message based on tier
     */
    getLoreMessage(tier: AccessTier['tier']): string {
        switch (tier) {
            case 'overseer':
                return "Welcome, Vault Overseer. The wasteland is yours to shape.";
            case 'elite':
                return "Elite status recognized. Priority access granted.";
            case 'veteran':
                return "Veteran wastelander detected. Reduced fees unlocked.";
            case 'wastelander':
                return "You've proven yourself in the wasteland. Token launches unlocked.";
            case 'outsider':
            default:
                return "Your old world paper money is worthless scrap, but we'll take it for trading.";
        }
    }
}

export default FizzFunClient;
