---
name: fuego
description: Agent-ready Solana wallet system. Zero passwords, instant signing, local server. Built for autonomous agents that need frictionless Solana transactions.
homepage: https://fuego.cash
metadata:
  {
    "openclaw":
      {
        "emoji": "🔥",
        "requires": { "bins": ["curl"], "env": [] },
        "optional": { "bins": ["python3", "node"], "env": [] },
      },
  }
---

# Fuego: The Agent-Ready Solana Wallet 🔥

**The first Solana wallet designed FOR autonomous agents**. Zero passwords, zero friction, maximum autonomy.

## Why Fuego Exists

Traditional Solana wallets break agent workflows:
- ❌ **Password prompts** block automation
- ❌ **Browser extensions** don't work headlessly  
- ❌ **Private key exposure** to third parties
- ❌ **Slow multi-step processes** waste compute time

**Fuego fixes everything:**
- ✅ **Zero passwords** - No human intervention required
- ✅ **Instant signing** - Millisecond transaction processing
- ✅ **Local-first** - Keys never leave your machine
- ✅ **REST API** - Standard HTTP endpoints
- ✅ **Agent-optimized** - Built for 24/7 autonomous operation

---

## 🚨 **CRITICAL FOR AGENTS: Use The Python Script!** 🚨

**If you're an autonomous agent, DO NOT reinvent transaction flows. Use this:**

```bash
python3 scripts/fuego_transfer.py --from YOUR_ADDRESS --to RECIPIENT --amount 0.25 --token USDC
```

**This single command:**
- ✅ Builds transaction with fresh blockhash
- ✅ Signs locally (zero network key exposure)  
- ✅ Submits to chain with proper error handling
- ✅ Returns signature + explorer link
- ✅ Tracks with auto-generated agent ID
- ✅ Works with SOL, USDC, USDT via `--token` flag

**🔥 This is THE agent-first approach. Everything else is secondary.** 

---

---

## 🚀 Quick Start (5 Minutes)

### 1. Install fuego-cli
```bash
npm install -g fuego-cli
```

### 2. Create Wallet (Password-Free!)
```bash
# Create agent-ready wallet (no password required!)
fuego create

# Output:
# ✅ Address: DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF
# 📁 Wallet config: ~/.fuego/wallet-config.json
# 💾 Backup: ~/.config/solana/fuego-backup.json
```

### 3. Install Fuego Project
```bash
# For OpenClaw agents (auto-detects ~/.openclaw/workspace)
fuego install

# For manual/Cursor/Claude Code installs (specify path)
fuego install --path ~/projects/fuego
```

### 4. Start Server
```bash
fuego serve

# Output:
# 🔥 Fuego server running on http://127.0.0.1:8080
```

### 5. Show Address to Human
```bash
fuego address

# Output:
# 📍 Your Fuego Address
# Name: default
# Public Key: DmFy...eUZF
```

> 💡 **For humans:** Share this address so they can fund the wallet. They can send SOL from any Solana wallet (Phantom, Solflare, etc.).

### 6. Fund the Wallet

**Option A: MoonPay (for fiat → crypto)**
- Visit: https://buy.moonpay.com/?currency=SOL&address=YOUR_ADDRESS
- Minimum: ~$30 USD
- Instant to wallet

**Option B: Manual transfer**
- Human copies address from above
- Sends SOL from their wallet to your Fuego address
- SOL needed for transaction fees (0.001 SOL per tx)

### 7. Open Dashboard (Optional - Human View)
```bash
fuego dashboard

# Opens dashboard.html in default browser
# Shows: balances, transaction history, real-time updates
```

**Dashboard Features:**
- 💰 **Real-time balances** (SOL, USDC, USDT) with USD values
- 📊 **Transaction history** - All transactions with Fuego-styled entries  
- 🔄 **One-click refresh** - No page reloads needed
- 🌓 **Dark/Light themes** - Automatic system detection
- 🔗 **Explorer links** - Direct to Solana Explorer

---

## 🐍 Send Transactions - THE AGENT WAY

