#!/usr/bin/env node
/**
 * x402_purch.mjs - Complete x402 Purch.xyz flow: create order, sign tx, submit payment.
 *
 * Usage:
 *   node x402_purch.mjs --product-url <url> --email <email> --name <name> \
 *     --address-line1 <line1> [--address-line2 <line2>] --city <city> \
 *     --state <state> --postal-code <code> [--country <US>] [--url <purch-endpoint>] [--network <mainnet-beta>]
 *
 * Example:
 *   node x402_purch.mjs \
 *     --product-url "https://amazon.com/..." \
 *     --email "will.mcdonnell4@gmail.com" \
 *     --name "Will McDonnell" \
 *     --address-line1 "3607 S lamar Blvd" \
 *     --address-line2 "APT 1252" \
 *     --city "Austin" \
 *     --state "TX" \
 *     --postal-code "78704" \
 *     --country "US"
 */

import fs from 'fs';
import os from 'os';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const RUST_SERVER_URL = process.env.FUEGO_SERVER_URL || "http://127.0.0.1:8080";
const PURCH_ORDERS_URL = "https://x402.purch.xyz/orders/solana";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "_");
      const value =
        args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
      parsed[key] = value;
      if (value) i++;
    }
  }
  return parsed;
}

function loadWallet() {
  const walletPath = `${os.homedir()}/.fuego/wallet.json`;
  try {
    const content = fs.readFileSync(walletPath, 'utf8');
    const wallet = JSON.parse(content);
    return Keypair.fromSecretKey(new Uint8Array(wallet.privateKey || wallet.private_key));
  } catch (e) {
    console.error("❌ Failed to load wallet from ~/.fuego/wallet.json");
    console.error("   Run 'fuego create' first.");
    process.exit(1);
  }
}

async function submitTransaction(serializedTx, network, isVersioned = true) {
  // Submit via Fuego server (use versioned endpoint for x402)
  const endpoint = isVersioned ? 'submit-versioned-transaction' : 'submit-transaction';
  const response = await fetch(`${RUST_SERVER_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      network: network || "mainnet-beta",
      transaction: serializedTx
    }),
  });
  
  const result = await response.json();
  return result;
}

async function main() {
  const args = parseArgs();

  const required = [
    "product_url",
    "email",
    "name",
    "address_line1",
    "city",
    "state",
    "postal_code",
  ];
  for (const field of required) {
    if (!args[field]) {
      console.error(
        `Missing required argument: --${field.replace(/_/g, "-")}`,
      );
      process.exit(1);
    }
  }

  const payload = {
    url: args.url || PURCH_ORDERS_URL,
    product_url: args.product_url,
    email: args.email,
    name: args.name,
    address_line1: args.address_line1,
    city: args.city,
    state: args.state,
    postal_code: args.postal_code,
    country: args.country || "US",
  };
  if (args.address_line2) payload.address_line2 = args.address_line2;
  if (args.network) payload.network = args.network;
  if (args.payer_address) payload.payer_address = args.payer_address;
  if (args.max_price) payload.maxPrice = parseInt(args.max_price);

  console.log("🛒 x402 Purch - Creating order...");
  console.log("=".repeat(60));
  console.log(`   Product: ${payload.product_url}`);
  console.log(`   Email: ${payload.email}`);
  console.log("=".repeat(60));

  // Step 1: Create order via Fuego server
  let response;
  try {
    response = await fetch(`${RUST_SERVER_URL}/x402-purch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("❌ Request failed:", e.message);
    console.error("   Is the Fuego server running? (e.g. cargo run in server/)");
    process.exit(1);
  }

  const result = await response.json();

  if (!result.success) {
    console.error("\n❌ Order creation failed:");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Order created!");
  console.log(`   Order ID: ${result.data?.orderId || result.data?.order?.orderId || 'N/A'}`);
  console.log(`   Status: ${result.data?.paymentStatus || result.data?.order?.payment?.status || 'N/A'}`);
  console.log(`   Amount: ${result.data?.quote?.totalPrice?.amount || result.data?.order?.quote?.totalPrice?.amount || 'N/A'} ${result.data?.quote?.totalPrice?.currency?.toUpperCase() || 'USDC'}`);

  // Step 2: Get serialized transaction and sign it
  const serializedTx = result.data?.serializedTransaction || result.data?.order?.payment?.preparation?.serializedTransaction;
  
  if (!serializedTx) {
    console.error("\n❌ No transaction to sign. Response:");
    console.error(JSON.stringify(result.data, null, 2));
    process.exit(1);
  }

  console.log("\n🔐 Signing transaction...");
  
  // Load wallet
  const keypair = loadWallet();
  console.log(`   Wallet: ${keypair.publicKey.toBase58()}`);

  // Decode and sign transaction (x402 uses base58, not base64)
  let signedSerializedTx;
  try {
    // x402 transactions are base58 encoded
    const txBuffer = bs58.decode(serializedTx);
    console.log(`   Decoded ${txBuffer.length} bytes`);
    // Try VersionedTransaction first (x402 uses this format)
    const versionedTx = VersionedTransaction.deserialize(txBuffer);
    versionedTx.sign([keypair]);
    signedSerializedTx = Buffer.from(versionedTx.serialize()).toString('base64');
    console.log("   Signed as VersionedTransaction");
  } catch (vErr) {
    try {
      // Fall back to legacy Transaction with base58
      const txBuffer = bs58.decode(serializedTx);
      const transaction = Transaction.from(txBuffer);
      transaction.sign(keypair);
      signedSerializedTx = transaction.serialize().toString('base64');
      console.log("   Signed as legacy Transaction");
    } catch (e) {
      console.error("❌ Failed to sign transaction:", e.message);
      process.exit(1);
    }
  }

  // Step 3: Submit signed transaction
  console.log("\n📡 Submitting payment...");
  
  const submitResult = await submitTransaction(signedSerializedTx, payload.network, true);

  if (submitResult.success) {
    console.log("\n🎉 PAYMENT SUCCESSFUL!");
    console.log(`   Signature: ${submitResult.data?.signature}`);
    console.log(`   Explorer: ${submitResult.data?.explorer_link}`);
    console.log("\n✨ Your order is being processed!");
  } else {
    console.error("\n❌ Payment submission failed:");
    console.error(submitResult.error || JSON.stringify(submitResult, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
