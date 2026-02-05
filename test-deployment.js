#!/usr/bin/env node
// Quick deployment verification script
// Tests that API routes are accessible and responding

const http = require('http');
const https = require('https');
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

const routes = [
  '/api/health',
  '/api/mintables',
  '/api/locations',
  '/api/settings',
  '/api/config/frontend',
];

console.log('🔍 Testing API Routes...');
console.log(`📡 Base URL: ${BASE_URL}\n`);

async function testRoute(route) {
  return new Promise((resolve) => {
    try {
      const url = `${BASE_URL}${route}`;
      const client = url.startsWith('https') ? https : http;
      
      const req = client.get(url, (res) => {
        const status = res.statusCode;
        const statusSymbol = status >= 200 && status < 400 ? '✅' : '❌';
        
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const displayBody = body.length > 100 ? body.substring(0, 100) + '...' : body;
          console.log(`${statusSymbol} ${route} - ${status}`);
          if (status >= 400) {
            console.log(`   Body: ${displayBody}`);
          }
          resolve(status >= 200 && status < 400);
        });
      });
      
      req.on('error', (err) => {
        console.log(`❌ ${route} - ERROR: ${err.message}`);
        resolve(false);
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        console.log(`❌ ${route} - ERROR: Request timeout`);
        resolve(false);
      });
    } catch (err) {
      console.log(`❌ ${route} - ERROR: ${err.message}`);
      resolve(false);
    }
  });
}

async function main() {
  const results = await Promise.all(routes.map(testRoute));
  const passed = results.filter(r => r).length;
  const failed = results.length - passed;
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some routes failed. Check the logs above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All routes responding correctly!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Test script failed:', err);
  process.exit(1);
});
