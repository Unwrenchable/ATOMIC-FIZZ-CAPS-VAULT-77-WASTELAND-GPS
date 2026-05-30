#!/usr/bin/env node
// test-overseer-bot.js
// Comprehensive test for Overseer bot and HF API integration

const http = require('http');

console.log('🤖 OVERSEER BOT INTEGRATION TEST\n');
console.log('=' . repeat(60));

// Test 1: Backend Config Endpoint
console.log('\n[TEST 1] Testing backend /api/config/frontend endpoint...');
http.get('http://localhost:3000/api/config/frontend', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const config = JSON.parse(data);
      console.log('✅ Config endpoint responding');
      console.log('   Response:', JSON.stringify(config, null, 2));
      
      // Check if HF API key is configured
      if (config.overseer && config.overseer.hfApiKey) {
        const key = config.overseer.hfApiKey;
        if (key === '<YOUR_HF_API_KEY>' || key === '') {
          console.log('⚠️  HF_API_KEY is not configured (using placeholder)');
          console.log('   This means the bot will use FALLBACK responses instead of AI');
          console.log('   To fix: Set HF_API_KEY in your .env file');
        } else if (key.startsWith('hf_')) {
          console.log('✅ HF_API_KEY is configured properly');
          console.log('   Key format: [REDACTED]');
        } else {
          console.log('⚠️  HF_API_KEY format looks incorrect (should start with "hf_")');
        }
      } else {
        console.log('❌ overseer.hfApiKey not found in config');
      }
      
      // Check if model is configured
      if (config.overseer && config.overseer.hfModel) {
        console.log('✅ HF_MODEL is configured:', config.overseer.hfModel);
      } else {
        console.log('⚠️  HF_MODEL not found in config');
      }
      
      runBehaviorTest(config);
    } catch (err) {
      console.log('❌ Failed to parse config:', err.message);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.log('❌ Failed to connect to backend:', err.message);
  console.log('   Make sure the backend server is running on port 3000');
  process.exit(1);
});

// Test 2: Bot Behavior Description
function runBehaviorTest(config) {
  console.log('\n[TEST 2] Bot Behavior Analysis');
  console.log('=' . repeat(60));
  
  const hasValidKey = config.overseer?.hfApiKey && 
                      config.overseer.hfApiKey !== '<YOUR_HF_API_KEY>' &&
                      config.overseer.hfApiKey !== '';
  
  console.log('\n📋 HOW THE BOT WORKS:');
  console.log('-' . repeat(60));
  console.log('1. Frontend loads overseer.html');
  console.log('2. core.personality.js fetches config from /api/config/frontend');
  console.log('3. When user interacts with bot:');
  
  if (hasValidKey) {
    console.log('   ✅ Bot WILL make API calls to Hugging Face');
    console.log('   ✅ Uses model:', config.overseer.hfModel);
    console.log('   ✅ Requests are made CLIENT-SIDE from browser');
    console.log('   ✅ AI responses will be dynamic and contextual');
    console.log('\n   API Call Details:');
    console.log('   - Endpoint: https://api-inference.huggingface.co/models/' + config.overseer.hfModel);
    console.log('   - Auth: Bearer [REDACTED]');
    console.log('   - Parameters: max_new_tokens=80, temperature=0.8, top_p=0.9');
  } else {
    console.log('   ⚠️  Bot will NOT make API calls to Hugging Face');
    console.log('   ⚠️  Bot will use FALLBACK responses (pre-written lines)');
    console.log('   ⚠️  Responses will be random but not AI-generated');
    console.log('\n   Fallback Behavior:');
    console.log('   - Uses pre-written lines from fallbackTones');
    console.log('   - Randomly picks from: neutral, sarcastic, corporate, glitch');
    console.log('   - No dynamic context or AI intelligence');
  }
  
  console.log('\n📁 RELEVANT FILES:');
  console.log('-' . repeat(60));
  console.log('Frontend:');
  console.log('  - /public/overseer.html          (UI page)');
  console.log('  - /public/js/overseer/core.personality.js  (AI integration)');
  console.log('  - /public/js/overseer/overseer.js  (Main bot brain)');
  console.log('  - /public/js/overseer/overseer.full.js  (Terminal engine)');
  console.log('\nBackend:');
  console.log('  - /backend/api/frontend-config.js  (Config API)');
  console.log('  - /backend/server.js              (Mounts /api/config/frontend)');
  console.log('\nConfiguration:');
  console.log('  - .env                            (HF_API_KEY, HF_MODEL)');
  
  console.log('\n🔧 CONFIGURATION CHECK:');
  console.log('-' . repeat(60));
  console.log('Environment Variables (from backend):');
  console.log('  HF_API_KEY:', hasValidKey ? '✅ CONFIGURED' : '❌ NOT CONFIGURED');
  console.log('  HF_MODEL:  ', config.overseer?.hfModel ? '✅ ' + config.overseer.hfModel : '❌ NOT SET');
  
  console.log('\n💡 TO ENABLE AI RESPONSES:');
  console.log('-' . repeat(60));
  if (!hasValidKey) {
    console.log('1. Get a Hugging Face API key from: https://huggingface.co/settings/tokens');
    console.log('2. Add to your .env file:');
    console.log('   HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxx');
    console.log('3. Restart the backend server');
    console.log('4. Bot will automatically use AI for responses');
  } else {
    console.log('✅ Already configured! Bot is using AI responses.');
  }
  
  console.log('\n🧪 TESTING INSTRUCTIONS:');
  console.log('-' . repeat(60));
  console.log('1. Ensure backend is running: npm start');
  console.log('2. Open in browser: http://localhost:3000/overseer.html');
  console.log('3. Type "speak" or "talk" to trigger AI response');
  console.log('4. Check browser console for:');
  console.log('   - "[Overseer] Configuration loaded from backend"');
  console.log('   - "Overseer AI online."');
  if (hasValidKey) {
    console.log('   - Network requests to api-inference.huggingface.co');
  } else {
    console.log('   - "[Overseer] HF_API_KEY not configured, using fallback responses"');
  }
  
  console.log('\n' + '=' . repeat(60));
  console.log('✅ TEST COMPLETE');
  console.log('=' . repeat(60));
  console.log('\nSUMMARY:');
  console.log('  Backend API: ✅ Working');
  console.log('  Config Endpoint: ✅ Responding');
  console.log('  HF API Key: ' + (hasValidKey ? '✅ Configured' : '⚠️  Not configured (using fallback)'));
  console.log('  Bot Status: ' + (hasValidKey ? '✅ AI-enabled' : '⚠️  Fallback mode'));
  console.log('\nFor the good of the Vault! ☢️\n');
  
  process.exit(0);
}