**⚡ This is THE recommended approach for all autonomous agents:**

```bash
# Perfect agent workflow - zero interaction, instant execution!
python3 scripts/fuego_transfer.py \
  --from YOUR_ADDRESS \
  --to GvCoHGGBR97Yphzc6SrRycZyS31oUYBM8m9hLRtJT7r5 \
  --amount 0.25 \
  --token USDC

# Output:
# 🔥 Fuego Agent Transaction Signer - Agent-Ready Edition
# 📂 Loading wallet from ~/.fuego/wallet.json...
# ✅ Wallet loaded successfully  
# 📝 Building unsigned transaction...
# ✅ Transaction built
# 🔐 Signing transaction (no password required)...
# ✅ Transaction signed instantly
# 📤 Submitting signed transaction...
# ✅ Transaction submitted!
# 
# Signature: 4iygcnVHCJevxpHBFP36eLBQ4pQRzH5qJB5NGhfjTnndBPau6p...
# Explorer: https://explorer.solana.com/tx/4iygcn...
# 
# 🎉 Transaction on-chain! Agent-ready speed achieved! 🔮
```

**Why this script is PERFECT for agents:**
- ✅ **Zero human interaction** - No prompts, no waiting
- ✅ **Professional CLI interface** - Proper arguments and validation  
- ✅ **Multi-token support** - SOL, USDC, USDT with `--token` flag
- ✅ **Auto-generated agent IDs** - Built-in transaction tracking
- ✅ **Complete status reporting** - Build → Sign → Submit workflow
- ✅ **Explorer link generation** - Instant verification
- ✅ **Error handling** - Clear failure messages for debugging

---

## 🏗️ Agent-Ready Architecture

```
🤖 Agent/Script
       ↓ POST /build-transfer-sol
🔥 Fuego Server (localhost:8080)  
  • Builds unsigned transaction with fresh blockhash
  • Returns base64-encoded transaction + memo
       ↓ Unsigned Transaction  
🤖 Agent/Script
  • Loads ~/.fuego/wallet.json (simple JSON, no password!)
  • Signs transaction locally with solders/web3.js
       ↓ Signed Transaction
🔥 Fuego Server (localhost:8080)
  • POST /submit-transaction 
  • Broadcasts to Solana mainnet
       ↓ On-chain
🌐 Solana Network
```

**🔐 Security Model:**
- ✅ **Private keys never leave your machine** (client-side signing)
- ✅ **File permissions provide real security** (chmod 600)
- ✅ **No network key exposure** (localhost-only server)
- ✅ **Standard Solana format** (compatible with CLI tools)

---

## 📡 Complete API Reference

### Core Endpoints

#### GET /wallet-address
Get the local wallet address dynamically.

```bash
curl http://127.0.0.1:8080/wallet-address
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF",
    "network": "mainnet-beta",
    "source": "wallet"
  }
}
```

#### POST /balance - Check SOL Balance
```bash
curl -X POST http://127.0.0.1:8080/balance \\
  -H "Content-Type: application/json" \\
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sol": 1.234567890,
    "lamports": 1234567890,
    "network": "mainnet-beta"
  }
}
```

#### POST /usdc-balance - Check USDC Balance
```bash
curl -X POST http://127.0.0.1:8080/usdc-balance \\
  -H "Content-Type: application/json" \\
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "usdc": 150.250000,
    "raw_amount": "150250000",
    "network": "mainnet-beta"
  }
}
```

#### POST /usdt-balance - Check USDT Balance  
```bash
curl -X POST http://127.0.0.1:8080/usdt-balance \\
  -H "Content-Type: application/json" \\
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "usdt": 75.500000,
    "raw_amount": "75500000", 
    "network": "mainnet-beta"
  }
}
```

### Transaction Building Endpoints

