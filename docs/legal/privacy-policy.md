# Atomic Fizz Caps — Privacy Policy

**Effective Date: 2025-07-01**  
**Service**: Atomic Fizz Caps (atomicfizzcaps.xyz)  
**Operator**: [Your Legal Entity Name] ("we", "us", "our")

---

## 1. Introduction

This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data when you play Atomic Fizz Caps.

**We collect the minimum data necessary to operate the Game.** We do not sell your data to third parties.

---

## 2. Data We Collect

### 2.1 Wallet Address (Required)

Your Solana public wallet address is collected when you authenticate. This is necessary to:

- Identify your game account
- Record your caps, XP, inventory, and quest progress
- Issue FIZZ token rewards
- Mint NFTs to your wallet

Your wallet address is a public blockchain identifier — it is not considered private. However, we treat it with care and do not correlate it with your real-world identity.

**Retention**: Wallet data persists until you request deletion (see Section 6).

### 2.2 GPS / Location Data (Required for Gameplay)

When you claim a GPS point-of-interest, we receive and process your latitude and longitude coordinates to:

- Verify you are within range of the claimed POI (within 50 meters by default)
- Detect GPS spoofing (impossible travel speed detection)
- Enforce per-location cooldown timers

**What we store in Redis:**

- Your last known GPS position (`lat`, `lng`, `timestamp`) — used for speed-of-travel checks
- TTL: **1 hour** — this data is automatically deleted after 60 minutes
- We do NOT build location history or movement profiles
- We do NOT share GPS data with third parties

**What we do NOT store:**

- Movement history or routes
- Timestamps of all GPS readings (only the last one, auto-expiring)
- Precise location logs correlated with your identity

### 2.3 Game State Data

We store in Redis (with automatic TTL where applicable):

- Player profile: wallet, display name (default: "WANDERER"), XP, caps, level, inventory, quest progress
- Claimed POI list (which locations you've visited)
- NFT ownership records (also verifiable on-chain)
- Cooldown timers (auto-expire per their duration)

**Retention**: Game state data is retained indefinitely while your account is active.

### 2.4 Request Logs

Our servers generate structured JSON request logs containing:

- Request ID (random, per-request)
- HTTP method and path
- Response status code
- Response latency (milliseconds)
- **Truncated wallet hash** (first 8 hex characters of SHA-256 of your wallet address — this cannot be reversed to identify you)
- Truncated User-Agent string (first 80 characters)
- IP address (used for rate limiting)

**Retention**: Request logs are retained for up to 7 days on Render's log system, then automatically deleted.

We do NOT log your full wallet address in request logs. The wallet hash is used solely to correlate log events for debugging purposes.

### 2.5 Data We Do NOT Collect

- Real name, email address, or any other personally identifying information
- Payment information (blockchain transactions are peer-to-peer)
- Device identifiers beyond User-Agent
- Cross-site tracking data

---

## 3. How We Use Your Data

| Data | Purpose | Legal Basis |
|------|---------|-------------|
| Wallet address | Game account, token rewards, NFT minting | Contract performance |
| GPS coordinates | POI validation, spoofing detection | Contract performance |
| Last GPS position | Speed-of-travel anti-cheat | Legitimate interest (game integrity) |
| Game state | Game progress persistence | Contract performance |
| Request logs | Security monitoring, debugging | Legitimate interest |

---

## 4. Data Sharing

We do not sell, rent, or broker your personal data.

We may share data with:

- **Render** (hosting provider) — server logs and Redis database are stored on Render infrastructure
- **Vercel** (CDN) — static frontend served; Vercel may log request metadata
- **Solana network** — your wallet address and transaction data are public on the Solana blockchain by design
- **Law enforcement** — if required by valid legal process

---

## 5. Solana Blockchain

Be aware that all Solana transactions — including NFT mints, FIZZ token transfers, and on-chain game actions — are **permanently and publicly recorded on the Solana blockchain**. We cannot delete on-chain data.

Your wallet address and transaction history are visible to anyone with a blockchain explorer.

---

## 6. Your Rights

### Right to Access
You may request a copy of the game state data associated with your wallet by contacting us at privacy@atomicfizzcaps.xyz.

### Right to Deletion (GDPR / CCPA)

You have the right to request deletion of your off-chain game data. To exercise this right:

1. Send an email to privacy@atomicfizzcaps.xyz with the subject line: "Data Deletion Request"
2. Include your Solana wallet address
3. We will process your request within 30 days (GDPR) or 45 days (CCPA)

**What can be deleted:**
- Your game profile (caps, XP, inventory, quests)
- GPS last-position data
- Session tokens and nonces
- All `afw:player:<wallet>:*` Redis keys

**What cannot be deleted:**
- On-chain Solana transactions (by the nature of blockchain technology)
- Anonymized aggregated statistics (if no wallet address is retained)

### Right to Portability (GDPR)
You may request a JSON export of your game profile data by contacting us.

### California Residents (CCPA)
California residents have the right to know what personal information we collect, the right to delete personal information, and the right to opt out of sale (we do not sell personal information).

---

## 7. Data Security

We protect your data using:

- Cryptographic wallet signature authentication (no passwords stored)
- Redis key namespacing with `afw:` prefix isolation
- Automatic TTL expiration on sensitive keys (nonces, sessions, GPS positions)
- HTTPS/TLS in transit
- Timing-safe comparison for all secret values
- GPS data automatically purged after 1 hour

Despite these measures, no system is completely secure. We will notify affected users of any data breach affecting personal data as required by applicable law.

---

## 8. Children

The Game is not directed at children under 13 (US) or 16 (EU). We do not knowingly collect data from minors. If you believe a minor has used the Game, contact us at privacy@atomicfizzcaps.xyz.

---

## 9. Changes to This Policy

We will post updated versions of this policy on atomicfizzcaps.xyz. Continued use of the Game after changes constitutes acceptance.

---

## 10. Contact

Privacy inquiries: privacy@atomicfizzcaps.xyz

---

*This is a template document. Before mainnet launch, have it reviewed by a qualified attorney familiar with GDPR, CCPA, and applicable data protection law in your jurisdiction.*
