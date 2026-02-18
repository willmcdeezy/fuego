// decrypt_wallet.js - Try every possible password variation
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argon2 = require('argon2');
const bs58 = require('bs58');

async function tryDecrypt(password) {
  const keychainPath = path.join(process.env.HOME, '.fuego', 'keychain', 'id.json');
  const keychain = JSON.parse(fs.readFileSync(keychainPath, 'utf8'));
  
  try {
    const salt = Buffer.from(keychain.salt, 'base64');
    
    const hashOptions = {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      salt: salt,
      raw: true,
      hashLength: 32
    };
    
    const rawHash = await argon2.hash(password, hashOptions);
    const key = rawHash;
    
    const encrypted = keychain.encrypted;
    const nonceFull = Buffer.from(encrypted.nonce, 'base64');
    const iv = nonceFull.slice(0, 12);
    const tag = nonceFull.slice(12);
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    const privateKey = decrypted.slice(0, 32);
    const b58key = bs58.encode(privateKey);
    
    console.log(`✅ SUCCESS with password: "${password}"`);
    console.log('   Private key (base58):', b58key);
    console.log("\n   export FUEGO_KEYPAIR_BASE58='" + b58key + "'");
    return true;
    
  } catch (e) {
    return false;
  }
}

async function main() {
  const basePassword = "CriticalMewTwo22!";
  
  // Generate variations
  const variations = [
    basePassword,
    basePassword + " ",
    basePassword + "\n",
    " " + basePassword,
    basePassword.toLowerCase(),
    basePassword.toUpperCase(),
    "CriticalMewTwo22",
    "criticalmewtwo22!",
    "CriticalMewTwo22!!",
    "CriticalMewTwo22!!!",
    "criticalmewtwo22",
    "CriticalMewtwo22!",
    "criticalMewTwo22!",
    "criticalMewtwo22!",
  ];
  
  console.log('Testing', variations.length, 'password variations...\n');
  
  for (const pwd of variations) {
    process.stdout.write(`Trying: "${pwd}" ... `);
    if (await tryDecrypt(pwd)) {
      return;
    } else {
      console.log('failed');
    }
  }
  
  console.log('\n❌ All variations failed');
  console.log('\nThe password is definitely not "CriticalMewTwo22!" or any obvious variant.');
}

main();
