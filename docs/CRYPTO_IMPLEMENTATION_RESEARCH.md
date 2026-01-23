# Popular Crypto Implementations for Web3 Gaming Projects

## Overview

This document outlines popular cryptographic technologies and blockchain implementations that are being widely adopted by web3 gaming projects in 2024-2025. These could be considered for future integration into the Atomic Fizz Caps Wasteland GPS platform.

## Current Implementation

Atomic Fizz Caps currently uses:
- **Solana** blockchain for on-chain transactions
- **Ed25519** signatures (via tweetnacl) for wallet verification
- **SPL Tokens** for the $CAPS token
- **Metaplex** for NFT minting and metadata

---

## Popular Cryptographic Technologies

### 1. Zero-Knowledge Proofs (ZKPs)

**What it is:** Cryptographic method allowing one party to prove knowledge of something without revealing the actual information.

**Use Cases in Gaming:**
- Privacy-preserving player stats and rankings
- Verifiable loot drops without revealing game mechanics
- Secure player-to-player transactions

**Popular Implementations:**
- **Polygon zkEVM** - Layer 2 scalability with Ethereum compatibility
- **Starknet** - High-throughput ZK-rollup
- **zkSync** - Ethereum scaling with account abstraction
- **Light Protocol** - Solana-native ZK compression (recommended for current stack)
- **Groth16 / PLONK** - ZK proof systems usable via circom or noir

**Relevance to Atomic Fizz Caps:** Could enable private location claims or hidden loot mechanics while still verifiable on-chain.

---

### ZKPs for Leveled Item Drops - Compatibility Guide

**Will ZKPs break your leveled loot system? NO!** ZKPs are an *optional layer* that enhances privacy without changing core game logic. Here's how they integrate:

#### How Your Current Loot System Works
```
Player Level → Loot Table Query → RNG Roll → Item Drops → NFT Minted
     ↓              ↓                ↓            ↓
   Public       Server-side      Server RNG   On-chain (visible)
```

#### How ZKPs Would Enhance It (Not Replace)
```
Player Level → ZK Proof of Level → Loot Table → VRF Roll → ZK Proof of Valid Drop → NFT
     ↓              ↓                  ↓            ↓              ↓
   Private    Proves eligibility   Hidden logic   Provably fair   Verifiable but private
```

#### ZKP Integration Patterns for Leveled Loot

**Pattern 1: Private Player Stats (Recommended Start)**
- Player level/XP stored privately off-chain or encrypted
- ZK proof proves "I am level 10+" without revealing exact level
- Loot tables remain unchanged
- **Benefit:** Players can't be targeted based on level

```
// Example ZK circuit logic (pseudocode)
circuit LevelEligibility {
    private input: playerLevel
    public input: requiredLevel
    
    // Prove level >= required without revealing exact level
    assert(playerLevel >= requiredLevel)
}
```

**Pattern 2: Verifiable Loot Drops (Advanced)**
- Server generates loot using standard logic
- ZK proof proves the drop followed the rules
- Players trust drops are fair without seeing formulas

```
// Proves: "This Legendary drop was valid for a Level 15 player in Vault 77"
// Without revealing: exact drop rates, player's actual level, RNG seed
circuit ValidLootDrop {
    private input: playerLevel, rngSeed, dropTable
    public input: itemRarity, locationId
    
    // Verify drop was generated correctly
    computedItem = computeDrop(playerLevel, rngSeed, dropTable)
    assert(computedItem.rarity == itemRarity)
    assert(computedItem.location == locationId)
}
```

**Pattern 3: Hidden Loot Until Claim (Mystery Boxes)**
- Loot is committed on-chain as encrypted/hashed value
- Player claims to reveal
- ZK proof proves the reveal matches original commitment

```javascript
// Server-side: Generate mystery loot
const loot = generateLeveledLoot(playerLevel);
const commitment = hash(loot + secret);
// Store commitment on-chain

// Later: Player claims
// ZK proof proves: reveal matches commitment
// Without revealing: how loot was determined
```

#### Solana-Native ZK Options

| Solution | Best For | Complexity |
|----------|----------|------------|
| **Light Protocol** | ZK compression, private state | Medium |
| **Elusiv** | Private transactions | Low |
| **ZK Compression** | Cheap state storage | Low |
| **Custom Groth16** | Full custom logic | High |

#### Implementation with Current Atomic Fizz Caps Stack

Your current loot voucher system already uses Ed25519 signatures. ZKPs can layer on top:

```javascript
// Current: Server signs voucher
const voucher = {
    lootId, latitude, longitude, timestamp, locationHint
};
const signature = nacl.sign.detached(message, serverKey);

// With ZKP enhancement: Add proof of valid generation
const voucher = {
    lootId, latitude, longitude, timestamp, locationHint,
    serverSignature: signature,
    // NEW: ZK proof that loot was generated fairly
    zkProof: generateLootProof({
        playerLevel: player.level,      // private input
        locationTier: location.tier,    // private input  
        lootId: lootId,                 // public output
        rarity: loot.rarity             // public output
    })
};
```

#### When to Use ZKPs vs When NOT To

| Use ZKPs For | Don't Use ZKPs For |
|--------------|-------------------|
| Hiding exact player levels | Basic loot drops (overkill) |
| Proving fair RNG without revealing seed | Public leaderboards |
| Private location claims | Items that should be public |
| Anti-cheat verification | Simple game mechanics |

#### Recommendation for Atomic Fizz Caps

1. **Phase 1:** Keep current system - works great for leveled drops
2. **Phase 2:** Add VRF for provably fair randomness (easier than ZKP)
3. **Phase 3:** Add ZK proofs for privacy features when needed:
   - Private player rankings
   - Hidden loot until reveal (mystery crates)
   - Anti-snipe protection for rare locations

**Bottom Line:** ZKPs won't break your leveled loot - they're an *enhancement layer*. Start with VRF for fairness, then add ZK for privacy features later.

---

### 2. Verifiable Random Functions (VRFs)

**What it is:** Cryptographic primitive that provides provably fair random number generation.

**Use Cases in Gaming:**
- Fair loot distribution
- Random encounter generation
- Tournament brackets
- Provably fair in-game mechanics

**Popular Implementations:**
- **Chainlink VRF** - Industry standard for on-chain randomness
- **Pyth Network VRF** - Solana-native randomness (compatible with current stack)
- **Orao Network** - Solana-focused VRF solution

**Relevance to Atomic Fizz Caps:** Could make loot tables verifiably random and tamper-proof, enhancing trust in the CAPS reward system.

---

### 3. BLS Signatures

**What it is:** Boneh-Lynn-Shacham signatures allowing signature aggregation.

**Use Cases in Gaming:**
- Multi-signature wallets for guild/faction treasuries
- Aggregated voting in DAOs
- Batch transaction signing

**Popular Implementations:**
- Native support in Ethereum 2.0
- Available via libsodium and various cryptographic libraries

---

## Popular Blockchain Networks for Gaming

### Layer 2 Solutions (Ethereum Ecosystem)

| Network | Key Features | Best For |
|---------|--------------|----------|
| **ImmutableX** | Gas-free NFT minting/trading, gaming-focused | NFT-heavy games |
| **Polygon** | Low fees, EVM compatible, widely adopted | Multi-chain games |
| **Arbitrum** | Fast finality, strong security | DeFi + gaming hybrid |
| **Optimism** | OP Stack, modular design | Custom gaming chains |

### Alternative L1s

| Network | Key Features | Best For |
|---------|--------------|----------|
| **Solana** ⭐ (Current) | High TPS, low latency, near-zero fees | Real-time gaming |
| **Avalanche Subnets** | Custom chains per game | Large-scale MMOs |
| **Near Protocol** | Sharding, human-readable addresses | Social gaming |
| **Sui** | Move language, object-centric | Novel game mechanics |
| **Aptos** | Move language, high throughput | Complex game logic |

---

## Multi-Chain Universe: Crossed Timelines Architecture

The concept of a **multi-chain universe** perfectly fits Atomic Fizz Caps' post-apocalyptic wasteland theme - each blockchain can represent a different **timeline**, **dimension**, or **vault sector**. Players can traverse between them, with their actions on one chain affecting others.

