# 🔐 Security Guide

This guide documents the security measures, protections, and best practices for the Atomic Fizz Caps application.

---

## Overview

The application implements multiple layers of security to protect game content, user data, and provide a fair gameplay experience.

---

## Security Layers

### 1. Client-Side Protection

| Protection | Purpose | Status |
|------------|---------|--------|
| DevTools Detection | Deter casual inspection | ✅ Active |
| Keyboard Shortcut Blocking | Block F12, Ctrl+Shift+I | ✅ Active |
| Code Obfuscation | Hide sensitive sequences | ✅ Implemented |
| Console Warnings | Deter tampering | ✅ Active |

### 2. Authentication

| Method | Description |
|--------|-------------|
| Wallet Signatures | Ed25519 signature verification |
| Session Tokens | Redis-based session management |
| Rate Limiting | Prevent API abuse |

### 3. Data Security

| Area | Protection |
|------|------------|
| API Endpoints | Rate limiting, CORS |
| Player Data | Server-side validation |
| Transactions | Blockchain verification |

---

## DevTools Guard

### What It Does

The DevTools Guard module detects and responds to browser inspection attempts.

### Protection Methods

1. **Keyboard Shortcut Blocking**
   - F12 (DevTools)
   - Ctrl+Shift+I (DevTools - Chrome)
   - Ctrl+Shift+J (Console)
   - Ctrl+Shift+C (Inspect Element)
   - Ctrl+U (View Source)
   - Mac equivalents (Cmd+Option+I, etc.)

2. **Window Size Detection**
   - Monitors outerWidth vs innerWidth difference
   - Detects DevTools dock state

3. **Console Warning**
   When DevTools is detected:
   ```
   ☢️ VAULT-TEC SECURITY ALERT ☢️
   ⚠️ UNAUTHORIZED ACCESS DETECTED
   This application is protected by Vault-Tec security protocols.
   ```

### Limitations

**Important**: Client-side protection is **deterrence, not security**.

Determined users can:
- Use browser extensions to bypass
- Disable JavaScript
- Use proxy tools
- View source directly

---

## Easter Eggs

### Konami Code

The classic Konami Code easter egg is implemented with protections:

- **Sequence**: Obfuscated (not plain text)
- **Function**: Opens donation portal
- **Protection**: Code uses numeric key codes
- **Note**: Does NOT provide gameplay advantages

### Protection Techniques

```javascript
// Obfuscated (actual implementation)
var _a = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
var _m = {};
_m[38] = 'ArrowUp';
// etc.
```

---

## Wallet Security

### Connection Flow

1. User clicks "Connect Wallet"
2. Phantom extension prompts approval
3. Public key shared with application
4. No private keys ever transmitted

### Signature Verification

All authenticated actions require wallet signatures:

```javascript
// Challenge signed by wallet
const message = new TextEncoder().encode(challenge);
const signature = await wallet.signMessage(message);
// Verified server-side
```

### Best Practices

- ❌ Never share your seed phrase
- ❌ Never sign unknown messages
- ✅ Verify transaction details before signing
- ✅ Use hardware wallets for large holdings

---

## API Security

### Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Public reads | 60/min |
| Authenticated actions | 30/min |
| Claims | 10/min |

### CORS Policy

Allowed origins:
- `https://www.atomicfizzcaps.xyz`
- `https://atomicfizzcaps.xyz`
- Vercel preview deployments (verified via header)
- `http://localhost:*` (development only)

### Request Validation

All inputs validated server-side:
- Location coordinates verified
- Claim cooldowns enforced
- Item ownership confirmed

---

## Audit Status

### Reviewed Areas

| Area | Status | Risk Level | Notes |
|------|--------|------------|-------|
| Client-Side Security | ✅ Reviewed | MEDIUM | Input validation, XSS prevention |
| Secret Protection | ✅ Implemented | LOW | Obfuscation for Easter eggs |
| DevTools Detection | ✅ Active | LOW | Deterrence only |
| Code Obfuscation | ✅ Applied | LOW | Key sequences hidden |
| Authentication | ✅ Secure | LOW | Ed25519 wallet signatures |
| Data Storage | ✅ Reviewed | MEDIUM | Redis for sessions, localStorage for client state |

### Compliance Checklist

- [x] Input validation implemented
- [x] XSS protection via CSP headers
- [x] Secure wallet connections
- [x] Rate limiting on API endpoints
- [x] Authentication tokens secured
- [x] CORS properly configured

---

## Quest & Story Protection

Game content (quests, narrative) has limited protection:

### Current State
- Quest data in JSON files
- Accessible via direct URL
- DevTools detection active

### Recommended Approach
- Accept that spoilers may be discovered
- Focus protection on gameplay-affecting data
- Keep truly sensitive logic server-side

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** post publicly
2. Contact the development team privately
3. Provide detailed reproduction steps
4. Allow reasonable time for a fix

---

## Best Practices for Developers

### What to Keep Server-Side
- API keys and secrets
- User authentication logic
- Economic calculations
- Anti-cheat detection
- Sensitive game logic

### What's Okay Client-Side
- UI code
- Presentation logic
- Non-critical game data
- Easter eggs (with deterrents)

---

## Configuration

### DevTools Guard Settings

```javascript
const CONFIG = {
  enabled: true,
  blockKeyboardShortcuts: true,
  detectDebugger: false,        // Performance impact
  detectResize: true,
  warnInConsole: true,
  redirectOnDetection: false    // Aggressive option
};
```

---

## Summary

Security in a web application is about layers:

1. **Deterrence**: Make casual inspection difficult
2. **Authentication**: Verify user identity
3. **Validation**: Trust nothing from the client
4. **Monitoring**: Log suspicious activity
5. **Response**: Have a plan for incidents

Remember: Perfect client-side security is impossible. Protect what matters on the server.

---

*"Security through obscurity is not security. But it can be a fun puzzle."* — Vault-Tec InfoSec Division
