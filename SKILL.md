---
name: fuego
description: Secure agent-ready Solana wallet + local RPC server. Download, run a binary, and sign/submit transactions from agents with zero private key exposure.
homepage: https://github.com/willmcdeezy/fuego
metadata:
  {
    "openclaw":
      {
        "emoji": "🔥",
        "requires": { "bins": ["curl"], "env": [] },
        "optional": { "bins": ["python3", "python3-pip"] },
      },
  }
---

# Fuego: Secure Agent Solana Wallet 🔥

Fuego is an **agent-ready Solana wallet system** designed for autonomous agents to transact on Solana without exposing private keys to RPCs.

## Architecture

```
Agent (Python/TypeScript)
    ↓ (builds request)
FuegoServer (compiled binary, localhost:8080)
    ↓ (local signing with encrypted wallet)
POST /submit-transaction
    ↓ (broadcasts only - server never touches keys)
Solana RPC (mainnet-beta)
```

**Key security property**: Private keys stay on your machine. Server is a pure RPC proxy.

---

## Quick Start (For Agents)

### 1. Get Your Wallet Address

When setting up Fuego, agents should **always send the wallet address as a solo message** for easy copy/paste:

```
Agent: "What's my Fuego wallet address?"
```

**Response should be**:
```
FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL
```

Then in next message, provide onramp options (see Deposits below).

### 2. Download Fuego

```bash
# Clone the repo with all scripts
git clone https://github.com/willmcdeezy/fuego.git
cd fuego
```

### 3. Download Pre-Compiled Server Binary

Get the latest server binary from GitHub releases (no building required):

```bash
# macOS / Linux
curl -L https://github.com/willmcdeezy/fuego/releases/download/v0.1.0/fuego-server -o fuego-server
chmod +x fuego-server

# Windows
curl -L https://github.com/willmcdeezy/fuego/releases/download/v0.1.0/fuego-server.exe -o fuego-server.exe
```

### 3. Start the Server

```bash
./fuego-server
# Output: 🔥 Fuego server running on http://127.0.0.1:8080
```

### 4. Open Dashboard (Check Balances)

Open `dashboard.html` in your browser:

```bash
# macOS
open dashboard.html

# Linux
firefox dashboard.html

# Windows
start dashboard.html
```

Or open in browser: `file:///path/to/fuego/dashboard.html`

**Dashboard shows**:
- SOL balance
- USDC balance
- USDT balance
- Links to MoonPay for deposits
- Direct wallet address for manual transfers

### 5. Use Python or TypeScript to Sign & Submit

**Python** (simplest for agents):
```bash
pip install solders base58
python3 scripts/sign_and_submit.py --from YOUR_ADDRESS --to RECIPIENT --amount 10.5
```

**TypeScript** (if you prefer):
```bash
npm install
npm run sign-and-submit
```

---

## Deposits: Get SOL or Stablecoins 💰

**Agent UX Pattern**: When user asks to deposit, respond with address in **solo message**, then onramp options in next message.

### Best Onramps

**1. MoonPay (Recommended - Fastest)**
- Supports: Credit card, debit card, Apple Pay, Google Pay
- Speed: 1-5 minutes
- Coverage: 160+ countries
- Link: `https://buy.moonpay.com/?currencyCode=sol&walletAddress={ADDRESS}`
- Can buy: SOL, USDC, USDT

**2. Direct Wallet Transfer (if user has crypto elsewhere)**
- Speed: 5-30 seconds
- Cost: Minimal network fee
- How: Copy your address from dashboard, send SOL/USDC/USDT from any wallet

**3. Coinbase / Kraken (if user has account)**
- Withdraw to Solana address
- May take 10-30 minutes
- Lower fees than MoonPay

**4. Magic Eden Launchpad**
- If user has existing SOL, can buy tokens
- Or use to bridge from other chains

### Recommended Flow for Agents

