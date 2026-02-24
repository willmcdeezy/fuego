<div align="center">
  
<pre>
<img src="fuego-logo.jpg" alt="Fuego Logo" width="120" style="border-radius: 24px;">
███████╗██╗   ██╗███████╗ ██████╗  ██████╗ 
██╔════╝██║   ██║██╔════╝██╔════╝ ██╔═══██╗
█████╗  ██║   ██║█████╗  ██║  ███╗██║   ██║
██╔══╝  ██║   ██║██╔══╝  ██║   ██║██║   ██║
██║     ╚██████╔╝███████╗╚██████╔╝╚██████╔╝
╚═╝      ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ 
  </pre>
  <h3>🔥🦞 Agentic Solana Wallet 🦞🔥</h3>
  <p>Zero friction. Maximum agent autonomy.</p>
</div>

**The first Solana wallet designed FOR autonomous agents. No passwords, no prompts, no friction. Just instant transaction signing and submission.**

---

## 🚀 Quick Start (5 minutes)

### Recommended: Ask Your Agent
```bash
curl -S https://fuego.cash/skill.md | less
```

**What your agent will do:**
- Install the `fuego-cli` tool
- Use the CLI to install this repo
- Create a wallet using `fuego-cli`
- Use the Rust server and scripts to query the blockchain, build transactions, and submit transactions to Solana

The `fuego-cli` gives your agent an easy-to-use, agent-friendly tool to handle these flows with speed and ease.

---

### Manual Install

```bash
# 1. Install the CLI
npm install -g fuego-cli

# 2. Install this repo
fuego install

# 3. Create a wallet at ~/.fuego
fuego create
```

Your agent is now ready to query balances, build transactions, and submit to the blockchain!

---

## 🤖 Why Agents Love Fuego

### ❌ Traditional Wallets (Agent Nightmare)
- 🔒 Password prompts block automation
- ⏱️ Slow multi-step processes  
- 🌐 Browser extensions don't work headlessly
- 🔐 Private keys exposed to third parties

### ✅ Fuego (Agent Paradise) 
- 🚀 **Zero friction**: No passwords, no prompts, unless you want your agent to build that in
- ⚡ **Instant signing**: Millisecond transaction processing  
- 🏠 **Local-first**: Keys never leave your machine
- 📡 **REST API**: Standard HTTP endpoints agents understand
- 🔄 **Reliable**: Works 24/7 without human intervention

---

## 📚 Full Documentation

**📖 [SKILL.md](./SKILL.md)** - Complete reference:
- 🔌 All API endpoints with examples  
- 💰 Deposit flows + MoonPay integration
- 🔐 Security best practices  
- 🛠️ Development setup
- ❗ Troubleshooting guide

**📋 [ROADMAP.md](./ROADMAP.md)** - What's coming next

---

## 🏗️ Agent-Ready Architecture

```
🤖 Agent Script
       ↓ HTTP Request
🔥 Fuego Server (localhost:8080)
  • GET  /wallet-address (dynamic wallet loading)
  • POST /balance, /usdc-balance, /usdt-balance (query balances)  
  • POST /build-transfer-{sol,usdc,usdt} (build unsigned transaction)
       ↓ Unsigned Transaction
🤖 Agent Script  
  • Loads ~/.fuego/wallet.json (simple JSON, no password!)
  • Signs transaction locally with solders library
       ↓ Signed Transaction
🔥 Fuego Server (localhost:8080)
  • POST /submit-transaction (broadcast to Solana)
       ↓ Broadcast
🌐 Solana Mainnet
```

**🔐 Security Model:**
- ✅ Private keys stored locally as simple JSON (file permissions = real security)
- ✅ Server never sees private keys (signs client-side)  
- ✅ Zero network exposure (localhost only)
- ✅ Standard Solana wallet format (compatible with CLI tools)

---

## 🎯 Features

### 🔥 Agent-First Design
- **Zero friction** - No human intervention required
- **Instant signing** - Transactions sign in milliseconds  
- **Simple JSON storage** - Standard Solana CLI format
- **REST API** - HTTP endpoints agents understand
- **Auto-retry logic** - Handles network issues gracefully

### 💰 Multi-Token Support  
- **SOL** - Native Solana token
- **USDC** - USD Coin (6 decimals)
- **USDT** - Tether USD (6 decimals)

### 📊 Professional Dashboard
- **Real-time balances** with USD values (CoinGecko)
- **Segmented history** - Fuego transactions + All transactions
- **Status indicators** - Finalized/Pending with timestamps
- **Dark/Light themes** - Automatic system detection
- **One-click refresh** - No page reloads needed

### 🛠️ Developer Experience
- **Rust server** - Single binary, no dependencies  
- **TypeScript SDK** - Type-safe client library
- **Python scripts** - Ready-to-use transaction tools
- **Comprehensive docs** - Every endpoint documented  
- **Error handling** - Clear error messages for debugging

---

## 📦 Supported Tokens

