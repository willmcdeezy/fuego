#!/usr/bin/env node
/**
 * x402_purch.js - Node.js script for Purch.xyz x402 payments
 * 
 * Flow:
 * 1. Call purch.xyz → get 402 challenge
 * 2. Call Rust server (x402_purch_payment) → get unsigned transaction
 * 3. Sign transaction with Solana web3.js
 * 4. Submit to purch.xyz with X-PAYMENT-SIGNATURE header
 * 5. Check if payment was accepted
 * 
 * Usage:
 *   node x402_purch.js --product-url <url> --email <email> ...
 */

const fs = require('fs');
const path = require('path');
const { Connection, Keypair, Transaction, VersionedTransaction } = require('@solana/web3.js');
const fetch = require('node-fetch');

// Constants
const PURCH_API_URL = 'https://x402.purch.xyz/orders/solana';
const RUST_SERVER_URL = 'http://127.0.0.1:8080';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
      parsed[key] = value;
      if (value) i++;
    }
  }
  
  return parsed;
}

// Load Fuego wallet
function loadWallet() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const walletPath = path.join(homeDir, '.fuego', 'wallet.json');
  
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Wallet not found at', walletPath);
    console.error('   Run "fuego create" first');
    process.exit(1);
  }
  
  try {
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    const secretKey = new Uint8Array(walletData.privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (e) {
    console.error('❌ Failed to load wallet:', e.message);
    process.exit(1);
  }
}

// Get wallet address from config
function getWalletAddress() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configPath = path.join(homeDir, '.fuego', 'wallet-config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.publicKey;
    } catch {}
  }
  
  // Fallback to wallet
  const keypair = loadWallet();
  return keypair.publicKey.toBase58();
}

// Step 1: Send order request to purch.xyz
async function sendOrderRequest(productUrl, email, physicalAddress) {
  console.log('📦 Step 1: Sending order request to purch.xyz...');
  
  const payerAddress = getWalletAddress();
  
  const payload = {
    email,
    payerAddress,
    productUrl,
    physicalAddress
  };
  
  try {
    const response = await fetch(PURCH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 402) {
      const paymentHeader = response.headers.get('payment-required');
      if (!paymentHeader) {
        throw new Error('No payment-required header');
      }
      
      const paymentData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      console.log('✅ Received x402 payment challenge');
      return paymentData;
    }
    
    throw new Error(`Expected 402, got ${response.status}`);
    
  } catch (e) {
    console.error('❌ Failed to send order request:', e.message);
    process.exit(1);
  }
}

// Step 2: Parse x402 requirements
function parseRequirements(paymentData) {
  console.log('🔍 Step 2: Parsing x402 requirements...');
  
  const accepts = paymentData.accepts || [];
  if (!accepts.length) {
    throw new Error('No payment options');
  }
  
  const option = accepts[0];
  
  const requirements = {
    scheme: option.scheme,
    network: option.network.replace('solana:', ''), // Remove prefix for Rust
    amount: option.amount,
    asset: option.asset,
    pay_to: option.payTo,
    fee_payer: option.extra?.feePayer,
    max_timeout_seconds: option.maxTimeoutSeconds || 300
  };
  
  const amountHuman = parseInt(requirements.amount) / 1_000_000;
  console.log(`   💰 Amount: $${amountHuman.toFixed(2)} USDC (${requirements.amount} units)`);
  console.log(`   📍 Pay to: ${requirements.pay_to}`);
  console.log(`   ⏱️  Timeout: ${requirements.max_timeout_seconds}s`);
  
  return requirements;
}