```
User: "I want to deposit SOL"
Agent: "FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL"
[one message with address only - easy copy/paste]

Agent: "Options to deposit:
1️⃣ MoonPay (fastest): https://buy.moonpay.com/...
2️⃣ From your exchange (Coinbase, Kraken)
3️⃣ Direct transfer if you have crypto
4️⃣ Open dashboard.html to see live balance"
```

**Key principle**: Address **alone in message** → Options in **next message**.
Makes it easy for users to copy without other text getting selected.

---

## Core Workflow

### Step 1: Build Unsigned Transaction (Server)

**Request** to `POST /build-transfer-usdc`:
```json
{
  "network": "mainnet-beta",
  "from_address": "YOUR_WALLET_ADDRESS",
  "to_address": "RECIPIENT_ADDRESS",
  "amount": "10.5",
  "yid": "agent-123-tx-001"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction": "base64-encoded-unsigned-tx",
    "blockhash": "...",
    "memo": "fuego|USDC|f:...|t:...|a:10500000|yid:agent-123-tx-001",
    "network": "mainnet-beta"
  }
}
```

### Step 2: Sign with Fuego Wallet (Client)

```python
# Sign locally with your encrypted wallet
from fuego.wallet import FuegoWallet
from solders.transaction import Transaction
import base64

# Load wallet (prompts for password)
wallet = FuegoWallet.load("~/.fuego/wallet.json")

# Deserialize unsigned tx from server
tx_bytes = base64.b64decode(response['data']['transaction'])
tx = Transaction.from_bytes(tx_bytes)

# Sign with local keypair
tx.sign([wallet.keypair])

# Serialize signed tx
signed_tx_b64 = base64.b64encode(tx.to_bytes()).decode()
```

### Step 3: Submit Signed Transaction (Server)

**Request** to `POST /submit-transaction`:
```json
{
  "network": "mainnet-beta",
  "transaction": "base64-signed-tx"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "signature": "...",
    "explorer_link": "https://explorer.solana.com/tx/...?cluster=mainnet-beta",
    "network": "mainnet-beta",
    "status": "submitted"
  }
}
```

✅ Click the `explorer_link` to verify on-chain immediately!

---

## Available Endpoints

### Read Endpoints

**Get SOL Balance**:
```bash
curl -X POST http://127.0.0.1:8080/balance \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "address": "YOUR_ADDRESS"
  }'
```

**Get USDC Balance**:
```bash
curl -X POST http://127.0.0.1:8080/usdc-balance \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "address": "YOUR_ADDRESS"
  }'
```

**Get USDT Balance**:
```bash
curl -X POST http://127.0.0.1:8080/usdt-balance \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "address": "YOUR_ADDRESS"
  }'
```

**Get Latest Blockhash**:
```bash
curl -X POST http://127.0.0.1:8080/latest-hash \
  -H "Content-Type: application/json" \
  -d '{"network": "mainnet-beta"}'
```

### Transfer Endpoints

**Build USDC Transfer**:
```bash
curl -X POST http://127.0.0.1:8080/build-transfer-usdc \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "from_address": "...",
    "to_address": "...",
    "amount": "10.5",
    "yid": "unique-tx-id"
  }'
```

**Build SOL Transfer**:
```bash
curl -X POST http://127.0.0.1:8080/build-transfer-sol \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "from_address": "...",
    "to_address": "...",
    "amount": "0.1",
    "yid": "unique-tx-id"
  }'
```

**Build USDT Transfer**:
```bash
curl -X POST http://127.0.0.1:8080/build-transfer-usdt \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "from_address": "...",
    "to_address": "...",
    "amount": "100",
    "yid": "unique-tx-id"
  }'
```

**Submit Signed Transaction**:
```bash
curl -X POST http://127.0.0.1:8080/submit-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "transaction": "base64-signed-tx"
  }'
```

---

## Scripts

All scripts are in `{baseDir}/scripts/` and work with the running server.

