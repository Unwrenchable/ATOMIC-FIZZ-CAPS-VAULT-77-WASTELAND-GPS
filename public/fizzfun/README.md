# FIZZ.FUN Token Launchpad - Standalone Version

## 📟 OVERSEER NOTICE

This directory contains the **standalone FIZZ.FUN Token Launchpad** application, extracted from the wallet interface for dedicated access and enhanced user experience.

## 🚀 What is FIZZ.FUN?

FIZZ.FUN is the token launchpad for the Atomic Fizz Caps ecosystem. It allows users to:

- **Browse Active Tokens**: View all tokens launched on the platform with real-time stats
- **Trade Tokens**: Buy and sell tokens using bonding curve mechanics
- **Launch Tokens**: Create your own tokens (requires CAPS holdings based on tier)
- **View Protocol Stats**: Monitor total volume, tokens launched, and CAPS burned

## 📁 Files

### `index.html`
Standalone HTML page with:
- Full Pocket-Boy/wasteland theme
- Boot sequence animation
- Wallet connection UI
- All fizz.fun sections (access, tokens, trade, launch, stats)
- Navigation links to other parts of the site

### `fizzfun.js`
JavaScript functionality:
- `FizzFun` object - Main API integration
- `WalletManager` - Phantom wallet connection
- `showToast()` - Toast notifications
- Event listeners for all interactive elements
- Auto-initialization on page load

### `fizzfun.css`
Complete styling:
- Pocket-Boy green/orange color palette
- CRT scanline effects
- Radioactive glow animations
- Fully responsive design
- Token cards, progress bars, trade panels
- All UI components styled independently

## 🔗 Integration

### Backend API
Uses existing backend at `/backend/api/fizz-fun.js`:
- `/api/fizz-fun/access/:wallet` - Check user tier and access
- `/api/fizz-fun/tokens` - List all tokens (with sorting)
- `/api/fizz-fun/token/:mint` - Get token details
- `/api/fizz-fun/quote/buy` - Get buy quote
- `/api/fizz-fun/quote/sell` - Get sell quote
- `/api/fizz-fun/stats` - Protocol statistics

### Navigation
Linked from:
- Wallet page tab bar: `🚀 FIZZ.FUN`
- Wallet dashboard quick links: `🚀 FIZZ.FUN`
- Direct URL: `/fizzfun/`

## 🎨 Theme & Design

### Color Palette
- **Primary**: Fizz Orange (`#ff9933`)
- **Secondary**: Pocket-Boy Green (`#00ff66`)
- **Accent**: Vault Gold (`#ffcc00`)
- **Background**: Dark wasteland tones

### Effects
- CRT scanlines (horizontal lines animation)
- Radioactive glow (pulsing orange radial gradient)
- Static noise overlay (SVG texture)
- Terminal boot sequence
- Smooth transitions and hover states

## 🔧 Technical Details

### Dependencies
- **Phantom Wallet**: For Solana wallet connection
- **Config.js**: API base URL configuration
- **VT323 Font**: Retro terminal aesthetic

### Constants
```javascript
const GRADUATION_SOL = 85_000_000_000; // 85 SOL threshold
const VIRTUAL_SOL = 30_000_000_000;    // 30 SOL virtual liquidity
```

### Key Functions
- `FizzFun.checkAccess(wallet)` - Verify user can launch tokens
- `FizzFun.fetchTokens(sort)` - Load token list with sorting
- `FizzFun.selectToken(mint)` - Display token details
- `FizzFun.getQuote()` - Calculate trade quote
- `FizzFun.executeTrade()` - Execute buy/sell (TODO: on-chain)
- `FizzFun.launchToken()` - Create new token (TODO: on-chain)

## 🚧 TODO - On-Chain Integration

Currently displaying UI and API quotes only. Phase 2 requires:

### Trade Execution
1. Build Solana transaction with program instructions
2. Sign transaction with connected wallet
3. Send and confirm on-chain
4. Update UI with transaction status

### Token Launch
1. Verify CAPS balance and tier
2. Build create_token transaction
3. Burn required CAPS fee
4. Deploy new token to bonding curve
5. Return mint address and update UI

## 📱 Responsive Design

- **Desktop**: Full grid layout, multi-column token cards
- **Tablet**: 2-column token grid, adjusted spacing
- **Mobile**: Single column, stacked controls, full-width buttons

## ♿ Accessibility

- Keyboard navigation support
- Focus visible indicators
- Reduced motion support
- High contrast mode support
- Screen reader compatible structure

## 🔐 Security

- CSP headers configured
- No inline scripts (except initialization)
- Sanitized user inputs
- Secure wallet connection flow
- API rate limiting (backend)

## 📊 Performance

- Lazy loading for heavy sections
- Debounced quote updates (500ms)
- Optimized animations (GPU accelerated)
- Minimal JavaScript bundle
- CSS grid for efficient layouts

## 🎯 User Flow

1. **Land on page** → Boot sequence animation
2. **Connect wallet** → Check access tier
3. **Browse tokens** → Sort by volume/newest/graduating
4. **Select token** → View details and trade panel
5. **Enter amount** → Auto-fetch quote
6. **Execute trade** → Sign transaction (coming soon)
7. **Launch token** → Fill form and deploy (coming soon)

## 🔄 Updates & Maintenance

### Updating Token List
Tokens auto-refresh on page load and manual refresh button.

### Updating Styles
Modify `fizzfun.css` - all styles are self-contained.

### Updating Logic
Modify `fizzfun.js` - no dependencies on wallet.js.

### Backend Changes
If backend API changes, update fetch URLs in `fizzfun.js`.

## 🎮 Related Pages

- **Main Site**: `/` - Wasteland GPS game
- **Wallet**: `/wallet/` - Full wallet interface
- **Exchange**: `/exchange` - Token swaps
- **Bridge**: `/bridge` - Cross-chain bridge

## 📝 Version History

### v1.0.0 (Current)
- Initial standalone release
- Extracted from wallet page
- Full feature parity with embedded version
- Enhanced UI/UX for dedicated experience
- Responsive design improvements

## 🆘 Support

For issues or questions:
- Check console logs for errors
- Verify wallet connection
- Ensure backend API is running
- Check network connection
- Review CSP settings if scripts fail

## 🎖️ Credits

Built with:
- Atomic Fizz Caps GPS Game
- Vault-Tec Approved Engineering
- Wasteland Survivor Tested

**Stay safe out there, Vault Dweller. ☢️**
