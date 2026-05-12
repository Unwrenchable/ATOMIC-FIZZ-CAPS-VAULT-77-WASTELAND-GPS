# 🔐 AWS KMS Setup Guide for Atomic Fizz Caps

## 📟 OVERSEER BRIEFING

**⚠️ IMPORTANT: AWS KMS IS OPTIONAL AND COSTS MONEY!**

**Want a FREE alternative?** → See [LOCAL_SIGNING_SETUP.md](LOCAL_SIGNING_SETUP.md)

This guide explains how to obtain and configure an AWS KMS (Key Management Service) key for cryptographic signing operations in the Atomic Fizz Caps game.

**AWS KMS costs $1/month + operations**. Only use KMS if you need:
- Hardware-backed security (HSM)
- Regulatory compliance (HIPAA, PCI-DSS, etc.)
- Centralized key management

**For 99% of users, FREE local signing is perfectly secure.** ☢️

---

**The KMS key ARN you need looks like this:**
```
arn:aws:kms:us-west-2:123456789012:key/abcd1234-ef56-7890-abcd-ef1234567890
```

---

## 🎯 When Do You Need AWS KMS?

**KMS is OPTIONAL** for most deployments. You need it only if:
- You're running a production environment with high security requirements
- You need hardware-backed key security (FIPS 140-2 Level 3)
- You want centralized key management and audit trails
- You're using AWS infrastructure

**For development and testing**, the built-in local signing (using `SERVER_SECRET_KEY`) is sufficient.

---

## 💰 Cost Considerations

Before proceeding, understand the costs:
- **Asymmetric KMS keys**: $1.00/month per key
- **Signing operations**: $0.03 per 10,000 requests
- **Example**: 1 million signs/month = ~$3.30/month total

**Free tier**: KMS is NOT included in AWS free tier.

---

## 📋 Prerequisites