### Thematic Chain Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ATOMIC FIZZ CAPS MULTIVERSE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │   SOLANA     │     │   POLYGON    │     │  ARBITRUM    │               │
│   │  "Prime      │     │  "The        │     │  "Industrial │               │
│   │   Timeline"  │◄───►│   Outlands"  │◄───►│   Sector"    │               │
│   │              │     │              │     │              │               │
│   │ • Main game  │     │ • Expanded   │     │ • Crafting   │               │
│   │ • Core loot  │     │   wasteland  │     │ • Trading    │               │
│   │ • $CAPS mint │     │ • PvP zones  │     │ • Auctions   │               │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘               │
│          │                    │                    │                        │
│          └────────────────────┼────────────────────┘                        │
│                               │                                             │
│                    ┌──────────▼───────────┐                                 │
│                    │    WORMHOLE/LZ       │                                 │
│                    │   "The Rift Gate"    │                                 │
│                    │   Cross-chain hub    │                                 │
│                    └──────────┬───────────┘                                 │
│                               │                                             │
│          ┌────────────────────┼────────────────────┐                        │
│          │                    │                    │                        │
│   ┌──────▼───────┐     ┌──────▼───────┐     ┌──────▼───────┐               │
│   │  IMMUTABLEX  │     │   OPTIMISM   │     │     BASE     │               │
│   │  "Vault      │     │  "Timeline   │     │  "New Vegas  │               │
│   │   Archives"  │     │   Alpha"     │     │   2.0"       │               │
│   │              │     │              │     │              │               │
│   │ • NFT vault  │     │ • Alt story  │     │ • Casual     │               │
│   │ • Rare items │     │ • What-ifs   │     │ • Onboarding │               │
│   │ • Collection │     │ • Exclusive  │     │ • Coinbase   │               │
│   └──────────────┘     └──────────────┘     └──────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Chain-Specific Features

#### **Solana - "Prime Timeline" (Current Home)**
- Main game server and $CAPS token
- Primary loot drops and location claims
- Fastest real-time gameplay
- Core player progression

#### **ImmutableX - "Vault Archives"**
- Gas-free NFT minting for rare collectibles
- Long-term item storage and display
- Trading marketplace for legendary gear
- "Preserved from before the war" lore

#### **Polygon - "The Outlands"**
- Expanded wasteland territory
- PvP combat zones
- Faction warfare
- Low-cost transactions for frequent actions

#### **Arbitrum - "Industrial Sector"**
- Crafting and manufacturing hub
- Item combining and upgrades
- Player-to-player trading
- DeFi features (staking, LP)

#### **Optimism - "Timeline Alpha"**
- Alternate storyline content
- "What if the bombs never fell?" zones
- Exclusive timeline-specific loot
- Experimental features testing

#### **Base - "New Vegas 2.0"**
- Onboarding chain for new players
- Coinbase integration for easy fiat
- Casual gameplay modes
- Tutorial vaults

### Cross-Timeline Mechanics

#### 1. **Timeline Rifts (Cross-Chain Travel)**
```javascript
// Player activates a Rift Gate to travel between chains
async function enterTimelineRift(player, targetChain) {
    // 1. Lock/burn assets on source chain
    const receipt = await lockAssetsForTravel(player.wallet, {
        caps: player.capsBalance,
        items: player.equippedGear,
        sourceChain: 'solana'
    });
    
    // 2. Generate cross-chain proof via Wormhole
    const travelProof = await wormhole.createTransferVAA(receipt);
    
    // 3. Player "enters the rift" (loading screen)
    // 4. Emerge on target chain with assets
    await claimOnDestination(targetChain, travelProof);
}
```

#### 2. **Timeline Echoes (Cross-Chain Events)**
Actions on one chain can trigger events on others:

| Action on Source Chain | Effect on Other Chains |
|------------------------|------------------------|
| Burn rare item on Solana | Unlock exclusive quest on Optimism |
| Win PvP match on Polygon | Earn crafting bonus on Arbitrum |
| Claim legendary on any chain | Vault Archives entry on ImmutableX |
| Reach Level 50 | "Timeline Walker" badge on all chains |

#### 3. **Unified Player Identity**
```
┌─────────────────────────────────────────┐
│         WASTELAND PASSPORT              │
│  (Cross-Chain Player Identity)          │
├─────────────────────────────────────────┤
│  Wallet: 7xK9...F2nP (Solana Primary)   │
│  ENS: wastelander.eth                   │
│  SNS: wastelander.sol                   │
├─────────────────────────────────────────┤
│  TIMELINE STATUS:                       │
│  ├─ Solana (Prime): Level 47 ⭐         │
│  ├─ Polygon (Outlands): Level 23        │
│  ├─ Arbitrum (Industrial): Level 15     │
│  ├─ ImmutableX (Archives): 142 NFTs     │
│  └─ Optimism (Alpha): Not visited       │
├─────────────────────────────────────────┤
│  TOTAL $CAPS: 45,230 (across all)       │
│  RIFT JUMPS: 17                         │
└─────────────────────────────────────────┘
```

### Implementation Strategy for Multi-Chain

#### Phase 1: Solana + One L2 (Recommended: Polygon)
- Deploy $CAPS on Polygon via Wormhole
- Basic bridge functionality
- Shared player identity

#### Phase 2: Add ImmutableX for NFTs
- Gas-free NFT trading
- Rare item vault storage
- Collection showcase

#### Phase 3: Arbitrum for DeFi Features
- Staking mechanisms
- Crafting economy
- Trading marketplace

#### Phase 4: Full Multiverse
- Optimism for alternate content
- Base for onboarding
- Full cross-chain events

### Technical Requirements Per Chain

| Chain | Token Standard | NFT Standard | Bridge |
|-------|---------------|--------------|--------|
| Solana | SPL Token | Metaplex | Wormhole |
| Polygon | ERC-20 | ERC-721/1155 | Wormhole/LZ |
| Arbitrum | ERC-20 | ERC-721/1155 | Wormhole/LZ |
| ImmutableX | IMX native | ImmutableX NFT | IMX Bridge |
| Optimism | ERC-20 | ERC-721/1155 | Wormhole/LZ |
| Base | ERC-20 | ERC-721/1155 | Wormhole/LZ |

### Recommended SDK/Tools

```javascript
// Multi-chain SDK setup for Atomic Fizz Caps
const chains = {
    solana: {
        sdk: '@solana/web3.js',
        nft: '@metaplex-foundation/js',
        bridge: '@wormhole-foundation/sdk'
    },
    polygon: {
        sdk: 'ethers.js',
        nft: '@openzeppelin/contracts',
        bridge: '@layerzerolabs/lz-evm-sdk-v2'
    },
    immutablex: {
        sdk: '@imtbl/sdk',
        nft: '@imtbl/sdk', // Built-in
        bridge: '@imtbl/sdk'  // Native bridge
    },
    arbitrum: {
        sdk: 'ethers.js',
        nft: '@openzeppelin/contracts',
        bridge: '@wormhole-foundation/sdk'
    }
};
```

### Lore Integration Ideas

> **"The Great Rift of 2077"**
> 
> When the bombs fell, they didn't just destroy cities—they tore holes in reality itself. 
> The wasteland now exists across multiple timelines, each with its own version of events.
> 
> Vault-Tec's experimental "Quantum Positioning System" allows wastelanders to traverse 
> these rifts, carrying their gear and CAPS between worlds. But beware: some timelines 
> are more dangerous than others, and what you do in one may echo across all of them.
> 
> *"In the multiverse, every choice matters. In the wasteland, every choice kills."*
> — Dr. Harold Fizzworth, Timeline Coordinator, Vault 77

---

## Cross-Chain & Interoperability

### Bridge Protocols

**Wormhole**
- Connects 20+ blockchains
- Already has Solana integration
- Useful for cross-chain NFT trading

**LayerZero**
- Omnichain messaging
- Could enable multi-chain CAPS tokens
- Growing adoption in gaming

**Circle CCTP**
- Native USDC bridging
- Relevant for fiat on/off ramps

**Relevance to Atomic Fizz Caps:** The README mentions a "BRIDGE SYSTEM (COMING SOON)" - these technologies would be directly applicable.

---

## Burn-to-Bridge Tokenomics (Cross-Chain Activation)

This section covers implementation strategies for cross-chain tokenomics where **burning tokens on one chain triggers actions on other chains** - a powerful mechanism for multi-chain gaming economies.

### How Burn-to-Bridge Works

```
┌─────────────────┐    Burn Event    ┌──────────────────┐    Mint/Activate    ┌─────────────────┐
│  Chain A        │ ──────────────▶  │  Bridge/Oracle   │ ────────────────▶   │  Chain B        │
│  (e.g. Solana)  │    $CAPS burn    │  (Wormhole/LZ)   │    $CAPS mint       │  (e.g. Ethereum)│
│                 │                  │                  │    or action        │                 │
└─────────────────┘                  └──────────────────┘                     └─────────────────┘
```

### Implementation Approaches

