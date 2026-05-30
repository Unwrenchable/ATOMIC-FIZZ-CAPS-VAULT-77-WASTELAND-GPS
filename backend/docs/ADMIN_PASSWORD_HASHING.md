# ☢️ Admin Password Hashing - Security Documentation

## Overview

The Atomic Fizz Caps admin authentication system now supports secure password hashing using bcrypt. This provides protection against:

- **Rainbow table attacks**: Pre-computed hash tables can't be used
- **Brute force attacks**: Bcrypt is computationally expensive (12 rounds)
- **Timing attacks**: Constant-time comparison for usernames and passwords

## Features

### 1. Backward Compatibility
- **Plain text passwords** (legacy): Still supported for existing deployments
- **Bcrypt hashed passwords** (recommended): Automatically detected and used

The system automatically detects whether `ADMIN_PASSWORD` is a bcrypt hash or plain text:
- Bcrypt hashes start with `$2a$`, `$2b$`, or `$2y$`
- Plain text passwords are compared using constant-time SHA-256 comparison

### 2. Secure Password Hashing
- Uses **bcrypt** with 12 rounds (industry standard)
- Each hash includes a unique salt
- Computationally expensive to prevent brute force attacks
- Safe to store in environment variables

### 3. Utility Scripts
- **generate-admin-hash.js**: Generate bcrypt hashes for admin passwords
- **test-password-hashing.js**: Verify the hashing implementation works correctly

## Usage

### Generating a Hashed Password

#### Method 1: Interactive (Recommended - No shell history)
```bash
cd backend
node scripts/generate-admin-hash.js
# Enter password when prompted (input is hidden)
```

#### Method 2: Command Line Argument
```bash
cd backend
node scripts/generate-admin-hash.js "YourSecurePassword123!"
```

**⚠️ WARNING:** Using command line arguments may expose the password in shell history!

### Example Output
```
📟 VAULT-TEC SECURITY PROTOCOL 77-A
=====================================
✅ Password hash generated successfully!

🔐 Bcrypt Hash:
$2b$12$T6RCKxqHb8TjTdz/LbNm5.nXyM3Ak4Kjd/6voDex0FLqenHxgeA6O

📝 Add this to your .env file:
ADMIN_PASSWORD=$2b$12$T6RCKxqHb8TjTdz/LbNm5.nXyM3Ak4Kjd/6voDex0FLqenHxgeA6O
```

### Setting Up Admin Credentials

1. Generate a bcrypt hash using the utility script
2. Add to your `.env` file:
   ```bash
   ADMIN_USERNAME=your-admin-username
   ADMIN_PASSWORD=$2b$12$T6RCKxqHb8TjTdz/LbNm5.nXyM3Ak4Kjd/6voDex0FLqenHxgeA6O
   ```
3. Restart your backend server
4. Test login with your original password (not the hash)

## Migration Guide

### From Plain Text to Hashed Passwords

If you're currently using plain text passwords in production:

1. **Generate a new hash** for your existing password:
   ```bash
   node scripts/generate-admin-hash.js
   ```

2. **Update your environment**:
   - Development: Update `.env` file
   - Production: Update environment variables in your hosting platform

3. **Deploy the changes**:
   - Deploy the updated code
   - Update the `ADMIN_PASSWORD` environment variable
   - Restart the backend server

4. **Verify login** works with the original password

### No Downtime Migration

The system supports both plain text and hashed passwords simultaneously:

1. Deploy the code update first (still using plain text)
2. Test that login still works
3. Generate bcrypt hash for your password
4. Update `ADMIN_PASSWORD` environment variable
5. Test that login still works

## Security Best Practices

### ✅ DO:
- Use bcrypt hashed passwords in production
- Generate strong passwords (12+ characters, mixed case, numbers, symbols)
- Use different passwords for each environment
- Store production passwords in secure secret managers (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate passwords periodically
- Keep `.env` files out of version control (already in `.gitignore`)

### ❌ DON'T:
- Commit passwords or hashes to version control
- Share passwords via insecure channels (email, Slack, etc.)
- Use the same password across environments
- Store passwords in plain text in production

## Testing

Run the test suite to verify password hashing works correctly:

```bash
cd backend
node scripts/test-password-hashing.js
```

Expected output:
```
📟 VAULT-TEC SECURITY TEST PROTOCOL
====================================

Test 1: Plain text password verification
✅ PASS: Plain text passwords work

Test 2: Plain text wrong password
✅ PASS: Plain text correctly rejects wrong password

Test 3: Bcrypt hash generation and verification
✅ PASS: Bcrypt hash verification works

Test 4: Bcrypt hash wrong password
✅ PASS: Bcrypt correctly rejects wrong password

Test 5: Empty password handling
✅ PASS: Empty password correctly rejected

Test 6: Bcrypt hash detection
✅ PASS: Bcrypt hash detection works correctly

====================================
Test Results: 6 passed, 0 failed

🎉 ALL TESTS PASSED!
```

## Technical Details

### Implementation

The password verification logic in `backend/middleware/adminAuth.js`:

```javascript
async function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) {
    return false;
  }

  // If stored password is a bcrypt hash, use bcrypt.compare
  if (isBcryptHash(storedPassword)) {
    return await bcrypt.compare(inputPassword, storedPassword);
  }

  // Fall back to constant-time comparison for plain text
  return safeCompare(inputPassword, storedPassword);
}
```

### Hash Detection

Bcrypt hashes are detected by their prefix:
- `$2a$` - Original bcrypt
- `$2b$` - Fixed bcrypt (recommended)
- `$2y$` - PHP bcrypt variant

### Performance

Bcrypt with 12 rounds takes approximately 200-300ms per hash:
- Slow enough to prevent brute force attacks
- Fast enough for normal authentication
- Combined with rate limiting (5 attempts per 15 minutes) for additional protection

## Additional Security Layers

The admin authentication system includes multiple security measures:

1. **Bcrypt password hashing** (this implementation)
2. **Constant-time username comparison** (prevents timing attacks)
3. **Rate limiting**: 5 login attempts per 15 minutes
4. **Session-based authentication** with Redis
5. **Session TTL**: Default 24 hours (configurable)
6. **Bearer token authentication** for API requests

## Troubleshooting

### Login fails after updating to hashed password

1. Verify the hash was generated correctly:
   ```bash
   node scripts/generate-admin-hash.js "YourPassword"
   ```

2. Check the environment variable is set correctly:
   ```bash
   echo $ADMIN_PASSWORD
   ```

3. Ensure you're using the **original password**, not the hash when logging in

4. Check server logs for specific error messages

### Hash generation fails

1. Ensure bcrypt is installed:
   ```bash
   npm install
   ```

2. Check Node.js version (requires Node 18+):
   ```bash
   node --version
   ```

3. Try rebuilding bcrypt native bindings:
   ```bash
   npm rebuild bcrypt
   ```

## Resources

- [bcrypt on npm](https://www.npmjs.com/package/bcrypt)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Bcrypt explained](https://auth0.com/blog/hashing-in-action-understanding-bcrypt/)

---

**📟 VAULT-TEC SECURITY REMINDER:**
> "Security is everyone's responsibility in the wasteland. Keep your passwords secure, Vault Dweller!"

☢️ Stay safe out there.
