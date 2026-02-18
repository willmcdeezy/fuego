# Fuego Wallet Setup - Agent-Ready UX

**Zero passwords. Zero friction. Maximum agent autonomy.**

---

## File Structure (Standard Location)

```
~/.fuego/                      # Standard wallet location (never change)
├── wallet.json                 # Simple JSON wallet (chmod 600)
├── config.json                 # Wallet address, network, metadata
└── logs/                        # Transaction logs (optional)
```

**Why this location?**
- ✅ All Fuego scripts default to `~/.fuego/`
- ✅ Dashboard auto-discovers wallet address
- ✅ Python scripts, TypeScript SDK, HTML dashboard all expect this
- ✅ Cross-platform (Linux, macOS, Windows with WSL)
- ✅ Agent-ready (no human interaction after init!)

---

## Agent → User Setup Flow

### Step 1: Agent Checks for Wallet
```javascript
// Agent checks if wallet exists
const walletPath = `${HOME}/.fuego/wallet.json`;
if (!fs.existsSync(walletPath)) {
    // Guide user through setup
}
```

### Step 2: Agent Offers Setup
**Agent (in chat):**
> "You need a Fuego wallet. I can set it up in 30 seconds. Want me to guide you?"

**Options:**
- **"Yes, guide me"** → Agent gives one-line command
- **"I'll do it myself"** → Agent explains what happens

---

## Setup Flow (Instant & Agent-Ready)

**Agent says:**
> "Run this command, and you'll have a Solana wallet ready for instant transactions:

```bash
cd /path/to/fuego && npm run init
```

**What happens (automatic, no passwords!):**

```
🔥 Fuego Wallet Init - Agent-Ready Edition

🔑 Generating new Solana keypair...
✅ Address: DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF

✅ Wallet initialized: ~/.fuego/wallet.json
📁 Backup saved: ~/.config/solana/fuego-backup.json

✅ Agent-ready wallet created!
   • No passwords required
   • Ready for autonomous transactions
   • Instant signing (milliseconds)
```

**Agent confirms (immediately):**
> "✅ Wallet ready! Address: `DmFyLRiJ...`"

---

## Why This Is Perfect for Agents

### ❌ Traditional Wallet Setup (Agent Nightmare)
```
🔐 Enter password: _______  ← Agent can't do this
🔐 Confirm password: _______  ← Blocks automation
⏱️ Waiting for input... ← Manual intervention required
```

### ✅ Fuego Setup (Agent Paradise)
```
npm run init  ← Single command, fully automated
✅ Wallet ready  ← 30 seconds later, no human input
🤖 Agent can sign transactions  ← Zero friction
```

---

## Security Model (Real, Not Theater)

### File Permissions = Real Security
```bash
# Wallet stored with restricted permissions
ls -la ~/.fuego/wallet.json
# -rw------- (chmod 600)
# Only you can read this file
```

### Why No Passwords Needed
1. **File permissions** - Only your user can read `~/.fuego/wallet.json`
2. **Local storage** - Never sent over network
3. **Client-side signing** - Keys never exposed to server
4. **Standard format** - Compatible with Solana CLI tools

### Security Checklist
- ✅ Keep `~/.fuego/wallet.json` secure (chmod 600)
- ✅ Don't commit wallet files to git
- ✅ Backup `~/.config/solana/fuego-backup.json` to password manager
- ✅ Only run server on localhost (default behavior)
- ✅ Verify transactions on Solana Explorer

---

## Agent Integration Pattern

### Autonomous Wallet Access
```python
# Agent loads wallet with ZERO password prompts
from fuego import FuegoWallet

wallet = FuegoWallet()
wallet.load()  # No password required!
address = wallet.get_address()

# Ready to sign transactions instantly
```

### Seamless Transaction Flow
```python
# Agent can:
# 1. Check balances
balance = requests.post('http://localhost:8080/balance', ...)

# 2. Build transaction
unsigned_tx = requests.post('http://localhost:8080/build-transfer-sol', ...)

# 3. Sign locally (instant, no prompts)
signed_tx = wallet.sign(unsigned_tx)

# 4. Submit
requests.post('http://localhost:8080/submit-transaction', ...)

# All automated. Zero friction. No human intervention.
```

---

## User Perspective (5 Seconds)

**Before (traditional wallet):**
```
User: "Set up a wallet"
System: "Create password..."
User: "Types password..."
System: "Confirm password..."
User: "Types again..."
System: "Done! Now remember this password forever..."
Time: 2 minutes
Friction: High
```

**After (Fuego):**
```
User: "Set up a wallet"
Agent: "npm run init"
User: Runs one command
System: Done!
Time: 30 seconds
Friction: Zero
```

---

## File Structure Details

### wallet.json (Simple Format)
```json
{
  "privateKey": [1, 2, 3, ..., 64],  // 64-byte Solana secret key
  "address": "DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF",
  "network": "mainnet-beta"
}
```

**Why so simple?**
- ✅ Standard Solana format (compatible with CLI)
- ✅ Easy to parse in any language
- ✅ No encryption complexity (file permissions provide security)
- ✅ Human-readable for debugging
- ✅ Agent-friendly (no passwords to ask for)

### config.json (Metadata)
```json
{
  "walletAddress": "DmFyLRiJtc4Bz75hjAqPaEJpDfRe4GEnRLPwc3EgeUZF",
  "network": "mainnet-beta",
  "createdAt": 1708272000,
  "version": "0.1.0"
}
```

### Backup (Recovery)
```
~/.config/solana/fuego-backup.json
```
Standard array format, same as Solana CLI. Store in password manager or offline.

---

## Agent Checklist

When helping users with Fuego setup:

- [ ] **Run `npm run init`** - One command, fully automated
- [ ] **Confirm address** - Appears in output immediately
- [ ] **Note backup location** - `~/.config/solana/fuego-backup.json`
- [ ] **No password requests** - Zero friction by design
- [ ] **Done!** - Wallet ready for instant transactions

---

## Advanced: Custom Wallet Paths

**For special setups (not recommended for agents):**
```bash
export FUEGO_WALLET=/custom/path/wallet.json
npm run init
```

**Dashboard auto-detects:**
```javascript
// Server checks in order:
1. $FUEGO_WALLET environment variable
2. ~/.fuego/wallet.json (default)
3. ~/.config/solana/id.json (Solana CLI fallback)
```

---

## Migration from Other Wallets

### From Solana CLI
```bash
# If you have ~/.config/solana/id.json
cp ~/.config/solana/id.json ~/.fuego/wallet.json
```

### From Phantom (Export Private Key)
```bash
# 1. Export private key from Phantom → file
# 2. Run Fuego init
npm run init
# 3. Select the exported file when prompted
```

---

## Summary: Agent-Ready Philosophy

| Traditional | Fuego |
|------------|-------|
| Password prompts block automation | Zero passwords = full autonomy |
| Human interaction required | One-command setup, fully automated |
| Long setup time | 30 seconds |
| Complex encryption | Simple JSON + file permissions |
| Not agent-friendly | Built for agent-first workflows |

**Result**: Agents can set up and start transacting in seconds. No human intervention after initial `npm run init`.

---

**🔥 Perfect for autonomous agent deployments!**