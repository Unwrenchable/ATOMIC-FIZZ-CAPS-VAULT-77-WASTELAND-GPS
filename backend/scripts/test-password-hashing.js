#!/usr/bin/env node
/**
 * ☢️ VAULT-TEC PASSWORD VERIFICATION TEST
 * 
 * Test script to verify the adminAuth password hashing works correctly
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Copy the functions from adminAuth.js for testing
function safeCompare(a, b) {
  const hash1 = crypto.createHash('sha256').update(String(a || "")).digest();
  const hash2 = crypto.createHash('sha256').update(String(b || "")).digest();
  return crypto.timingSafeEqual(hash1, hash2);
}

function isBcryptHash(str) {
  return /^\$2[aby]\$/.test(str);
}

async function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    try {
      return await bcrypt.compare(inputPassword, storedPassword);
    } catch (err) {
      console.error("[TEST] bcrypt comparison error:", err);
      return false;
    }
  }

  return safeCompare(inputPassword, storedPassword);
}

async function runTests() {
  console.log('📟 VAULT-TEC SECURITY TEST PROTOCOL');
  console.log('====================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Plain text password (backward compatibility)
  console.log('Test 1: Plain text password verification');
  const plainResult = await verifyPassword('test123', 'test123');
  if (plainResult) {
    console.log('✅ PASS: Plain text passwords work\n');
    passed++;
  } else {
    console.log('❌ FAIL: Plain text password verification failed\n');
    failed++;
  }

  // Test 2: Plain text wrong password
  console.log('Test 2: Plain text wrong password');
  const plainWrongResult = await verifyPassword('wrong', 'test123');
  if (!plainWrongResult) {
    console.log('✅ PASS: Plain text correctly rejects wrong password\n');
    passed++;
  } else {
    console.log('❌ FAIL: Plain text accepted wrong password\n');
    failed++;
  }

  // Test 3: Bcrypt hash - generate and verify
  console.log('Test 3: Bcrypt hash generation and verification');
  const testPassword = 'VaultTec77!';
  const hash = await bcrypt.hash(testPassword, 12);
  console.log(`   Generated hash: ${hash.substring(0, 30)}...`);
  const bcryptResult = await verifyPassword(testPassword, hash);
  if (bcryptResult) {
    console.log('✅ PASS: Bcrypt hash verification works\n');
    passed++;
  } else {
    console.log('❌ FAIL: Bcrypt hash verification failed\n');
    failed++;
  }

  // Test 4: Bcrypt hash - wrong password
  console.log('Test 4: Bcrypt hash wrong password');
  const bcryptWrongResult = await verifyPassword('WrongPassword', hash);
  if (!bcryptWrongResult) {
    console.log('✅ PASS: Bcrypt correctly rejects wrong password\n');
    passed++;
  } else {
    console.log('❌ FAIL: Bcrypt accepted wrong password\n');
    failed++;
  }

  // Test 5: Empty password handling
  console.log('Test 5: Empty password handling');
  const emptyResult = await verifyPassword('', 'test123');
  if (!emptyResult) {
    console.log('✅ PASS: Empty password correctly rejected\n');
    passed++;
  } else {
    console.log('❌ FAIL: Empty password was accepted\n');
    failed++;
  }

  // Test 6: Test isBcryptHash detection
  console.log('Test 6: Bcrypt hash detection');
  const detectTests = [
    { input: '$2a$12$abc123', expected: true },
    { input: '$2b$12$abc123', expected: true },
    { input: '$2y$12$abc123', expected: true },
    { input: 'plaintext', expected: false },
    { input: '$1$notbcrypt', expected: false },
  ];
  
  let detectPassed = true;
  for (const test of detectTests) {
    const result = isBcryptHash(test.input);
    if (result !== test.expected) {
      console.log(`❌ Detection failed for '${test.input}' - expected ${test.expected}, got ${result}`);
      detectPassed = false;
    }
  }
  
  if (detectPassed) {
    console.log('✅ PASS: Bcrypt hash detection works correctly\n');
    passed++;
  } else {
    console.log('❌ FAIL: Bcrypt hash detection has errors\n');
    failed++;
  }

  // Summary
  console.log('====================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('☢️ Password hashing system is operational, Vault Dweller.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED!');
    console.log('☢️ Please investigate before deploying.\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
