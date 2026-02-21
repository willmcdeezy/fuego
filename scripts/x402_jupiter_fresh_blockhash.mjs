#!/usr/bin/env node
/**
 * Jupiter via x402 with fresh blockhash replacement
 * 1. Call x402_faremeter.ts to get Jupiter transaction (handles payment)
 * 2. Extract transaction from response
 * 3. Get fresh blockhash from Fuego server
 * 4. Deserialize, replace blockhash, re-sign
 * 5. Submit to submit-versioned-transaction endpoint
 * 
 * Usage:
 *   node scripts/x402_jupiter_fresh_blockhash.mjs \
 *     --input So11111111111111111111111111111111111111112 \
 *     --output EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
 *     --amount 20000000 \
 *     --slippage 50
 */

import { VersionedTransaction, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const FUEGO_SERVER_URL = 'http://127.0.0.1:8080';

// Common token mints for convenience
const TOKEN_MINTS = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    input: 'SOL',           // Default: SOL
    output: 'USDC',         // Default: USDC  
    amount: '20000000',     // Default: 0.02 SOL (in lamports)
    slippage: '50'          // Default: 50 bps (0.5%)
  };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    
    if (key && value !== undefined && key in parsed) {
      parsed[key] = value;
    }
  }
  
  // Resolve convenience symbols to mints
  parsed.inputMint = TOKEN_MINTS[parsed.input.toUpperCase()] || parsed.input;
  parsed.outputMint = TOKEN_MINTS[parsed.output.toUpperCase()] || parsed.output;
  
  return parsed;
}

function showHelp() {
  console.log(`
🔥 Fuego Jupiter x402 Swap CLI

Execute Jupiter swaps via x402 payment + fresh blockhash replacement.

Usage:
  node scripts/x402_jupiter_fresh_blockhash.mjs [options]

Options:
  --input MINT     Input token mint (or symbol: SOL, USDC, USDT, BONK, JUP, WIF)
                   [default: SOL]
  --output MINT    Output token mint (or symbol)
                   [default: USDC]
  --amount LAMPORTS Amount in lamports (smallest unit)
                   [default: 20000000 = 0.02 SOL]
  --slippage BPS   Slippage tolerance in basis points
                   [default: 50 = 0.5%]

Examples:
  # Default: Swap 0.02 SOL → USDC
  node scripts/x402_jupiter_fresh_blockhash.mjs

  # Swap 1 USDC → SOL
  node scripts/x402_jupiter_fresh_blockhash.mjs \
    --input USDC --output SOL --amount 1000000

  # Swap SOL → BONK with custom slippage
  node scripts/x402_jupiter_fresh_blockhash.mjs \
    --output BONK --amount 100000000 --slippage 100

  # Use raw mint addresses
  node scripts/x402_jupiter_fresh_blockhash.mjs \
    --input So11111111111111111111111111111111111111112 \
    --output EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
    --amount 50000000

Token Symbols:
  SOL, USDC, USDT, BONK, JUP, WIF
`);
}

