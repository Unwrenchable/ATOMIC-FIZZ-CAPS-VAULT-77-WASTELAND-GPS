#!/usr/bin/env node
// backend/scripts/setup_kms_key.js
// Helper script to create and manage AWS KMS keys for Atomic Fizz Caps

const { KMSClient, CreateKeyCommand, ListKeysCommand, DescribeKeyCommand, CreateAliasCommand } = require("@aws-sdk/client-kms");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");

const REGION = process.env.AWS_REGION || "us-west-2";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printBanner() {
  log("\n☢️  ATOMIC FIZZ CAPS - AWS KMS Setup Tool  ☢️\n", "cyan");
}

function printUsage() {
  log("\nUsage:", "bright");
  log("  node setup_kms_key.js --list                              List existing KMS keys");
  log("  node setup_kms_key.js --create --algorithm ED25519       Create new KMS key");
  log("  node setup_kms_key.js --describe --keyId <key-id>        Get key details");
  log("  node setup_kms_key.js --help                             Show this help");
  log("\nOptions:", "bright");
  log("  --list                 List all KMS keys in the region");
  log("  --create               Create a new asymmetric signing key");
  log("  --describe             Get details for a specific key");
  log("  --keyId <id>           Key ID or ARN (for --describe)");
  log("  --algorithm <alg>      Key algorithm: ED25519 (default) or ECDSA");
  log("  --region <region>      AWS region (default: us-west-2)");
  log("  --alias <name>         Create alias for new key (optional)");
  log("  --help                 Show this help message");
  log("\nExamples:", "bright");
  log("  node setup_kms_key.js --list --region us-east-1");
  log("  node setup_kms_key.js --create --algorithm ED25519 --alias atomic-fizz-caps");
  log("  node setup_kms_key.js --describe --keyId abcd1234-5678-90ab-cdef-1234567890ab");
  log("\nFor detailed instructions, see: docs/AWS_KMS_SETUP.md\n");
}

