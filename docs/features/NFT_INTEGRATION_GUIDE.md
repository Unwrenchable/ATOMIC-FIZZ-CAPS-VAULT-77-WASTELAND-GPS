# 🎨 NFT Integration Guide for Atomic Fizz Caps

## 📟 OVERSEER BRIEFING

**⚠️ IMPORTANT: Metaplex JS SDK (@metaplex-foundation/js) is OBSOLETE**

The original Metaplex JavaScript SDK was **archived on March 26, 2025** and is no longer maintained. This guide explains modern alternatives for NFT functionality in the Atomic Fizz Caps game.

---

## 🚫 What Was Removed

The obsolete dependency `@metaplex-foundation/js` (v0.19.5) has been **removed** from this project because:
- ❌ Repository archived (no more updates)
- ❌ Security vulnerabilities won't be patched
- ❌ Incompatible with modern Solana tooling
- ❌ Was never actually used in the codebase (placeholder dependency)

---

## ✅ Current NFT Approach (RECOMMENDED)

### Using Helius DAS API (Digital Asset Standard)

**This is what the project already uses** - no changes needed!

The game currently uses the **Helius DAS API** for NFT fetching, which is:
- ✅ Modern and actively maintained
- ✅ Works with all Solana NFT standards (Token Metadata, Core, cNFTs)
- ✅ Free tier available
- ✅ Fast and efficient
- ✅ No deprecated dependencies

**Setup:**
```bash
# Get a free API key from https://dev.helius.xyz/
HELIUS_API_KEY=your-helius-api-key
```

**Example Usage** (already in the project):
```javascript
// Fetch NFTs for a wallet using Helius DAS API
const response = await fetch(
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: walletPublicKey,
        page: 1,
        limit: 1000
      }
    })
  }
);

const { result } = await response.json();
// result.items contains all NFTs
```

---

## 🆕 Modern Alternatives (If You Need More NFT Features)

If you need to **create/mint** NFTs (not just display them), here are the modern options:

### Option 1: Metaplex Umi SDK (Most Complete)

**Best for:** Complex NFT operations, collection management, compressed NFTs

```bash
npm install @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults
npm install @metaplex-foundation/mpl-token-metadata
```

**Example:**
```javascript
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';

const umi = createUmi('https://api.mainnet-beta.solana.com')
  .use(mplTokenMetadata());

// Umi provides full NFT lifecycle management
```

**Pros:**
- ✅ Most feature-complete
- ✅ Supports all Metaplex standards
- ✅ Modular and extensible
- ✅ Actively maintained

**Cons:**
- ⚠️ Larger bundle size
- ⚠️ Learning curve for fluent API

---

### Option 2: Metaplex Kit SDK (Recommended for New Projects)

**Best for:** Simple NFT minting, lightweight projects

```bash
npm install @metaplex-foundation/mpl-token-metadata-kit
npm install @solana/web3.js @solana/spl-token
```

**Example:**
```javascript
import { createNft } from '@metaplex-foundation/mpl-token-metadata-kit';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const payer = Keypair.fromSecretKey(/* your key */);

const nft = await createNft({
  connection,
  payer,
  name: 'Pip-Boy Skin #77',
  uri: 'https://your-metadata-url.json',
  sellerFeeBasisPoints: 500 // 5%
});
```

**Pros:**
- ✅ Lightweight
- ✅ Functional programming style
- ✅ Easy to learn
- ✅ Works with standard @solana/web3.js

**Cons:**
- ⚠️ Less features than Umi
- ⚠️ Newer (less battle-tested)

---

### Option 3: Direct Solana Web3.js (Maximum Control)

**Best for:** Advanced developers who want full control

```bash
npm install @solana/web3.js @solana/spl-token
```

**Example:**
```javascript
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { createMint, mintTo } from '@solana/spl-token';

// Create token mint
const mint = await createMint(
  connection,
  payer,
  mintAuthority.publicKey,
  freezeAuthority.publicKey,
  0 // 0 decimals for NFT
);

// Mint single token
await mintTo(
  connection,
  payer,
  mint,
  destination,
  mintAuthority,
  1 // amount
);

// Add metadata with Token Metadata program (manual instruction building)
```

**Pros:**
- ✅ No extra dependencies
- ✅ Complete control
- ✅ Smallest bundle size

