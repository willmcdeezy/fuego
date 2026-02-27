#!/usr/bin/env node
/**
 * x402_purch.mjs - Node.js script for Purch.xyz x402 payments
 * 
 * Flow:
 * 1. Call purch.xyz → get 402 challenge
 * 2. Call Rust server (build-x402-purch-payment) → get payment requirements
 * 3. Build x402 payment header with correct format
 * 4. Sign transaction with Solana web3.js
 * 5. Submit to purch.xyz with X-PAYMENT-SIGNATURE header
 * 6. Stop when we get 200 (receive order transaction)
 * 
 * Usage:
 *   node x402_purch.mjs --product-url <url> --email <email> ...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Keypair, Transaction } from '@solana/web3.js';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PURCH_API_URL = 'https://x402.purch.xyz/orders/solana';
const RUST_SERVER_URL = 'http://127.0.0.1:8080';

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
      
      // Save the original 402 response for later
      return {
        paymentData,
        originalHeader: paymentHeader,
        orderPayload: payload
      };
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
    network: option.network,
    amount: option.amount,
    asset: option.asset,
    pay_to: option.payTo,
    fee_payer: option.extra?.feePayer,
    max_timeout_seconds: option.maxTimeoutSeconds || 300,
    resource: paymentData.resource
  };
  
  const amountHuman = parseInt(requirements.amount) / 1_000_000;
  console.log(`   💰 Amount: $${amountHuman.toFixed(2)} USDC (${requirements.amount} units)`);
  console.log(`   📍 Pay to: ${requirements.pay_to}`);
  console.log(`   🌐 Resource: ${requirements.resource?.url || 'N/A'}`);
  
  return requirements;
}

// Step 3: Call Rust server to build x402 payment transaction
async function buildX402Payment(requirements) {
  console.log('🔧 Step 3: Building payment transaction via Rust server...');
  
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
    return result.data.transaction; // Base64 encoded unsigned transaction
    
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
    
    // Partial sign (we're one of multiple signers - facilitator will add theirs)
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

// Step 5: Build x402 payment header with CORRECT format
function buildX402PaymentHeader(signedTx, original402Data) {
  console.log('📋 Step 5: Building x402 payment header...');
  
  // Get the first accepted option from original 402 response
  const acceptedOption = original402Data.paymentData.accepts[0];
  
  // Build the CORRECT x402 v2 format (snake_case, not camelCase)
  const paymentPayload = {
    x402_version: 2,
    scheme: 'exact',
    network: acceptedOption.network,
    payload: {
      transaction: signedTx
    }
  };
  
  console.log('   📝 x402 payment payload structure:');
  console.log(`      x402_version: ${paymentPayload.x402_version}`);
  console.log(`      scheme: ${paymentPayload.scheme}`);
  console.log(`      network: ${paymentPayload.network}`);
  console.log(`      payload.transaction: ${signedTx.substring(0, 50)}...`);
  
  // Base64 encode the JSON
  const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
  
  return paymentHeader;
}

// Step 6: Submit x402 payment to purch.xyz
async function submitX402Payment(paymentHeader, originalPayload) {
  console.log('📤 Step 6: Submitting x402 payment to purch.xyz...');
  
  try {
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
      console.log('✅✅✅ PAYMENT ACCEPTED! (200 OK)');
      const result = await response.json();
      return result;
    }
    
    if (response.status === 402) {
      console.log('❌ Payment rejected (still 402)');
      const paymentRequired = response.headers.get('payment-required');
      if (paymentRequired) {
        console.log('   New Payment-Required header received');
        const decoded = JSON.parse(Buffer.from(paymentRequired, 'base64').toString());
        console.log('   Error:', decoded.error || 'Unknown');
      }
      const body = await response.text();
      if (body) {
        console.log('   Body:', body);
      }
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
  console.log('=' .repeat(60));
  console.log(`   Product: ${args.product_url}`);
  console.log(`   Email: ${args.email}`);
  console.log(`   Wallet: ${getWalletAddress()}`);
  console.log('=' .repeat(60));
  console.log();
  
  try {
    // Step 1: Get 402 challenge
    const { paymentData, originalHeader, orderPayload } = await sendOrderRequest(
      args.product_url, 
      args.email, 
      physicalAddress
    );
    
    // Step 2: Parse requirements
    const requirements = parseRequirements(paymentData);
    
    // Step 3: Build payment transaction via Rust server
    const unsignedTx = await buildX402Payment(requirements);
    
    // Step 4: Sign transaction
    const signedTx = signTransaction(unsignedTx);
    
    // Step 5: Build x402 payment header with CORRECT format
    const paymentHeader = buildX402PaymentHeader(signedTx, { paymentData, originalHeader });
    
    // Step 6: Submit payment
    const result = await submitX402Payment(paymentHeader, orderPayload);
    
    if (result) {
      console.log();
      console.log('=' .repeat(60));
      console.log('🎉🎉🎉 SUCCESS! x402 PAYMENT ACCEPTED!');
      console.log('=' .repeat(60));
      console.log();
      console.log('📦 Order Response:');
      console.log(`   Order ID: ${result.orderId}`);
      console.log(`   Client Secret: ${result.clientSecret ? '***[REDACTED]***' : 'N/A'}`);
      console.log(`   Has serializedTransaction: ${result.serializedTransaction ? '✅ YES' : '❌ NO'}`);
      console.log();
      
      if (result.serializedTransaction) {
        console.log('✅ We have the order transaction!');
        console.log('   This is what we would sign and submit to complete the purchase.');
        console.log('   (Stopping here as requested)');
      }
      
      console.log();
      console.log('📋 Full Response:');
      console.log(JSON.stringify(result, null, 2));
      
    } else {
      console.log();
      console.log('=' .repeat(60));
      console.log('❌ x402 payment failed - could not get 200 OK');
      console.log('=' .repeat(60));
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
