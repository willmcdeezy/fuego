#!/usr/bin/env node
/**
 * Fuego Wallet Setup - Simple version
 */

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');
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

async function main() {
  console.log('🔥 Fuego Wallet Setup\n');
  console.log('⚠️  NOTE: Password will be visible when typing (terminal limitation)\n');
  
  // Check if wallet already exists
  const fuegoDir = path.join(process.env.HOME, '.fuego');
  if (fs.existsSync(fuegoDir)) {
    console.log('❌ ~/.fuego already exists!');
    console.log('   If you want to replace it, run: rm -rf ~/.fuego');
    rl.close();
    process.exit(1);
  }
  
  // Generate keypair
  console.log('Generating new Solana keypair...');
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toString();
  console.log(`✅ Address: ${address}\n`);
  
  // Save backup
  const backupPath = path.join(process.env.HOME, 'fuego-wallet-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(Array.from(keypair.secretKey)));
  console.log(`💾 Backup saved to: ${backupPath}`);
  console.log('   (Keep this safe - it\'s your recovery key)\n');
  
  // Create fuego directory structure
  fs.mkdirSync(path.join(fuegoDir, 'keychain'), { recursive: true });
  fs.mkdirSync(path.join(fuegoDir, 'logs'), { recursive: true });
  
  // Get password (visible for now due to terminal limitations)
  const password = await prompt('🔐 Create encryption password (WILL BE VISIBLE): ');
  const confirm = await prompt('🔐 Confirm password: ');
  
  if (password !== confirm) {
    console.log('\n❌ Passwords do not match');
    rl.close();
    process.exit(1);
  }
  
  if (password.length < 4) {
    console.log('\n❌ Password must be at least 4 characters');
    rl.close();
    process.exit(1);
  }
  
  console.log('\n🔐 Encrypting wallet...');
  
  // Import crypto functions
  const crypto = require('crypto');
  const argon2 = require('argon2');
  
  // Generate salt
  const salt = crypto.randomBytes(16);
  
  // Derive key with Argon2 (raw: true for deterministic output)
  const key = await argon2.hash(password, {
    salt,
    raw: true,
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32
  });
  
  // Encrypt keypair
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(keypair.secretKey)), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Save encrypted keychain
  const keychain = {
    encrypted: {
      nonce: Buffer.concat([iv, tag]).toString('base64'),
      ciphertext: encrypted.toString('base64'),
      algorithm: 'AES-256-GCM'
    },
    salt: salt.toString('base64')
  };
  fs.writeFileSync(path.join(fuegoDir, 'keychain', 'id.json'), JSON.stringify(keychain, null, 2));
  
  // Save config
  const config = {
    walletAddress: address,
    network: 'mainnet-beta',
    createdAt: Date.now(),
    version: '0.1.0'
  };
  fs.writeFileSync(path.join(fuegoDir, 'config.json'), JSON.stringify(config, null, 2));
  
  // Set permissions
  fs.chmodSync(path.join(fuegoDir, 'keychain', 'id.json'), 0o600);
  fs.chmodSync(path.join(fuegoDir, 'config.json'), 0o600);
  
  console.log('\n✅ Fuego wallet initialized!');
  console.log(`   Address: ${address}`);
  console.log(`   Config:  ~/.fuego/config.json`);
  console.log(`   Keys:    ~/.fuego/keychain/id.json (encrypted)`);
  console.log(`   Backup:  ${backupPath}`);
  console.log('\n🚀 Next steps:');
  console.log('   1. Ask your agent to start the Fuego server (or run: cd server && cargo run)');
  console.log('   2. Ask your agent to open the Fuego dashboard');
  console.log('   3. Your agent can check balances, send transfers, and more!');
  console.log('\n💡 Pro tip: Your agent can do all of this for you — just ask!');
  
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
