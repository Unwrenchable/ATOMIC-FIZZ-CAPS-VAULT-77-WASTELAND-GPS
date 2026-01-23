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

## Conclusion

The Atomic Fizz Caps project already uses a solid foundation with Solana, Ed25519 signatures, and Metaplex NFTs. The most impactful additions would be:

1. **VRF for randomness** - Enhance trust in loot mechanics
2. **Cross-chain bridges** - Enable broader token utility
3. **Decentralized storage** - Ensure NFT metadata permanence

These additions would align the project with current best practices in web3 gaming while maintaining compatibility with the existing Solana-based architecture.
