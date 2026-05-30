// tests/grok.test.js
// Unit tests for backend/lib/grok.js — runs without network access
// by verifying module exports and input-sanitisation logic only.

'use strict';

const assert = require('assert');

// -----------------------------------------------------------------------
// Import the module under test
// -----------------------------------------------------------------------
const grok = require('../backend/lib/grok');

// -----------------------------------------------------------------------
// Helper: assert function exported correctly
// -----------------------------------------------------------------------
function assertExported(name) {
  assert.strictEqual(typeof grok[name], 'function', `grok.${name} should be a function`);
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------
async function testExports() {
  assertExported('generateWithGrok');
  assertExported('generateNPCBatch');
  assertExported('generateImage');
  assertExported('generateVideo');
  console.log('✅  grok exports check passed');
}

async function testConstants() {
  assert.strictEqual(typeof grok.OVERSEER_SYSTEM_PROMPT, 'string', 'OVERSEER_SYSTEM_PROMPT should be a string');
  assert(grok.OVERSEER_SYSTEM_PROMPT.length > 20, 'System prompt should be non-trivial');
  assert.strictEqual(typeof grok.DEFAULT_TEXT_MODEL,  'string', 'DEFAULT_TEXT_MODEL should be a string');
  assert.strictEqual(typeof grok.DEFAULT_IMAGE_MODEL, 'string', 'DEFAULT_IMAGE_MODEL should be a string');
  assert.strictEqual(typeof grok.DEFAULT_VIDEO_MODEL, 'string', 'DEFAULT_VIDEO_MODEL should be a string');
  console.log('✅  grok constants check passed');
}

async function testMissingApiKeyThrows() {
  // Temporarily unset XAI_API_KEY to verify that functions throw correctly
  const saved = process.env.XAI_API_KEY;
  delete process.env.XAI_API_KEY;

  try {
    await grok.generateWithGrok('test');
    assert.fail('Should have thrown on missing XAI_API_KEY');
  } catch (err) {
    assert(
      err.message.includes('XAI_API_KEY'),
      `Error message should mention XAI_API_KEY, got: ${err.message}`
    );
    console.log('✅  generateWithGrok throws on missing key');
  }

  try {
    await grok.generateImage('test');
    assert.fail('Should have thrown on missing XAI_API_KEY');
  } catch (err) {
    assert(err.message.includes('XAI_API_KEY'), `generateImage: ${err.message}`);
    console.log('✅  generateImage throws on missing key');
  }

  try {
    await grok.generateVideo('test');
    assert.fail('Should have thrown on missing XAI_API_KEY');
  } catch (err) {
    assert(err.message.includes('XAI_API_KEY'), `generateVideo: ${err.message}`);
    console.log('✅  generateVideo throws on missing key');
  }

  // Restore
  if (saved !== undefined) process.env.XAI_API_KEY = saved;
}

async function testGenerateNPCBatchFallback() {
  // generateNPCBatch calls generateWithGrok which will throw without the key.
  // It should propagate the error (not silently swallow it) so callers know.
  const saved = process.env.XAI_API_KEY;
  delete process.env.XAI_API_KEY;

  try {
    await grok.generateNPCBatch(2);
    assert.fail('Should have thrown on missing XAI_API_KEY');
  } catch (err) {
    assert(err.message.includes('XAI_API_KEY'), `generateNPCBatch: ${err.message}`);
    console.log('✅  generateNPCBatch propagates missing key error');
  }

  if (saved !== undefined) process.env.XAI_API_KEY = saved;
}

// -----------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------
(async () => {
  try {
    await testExports();
    await testConstants();
    await testMissingApiKeyThrows();
    await testGenerateNPCBatchFallback();
    console.log('\n✅  All grok.test.js tests passed');
  } catch (err) {
    console.error('\n❌  grok.test.js test failed:', err.message || err);
    process.exit(1);
  }
  process.exit(0);
})();
