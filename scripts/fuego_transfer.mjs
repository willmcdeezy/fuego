#!/usr/bin/env node
/**
 * fuego_transfer.mjs - Sign and submit USDC/SOL/USDT transfers (same logic as fuego_transfer.py).
 * Uses @solana/kit only: decode server tx → set fee payer signer → sign → serialize → submit.
 * Same signing path for USDC, SOL, and USDT (build-transfer-* returns unsigned tx; we sign and submit).
 *
 * Usage:
 *   node fuego_transfer.mjs --to <ADDRESS> --amount <AMOUNT> [--token USDC|SOL|USDT] [--network mainnet-beta] [--server URL]
 *
 * Wallet is always loaded from ~/.fuego/wallet.json and ~/.fuego/wallet-config.json
 * Environment: FUEGO_SERVER (default http://127.0.0.1:8080), FUEGO_NETWORK (default mainnet-beta).
 */

import fs from "fs";
import path from "path";

import {
  createKeyPairSignerFromBytes,
  decompileTransactionMessage,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
} from "@solana/kit";

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

/**
 * Load keypair from JSON wallet (Fuego or Solana CLI format).
 * @returns {Promise<import('@solana/kit').KeyPairSigner>}
 */
async function loadWalletFromFile(walletPath) {
  const resolved = path.resolve(
    walletPath.replace(
      /^~/,
      process.env.HOME || process.env.USERPROFILE || "~",
    ),
  );
  if (!fs.existsSync(resolved)) {
    throw new Error(`Wallet not found at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  const data = JSON.parse(raw);

  let bytes;
  if (Array.isArray(data)) {
    if (data.length !== 64)
      throw new Error(
        `Invalid Solana CLI wallet: expected 64 bytes, got ${data.length}`,
      );
    bytes = new Uint8Array(data);
  } else if (data && Array.isArray(data.privateKey)) {
    if (data.privateKey.length !== 64)
      throw new Error(
        `Invalid Fuego wallet: expected 64 bytes, got ${data.privateKey.length}`,
      );
    bytes = new Uint8Array(data.privateKey);
  } else {
    throw new Error(
      "Invalid wallet format. Expected Fuego JSON or Solana CLI array format.",
    );
  }

  return createKeyPairSignerFromBytes(bytes);
}

/**
 * Get wallet address from wallet-config.json (same as Python script did).
 * @returns {string} Wallet address
 */
function getWalletAddress() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configPath = path.join(homeDir, ".fuego", "wallet-config.json");

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.publicKey) {
        return config.publicKey;
      }
    } catch (e) {
      console.warn("⚠️  Could not read wallet-config.json:", e.message);
    }
  }

  // Fallback: derive from wallet.json
  const walletPath = path.join(homeDir, ".fuego", "wallet.json");
  if (fs.existsSync(walletPath)) {
    try {
      const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
      if (walletData.address) {
        return walletData.address;
      }
    } catch (e) {
      console.warn("⚠️  Could not read wallet.json:", e.message);
    }
  }

  throw new Error("Could not find wallet address. Run 'fuego create' first.");
}

/**
 * Request server to build unsigned transaction.
 */
async function buildTransfer(
  serverUrl,
  network,
  fromAddr,
  toAddr,
  amount,
  token = "USDC",
) {
  const endpoint = `${serverUrl}/build-transfer-${token.toLowerCase()}`;
  const payload = {
    network,
    from_address: fromAddr,
    to_address: toAddr,
    amount,
    yid: `agent-${process.pid}-${Date.now()}`,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Build transfer failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Server error");
  }
  return result.data;
}

/**
 * Decode server tx (base64), set fee payer signer, sign, return base64 signed tx.
 */
async function signTransaction(txBase64, signer) {
  const transactionBytes = new Uint8Array(Buffer.from(txBase64, "base64"));

  const transaction = getTransactionDecoder().decode(transactionBytes);
  const compiledMessage = getCompiledTransactionMessageDecoder().decode(
    transaction.messageBytes,
  );
  const transactionMessage = decompileTransactionMessage(compiledMessage);
  const messageWithSigner = setTransactionMessageFeePayerSigner(
    signer,
    transactionMessage,
  );
  const signedTransaction =
    await signTransactionMessageWithSigners(messageWithSigner);
  return getBase64EncodedWireTransaction(signedTransaction);
}

/**
 * Submit signed transaction to server for broadcast.
 */
async function submitTransaction(serverUrl, network, signedTxBase64) {
  const endpoint = `${serverUrl}/submit-transaction`;
  const payload = { network, transaction: signedTxBase64 };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Submit failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Server error");
  }
  return result.data;
}

async function main() {
  const args = parseArgs();
  const toAddr = args.to;
  const amount = args.amount;
  const token = (args.token || "USDC").toUpperCase();
  const network = args.network || process.env.FUEGO_NETWORK || "mainnet-beta";
  const serverUrl =
    args.server || process.env.FUEGO_SERVER || "http://127.0.0.1:8080";
  const walletPath = "~/.fuego/wallet.json";

  if (!toAddr || !amount) {
    console.error(
      "Usage: node fuego_transfer.mjs --to <ADDRESS> --amount <AMOUNT> [--token USDC|SOL|USDT] [--network] [--server]",
    );
    console.error(
      "       For SOL transfers, pass --token SOL (default is USDC).",
    );
    process.exit(1);
  }
  if (!["USDC", "SOL", "USDT"].includes(token)) {
    console.error("--token must be USDC, SOL, or USDT");
    process.exit(1);
  }

  // Get from address from wallet (same as Python script)
  let fromAddr;
  try {
    fromAddr = getWalletAddress();
  } catch (e) {
    console.error("❌ Failed to get wallet address:", e.message);
    process.exit(1);
  }

  console.log("🔥 Fuego Agent Transaction Signer (Node / @solana/kit)");
  console.log(`Network: ${network}`);
  console.log(
    `Token:   ${token} (endpoint: build-transfer-${token.toLowerCase()})`,
  );
  console.log(`From: ${fromAddr}`);
  console.log(`To: ${toAddr}`);
  console.log(`Amount: ${amount} ${token}`);
  console.log("");

  let signer;
  try {
    console.log(`📂 Loading wallet from ${walletPath}...`);
    signer = await loadWalletFromFile(walletPath);
    console.log("✅ Wallet loaded successfully");
  } catch (e) {
    console.error("❌ Failed to load wallet:", e.message);
    console.error("   Tip: Initialize wallet with: cd src/cli && node init.ts");
    process.exit(1);
  }
  console.log("");

  try {
    console.log("📝 Building unsigned transaction...");
    const buildResult = await buildTransfer(
      serverUrl,
      network,
      fromAddr,
      toAddr,
      amount,
      token,
    );
    console.log("✅ Transaction built");
    console.log(
      `   Blockhash: ${(buildResult.blockhash || "").slice(0, 20)}...`,
    );
    if (buildResult.memo) console.log(`   Memo: ${buildResult.memo}`);
    console.log("");

    console.log("🔐 Signing transaction...");
    const signedTxBase64 = await signTransaction(
      buildResult.transaction,
      signer,
    );
    console.log("✅ Transaction signed");
    console.log("");

    console.log("📤 Submitting signed transaction...");
    const submitResult = await submitTransaction(
      serverUrl,
      network,
      signedTxBase64,
    );
    console.log("✅ Transaction submitted!");
    console.log("");

    const sig = submitResult.signature;
    const link =
      submitResult.explorer_link ||
      `https://explorer.solana.com/tx/${sig}?cluster=${network}`;

    console.log("=".repeat(70));
    console.log(`Signature: ${sig}`);
    console.log(`Explorer:  ${link}`);
    console.log("=".repeat(70));
    console.log("");
    console.log("🎉 Transaction on-chain!");
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED" || e.message?.includes("fetch")) {
      console.error(`❌ Failed to connect to Fuego server at ${serverUrl}`);
      console.error(
        "   Is the server running? (e.g. ./server/target/release/fuego-server)",
      );
    } else {
      console.error("❌ Error:", e.message);
      if (e.context)
        console.error("   Context:", JSON.stringify(e.context, null, 2));
      if (e.cause) console.error("   Cause:", e.cause.message || e.cause);
    }
    process.exit(1);
  }
}

main();