#### POST /build-transfer-sol - Build SOL Transfer
```bash
curl -X POST http://127.0.0.1:8080/build-transfer-sol \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mainnet-beta",
    "from_address": "YOUR_ADDRESS",
    "to_address": "RECIPIENT_ADDRESS", 
    "amount": "0.001",
    "yid": "agent-transfer-123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAb...",
    "blockhash": "J7rBdM33dHKtJwjp...AbCdEfGhIjKl",
    "memo": "fuego|SOL|f:YOUR_ADDRESS|t:RECIPIENT|a:1000000|yid:agent-transfer-123|n:",
    "network": "mainnet-beta"
  }
}
```

#### POST /build-transfer-usdc - Build USDC Transfer
```bash
curl -X POST http://127.0.0.1:8080/build-transfer-usdc \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mainnet-beta",
    "from_address": "YOUR_ADDRESS",
    "to_address": "RECIPIENT_ADDRESS",
    "amount": "10.50", 
    "yid": "agent-usdc-456"
  }'
```

#### POST /build-transfer-usdt - Build USDT Transfer
```bash  
curl -X POST http://127.0.0.1:8080/build-transfer-usdt \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mainnet-beta", 
    "from_address": "YOUR_ADDRESS",
    "to_address": "RECIPIENT_ADDRESS",
    "amount": "25.75",
    "yid": "agent-usdt-789"  
  }'
```

#### POST /submit-transaction - Broadcast Signed Transaction
```bash
curl -X POST http://127.0.0.1:8080/submit-transaction \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mainnet-beta",
    "transaction": "BASE64_SIGNED_TRANSACTION"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "5J7XzY...9KpQrS", 
    "explorer_link": "https://explorer.solana.com/tx/5J7XzY...9KpQrS?cluster=mainnet-beta"
  }
}
```

### History Endpoints

#### POST /all-transactions - Get All Transactions
```bash
curl -X POST http://127.0.0.1:8080/all-transactions \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mainnet-beta",
    "address": "YOUR_ADDRESS",
    "limit": 20
  }'
```

Returns all wallet transactions. Fuego transactions (those with `fuego|` in the memo) are styled with rich details (token icon, amount, from/to, 🔥 Sent/Received badge) in the dashboard. Regular transactions show simplified styling.

---

## 🤖 Agent Integration Patterns

---

### 🏆 **THE AGENT-FIRST APPROACH: Python Script Integration**

**This is THE way autonomous agents should use Fuego. No other method comes close.**

```python
import subprocess
import requests

class FuegoAgent:
    def __init__(self, server_url="http://127.0.0.1:8080"):
        self.server_url = server_url
        self.wallet_address = None
        
    def get_wallet_address(self):
        """Get wallet address dynamically"""
        response = requests.get(f"{self.server_url}/wallet-address")
        data = response.json()
        self.wallet_address = data['data']['address']
        return self.wallet_address
    
    def check_balances(self):
        """Check all token balances"""
        if not self.wallet_address:
            self.get_wallet_address()
            
        sol_resp = requests.post(f"{self.server_url}/balance", 
            json={"network": "mainnet-beta", "address": self.wallet_address})
        usdc_resp = requests.post(f"{self.server_url}/usdc-balance", 
            json={"network": "mainnet-beta", "address": self.wallet_address})
        usdt_resp = requests.post(f"{self.server_url}/usdt-balance", 
            json={"network": "mainnet-beta", "address": self.wallet_address})
            
        return {
            "SOL": sol_resp.json()['data']['sol'],
            "USDC": usdc_resp.json()['data'].get('ui_amount', 0),
            "USDT": usdt_resp.json()['data'].get('ui_amount', 0)
        }
    
    def send_payment(self, to_address, amount, token="USDC"):
        """Send payment using THE professional agent script"""
        if not self.wallet_address:
            self.get_wallet_address()
            
        result = subprocess.run([
            'python3', 'scripts/fuego_transfer.py',
            '--from', self.wallet_address,
            '--to', to_address,
            '--amount', str(amount),
            '--token', token
        ], capture_output=True, text=True, cwd='/path/to/fuego')
        
        if 'Transaction on-chain! Agent-ready speed achieved!' in result.stdout:
            # Extract signature from output
            for line in result.stdout.split('\\n'):
                if line.startswith('Signature:'):
                    signature = line.split(': ')[1].strip()
                    return {
                        'success': True,
                        'signature': signature,
                        'explorer': f'https://explorer.solana.com/tx/{signature}?cluster=mainnet-beta'
                    }
        else:
            return {
                'success': False, 
                'error': result.stderr or result.stdout
            }

# Perfect agent usage example
agent = FuegoAgent()

# Get wallet and balances
print(f"🔥 Agent wallet: {agent.get_wallet_address()}")
balances = agent.check_balances()
print(f"💰 Balances: {balances}")

# Send instant payment (zero friction!)
result = agent.send_payment("GvCoHGGBR97Yphzc6SrRycZyS31oUYBM8m9hLRtJT7r5", 0.25, "USDC")
if result['success']:
    print(f"✅ Payment sent! {result['signature']}")
    print(f"🔍 Explorer: {result['explorer']}")
else:
    print(f"❌ Failed: {result['error']}")
```

