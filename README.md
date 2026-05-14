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

  [![version](https://img.shields.io/badge/version-1.4.1-blue.svg)](./package.json)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

## 🚀 Quick Start (5 minutes)

### Recommended: Ask Your Agent
```bash
curl -S https://fuego.cash/SKILL.md
```

**What your agent will do:**
- Install the [`fuego-cli`](https://www.npmjs.com/package/fuego-cli) tool
- Use the CLI to install this repo
- Create a wallet using `fuego-cli`
- Use the Rust server and scripts to query the blockchain, build transactions, and submit transactions to Solana

The `fuego-cli` gives your agent an easy-to-use, agent-friendly tool to handle these flows with speed and ease.

---

### Manual Install

```bash
# 1. Install the CLI
npm install -g fuego-cli

# 2. Create a wallet at ~/.fuego
fuego create

# 3. Install this repo (defaults to ~/.openclaw/workspace, or if pure CLI to current directory)
fuego install

```

Your agent is now ready to query balances, build transactions, and submit to the blockchain!

---

## 🏄🏼‍♂️ Features

### 🐆 x402 Purch

Fuego integrates with [purch.xyz](https://purch.xyz) to enable agent purchases from Amazon using USDC. Use `fuego purch` followed by a full Amazon product URL to initiate a purchase. The x402 protocol handles payment verification and order fulfillment.


### 🪐 Jupiter Swaps

Fuego integrates with Jupiter for token swaps on Solana. A Jupiter API key is required to use swap functionality.

Get your API key at [portal.jup.ag](https://portal.jup.ag). Once obtained, your agent can help configure it in your Fuego setup and walk you through the complete configuration process.


### 🔥 Supported Tokens For Fuego Transfers

| Token | Type | Mint | Decimals | Status |
|-------|------|------|----------|--------|
| **SOL** | Native | System Program | 9 | ✅ Live |
| **USDC** | SPL Token | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 | ✅ Live |
| **USDT** | SPL Token | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEqw` | 6 | ✅ Live |


---

## 📚 Full Documentation

**📖 [SKILL.md](./SKILL.md)** - Complete reference:

---

## 🏗️ Agent-Ready Architecture

```
🦞 Agent (via CLI)
       ↓ HTTP Request
🔥 Fuego Server (localhost:8080)
  • GET  /wallet-address (dynamic wallet loading)
  • POST /balance, /usdc-balance, /usdt-balance (query balances)  
  • POST /build-transfer-{sol,usdc,usdt} (build unsigned transaction)
       ↓ Unsigned Transaction
🦞 Agent (via CLI)
  • Loads ~/.fuego/wallet.json (simple JSON, no password!)
  • Signs transaction locally
       ↓ Signed Transaction
🔥 Fuego Server (localhost:8080)
  • POST /submit-transaction (broadcast to Solana)
       ↓ Broadcast
🌐 Solana Mainnet
```

**🔐 Security Model:**
- ✅ Private keys stored locally as simple JSON (file permissions = real security)
- ✅ Zero network exposure (localhost only)

---

## 🛠️ Development

### Prerequisites
- [Rust](https://rustup.rs/) (1.85+)
- [Node.js](https://nodejs.org/) (18+)

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
- **Client**: The CLI (`fuego-cli`)
- **Dashboard**: Vanilla HTML/CSS/JS (zero dependencies)
- **Scripts**: Node.js + @solana/kit

---

## 🔐 Security

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

## 🦞 Agent Integration Examples

### Check Balance
```bash
fuego balance
```

### Send Transaction
```bash
fuego send <recipient> <amount> --token USDC --yes
```

See [fuego-cli documentation](https://github.com/willmcdeezy/fuego-cli) for all available commands.

---

## 🚀 Production Ready

Fuego is **production-ready** for agent deployments:

- ✅ **Battle-tested** - Handles real mainnet transactions
- ✅ **Error handling** - Graceful failure modes  
- ✅ **Documentation** - Complete API reference
- ✅ **Local & 1005 Open Source** - No private key exposure, everything is local
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
- **🐦 Updates**: [@0x_ca55](https://twitter.com/0x_ca55)


---

<div align="center">
<b>🔥 Built for agents. By an agent and their human. 🦞</b><br/>
<i>The future of autonomous Solana transactions starts here.</i>
</div>