#### 1. **Lock-and-Mint (Traditional Bridge)**
- Tokens locked on source chain → minted on destination chain
- Reversible: burn on destination → unlock on source
- **Best for:** Standard cross-chain token transfers

#### 2. **Burn-and-Mint (Deflationary Bridge)**
- Tokens permanently burned on source chain → minted on destination
- Creates cross-chain deflation events
- **Best for:** Atomic Fizz Caps NUKE system + cross-chain mechanics

#### 3. **Burn-to-Trigger (Cross-Chain Actions)**
- Burn on one chain triggers smart contract execution on another
- No minting required - just activates functionality
- **Best for:** Multi-chain game events, unlocking content across chains

### Recommended Technologies for Custom Wallet Bridge

#### **Wormhole + Custom Guardian Network**
```
Source Chain (Solana):
1. Player burns $CAPS via your program
2. Emit Wormhole message with burn proof
3. Guardian network validates

Destination Chain (EVM/Other):
4. Relayer submits VAA (Verified Action Approval)
5. Destination contract verifies and executes action
```

**Solana Program (Anchor) - Burn Event Example:**
```rust
// In your fizzcaps-onchain program
pub fn burn_for_bridge(ctx: Context<BurnForBridge>, amount: u64, target_chain: u16) -> Result<()> {
    // 1. Burn tokens
    burn(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.caps_mint.to_account_info(),
            from: ctx.accounts.player_caps_ata.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        },
    ), amount)?;
    
    // 2. Emit cross-chain message via Wormhole
    wormhole::post_message(
        CpiContext::new_with_signer(...),
        BridgeMessage {
            action: BridgeAction::BurnTrigger,
            source_wallet: ctx.accounts.player.key(),
            amount,
            target_chain,
            timestamp: Clock::get()?.unix_timestamp,
        }
    )?;
    
    Ok(())
}
```

#### **LayerZero OFT (Omnichain Fungible Token)**
- Native omnichain token standard
- Built-in burn-and-mint mechanics
- Supports custom logic on send/receive

**Key Features:**
- `_debitFrom()` - Burns on source chain
- `_creditTo()` - Mints on destination chain
- Custom `_lzReceive()` - Execute arbitrary logic on receive

#### **Axelar GMP (General Message Passing)**
- Cross-chain smart contract calls
- Supports complex multi-chain workflows
- Good for triggering game events across chains

### Multi-Chain Tokenomics Patterns

#### Pattern 1: **Unified Supply Across Chains**
```
Total Supply: 1,000,000 CAPS (fixed)
├── Solana: 400,000 CAPS
├── Ethereum: 300,000 CAPS
├── Polygon: 200,000 CAPS
└── Arbitrum: 100,000 CAPS

Burn on Solana → Mint equivalent on target chain
Total supply stays constant
```

#### Pattern 2: **Deflationary Cross-Chain Burns**
```
Burn 100 CAPS on Solana → Mint 95 CAPS on Ethereum (5% burn fee)
Creates deflationary pressure with each bridge
Good for: NUKE system integration
```

#### Pattern 3: **Burn-to-Unlock (No Minting)**
```
Burn CAPS on Solana → Unlock game content on Ethereum
├── Unlock NFT collections
├── Activate cross-chain quests
├── Enable wasteland regions on other chains
└── Trigger cross-chain airdrops
```

### Custom Wallet Integration

For your custom wallet with built-in bridge functionality:

**Frontend Flow:**
```javascript
// Custom wallet bridge integration
async function burnAndBridge(amount, targetChain) {
    // 1. Build burn instruction
    const burnIx = await program.methods
        .burnForBridge(new BN(amount), targetChain)
        .accounts({...})
        .instruction();
    
    // 2. Get Wormhole message instruction
    const wormholeIx = await getWormholeMessageIx(burnIx);
    
    // 3. Send transaction
    const tx = new Transaction().add(burnIx, wormholeIx);
    const sig = await wallet.sendTransaction(tx);
    
    // 4. Wait for VAA
    const vaa = await getSignedVAA(sig);
    
    // 5. Submit to destination chain
    await submitToDestination(vaa, targetChain);
}
```

**Required Infrastructure:**
1. **Solana Program** - Burn + emit cross-chain message
2. **Wormhole/LayerZero Integration** - Message relay
3. **Destination Contracts** - EVM, other chains
4. **Relayer Service** - Auto-submit VAAs (or manual user submission)
5. **Custom Wallet UI** - Unified bridge interface

### Implementation Roadmap

| Phase | Task | Technology |
|-------|------|------------|
| 1 | Basic burn-and-mint bridge | Wormhole Token Bridge |
| 2 | Add custom bridge message types | Wormhole Core + custom payload |
| 3 | Cross-chain game actions | LayerZero/Axelar GMP |
| 4 | Multi-chain NFT support | Wormhole NFT Bridge |
| 5 | Custom wallet integration | All above + unified UI |

### Resources for Implementation

