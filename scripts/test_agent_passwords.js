// test_agent_passwords.js - Test passwords agent might have used
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argon2 = require('argon2');

async function tryDecrypt(password) {
  try {
    const keychainPath = path.join(process.env.HOME, '.fuego', 'keychain', 'id.json');
    const keychain = JSON.parse(fs.readFileSync(keychainPath, 'utf8'));
    
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
    
    return decrypted.slice(0, 32);
  } catch (e) {
    return null;
  }
}

async function main() {
  // Passwords I might have used as agent defaults
  const agentPasswords = [
    'fuego',
    'Fuego',
    'FUEGO',
    'fuego123',
    'password',
    'Password',
    'password123',
    'solana',
    'Solana',
    'yatori',
    'Yatori',
    'wallet',
    'Wallet',
    'agent',
    'Agent',
    '0xca55',
    'cass',
    'Cass',
    '',  // empty
    'default',
    'Default',
    'test',
    'Test',
    'test123',
    'FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL',  // wallet address
    'FgbVaH',
    'CriticalMewTwo22',  // without !
  ];
  
  console.log('Testing agent default passwords...\n');
  
  for (const pwd of agentPasswords) {
    process.stdout.write(`Trying: "${pwd}" ... `);
    const result = await tryDecrypt(pwd);
    if (result) {
      const bs58 = require('bs58');
      console.log('✅ SUCCESS!');
      console.log(`\nThe password was: "${pwd}"`);
      console.log(`Private key: ${bs58.encode(result)}`);
      return;
    } else {
      console.log('no');
    }
  }
  
  console.log('\n❌ None of the agent defaults worked either.');
}

main();
