# 🔐 Quick Start: Admin Password Hashing

## For Developers

### Generate a Password Hash
```bash
cd backend
node scripts/generate-admin-hash.js
# Enter your password when prompted (input is hidden)
```

### Update Your .env File
```bash
# Old way (plain text - still works)
ADMIN_PASSWORD=myplainpassword

# New way (bcrypt hash - recommended)
ADMIN_PASSWORD=$2b$12$EJgP0GtgxS9dt0sFkHCRUOC6aO3svManhSbDQ41BGsX/UtfQPRa6m
```

### Login Still Uses Original Password
When logging in to the admin panel, use your **original password**, not the hash!

## Testing

### Run All Tests
```bash
cd backend
node scripts/test-password-hashing.js
```

Expected result: `6 passed, 0 failed`

### Test Login
1. Update your `.env` with a bcrypt hash
2. Restart the backend: `npm start`
3. Login with your **original password**
4. Check logs for "Admin session created"

## Migration Checklist

### Development Environment
- [ ] Run `npm install` in backend directory
- [ ] Generate hash: `node scripts/generate-admin-hash.js`
- [ ] Update `.env` file with the hash
- [ ] Restart backend server
- [ ] Test login with original password
- [ ] Verify in logs: "Admin session created"

### Production Environment
- [ ] Deploy code changes
- [ ] Generate hash for production password
- [ ] Update environment variables in hosting platform
- [ ] Restart backend service
- [ ] Test production login
- [ ] Monitor logs for any issues

## Troubleshooting

### "admin_login_failed" Error
- Check server logs for specific error message
- Verify bcrypt is installed: `npm list bcrypt`
- Ensure you're using the original password, not the hash

### Hash Generator Doesn't Work
- Verify Node.js version: `node --version` (needs 18+)
- Reinstall dependencies: `cd backend && npm install`
- Try: `npm rebuild bcrypt`

### Login Works with Plain Text but Not Hash
- Verify the hash starts with `$2a$`, `$2b$`, or `$2y$`
- Check for extra spaces in `.env` file
- Ensure password matches the one used to generate the hash

## Security Reminders

✅ **DO**:
- Use bcrypt hashes in production
- Keep `.env` files out of version control
- Use different passwords per environment
- Store production passwords in secret managers

❌ **DON'T**:
- Commit passwords or hashes to git
- Share passwords via insecure channels
- Use the same password across environments

## More Information

See `backend/docs/ADMIN_PASSWORD_HASHING.md` for complete documentation.

---

📟 **Vault-Tec Tip**: Run tests after any changes to verify everything works!

☢️ Stay safe out there, Vault Dweller.