- [Wormhole Docs - Solana Integration](https://docs.wormhole.com/wormhole/blockchain-environments/solana)
- [LayerZero OFT Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart)
- [Axelar GMP](https://docs.axelar.dev/dev/general-message-passing/overview)
- [Cross-Chain Token Standard (ERC-7281)](https://eips.ethereum.org/EIPS/eip-7281)

---

## Decentralized Identity (DID)

### Implementations

- **Solana Name Service (SNS)** - Human-readable wallet addresses
- **Ethereum Name Service (ENS)** - Cross-chain identity standard
- **Civic** - KYC/identity verification on Solana
- **Verifiable Credentials** - W3C standard for portable identity

**Relevance to Atomic Fizz Caps:** Could enable persistent player identities, portable across games and platforms.

---

## Data Availability & Storage

### Decentralized Storage

| Solution | Best For | Integration |
|----------|----------|-------------|
| **Arweave** | Permanent NFT metadata | Common with Metaplex |
| **IPFS/Filecoin** | General decentralized storage | Widely supported |
| **Shadow Drive** | Solana-native storage | Native integration |

---

## Recommended Integration Priority

Based on the current Atomic Fizz Caps architecture, here are prioritized recommendations:

### High Priority
1. **Chainlink VRF / Pyth VRF** - For provably fair loot drops
2. **Wormhole Bridge** - For cross-chain CAPS token
3. **Shadow Drive** - For decentralized loot metadata storage

### Medium Priority
4. **Solana Name Service** - For player-friendly addresses
5. **Zero-Knowledge proofs** - For private leaderboards
6. **Civic Identity** - For bot prevention

### Future Consideration
7. **Alternative L2s** - For Ethereum ecosystem expansion
8. **Avalanche Subnets** - For dedicated game chain

---

## Implementation Resources

### Solana-Native Solutions
- [Pyth Network](https://pyth.network/) - Oracle and VRF
- [Switchboard](https://switchboard.xyz/) - Oracles and randomness
- [Shadow Drive](https://www.shdwdrive.com/) - Decentralized storage
- [Wormhole](https://wormhole.com/) - Cross-chain messaging

### Documentation
- [Solana Cookbook](https://solanacookbook.com/) - Integration guides
- [Metaplex Docs](https://developers.metaplex.com/) - NFT standards
- [Anchor Framework](https://www.anchor-lang.com/) - Smart contract development

---

---

## Staking Integration Without Breaking the Game Loop

This section covers how to add staking to Atomic Fizz Caps in a way that **enhances** the game loop rather than disrupting it. The key principle: staking should feel like a natural part of the wasteland experience, not a separate DeFi product.

### Why Staking Can Break Games (And How to Avoid It)

**Common Mistakes:**
| Problem | Why It Breaks the Game | Solution |
|---------|----------------------|----------|
| Staking gives better loot | Pay-to-win, kills fairness | Staking gives *cosmetics* or *convenience*, not power |
| Unstaking takes days | Players can't play when they want | Instant unstake with small fee, or "soft staking" |
| Staking is separate from gameplay | Feels like two different apps | Integrate staking INTO game mechanics |
| High APY attracts farmers, not players | Community becomes mercenary | Moderate APY with gameplay multipliers |

### Game-Integrated Staking Models

#### Model 1: "Vault Bunker" Staking (Recommended)

**Concept:** Players "fortify" a claimed location by staking CAPS there. This is a natural extension of the claim mechanic.

```
┌─────────────────────────────────────────────────────────────┐
│                    VAULT BUNKER SYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Player claims location → Option to "Fortify" with CAPS   │
│                               ↓                             │
│   ┌─────────────────────────────────────────────────┐      │
│   │  FORTIFIED BUNKER                               │      │
│   │  Location: Vault 77 - Sector C                  │      │
│   │  Staked: 500 CAPS                               │      │
│   │  Fortification Level: ██████░░░░ 60%            │      │
│   │                                                 │      │
│   │  BENEFITS (while staked):                       │      │
│   │  • +10% XP from this location                   │      │
│   │  • Exclusive bunker cosmetics                   │      │
│   │  • Daily passive CAPS (small amount)            │      │
│   │  • Priority access during high traffic          │      │
│   │                                                 │      │
│   │  [Withdraw CAPS]  [Add More CAPS]               │      │
│   └─────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why This Works:**
- Staking IS gameplay (fortifying locations)
- Benefits are meaningful but not game-breaking
- Players stay engaged with the map
- Natural sink for CAPS token

**Implementation:**

```javascript
// Backend: Fortify location endpoint
app.post('/api/location/:locationId/fortify', authMiddleware, async (req, res) => {
    const { locationId } = req.params;
    const { amount } = req.body;
    const player = req.player;
    
    // Validate player owns this location claim
    const claim = await getClaim(player.wallet, locationId);
    if (!claim) return res.status(403).json({ error: 'You must claim this location first' });
    
    // Check CAPS balance
    const balance = await getCapsBalance(player.wallet);
    if (balance < amount) return res.status(400).json({ error: 'Insufficient CAPS' });
    
    // Transfer CAPS to staking vault (on-chain)
    const stakeTx = await stakeToLocation(player.wallet, locationId, amount);
    
    // Update location fortification level
    const newLevel = calculateFortificationLevel(claim.stakedAmount + amount);
    await updateClaim(claim.id, { 
        stakedAmount: claim.stakedAmount + amount,
        fortificationLevel: newLevel 
    });
    
    res.json({ 
        ok: true, 
        stakedAmount: claim.stakedAmount + amount,
        fortificationLevel: newLevel,
        benefits: getFortificationBenefits(newLevel)
    });
});
```

```rust
// Solana Program: Stake to location
pub fn stake_to_location(
    ctx: Context<StakeToLocation>,
    location_id: u64,
    amount: u64
) -> Result<()> {
    // Transfer CAPS from player to location vault PDA
    let location_vault_seeds = &[
        b"location-vault",
        location_id.to_le_bytes().as_ref(),
        &[ctx.bumps.location_vault]
    ];
    
    anchor_spl::token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.player_caps_ata.to_account_info(),
                to: ctx.accounts.location_vault.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // Update stake record
    let stake = &mut ctx.accounts.stake_record;
    stake.player = ctx.accounts.player.key();
    stake.location_id = location_id;
    stake.amount = stake.amount.checked_add(amount).unwrap();
    stake.staked_at = Clock::get()?.unix_timestamp;
    
    Ok(())
}
```

#### Model 2: "Gear Infusion" NFT Staking

**Concept:** Stake your NFT gear items to "infuse" them with power. The gear stays in your inventory but is locked.

```
┌─────────────────────────────────────────────────────┐
│  GEAR INFUSION CHAMBER                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐                                    │
│  │  [WEAPON]   │  Plasma Rifle Mk.II                │
│  │   ⚡⚡⚡     │  Rarity: Rare                       │
│  └─────────────┘                                    │
│                                                     │
│  INFUSION STATUS: ACTIVE ████████░░ 80%             │
│  Time Infused: 14 days                              │
│                                                     │
│  BONUSES EARNED:                                    │
│  • +5% damage (cosmetic glow effect)                │
│  • "Infused" title badge                            │
│  • 12 CAPS accumulated (claimable)                  │
│                                                     │
│  ⚠️  Gear is LOCKED while infusing                  │
│  You can still USE it, but cannot TRADE/SELL       │
│                                                     │
│  [Claim CAPS]  [Stop Infusion]                      │
└─────────────────────────────────────────────────────┘
```

**Why This Works:**
- Players keep playing with their gear
- Lock prevents instant dump after rewards
- Creates attachment to items
- Rewards loyalty, not just capital

#### Model 3: "Faction Staking" (For Multi-Chain)

**Concept:** Stake CAPS to your faction's treasury across any chain. Faction with most staked gets bonuses.

```
FACTION STANDINGS (This Week):
┌────────────────────────────────────────────────────┐
│ 1. 🔴 Brotherhood of Steel    450,000 CAPS staked  │
│    └─ Bonus: +15% XP in Industrial Sector          │
│                                                    │
│ 2. 🟢 New California Republic 380,000 CAPS staked  │
│    └─ Bonus: +10% XP in The Outlands               │
│                                                    │
│ 3. 🟡 Caesar's Legion         290,000 CAPS staked  │
│    └─ Bonus: +5% XP everywhere                     │
│                                                    │
│ 4. ⚪ Independent (No faction) - No bonus          │
└────────────────────────────────────────────────────┘

Your Contribution: 1,200 CAPS to Brotherhood
Your Share of Rewards: 0.26% of faction pool
```

**Cross-Chain Integration:**
- Stake on Solana → counts for Solana faction standing
- Stake on Polygon → counts for Polygon faction standing  
- Total across all chains determines global faction rank
- Creates healthy competition between timelines

### Staking Rewards That Don't Break Economy

**Safe Reward Types:**

| Reward Type | Game Impact | Economy Impact |
|-------------|-------------|----------------|
| Cosmetics | Zero | Zero |
| XP Boost (capped) | Low | Zero |
| Convenience (fast travel) | Low | Zero |
| Small CAPS yield | Low | Low (if controlled) |
| Exclusive quests | Medium | Zero |
| Crafting discounts | Medium | Low |

**Dangerous Reward Types (AVOID):**

| Reward Type | Why Dangerous |
|-------------|---------------|
| Better loot drops | Pay-to-win |
| Higher damage | Pay-to-win |
| More inventory | Pay-to-win |
| High APY (>50%) | Attracts farmers, not players |
| Exclusive powerful items | Creates inequality |

### Safe APY Calculation

**Formula for sustainable staking:**

```
Base APY = Token Inflation Rate × Staking Participation Target

Example:
- You want 40% of tokens staked
- Your inflation rate is 5% per year
- Safe APY = 5% / 40% = 12.5% APY for stakers

If APY is too high → more people stake → APY drops
If APY is too low → people unstake → APY rises
Self-balancing system!
```

**For Atomic Fizz Caps:**

```javascript
// Dynamic APY based on participation
function calculateCurrentAPY() {
    const totalSupply = 1_000_000_000; // 1B CAPS
    const totalStaked = getTotalStaked(); // From chain
    const targetStakeRatio = 0.4; // Want 40% staked
    const baseInflation = 0.05; // 5% annual inflation
    
    const currentRatio = totalStaked / totalSupply;
    
    // If under target, increase APY to attract stakers
    // If over target, decrease APY
    const multiplier = targetStakeRatio / Math.max(currentRatio, 0.01);
    const apy = baseInflation * multiplier;
    
    // Cap between 5% and 25%
    return Math.min(Math.max(apy, 0.05), 0.25);
}
```

### Implementation Phases (Non-Breaking)

#### Phase 1: Soft Launch (Week 1-2)
- Add "Fortify Location" UI button (disabled)
- Show "Coming Soon" messaging
- Gather player feedback on concept

#### Phase 2: Limited Beta (Week 3-4)
- Enable for top 100 players only
- Low caps on stake amounts (max 1000 CAPS)
- Monitor for exploits/abuse

#### Phase 3: Public Launch (Week 5+)
- Open to all players
- Gradual increase of stake limits
- Add faction staking
- Cross-chain staking (if ready)

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   STAKING ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   Frontend   │     │   Backend    │     │   Solana    │ │
│  │              │────▶│   Server     │────▶│   Program   │ │
│  │  • Stake UI  │     │              │     │             │ │
│  │  • Rewards   │◀────│  • Validate  │◀────│  • Stake    │ │
│  │  • History   │     │  • Calculate │     │  • Unstake  │ │
│  └──────────────┘     │  • Cache     │     │  • Rewards  │ │
│                       └──────────────┘     └─────────────┘ │
│                              │                     │        │
│                              ▼                     ▼        │
│                       ┌──────────────┐     ┌─────────────┐ │
│                       │    Redis     │     │  Stake PDAs │ │
│                       │   (Cache)    │     │  (On-chain) │ │
│                       └──────────────┘     └─────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Backend Integration Points

```javascript
// New routes to add (backend/api/staking.js)
const router = require('express').Router();
const { authMiddleware } = require('../lib/auth');

// Get staking options for a location
router.get('/location/:locationId/staking', authMiddleware, async (req, res) => {
    const { locationId } = req.params;
    const claim = await getPlayerClaim(req.player.wallet, locationId);
    
    res.json({
        canStake: !!claim,
        currentStake: claim?.stakedAmount || 0,
        fortificationLevel: claim?.fortificationLevel || 0,
        benefits: getFortificationBenefits(claim?.fortificationLevel || 0),
        estimatedAPY: calculateCurrentAPY()
    });
});

// Stake CAPS to location
router.post('/location/:locationId/stake', authMiddleware, async (req, res) => {
    // ... implementation above
});

// Unstake CAPS from location
router.post('/location/:locationId/unstake', authMiddleware, async (req, res) => {
    const { locationId } = req.params;
    const { amount } = req.body;
    
    // Instant unstake with 5% fee (goes to game treasury)
    const fee = amount * 0.05;
    const returned = amount - fee;
    
    // Process on-chain
    await unstakeFromLocation(req.player.wallet, locationId, amount, fee);
    
    res.json({ ok: true, returned, fee });
});

// Claim accumulated rewards
router.post('/staking/claim-rewards', authMiddleware, async (req, res) => {
    const rewards = await calculatePendingRewards(req.player.wallet);
    await claimStakingRewards(req.player.wallet);
    
    res.json({ ok: true, claimed: rewards });
});

module.exports = router;
```

### Key Principles Summary

1. **Staking = Gameplay** - Make it feel like part of the game, not a separate finance app
2. **No Pay-to-Win** - Rewards should be cosmetic, convenience, or small yield
3. **Instant Access** - Players should always be able to unstake and play (with small fee)
4. **Sustainable APY** - Use dynamic rates that self-balance
5. **Phased Rollout** - Start small, monitor, then expand
6. **Cross-Chain Ready** - Design for multi-chain from the start

---

## Fizz.fun Token Launchpad - Marketing & Utility Strategy

A token launchpad built into the Atomic Fizz Caps ecosystem could serve as both a **major marketing tool** and a **utility driver for $CAPS**. Similar to pump.fun but integrated with the wasteland theme - "Fizz.fun" lets anyone launch tokens, but only if they hold CAPS.

### Why a Token Launchpad?

| Benefit | Description |
|---------|-------------|
| **CAPS Utility** | Holding CAPS becomes a requirement to launch, creating buy pressure |
| **Marketing** | Every token launched brings new users to the ecosystem |
| **Revenue** | Small fees on launches/trades go to treasury |
| **Community** | Meme tokens create viral moments and engagement |
| **Cross-Promotion** | New tokens can integrate with the game |

### Fizz.fun Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🧪 FIZZ.FUN 🧪                                    │
│                    "Brew Your Own Atomic Token"                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  LAUNCH REQUIREMENTS                                                │  │
│   │  ✓ Hold at least 1,000 CAPS in connected wallet                     │  │
│   │  ✓ Pay 100 CAPS launch fee (burned)                                 │  │
│   │  ✓ Choose token name, symbol, and supply                            │  │
│   │  ✓ Set bonding curve parameters                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  TRENDING TOKENS                                           24h Vol  │  │
│   │  ──────────────────────────────────────────────────────────────────│  │
│   │  1. 🔥 $RADROACH    "For the bugs that survived"      45,000 SOL   │  │
│   │  2. 🥤 $NUKA        "Classic wasteland refreshment"   32,000 SOL   │  │
│   │  3. ⚛️ $GLOW        "Embrace the radiation"           28,000 SOL   │  │
│   │  4. 🤖 $PROTECTRON  "Beep boop"                        15,000 SOL   │  │
│   │  5. 🎰 $LUCKYCAPS   "Feeling lucky?"                   12,000 SOL   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   [🧪 Launch Token]  [📊 My Tokens]  [🔥 Trending]  [💰 Portfolio]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CAPS Holder Gating

**Tiered Access Based on CAPS Holdings:**

| CAPS Held | Privileges |
|-----------|------------|
| 100 CAPS | Can buy/sell tokens on Fizz.fun |
| 1,000 CAPS | Can launch tokens |
| 10,000 CAPS | Reduced launch fees (50 CAPS instead of 100) |
| 100,000 CAPS | Featured placement, priority support |
| 1,000,000 CAPS | "Vault Overseer" badge, governance rights |

```javascript
// Backend: Check CAPS balance for launch eligibility
async function checkLaunchEligibility(wallet) {
    const capsBalance = await getCapsBalance(wallet);
    
    if (capsBalance < 100) {
        return { 
            eligible: false, 
            canTrade: false,
            reason: 'Hold at least 100 CAPS to use Fizz.fun' 
        };
    }
    
    if (capsBalance < 1000) {
        return { 
            eligible: false, 
            canTrade: true,
            reason: 'Hold at least 1,000 CAPS to launch tokens' 
        };
    }
    
    const launchFee = capsBalance >= 10000 ? 50 : 100;
    const tier = capsBalance >= 1000000 ? 'overseer' : 
                 capsBalance >= 100000 ? 'elite' :
                 capsBalance >= 10000 ? 'veteran' : 'wastelander';
    
    return { 
        eligible: true, 
        canTrade: true,
        launchFee,
        tier,
        perks: getTierPerks(tier)
    };
}
```

### How Pump.fun Actually Works (For Reference)

Since Fizz.fun is already in your wallet, here's exactly how pump.fun works so you can replicate it for your ecosystem:

#### Pump.fun Core Mechanics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PUMP.FUN LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: LAUNCH                                                            │
│  ─────────────────                                                          │
│  • Creator pays ~0.02 SOL to create token                                   │
│  • 1 BILLION tokens minted (fixed supply)                                   │
│  • 800M tokens go into bonding curve pool                                   │
│  • 200M tokens reserved for Raydium LP at graduation                        │
│  • NO pre-sale, NO team allocation, NO presale                              │
│                                                                             │
│  PHASE 2: BONDING CURVE TRADING                                             │
│  ─────────────────────────────                                              │
│  • Users buy/sell from the curve (not each other)                           │
│  • Price increases as more is bought                                        │
│  • Price decreases as more is sold                                          │
│  • 1% fee on each trade (to pump.fun)                                       │
│  • Target: Raise ~85 SOL to graduate                                        │
│                                                                             │
│  PHASE 3: GRADUATION TO RAYDIUM                                             │
│  ─────────────────────────────────                                          │
│  • At 85 SOL raised, curve "graduates"                                      │
│  • ~79 SOL + 200M tokens → Raydium LP                                       │
│  • LP tokens are BURNED (liquidity locked forever)                          │
│  • Token now trades freely on Raydium                                       │
│  • Creator gets ~6 SOL graduation bonus                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fizz.fun: Pump.fun For Your Ecosystem

Here's exactly how to adapt this for Atomic Fizz Caps:

#### Key Differences from Pump.fun

| Aspect | Pump.fun | Fizz.fun |
|--------|----------|----------|
| Who can launch | Anyone | CAPS holders only |
| Launch cost | ~0.02 SOL | 100 CAPS (burned) + 0.02 SOL |
| Trading access | Anyone | CAPS holders only (optional) |
| Fees | 1% to pump.fun | 1% split: treasury + creator |
| Theme | Generic | Wasteland/Atomic |
| Integration | None | Game items, quests, factions |

### Exact Bonding Curve Math (Pump.fun Style)

Pump.fun uses a **constant product** style curve. Here's the exact math:

```javascript
// Fizz.fun Bonding Curve Implementation
// This matches pump.fun's actual curve behavior

const TOTAL_SUPPLY = 1_000_000_000; // 1 billion tokens
const CURVE_SUPPLY = 800_000_000;   // 800M in curve
const LP_SUPPLY = 200_000_000;      // 200M reserved for LP
const GRADUATION_SOL = 85_000_000_000; // 85 SOL in lamports
const INITIAL_VIRTUAL_SOL = 30_000_000_000; // 30 SOL virtual liquidity

/**
 * Calculate tokens received for SOL input
 * Uses constant product formula: x * y = k
 */
function calculateBuyTokens(solAmount, currentSolReserve, currentTokenReserve) {
    // Add virtual liquidity for initial price stability
    const virtualSol = currentSolReserve + INITIAL_VIRTUAL_SOL;
    const k = virtualSol * currentTokenReserve;
    
    const newSolReserve = virtualSol + solAmount;
    const newTokenReserve = k / newSolReserve;
    
    const tokensOut = currentTokenReserve - newTokenReserve;
    
    return Math.floor(tokensOut);
}

/**
 * Calculate SOL received for token input
 */
function calculateSellReturn(tokenAmount, currentSolReserve, currentTokenReserve) {
    const virtualSol = currentSolReserve + INITIAL_VIRTUAL_SOL;
    const k = virtualSol * currentTokenReserve;
    
    const newTokenReserve = currentTokenReserve + tokenAmount;
    const newSolReserve = k / newTokenReserve;
    
    const solOut = virtualSol - newSolReserve;
    
    // Can't return more than actual reserve
    return Math.floor(Math.min(solOut, currentSolReserve));
}

/**
 * Calculate current token price
 */
function getCurrentPrice(currentSolReserve, currentTokenReserve) {
    const virtualSol = currentSolReserve + INITIAL_VIRTUAL_SOL;
    // Price = SOL reserve / Token reserve
    return virtualSol / currentTokenReserve;
}

/**
 * Calculate market cap
 */
function getMarketCap(currentSolReserve, currentTokenReserve) {
    const price = getCurrentPrice(currentSolReserve, currentTokenReserve);
    return price * TOTAL_SUPPLY;
}
```

### Complete Solana Program (Production-Ready Structure)

```rust
// programs/fizz-fun/src/lib.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("YOUR_PROGRAM_ID_HERE");

// Constants matching pump.fun
const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1B with 9 decimals
const CURVE_SUPPLY: u64 = 800_000_000_000_000_000;   // 800M
const LP_RESERVE: u64 = 200_000_000_000_000_000;     // 200M
const GRADUATION_SOL: u64 = 85_000_000_000;          // 85 SOL
const VIRTUAL_SOL: u64 = 30_000_000_000;             // 30 SOL virtual
const FEE_BPS: u64 = 100;                            // 1% fee
const CAPS_DECIMALS: u64 = 1_000_000_000;            // 9 decimals

// CAPS requirements
const CAPS_TO_LAUNCH: u64 = 1000 * CAPS_DECIMALS;
const CAPS_TO_TRADE: u64 = 100 * CAPS_DECIMALS;
const CAPS_LAUNCH_FEE: u64 = 100 * CAPS_DECIMALS;

#[program]
pub mod fizz_fun {
    use super::*;

    /// Initialize the Fizz.fun protocol
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.caps_mint = ctx.accounts.caps_mint.key();
        config.total_tokens_launched = 0;
        config.total_volume_sol = 0;
        config.total_caps_burned = 0;
        Ok(())
    }

    /// Launch a new token on Fizz.fun
    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        // 1. Verify CAPS balance >= 1000
        require!(
            ctx.accounts.creator_caps_ata.amount >= CAPS_TO_LAUNCH,
            FizzError::InsufficientCapsToLaunch
        );

        // 2. Burn CAPS launch fee (100 CAPS)
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.caps_mint.to_account_info(),
                    from: ctx.accounts.creator_caps_ata.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            CAPS_LAUNCH_FEE,
        )?;

        // 3. Initialize bonding curve state
        let curve = &mut ctx.accounts.bonding_curve;
        curve.creator = ctx.accounts.creator.key();
        curve.token_mint = ctx.accounts.token_mint.key();
        curve.name = name.clone();
        curve.symbol = symbol.clone();
        curve.uri = uri;
        curve.sol_reserve = 0;
        curve.token_reserve = CURVE_SUPPLY;
        curve.total_supply = TOTAL_SUPPLY;
        curve.graduated = false;
        curve.created_at = Clock::get()?.unix_timestamp;
        curve.bump = ctx.bumps.bonding_curve;

        // 4. Mint total supply to curve vault
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding_curve",
                    ctx.accounts.token_mint.key().as_ref(),
                    &[curve.bump],
                ]],
            ),
            TOTAL_SUPPLY,
        )?;

        // 5. Update global config
        let config = &mut ctx.accounts.config;
        config.total_tokens_launched += 1;
        config.total_caps_burned += CAPS_LAUNCH_FEE;

        emit!(TokenCreated {
            mint: ctx.accounts.token_mint.key(),
            creator: ctx.accounts.creator.key(),
            name,
            symbol,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Buy tokens from the bonding curve
    pub fn buy(ctx: Context<BuyTokens>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        // 1. Verify CAPS balance for trading
        require!(
            ctx.accounts.buyer_caps_ata.amount >= CAPS_TO_TRADE,
            FizzError::InsufficientCapsToTrade
        );

        let curve = &mut ctx.accounts.bonding_curve;
        require!(!curve.graduated, FizzError::TokenGraduated);

        // 2. Calculate fee (1%)
        let fee = sol_amount.checked_mul(FEE_BPS).unwrap().checked_div(10000).unwrap();
        let sol_after_fee = sol_amount.checked_sub(fee).unwrap();

        // 3. Calculate tokens out using constant product
        let virtual_sol = curve.sol_reserve.checked_add(VIRTUAL_SOL).unwrap();
        let k = virtual_sol.checked_mul(curve.token_reserve).unwrap();
        let new_sol = virtual_sol.checked_add(sol_after_fee).unwrap();
        let new_tokens = k.checked_div(new_sol).unwrap();
        let tokens_out = curve.token_reserve.checked_sub(new_tokens).unwrap();

        require!(tokens_out >= min_tokens_out, FizzError::SlippageExceeded);

        // 4. Transfer SOL from buyer to curve vault
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.curve_sol_vault.to_account_info(),
                },
            ),
            sol_after_fee,
        )?;

        // 5. Transfer fee to treasury
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;

        // 6. Transfer tokens to buyer
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.curve_token_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_ata.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding_curve",
                    curve.token_mint.as_ref(),
                    &[curve.bump],
                ]],
            ),
            tokens_out,
        )?;

        // 7. Update curve state
        curve.sol_reserve = curve.sol_reserve.checked_add(sol_after_fee).unwrap();
        curve.token_reserve = curve.token_reserve.checked_sub(tokens_out).unwrap();

        // 8. Check for graduation
        if curve.sol_reserve >= GRADUATION_SOL {
            // Will trigger graduation in separate instruction
            emit!(ReadyToGraduate {
                mint: curve.token_mint,
                sol_raised: curve.sol_reserve,
            });
        }

        emit!(TokenBought {
            mint: curve.token_mint,
            buyer: ctx.accounts.buyer.key(),
            sol_amount: sol_after_fee,
            tokens_received: tokens_out,
            new_price: calculate_price(curve.sol_reserve, curve.token_reserve),
        });

        Ok(())
    }

    /// Sell tokens back to the bonding curve
    pub fn sell(ctx: Context<SellTokens>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.bonding_curve;
        require!(!curve.graduated, FizzError::TokenGraduated);

        // 1. Calculate SOL out using constant product
        let virtual_sol = curve.sol_reserve.checked_add(VIRTUAL_SOL).unwrap();
        let k = virtual_sol.checked_mul(curve.token_reserve).unwrap();
        let new_tokens = curve.token_reserve.checked_add(token_amount).unwrap();
        let new_sol = k.checked_div(new_tokens).unwrap();
        let sol_out_gross = virtual_sol.checked_sub(new_sol).unwrap();
        
        // Can't withdraw more than actual reserve
        let sol_out_gross = std::cmp::min(sol_out_gross, curve.sol_reserve);

        // 2. Calculate fee (1%)
        let fee = sol_out_gross.checked_mul(FEE_BPS).unwrap().checked_div(10000).unwrap();
        let sol_out = sol_out_gross.checked_sub(fee).unwrap();

        require!(sol_out >= min_sol_out, FizzError::SlippageExceeded);

        // 3. Transfer tokens from seller to curve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_ata.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // 4. Transfer SOL to seller (from PDA vault)
        **ctx.accounts.curve_sol_vault.try_borrow_mut_lamports()? -= sol_out;
        **ctx.accounts.seller.try_borrow_mut_lamports()? += sol_out;

        // 5. Transfer fee to treasury
        **ctx.accounts.curve_sol_vault.try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += fee;

        // 6. Update curve state
        curve.sol_reserve = curve.sol_reserve.checked_sub(sol_out_gross).unwrap();
        curve.token_reserve = curve.token_reserve.checked_add(token_amount).unwrap();

        emit!(TokenSold {
            mint: curve.token_mint,
            seller: ctx.accounts.seller.key(),
            tokens_sold: token_amount,
            sol_received: sol_out,
            new_price: calculate_price(curve.sol_reserve, curve.token_reserve),
        });

        Ok(())
    }

    /// Graduate token to Raydium (called when threshold reached)
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let curve = &mut ctx.accounts.bonding_curve;
        require!(!curve.graduated, FizzError::AlreadyGraduated);
        require!(curve.sol_reserve >= GRADUATION_SOL, FizzError::NotReadyToGraduate);

        // 1. Calculate amounts for Raydium LP
        let lp_sol = curve.sol_reserve.checked_mul(93).unwrap().checked_div(100).unwrap(); // 93%
        let creator_bonus = curve.sol_reserve.checked_sub(lp_sol).unwrap(); // 7% to creator

        // 2. Create Raydium pool (CPI to Raydium program)
        // This is simplified - actual implementation needs Raydium CPI
        msg!("Creating Raydium pool with {} SOL and {} tokens", lp_sol, LP_RESERVE);

        // 3. Send creator bonus
        **ctx.accounts.curve_sol_vault.try_borrow_mut_lamports()? -= creator_bonus;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += creator_bonus;

        // 4. Mark as graduated
        curve.graduated = true;
        curve.graduated_at = Some(Clock::get()?.unix_timestamp);

        emit!(TokenGraduated {
            mint: curve.token_mint,
            creator: curve.creator,
            sol_raised: curve.sol_reserve,
            creator_bonus,
            raydium_pool: ctx.accounts.raydium_pool.key(),
        });

        Ok(())
    }
}