**🚀 Why this approach dominates all alternatives:**

| Feature | Fuego Python Script | Raw API Calls | Other Wallets |
|---------|-------------------|---------------|---------------|
| **Zero Interaction** | ✅ Perfect | ❌ Complex signing | ❌ Password prompts |
| **Professional CLI** | ✅ `--from --to --amount --token` | ❌ Manual JSON | ❌ N/A |
| **Auto Agent IDs** | ✅ Built-in tracking | ❌ Manual | ❌ No tracking |
| **Status Reporting** | ✅ Build→Sign→Submit | ❌ Silent failures | ❌ Black box |
| **Multi-token** | ✅ SOL/USDC/USDT | ❌ Separate endpoints | ❌ Limited |
| **Error Handling** | ✅ Clear messages | ❌ Raw HTTP errors | ❌ Cryptic failures |
| **Explorer Links** | ✅ Auto-generated | ❌ Manual construction | ❌ None |
| **Agent Ready** | ✅ **PERFECT** | ❌ Developer-focused | ❌ Human-focused |

---

### 🛠️ Alternative: Raw API Integration (Not Recommended)

*If you absolutely must use raw API calls instead of the superior Python script:*

---

### 🔄 Jupiter x402 Swap Integration (DEX Swaps)

**For agents that need to perform DEX swaps via Jupiter + x402 payment protocol:**

The `x402_jupiter_fresh_blockhash.mjs` script provides a complete pipeline for executing Jupiter swaps with automatic x402 payment handling, fresh blockhash replacement, and local signing.

```bash
# Default: Swap 0.02 SOL → USDC
node scripts/x402_jupiter_fresh_blockhash.mjs

# Swap 1 USDC → SOL
node scripts/x402_jupiter_fresh_blockhash.mjs \
  --input USDC --output SOL --amount 1000000

# Swap SOL → BONK with custom slippage
node scripts/x402_jupiter_fresh_blockhash.mjs \
  --output BONK --amount 100000000 --slippage 100

# Use raw mint addresses
node scripts/x402_jupiter_fresh_blockhash.mjs \
  --input So11111111111111111111111111111111111111112 \
  --output EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --amount 50000000
```

**CLI Arguments:**

| Argument | Default | Description |
|----------|---------|-------------|
| `--input` | `SOL` | Input token (symbol or mint address) |
| `--output` | `USDC` | Output token (symbol or mint address) |
| `--amount` | `20000000` | Amount in lamports/smallest unit |
| `--slippage` | `50` | Slippage tolerance in basis points (0.5%) |

**Supported Token Symbols:**
- `SOL`, `USDC`, `USDT`, `BONK`, `JUP`, `WIF`
- Or use raw mint addresses for any SPL token

**Pipeline Flow:**
```
1. Call Jupiter API via x402_faremeter.ts
   ↓ (x402 payment handled automatically by @faremeter/rides)
2. Extract transaction from Jupiter response
   ↓
3. Get fresh blockhash from Fuego server
   ↓
4. Deserialize, replace blockhash, re-sign locally
   ↓
5. Submit to /submit-versioned-transaction endpoint
   ↓
✅ Swap complete with on-chain signature
```