// Step 3: Call Rust server to build x402 payment
async function buildX402Payment(requirements) {
  console.log('🔧 Step 3: Building payment via Rust server...');
  
  const payerAddress = getWalletAddress();
  
  const payload = {
    network: 'mainnet-beta',
    payer_address: payerAddress,
    pay_to_address: requirements.pay_to,
    amount: requirements.amount,
    asset: requirements.asset,
    fee_payer: requirements.fee_payer
  };
  
  try {
    const response = await fetch(`${RUST_SERVER_URL}/build-x402-purch-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Rust server error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    console.log('✅ Transaction built by Rust server');
    return result.data.transaction; // Base64 encoded
    
  } catch (e) {
    console.error('❌ Failed to build payment:', e.message);
    process.exit(1);
  }
}

// Step 4: Sign transaction with Solana web3.js
function signTransaction(base64Tx) {
  console.log('✍️  Step 4: Signing transaction...');
  
  const keypair = loadWallet();
  
  try {
    // Decode base64 transaction
    const txBytes = Buffer.from(base64Tx, 'base64');
    
    // Deserialize transaction
    const transaction = Transaction.from(txBytes);
    
    // Partial sign (we're one of multiple signers)
    transaction.partialSign(keypair);
    
    // Serialize signed transaction
    const signedBytes = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    
    console.log('✅ Transaction signed');
    return signedBytes.toString('base64');
    
  } catch (e) {
    console.error('❌ Failed to sign:', e.message);
    process.exit(1);
  }
}

// Step 5: Submit x402 payment to purch.xyz
async function submitX402Payment(signedTx, originalPayload) {
  console.log('📤 Step 5: Submitting x402 payment...');
  
  try {
    // Build x402 payment header (base64 JSON)
    const paymentPayload = {
      x402Version: 2,
      scheme: 'exact',
      network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      payload: {
        transaction: signedTx
      }
    };
    
    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    
    const response = await fetch(PURCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT-SIGNATURE': paymentHeader
      },
      body: JSON.stringify(originalPayload)
    });
    
    console.log(`   Response status: ${response.status}`);
    
    if (response.status === 201) {
      console.log('✅ PAYMENT ACCEPTED!');
      return await response.json();
    }
    
    if (response.status === 402) {
      console.log('❌ Payment rejected (still 402)');
      const paymentRequired = response.headers.get('payment-required');
      console.log('   Payment-Required header:', paymentRequired ? 'present' : 'missing');
      const body = await response.text();
      console.log('   Body:', body);
      return null;
    }
    
    console.log('❌ Unexpected response:', await response.text());
    return null;
    
  } catch (e) {
    console.error('❌ Failed to submit payment:', e.message);
    return null;
  }
}

// Main function
async function main() {
  const args = parseArgs();
  
  // Validate required args
  const required = ['product_url', 'email', 'name', 'address_line1', 'city', 'state', 'postal_code'];
  for (const field of required) {
    if (!args[field]) {
      console.error(`❌ Missing required argument: --${field.replace(/_/g, '-')}`);
      process.exit(1);
    }
  }
  
  const physicalAddress = {
    name: args.name,
    line1: args.address_line1,
    city: args.city,
    state: args.state,
    postalCode: args.postal_code,
    country: args.country || 'US'
  };
  
  if (args.address_line2) {
    physicalAddress.line2 = args.address_line2;
  }
  
  console.log('🛒 Starting Purch.xyz x402 Payment Flow (Node.js)');
  console.log('=' .repeat(50));
  console.log(`   Product: ${args.product_url}`);
  console.log(`   Email: ${args.email}`);
  console.log(`   Wallet: ${getWalletAddress()}`);
  console.log('=' .repeat(50));
  console.log();
  
  const orderPayload = {
    email: args.email,
    productUrl: args.product_url,
    physicalAddress
  };
  
  try {
    // Step 1: Get 402 challenge
    const paymentData = await sendOrderRequest(args.product_url, args.email, physicalAddress);
    
    // Step 2: Parse requirements
    const requirements = parseRequirements(paymentData);
    
    // Step 3: Build payment via Rust
    const unsignedTx = await buildX402Payment(requirements);
    
    // Step 4: Sign transaction
    const signedTx = signTransaction(unsignedTx);
    
    // Step 5: Submit payment
    const result = await submitX402Payment(signedTx, orderPayload);
    
    if (result) {
      console.log();
      console.log('=' .repeat(50));
      console.log('🎉 x402 PAYMENT WORKED!');
      console.log('   Order ID:', result.orderId);
      console.log('   Client Secret:', result.clientSecret ? '***' : 'missing');
      console.log('   Has serializedTransaction:', result.serializedTransaction ? 'yes' : 'no');
      console.log('=' .repeat(50));
      
      // Show full response
      console.log();
      console.log('📦 Full response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log();
      console.log('=' .repeat(50));
      console.log('❌ x402 payment failed - still getting 402');
      console.log('=' .repeat(50));
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