Before setting up KMS, you need:
1. ✅ An AWS account (https://aws.amazon.com/)
2. ✅ AWS CLI installed (optional but recommended)
3. ✅ IAM permissions to create/manage KMS keys
4. ✅ Basic understanding of AWS concepts

---

## 🚀 Method 1: AWS Console (Easiest)

### Step 1: Navigate to KMS

1. Log into AWS Console: https://console.aws.amazon.com/
2. Select your desired region (e.g., `us-west-2`) from the top-right dropdown
3. Search for "KMS" in the services search bar
4. Click **"AWS Key Management Service"**

### Step 2: Create a New Key

1. Click **"Create key"** button
2. Configure key settings:
   - **Key type**: `Asymmetric`
   - **Key usage**: `Sign and verify`
   - **Key spec**: Select **`ECC_SECG_P256K1`** (recommended - widely compatible) or **`ECC_NIST_EDWARDS25519`** (newer, faster)

   > **Important**: The key spec must match your `KMS_SIGNING_ALGORITHM` environment variable:
   > - `ECC_SECG_P256K1` → Use algorithm `ECDSA_SHA_256` (recommended for compatibility)
   > - `ECC_NIST_EDWARDS25519` → Use algorithm `ED25519_SHA_512` (newer, requires recent AWS SDK)

3. Click **"Next"**

### Step 3: Add Labels

1. **Alias**: Enter a memorable name (e.g., `atomic-fizz-caps-signing-key`)
2. **Description**: Add context (e.g., `Signing key for Atomic Fizz Caps game backend`)
3. **Tags** (optional):
   - Key: `Project`, Value: `AtomicFizzCaps`
   - Key: `Environment`, Value: `Production`
4. Click **"Next"**

### Step 4: Define Key Administrators

1. Select IAM users/roles who can **manage** the key (not use it for signing)
2. ✅ Check **"Allow key administrators to delete this key"** (optional)
3. Click **"Next"**

### Step 5: Define Key Users

1. Select IAM users/roles who can **use** the key for signing operations
2. This should be the IAM user/role your backend server runs as
3. Click **"Next"**

### Step 6: Review Key Policy

1. Review the auto-generated key policy
2. Ensure it includes these statements:
   ```json
   {
     "Effect": "Allow",
     "Principal": {
       "AWS": "arn:aws:iam::123456789012:user/YOUR_USER"
     },
     "Action": [
       "kms:Sign",
       "kms:GetPublicKey"
     ],
     "Resource": "*"
   }
   ```
3. Click **"Finish"**

### Step 7: Retrieve the Key ARN

1. After creation, you'll see your new key in the list
2. Click on the key alias
3. **Copy the ARN** from the "General configuration" section
   - Example: `arn:aws:kms:us-west-2:123456789012:key/abcd1234-ef56-7890-abcd-ef1234567890`
4. Save this ARN - you'll need it for your `.env` file

---

## 🖥️ Method 2: AWS CLI (Advanced)

### Step 1: Install and Configure AWS CLI

```bash
# Install AWS CLI (if not already installed)
# macOS:
brew install awscli

# Linux:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure credentials
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and default region
```

### Step 2: Create KMS Key (ECDSA - Recommended)

```bash
# Create key with ECDSA algorithm (most compatible)
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "Atomic Fizz Caps signing key" \
  --tags TagKey=Project,TagValue=AtomicFizzCaps \
  --region us-west-2

# Output will include:
# "KeyId": "abcd1234-ef56-7890-abcd-ef1234567890"
# "Arn": "arn:aws:kms:us-west-2:123456789012:key/abcd1234-ef56-7890-abcd-ef1234567890"
```

**Alternative: ED25519 (newer, requires recent AWS SDK)**
```bash
# Create key with ED25519 algorithm (faster but newer)
aws kms create-key \
  --key-spec ECC_NIST_EDWARDS25519 \
  --key-usage SIGN_VERIFY \
  --description "Atomic Fizz Caps signing key" \
  --region us-west-2
```

### Step 3: Create Key Alias (Optional but Recommended)

```bash
aws kms create-alias \
  --alias-name alias/atomic-fizz-caps-signing \
  --target-key-id abcd1234-ef56-7890-abcd-ef1234567890 \
  --region us-west-2
```

### Step 4: Update Key Policy

Save this policy to `kms-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM User Permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow use of the key for signing",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/YOUR_BACKEND_USER"
      },
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    }
  ]
}
```

Apply the policy:
```bash
aws kms put-key-policy \
  --key-id abcd1234-ef56-7890-abcd-ef1234567890 \
  --policy-name default \
  --policy file://kms-policy.json \
  --region us-west-2
```

---

## 🔍 Method 3: List Existing Keys

If you already created a KMS key and need to retrieve its ARN:

### AWS Console
1. Navigate to KMS service
2. Select **"Customer managed keys"**
3. Find your key and click on it
4. Copy the ARN from the details page

### AWS CLI
```bash
# List all KMS keys
aws kms list-keys --region us-west-2

# Get details for a specific key
aws kms describe-key \
  --key-id abcd1234-ef56-7890-abcd-ef1234567890 \
  --region us-west-2
```

### Using the Helper Script
```bash
cd backend/scripts
node setup_kms_key.js --list
```

---

## 🔧 Method 4: Use the Helper Script (Recommended)

We provide a Node.js helper script to automate KMS setup:

```bash
cd backend/scripts

# List existing keys
node setup_kms_key.js --list

# Create a new ECDSA key (recommended - most compatible)
node setup_kms_key.js --create --region us-west-2 --algorithm ECDSA

# Create a new ED25519 key (faster but newer, requires recent AWS SDK)
node setup_kms_key.js --create --region us-west-2 --algorithm ED25519

# The script will output the ARN ready to paste into your .env file
```

---

## 🔐 IAM Permissions Required

Your IAM user/role needs these permissions:

### Minimum Required Policy (for existing key)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-west-2:123456789012:key/YOUR_KEY_ID"
    }
  ]
}
```

### Full Management Policy (for creating keys)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:CreateKey",
        "kms:CreateAlias",
        "kms:ListKeys",
        "kms:ListAliases",
        "kms:DescribeKey",
        "kms:GetPublicKey",
        "kms:Sign",
        "kms:PutKeyPolicy",
        "kms:TagResource"
      ],
      "Resource": "*"
    }
  ]
}
```