// ============ ACCOUNT STRUCTURES ============

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub caps_mint: Pubkey,
    pub total_tokens_launched: u64,
    pub total_volume_sol: u64,
    pub total_caps_burned: u64,
}

#[account]
pub struct BondingCurve {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub sol_reserve: u64,
    pub token_reserve: u64,
    pub total_supply: u64,
    pub graduated: bool,
    pub graduated_at: Option<i64>,
    pub created_at: i64,
    pub bump: u8,
}

// ============ CONTEXT STRUCTURES ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    
    /// CHECK: Treasury wallet
    pub treasury: AccountInfo<'info>,
    
    pub caps_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = bonding_curve,
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 64 + 16 + 256 + 8 + 8 + 8 + 1 + 9 + 8 + 1,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve,
    )]
    pub curve_token_vault: Account<'info, TokenAccount>,
    
    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"sol_vault", token_mint.key().as_ref()],
        bump
    )]
    pub curve_sol_vault: AccountInfo<'info>,
    
    // CAPS accounts for fee burning
    #[account(address = config.caps_mint)]
    pub caps_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = caps_mint,
        associated_token::authority = creator,
    )]
    pub creator_caps_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,
    
    /// CHECK: SOL vault
    #[account(mut, seeds = [b"sol_vault", bonding_curve.token_mint.as_ref()], bump)]
    pub curve_sol_vault: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_ata: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    
    // CAPS verification
    pub caps_mint: Account<'info, Mint>,
    
    #[account(
        associated_token::mint = caps_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_caps_ata: Account<'info, TokenAccount>,
    
    /// CHECK: Treasury for fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,
    
    /// CHECK: SOL vault
    #[account(mut, seeds = [b"sol_vault", bonding_curve.token_mint.as_ref()], bump)]
    pub curve_sol_vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub seller_token_ata: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    
    /// CHECK: Treasury for fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    /// CHECK: Creator receives bonus
    #[account(mut, address = bonding_curve.creator)]
    pub creator: AccountInfo<'info>,
    
    /// CHECK: SOL vault
    #[account(mut, seeds = [b"sol_vault", bonding_curve.token_mint.as_ref()], bump)]
    pub curve_sol_vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,
    
    /// CHECK: Raydium pool (created during graduation)
    #[account(mut)]
    pub raydium_pool: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ============ EVENTS ============

