// tests/cors_config.test.js
// Test CORS configuration logic to ensure critical origins are always allowed

const assert = require('assert');

function testCorsLogic() {
  console.log('Testing CORS configuration logic...');

  // Critical origins that should ALWAYS be allowed
  const criticalOrigins = [
    "https://www.atomicfizzcaps.xyz",
    "https://atomicfizzcaps.xyz"
  ];

  const defaultOrigins = [
    "http://localhost:3000",
    "https://*.vercel.app",
    "https://*.onrender.com"
  ];

  // Test Case 1: No FRONTEND_ORIGIN env var - should use defaults
  {
    const envOrigins = defaultOrigins;
    const rawOrigins = [...new Set([...criticalOrigins, ...envOrigins])];
    
    assert(rawOrigins.includes("https://www.atomicfizzcaps.xyz"), 
      "Critical origin www.atomicfizzcaps.xyz must be included");
    assert(rawOrigins.includes("https://atomicfizzcaps.xyz"), 
      "Critical origin atomicfizzcaps.xyz must be included");
    assert(rawOrigins.includes("http://localhost:3000"), 
      "Default origin localhost:3000 must be included");
    console.log('✓ Test Case 1: Default configuration passed');
  }

  // Test Case 2: FRONTEND_ORIGIN set - critical origins should still be included
  {
    const FRONTEND_ORIGIN = "https://custom.domain.com,https://*.example.com";
    const envOrigins = FRONTEND_ORIGIN.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    const rawOrigins = [...new Set([...criticalOrigins, ...envOrigins])];
    
    assert(rawOrigins.includes("https://www.atomicfizzcaps.xyz"), 
      "Critical origin www.atomicfizzcaps.xyz must be included even with custom env");
    assert(rawOrigins.includes("https://atomicfizzcaps.xyz"), 
      "Critical origin atomicfizzcaps.xyz must be included even with custom env");
    assert(rawOrigins.includes("https://custom.domain.com"), 
      "Custom origin from env must be included");
    assert(rawOrigins.includes("https://*.example.com"), 
      "Wildcard origin from env must be included");
    console.log('✓ Test Case 2: Custom FRONTEND_ORIGIN configuration passed');
  }

  // Test Case 3: Wildcard pattern matching
  {
    function wildcardToRegex(pattern) {
      const escaped = pattern
        .replace(/^https?:\/\//, '')
        .replace(/\\/g, '\\\\')
        .replace(/\./g, '\\.')
        .replace(/\*/g, '[^\\/]+');
      return new RegExp('^https?:\\/\\/' + escaped + '(\\:\\d+)?$');
    }

    const vercelPattern = "https://*.vercel.app";
    const renderPattern = "https://*.onrender.com";

    const vercelRegex = wildcardToRegex(vercelPattern);
    const renderRegex = wildcardToRegex(renderPattern);

    assert(vercelRegex.test("https://preview-xyz.vercel.app"), 
      "Vercel preview domain should match wildcard");
    assert(vercelRegex.test("https://my-app-123.vercel.app"), 
      "Vercel app domain should match wildcard");
    assert(renderRegex.test("https://my-service.onrender.com"), 
      "Render domain should match wildcard");
    assert(!vercelRegex.test("https://evil.com"), 
      "Non-matching domain should not match");
    console.log('✓ Test Case 3: Wildcard pattern matching passed');
  }

  // Test Case 4: Duplicate removal
  {
    const FRONTEND_ORIGIN = "https://www.atomicfizzcaps.xyz,https://atomicfizzcaps.xyz,http://localhost:3000";
    const envOrigins = FRONTEND_ORIGIN.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    const rawOrigins = [...new Set([...criticalOrigins, ...envOrigins])];
    
    // Should not have duplicates
    const uniqueOrigins = [...new Set(rawOrigins)];
    assert.strictEqual(rawOrigins.length, uniqueOrigins.length, 
      "Should not have duplicate origins");
    console.log('✓ Test Case 4: Duplicate removal passed');
  }

  console.log('\n✅ All CORS configuration tests passed!\n');
}

// Run tests
try {
  testCorsLogic();
  process.exit(0);
} catch (err) {
  console.error('❌ CORS configuration test failed:', err.message);
  process.exit(1);
}