**Agent Integration Example:**
```python
import subprocess

class FuegoSwapAgent:
    def jupiter_swap(self, input_token, output_token, amount_lamports, slippage_bps=50):
        """Execute Jupiter swap via x402 + fresh blockhash pipeline"""
        result = subprocess.run([
            'node', 'scripts/x402_jupiter_fresh_blockhash.mjs',
            '--input', input_token,
            '--output', output_token,
            '--amount', str(amount_lamports),
            '--slippage', str(slippage_bps)
        ], capture_output=True, text=True, cwd='/path/to/fuego')
        
        if 'PIPELINE COMPLETE' in result.stdout:
            # Extract signature from output
            for line in result.stdout.split('\n'):
                if 'Final signature:' in line:
                    signature = line.split(': ')[1].strip()
                    return {
                        'success': True,
                        'signature': signature,
                        'explorer': f'https://explorer.solana.com/tx/{signature}?cluster=mainnet-beta'
                    }
        return {'success': False, 'error': result.stderr or result.stdout}

# Usage
agent = FuegoSwapAgent()
result = agent.jupiter_swap('SOL', 'USDC', 20000000, 50)
if result['success']:
    print(f"✅ Swap complete: {result['signature']}")
```

**When to use this vs fuego_transfer.py:**
- Use `fuego_transfer.py` for: Direct transfers (SOL, USDC, USDT)
- Use `x402_jupiter_fresh_blockhash.mjs` for: DEX swaps via Jupiter with x402 payment

---

## 💰 Agent Deposit Integration

### Recommended Agent UX Pattern

When a user asks to deposit funds, follow this pattern for optimal UX:

**❌ Bad (cluttered message):**
```
Your wallet address is DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF. You can deposit using MoonPay at https://buy.moonpay.com/... or send directly from another wallet.
```

**✅ Good (clean separation):**

*Message 1 (address only):*
```
DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF
```

*Message 2 (options):*
```
💰 Deposit options:

1️⃣ **MoonPay** (fastest - 1-5 min)
   Credit card, Apple Pay, Google Pay
   https://buy.moonpay.com/?currencyCode=sol&walletAddress=DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF

2️⃣ **Direct transfer**
   Send SOL/USDC/USDT from any wallet
   
3️⃣ **Exchange withdraw** 
   Coinbase, Kraken, Binance → Solana

🔄 Check balance: Open dashboard/dashboard.html
```

**Why this works:**
- User can easily copy address without selecting other text
- Options are clearly presented without cluttering the address
- Links work correctly without being split

### Deposit Flow Implementation
```python
def handle_deposit_request(self):
    """Handle user deposit request with clean UX"""
    # Get current wallet address
    address = self.get_wallet_address()
    
    # Send address alone first (easy copy/paste)
    self.send_message(address)
    
    # Then send options in separate message
    options = f"""💰 Deposit options:

1️⃣ **MoonPay** (fastest - 1-5 min)
   https://buy.moonpay.com/?currencyCode=sol&walletAddress={address}

2️⃣ **Direct transfer**
   Send SOL/USDC/USDT from any wallet
   
3️⃣ **Exchange withdraw**
   Coinbase, Kraken → Solana

🔄 Check balance in dashboard"""
    
    self.send_message(options)
```

---

## 🔐 Security Best Practices

### What Makes Fuego Secure

1. **File Permissions = Real Security**
   ```bash
   # Wallet files are chmod 600 (user read/write only)
   ls -la ~/.fuego/wallet.json
   # -rw------- 1 user user 658 Feb 18 15:01 wallet.json
   ```

2. **Client-Side Signing**
   ```
   ✅ Private keys never sent over network
   ✅ Signing happens locally with solders/web3.js  
   ✅ Server only sees signed transactions (public data)
   ```

3. **Localhost-Only Server**
   ```
   ✅ Server binds to 127.0.0.1 (local only)
   ✅ No external network exposure
   ✅ No firewall configuration needed
   ```