**To apply this policy:**
1. Go to IAM Console → Users → [Your User]
2. Click "Add permissions" → "Create inline policy"
3. Paste the JSON above
4. Name it `KMSSigningPolicy`
5. Click "Create policy"

---

## ⚙️ Configure Your Environment

Once you have your KMS key ARN, add it to your `.env` file:

```bash
# AWS KMS Configuration
AWS_REGION=us-west-2
KMS_SIGNING_KEY_ID=arn:aws:kms:us-west-2:123456789012:key/abcd1234-ef56-7890-abcd-ef1234567890
KMS_SIGNING_ALGORITHM=ECDSA_SHA_256  # For ECC_SECG_P256K1 (recommended)
# OR
# KMS_SIGNING_ALGORITHM=ED25519_SHA_512  # For ECC_NIST_EDWARDS25519 (newer)
```

**AWS Credentials** (one of these methods):

### Option 1: Environment Variables
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### Option 2: AWS Config Files
```bash
# ~/.aws/credentials
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# ~/.aws/config
[default]
region = us-west-2
```

### Option 3: IAM Role (Recommended for EC2/ECS)
No credentials needed - the instance role automatically provides access.

---

## ✅ Testing Your KMS Setup

### Test 1: Verify AWS Credentials
```bash
aws sts get-caller-identity
```
Should output your AWS account ID and user ARN.

### Test 2: Verify KMS Access
```bash
aws kms describe-key --key-id YOUR_KEY_ARN --region us-west-2
```
Should output key metadata.

### Test 3: Test Signing (from backend directory)
```bash
cd backend
node -e "
const { signMessageWithKms } = require('./lib/kmsSigner.js');
const msg = Buffer.from('test message');
signMessageWithKms(msg).then(result => {
  console.log('✅ KMS signing works!');
  console.log('Signature:', result.signatureBase58.substring(0, 20) + '...');
}).catch(err => {
  console.error('❌ KMS signing failed:', err.message);
});
"
```

### Test 4: Check Backend Startup
```bash
cd backend
npm start
```
Check logs for:
```
[kmsSigner] KMS_SIGNING_KEY_ID not set...
```
This warning should NOT appear if KMS is configured correctly.

---

## 🔄 Key Rotation

AWS KMS supports automatic key rotation, but for **asymmetric keys** (which we use), you must rotate manually.

### When to Rotate
- **Annually** as a security best practice
- After suspected key compromise
- When team members with key access leave
- Regulatory compliance requirements

### How to Rotate
Use the provided rotation script:
```bash
cd backend/scripts
node rotate_kms_key.js \
  --newKeyArn=arn:aws:kms:us-west-2:123456789012:key/NEW_KEY_ID \
  --newKeyId=v2 \
  --oldKeyId=v1 \
  --adminApiUrl=https://api.atomicfizzcaps.xyz/api/keys-admin/add \
  --adminToken=YOUR_ADMIN_TOKEN
```

This script:
1. Fetches the public key from your new KMS key
2. Publishes it to your backend's key registry
3. Marks the old key as `retired`

---

## 🐛 Troubleshooting

### Error: "KMS did not return a signature"

**Possible causes:**
1. ❌ Key spec doesn't match algorithm
   - Solution: Check `KMS_SIGNING_ALGORITHM` matches your key type
2. ❌ IAM permissions missing
   - Solution: Add `kms:Sign` permission to your IAM policy
3. ❌ Key is in wrong region
   - Solution: Ensure `AWS_REGION` matches your key's region

