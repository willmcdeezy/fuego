#!/usr/bin/env node
/**
 * Jupiter Ultra Swap Script
 * Gets order, signs transaction with @solana/kit, and submits to Fuego endpoint
 * 
 * Usage:
 *   node jupiter_swap.mjs --input USDC --output SOL --amount 10
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  createKeyPairFromPrivateKeyBytes,
  createSignerFromKeyPair
} from '@solana/kit';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
const WALLET_INFO_PATH = join(homedir(), '.fuego', 'wallet-config.json');
const WALLET_PATH = join(homedir(), '.fuego', 'wallet.json');
const JUPITER_ULTRA_ORDER_URL = 'https://api.jup.ag/ultra/v1/order';

// Fuego server endpoint
const FUEGO_SERVER_URL = 'http://127.0.0.1:8080';

// Token mint addresses
const TOKEN_MINTS = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
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

function loadWalletKeypair() {
  try {
    const wallet = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
    const keypairBytes = new Uint8Array(wallet.privateKey);
    const privateKeyBytes = keypairBytes.slice(0, 32);
    return privateKeyBytes; // Return raw bytes, create keypair async later
  } catch (err) {
    console.error('❌ Failed to load wallet keypair:', err.message);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    inputMint: TOKEN_MINTS['USDC'],
    outputMint: TOKEN_MINTS['SOL'],
    amount: '10000000',
    slippageBps: '50'
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
        if (params.inputMint === TOKEN_MINTS['USDC'] || params.inputMint === TOKEN_MINTS['USDT']) {
          params.amount = (parseFloat(value) * 1000000).toString();
        } else if (params.inputMint === TOKEN_MINTS['SOL']) {
          params.amount = (parseFloat(value) * 1000000000).toString();
        } else {
          params.amount = value;
        }
        break;
      case '--slippage':
        params.slippageBps = (parseFloat(value) * 100).toString();
        break;
    }
  }
  
  return params;
}

function formatAmount(mint, amount) {
  if (mint === TOKEN_MINTS['SOL']) {
    return `${(parseInt(amount) / 1000000000).toFixed(6)} SOL`;
  } else if (mint === TOKEN_MINTS['USDC'] || mint === TOKEN_MINTS['USDT']) {
    return `${(parseInt(amount) / 1000000).toFixed(6)} USDC`;
  }
  return amount;
}

async function fetchUltraOrder(apiKey, taker, params) {
  const queryString = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps,
    taker: taker
  }).toString();
  
  const url = `${JUPITER_ULTRA_ORDER_URL}?${queryString}`;
  console.log(`📡 Fetching order: ${url}\n`);
  
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

async function signTransactionWithKit(base64Tx, privateKeyBytes) {
  console.log('\n🔑 Signing transaction with @solana/kit...');
  
  // Create keypair from private key bytes (returns a Promise)
  const keypair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);
  console.log('   Keypair created');
  
  // Create signer from keypair
  const signer = await createSignerFromKeyPair(keypair);
  console.log(`   Signer: ${signer.address}`);
  
  // Decode base64 transaction to bytes using Node Buffer
  const wireTxBytes = Buffer.from(base64Tx, 'base64');
  console.log(`   Transaction bytes: ${wireTxBytes.length}`);
  
  // Sign using the signer's signMessages method
  const signatures = await signer.signMessages([new Uint8Array(wireTxBytes)]);
  const signature = signatures[0];
  console.log(`   Signature created`);
  
  // Construct the signed transaction:
  // Format: [num_signatures (1 byte)] [signature (64 bytes)] [message (rest)]
  const signedTxBytes = new Uint8Array(1 + 64 + wireTxBytes.length);
  signedTxBytes[0] = 1; // Number of signatures
  signedTxBytes.set(signature, 1);
  signedTxBytes.set(new Uint8Array(wireTxBytes), 65);
  
  // Encode back to base64 using Node Buffer
  const signedBase64 = Buffer.from(signedTxBytes).toString('base64');
  
  console.log('✓ Transaction signed and serialized');
  return signedBase64;
}

async function submitToFuego(signedBase64Tx, network) {
  console.log('\n📤 Submitting to Fuego versioned transaction endpoint...');
  
  const response = await fetch(`${FUEGO_SERVER_URL}/submit-versioned-transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transaction: signedBase64Tx,
      network: network
    })
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Fuego submission failed: ${result.error}`);
  }
  
  return result.data;
}

async function main() {
  console.log('🪐 Jupiter Ultra Swap\n');
  
  const config = loadConfig();
  const taker = loadWalletAddress();
  const keypair = loadWalletKeypair();
  const params = parseArgs();
  
  console.log(`📊 Swap Details:`);
  console.log(`   Taker: ${taker}`);
  console.log(`   Input: ${params.inputMint === TOKEN_MINTS['USDC'] ? 'USDC' : params.inputMint}`);
  console.log(`   Output: ${params.outputMint === TOKEN_MINTS['SOL'] ? 'SOL' : params.outputMint}`);
  console.log(`   Amount: ${formatAmount(params.inputMint, params.amount)}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%\n`);
  
  try {
    // Step 1: Fetch order from Jupiter Ultra
    console.log('📥 Step 1: Fetching order from Jupiter Ultra...');
    const order = await fetchUltraOrder(config.jupiterKey, taker, params);
    
    console.log(`✓ Order received`);
    console.log(`   Input: ${formatAmount(order.inputMint, order.inAmount)}`);
    console.log(`   Output: ${formatAmount(order.outputMint, order.outAmount)}`);
    console.log(`   USD Value: $${parseFloat(order.swapUsdValue).toFixed(4)}`);
    console.log(`   Request ID: ${order.requestId}`);
    
    if (!order.transaction) {
      throw new Error('No transaction in order response');
    }
    
    console.log(`   Transaction: Present (${order.transaction.length} chars)\n`);
    
    // Step 2: Sign the transaction
    const signedTx = await signTransactionWithKit(order.transaction, keypair);
    
    // Step 3: Submit to Fuego
    console.log('\n🚀 Step 3: Submitting to Fuego...');
    const network = config.netowrk || 'mainnet-beta';
    const result = await submitToFuego(signedTx, network);
    
    console.log('\n✅ Swap submitted successfully!');
    console.log(`🔗 Signature: ${result.signature}`);
    console.log(`🌐 Explorer: ${result.explorer_link}`);
    
  } catch (err) {
    console.error('\n❌ Swap failed:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }
}

main();
