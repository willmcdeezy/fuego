# Fuego Wallet Setup - Standard UX Flow

## File Structure Standards

```
~/.fuego/                    # Standard wallet location (NEVER change this)
├── config.json              # Wallet address, network, metadata
├── keychain/
│   ├── id.json             # Encrypted keypair (AES-256-GCM + Argon2)
│   └── salt.json           # Argon2 salt
└── logs/                   # Transaction logs (optional)
```

**Why this location?**
- All Fuego scripts default to `~/.fuego/`
- Dashboard reads from here automatically
- Python scripts, TypeScript SDK, and HTML dashboard all expect this path
- Cross-platform (works on Linux, macOS, Windows with WSL)

---

## Agent → User Setup Flow

### Step 1: Agent Detects No Wallet
```
Agent checks: Does ~/.fuego/config.json exist?
```

### Step 2: Agent Asks User
**Agent (in chat):** "You need a Fuego wallet to proceed. Want me to help you set one up?"

**Options:**
- **"Yes, create for me"** → Agent guides through terminal setup
- **"I'll do it myself"** → Agent gives commands to run

---

## Path A: Agent-Guided Setup (Recommended)

**Agent says:**
> "I'll create your wallet now. For security, you'll enter your password in the terminal (not here in chat). Run these commands:"

```bash
# 1. Navigate to Fuego
cd /path/to/fuego

# 2. Run the setup wizard
npm run setup
```

**Terminal prompts (secure, hidden input):**
```
🔥 Fuego Wallet Setup

Generating new keypair...
✅ Address: FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL

🔐 Create encryption password: ********
🔐 Confirm password: ********

✅ Wallet created at ~/.fuego/
💾 Backup saved to ~/fuego-wallet-backup.json (keep this safe!)
```

**Agent confirms:**
> "✅ Wallet created! Address: `FgbVaH...`"

---

## Path B: User Self-Setup

**Agent says:**
> "Run these commands in your terminal to create your Fuego wallet:"

```bash
cd /path/to/fuego
npm run init
```

**Then follow the prompts.**

---

## Security Rules (NON-NEGOTIABLE)

| ❌ NEVER | ✅ ALWAYS |
|----------|-----------|
| Type passwords in chat (Discord/Telegram/Slack) | Enter passwords in terminal only |
| Send private keys in messages | Use secure file transfer or `export` commands |
| Store unencrypted keys in git | Keep only in `~/.fuego/` (gitignored) |
| Hardcode paths like `/home/username/.fuego` | Use `~/.fuego` (cross-platform) |
| Commit wallet backups | Store backups in password manager or offline |

---

## For Developers: Reading the Wallet

### TypeScript / Node.js
```typescript
import { FuegoWallet } from 'fuego';

const wallet = new FuegoWallet();  // Auto-reads ~/.fuego/
const address = wallet.getAddress(); // Returns address from config.json
```

### Python
```python
import json
from pathlib import Path

config_path = Path.home() / ".fuego" / "config.json"
with open(config_path) as f:
    config = json.load(f)
    address = config["walletAddress"]  # e.g., "FgbVaH..."
```

### HTML Dashboard
```javascript
// Dashboard reads from config embedded at build time
// Or fetches from server endpoint
const address = await fetch('/wallet-address').then(r => r.json());
```

---

## Migration / Recovery

**If user has existing wallet:**
```bash
# Import from Solana CLI
npm run init
# Enter: ~/.config/solana/id.json

# Import from Phantom (export private key first)
npm run init
# Enter: /path/to/phantom-export.json
```

**If wallet is lost/forgotten:**
```bash
# Rename broken wallet (preserve for later)
mv ~/.fuego ~/broken-wallet-$(date +%Y%m%d)

# Create fresh wallet
npm run setup
```

---

## Agent Checklist

When helping users with Fuego:

- [ ] Check if `~/.fuego/config.json` exists first
- [ ] If not, offer to guide setup
- [ ] **NEVER** ask for passwords in chat
- [ ] Point to terminal for all password entry
- [ ] Confirm wallet address after creation
- [ ] Remind about backup file (`~/fuego-wallet-backup.json`)
- [ ] All scripts default to `~/.fuego/` — don't customize paths unless asked

---

## Summary

**One standard, everywhere:**
- Wallet location: `~/.fuego/`
- Password entry: Terminal only (never chat)
- Address retrieval: Read from `~/.fuego/config.json`
- Backup: `~/fuego-wallet-backup.json`

This keeps Fuego simple, secure, and consistent across all tools (Python scripts, TypeScript SDK, HTML dashboard, agent interactions).