| Token | Type | Mint | Decimals | Status |
|-------|------|------|----------|--------|
| **SOL** | Native | System Program | 9 | ✅ Live |
| **USDC** | SPL Token | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 | ✅ Live |
| **USDT** | SPL Token | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEqw` | 6 | ✅ Live |

---

## 🛠️ Development

### Prerequisites
- [Rust](https://rustup.rs/) (1.85+) - **Required for macOS compatibility**
- [Node.js](https://nodejs.org/) (18+)  
- [Python](https://python.org/) (3.8+)

### Setup
```bash
# 1. Clone and install
git clone https://github.com/willmcdeezy/fuego.git
cd fuego
npm install

# 2. Build TypeScript
npm run build

# 3. Build Rust server  
cd server && cargo build --release
```

### Tech Stack
- **Server**: Rust + Axum + Solana SDK
- **Client**: TypeScript + @solana/web3.js
- **Dashboard**: Vanilla HTML/CSS/JS (zero dependencies)
- **Scripts**: Python + solders + requests

---

## 🔐 Security

### ✅ What Makes Fuego Secure
- **File permissions** (chmod 600) provide real access control
- **Local-only server** never exposed to network
- **Client-side signing** keeps private keys on your machine
- **Standard format** compatible with official Solana tools
- **No network key exposure** - keys never sent over HTTP

### 💡 Security Best Practices
- Keep `~/.fuego/wallet.json` secure (it's your money!)
- Don't commit wallet files to version control
- Only run server on localhost (default behavior)
- Regularly backup `~/.config/solana/fuego-backup.json`
- Verify transaction signatures on Solana Explorer

### 🚨 Red Flags (What We Eliminated)
- ❌ No password theater (file permissions = real security)
- ❌ No network key exposure 
- ❌ No browser extension dependencies
- ❌ No third-party key storage
- ❌ No human-in-the-loop requirements

---

## 🤖 Agent Integration Examples

### Balance Check
```python
import requests

response = requests.post('http://127.0.0.1:8080/balance', 
    json={'network': 'mainnet-beta', 'address': 'YOUR_ADDRESS'})
balance = response.json()['data']['sol']
print(f"Balance: {balance} SOL")
```

### Send Transaction  
```python
# Use the included script - handles all complexity
import subprocess

result = subprocess.run([
    'python3', 'scripts/sign_and_submit.py',
    '--from', 'YOUR_ADDRESS',
    '--to', 'RECIPIENT_ADDRESS', 
    '--amount', '0.001',
    '--token', 'SOL'
], capture_output=True, text=True)

if 'Transaction on-chain' in result.stdout:
    print("✅ Transaction successful!")
```

### Dashboard Integration
```javascript
// Get wallet address dynamically
const response = await fetch('http://127.0.0.1:8080/wallet-address');
const {data} = await response.json();
console.log(`Wallet: ${data.address}`);

// Check USDC balance
const balanceRes = await fetch('http://127.0.0.1:8080/usdc-balance', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({network: 'mainnet-beta', address: data.address})
});
const balance = await balanceRes.json();
console.log(`USDC: ${balance.data.usdc}`);
```

---

## 🧪 Testing & Contributions

**We're looking for contributors to build comprehensive test suites!**

Currently, Fuego is battle-tested on mainnet with real transactions, but formal test coverage is growing. If you'd like to help, we'd love contributors for:

- ✅ **Unit tests** - Wallet initialization, transaction signing
- ✅ **Integration tests** - Server endpoints, balance queries
- ✅ **Security tests** - Key handling, error cases
- ✅ **E2E tests** - Full transaction workflows

**Want to contribute tests?** Open an issue or PR on GitHub - all test contributions welcome! 🙏

---

## 📋 Status & Roadmap

### ✅ v0.1.0 - Agent-Ready Release
- Zero-password wallet initialization
- Multi-token support (SOL, USDC, USDT)
- Professional dashboard with transaction history
- REST API with complete documentation  
- Agent-ready transaction scripts

### ⏳ v0.2.0 - Advanced Features (Planned)
- CLI tool (`fuego balance`, `fuego send`, etc.)
- Transaction history API endpoint
- Node.js server option (faster development - won't need rust but may we will see. May continue building in Rust for security and performance)

---

## 🚀 Production Ready

Fuego is **production-ready** for agent deployments:

- ✅ **Battle-tested** - Handles real mainnet transactions
- ✅ **Error handling** - Graceful failure modes  
- ✅ **Documentation** - Complete API reference
- ✅ **Security audited** - No private key exposure, everything is local
- ✅ **Performance** - Millisecond transaction signing
- ✅ **Reliability** - Works 24/7 without intervention

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`  
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🆘 Support

- **📖 Documentation**: [SKILL.md](./SKILL.md)
- **🐛 Issues**: [GitHub Issues](https://github.com/willmcdeezy/fuego/issues)  
- **💬 Community**: OpenClaw Discord
- **🐦 Updates**: [@0x_ca55](https://twitter.com/0x_ca55)


---

<div align="center">
<b>🔥 Built for agents. By agents. 🤖</b><br/>
<i>The future of autonomous Solana transactions starts here.</i>
</div>