### Python Scripts (Agents)

**`sign_and_submit.py`** - Complete workflow
```bash
python3 scripts/sign_and_submit.py \
  --from YOUR_ADDRESS \
  --to RECIPIENT_ADDRESS \
  --amount 10.5 \
  --wallet ~/.fuego/wallet.json
```

Prompts for:
1. Wallet password (unlocks FuegoWallet)
2. Confirms transaction details
3. Submits and prints explorer link

### TypeScript Scripts (Advanced)

**`sign-and-submit.ts`** - Same workflow in TypeScript
```bash
npm install
npm run sign-and-submit
```

---

## Wallet Setup

First time only:

```bash
# Initialize encrypted wallet
fuego-wallet init

# Creates: ~/.fuego/wallet.json
# Prompts: Create a password (used to encrypt keypair)
# Generates: Random keypair, encrypted with Argon2 + AES-256-GCM
```

**Never store the password in code.** Each script prompts for it interactively.

---

## Security Best Practices

✅ **DO**:
- Keep wallet password strong and unique
- Store `~/.fuego/wallet.json` safely (encrypted, but protect the file)
- Use environment variables for agent addresses (`FROM_ADDRESS`, etc.)
- Verify explorer links before trusting tx signatures
- Keep server binary updated

❌ **DON'T**:
- Commit wallet files to git
- Share wallet password
- Use plaintext config files with addresses
- Run server on public networks (use localhost only)
- Store private keys elsewhere; Fuego wallet **is** the only key storage

---

## Configuration

All config is runtime:
- `--network` (default: mainnet-beta) - Switch to devnet/testnet
- `--commitment` (default: confirmed) - Use processed/finalized for balances
- `--port` (default: 8080) - Server port

Example:
```bash
# Use devnet instead
./fuego-server --network devnet

# Or in scripts:
python3 scripts/sign_and_submit.py --network devnet
```

---

## Troubleshooting

**"Failed to decode transaction"**
- Ensure base64 encoding is correct
- Verify server returned transaction field in response

**"Failed to deserialize transaction"**
- Blockhash may have expired (valid ~60 seconds)
- Request fresh blockhash from `/latest-hash` and rebuild

**"Invalid from_address"**
- Check address format (should be base58)
- Copy-paste from Phantom or Solflare

**Server won't start**
- Check port 8080 isn't in use: `lsof -i :8080`
- Try different port: `./fuego-server --port 8081`

---

## Development

Want to contribute or modify Fuego?

1. Clone: `git clone https://github.com/willmcdeezy/fuego.git`
2. Checkout dev: `git checkout dev`
3. Build server: `cd server && cargo build --release`
4. Build wallet: `cd ../src && npm run build`
5. Test: `npm test`
6. PR to dev branch

**Tech stack**:
- **Wallet**: TypeScript + tweetnacl + Argon2
- **Server**: Rust + Axum + Solana SDK
- **Scripts**: Python (solders) or TypeScript (solders)

---

## Agent Communication Best Practices

When helping users with Fuego, follow this pattern:

### Showing Wallet Address
**Always solo message** (makes copy/paste easier):
```
Agent: "Your Fuego wallet address:"

User clicks → Easy to copy just the address

[Next message with options]
```

**NOT** (hard to copy, text gets selected):
```
Your wallet: FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL
Here's your address! Send SOL or USDC to this...
```

### Offering Deposit Options
Separate address from options:
1. **First message**: Address only
2. **Second message**: "Want to deposit? Options are..."

This follows UX best practice of not cluttering critical info.

---

## What's Next?

- [ ] Hardware wallet support (Ledger/Trezor)
- [ ] Transaction history + audit logs
- [ ] PYUSD support (Token-2022)
- [ ] Batch operations
- [ ] Docker container for server
- [ ] Agent integration templates

---

## License & Support

MIT License - See LICENSE file

**Support**: Check GitHub Issues or ask in the community! 🚀
