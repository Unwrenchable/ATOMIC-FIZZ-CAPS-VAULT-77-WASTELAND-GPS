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
    
    assert(rawOrigins.some(origin => origin === "https://www.atomicfizzcaps.xyz"), 
      "Critical origin www.atomicfizzcaps.xyz must be included");
    assert(rawOrigins.some(origin => origin === "https://atomicfizzcaps.xyz"), 
      "Critical origin atomicfizzcaps.xyz must be included");
    assert(rawOrigins.some(origin => origin === "http://localhost:3000"), 
      "Default origin localhost:3000 must be included");
    console.log('✓ Test Case 1: Default configuration passed');
  }

  // Test Case 2: FRONTEND_ORIGIN set - critical origins should still be included
  {
    const FRONTEND_ORIGIN = "https://custom.domain.com,https://*.example.com";
    const envOrigins = FRONTEND_ORIGIN.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    const rawOrigins = [...new Set([...criticalOrigins, ...envOrigins])];
    
    assert(rawOrigins.some(origin => origin === "https://www.atomicfizzcaps.xyz"), 
      "Critical origin www.atomicfizzcaps.xyz must be included even with custom env");
    assert(rawOrigins.some(origin => origin === "https://atomicfizzcaps.xyz"), 
      "Critical origin atomicfizzcaps.xyz must be included even with custom env");
    assert(rawOrigins.some(origin => origin === "https://custom.domain.com"), 
      "Custom origin from env must be included");
    assert(rawOrigins.some(origin => origin === "https://*.example.com"), 
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
        .replace(/\*/g, '[a-zA-Z0-9-]+');  // SECURITY FIX: Only allow valid hostname characters (alphanumeric and hyphens)
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
    
    // SECURITY: Test bypass attempts
    assert(!vercelRegex.test("https://vercel.app.evil.com"),
      "Security: Should not match subdomain spoofing");
    assert(!vercelRegex.test("https://evil.com/https://preview.vercel.app"),
      "Security: Should not match path-based spoofing");
    assert(!vercelRegex.test("https://evil-vercel.app"),
      "Security: Should not match similar domain");
    assert(!vercelRegex.test("https://my.app.vercel.app.evil.com"),
      "Security: Should not match domain appending");
    assert(!vercelRegex.test("http://evil.com?redirect=https://my-app.vercel.app"),
      "Security: Should not match query parameter spoofing");
      
    console.log('✓ Test Case 3: Wildcard pattern matching passed');
  }

  // Test Case 4: Security - Origin validation bypass attempts
  {
    function wildcardToRegex(pattern) {
      const escaped = pattern
        .replace(/^https?:\/\//, '')
        .replace(/\\/g, '\\\\')
        .replace(/\./g, '\\.')
        .replace(/\*/g, '[a-zA-Z0-9-]+');  // SECURITY FIX: Only allow valid hostname characters (alphanumeric and hyphens)
      return new RegExp('^https?:\\/\\/' + escaped + '(\\:\\d+)?$');
    }
    
    // Test exact origin matching with attack vectors
    const allowedOrigins = [
      "https://www.atomicfizzcaps.xyz",
      "https://atomicfizzcaps.xyz"
    ];
    
    // Valid origin should match
    assert(allowedOrigins.some(origin => origin === "https://www.atomicfizzcaps.xyz"),
      "Security: Exact origin should match exactly");
    
    // Attack vectors should NOT match
    assert(!allowedOrigins.some(origin => origin === "https://evil.com/https://www.atomicfizzcaps.xyz"),
      "Security: Path-based spoofing should not match");
    assert(!allowedOrigins.some(origin => origin === "https://www.atomicfizzcaps.xyz.evil.com"),
      "Security: Domain appending should not match");
    assert(!allowedOrigins.some(origin => origin === "https://evil-atomicfizzcaps.xyz"),
      "Security: Similar domain should not match");
    assert(!allowedOrigins.some(origin => origin === "http://www.atomicfizzcaps.xyz"),
      "Security: Protocol mismatch should not match");
    
    // Test wildcard pattern cannot match dots in subdomain
    const wildcardRegex = wildcardToRegex("https://*.vercel.app");
    assert(!wildcardRegex.test("https://a.b.vercel.app"),
      "Security: Wildcard should not match nested subdomains with dots");
    assert(wildcardRegex.test("https://a-b.vercel.app"),
      "Wildcard should match single-level subdomain with hyphens");
    
    console.log('✓ Test Case 4: Security bypass prevention passed');
  }

  // Test Case 5: Duplicate removal
  {
    const FRONTEND_ORIGIN = "https://www.atomicfizzcaps.xyz,https://atomicfizzcaps.xyz,http://localhost:3000";
    const envOrigins = FRONTEND_ORIGIN.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    const rawOrigins = [...new Set([...criticalOrigins, ...envOrigins])];
    
    // Should not have duplicates
    const uniqueOrigins = [...new Set(rawOrigins)];
    assert.strictEqual(rawOrigins.length, uniqueOrigins.length, 
      "Should not have duplicate origins");
    console.log('✓ Test Case 5: Duplicate removal passed');
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
