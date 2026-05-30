#!/usr/bin/env node
/**
 * ☢️ VAULT-TEC ADMIN PASSWORD HASH GENERATOR
 * 
 * Generate a secure bcrypt hash for an admin password.
 * 
 * Usage:
 *   node scripts/generate-admin-hash.js <password>
 *   node scripts/generate-admin-hash.js
 * 
 * If no password is provided, you'll be prompted to enter one securely.
 * 
 * The generated hash can be set as ADMIN_PASSWORD in your .env file.
 * 
 * Security Note: Uses bcrypt with 12 rounds (2^12 iterations) for strong protection
 * against brute-force attacks while maintaining reasonable performance.
 */

const bcrypt = require('bcrypt');
const readline = require('readline');

const SALT_ROUNDS = 12; // Industry standard for strong security

async function generateHash(password) {
  if (!password || password.length < 8) {
    console.error('❌ ERROR: Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    console.log('\n📟 VAULT-TEC SECURITY PROTOCOL 77-A');
    console.log('=====================================');
    console.log('✅ Password hash generated successfully!\n');
    console.log('🔐 Bcrypt Hash:');
    console.log(hash);
    console.log('\n📝 Add this to your .env file:');
    console.log(`ADMIN_PASSWORD=${hash}`);
    console.log('\n⚠️  SECURITY REMINDER:');
    console.log('   - Never commit this hash to version control');
    console.log('   - Keep your .env file secure');
    console.log('   - Use different passwords for each environment');
    console.log('   - Store production passwords in secure secret managers');
    console.log('\n☢️ Stay safe out there, Vault Dweller.\n');
  } catch (err) {
    console.error('❌ Error generating hash:', err.message);
    process.exit(1);
  }
}

async function promptPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Disable echo for password input
  const stdin = process.stdin;
  const setRawMode = stdin.setRawMode ? stdin.setRawMode.bind(stdin) : () => {};
  
  return new Promise((resolve) => {
    process.stdout.write('Enter admin password: ');
    
    let password = '';
    setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    stdin.on('data', (char) => {
      char = char.toString('utf8');
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit(0);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function main() {
  console.log('📟 VAULT-TEC ADMIN PASSWORD HASH GENERATOR');
  console.log('==========================================\n');

  let password;
  
  if (process.argv[2]) {
    // Password provided as command line argument
    password = process.argv[2];
    console.warn('⚠️  WARNING: Password provided via command line');
    console.warn('   This may be visible in shell history!\n');
  } else {
    // Prompt for password securely
    password = await promptPassword();
  }

  await generateHash(password);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
