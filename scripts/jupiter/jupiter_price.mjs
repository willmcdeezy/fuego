#!/usr/bin/env node
/**
 * Jupiter Ultra Order Script
 * Fetches executable orders from Jupiter Ultra API
 * 
 * Usage:
 *   node jupiter_price.mjs --input SOL --output USDC --amount 0.01
 *   node jupiter_price.mjs --input So11111111111111111111111111111111111111112 --output EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --amount 10000000
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
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

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    inputMint: TOKEN_MINTS['SOL'],
    outputMint: TOKEN_MINTS['USDC'],
    amount: '10000000', // 0.01 SOL in lamports
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
        // If amount < 1, assume it's in SOL/token units, convert to lamports/smallest unit
        const num = parseFloat(value);
        if (num < 1 && num > 0) {
          params.amount = Math.floor(num * 1000000000).toString(); // Convert SOL to lamports
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

async function fetchUltraOrder(apiKey, params) {
  const queryString = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps
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
  console.log(`📋 Response Headers:`);
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log();
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function main() {
  console.log('🪐 Jupiter Ultra Order\n');
  
  const config = loadConfig();
  const params = parseArgs();
  
  console.log(`📊 Fetching order:`);
  console.log(`   Input: ${params.inputMint === TOKEN_MINTS['SOL'] ? 'SOL' : params.inputMint}`);
  console.log(`   Output: ${params.outputMint === TOKEN_MINTS['USDC'] ? 'USDC' : params.outputMint}`);
  console.log(`   Amount: ${formatAmount(params.inputMint, params.amount)}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%\n`);
  
  try {
    const data = await fetchUltraOrder(config.jupiterKey, params);
    
    console.log('📈 Order Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n✅ Order fetched successfully');
    
  } catch (err) {
    console.error('\n❌ Failed to fetch order:', err.message);
    process.exit(1);
  }
}

main();