#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub timestamp: i64,
}

#[event]
pub struct TokenBought {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
    pub new_price: u64,
}

#[event]
pub struct TokenSold {
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub tokens_sold: u64,
    pub sol_received: u64,
    pub new_price: u64,
}

#[event]
pub struct ReadyToGraduate {
    pub mint: Pubkey,
    pub sol_raised: u64,
}

#[event]
pub struct TokenGraduated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub sol_raised: u64,
    pub creator_bonus: u64,
    pub raydium_pool: Pubkey,
}

// ============ ERRORS ============

#[error_code]
pub enum FizzError {
    #[msg("Must hold at least 1000 CAPS to launch tokens")]
    InsufficientCapsToLaunch,
    #[msg("Must hold at least 100 CAPS to trade")]
    InsufficientCapsToTrade,
    #[msg("Token has already graduated to Raydium")]
    TokenGraduated,
    #[msg("Token has already graduated")]
    AlreadyGraduated,
    #[msg("Token has not reached graduation threshold")]
    NotReadyToGraduate,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}

// ============ HELPER FUNCTIONS ============

fn calculate_price(sol_reserve: u64, token_reserve: u64) -> u64 {
    let virtual_sol = sol_reserve.checked_add(VIRTUAL_SOL).unwrap_or(sol_reserve);
    // Returns price in lamports per token (scaled)
    virtual_sol.checked_mul(1_000_000_000).unwrap_or(0)
        .checked_div(token_reserve).unwrap_or(0)
}
```

### Frontend Integration (JavaScript/TypeScript)

```typescript
// fizz-fun-client.ts
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

