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

// Token decimals registry (fallback for common tokens)
const TOKEN_DECIMALS = {
  'So11111111111111111111111111111111111111112': 9,  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,  // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEqw': 6,  // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5,  // BONK
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt': 6,  // PYTH
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 6,  // JUP
};

const TOKEN_MINTS = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEqw',
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

/**
 * Fetch token decimals from on-chain metadata
 * Uses SPL Token program to get mint info
 */
async function fetchTokenDecimals(rpcUrl, mintAddress) {
  // Check registry first
  if (TOKEN_DECIMALS[mintAddress]) {
    return TOKEN_DECIMALS[mintAddress];
  }

  console.log(`🔍 Fetching decimals for ${mintAddress.substring(0, 8)}...${mintAddress.substring(mintAddress.length - 8)} from chain`);
  
  try {
    // SPL Token mint account layout:
    // - 4 bytes: mint authority option
    // - 32 bytes: mint authority pubkey (if present)
    // - 8 bytes: supply (u64)
    // - 1 byte: decimals (u8)
    // - 1 byte: mint authority option
    // - 1 byte: freeze authority option
    // - 32 bytes: freeze authority pubkey (if present)
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          mintAddress,
          { encoding: 'base64' }
        ]
      })
    });

    const result = await response.json();
    
    if (result.error || !result.result?.value?.data) {
      throw new Error(`Failed to fetch mint info: ${result.error?.message || 'No data'}`);
    }

    const data = Buffer.from(result.result.value.data[0], 'base64');
    
    // Decimals is at offset 44 (after mint authority option + pubkey + supply)
    // Layout: 4 (option) + 32 (pubkey) + 8 (supply) = 44, then 1 byte for decimals
    const decimals = data[44];
    
    console.log(`✓ Found decimals: ${decimals}`);
    
    // Cache it
    TOKEN_DECIMALS[mintAddress] = decimals;
    
    return decimals;
  } catch (err) {
    console.warn(`⚠️  Failed to fetch decimals on-chain: ${err.message}`);
    console.warn('   Falling back to 6 decimals (may be incorrect!)');
    return 6;
  }
}

/**
 * Convert human-readable amount to base units using BigInt for precision
 * @param {number} amount - Human readable amount (e.g., 356343 for BONK)
 * @param {number} decimals - Token decimals
 * @returns {string} - Base units as string (for JSON safety)
 */
function toBaseUnits(amount, decimals) {
  // Use string manipulation to avoid floating point errors
  const amountStr = amount.toString();
  const [whole, fraction = ''] = amountStr.split('.');
  
  // Pad or trim fraction to match decimals
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  
  // Combine: whole * 10^decimals + paddedFraction
  const wholeBig = BigInt(whole) * BigInt(10) ** BigInt(decimals);
  const fractionBig = BigInt(paddedFraction.padStart(decimals, '0'));
  
  return (wholeBig + fractionBig).toString();
}

/**
 * Convert base units back to human-readable amount
 * @param {string} baseUnits - Amount in base units
 * @param {number} decimals - Token decimals
 * @returns {string} - Human readable amount
 */
function fromBaseUnits(baseUnits, decimals) {
  const base = BigInt(baseUnits);
  const divisor = BigInt(10) ** BigInt(decimals);
  
  const whole = base / divisor;
  const fraction = base % divisor;
  
  // Pad fraction with leading zeros
  const fractionStr = fraction.toString().padStart(decimals, '0');
  
  // Trim trailing zeros but keep at least 2 decimals
  const trimmedFraction = fractionStr.replace(/0+$/, '').padEnd(2, '0');
  
  return `${whole}.${trimmedFraction}`;
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
  
  // Validate amount is positive
  const amountValue = parseFloat(params.amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    console.error('❌ Error: --amount must be a positive number');
    process.exit(1);
  }
  
  // Store raw amount for later conversion after we fetch decimals
  params.rawAmount = amountValue;
  
  return params;
}

function formatAmount(mint, amountBaseUnits, decimals = null) {
  // Use provided decimals or lookup from registry
  const tokenDecimals = decimals || TOKEN_DECIMALS[mint] || 6;
  const formatted = fromBaseUnits(amountBaseUnits, tokenDecimals);
  
  // Get symbol
  let symbol = '???';
  for (const [name, addr] of Object.entries(TOKEN_MINTS)) {
    if (addr === mint) {
      symbol = name;
      break;
    }
  }
  if (symbol === '???') {
    symbol = mint.substring(0, 4) + '...' + mint.substring(mint.length - 4);
  }
  
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
  console.log(`📡 Step 1: Fetching quote...\n`);
  console.log(`   URL: ${url}\n`);
  
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
  
  console.log(`📊 Initial Parameters:`);
  console.log(`   Wallet: ${walletAddress}`);
  console.log(`   Input: ${params.inputMint.length === 44 ? params.inputMint.substring(0, 8) + '...' + params.inputMint.substring(params.inputMint.length - 8) : params.inputMint}`);
  console.log(`   Output: ${params.outputMint.length === 44 ? params.outputMint.substring(0, 8) + '...' + params.outputMint.substring(params.outputMint.length - 8) : params.outputMint}`);
  console.log(`   Raw Amount: ${params.rawAmount}`);
  console.log(`   Slippage: ${(parseInt(params.slippageBps) / 100).toFixed(2)}%\n`);
  
  // Fetch decimals for input token
  console.log('📏 Resolving token decimals...\n');
  const inputDecimals = await fetchTokenDecimals(config.rpcUrl, params.inputMint);
  
  // Convert amount to base units using BigInt
  params.amount = toBaseUnits(params.rawAmount, inputDecimals);
  
  console.log(`\n✓ Amount in base units: ${params.amount}`);
  console.log(`✓ Human readable: ${fromBaseUnits(params.amount, inputDecimals)}\n`);
  
  try {
    // Step 1: Get quote
    const quote = await fetchQuote(config.jupiterKey, params);
    
    console.log(`✓ Quote received`);
    console.log(`   Input: ${formatAmount(quote.inputMint, quote.inAmount, quote.inDecimals)}`);
    console.log(`   Output: ${formatAmount(quote.outputMint, quote.outAmount, quote.outDecimals)}`);
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
    console.log(`\n💰 Swapped ${formatAmount(quote.inputMint, quote.inAmount, quote.inDecimals)} → ${formatAmount(quote.outputMint, quote.outAmount, quote.outDecimals)}`);
    
  } catch (err) {
    console.error('\n❌ Swap failed:', err.message);
    if (err.stack) {
      console.error('\nStack:', err.stack);
    }
    process.exit(1);
  }
}

main();
