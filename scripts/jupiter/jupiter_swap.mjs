#!/usr/bin/env node
/**
 * Jupiter Ultra Swap Script - FULL FLOW
 * Gets order, signs transaction, and submits
 * 
 * Usage:
 *   node jupiter_swap.mjs --input USDC --output SOL --amount 10
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import nacl from 'tweetnacl';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
const WALLET_INFO_PATH = join(homedir(), '.fuego', 'wallet-config.json');
const WALLET_PATH = join(homedir(), '.fuego', 'wallet.json');
const JUPITER_ULTRA_ORDER_URL = 'https://api.jup.ag/ultra/v1/order';

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

function loadWalletPrivateKey() {
  try {
    const wallet = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
    const keypairBytes = new Uint8Array(wallet.privateKey);
    // Return first 32 bytes (private key)
    return keypairBytes.slice(0, 32);
  } catch (err) {
    console.error('❌ Failed to load wallet:', err.message);
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
  // ALWAYS gasless=false for now
  const queryString = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps,
    taker: taker,
    gasless: 'false'
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

async function signTransaction(base64Tx, privateKeyBytes) {
  console.log('\n🔑 Signing transaction...');
  
  // Create keypair from private key using tweetnacl
  const keypair = nacl.sign.keyPair.fromSeed(privateKeyBytes);
  console.log('✓ Keypair created');
  
  // Decode transaction
  const txBytes = Buffer.from(base64Tx, 'base64');
  console.log(`✓ Transaction bytes: ${txBytes.length}`);
  
  // Extract message (after signature placeholder)
  // Format: [num_signatures (1 byte)] [signature (64 bytes)] [message]
  const messageBytes = new Uint8Array(txBytes.slice(65));
  console.log(`✓ Message bytes: ${messageBytes.length}`);
  
  // Sign the message with tweetnacl
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  console.log(`✓ Signature created (${signature.length} bytes)`);
  
  // Reconstruct signed transaction
  // [1 byte: num sigs = 1] [64 bytes: signature] [message]
  const signedTx = new Uint8Array(1 + 64 + messageBytes.length);
  signedTx[0] = 1; // Number of signatures
  signedTx.set(signature, 1);
  signedTx.set(messageBytes, 65);
  
  // Encode to base64
  const signedBase64 = Buffer.from(signedTx).toString('base64');
  console.log(`✓ Signed transaction: ${signedBase64.length} chars`);
  
  return signedBase64;
}

async function submitTransaction(rpcUrl, signedBase64Tx) {
  console.log('\n📤 Submitting transaction to Solana...');
  
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
          skipPreflight: true,  // SKIP PREFLIGHT
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
  console.log('🪐 Jupiter Ultra Swap\n');
  
  const config = loadConfig();
  const taker = loadWalletAddress();
  const privateKey = loadWalletPrivateKey();
  const params = parseArgs();
  
  console.log(`📊 Swap Details:`);
  console.log(`   Taker: ${taker}`);
  console.log(`   Input: ${params.inputMint === TOKEN_MINTS['USDC'] ? 'USDC' : params.inputMint}`);
  console.log(`   Output: ${params.outputMint === TOKEN_MINTS['SOL'] ? 'SOL' : params.outputMint}`);
  console.log(`   Amount: ${formatAmount(params.inputMint, params.amount)}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%`);
  console.log(`   Gasless: false (hardcoded)\n`);
  
  try {
    // Step 1: Fetch order
    console.log('📥 Step 1: Fetching order from Jupiter Ultra...');
    const order = await fetchUltraOrder(config.jupiterKey, taker, params);
    
    console.log(`✓ Order received`);
    console.log(`   Input: ${formatAmount(order.inputMint, order.inAmount)}`);
    console.log(`   Output: ${formatAmount(order.outputMint, order.outAmount)}`);
    console.log(`   USD Value: $${parseFloat(order.swapUsdValue).toFixed(4)}`);
    console.log(`   Request ID: ${order.requestId}`);
    console.log(`   Transaction: ${order.transaction ? 'Present' : 'MISSING'}`);
    
    if (!order.transaction) {
      throw new Error('No transaction in order response');
    }
    
    // Step 2: Sign transaction
    const signedTx = await signTransaction(order.transaction, privateKey);
    
    // Step 3: Submit
    console.log('\n🚀 Step 3: Submitting...');
    const signature = await submitTransaction(config.rpcUrl, signedTx);
    
    console.log('\n✅ SWAP SUCCESSFUL!');
    console.log(`🔗 Signature: ${signature}`);
    console.log(`🌐 Explorer: https://solscan.io/tx/${signature}`);
    console.log(`\n💰 Swapped ${formatAmount(order.inputMint, order.inAmount)} → ${formatAmount(order.outputMint, order.outAmount)}`);
    
  } catch (err) {
    console.error('\n❌ Swap failed:', err.message);
    if (err.stack) {
      console.error('\nStack:', err.stack);
    }
    process.exit(1);
  }
}

main();
