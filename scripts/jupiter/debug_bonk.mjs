#!/usr/bin/env node
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_PATH = join(homedir(), '.fuego', 'config.json');
const WALLET_INFO_PATH = join(homedir(), '.fuego', 'wallet-config.json');
const JUPITER_ULTRA_ORDER_URL = 'https://api.jup.ag/ultra/v1/order';

const TOKEN_MINTS = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const wallet = JSON.parse(readFileSync(WALLET_INFO_PATH, 'utf8'));

const params = {
  inputMint: TOKEN_MINTS['SOL'],
  outputMint: TOKEN_MINTS['BONK'],
  amount: '50000000', // 0.05 SOL
  slippageBps: '50',
  taker: wallet.publicKey,
  gasless: 'false'
};

const queryString = new URLSearchParams(params).toString();
const url = `${JUPITER_ULTRA_ORDER_URL}?${queryString}`;

console.log('Fetching BONK order:', url);

fetch(url, {
  method: 'GET',
  headers: { 'x-api-key': config.jupiterKey }
})
.then(r => r.json())
.then(data => {
  console.log('\nOrder received:', data.requestId);
  console.log('Swap type:', data.swapType);
  console.log('Gasless:', data.gasless);
  console.log('Transaction length:', data.transaction?.length);
  
  // Analyze transaction
  const txBytes = Buffer.from(data.transaction, 'base64');
  console.log('\nTransaction analysis:');
  console.log('Total bytes:', txBytes.length);
  console.log('Num signatures:', txBytes[0]);
  
  const numSigs = txBytes[0];
  console.log('\nSignature slots:');
  for (let i = 0; i < numSigs; i++) {
    const offset = 1 + (i * 64);
    const sigBytes = txBytes.slice(offset, offset + 64);
    const isZero = sigBytes.every(b => b === 0);
    console.log(`  [${i}] offset ${offset}: ${isZero ? 'PLACEHOLDER' : 'POPULATED'}`);
  }
  
  const messageOffset = 1 + (numSigs * 64);
  console.log('\nMessage starts at byte:', messageOffset);
  console.log('Message size:', txBytes.length - messageOffset);
  
  // Check if versioned transaction
  const firstMessageByte = txBytes[messageOffset];
  console.log('\nFirst message byte:', firstMessageByte, '(0x' + firstMessageByte.toString(16) + ')');
  if (firstMessageByte === 128) {
    console.log('TRANSACTION TYPE: Versioned (v0)');
  } else {
    console.log('TRANSACTION TYPE: Legacy');
  }
  
  // Print raw bytes
  console.log('\nFirst 100 bytes hex:');
  console.log(txBytes.slice(0, 100).toString('hex').match(/.{1,2}/g).join(' '));
});
