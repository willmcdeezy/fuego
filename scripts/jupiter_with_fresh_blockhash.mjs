#!/usr/bin/env node
/**
 * Jupiter transaction with automatic fresh blockhash replacement
 * 1. Deserialize Jupiter transaction
 * 2. Get fresh blockhash from Fuego server
 * 3. Replace stale blockhash 
 * 4. Re-sign with our keypair
 * 5. Submit to submit-versioned-transaction endpoint
 */

import { VersionedTransaction, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Fresh Jupiter transaction
const jupiterTransaction = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQADCL2iuhAscuaJzKXUGSWaZ2PLFlIz5xNwSzXRLFQW+dJyqwhXQWlESSsQL8yPmQFFEgStGaL3QK0wOMBYCtDZ1wnCs0z8+bCpHkjme8G8EDSqbxLp9dX4yr5BYNeVcA6vnuZjA2zCKeSbZo3W1o10aWNxJxZ0M2YtkHrJUiv4RvG2DILcM4+sosBeGQm2NSzvyB/7No/2E9/8nZGcxPGD3uADBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAALXjShTivHNIaQ7h9a9d7tZVOECjbaq4YLBQYHO9wDwQCvHDQyGIyjpjUTWhOhiVGs69KeasLu04+R5t0bI7PFd0VrdxvMjsIcBBOSD+VeaJn861qLUDVP4uI+nQ5tnG5QQFAAUCJzMEAAUACQMMXAAAAAAAAAYGAAEZGxQSEC8+m6yDzSXJAC0xAQAAAAAGKRsUEgATBhocBgYBBAAHChgICQECFhkMGAAbGxUYCx0RDg0QDwIDABoXmQH4xp6R4XWHyAYAAAAl+SeA66u6ZOz6e5fimHC+8EcqUWp1teyc6r+hPviac4ORzv9alptoua5FPHmAsaS9+4uZMf8YYzc1wFypyp4qC0X97BcAAAAAkwAAACOgDwAAAAAAADACAAAATgnr7gUAAABB1hcAAAAAAC0EYB0xAQAAAAABAxqVddw+BgAAAAFsFxkAAAAAADIAAAADpYT8M/1YgEevM7B7IxKo7BojNrNZru8plWwhku8NV3UADAAMCE5pYzliAgYHQ8ZrN7zScGbYj4aXxkTOe0LpE1UTmbfdTHSJjI38lYzaBQYDBAgAANlYfJnalbBDq966ctxcomz1Wtw06ED+xiIbIeRhtOjgBXp9e4KBAA==";

const FUEGO_SERVER = 'http://127.0.0.1:8080';

async function loadFuegoWallet() {
  const walletPath = path.join(process.env.HOME || '', '.fuego', 'wallet.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const privateKeyBytes = new Uint8Array(walletData.privateKey);
  return Keypair.fromSecretKey(privateKeyBytes);
}

async function getFreshBlockhash() {
  console.log('🔄 Getting fresh blockhash from Fuego server...');
  
  const response = await fetch(`${FUEGO_SERVER}/latest-hash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ network: 'mainnet-beta' })
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Failed to get blockhash: ${result.error}`);
  }
  
  console.log(`✅ Fresh blockhash: ${result.data.blockhash}`);
  return result.data.blockhash;
}

async function refreshBlockhashAndSign() {
  console.log('🔧 Processing Jupiter transaction with fresh blockhash...');
  
  // Step 1: Load keypair
  const keypair = await loadFuegoWallet();
  console.log(`🔑 Using wallet: ${keypair.publicKey.toString()}`);
  
  // Step 2: Deserialize Jupiter transaction
  const transactionBuffer = Buffer.from(jupiterTransaction, 'base64');
  const versionedTx = VersionedTransaction.deserialize(transactionBuffer);
  
  console.log(`📋 Original transaction:`);
  console.log(`  🔢 Version: ${versionedTx.version}`);
  console.log(`  📝 Instructions: ${versionedTx.message.compiledInstructions.length}`);
  console.log(`  🔒 Old blockhash: ${versionedTx.message.recentBlockhash}`);
  
  // Step 3: Get fresh blockhash
  const freshBlockhash = await getFreshBlockhash();
  
  // Step 4: Replace blockhash in the message
  versionedTx.message.recentBlockhash = freshBlockhash;
  console.log(`🔄 Blockhash updated: ${freshBlockhash}`);
  
  // Step 5: Re-sign with fresh blockhash
  console.log('✍️ Re-signing with fresh blockhash...');
  versionedTx.sign([keypair]);
  console.log('✅ Transaction re-signed successfully');
  
  // Step 6: Serialize for submission
  const signedBuffer = Buffer.from(versionedTx.serialize());
  const signedBase64 = signedBuffer.toString('base64');
  
  return signedBase64;
}

async function submitToVersionedEndpoint(signedTransaction) {
  console.log('\n🚀 Submitting to /submit-versioned-transaction...');
  
  const response = await fetch(`${FUEGO_SERVER}/submit-versioned-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      network: 'mainnet-beta',
      transaction: signedTransaction,
      commitment: 'confirmed'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('🎉 SUCCESS! Jupiter swap executed!');
    console.log(`📋 Signature: ${result.data.signature}`);
    console.log(`🔍 Explorer: ${result.data.explorer_link}`);
    return result.data;
  } else {
    console.log('❌ Failed to submit');
    console.log(`🔍 Error: ${result.error}`);
    throw new Error(result.error);
  }
}

async function main() {
  try {
    console.log('🔥 Jupiter with Fresh Blockhash Pipeline');
    console.log('=' + '='.repeat(50));
    
    // Process transaction with fresh blockhash
    const signedTransaction = await refreshBlockhashAndSign();
    
    // Submit to Fuego server
    const result = await submitToVersionedEndpoint(signedTransaction);
    
    console.log('\n✨ COMPLETE SUCCESS!');
    console.log('✅ Fresh blockhash replaced stale one');
    console.log('✅ Transaction re-signed successfully'); 
    console.log('✅ Submitted via Fuego versioned endpoint');
    console.log(`✅ Jupiter swap executed: ${result.signature}`);
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
  }
}

main();