// Test script to verify wallet authentication integration
// Run with: node test_wallet_auth_integration.js

const fs = require('fs');
const path = require('path');

// Mock browser environment
global.window = {
  crypto: require('crypto').webcrypto,
  localStorage: {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; }
  },
  addEventListener: function() {},
  dispatchEvent: function() {},
  location: { origin: 'http://localhost:3000' }
};

global.Game = { modules: {} };

global.document = {
  body: { appendChild: function() {} },
  createElement: function() { return { style: {} }; },
  getElementById: function() { return null; },
  addEventListener: function() {}
};

global.localStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; }
};

// Load the authClient
const authClientPath = path.join(__dirname, 'public', 'js', 'authClient.js');
const authClientCode = fs.readFileSync(authClientPath, 'utf8');

// Mock bs58 for authClient
global.window.bs58 = {
  encode: (buffer) => Buffer.from(buffer).toString('base58'),
  decode: (str) => Buffer.from(str, 'base58')
};

// Load authClient
try {
  eval(authClientCode);
  console.log('AuthClient code evaluated successfully');
} catch (e) {
  console.error('Failed to eval authClient:', e.message);
  process.exit(1);
}

// Load the web3-wallet-adapter
const walletAdapterPath = path.join(__dirname, 'public', 'js', 'modules', 'web3-wallet-adapter.js');
const walletAdapterCode = fs.readFileSync(walletAdapterPath, 'utf8');
try {
  eval(walletAdapterCode);
  console.log('Wallet adapter code evaluated successfully');
} catch (e) {
  console.error('Failed to eval wallet adapter:', e.message);
  process.exit(1);
}

async function testWalletAuthIntegration() {
  console.log('Testing wallet authentication integration...');

  try {
    // Check if AuthClient is available
    if (typeof window.AuthClient === 'undefined') {
      console.log('window.AuthClient is undefined');
      console.log('Available window properties:', Object.keys(window));
      throw new Error('AuthClient not loaded');
    }

    // Check if web3Wallet is available
    if (typeof window.web3Wallet === 'undefined') {
      throw new Error('web3Wallet not loaded');
    }

    console.log('✓ AuthClient and web3Wallet loaded successfully');

    // Test auth integration enablement
    const authEnabled = window.web3Wallet.enableAuth('http://localhost:3000');
    console.log('✓ Auth integration enabled:', authEnabled);

    // Test integrated wallet connection (should work without external dependencies)
    console.log('Testing integrated wallet connection...');
    const connectResult = await window.web3Wallet.connect('integrated');
    console.log('✓ Integrated wallet connection result:', connectResult);

    if (connectResult) {
      console.log('✓ Wallet address:', window.web3Wallet.getWalletAddress());
      console.log('✓ Wallet type:', window.web3Wallet.getWalletType());
      console.log('✓ Is connected:', window.web3Wallet.isConnected());
    }

    console.log('Wallet authentication integration test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testWalletAuthIntegration();