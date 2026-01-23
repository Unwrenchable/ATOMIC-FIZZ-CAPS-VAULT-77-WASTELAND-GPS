# 🌀 Bridge Portal

The Bridge Portal enables cross-chain asset bridging using the Wormhole protocol.

---

## Overview

The bridge portal module (`bridge-portal.js`) opens an enhanced wallet interface for managing cross-chain operations.

---

## Features

- **Multi-Chain Support**: 35+ blockchain networks
- **Wallet Integration**: Works with Phantom wallet
- **Popup Interface**: Dedicated wallet management window
- **Data Sync**: Syncs wallet state to child window
- **Auto-Connect**: Prompts wallet connection if needed

---

## Supported Chains

| Chain | Network |
|-------|---------|
| Solana | Primary chain |
| Ethereum | ETH mainnet |
| Base | Layer 2 |
| BNB | Binance Smart Chain |
| XRPL | XRP Ledger |
| + 30 more | Via Wormhole |

---

## Functions

### Initialization

#### `Game.modules.bridgePortal.init()`
Initializes the bridge portal.

```javascript
await Game.modules.bridgePortal.init();
```

- Enables bridge button
- Sets up click handler

---

### Bridge Operations

#### `openBridge()`
Opens the cross-chain bridge interface.

```javascript
Game.modules.bridgePortal.openBridge();
```

**Flow:**
1. Checks wallet connection
2. Prompts connection if needed
3. Opens wallet window

#### `openWalletWindow()`
Opens the wallet management popup.

```javascript
Game.modules.bridgePortal.openWalletWindow();
```

**Window Properties:**
- 800x900 pixels
- Centered on screen
- Resizable

---

### Wallet Sync

#### `syncWalletData()`
Sends wallet data to the popup window.

```javascript
Game.modules.bridgePortal.syncWalletData();
```

**Data Synced:**
```javascript
{
  connected: true,
  address: "ABC...XYZ",
  type: "phantom",
  player: { /* player data */ },
  nfts: { /* owned NFTs */ }
}
```

---

### State Queries

#### `isWalletOpen()`
Checks if wallet window is open.

```javascript
if (Game.modules.bridgePortal.isWalletOpen()) {
  console.log("Wallet window is open");
}
```

#### `closeWallet()`
Closes the wallet window if open.

```javascript
Game.modules.bridgePortal.closeWallet();
```

---

## Window Communication

Uses `postMessage` for cross-window communication:

```javascript
// Parent → Child
this.walletWindow.postMessage({
  type: 'WALLET_SYNC',
  data: walletData
}, window.location.origin);

// Child receives via
window.addEventListener('message', (e) => {
  if (e.data.type === 'WALLET_SYNC') {
    // Handle wallet data
  }
});
```

---

## Wallet Connection Flow

```
┌──────────────────────────────────────┐
│       User Clicks Bridge Button      │
└──────────────────┬───────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ Wallet Connected?   │
         └──────────┬──────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
         YES                  NO
          │                   │
          │         ┌─────────▼────────┐
          │         │ Prompt Connect   │
          │         └─────────┬────────┘
          │                   │
          │         ┌─────────▼────────┐
          │         │ User Accepts?    │
          │         └─────────┬────────┘
          │                   │
          │         ┌─────────┴─────────┐
          │         │                   │
          │        YES                  NO
          │         │                   │
          │         ▼                   ▼
          │  ┌──────────────┐    ┌──────────┐
          │  │ Connect Wallet│    │  Cancel  │
          │  └──────┬───────┘    └──────────┘
          │         │
          ▼         ▼
   ┌─────────────────────────────┐
   │    Open Wallet Window       │
   └─────────────┬───────────────┘
                 │
                 ▼
   ┌─────────────────────────────┐
   │    Sync Wallet Data         │
   └─────────────────────────────┘
```

---

## UI Integration

### Bridge Button
```html
<button id="openBridgeTerminal">🌀 OPEN BRIDGE</button>
```

Button states:
- Disabled initially
- Enabled after init
- Opens bridge on click

### Notifications
```javascript
Game.modules.notifications.show({
  title: "Bridge Portal Opened",
  message: "Enhanced wallet interface loaded.",
  icon: "🌀",
  duration: 5000
});
```

---

## Wallet Window

Located at `/wallet/index.html`.

Features:
- Full bridge functionality
- Cross-chain transfers
- NFT management
- Transaction history

---

## Global Shorthand

```javascript
// Quick access
window.bridgePortal = Game.modules.bridgePortal;

// Usage
bridgePortal.openBridge();
```

---

## Error Handling

### Popup Blocked
```javascript
if (!this.walletWindow) {
  alert("Please allow popups for this site to use the bridge portal.");
}
```

---

## Example Usage

```javascript
// 1. Initialize (automatic on page load)
await Game.modules.bridgePortal.init();

// 2. User clicks bridge button
// OR call directly:
Game.modules.bridgePortal.openBridge();

// 3. If wallet not connected, user is prompted

// 4. Wallet window opens at /wallet/index.html

// 5. Wallet data synced to child window

// 6. User performs bridge operations in popup

// 7. Check if window is still open
if (Game.modules.bridgePortal.isWalletOpen()) {
  console.log("User is managing assets");
}

// 8. Window closes when user is done
```