**Cons:**
- ⚠️ Most complex
- ⚠️ Manual metadata management
- ⚠️ More code to write

---

## 🎯 Recommendation Matrix

| Use Case | Recommended Approach |
|----------|---------------------|
| **Display NFTs** | ✅ Helius DAS API (already implemented) |
| **Mint simple NFTs** | Kit SDK (`@metaplex-foundation/mpl-token-metadata-kit`) |
| **Complex NFT operations** | Umi SDK (`@metaplex-foundation/umi`) |
| **Maximum control** | Direct `@solana/web3.js` |
| **Mobile/React Native** | Umi SDK or Kit SDK |

---

## 📦 Current Project Status

### What's Implemented ✅
- NFT display using Helius DAS API
- Wallet integration (Phantom)
- Player inventory system
- Exchange/trading interface (mock)

### What's NOT Implemented ⚠️
- NFT minting (intentionally not included)
- Collection creation
- Metadata upload
- Compressed NFTs (cNFTs)

**Why?** The game focuses on gameplay and token mechanics. NFT minting is optional for future expansion.

---

## 🚀 Adding NFT Minting (If Needed)

If you want to add NFT minting to the game:

### Step 1: Choose Your SDK

For Atomic Fizz Caps, we recommend:
```bash
# Install Kit SDK (simplest option)
npm install @metaplex-foundation/mpl-token-metadata-kit
```

### Step 2: Set Up Metadata Storage

NFT metadata must be stored off-chain (JSON file):

**Options:**
- **Arweave** (permanent storage, small fee)
- **IPFS** (decentralized, free/cheap)
- **NFT.storage** (free IPFS pinning)
- **Shadow Drive** (Solana-native storage)

**Example metadata format:**
```json
{
  "name": "Vault 77 Helmet",
  "symbol": "V77",
  "description": "Legendary helmet from Vault 77. Provides +5 RAD resistance.",
  "image": "https://arweave.net/your-image-hash",
  "attributes": [
    { "trait_type": "Rarity", "value": "Legendary" },
    { "trait_type": "Defense", "value": "15" },
    { "trait_type": "RAD Resistance", "value": "+5" }
  ],
  "properties": {
    "category": "image",
    "files": [
      {
        "uri": "https://arweave.net/your-image-hash",
        "type": "image/png"
      }
    ]
  }
}
```

### Step 3: Implement Minting Endpoint

Create `backend/api/mint-nft.js`:

```javascript
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { createNft } = require('@metaplex-foundation/mpl-token-metadata-kit');

async function mintNft(req, res) {
  const { wallet, nftType, metadataUri } = req.body;
  
  // Validate player eligibility (level, achievements, etc.)
  const playerData = await getPlayerData(wallet);
  if (!canMintNft(playerData, nftType)) {
    return res.status(403).json({ error: 'Not eligible' });
  }
  
  // Mint NFT
  const connection = new Connection(process.env.SOLANA_RPC);
  const payer = Keypair.fromSecretKey(
    Buffer.from(process.env.MINT_AUTHORITY_KEY, 'base64')
  );
  
  try {
    const nft = await createNft({
      connection,
      payer,
      name: nftType,
      uri: metadataUri,
      sellerFeeBasisPoints: 500,
      recipient: new PublicKey(wallet)
    });
    
    res.json({ success: true, mint: nft.mint.toString() });
  } catch (error) {
    console.error('Mint failed:', error);
    res.status(500).json({ error: 'Mint failed' });
  }
}

module.exports = { mintNft };
```

### Step 4: Update Frontend

```javascript
// In your game UI
async function claimReward(rewardType) {
  // Upload metadata first
  const metadata = await uploadToArweave({
    name: `${rewardType} #${tokenId}`,
    image: imageUrl,
    attributes: attributes
  });
  
  // Request mint
  const response = await fetch('/api/mint-nft', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      wallet: connectedWallet,
      nftType: rewardType,
      metadataUri: metadata.uri
    })
  });
  
  const { mint } = await response.json();
  alert(`NFT minted! Mint: ${mint}`);
}
```

---

## 🔐 Security Considerations

### Minting Authority

**NEVER** expose your mint authority key on the frontend!

```bash
# Backend .env
MINT_AUTHORITY_KEY=base64_encoded_secret_key  # Keep this secret!
SOLANA_RPC=https://api.mainnet-beta.solana.com
```

### Rate Limiting

Prevent abuse with rate limits:
```javascript
const mintLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 mints per wallet per day
  keyGenerator: (req) => req.body.wallet
});