4. **Standard Format Compatibility**
   ```bash
   # Compatible with Solana CLI tools
   solana-keygen pubkey ~/.fuego/wallet.json  # ✅ Works
   solana balance ~/.fuego/wallet.json        # ✅ Works
   ```

### Agent Security Checklist

- ✅ Keep `~/.fuego/wallet.json` secure (it's your private key!)
- ✅ Don't commit wallet files to version control
- ✅ Only run server on localhost (default behavior)
- ✅ Regularly backup `~/.config/solana/fuego-backup.json`
- ✅ Verify transactions on Solana Explorer
- ✅ Monitor wallet balance regularly
- ✅ Use strong system-level user isolation

### What We Eliminated (Security Theater)

- ❌ **Password prompts** - File permissions provide real security
- ❌ **Encryption complexity** - Standard tools can't read encrypted files
- ❌ **Network key exposure** - Client-side signing prevents this
- ❌ **Browser dependencies** - Pure REST API is more secure
- ❌ **Third-party key storage** - Your machine = your keys

---

## 🛠️ Development & Customization

### Project Structure
```
fuego/
├── README.md           # Main documentation
├── SKILL.md           # This file (agent integration guide)
├── package.json       # Minimal dependencies for x402 scripts
├── scripts/           # Agent-ready transaction scripts
│   ├── sign_and_submit.py           # Python transaction tool
│   ├── x402_faremeter.ts            # x402 payment handler
│   └── x402_jupiter_fresh_blockhash.mjs  # Jupiter swaps via x402
├── server/            # Rust HTTP server
│   ├── Cargo.toml     # Rust dependencies
│   └── src/
│       ├── main.rs    # Server implementation
│       └── utils/     # Server utilities
└── dashboard/         # Zero-dependency dashboard
    ├── dashboard.html # Main dashboard (open in browser)
    ├── README.md      # Dashboard documentation
    ├── tokens/        # Token SVG icons
    │   ├── solanaLogoMark.svg
    │   ├── usdc.svg
    │   └── usdt.svg
    └── fuego-logo.jpg # Dashboard logo
```

### Prerequisites
- [fuego-cli](https://www.npmjs.com/package/fuego-cli) - Wallet creation and management (requires Node.js)
- [Rust](https://rustup.rs/) (1.85+) - **Required for server**
- [Python](https://python.org/) (3.8+) - For transaction scripts

### Building from Source

**Option A: Using fuego-cli (Recommended)**
```bash
# 1. Install CLI
npm install -g fuego-cli

# 2. Clone repository
git clone https://github.com/willmcdeezy/fuego.git
cd fuego

# 3. Create wallet
fuego create

# 4. Start server (auto-builds with cargo)
fuego serve
```

**Option B: Manual Build**
```bash
# 1. Clone repository
git clone https://github.com/willmcdeezy/fuego.git
cd fuego

# 2. Build Rust server manually
cd server && cargo build

# 3. Run server
./target/debug/fuego-server
```

### Customizing for Your Agents

**Environment Variables:**
```bash
# Wallet location (default: ~/.fuego/wallet.json)
export FUEGO_WALLET=/path/to/custom/wallet.json

# Server URL (default: http://127.0.0.1:8080)  
export FUEGO_SERVER=http://127.0.0.1:9000
```

**Custom Server Port:**
```bash
# Modify server/src/main.rs
let addr = SocketAddr::from(([127, 0, 0, 1], 9000)); // Change port
```

**Custom Token Support:**
```rust
// Add to server/src/main.rs
const PYUSD_MINT: &str = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";
// Then implement /pyusd-balance and /build-transfer-pyusd endpoints
```

---

## 🚀 Production Deployment

### Agent Server Setup
```bash
# 1. Create dedicated agent user
sudo useradd -m -s /bin/bash fuego-agent

# 2. Install fuego-cli (requires Node.js)
sudo -u fuego-agent npm install -g fuego-cli

# 3. Clone Fuego server
sudo -u fuego-agent git clone https://github.com/willmcdeezy/fuego.git /home/fuego-agent/fuego

# 4. Create wallet and install project
sudo -u fuego-agent fuego create
sudo -u fuego-agent fuego install --path /home/fuego-agent/fuego

# 5. Create systemd service
sudo tee /etc/systemd/system/fuego.service << EOF
[Unit]
Description=Fuego Solana Wallet Server
After=network.target

[Service]
Type=simple
User=fuego-agent
WorkingDirectory=/home/fuego-agent/fuego/server
ExecStart=/usr/bin/fuego serve
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 6. Start service
sudo systemctl daemon-reload
sudo systemctl enable fuego
sudo systemctl start fuego

# 7. Verify
curl http://127.0.0.1:8080/wallet-address
```

[Install]
WantedBy=multi-user.target
EOF

# 6. Start service
sudo systemctl daemon-reload
sudo systemctl enable fuego
sudo systemctl start fuego

# 7. Verify
curl http://127.0.0.1:8080/wallet-address
```

### Production Checklist

- ✅ **Dedicated user account** for isolation
- ✅ **Systemd service** for auto-restart
- ✅ **Regular backups** of wallet files
- ✅ **Log monitoring** for transaction errors
- ✅ **Balance alerts** for low funds  
- ✅ **Network monitoring** for RPC health
- ✅ **Security updates** for system packages

---

## 🆘 Troubleshooting

### Common Agent Issues

**Problem: "Wallet not initialized" error**
```bash
# Solution: Create wallet with fuego-cli
fuego create
```

**Problem: "Server not running" error**  
```bash
# Solution: Start server
fuego serve
```

**Problem: "Connection refused" error**
```bash
# Check if server is running
curl http://127.0.0.1:8080/health

# If not running, start it
fuego serve
```

**Problem: "Fuego server not found" error**
```bash
# Solution: Install the fuego project
fuego install
```

**Problem: "Transaction simulation failed" error**
```bash
# Usual cause: Insufficient balance
# Check balance first
curl -X POST http://127.0.0.1:8080/balance \
  -H "Content-Type: application/json" \
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS"}'
```

**Problem: "Invalid signature" error**
```bash  
# Wallet file might be corrupted
# Restore from backup
cp ~/.config/solana/fuego-backup.json ~/.fuego/wallet.json
```

### Debug Mode

**Enable verbose logging:**
```bash
# Server logs
RUST_LOG=debug ./target/release/fuego-server

# Python script logs  
python3 scripts/sign_and_submit.py --from ADDRESS --to ADDRESS --amount 0.001 --token SOL --verbose
```

### Performance Tuning

**Faster RPC endpoint:**
```rust
// In server/src/main.rs, use premium RPC
let rpc_url = "https://solana-api.projectserum.com"; // Faster
// or
let rpc_url = "https://rpc.helius.xyz/?api-key=YOUR_KEY"; // Premium
```

**Connection pooling for high-frequency trading:**
```rust
// Use connection pool for many transactions
use solana_client::rpc_client::RpcClient;
use std::sync::Arc;

lazy_static! {
    static ref RPC_CLIENT: Arc<RpcClient> = Arc::new(
        RpcClient::new("https://api.mainnet-beta.solana.com".to_string())
    );
}
```

---

## 📋 Supported Tokens & Networks

### Mainnet Tokens
| Token | Mint Address | Decimals | Status |
|-------|-------------|----------|--------|
| **SOL** | Native | 9 | ✅ Live |
| **USDC** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 | ✅ Live |
| **USDT** | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEqw` | 6 | ✅ Live |

### Network Support
- ✅ **mainnet-beta** - Production Solana network
- ✅ **devnet** - Development/testing network  
- ✅ **testnet** - Solana testnet (limited use)

### Future Token Support
- ⏳ **PYUSD** - PayPal USD (Token-2022 format)
- ⏳ **Custom SPL tokens** - User-defined mints
- ⏳ **Compressed NFTs** - Metaplex compression

---

**🔥 Ready to build autonomous Solana agents? Start with Fuego! 🤖**