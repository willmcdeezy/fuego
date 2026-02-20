#!/usr/bin/env node
/**
 * Use the working x402_faremeter.ts to get Jupiter data, then submit to Fuego server
 * This leverages @faremeter/rides which handles x402 properly
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const FUEGO_SERVER_URL = 'http://127.0.0.1:8080';

async function loadFuegoWallet() {
  const walletPath = path.join(process.env.HOME || '', '.fuego', 'wallet.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  return {
    address: walletData.address
  };
}

async function callJupiterViaFareMeter() {
  console.log('🪙 Calling Jupiter via x402_faremeter.ts (handles payment automatically)...');
  
  const { address } = await loadFuegoWallet();
  
  // Build the Jupiter URL with our taker address
  const jupiterUrl = `https://jupiter.api.corbits.dev/ultra/v1/order`;
  const params = `inputMint=So11111111111111111111111111111111111111112,outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,amount=20000000,taker=${address},slippageBps=50`;
  
  const command = `npm run x402 -- --url ${jupiterUrl} --method GET --params ${params}`;
  
  console.log('📡 Running:', command);
  console.log('🎯 Our address as taker:', address);
  
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: '/home/gasper/.openclaw/workspace/fuego' });
    
    if (stderr) {
      console.log('📋 Stderr output:', stderr);
    }
    
    console.log('📤 Raw output:');
    console.log(stdout);
    
    // Parse the JSON output (it's a multi-line JSON at the end)
    const lines = stdout.split('\n');
    
    // Find the start of the final JSON response
    let jsonStartIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === '}') {
        // Found end of JSON, now find the start
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
      throw new Error('No JSON response found in output');
    }
    
    // Extract JSON lines and join them
    const jsonLines = lines.slice(jsonStartIndex);
    const jsonText = jsonLines.join('\n');
    
    const result = JSON.parse(jsonText);
    
    if (!result.success) {
      throw new Error(`x402 failed: ${result.error}`);
    }
    
    console.log('\\n🎉 x402 SUCCESS!');
    console.log('📊 Jupiter response received via automated payment');
    
    return result.data;
    
  } catch (error) {
    console.error('❌ x402_faremeter.ts failed:', error.message);
    throw error;
  }
}

async function extractAndSubmitTransaction(jupiterData) {
  console.log('\\n🔍 Analyzing Jupiter response...');
  
  // Check if Jupiter returned a transaction
  if (!jupiterData.transaction) {
    console.log('⚠️ No transaction field in Jupiter response');
    console.log('💡 Jupiter response structure:', Object.keys(jupiterData));
    console.log('🤔 This might be a quote response, not an executable transaction');
    
    // Show what we got instead
    if (jupiterData.routePlan) {
      console.log(`💱 Quote received: ${jupiterData.inAmount} → ${jupiterData.outAmount}`);
      console.log(`🎯 Taker: ${jupiterData.taker || 'not specified'}`);
      console.log(`💸 Price impact: ${jupiterData.priceImpactPct}%`);
    }
    
    return null;
  }
  
  console.log('✅ Found transaction in Jupiter response');
  console.log(`🎯 Taker: ${jupiterData.taker}`);
  console.log(`📋 Transaction length: ${jupiterData.transaction.length} chars`);
  
  // Submit to Fuego server
  const requestBody = {
    network: 'mainnet-beta',
    transaction: jupiterData.transaction,
    commitment: 'confirmed'
  };
  
  console.log('🚀 Submitting to Fuego server...');
  
  const response = await fetch(`${FUEGO_SERVER_URL}/submit-versioned-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('🎉 SUCCESS! Transaction submitted via Fuego server');
    console.log(`📋 Signature: ${result.data.signature}`);
    console.log(`🔍 Explorer: ${result.data.explorer_link}`);
    return result.data;
  } else {
    console.error('❌ Fuego submission failed:', result.error);
    return null;
  }
}

async function main() {
  try {
    console.log('🔥 Jupiter via x402_faremeter → Fuego Server');
    console.log('=' + '='.repeat(55));
    console.log('💡 Strategy: Use working @faremeter/rides + extract transaction');
    
    // Step 1: Use working x402 flow to get Jupiter data
    const jupiterData = await callJupiterViaFareMeter();
    
    // Step 2: Extract transaction and submit to Fuego server
    // const result = await extractAndSubmitTransaction(jupiterData);
    
    // if (result) {
    //   console.log('\\n🎯 PIPELINE SUCCESS!');
    //   console.log('✅ Used @faremeter/rides for x402 payment');
    //   console.log('✅ Got Jupiter response');
    //   console.log('✅ Submitted transaction via Fuego server');
    //   console.log(`\\n🎊 Final signature: ${result.signature}`);
      
    // } else {
    //   console.log('\\n⚠️ Got Jupiter data but no executable transaction found');
    //   console.log('💡 You may need to use Jupiter\'s /v6/swap endpoint for executable transactions');
    // }
    
  } catch (error) {
    console.error('\\n💥 Pipeline Error:', error.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}