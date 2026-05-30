# Wallet Configuration Guide

## Overview

The wallet connection system has been updated to provide better user experience when connecting wallets. No special Phantom variables or configuration files are needed beyond what's already set up.

## Configuration Variables

### Frontend Configuration (public/js/config.js)

The following variables are automatically set based on the environment:

| Variable | Local/Codespaces | Production |
|----------|------------------|------------|
| `window.API_BASE` | `http://localhost:3000` | `https://api.atomicfizzcaps.xyz` |
| `window.BACKEND_URL` | `http://localhost:3000` | `https://api.atomicfizzcaps.xyz` |
| `window.SOLANA_RPC` | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` |

**No additional variables needed!** The wallet adapter automatically detects:
- `window.solana` (Phantom)
- `window.phantom.solana` (Phantom in-app browser)
- `window.solflare` (Solflare)
- `window.ethereum` (MetaMask, Coinbase Wallet)
- `window.WalletConnectProvider` (WalletConnect)

### Backend Configuration (.env)

The backend uses these Solana-related variables:

```bash
# Solana Network RPC
SOLANA_RPC=https://api.devnet.solana.com
# OR for mainnet:
# SOLANA_RPC=https://api.mainnet-beta.solana.com

# Optional: Use Helius for better reliability
# SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# Token addresses (optional)
CAPS_MINT=your_caps_token_mint_address
TREASURY_WALLET=your_treasury_wallet_address
```

## Wallet Detection

### How Wallet Detection Works

1. **Phantom Wallet**
   - Detected via `window.solana.isPhantom` or `window.phantom.solana.isPhantom`
   - Waits up to 3 seconds for provider injection (handles in-app browser)
   - Shows install prompt if not detected

2. **WalletConnect**
   - Always shown as an option
   - Library loaded via CDN: `@walletconnect/web3-provider@1.8.0`
   - Prompts to refresh if library not loaded

3. **MetaMask**
   - Detected via `window.ethereum.isMetaMask`
   - Shows install prompt with link to https://metamask.io

4. **Solflare**
   - Detected via `window.solflare.isSolflare`
   - Shows install prompt with link to https://solflare.com

5. **Coinbase Wallet**
   - Detected via `window.ethereum.isCoinbaseWallet`
   - Shows install prompt with link to https://www.coinbase.com/wallet

## User Experience Flow

### When Wallet IS Installed
1. User clicks "CONNECT WALLET"
2. Wallet selector shows wallet with ✅ (detected)
3. User selects wallet
4. Wallet extension opens for approval
5. User approves connection
6. Wallet address is saved

### When Wallet NOT Installed
1. User clicks "CONNECT WALLET"
2. Wallet selector shows wallet with ⚠️ (not installed)
3. User selects wallet
4. System shows confirmation dialog:
   - Explains what the wallet is
   - Asks if user wants to install
5. If user clicks "OK":
   - Opens wallet website in new tab
   - Shows error with install URL
6. User installs wallet and refreshes page

## Common Issues & Solutions

### Issue: "Phantom wallet is loading. Please try again."
**Solution:** You're in Phantom's in-app browser. Wait a moment and try again.

### Issue: "WalletConnect library is not loaded"
**Solution:** Click OK to refresh the page and reload the WalletConnect library.

### Issue: Wallet not appearing in selector
**Solution:** Popular wallets (Phantom, WalletConnect, integrated) always appear. Install the wallet extension and refresh the page.

### Issue: Connection fails immediately
**Solution:** Check browser console for errors. Ensure you're not blocking popups or extensions.

## YAML/Config Files

### vercel.json
This file is correctly configured:
- Proxies `/api/*` requests to backend
- Sets security headers
- No wallet-specific configuration needed

### .env files
No Phantom-specific variables needed. The standard Solana configuration is sufficient:
```bash
SOLANA_RPC=https://api.devnet.solana.com  # or mainnet
```

### Anchor.toml
This is for Solana program deployment. Not related to frontend wallet connection.

## Security Notes

1. **No Private Keys in Config**: Never store private keys in environment variables or config files
2. **CSP Headers**: Content Security Policy allows wallet domains (phantom.app, walletconnect.com, etc.)
3. **Rate Limiting**: Wallet connection attempts are rate-limited to prevent abuse
4. **Address Validation**: All wallet addresses are validated before being accepted

## Testing Checklist

- [ ] Test Phantom wallet connection (desktop browser with extension)
- [ ] Test Phantom wallet connection (Phantom in-app browser)
- [ ] Test WalletConnect connection
- [ ] Test MetaMask connection
- [ ] Test wallet not installed flow (should show install prompt)
- [ ] Test multiple wallets on same page
- [ ] Test wallet disconnection
- [ ] Test wallet switching

## Summary

**You don't need any Phantom variables!** The system automatically:
1. Detects available wallets via browser globals
2. Shows install prompts for missing wallets
3. Guides users to install and connect
4. Uses SOLANA_RPC from config.js for blockchain interactions

The configuration is complete and working as designed.
