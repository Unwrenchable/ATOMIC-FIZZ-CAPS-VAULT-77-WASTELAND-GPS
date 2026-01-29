# 📟 VAULT-TEC ENVIRONMENT VARIABLES REFERENCE

**☢️ ATOMIC FIZZ CAPS - Vault 77 Configuration Protocol ☢️**

This document provides a comprehensive alphabetical reference of all environment variables used in the Atomic Fizz Caps wasteland GPS crypto game.

---

## 📋 ALPHABETICAL REFERENCE

### ADMIN_PASSWORD_HASH
- **Type**: String
- **Required**: Yes (for admin functionality)
- **Description**: MD5 or SHA hash of the admin password for backend authentication
- **Example**: `5f4dcc3b5aa765d61d8327deb882cf99` (MD5 hash)
- **Security**: Use a strong cryptographic hash (SHA-256 recommended)

### ADMIN_SESSION_TTL_SECONDS
- **Type**: Integer
- **Required**: No
- **Default**: 86400 (24 hours)
- **Description**: Time-to-live for admin session tokens in seconds
- **Example**: `86400`

### ADMIN_USERNAME
- **Type**: String
- **Required**: Yes (for admin functionality)
- **Description**: Username for admin authentication
- **Example**: `admin`
- **Security**: Do not use default usernames in production

### ADMIN_WALLETS
- **Type**: String (comma-separated)
- **Required**: Yes (for admin functionality)
- **Description**: Comma-separated list of Solana wallet addresses with admin privileges
- **Example**: `wallet1PubKey...,wallet2PubKey...`

### AUDIT_S3_BUCKET
- **Type**: String
- **Required**: No (optional for logging)
- **Description**: AWS S3 bucket name for audit log storage
- **Example**: `your-audit-bucket`
- **Note**: Only needed if implementing AWS-based audit logging

### AWS_REGION
- **Type**: String
- **Required**: No (only if using AWS KMS)
- **Default**: `us-west-2`
- **Description**: AWS region for KMS signing operations
- **Example**: `us-west-2`

### CLIENT_ORIGIN
- **Type**: String
- **Required**: No
- **Default**: `http://localhost:3000`
- **Description**: Origin URL of the client application for CORS configuration
- **Example**: `https://www.atomicfizzcaps.xyz`

### COOLDOWN_PREFIX
- **Type**: String
- **Required**: No
- **Default**: `cooldown:`
- **Description**: Redis key prefix for cooldown tracking
- **Example**: `cooldown:`

### COOLDOWN_SECONDS
- **Type**: Integer
- **Required**: No
- **Default**: 60
- **Description**: Default cooldown duration in seconds for general actions
- **Example**: `60`

### COOLDOWNS_FAIL_SAFE
- **Type**: String (enum)
- **Required**: No
- **Default**: `deny`
- **Description**: Fail-safe behavior when cooldown checks fail (`allow` or `deny`)
- **Example**: `deny`
- **Options**: `allow`, `deny`

### FRONTEND_ORIGIN
- **Type**: String (comma-separated)
- **Required**: Yes
- **Description**: Allowed frontend origins for CORS. Supports wildcards.
- **Example**: `https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, https://*.vercel.app, https://*.onrender.com`

### GAME_VAULT_SECRET
- **Type**: String
- **Required**: Yes
- **Description**: Secret key for game vault cryptographic operations
- **Example**: Base58 encoded 64-byte secret
- **Security**: Use cryptographically secure random generation

### GPS_DISTANCE_LIMIT
- **Type**: Integer
- **Required**: No
- **Default**: 1000 (meters)
- **Description**: Maximum distance in meters a player can be from a location to claim it
- **Example**: `1000`

### GPS_SECRET
- **Type**: String
- **Required**: Yes
- **Description**: Secret key for GPS coordinate signing and verification
- **Example**: Base58 encoded secret
- **Security**: Use cryptographically secure random generation

### HELIUS_API_KEY
- **Type**: String
- **Required**: No (optional for enhanced NFT features)
- **Description**: Helius API key for advanced Solana NFT fetching capabilities
- **Example**: `your-helius-api-key`

### HF_API_KEY
- **Type**: String
- **Required**: Yes (for Overseer AI)
- **Description**: Hugging Face API key for AI personality features
- **Example**: `hf_xxxxxxxxxxxxxxxxxxxxx`

### HF_MODEL
- **Type**: String
- **Required**: No
- **Default**: `mistralai/Mixtral-8x7B-Instruct-v0.1`
- **Description**: Hugging Face model identifier for Overseer AI responses
- **Example**: `mistralai/Mixtral-8x7B-Instruct-v0.1`

### KMS_SIGNING_ALGORITHM
- **Type**: String
- **Required**: No (only if using AWS KMS)
- **Default**: `ECDSA_SHA_256`
- **Description**: AWS KMS signing algorithm
- **Example**: `ECDSA_SHA_256`

### KMS_SIGNING_KEY_ID
- **Type**: String
- **Required**: No (only if using AWS KMS)
- **Description**: AWS KMS key ARN for signing operations
- **Example**: `arn:aws:kms:us-west-2:123456789012:key/abcd-efgh`

### LOOT_COOLDOWN_SECONDS
- **Type**: Integer
- **Required**: No
- **Default**: 300 (5 minutes)
- **Description**: Cooldown duration in seconds between loot claims at the same location
- **Example**: `300`

