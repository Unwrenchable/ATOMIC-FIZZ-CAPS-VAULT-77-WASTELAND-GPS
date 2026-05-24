// test-scrap-fuse.js
// ------------------------------------------------------------
// Test script for NFT Scrap and Fusion APIs
// Run with: node test-scrap-fuse.js
// ------------------------------------------------------------

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000'; // Adjust if running on different port

// Test data - replace with real wallet and NFT data
const TEST_WALLET = '11111111111111111111111111111112'; // Fake wallet for testing
const TEST_NFT_MINT = 'test_nft_mint_123'; // Fake NFT mint

async function testScrapAPI() {
  console.log('🧪 Testing Scrap API...');

  try {
    // First, we need to create a test player with an NFT
    const playerData = {
      walletAddress: TEST_WALLET,
      inventory: [{
        id: TEST_NFT_MINT,
        mint: TEST_NFT_MINT,
        name: 'Test Laser Rifle',
        type: 'weapon',
        rarity: 'rare',
        level: 1,
        stats: { damage: 25, accuracy: 80 }
      }],
      scrapResources: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, fusionCores: 0 },
      caps: 100
    };

    // This would normally be done through the wallet connection
    // For testing, we'll simulate having the data in Redis
    console.log('Note: In real usage, player data would be in Redis from wallet connection');

    const scrapResponse = await fetch(`${API_BASE}/api/scrap-nft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nftMint: TEST_NFT_MINT,
        walletAddress: TEST_WALLET
      })
    });

    const scrapResult = await scrapResponse.json();
    console.log('Scrap API Response:', scrapResult);

  } catch (error) {
    console.error('Scrap API test failed:', error.message);
  }
}

async function testFuseAPI() {
  console.log('🧪 Testing Fuse API...');

  try {
    const fuseResponse = await fetch(`${API_BASE}/api/fuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nftMints: ['fake_mint_1', 'fake_mint_2', 'fake_mint_3'],
        walletAddress: TEST_WALLET,
        fusionType: 'upgrade'
      })
    });

    const fuseResult = await fuseResponse.json();
    console.log('Fuse API Response:', fuseResult);

  } catch (error) {
    console.error('Fuse API test failed:', error.message);
  }
}

async function testGetResources() {
  console.log('🧪 Testing Get Resources API...');

  try {
    const resourcesResponse = await fetch(`${API_BASE}/api/scrap-nft/resources/${TEST_WALLET}`);
    const resourcesResult = await resourcesResponse.json();
    console.log('Resources API Response:', resourcesResult);

  } catch (error) {
    console.error('Resources API test failed:', error.message);
  }
}

async function testFuseRecipes() {
  console.log('🧪 Testing Fuse Recipes API...');

  try {
    const recipesResponse = await fetch(`${API_BASE}/api/fuse/recipes`);
    const recipesResult = await recipesResponse.json();
    console.log('Fuse Recipes API Response:', recipesResult);

  } catch (error) {
    console.error('Fuse Recipes API test failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Scrap & Fuse API Tests...\n');

  await testScrapAPI();
  console.log('');

  await testFuseAPI();
  console.log('');

  await testGetResources();
  console.log('');

  await testFuseRecipes();
  console.log('');

  console.log('✅ All tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testScrapAPI, testFuseAPI, testGetResources, testFuseRecipes };