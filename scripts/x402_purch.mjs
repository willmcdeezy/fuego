#!/usr/bin/env node
/**
 * x402_purch.mjs - Call Fuego Rust server /x402-purch to complete a Purch.xyz order with x402 payment.
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

  console.log("x402 Purch - calling Fuego server /x402-purch");
  console.log("=".repeat(60));
  console.log(`   URL: ${payload.url}`);
  console.log(`   Product: ${payload.product_url}`);
  console.log(`   Email: ${payload.email}`);
  console.log("=".repeat(60));

  let response;
  try {
    response = await fetch(`${RUST_SERVER_URL}/x402-purch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Request failed:", e.message);
    console.error(
      "   Is the Fuego server running? (e.g. cargo run in server/)",
    );
    process.exit(1);
  }

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { success: false, error: text || `HTTP ${response.status}` };
  }

  console.log("\nResponse:");
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log();
    console.log("Success -", result.x402_note || "Payment accepted.");
    console.log(`   Status: ${result.status}`);
    if (result.data?.orderId) {
      console.log();
      console.log("Order ID:", result.data.orderId);
    }
    return;
  }

  console.log();
  console.log(
    "Request failed:",
    result.error || result.status || response.status,
  );
  process.exit(1);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
