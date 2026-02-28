#!/usr/bin/env node
/**
 * Jupiter Ultra Swap Script
 * Gets order for swapping via Jupiter Ultra API
 * 
 * Usage:
 *   node jupiter_swap.mjs --input USDC --output SOL --amount 5
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
const WALLET_INFO_PATH = join(homedir(), '.fuego', 'wallet-config.json');
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

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    inputMint: TOKEN_MINTS['USDC'],  // Default: USDC
    outputMint: TOKEN_MINTS['SOL'],  // Default: SOL
    amount: '5000000',               // Default: 5 USDC (6 decimals)
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
        // USDC has 6 decimals
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
  console.log(`📡 Fetching: ${url}\n`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey
    }
  });
  
  console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function main() {
  console.log('🪐 Jupiter Ultra Swap - Order Fetch\n');
  
  const config = loadConfig();
  const taker = loadWalletAddress();
  const params = parseArgs();
  
  console.log(`📊 Fetching order:`);
  console.log(`   Taker: ${taker}`);
  console.log(`   Input: ${params.inputMint === TOKEN_MINTS['USDC'] ? 'USDC' : params.inputMint}`);
  console.log(`   Output: ${params.outputMint === TOKEN_MINTS['SOL'] ? 'SOL' : params.outputMint}`);
  console.log(`   Amount: ${formatAmount(params.inputMint, params.amount)}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%\n`);
  
  try {
    const data = await fetchUltraOrder(config.jupiterKey, taker, params);
    
    console.log('\n📄 RAW RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📈 Order Summary:');
    console.log(`   Input: ${formatAmount(data.inputMint, data.inAmount)}`);
    console.log(`   Output: ${formatAmount(data.outputMint, data.outAmount)}`);
    console.log(`   USD Value In: $${parseFloat(data.inUsdValue).toFixed(6)}`);
    console.log(`   USD Value Out: $${parseFloat(data.outUsdValue).toFixed(6)}`);
    console.log(`   Price Impact: ${data.priceImpact.toFixed(4)}%`);
    console.log(`   Platform Fee: ${data.platformFee.feeBps / 100}%`);
    console.log(`   Request ID: ${data.requestId}`);
    console.log(`   Transaction: ${data.transaction ? 'Present' : 'null'}`);
    
    console.log('\n✅ Order fetched successfully');
    
  } catch (err) {
    console.error('\n❌ Failed to fetch order:', err.message);
    process.exit(1);
  }
}

main();