async function checkAWSCredentials() {
  try {
    const client = new STSClient({ region: REGION });
    const command = new GetCallerIdentityCommand({});
    const response = await client.send(command);
    
    log("✅ AWS Credentials Valid", "green");
    log(`   Account: ${response.Account}`);
    log(`   User ARN: ${response.Arn}`);
    log(`   Region: ${REGION}\n`);
    return true;
  } catch (error) {
    log("❌ AWS Credentials Error", "red");
    log(`   ${error.message}\n`);
    log("Please configure AWS credentials using one of these methods:", "yellow");
    log("  1. Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
    log("  2. AWS config files: ~/.aws/credentials and ~/.aws/config");
    log("  3. IAM role (if running on EC2/ECS)\n");
    return false;
  }
}

async function listKeys() {
  log("📋 Listing KMS Keys...\n", "blue");
  
  const kmsClient = new KMSClient({ region: REGION });
  
  try {
    const listCommand = new ListKeysCommand({});
    const listResponse = await kmsClient.send(listCommand);
    
    if (!listResponse.Keys || listResponse.Keys.length === 0) {
      log("No KMS keys found in this region.", "yellow");
      log("Create one with: node setup_kms_key.js --create\n");
      return;
    }
    
    log(`Found ${listResponse.Keys.length} key(s):\n`, "bright");
    
    for (const key of listResponse.Keys) {
      try {
        const describeCommand = new DescribeKeyCommand({ KeyId: key.KeyId });
        const keyDetails = await kmsClient.send(describeCommand);
        const metadata = keyDetails.KeyMetadata;
        
        log(`Key ID: ${metadata.KeyId}`, "cyan");
        log(`   ARN: ${metadata.Arn}`);
        log(`   Spec: ${metadata.KeySpec || 'N/A'}`);
        log(`   Usage: ${metadata.KeyUsage || 'N/A'}`);
        log(`   State: ${metadata.KeyState}`);
        log(`   Created: ${metadata.CreationDate ? metadata.CreationDate.toISOString() : 'N/A'}`);
        
        if (metadata.Description) {
          log(`   Description: ${metadata.Description}`);
        }
        
        // Check if this key is suitable for signing
        const isSigning = metadata.KeyUsage === 'SIGN_VERIFY';
        const isAsymmetric = metadata.KeySpec !== 'SYMMETRIC_DEFAULT';
        const isEnabled = metadata.KeyState === 'Enabled';
        
        if (isSigning && isAsymmetric && isEnabled) {
          log(`   ✅ SUITABLE FOR SIGNING`, "green");
          log(`\n   💡 To use this key, add to your .env:`, "yellow");
          log(`   KMS_SIGNING_KEY_ID=${metadata.Arn}`);
          
          // Determine algorithm
          if (metadata.KeySpec === 'ED25519') {
            log(`   KMS_SIGNING_ALGORITHM=SIGN_VERIFY`);
          } else if (metadata.KeySpec.includes('ECC')) {
            log(`   KMS_SIGNING_ALGORITHM=ECDSA_SHA_256`);
          }
        } else if (!isSigning) {
          log(`   ⚠️  Not for signing (usage: ${metadata.KeyUsage})`, "yellow");
        } else if (!isAsymmetric) {
          log(`   ⚠️  Symmetric key (not suitable for signing)`, "yellow");
        } else if (!isEnabled) {
          log(`   ⚠️  Key is ${metadata.KeyState}`, "yellow");
        }
        
        log(""); // Empty line between keys
      } catch (err) {
        log(`   ❌ Could not get details: ${err.message}`, "red");
        log("");
      }
    }
  } catch (error) {
    log(`❌ Error listing keys: ${error.message}`, "red");
    if (error.name === 'AccessDeniedException') {
      log("\n💡 You need 'kms:ListKeys' permission. Add to your IAM policy:", "yellow");
      log('   { "Effect": "Allow", "Action": "kms:ListKeys", "Resource": "*" }\n');
    }
  }
}

async function createKey(algorithm = 'ECDSA', alias = null) {
  log("🔨 Creating new KMS key...\n", "blue");
  
  const kmsClient = new KMSClient({ region: REGION });
  
  // Validate algorithm
  let keySpec, signingAlgorithm;
  if (algorithm.toUpperCase() === 'ED25519') {
    keySpec = 'ECC_NIST_EDWARDS25519';  // AWS key spec for Ed25519
    signingAlgorithm = 'ED25519_SHA_512';  // AWS signing algorithm for Ed25519
  } else if (algorithm.toUpperCase() === 'ECDSA') {
    keySpec = 'ECC_SECG_P256K1';
    signingAlgorithm = 'ECDSA_SHA_256';
  } else {
    log(`❌ Invalid algorithm: ${algorithm}`, "red");
    log("   Supported: ECDSA (recommended for compatibility), ED25519 (faster, newer)\n", "yellow");
    return;
  }
  
  try {
    const createCommand = new CreateKeyCommand({
      KeySpec: keySpec,
      KeyUsage: 'SIGN_VERIFY',
      Description: 'Atomic Fizz Caps signing key',
      Tags: [
        { TagKey: 'Project', TagValue: 'AtomicFizzCaps' },
        { TagKey: 'CreatedBy', TagValue: 'setup_kms_key.js' },
        { TagKey: 'CreatedAt', TagValue: new Date().toISOString() },
      ],
    });
    
    const response = await kmsClient.send(createCommand);
    const metadata = response.KeyMetadata;
    
    log("✅ Key Created Successfully!", "green");
    log(`\n   Key ID: ${metadata.KeyId}`, "cyan");
    log(`   ARN: ${metadata.Arn}`, "bright");
    log(`   Spec: ${metadata.KeySpec}`);
    log(`   Algorithm: ${signingAlgorithm}`);
    log(`   State: ${metadata.KeyState}`);
    
    // Create alias if requested
    if (alias) {
      try {
        const aliasName = alias.startsWith('alias/') ? alias : `alias/${alias}`;
        const aliasCommand = new CreateAliasCommand({
          AliasName: aliasName,
          TargetKeyId: metadata.KeyId,
        });
        await kmsClient.send(aliasCommand);
        log(`   Alias: ${aliasName}`, "green");
      } catch (aliasError) {
        log(`   ⚠️  Could not create alias: ${aliasError.message}`, "yellow");
      }
    }
    
    log("\n📝 Configuration:", "bright");
    log("   Add these lines to your .env file:\n", "yellow");
    log(`AWS_REGION=${REGION}`, "cyan");
    log(`KMS_SIGNING_KEY_ID=${metadata.Arn}`, "cyan");
    log(`KMS_SIGNING_ALGORITHM=${signingAlgorithm}`, "cyan");
    
    log("\n💰 Cost:", "bright");
    log("   - Base: $1.00/month for asymmetric key");
    log("   - Operations: $0.03 per 10,000 signing requests");
    
    log("\n🔐 Next Steps:", "bright");
    log("   1. Copy the configuration above to your .env file");
    log("   2. Update IAM permissions (see docs/AWS_KMS_SETUP.md)");
    log("   3. Test with: cd backend && node -e \"require('./lib/kmsSigner.js').signMessageWithKms(Buffer.from('test')).then(console.log)\"");
    log("   4. Restart your backend server\n");
    
  } catch (error) {
    log(`❌ Error creating key: ${error.message}`, "red");
    if (error.name === 'AccessDeniedException') {
      log("\n💡 You need 'kms:CreateKey' permission. Add to your IAM policy:", "yellow");
      log('   { "Effect": "Allow", "Action": "kms:CreateKey", "Resource": "*" }\n');
    }
  }
}

async function describeKey(keyId) {
  if (!keyId) {
    log("❌ Error: --keyId required for --describe", "red");
    log("   Example: node setup_kms_key.js --describe --keyId abcd1234-5678-90ab-cdef\n");
    return;
  }
  
  log(`🔍 Describing key: ${keyId}\n`, "blue");
  
  const kmsClient = new KMSClient({ region: REGION });
  
  try {
    const command = new DescribeKeyCommand({ KeyId: keyId });
    const response = await kmsClient.send(command);
    const metadata = response.KeyMetadata;
    
    log("Key Details:", "bright");
    log(`   Key ID: ${metadata.KeyId}`, "cyan");
    log(`   ARN: ${metadata.Arn}`);
    log(`   Spec: ${metadata.KeySpec}`);
    log(`   Usage: ${metadata.KeyUsage}`);
    log(`   State: ${metadata.KeyState}`);
    log(`   Created: ${metadata.CreationDate ? metadata.CreationDate.toISOString() : 'N/A'}`);
    log(`   Origin: ${metadata.Origin}`);
    log(`   Manager: ${metadata.KeyManager}`);
    
    if (metadata.Description) {
      log(`   Description: ${metadata.Description}`);
    }
    
    if (metadata.SigningAlgorithms && metadata.SigningAlgorithms.length > 0) {
      log(`   Signing Algorithms: ${metadata.SigningAlgorithms.join(', ')}`);
    }
    
    // Suitability check
    log("\nSuitability:", "bright");
    const isSigning = metadata.KeyUsage === 'SIGN_VERIFY';
    const isAsymmetric = metadata.KeySpec !== 'SYMMETRIC_DEFAULT';
    const isEnabled = metadata.KeyState === 'Enabled';
    
    if (isSigning && isAsymmetric && isEnabled) {
      log("   ✅ This key is suitable for signing operations", "green");
      log("\n📝 To use this key, add to your .env:", "yellow");
      log(`   KMS_SIGNING_KEY_ID=${metadata.Arn}`);
      
      if (metadata.KeySpec === 'ED25519') {
        log(`   KMS_SIGNING_ALGORITHM=SIGN_VERIFY`);
      } else if (metadata.KeySpec.includes('ECC')) {
        log(`   KMS_SIGNING_ALGORITHM=ECDSA_SHA_256`);
      }
    } else {
      if (!isSigning) {
        log(`   ❌ Not for signing (usage: ${metadata.KeyUsage})`, "red");
      }
      if (!isAsymmetric) {
        log(`   ❌ Symmetric key (not suitable for signing)`, "red");
      }
      if (!isEnabled) {
        log(`   ⚠️  Key is ${metadata.KeyState}`, "yellow");
      }
    }
    
    log("");
    
  } catch (error) {
    log(`❌ Error describing key: ${error.message}`, "red");
    if (error.name === 'NotFoundException') {
      log(`\n💡 Key not found. Check the key ID and region (current: ${REGION})`, "yellow");
    } else if (error.name === 'AccessDeniedException') {
      log("\n💡 You need 'kms:DescribeKey' permission. Add to your IAM policy:", "yellow");
      log('   { "Effect": "Allow", "Action": "kms:DescribeKey", "Resource": "*" }\n');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const flags = {
    list: args.includes('--list'),
    create: args.includes('--create'),
    describe: args.includes('--describe'),
    help: args.includes('--help') || args.includes('-h'),
  };
  
  const getArg = (name) => {
    const index = args.indexOf(name);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };
  
  const region = getArg('--region');
  if (region) {
    process.env.AWS_REGION = region;
  }
  
  printBanner();
  
  if (flags.help || args.length === 0) {
    printUsage();
    return;
  }
  
  // Check AWS credentials first
  const hasCredentials = await checkAWSCredentials();
  if (!hasCredentials) {
    process.exit(1);
  }
  
  // Execute requested action
  if (flags.list) {
    await listKeys();
  } else if (flags.create) {
    const algorithm = getArg('--algorithm') || 'ED25519';
    const alias = getArg('--alias');
    await createKey(algorithm, alias);
  } else if (flags.describe) {
    const keyId = getArg('--keyId');
    await describeKey(keyId);
  } else {
    log("❌ Unknown command. Use --help for usage information.\n", "red");
    printUsage();
  }
}

// Run
main().catch((err) => {
  log(`\n❌ Fatal Error: ${err.message}`, "red");
  if (err.stack) {
    log(err.stack, "red");
  }
  process.exit(1);
});
