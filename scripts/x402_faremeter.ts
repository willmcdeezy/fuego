#!/usr/bin/env npx tsx
/**
 * Universal x402 payment CLI for Fuego
 * Handles any x402-enabled API with automatic payment processing
 * 
 * Usage:
 *   # JSON body request (Helius)
 *   npx tsx x402_faremeter.ts --url https://helius.api.corbits.dev --method POST --body '{"jsonrpc":"2.0","id":1,"method":"getBlockHeight"}'
 * 
 *   # URL params request (Jupiter) 
 *   npx tsx x402_faremeter.ts --url https://jupiter.api.corbits.dev/ultra/v1/order --method GET --params inputMint=So11111111111111111111111111111111111111112,outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,amount=20000000
 */

import fs from "fs";
import path from "path";
import { payer } from "@faremeter/rides";

interface CLIArgs {
  url: string;
  method?: string;
  headers?: string;
  body?: string;
  params?: string;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: CLIArgs = { url: "" };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    
    if (key && value !== undefined) {
      (parsed as any)[key] = value;
    } else if (key === 'help') {
      parsed.help = true;
      break;
    }
  }
  
  return parsed;
}

function showHelp() {
  console.log(`
🔥 Fuego x402 Payment CLI

Usage:
  npx tsx scripts/x402_faremeter.ts [options]

Options:
  --url URL        Target x402-enabled API endpoint (required)
  --method METHOD  HTTP method (GET, POST, PUT, etc) [default: GET]
  --headers JSON   Custom headers as JSON object
  --body JSON      Request body as JSON string (for POST/PUT)
  --params PARAMS  URL parameters as comma-separated key=value pairs
  --help           Show this help

Examples:

  # Helius RPC (JSON body)
  npx tsx scripts/x402_faremeter.ts \\
    --url https://helius.api.corbits.dev \\
    --method POST \\
    --body '{"jsonrpc":"2.0","id":1,"method":"getBlockHeight"}'

  # Jupiter swap quote (URL params)  
  npx tsx scripts/x402_faremeter.ts \\
    --url https://jupiter.api.corbits.dev/ultra/v1/order \\
    --method GET \\
    --params inputMint=So11111111111111111111111111111111111111112,outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,amount=20000000

  # Custom headers
  npx tsx scripts/x402_faremeter.ts \\
    --url https://api.example.com/data \\
    --method POST \\
    --headers '{"Authorization":"Bearer token","X-Custom":"value"}' \\
    --body '{"query":"data"}'
`);
}

async function loadFuegoWallet() {
  const walletPath = path.join(process.env.HOME || "", ".fuego", "wallet.json");
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`No Fuego wallet found at ${walletPath}. Run: npm run init`);
  }

  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  
  // Convert private key bytes to format expected by @faremeter/rides
  const privateKeyBytes = new Uint8Array(walletData.privateKey);
  
  return { privateKeyBytes, address: walletData.address };
}

function buildRequestURL(baseUrl: string, params?: string): string {
  if (!params) return baseUrl;
  
  const urlParams = new URLSearchParams();
  const pairs = params.split(',');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      urlParams.append(key.trim(), value.trim());
    }
  }
  
  return `${baseUrl}?${urlParams.toString()}`;
}

async function makeX402Request(args: CLIArgs) {
  console.log("🔑 Loading Fuego wallet...");
  const { privateKeyBytes, address } = await loadFuegoWallet();
  console.log("📍 Wallet address:", address);
  
  console.log("🔗 Adding wallet to payer...");
  await payer.addLocalWallet(privateKeyBytes);
  console.log("✅ Wallet added successfully");
  
  // Build request URL with params if provided
  const requestUrl = buildRequestURL(args.url, args.params);
  console.log("\n🌐 Making x402 request to:", requestUrl);
  
  // Parse headers
  let headers: Record<string, string> = { 
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  
  if (args.headers) {
    try {
      const customHeaders = JSON.parse(args.headers);
      headers = { ...headers, ...customHeaders };
    } catch (error) {
      throw new Error(`Invalid headers JSON: ${error}`);
    }
  }
  
  // Build request options
  const requestOptions: RequestInit = {
    method: args.method?.toUpperCase() || 'GET',
    headers,
  };
  
  // Add body for POST/PUT requests
  if (args.body && ['POST', 'PUT', 'PATCH'].includes(requestOptions.method as string)) {
    requestOptions.body = args.body;
    console.log("📋 Request body:", JSON.stringify(JSON.parse(args.body), null, 2));
  }
  
  console.log("📨 Request method:", requestOptions.method);
  console.log("📋 Request headers:", JSON.stringify(headers, null, 2));
  
  // Make x402-enabled request
  const response = await payer.fetch(requestUrl, requestOptions);
  
  console.log(`\n📡 Response: ${response.status} ${response.statusText}`);
  
  if (response.status === 200) {
    const result = await response.json();
    console.log("\n🎉 SUCCESS! x402 payment completed!");
    console.log("📊 API Response:");
    console.log(JSON.stringify(result, null, 2));
    console.log("\n💰 Payment was automatically handled by @faremeter/rides");
    
    // Return structured response for agents
    return {
      success: true,
      status: response.status,
      data: result,
      paid: true
    };
  } else {
    const errorText = await response.text().catch(() => "Unable to read response");
    console.log(`\n❌ Request failed: ${response.status} ${response.statusText}`);
    console.log("Response:", errorText.substring(0, 500));
    
    return {
      success: false,
      status: response.status,
      error: `${response.status} ${response.statusText}`,
      response: errorText,
      paid: response.status !== 402 // If not 402, payment might have worked but API failed
    };
  }
}

async function main() {
  try {
    const args = parseArgs();
    
    if (args.help || !args.url) {
      showHelp();
      process.exit(args.help ? 0 : 1);
    }
    
    console.log("🔥 Fuego Universal x402 Payment CLI");
    console.log("=" + "=".repeat(50));
    
    const result = await makeX402Request(args);
    
    // Output JSON for agent consumption
    console.log("\n" + JSON.stringify(result, null, 2));
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error("\n💥 Error:", (error as Error).message);
    
    const errorResult = {
      success: false,
      error: (error as Error).message,
      paid: false
    };
    
    console.log("\n" + JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { makeX402Request };