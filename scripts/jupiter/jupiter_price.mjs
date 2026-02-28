#!/usr/bin/env node
/**
 * Jupiter Price Quote Script
 * Fetches swap quotes from Jupiter Ultra API with fallback to regular endpoint
 * 
 * Usage:
 *   node jupiter_price.mjs --input SOL --output USDC --amount 0.01
 *   node jupiter_price.mjs --input So11111111111111111111111111111111111111112 --output EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --amount 10000000
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
const JUPITER_ULTRA_URL = 'https://api.jup.ag/ultra/v1/quote';
const JUPITER_REGULAR_URL = 'https://api.jup.ag/swap/v1/quote';

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

async function fetchQuote(url, apiKey, params) {
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${queryString}`;
  
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }
  
  return await response.json();
}

async function getQuote(config, params) {
  const apiKey = config.jupiterKey;
  
  if (!apiKey) {
    throw new Error('No jupiterKey found in config');
  }
  
  // Try Ultra first
  try {
    console.log('🚀 Trying Jupiter Ultra...');
    const data = await fetchQuote(JUPITER_ULTRA_URL, apiKey, params);
    console.log('✅ Ultra endpoint successful\n');
    return { data, endpoint: 'ultra' };
  } catch (ultraErr) {
    console.log(`⚠️  Ultra failed: ${ultraErr.message}`);
    console.log('🔄 Falling back to regular endpoint...\n');
    
    // Fallback to regular
    try {
      const data = await fetchQuote(JUPITER_REGULAR_URL, apiKey, params);
      console.log('✅ Regular endpoint successful\n');
      return { data, endpoint: 'regular' };
    } catch (regularErr) {
      throw new Error(`Both endpoints failed. Ultra: ${ultraErr.message}, Regular: ${regularErr.message}`);
    }
  }
}

async function main() {
  console.log('🪐 Jupiter Price Quote\n');
  
  const config = loadConfig();
  const params = parseArgs();
  
  console.log(`📊 Fetching quote:`);
  console.log(`   Input: ${params.inputMint === TOKEN_MINTS['SOL'] ? 'SOL' : params.inputMint}`);
  console.log(`   Output: ${params.outputMint === TOKEN_MINTS['USDC'] ? 'USDC' : params.outputMint}`);
  console.log(`   Amount: ${formatAmount(params.inputMint, params.amount)}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%\n`);
  
  try {
    const { data, endpoint } = await getQuote(config, params);
    
    console.log('📈 Quote Results:');
    console.log(`   Endpoint Used: ${endpoint}`);
    console.log(`   Input Amount: ${formatAmount(data.inputMint, data.inAmount)}`);
    console.log(`   Output Amount: ${formatAmount(data.outputMint, data.outAmount)}`);
    console.log(`   Minimum Output: ${formatAmount(data.outputMint, data.otherAmountThreshold)}`);
    console.log(`   Price Impact: ${data.priceImpactPct}%`);
    console.log(`   Slippage: ${(data.slippageBps / 100).toFixed(2)}%`);
    console.log(`   USD Value: $${parseFloat(data.swapUsdValue).toFixed(4)}`);
    
    if (data.routePlan && data.routePlan.length > 0) {
      console.log(`   Route: ${data.routePlan.map(r => r.swapInfo.label).join(' → ')}`);
    }
    
    console.log('\n✅ Quote fetched successfully');
    
    // Return data for potential programmatic use
    process.exitCode = 0;
    
  } catch (err) {
    console.error('\n❌ Failed to fetch quote:', err.message);
    process.exit(1);
  }
}

main();
