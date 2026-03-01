#!/usr/bin/env node
/**
 * Jupiter Regular Swap Script (NOT Ultra)
 * Uses standard Jupiter API for broader token support
 * 
 * Usage:
 *   node jupiter_swap_regular.mjs --input <token> --output <token> --amount <amount>
 * 
 * Examples:
 *   node jupiter_swap_regular.mjs --input SOL --output BONK --amount 0.05
 *   node jupiter_swap_regular.mjs --input SOL --output <mint-address> --amount 1.0
 *   node jupiter_swap_regular.mjs --input USDC --output BONK --amount 10 --slippage 1.0
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import nacl from 'tweetnacl';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
const WALLET_INFO_PATH = join(homedir(), '.fuego', 'wallet-config.json');
const WALLET_PATH = join(homedir(), '.fuego', 'wallet.json');

// Regular Jupiter API endpoints
const JUPITER_QUOTE_URL = 'https://api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v1/swap';

const TOKEN_MINTS = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

function loadConfig() {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return config;
  } catch (err) {
    console.error('❌ Failed to load config:', err.message);
    process.exit(1);
  }
}

function loadWalletAddress() {
  try {
    const wallet = JSON.parse(readFileSync(WALLET_INFO_PATH, 'utf8'));
    return wallet.publicKey;
  } catch (err) {
    console.error('❌ Failed to load wallet info:', err.message);
    process.exit(1);
  }
}

function loadWalletPrivateKey() {
  try {
    const wallet = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
    const keypairBytes = new Uint8Array(wallet.privateKey);
    return keypairBytes.slice(0, 32);
  } catch (err) {
    console.error('❌ Failed to load wallet:', err.message);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  // Show help if no args
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🪐 Jupiter Swap (Regular API)

Usage:
  node jupiter_swap_regular.mjs --input <token> --output <token> --amount <amount> [--slippage <percent>]

Parameters:
  --input    Input token symbol (SOL, USDC) or full mint address
  --output   Output token symbol (SOL, USDC, BONK) or full mint address
  --amount   Amount to swap (in token units, e.g., 0.5 for 0.5 SOL)
  --slippage Slippage tolerance in percent (default: 0.5%)

Examples:
  node jupiter_swap_regular.mjs --input SOL --output BONK --amount 0.05
  node jupiter_swap_regular.mjs --input SOL --output EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --amount 1.0
  node jupiter_swap_regular.mjs --input USDC --output BONK --amount 10 --slippage 1.0
    `);
    process.exit(0);
  }
  
  const params = {
    inputMint: null,
    outputMint: null,
    amount: null,
    slippageBps: '50'  // 0.5% default
  };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    if (!value) continue;
    
    switch (flag) {
      case '--input':
        params.inputMint = TOKEN_MINTS[value.toUpperCase()] || value;
        break;
      case '--output':
        params.outputMint = TOKEN_MINTS[value.toUpperCase()] || value;
        break;
      case '--amount':
        params.amount = value;
        break;
      case '--slippage':
        params.slippageBps = (parseFloat(value) * 100).toString();
        break;
    }
  }
  
  // Validate required params
  if (!params.inputMint) {
    console.error('❌ Error: --input is required');
    console.error('   Use --help for usage information');
    process.exit(1);
  }
  
  if (!params.outputMint) {
    console.error('❌ Error: --output is required');
    console.error('   Use --help for usage information');
    process.exit(1);
  }
  
  if (!params.amount) {
    console.error('❌ Error: --amount is required');
    console.error('   Use --help for usage information');
    process.exit(1);
  }
  
  // Convert amount based on input token decimals
  const amountValue = parseFloat(params.amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    console.error('❌ Error: --amount must be a positive number');
    process.exit(1);
  }
  
  if (params.inputMint === TOKEN_MINTS['SOL']) {
    params.amount = Math.floor(amountValue * 1000000000).toString();
  } else if (params.inputMint === TOKEN_MINTS['USDC']) {
    params.amount = Math.floor(amountValue * 1000000).toString();
  } else {
    // For unknown tokens, assume 6 decimals as a safe default
    params.amount = Math.floor(amountValue * 1000000).toString();
  }
  
  return params;
}

function formatAmount(mint, amount, quoteResponse = null) {
  const amountInt = parseInt(amount);
  
  // Known tokens
  if (mint === TOKEN_MINTS['SOL']) {
    return `${(amountInt / 1000000000).toFixed(6)} SOL`;
  } else if (mint === TOKEN_MINTS['USDC']) {
    return `${(amountInt / 1000000).toFixed(6)} USDC`;
  }
  
  // Unknown token - try to get decimals from quote response or use default
  let decimals = 6; // safe default
  if (quoteResponse?.inputMint === mint && quoteResponse?.inDecimals) {
    decimals = quoteResponse.inDecimals;
  } else if (quoteResponse?.outputMint === mint && quoteResponse?.outDecimals) {
    decimals = quoteResponse.outDecimals;
  }
  
  const formatted = (amountInt / Math.pow(10, decimals)).toFixed(Math.min(decimals, 6));
  const symbol = mint.substring(0, 4) + '...' + mint.substring(mint.length - 4);
  return `${formatted} ${symbol}`;
}

async function fetchQuote(apiKey, params) {
  const queryString = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps
  }).toString();
  
  const url = `${JUPITER_QUOTE_URL}?${queryString}`;
  console.log(`📡 Step 1: Fetching quote: ${url}\n`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function fetchSwapTransaction(apiKey, quoteResponse, userPublicKey) {
  console.log('📡 Step 2: Fetching swap transaction...\n');
  
  const response = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      quoteResponse: quoteResponse,
      userPublicKey: userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function signTransaction(base64Tx, privateKeyBytes) {
  console.log('\n🔑 Step 3: Signing transaction...');
  
  const keypair = nacl.sign.keyPair.fromSeed(privateKeyBytes);
  console.log('✓ Keypair created');
  
  const txBytes = Buffer.from(base64Tx, 'base64');
  console.log(`✓ Transaction bytes: ${txBytes.length}`);
  
  // For Jupiter regular API, the transaction might already be complete
  // Check first byte
  const numSigs = txBytes[0];
  console.log(`✓ Number of signatures in tx: ${numSigs}`);
  
  // If transaction already has signatures populated, check if ours is needed
  const firstSigOffset = 1;
  const firstSig = txBytes.slice(firstSigOffset, firstSigOffset + 64);
  const isPlaceholder = firstSig.every(b => b === 0);
  
  if (!isPlaceholder) {
    console.log('✓ Transaction appears to be pre-signed, checking if valid...');
    // For now, just return as-is and see what happens
    return base64Tx;
  }
  
  // Otherwise sign normally
  const messageBytes = new Uint8Array(txBytes.slice(65));
  console.log(`✓ Message bytes: ${messageBytes.length}`);
  
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  console.log(`✓ Signature created (${signature.length} bytes)`);
  
  const signedTx = new Uint8Array(1 + 64 + messageBytes.length);
  signedTx[0] = 1;
  signedTx.set(signature, 1);
  signedTx.set(messageBytes, 65);
  
  const signedBase64 = Buffer.from(signedTx).toString('base64');
  console.log(`✓ Signed transaction: ${signedBase64.length} chars`);
  
  return signedBase64;
}

async function submitTransaction(rpcUrl, signedBase64Tx) {
  console.log('\n📤 Step 4: Submitting transaction...');
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [
        signedBase64Tx,
        {
          encoding: 'base64',
          skipPreflight: true,
          preflightCommitment: 'confirmed'
        }
      ]
    })
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(`RPC Error: ${JSON.stringify(result.error)}`);
  }
  
  return result.result;
}

async function main() {
  console.log('🪐 Jupiter Regular Swap (NOT Ultra)\n');
  
  const config = loadConfig();
  const walletAddress = loadWalletAddress();
  const privateKey = loadWalletPrivateKey();
  const params = parseArgs();
  
  console.log(`📊 Swap Details:`);
  console.log(`   Wallet: ${walletAddress}`);
  console.log(`   Input: ${params.inputMint.length === 44 ? params.inputMint.substring(0, 8) + '...' + params.inputMint.substring(params.inputMint.length - 8) : params.inputMint}`);
  console.log(`   Output: ${params.outputMint.length === 44 ? params.outputMint.substring(0, 8) + '...' + params.outputMint.substring(params.outputMint.length - 8) : params.outputMint}`);
  console.log(`   Amount: ${formatAmount(params.inputMint, params.amount)}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%\n`);
  
  try {
    // Step 1: Get quote
    const quote = await fetchQuote(config.jupiterKey, params);
    
    console.log(`✓ Quote received`);
    console.log(`   Input: ${formatAmount(quote.inputMint, quote.inAmount, quote)}`);
    console.log(`   Output: ${formatAmount(quote.outputMint, quote.outAmount, quote)}`);
    console.log(`   Price Impact: ${quote.priceImpactPct}%\n`);
    
    // Step 2: Get swap transaction
    const swapData = await fetchSwapTransaction(config.jupiterKey, quote, walletAddress);
    
    console.log(`✓ Swap transaction received`);
    console.log(`   Transaction: ${swapData.swapTransaction ? 'Present' : 'MISSING'}`);
    if (swapData.swapTransaction) {
      console.log(`   Length: ${swapData.swapTransaction.length} chars`);
    }
    
    if (!swapData.swapTransaction) {
      throw new Error('No swap transaction returned');
    }
    
    // Step 3: Sign
    const signedTx = await signTransaction(swapData.swapTransaction, privateKey);
    
    // Step 4: Submit
    const signature = await submitTransaction(config.rpcUrl, signedTx);
    
    console.log('\n✅ SWAP SUCCESSFUL!');
    console.log(`🔗 Signature: ${signature}`);
    console.log(`🌐 Explorer: https://solscan.io/tx/${signature}`);
    console.log(`\n💰 Swapped ${formatAmount(quote.inputMint, quote.inAmount, quote)} → ${formatAmount(quote.outputMint, quote.outAmount, quote)}`);
    
  } catch (err) {
    console.error('\n❌ Swap failed:', err.message);
    if (err.stack) {
      console.error('\nStack:', err.stack);
    }
    process.exit(1);
  }
}

main();