async function loadFuegoWallet() {
  const walletPath = path.join(process.env.HOME || '', '.fuego', 'wallet.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const privateKeyBytes = new Uint8Array(walletData.privateKey);
  return {
    keypair: Keypair.fromSecretKey(privateKeyBytes),
    address: walletData.address
  };
}

async function callJupiterViaFareMeter(params) {
  console.log('🪙 Step 1: Calling Jupiter via x402_faremeter.ts...');
  
  const { address } = await loadFuegoWallet();
  
  // Dynamically import the TypeScript module
  const faremeterPath = path.join(process.cwd(), 'scripts', 'x402_faremeter.ts');
  const { makeX402Request } = await import(faremeterPath);
  
  const jupiterUrl = `https://jupiter.api.corbits.dev/ultra/v1/order?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&taker=${address}&slippageBps=${params.slippage}`;
  
  console.log('💱 Swap:', params.input, '→', params.output);
  console.log('📊 Amount:', params.amount, 'lamports');
  console.log('🎯 Slippage:', params.slippage, 'bps');
  console.log('👛 Taker:', address);
  
  const result = await makeX402Request({
    url: jupiterUrl,
    method: 'GET'
  });
  
  if (!result.success) {
    throw new Error(`x402 failed: ${result.error}`);
  }
  
  console.log('✅ x402 payment completed successfully');
  return result.data;
}

async function getFreshBlockhash() {
  console.log('\n🔄 Step 3: Getting fresh blockhash from Fuego server...');
  
  const response = await fetch(`${FUEGO_SERVER_URL}/latest-hash`, {
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

async function extractAndRefreshTransaction(jupiterData) {
  console.log('\n🔍 Step 2: Extracting transaction from Jupiter response...');
  
  // Check if Jupiter returned a transaction
  if (!jupiterData.transaction) {
    console.log('⚠️ No transaction field in Jupiter response');
    console.log('Available fields:', Object.keys(jupiterData));
    
    if (jupiterData.routePlan) {
      console.log(`\n💱 Quote only: ${jupiterData.inAmount} → ${jupiterData.outAmount}`);
      console.log(`🎯 Taker: ${jupiterData.taker || 'not specified'}`);
    }
    
    throw new Error('No executable transaction in Jupiter response');
  }
  
  console.log('✅ Found transaction in Jupiter response');
  console.log(`🎯 Taker: ${jupiterData.taker}`);
  console.log(`📋 Transaction length: ${jupiterData.transaction.length} chars`);
  
  // Step 3 & 4: Get fresh blockhash and refresh transaction
  const { keypair } = await loadFuegoWallet();
  console.log(`🔑 Wallet: ${keypair.publicKey.toString()}`);
  
  // Deserialize Jupiter transaction
  const transactionBuffer = Buffer.from(jupiterData.transaction, 'base64');
  const versionedTx = VersionedTransaction.deserialize(transactionBuffer);
  
  console.log(`\n📋 Original transaction:`);
  console.log(`  🔢 Version: ${versionedTx.version}`);
  console.log(`  📝 Instructions: ${versionedTx.message.compiledInstructions.length}`);
  console.log(`  🔒 Old blockhash: ${versionedTx.message.recentBlockhash}`);
  
  // Get fresh blockhash
  const freshBlockhash = await getFreshBlockhash();
  
  // Replace blockhash in the message
  versionedTx.message.recentBlockhash = freshBlockhash;
  console.log(`🔄 Blockhash updated to: ${freshBlockhash}`);
  
  // Re-sign with fresh blockhash
  console.log('✍️ Step 4: Re-signing with fresh blockhash...');
  versionedTx.sign([keypair]);
  console.log('✅ Transaction re-signed successfully');
  
  // Serialize for submission
  const signedBuffer = Buffer.from(versionedTx.serialize());
  const signedBase64 = signedBuffer.toString('base64');
  
  return signedBase64;
}

async function submitToFuego(signedTransaction) {
  console.log('\n🚀 Step 5: Submitting to Fuego server...');
  
  const response = await fetch(`${FUEGO_SERVER_URL}/submit-versioned-transaction`, {
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
    console.log('🎉 SUCCESS! Transaction submitted!');
    console.log(`📋 Signature: ${result.data.signature}`);
    console.log(`🔍 Explorer: ${result.data.explorer_link}`);
    return result.data;
  } else {
    console.error('❌ Fuego submission failed:', result.error);
    throw new Error(result.error);
  }
}

async function main() {
  const args = parseArgs();
  
  // Show help if requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  console.log('🔥 Jupiter + x402 + Fresh Blockhash Pipeline');
  console.log('=' .repeat(55));
  console.log('📋 Flow: x402 payment → extract tx → fresh blockhash → re-sign → submit\n');
  
  try {
    // Step 1: Get Jupiter data via x402 (payment handled automatically)
    const jupiterData = await callJupiterViaFareMeter(args);
    
    // Steps 2-4: Extract transaction, get fresh blockhash, re-sign
    const signedTransaction = await extractAndRefreshTransaction(jupiterData);
    
    // Step 5: Submit to Fuego
    const result = await submitToFuego(signedTransaction);
    
    console.log('\n' + '='.repeat(55));
    console.log('✨ PIPELINE COMPLETE!');
    console.log('✅ x402 payment handled by @faremeter/rides');
    console.log('✅ Jupiter transaction received');
    console.log('✅ Fresh blockhash applied');
    console.log('✅ Transaction re-signed');
    console.log('✅ Submitted via Fuego server');
    console.log(`\n🎊 Final signature: ${result.signature}`);
    
  } catch (error) {
    console.error('\n💥 Pipeline Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
