# NFT Scrap & Fusion System

## Overview

The Atomic Fizz NFT Scrap & Fusion system allows players to recycle and upgrade their gear through deflationary mechanics. Players can scrap NFTs for resources or fuse multiple NFTs together to create more powerful items.

## Features

### 🗑️ **NFT Scrap**
- **Convert NFTs to Resources**: Turn unwanted or duplicate NFTs into scrap materials
- **Deflationary Mechanics**: Permanently removes NFTs from circulation
- **Resource Rewards**: Gain materials, fusion cores, and CAPS based on NFT rarity
- **Rarity-Based Values**:
  - Common: 10 materials, 1 fusion core, 5 CAPS
  - Uncommon: 25 materials, 2 fusion cores, 15 CAPS
  - Rare: 50 materials, 5 fusion cores, 50 CAPS
  - Epic: 100 materials, 10 fusion cores, 150 CAPS
  - Legendary: 250 materials, 25 fusion cores, 500 CAPS

### ⚛️ **NFT Fusion**
- **Combine Multiple NFTs**: Merge 2-5 NFTs to create enhanced items
- **Upgrade Rarity**: Fusion can increase item rarity (up to Legendary)
- **Modded Weapons**: Special fusion types create custom weapons with modifiers
- **Fusion Types**:
  - **Upgrade**: 2-3 items → upgraded version (+1 rarity level)
  - **Modded**: 3-5 items → custom weapon with random modifiers
  - **Legendary**: 4-5 items → guaranteed Legendary item

### 🎮 **Nuke Portal**
- **Dedicated Fusion Interface**: Located at `/nuke-portal.html`
- **Batch Operations**: Fuse multiple equipped items at once
- **Visual Feedback**: Terminal-style interface with fusion animations
- **Real-time Results**: Immediate feedback on fusion outcomes

## API Endpoints

### POST `/api/scrap-nft`
Scrap a single NFT for resources.

**Request:**
```json
{
  "nftMint": "string",
  "walletAddress": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully scrapped Laser Rifle",
  "scrapValue": {
    "resources": 50,
    "fusionCores": 5,
    "caps": 50,
    "rarity": "rare",
    "type": "weapon"
  },
  "newResources": {
    "common": 0,
    "uncommon": 0,
    "rare": 50,
    "epic": 0,
    "legendary": 0,
    "fusionCores": 5
  },
  "newCaps": 150
}
```

### POST `/api/fuse`
Fuse multiple NFTs together.

**Request:**
```json
{
  "nftMints": ["mint1", "mint2", "mint3"],
  "walletAddress": "string",
  "fusionType": "upgrade"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully fused 3 items",
  "fusionResult": {
    "newItem": {
      "id": "fused_1234567890_abc123",
      "name": "Enhanced Plasma Rifle",
      "type": "weapon",
      "rarity": "epic",
      "level": 2,
      "stats": { "damage": 75, "accuracy": 85 },
      "fused": true,
      "fusionCount": 3
    },
    "fusionCoresRequired": 0,
    "originalItemsDestroyed": 3,
    "rarityUpgrade": true
  }
}
```

### GET `/api/scrap-nft/resources/:walletAddress`
Get player's current scrap resources.

### GET `/api/fuse/recipes`
Get available fusion recipes and requirements.

## Frontend Integration

### Wallet Interface
- **Scrap Button**: Available on individual NFT modals
- **Fuse Button**: Opens fusion selection interface
- **Resource Display**: Shows current scrap materials and fusion cores

### Nuke Portal
- **Gear Scanning**: Automatically detects equipped NFTs
- **Batch Selection**: Mark multiple items for fusion
- **Real-time Validation**: Ensures fusion requirements are met

## Game Balance

### Resource Economy
- **Scrap Materials**: Used for crafting (future feature)
- **Fusion Cores**: Required for advanced fusions
- **CAPS Rewards**: Immediate economic benefit from scrapping

### Fusion Mechanics
- **Stat Combination**: Combined stats get 20-50% bonus
- **Rarity Progression**: Higher item count = higher chance of rarity upgrade
- **Modifier System**: Modded items gain special abilities

### Deflationary Impact
- **Token Burn**: NFTs are permanently removed from circulation
- **Resource Injection**: New resources enter the economy
- **Economic Balance**: Maintains game token value through controlled supply

## Technical Implementation

### Backend
- **Redis Storage**: Player data and resources persisted
- **Rate Limiting**: Prevents abuse (5 scrap/min, 3 fusion/min)
- **Audit Logging**: All operations logged for transparency

### Frontend
- **Real-time Updates**: Immediate UI feedback
- **Error Handling**: Graceful failure recovery
- **Wallet Integration**: Seamless Solana wallet connection

## Future Enhancements

- **Crafting System**: Use scrap materials to create new items
- **Fusion Specializations**: Class-specific fusion recipes
- **Market Integration**: Trade scrap resources between players
- **Guild Features**: Group fusions for rare items