### MODEL
- **Type**: String
- **Required**: No
- **Description**: Alias for HF_MODEL (alternative model specification)
- **Example**: `mistralai/Mixtral-8x7B-Instruct-v0.1`

### NEXT_PUBLIC_BACKEND_URL
- **Type**: String
- **Required**: Yes
- **Description**: Public-facing backend API URL (used by frontend)
- **Example**: `https://api.atomicfizzcaps.xyz`

### NODE_ENV
- **Type**: String (enum)
- **Required**: No
- **Default**: `development`
- **Description**: Node.js environment mode
- **Example**: `production`
- **Options**: `development`, `production`, `test`

### PORT
- **Type**: Integer
- **Required**: No
- **Default**: 3000
- **Description**: Port number for the backend server
- **Example**: `3000`

### REDIS_URL
- **Type**: String
- **Required**: Yes (in production)
- **Description**: Redis connection URL for state management and caching
- **Example**: `redis://default:password@localhost:6379`
- **Format**: `redis://[username]:[password]@[host]:[port]`

### REQUIRE_REDIS_IN_PRODUCTION
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Whether to require Redis connection in production mode
- **Example**: `true`

### SERVER_SECRET_KEY
- **Type**: String
- **Required**: Yes
- **Description**: Base58-encoded 64-byte secret key for server-side cryptographic operations
- **Example**: Base58 encoded 64-byte value
- **Security**: Generate using cryptographically secure random source

### SOLANA_RPC
- **Type**: String
- **Required**: Yes
- **Description**: Solana RPC endpoint URL
- **Example**: `https://api.devnet.solana.com` (devnet) or `https://api.mainnet-beta.solana.com` (mainnet)

### STRICT_REPLAY_PROTECTION
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Enable strict replay attack protection for signed messages
- **Example**: `true`

### TOKEN_MINT
- **Type**: String
- **Required**: Yes
- **Description**: Solana token mint address for FIZZ tokens
- **Example**: `FizzTokenMintPublicKey...`

### VOUCHER_KEY
- **Type**: String
- **Required**: Yes
- **Description**: Key identifier for voucher signing operations
- **Example**: `v1`

### VOUCHER_SECRET
- **Type**: String
- **Required**: Yes
- **Description**: Secret key for voucher generation and validation
- **Example**: Base58 encoded secret
- **Security**: Use cryptographically secure random generation

### VOUCHER_TTL_SECONDS
- **Type**: Integer
- **Required**: No
- **Default**: 3600 (1 hour)
- **Description**: Time-to-live for vouchers in seconds
- **Example**: `3600`

### XP_KEY
- **Type**: String
- **Required**: Yes
- **Description**: Key identifier for XP calculation operations
- **Example**: `xp_v1`

### XP_RATE
- **Type**: Number
- **Required**: No
- **Default**: 1.0
- **Description**: Experience point multiplier rate
- **Example**: `1.5`

### XP_SECRET
- **Type**: String
- **Required**: Yes
- **Description**: Secret key for XP signing and verification
- **Example**: Base58 encoded secret
- **Security**: Use cryptographically secure random generation

---

## 🔐 SECURITY BEST PRACTICES

Per Vault-Tec Protocol 77-S (Security):

1. **Never commit real secrets** to version control
2. **Use strong random generation** for all secret keys (crypto.getRandomValues())
3. **Rotate secrets regularly** in production environments
4. **Use environment-specific values** (different secrets for dev/staging/production)
5. **Enable STRICT_REPLAY_PROTECTION** in production
6. **Hash admin passwords** with SHA-256 or stronger
7. **Limit ADMIN_WALLETS** to only necessary addresses
8. **Use KMS** for production signing operations when possible

---

## 📝 QUICK SETUP CHECKLIST

For the good of the Vault, ensure you have configured:

- [x] **REDIS_URL** - Required for player state
- [x] **SERVER_SECRET_KEY** - 64-byte Base58 secret
- [x] **SOLANA_RPC** - Your Solana network endpoint
- [x] **TOKEN_MINT** - Your FIZZ token address
- [x] **NEXT_PUBLIC_BACKEND_URL** - Your API domain
- [x] **FRONTEND_ORIGIN** - Your frontend domain(s)
- [x] **GPS_SECRET** - GPS signing secret
- [x] **VOUCHER_SECRET** - Voucher signing secret
- [x] **XP_SECRET** - XP signing secret
- [x] **GAME_VAULT_SECRET** - Game vault secret
- [x] **HF_API_KEY** - Hugging Face API key (for AI)
- [x] **ADMIN_USERNAME** - Admin username
- [x] **ADMIN_PASSWORD_HASH** - Hashed admin password
- [x] **ADMIN_WALLETS** - Admin wallet addresses

---

## 📚 RELATED DOCUMENTATION

- [Deployment Guide](DEPLOYMENT.md)
- [Backend .env.example](backend/.env.example)
- [Root .env.example](.env.example)
- [Testing Guide](TESTING_GUIDE.md)

---

**📟 OVERSEER MESSAGE:**

> "All environment variables have been cataloged and secured per Vault-Tec regulations.
> Remember: A well-configured Vault is a safe Vault.
> 
> Stay safe out there, Vault Dweller. ☢️"

---

*Document Version: 1.0*  
*Last Updated: 2026-01-29*  
*Classification: VAULT-TEC CONFIDENTIAL*
