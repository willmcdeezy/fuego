#!/usr/bin/env node
/**
 * Jupiter Ultra Swap Script - DEBUG MODE
 * Fetches order and examines the transaction structure
 * 
 * Usage:
 *   node jupiter_swap.mjs --input USDC --output SOL --amount 10
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

function examineTransaction(base64Tx) {
  console.log('\n🔍 Examining Transaction Structure...\n');
  
  // Decode base64 to bytes
  const txBytes = Buffer.from(base64Tx, 'base64');
  console.log(`📊 Transaction Size: ${txBytes.length} bytes`);
  console.log(`📊 Transaction Length: ${base64Tx.length} chars (base64)`);
  
  // First byte = number of signatures
  const numSignatures = txBytes[0];
  console.log(`\n📝 Signatures Count: ${numSignatures}`);
  
  // Each signature is 64 bytes
  let offset = 1;
  const signatures = [];
  
  for (let i = 0; i < numSignatures; i++) {
    const sigBytes = txBytes.slice(offset, offset + 64);
    // Check if signature is all zeros (placeholder)
    const isPlaceholder = sigBytes.every(b => b === 0);
    signatures.push({
      index: i,
      offset: offset,
      isPlaceholder: isPlaceholder,
      hex: sigBytes.toString('hex').slice(0, 32) + '...'
    });
    offset += 64;
  }
  
  console.log(`\n✍️  Signatures:`);
  signatures.forEach(sig => {
    console.log(`   [${sig.index}] Offset ${sig.offset}: ${sig.isPlaceholder ? 'PLACEHOLDER (zeros)' : 'HAS DATA'}`);
    console.log(`         First 16 bytes: ${sig.hex}`);
  });
  
  // After signatures comes the message
  console.log(`\n📨 Message starts at byte: ${offset}`);
  const messageBytes = txBytes.slice(offset);
  console.log(`📨 Message size: ${messageBytes.length} bytes`);
  
  // Try to parse message header
  // Message structure: 
  // - Header (3 bytes): numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts
  // - Account addresses (32 bytes each)
  // - Recent blockhash (32 bytes)
  // - Instructions...
  
  if (messageBytes.length >= 3) {
    const numRequiredSignatures = messageBytes[0];
    const numReadonlySigned = messageBytes[1];
    const numReadonlyUnsigned = messageBytes[2];
    
    console.log(`\n📋 Message Header:`);
    console.log(`   Required Signatures: ${numRequiredSignatures}`);
    console.log(`   Read-only Signed: ${numReadonlySigned}`);
    console.log(`   Read-only Unsigned: ${numReadonlyUnsigned}`);
    
    // Number of account addresses (varint)
    let msgOffset = 3;
    const accountCount = messageBytes[msgOffset++];
    console.log(`\n👥 Account Addresses Count: ${accountCount}`);
    
    // Read account addresses (32 bytes each)
    const accounts = [];
    for (let i = 0; i < accountCount && msgOffset + 32 <= messageBytes.length; i++) {
      const addrBytes = messageBytes.slice(msgOffset, msgOffset + 32);
      accounts.push({
        index: i,
        base58: addrBytes.toString('hex').slice(0, 8) + '...' // Simplified, not real base58
      });
      msgOffset += 32;
    }
    
    accounts.slice(0, 5).forEach(acc => {
      console.log(`   [${acc.index}] ${acc.base58}`);
    });
    if (accounts.length > 5) {
      console.log(`   ... and ${accounts.length - 5} more`);
    }
    
    // Recent blockhash (32 bytes)
    if (msgOffset + 32 <= messageBytes.length) {
      const blockhashBytes = messageBytes.slice(msgOffset, msgOffset + 32);
      const blockhashHex = blockhashBytes.toString('hex');
      console.log(`\n🔗 Recent Blockhash (hex): ${blockhashHex.slice(0, 16)}...${blockhashHex.slice(-16)}`);
      console.log(`   Blockhash offset: ${offset + msgOffset}`);
      msgOffset += 32;
    }
    
    // Instructions count
    if (msgOffset < messageBytes.length) {
      const instructionCount = messageBytes[msgOffset++];
      console.log(`\n⚙️  Instructions Count: ${instructionCount}`);
    }
  }
  
  // Print raw first 100 bytes in hex for manual inspection
  console.log(`\n🐛 Raw Bytes (first 100):`);
  const hexDump = txBytes.slice(0, 100).toString('hex').match(/.{1,2}/g).join(' ');
  console.log(`   ${hexDump}`);
  
  // Print byte breakdown
  console.log(`\n📐 Byte Layout:`);
  console.log(`   [0]        : ${txBytes[0]} (num signatures)`);
  if (numSignatures > 0) {
    console.log(`   [1-64]     : Signature #1 (${signatures[0]?.isPlaceholder ? 'placeholder' : 'populated'})`);
  }
  console.log(`   [${offset}+]   : Message data`);
  
  return {
    numSignatures,
    signatures,
    messageOffset: offset,
    messageSize: messageBytes.length
  };
}

async function main() {
  console.log('🪐 Jupiter Ultra Swap - DEBUG MODE\n');
  
  const config = loadConfig();
  const taker = loadWalletAddress();
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
    
    // Step 2: Examine the transaction
    const txInfo = examineTransaction(order.transaction);
    
    console.log('\n📋 Summary:');
    console.log(`   - Transaction has ${txInfo.numSignatures} signature slot(s)`);
    console.log(`   - Signatures are ${txInfo.signatures.every(s => s.isPlaceholder) ? 'ALL PLACEHOLDERS (need signing)' : 'PARTIALLY SIGNED'}`);
    console.log(`   - Message starts at byte ${txInfo.messageOffset}`);
    console.log(`   - Message size: ${txInfo.messageSize} bytes`);
    
    if (txInfo.signatures.every(s => s.isPlaceholder)) {
      console.log('\n💡 This transaction needs to be signed before submission.');
    } else {
      console.log('\n⚠️  Some signatures already present - check if it needs additional signing.');
    }
    
    // Save transaction to file for further inspection
    const fs = await import('fs');
    const txFile = '/tmp/jupiter_tx_debug.bin';
    fs.writeFileSync(txFile, Buffer.from(order.transaction, 'base64'));
    console.log(`\n💾 Transaction saved to: ${txFile}`);
    console.log(`   You can inspect with: xxd ${txFile} | head -20`);
    
    console.log('\n✅ Debug complete');
    
    // SIGNING CODE COMMENTED OUT FOR NOW
    /*
    // Step 3: Sign the transaction (COMMENTED OUT)
    console.log('\n🔑 Step 3: Signing transaction...');
    // const signedTx = await signTransactionWithKit(order.transaction, keypair);
    
    // Step 4: Submit to Fuego (COMMENTED OUT)
    console.log('\n🚀 Step 4: Submitting to Fuego...');
    // const network = config.netowrk || 'mainnet-beta';
    // const result = await submitToFuego(signedTx, network);
    
    console.log('\n✅ Swap submitted successfully!');
    console.log(`🔗 Signature: ${result.signature}`);
    console.log(`🌐 Explorer: ${result.explorer_link}`);
    */
    
  } catch (err) {
    console.error('\n❌ Debug failed:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }
}

main();
