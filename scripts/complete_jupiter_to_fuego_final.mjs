#!/usr/bin/env node
/**
 * COMPLETE Jupiter → Fuego Pipeline Test
 * 1. Get fresh Jupiter transaction via x402_faremeter.ts
 * 2. Extract transaction with fresh blockhash
 * 3. Sign it locally
 * 4. Submit to new /submit-versioned-transaction endpoint
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const VERSIONED_SERVER_URL = 'http://127.0.0.1:8080';

async function loadFuegoWallet() {
  const walletPath = path.join(process.env.HOME || '', '.fuego', 'wallet.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const privateKeyBytes = new Uint8Array(walletData.privateKey);
  return {
    keypair: Keypair.fromSecretKey(privateKeyBytes),
    address: walletData.address
  };
}

async function getFreshJupiterTransaction() {
  console.log('🪙 Getting fresh Jupiter transaction with current blockhash...');
  
  const { address } = await loadFuegoWallet();
  
  // Use x402_faremeter to get fresh Jupiter transaction
  const command = `npm run x402 -- --url https://jupiter.api.corbits.dev/ultra/v1/order --method GET --params inputMint=So11111111111111111111111111111111111111112,outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,amount=20000000,taker=${address},slippageBps=50`;
  
  console.log('📡 Executing x402_faremeter.ts...');
  
  const { stdout } = await execAsync(command, { cwd: '/home/gasper/.openclaw/workspace/fuego' });
  
  // Parse JSON response from x402_faremeter output
  const lines = stdout.split('\n');
  let jsonStartIndex = -1;
  
  // Find the last JSON block
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '}') {
      for (let j = i; j >= 0; j--) {
        if (lines[j].trim() === '{') {
          jsonStartIndex = j;
          break;
        }
      }
      break;
    }
  }
  
  if (jsonStartIndex === -1) {
    throw new Error('No JSON response found in x402_faremeter output');
  }
  
  const jsonLines = lines.slice(jsonStartIndex);
  const jsonText = jsonLines.join('\n');
  
  let braceCount = 0;
  let validJsonEnd = -1;
  
  for (let i = 0; i < jsonLines.length; i++) {
    for (const char of jsonLines[i]) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    if (braceCount === 0 && jsonLines[i].includes('}')) {
      validJsonEnd = i;
      break;
    }
  }
  
  const finalJsonText = jsonLines.slice(0, validJsonEnd + 1).join('\n');
  const result = JSON.parse(finalJsonText);
  
  if (!result.success) {
    throw new Error(`x402 failed: ${result.error}`);
  }
  
  console.log('✅ Got fresh Jupiter response');
  console.log(`🎯 Taker: ${result.data.taker}`);
  console.log(`💱 Swap: ${result.data.inAmount} SOL → ${result.data.outAmount} USDC`);
  console.log(`📋 Has transaction: ${!!result.data.transaction}`);
  
  return result.data;
}

async function signAndSubmitTransaction(jupiterData) {
  console.log('\n✍️ Signing transaction locally...');
  
  if (!jupiterData.transaction) {
    throw new Error('No transaction in Jupiter response');
  }
  
  const { keypair } = await loadFuegoWallet();
  
  // Deserialize VersionedTransaction
  const transactionBuffer = Buffer.from(jupiterData.transaction, 'base64');
  const versionedTx = VersionedTransaction.deserialize(transactionBuffer);
  
  console.log(`📋 Transaction details:`);
  console.log(`  🔢 Version: ${versionedTx.version}`);
  console.log(`  📝 Instructions: ${versionedTx.message.compiledInstructions.length}`);
  console.log(`  🎯 Signing with: ${keypair.publicKey.toString()}`);
  
  // Sign with our keypair
  versionedTx.sign([keypair]);
  
  console.log('✅ Transaction signed successfully');
  
  // Serialize signed transaction
  const signedBuffer = Buffer.from(versionedTx.serialize());
  const signedBase64 = signedBuffer.toString('base64');
  
  // Submit to our new versioned endpoint
  console.log('\n🚀 Submitting to /submit-versioned-transaction endpoint...');
  
  const requestBody = {
    network: 'mainnet-beta',
    transaction: signedBase64,
    commitment: 'confirmed'
  };
  
  const response = await fetch(`${VERSIONED_SERVER_URL}/submit-versioned-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  
  console.log(`📡 Response: ${response.status} ${response.statusText}`);
  
  if (result.success) {
    console.log('🎉 SUCCESS! Jupiter swap executed via Fuego versioned endpoint!');
    console.log(`📋 Signature: ${result.data.signature}`);
    console.log(`🔍 Explorer: ${result.data.explorer_link}`);
    console.log(`⚡ Transaction Type: ${result.data.transaction_type}`);
    return result.data;
  } else {
    console.log('❌ Submission failed');
    console.log('🔍 Error:', result.error);
    throw new Error(`Failed to submit: ${result.error}`);
  }
}

async function main() {
  try {
    console.log('🔥 COMPLETE Jupiter → Fuego Pipeline (Fresh Transaction)');
    console.log('=' + '='.repeat(65));
    console.log('🎯 Goal: Execute a real Jupiter swap via our new versioned endpoint');
    
    // Step 1: Get fresh Jupiter transaction via x402
    const jupiterData = await getFreshJupiterTransaction();
    
    // Step 2: Sign and submit via our new endpoint
    const result = await signAndSubmitTransaction(jupiterData);
    
    // Step 3: Success summary
    console.log('\n🎊 PIPELINE COMPLETE! 🎊');
    console.log('✅ Used x402_faremeter.ts for payment handling');
    console.log('✅ Got fresh Jupiter transaction with current blockhash');
    console.log('✅ Signed locally as the taker');
    console.log('✅ Submitted via new /submit-versioned-transaction endpoint');
    console.log('✅ Jupiter swap successfully executed on Solana');
    
    console.log('\n📚 FOR AGENTS/SKILLS:');
    console.log('🔧 For Jupiter swaps: Use http://127.0.0.1:8080/submit-versioned-transaction');
    console.log('🔧 For other transactions: Use http://127.0.0.1:8080/submit-transaction'); 
    console.log('🔧 This endpoint specifically handles VersionedTransaction format');
    
    console.log(`\n🎯 Final transaction signature: ${result.signature}`);
    
  } catch (error) {
    console.error('\n💥 Pipeline failed:', error.message);
    
    if (error.message.includes('Blockhash not found')) {
      console.log('\n💡 This suggests the transaction format is correct but blockhash expired');
      console.log('   The endpoint is working - this is just a timing issue');
    }
  }
}

main().catch(console.error);