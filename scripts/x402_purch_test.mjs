#!/usr/bin/env node
/**
 * x402_purch_test.mjs - Test x402 purchase flow (returns payment required)
 * 
 * Usage:
 *   node x402_purch_test.mjs --product-url <url> --email <email> --name <name> \
 *     --address-line1 <line1> [--address-line2 <line2>] --city <city> \
 *     --state <state> --postal-code <code> [--country <US>]
 */

const RUST_SERVER_URL = process.env.FUEGO_SERVER_URL || "http://127.0.0.1:8080";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "_");
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
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
      console.error(`Missing required argument: --${field.replace(/_/g, "-")}`);
      console.error("\nUsage:");
      console.error("  node x402_purch_test.mjs \\");
      console.error("    --product-url 'https://amazon.com/dp/...' \\");
      console.error("    --email 'you@example.com' \\");
      console.error("    --name 'Your Name' \\");
      console.error("    --address-line1 '123 Main St' \\");
      console.error("    --address-line2 'Apt 4B' \\");
      console.error("    --city 'Austin' \\");
      console.error("    --state 'TX' \\");
      console.error("    --postal-code '78701' \\");
      console.error("    --country 'US' \\");
      console.error("    --max-price '5000'  # Price in USD cents (e.g., 5000 = $50.00)");
      process.exit(1);
    }
  }

  const payload = {
    url: "https://x402.purch.xyz/orders/solana",
    product_url: args.product_url,
    email: args.email,
    name: args.name,
    address_line1: args.address_line1,
    city: args.city,
    state: args.state,
    postal_code: args.postal_code,
    country: args.country || "US",
    network: args.network || "mainnet-beta",
  };
  
  if (args.address_line2) payload.address_line2 = args.address_line2;
  if (args.max_price) payload.maxPrice = parseInt(args.max_price);

  console.log("Calling Fuego server /x402-purch...");
  console.log("========================================");
  console.log("Payload:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("========================================\n");

  try {
    const response = await fetch(`${RUST_SERVER_URL}/x402-purch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    console.log("Response:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.requiresPayment) {
      console.log("\n========================================");
      console.log("Payment Required!");
      console.log(`Amount: ${result.amount} ${result.token}`);
      console.log(`To: ${result.payToAddress}`);
      console.log("========================================");
    }
    
  } catch (e) {
    console.error("Request failed:", e.message);
    console.error("Is the Fuego server running? (fuego serve)");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