### Error: "No KMS key configured"

**Cause**: `KMS_SIGNING_KEY_ID` not set in environment

**Solution**: Add it to your `.env` file:
```bash
KMS_SIGNING_KEY_ID=arn:aws:kms:us-west-2:123456789012:key/YOUR_KEY_ID
```

### Error: "AccessDeniedException"

**Cause**: IAM user/role lacks permissions

**Solution**: Add required permissions to IAM policy (see IAM Permissions section above)

### Error: "Invalid key spec"

**Cause**: Key spec doesn't support signing operations

**Solution**: Key must be:
- Type: `Asymmetric`
- Usage: `Sign and verify`
- Spec: `ECC_NIST_EDWARDS25519` or `ECC_SECG_P256K1` (or other signing-compatible spec)

### Warning: "KMS_SIGNING_KEY_ID not set"

**This is OK!** KMS is optional. The backend will use local signing (SERVER_SECRET_KEY) instead.

**To suppress**: Set `KMS_SIGNING_KEY_ID` or ignore the warning (it's just informational).

---

## 🔒 Security Best Practices

### 1. ✅ Use IAM Roles (Not Access Keys)
When running on AWS infrastructure (EC2, ECS, Lambda), use IAM roles instead of hardcoded credentials.

### 2. ✅ Principle of Least Privilege
Only grant `kms:Sign` and `kms:GetPublicKey` - not `kms:*`

### 3. ✅ Enable CloudTrail Logging
Track all KMS API calls for audit trails:
```bash
aws cloudtrail create-trail --name kms-audit-trail
```

### 4. ✅ Use Separate Keys Per Environment
- Dev: `atomic-fizz-caps-dev-signing`
- Staging: `atomic-fizz-caps-staging-signing`
- Production: `atomic-fizz-caps-prod-signing`

### 5. ✅ Never Commit Credentials
Add to `.gitignore`:
```
.env
.env.local
.env.production
.aws/
```

### 6. ✅ Rotate Keys Annually
Set a calendar reminder to rotate keys every 12 months.

### 7. ✅ Monitor Usage
Set up CloudWatch alarms for unusual KMS activity:
- Sudden spike in signing operations
- Failed authorization attempts
- Access from unexpected IP addresses

---

## 📊 Cost Optimization

### Tips to Reduce KMS Costs

1. **Cache Public Keys**: Don't call `GetPublicKey` repeatedly - cache it
2. **Batch Signatures**: Sign multiple messages in one operation if possible
3. **Use KMS Only for Critical Paths**: Local signing for non-critical operations
4. **Monitor Usage**: Set up billing alerts at $10, $50, $100

### Cost Comparison

| Scenario | Operations/Month | Cost |
|----------|------------------|------|
| Small app | 100,000 signs | $1.30 |
| Medium app | 1,000,000 signs | $4.00 |
| Large app | 10,000,000 signs | $31.00 |

*(Includes $1 base key cost + operation costs)*

---

## 📚 Related Documentation

- [Environment Variables Reference](../ENVIRONMENT_VARIABLES.md)
- [Backend Setup](.env.example)
- [Key Rotation Script](../backend/scripts/rotate_kms_key.js)
- [KMS Signer Implementation](../backend/lib/kmsSigner.js)

---

## 🆘 Still Need Help?

1. Check the [Troubleshooting](#-troubleshooting) section above
2. Review AWS KMS documentation: https://docs.aws.amazon.com/kms/
3. Run the helper script with `--help` flag
4. Check server logs for detailed error messages

---

**📟 OVERSEER MESSAGE:**

> "AWS KMS provides hardware-backed cryptographic security for your signing operations.
> While optional, it's recommended for production deployments handling sensitive transactions.
> 
> Choose your security level wisely, Vault Dweller. ☢️"

---

*Document Version: 1.0*  
*Last Updated: 2026-01-29*  
*Classification: VAULT-TEC PUBLIC*
