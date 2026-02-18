#!/usr/bin/env node
/**
 * Fuego Wallet Unlock
 * Prompts for password and decrypts the wallet
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argon2 = require('argon2');
const bs58 = require('bs58').default;
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function tryDecrypt(password) {
  const keychainPath = path.join(process.env.HOME, '.fuego', 'keychain', 'id.json');
  const keychain = JSON.parse(fs.readFileSync(keychainPath, 'utf8'));
  
  const salt = Buffer.from(keychain.salt, 'base64');
  
  const key = await argon2.hash(password, {
    salt,
    raw: true,
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32
  });
  
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
}

async function main() {
  console.log('🔥 Fuego Wallet Unlock\n');
  
  const keychainPath = path.join(process.env.HOME, '.fuego', 'keychain', 'id.json');
  if (!fs.existsSync(keychainPath)) {
    console.log('❌ No wallet found at ~/.fuego/keychain/id.json');
    rl.close();
    process.exit(1);
  }
  
  const configPath = path.join(process.env.HOME, '.fuego', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(`Wallet: ${config.walletAddress}\n`);
  
  try {
    const password = await prompt('Enter password (WILL BE VISIBLE): ');
    console.log('\nAttempting decryption...\n');
    
    const privateKey = await tryDecrypt(password);
    const b58key = bs58.encode(privateKey);
    
    console.log('✅ Password correct!');
    console.log(`\nPrivate key (base58): ${b58key}`);
    console.log(`\n🔑 To use this wallet, run:`);
    console.log(`export FUEGO_KEYPAIR_BASE58='${b58key}'`);
    
  } catch (e) {
    console.log('❌ Incorrect password.');
    console.log('\nTip: The password is case-sensitive.');
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