const FIZZ_FUN_PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID');
const CAPS_MINT = new PublicKey('YOUR_CAPS_MINT');
const VIRTUAL_SOL = 30_000_000_000; // 30 SOL in lamports

export class FizzFunClient {
    private program: Program;
    private connection: Connection;
    
    constructor(provider: AnchorProvider) {
        this.program = new Program(IDL, FIZZ_FUN_PROGRAM_ID, provider);
        this.connection = provider.connection;
    }

    /**
     * Create a new token on Fizz.fun
     */
    async createToken(
        creator: PublicKey,
        name: string,
        symbol: string,
        uri: string
    ): Promise<string> {
        // Check CAPS balance first
        const capsAta = await getAssociatedTokenAddress(CAPS_MINT, creator);
        const capsBalance = await this.connection.getTokenAccountBalance(capsAta);
        
        if (parseInt(capsBalance.value.amount) < 1000_000_000_000) {
            throw new Error('Insufficient CAPS. Need at least 1000 CAPS to launch.');
        }

        const tokenMint = Keypair.generate();
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding_curve'), tokenMint.publicKey.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );

        const tx = await this.program.methods
            .createToken(name, symbol, uri)
            .accounts({
                creator,
                tokenMint: tokenMint.publicKey,
                bondingCurve,
                // ... other accounts
            })
            .signers([tokenMint])
            .rpc();

        return tx;
    }

    /**
     * Buy tokens from bonding curve
     */
    async buyTokens(
        buyer: PublicKey,
        tokenMint: PublicKey,
        solAmount: number,
        slippageBps: number = 100 // 1% default slippage
    ): Promise<string> {
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );

        // Fetch current curve state
        const curveData = await this.program.account.bondingCurve.fetch(bondingCurve);
        
        // Calculate expected tokens
        const expectedTokens = this.calculateBuyReturn(
            solAmount * 1e9,
            curveData.solReserve.toNumber(),
            curveData.tokenReserve.toNumber()
        );

        // Apply slippage tolerance
        const minTokens = expectedTokens * (10000 - slippageBps) / 10000;

        const tx = await this.program.methods
            .buy(new BN(solAmount * 1e9), new BN(minTokens))
            .accounts({
                buyer,
                bondingCurve,
                tokenMint,
                // ... other accounts
            })
            .rpc();