router.post('/mint-nft', mintLimiter, mintNft);
```

### Validation

Always validate:
- ✅ Player meets requirements (level, achievements)
- ✅ NFT type is valid
- ✅ Wallet owns necessary tokens/items
- ✅ No duplicate mints
- ✅ Signature verification

---

## 💰 Cost Considerations

### Minting Costs (Solana)
- **Mint account**: ~0.00203 SOL (~$0.20 at $100/SOL)
- **Metadata account**: ~0.0144 SOL (~$1.44)
- **Transaction fees**: ~0.000005 SOL (~$0.0005)
- **Total per NFT**: ~0.016 SOL (~$1.60)

### Storage Costs
- **Arweave**: ~$0.50-2.00 per NFT (permanent)
- **IPFS/NFT.storage**: Free (pinning services)
- **Shadow Drive**: ~$0.01 per KB (Solana-native)

### Optimization: Compressed NFTs (cNFTs)
For large-scale minting, use **compressed NFTs**:
- 1000x cheaper (~$0.0016 per NFT)
- Uses Merkle trees for efficiency
- Requires Umi SDK or Bubblegum program
- Perfect for game items/collectibles

---

## 📚 Additional Resources

### Documentation
- [Solana NFT Guide](https://solana.com/developers/guides/getstarted/how-to-create-a-token)
- [Metaplex Umi Docs](https://developers.metaplex.com/dev-tools/umi)
- [Kit SDK Docs](https://developers.metaplex.com/smart-contracts/token-metadata/getting-started/js)
- [Helius DAS API](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api)

### Tools
- [Metaplex Sugar](https://developers.metaplex.com/candy-machine/sugar/cli) - CLI for collections
- [Arweave Bundlr](https://bundlr.network/) - Fast metadata uploads
- [NFT.storage](https://nft.storage/) - Free IPFS pinning
- [Solana Explorer](https://explorer.solana.com/) - Verify transactions

---

## 🎮 Game-Specific Recommendations

For Atomic Fizz Caps, we recommend:

### Phase 1: Current (No NFT Minting) ✅
- Use Helius DAS API for displaying player NFTs
- Focus on gameplay and token mechanics
- **No additional dependencies needed**

### Phase 2: Future (Add NFT Rewards) 🔜
- Install Kit SDK for simple minting
- Use Arweave or NFT.storage for metadata
- Mint NFTs for special achievements:
  - Legendary weapon skins
  - Rare Pip-Boy themes
  - Achievement badges
  - Location discovery collectibles

### Phase 3: Scale (High Volume) 🚀
- Migrate to compressed NFTs (cNFTs)
- Use Umi SDK for advanced features
- Consider collection verification
- Implement trading/marketplace

---

## 🤔 FAQ

### Q: Do I need NFTs for my game?
**A:** No! NFTs are optional. The game works perfectly with just SPL tokens (FIZZ/CAPS). Add NFTs only if you want collectible items or achievements.

### Q: Why was Metaplex JS SDK removed?
**A:** It was archived (obsolete) and never actually used in the code. Modern alternatives (Umi, Kit) are better.

### Q: Can I still use the old Metaplex SDK?
**A:** Not recommended. It has security vulnerabilities and won't work with newer Solana versions. Use Umi or Kit instead.

### Q: What about mobile support?
**A:** Both Umi SDK and Kit SDK work in React Native. Use Solana Mobile Stack for best results.

### Q: Is Helius DAS API free?
**A:** Yes! Free tier includes 100,000 requests/month. More than enough for small-medium games.

---

## 📟 OVERSEER MESSAGE

> "The old Metaplex SDK has been decommissioned, just like Vault 12's ventilation system.
> But fear not, Vault Dweller - modern alternatives are more efficient and less likely to cause
> catastrophic failures.
> 
> Use Helius DAS API for NFT display. If you must mint, choose Kit SDK for simplicity
> or Umi SDK for power. The wasteland adapts, and so must we.
> 
> Stay upgraded out there, Vault Dweller. ☢️"

---

*Document Version: 1.0*  
*Last Updated: 2026-01-29*  
*Classification: VAULT-TEC PUBLIC*
