#!/usr/bin/env node
// verify-hf-api-usage.js
// Verify if Overseer bot is using HF API or fallback mode

const http = require('http');

console.log('🔍 OVERSEER HF API VERIFICATION\n');
console.log('=' . repeat(60));

// Get backend URL from command line or default to localhost
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const configUrl = `${BACKEND_URL}/api/config/frontend`;

console.log(`\n📡 Testing backend: ${BACKEND_URL}`);
console.log(`   Config endpoint: ${configUrl}\n`);

// Parse URL for http.get
const urlObj = new URL(configUrl);
const options = {
  hostname: urlObj.hostname,
  port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
  path: urlObj.pathname,
  method: 'GET'
};

const requester = urlObj.protocol === 'https:' ? require('https') : http;

requester.get(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const config = JSON.parse(data);
      console.log('✅ Config endpoint responding\n');
      
      const hfApiKey = config.overseer?.hfApiKey || '';
      const hfModel = config.overseer?.hfModel || '';
      
      console.log('🔑 HF API KEY STATUS:');
      console.log('-' . repeat(60));
      
      if (!hfApiKey || hfApiKey === '') {
        console.log('❌ NOT CONFIGURED');
        console.log('   Status: Empty string returned from backend');
        console.log('   Behavior: Bot will use FALLBACK responses');
        console.log('\n💡 TO FIX:');
        console.log('   1. Add HF_API_KEY to your .env file (local)');
        console.log('   2. Or add to Render/Vercel environment variables (production)');
        console.log('   3. Restart the backend service');
      } else if (hfApiKey === '<YOUR_HF_API_KEY>') {
        console.log('❌ PLACEHOLDER VALUE');
        console.log('   Status: Default placeholder from .env.example');
        console.log('   Behavior: Bot will use FALLBACK responses');
        console.log('\n💡 TO FIX:');
        console.log('   1. Replace placeholder with real HF API key');
        console.log('   2. Get key from: https://huggingface.co/settings/tokens');
      } else if (hfApiKey.startsWith('hf_')) {
        console.log('✅ CONFIGURED');
        console.log('   Status: Valid HF API key detected');
        console.log('   Key: [REDACTED]');
        console.log('   Behavior: Bot WILL use HF API for AI responses');
        console.log('\n✨ TO VERIFY IN BROWSER:');
        console.log('   1. Open: ' + BACKEND_URL + '/overseer.html');
        console.log('   2. Type: speak');
        console.log('   3. Check Network tab for requests to:');
        console.log('      https://api-inference.huggingface.co');
        console.log('   4. Response should be unique AI-generated text');
      } else {
        console.log('⚠️  UNUSUAL FORMAT');
        console.log('   Status: API key present but doesn\'t start with "hf_"');
        console.log('   Key: [REDACTED]');
        console.log('   Behavior: Will attempt to use key (may fail)');
      }
      
      console.log('\n📋 MODEL STATUS:');
      console.log('-' . repeat(60));
      if (hfModel) {
        console.log('✅ ' + hfModel);
      } else {
        console.log('⚠️  Not configured (will use default)');
      }
      
      console.log('\n🧪 TESTING INSTRUCTIONS:');
      console.log('-' . repeat(60));
      
      if (BACKEND_URL.includes('localhost')) {
        console.log('LOCAL TESTING:');
        console.log('1. Ensure backend is running: npm start');
        console.log('2. Open: http://localhost:3000/overseer.html');
        console.log('3. Open browser console (F12)');
        console.log('4. Type "speak" in terminal');
        console.log('5. Check console messages:');
        if (!hfApiKey || hfApiKey === '' || hfApiKey === '<YOUR_HF_API_KEY>') {
          console.log('   Expected: "[Overseer] HF_API_KEY not configured, using fallback responses"');
        } else {
          console.log('   Expected: Network request to api-inference.huggingface.co');
          console.log('   Expected: Unique AI-generated response (not pre-written)');
        }
      } else {
        console.log('PRODUCTION TESTING:');
        console.log('1. Open: ' + BACKEND_URL + '/overseer.html');
        console.log('2. Open browser console (F12)');
        console.log('3. Type "speak" in terminal');
        console.log('4. Check Network tab for HF API requests');
      }
      
      console.log('\n' + '=' . repeat(60));
      console.log('📊 SUMMARY');
      console.log('=' . repeat(60));
      console.log('Backend: ' + BACKEND_URL);
      console.log('Config API: ' + (res.statusCode === 200 ? '✅ Working' : '❌ Failed'));
      console.log('HF API Key: ' + (hfApiKey && hfApiKey !== '' && hfApiKey !== '<YOUR_HF_API_KEY>' ? '✅ Configured' : '❌ Not configured'));
      console.log('HF Model: ' + (hfModel ? '✅ ' + hfModel : '⚠️  Not set'));
      console.log('Bot Mode: ' + (hfApiKey && hfApiKey !== '' && hfApiKey !== '<YOUR_HF_API_KEY>' ? '🤖 AI-ENABLED' : '📝 FALLBACK'));
      
      console.log('\n☢️ For the good of the Vault!\n');
      
      process.exit(0);
    } catch (err) {
      console.log('❌ Failed to parse config:', err.message);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.log('❌ Failed to connect to backend:', err.message);
  console.log('\n💡 TROUBLESHOOTING:');
  console.log('   - Is the backend server running?');
  console.log('   - Is the URL correct? Current: ' + BACKEND_URL);
  console.log('   - Try: BACKEND_URL=https://your-app.onrender.com node verify-hf-api-usage.js');
  process.exit(1);
});