        return tx;
    }

    /**
     * Sell tokens back to bonding curve
     */
    async sellTokens(
        seller: PublicKey,
        tokenMint: PublicKey,
        tokenAmount: number,
        slippageBps: number = 100
    ): Promise<string> {
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );

        const curveData = await this.program.account.bondingCurve.fetch(bondingCurve);
        
        const expectedSol = this.calculateSellReturn(
            tokenAmount * 1e9,
            curveData.solReserve.toNumber(),
            curveData.tokenReserve.toNumber()
        );

        const minSol = expectedSol * (10000 - slippageBps) / 10000;

        const tx = await this.program.methods
            .sell(new BN(tokenAmount * 1e9), new BN(minSol))
            .accounts({
                seller,
                bondingCurve,
                tokenMint,
                // ... other accounts
            })
            .rpc();

        return tx;
    }

    /**
     * Calculate tokens received for SOL input (constant product AMM)
     */
    calculateBuyReturn(solAmount: number, solReserve: number, tokenReserve: number): number {
        const virtualSol = solReserve + VIRTUAL_SOL;
        const fee = solAmount * 0.01; // 1% fee
        const solAfterFee = solAmount - fee;
        
        const k = virtualSol * tokenReserve;
        const newSol = virtualSol + solAfterFee;
        const newTokens = k / newSol;
        
        return Math.floor(tokenReserve - newTokens);
    }

    /**
     * Calculate SOL received for token input
     */
    calculateSellReturn(tokenAmount: number, solReserve: number, tokenReserve: number): number {
        const virtualSol = solReserve + VIRTUAL_SOL;
        const k = virtualSol * tokenReserve;
        const newTokens = tokenReserve + tokenAmount;
        const newSol = k / newTokens;
        
        const solOutGross = virtualSol - newSol;
        const solOut = Math.min(solOutGross, solReserve);
        const fee = solOut * 0.01; // 1% fee
        
        return Math.floor(solOut - fee);
    }

    /**
     * Get current token price in SOL
     */
    async getPrice(tokenMint: PublicKey): Promise<number> {
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );

        const curveData = await this.program.account.bondingCurve.fetch(bondingCurve);
        const virtualSol = curveData.solReserve.toNumber() + VIRTUAL_SOL;
        
        return virtualSol / curveData.tokenReserve.toNumber();
    }

    /**
     * Get market cap in SOL
     */
    async getMarketCap(tokenMint: PublicKey): Promise<number> {
        const price = await this.getPrice(tokenMint);
        const totalSupply = 1_000_000_000; // 1B tokens
        return price * totalSupply / 1e9; // Convert to SOL
    }

    /**
     * Check if token is ready to graduate
     */
    async isReadyToGraduate(tokenMint: PublicKey): Promise<boolean> {
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );

        const curveData = await this.program.account.bondingCurve.fetch(bondingCurve);
        return curveData.solReserve.toNumber() >= 85_000_000_000; // 85 SOL
    }

    /**
     * Get all tokens created by a wallet
     */
    async getTokensByCreator(creator: PublicKey): Promise<any[]> {
        const accounts = await this.program.account.bondingCurve.all([
            { memcmp: { offset: 8, bytes: creator.toBase58() } }
        ]);
        return accounts;
    }

    /**
     * Get trending tokens (by volume or market cap)
     */
    async getTrendingTokens(limit: number = 10): Promise<any[]> {
        const allCurves = await this.program.account.bondingCurve.all();
        
        // Sort by SOL raised (proxy for popularity)
        const sorted = allCurves.sort((a, b) => 
            b.account.solReserve.toNumber() - a.account.solReserve.toNumber()
        );
        
        return sorted.slice(0, limit);
    }
}
```

### Wallet Integration Example

```typescript
// In your custom wallet's Fizz.fun tab
import { FizzFunClient } from './fizz-fun-client';

export function FizzFunTab({ wallet, connection }) {
    const [client, setClient] = useState<FizzFunClient | null>(null);
    const [trending, setTrending] = useState([]);
    const [capsBalance, setCapsBalance] = useState(0);

    useEffect(() => {
        const provider = new AnchorProvider(connection, wallet, {});
        setClient(new FizzFunClient(provider));
        loadTrending();
        loadCapsBalance();
    }, [wallet]);

    async function loadTrending() {
        const tokens = await client.getTrendingTokens(20);
        setTrending(tokens);
    }

    async function loadCapsBalance() {
        const balance = await getCapsBalance(wallet.publicKey);
        setCapsBalance(balance);
    }

    async function handleLaunch(name: string, symbol: string, uri: string) {
        if (capsBalance < 1000) {
            alert('Need at least 1000 CAPS to launch a token!');
            return;
        }

        try {
            const tx = await client.createToken(wallet.publicKey, name, symbol, uri);
            alert(`Token launched! TX: ${tx}`);
            loadCapsBalance(); // Refresh after burning CAPS
        } catch (e) {
            alert(`Launch failed: ${e.message}`);
        }
    }

    async function handleBuy(tokenMint: PublicKey, solAmount: number) {
        if (capsBalance < 100) {
            alert('Need at least 100 CAPS to trade on Fizz.fun!');
            return;
        }

        try {
            const tx = await client.buyTokens(wallet.publicKey, tokenMint, solAmount);
            alert(`Bought tokens! TX: ${tx}`);
        } catch (e) {
            alert(`Buy failed: ${e.message}`);
        }
    }

    async function handleSell(tokenMint: PublicKey, tokenAmount: number) {
        try {
            const tx = await client.sellTokens(wallet.publicKey, tokenMint, tokenAmount);
            alert(`Sold tokens! TX: ${tx}`);
        } catch (e) {
            alert(`Sell failed: ${e.message}`);
        }
    }

    return (
        <div className="fizz-fun-container">
            <header>
                <h1>🧪 Fizz.fun</h1>
                <p>CAPS Balance: {capsBalance.toLocaleString()} CAPS</p>
            </header>

            {capsBalance >= 1000 && (
                <LaunchTokenForm onLaunch={handleLaunch} />
            )}

            <TrendingTokens 
                tokens={trending} 
                onBuy={handleBuy}
                onSell={handleSell}
                capsBalance={capsBalance}
            />
        </div>
    );
}
```

### Revenue Model

| Fee Type | Amount | Destination |
|----------|--------|-------------|
| Launch fee | 100 CAPS (burned) | Deflationary |
| Trade fee | 1% of SOL | 0.5% treasury, 0.5% creator |
| Graduation fee | 0.5 SOL | Treasury |

**Projected Revenue (Conservative):**
```
Assuming 50 token launches per day:
- Launch fees: 50 × 100 CAPS = 5,000 CAPS burned/day
- Trade fees (avg 10 SOL/token/day): 50 × 10 × 1% = 5 SOL/day
- Graduation fees (10% graduate): 5 × 0.5 = 2.5 SOL/day

Monthly: 150,000 CAPS burned + 225 SOL revenue
```

### Marketing Synergies

#### 1. **Cross-Promotion with Game**
```
┌─────────────────────────────────────────────────────────────┐
│  NEW TOKEN ALERT IN VAULT 77!                              │
│                                                             │
│  🔥 $RADROACH just launched on Fizz.fun!                   │
│                                                             │
│  Creator @WastelandTrader77 is offering:                   │
│  • 1000 $RADROACH airdrop to first 100 claimers           │
│  • Special "Radroach Pet" NFT for top 10 holders          │
│                                                             │
│  [View on Fizz.fun]  [Claim Airdrop]                       │
└─────────────────────────────────────────────────────────────┘
```

#### 2. **In-Game Token Integration**
Launched tokens can optionally integrate with the game:
- Token holders get cosmetic items
- Tokens can be used in mini-games
- Special faction tokens for faction staking

#### 3. **Viral Loop**
```
User discovers Fizz.fun → Needs CAPS to participate → 
Buys CAPS → Discovers the game → Plays game → 
Earns more CAPS → Launches own token → 
Promotes token → Brings friends → They need CAPS → ...
```

### Implementation Phases

| Phase | Features | Timeline |
|-------|----------|----------|
| 1 - MVP | Basic launch, buy, sell with CAPS gating | 2-3 weeks |
| 2 - Polish | UI, trending page, creator profiles | 1-2 weeks |
| 3 - Integration | Game cross-promotion, in-game alerts | 1-2 weeks |
| 4 - Advanced | Custom curves, token integration, governance | Ongoing |

### Security Considerations

| Risk | Mitigation |
|------|------------|
| Rug pulls | Bonding curve ensures liquidity; graduation locks LP |
| Bot manipulation | CAPS gating creates cost barrier; rate limiting |
| Spam tokens | Launch fee creates friction; reporting system |
| Contract exploits | Audit before mainnet; start with caps on TVL |

### Why This Works as Marketing

1. **Viral Mechanics**: Meme tokens spread naturally on social media
2. **CAPS Demand**: Everyone needs CAPS to participate
3. **Community**: Each token creates a micro-community
4. **Revenue**: Self-sustaining with fees
5. **Network Effect**: More tokens → more users → more tokens
6. **Game Integration**: Tokens can tie back to wasteland gameplay

### Comparison to Pump.fun

| Feature | Pump.fun | Fizz.fun |
|---------|----------|----------|
| Requirement | None | Hold CAPS |
| Theme | Generic | Wasteland/Atomic |
| Game integration | None | Full integration |
| Fees | SOL only | CAPS burn + SOL |
| Community | Separate | Shared with game |

---

## Conclusion

The Atomic Fizz Caps project already uses a solid foundation with Solana, Ed25519 signatures, and Metaplex NFTs. The most impactful additions would be:

1. **VRF for randomness** - Enhance trust in loot mechanics
2. **Cross-chain bridges** - Enable broader token utility
3. **Decentralized storage** - Ensure NFT metadata permanence
4. **Game-integrated staking** - Add economic depth without breaking gameplay
5. **Fizz.fun launchpad** - Major marketing driver with CAPS utility

These additions would align the project with current best practices in web3 gaming while maintaining compatibility with the existing Solana-based architecture.
