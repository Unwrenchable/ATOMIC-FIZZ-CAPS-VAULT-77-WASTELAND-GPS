// scripts/rotate_kms_key.js
// Usage: node rotate_kms_key.js --newKeyArn=arn:aws:kms:... --oldKeyId=v1 --newKeyId=v2 --adminApiUrl=https://your-backend/api/keys-admin/add
const { KMSClient, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
const fetch = require("node-fetch");
const bs58 = require("bs58");

const REGION = process.env.AWS_REGION || "us-west-2";
const client = new KMSClient({ region: REGION });

async function getPublicKey(keyArn) {
  const cmd = new GetPublicKeyCommand({ KeyId: keyArn });
  const res = await client.send(cmd);
  return Buffer.from(res.PublicKey);
}

async function publishPublicKey(adminApiUrl, adminToken, keyId, publicKeyBase58, status = "active") {
  const body = { keyId, publicKeyBase58, status };
  const res = await fetch(adminApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to publish key: ${res.status} ${text}`);
  }
  return res.json();
}

async function retireOldKey(adminApiUrl, adminToken, oldKeyId) {
  const res = await fetch(adminApiUrl.replace("/add", "/update-status"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ keyId: oldKeyId, status: "retired" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to retire key: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  const argv = require("minimist")(process.argv.slice(2));
  const { newKeyArn, newKeyId, oldKeyId, adminApiUrl, adminToken } = argv;
  if (!newKeyArn || !newKeyId || !adminApiUrl || !adminToken) {
    console.error("Usage: node rotate_kms_key.js --newKeyArn=... --newKeyId=v2 --oldKeyId=v1 --adminApiUrl=https://... --adminToken=...");
    process.exit(2);
  }

  console.log("Fetching public key from KMS:", newKeyArn);
  const pub = await getPublicKey(newKeyArn);
  const pubBase58 = bs58.encode(pub);

  console.log("Publishing new public key to admin API");
  await publishPublicKey(adminApiUrl, adminToken, newKeyId, pubBase58, "active");

  if (oldKeyId) {
    console.log("Retiring old key:", oldKeyId);
    await retireOldKey(adminApiUrl, adminToken, oldKeyId);
  }

  console.log("Rotation complete. New keyId:", newKeyId);
}

main().catch((err) => {
  console.error("Rotation failed:", err && err.message ? err.message : err);
  process.exit(1);
});
