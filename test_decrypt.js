// test_decrypt.js - Use Fuego's own crypto to decrypt wallet
const fs = require('fs');
const path = require('path');

async function decryptWallet(password) {
  const keychainPath = path.join(process.env.HOME, '.fuego', 'keychain', 'id.json');
  
  if (!fs.existsSync(keychainPath)) {
    console.log('❌ Wallet not found');
    return;
  }
  
  const keychain = JSON.parse(fs.readFileSync(keychainPath, 'utf8'));
  
  try {
    // Dynamically import the crypto module (ES modules)
    const { deriveKeyFromPassword, decryptData } = await import('./src/crypto.ts');
    
    const salt = Buffer.from(keychain.salt, 'base64');
    const key = await deriveKeyFromPassword(password, salt);
    
    const decrypted = decryptData(keychain.encrypted, key);
    
    // Success!
    const privateKey = decrypted.slice(0, 32);
    
    // Get base58 encoding
    const bs58 = await import('bs58');
    const b58key = bs58.default.encode(privateKey);
    
    console.log('✅ Password correct!');
    console.log('   Private key (base58):', b58key);
    console.log('   Export command:');
    console.log("   export FUEGO_KEYPAIR_BASE58='" + b58key + "'");
    
  } catch (e) {
    console.log('❌ Decryption failed:', e.message);
  }
}

const password = process.argv[2] || 'CriticalMewTwo22!';
console.log('Testing password:', password, '\n');
decryptWallet(password);
