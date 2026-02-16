<div align="center">
  <pre>
███████╗██╗   ██╗███████╗ ██████╗  ██████╗ 
██╔════╝██║   ██║██╔════╝██╔════╝ ██╔═══██╗
█████╗  ██║   ██║█████╗  ██║  ███╗██║   ██║
██╔══╝  ██║   ██║██╔══╝  ██║   ██║██║   ██║
██║     ╚██████╔╝███████╗╚██████╔╝╚██████╔╝
╚═╝      ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ 
  </pre>
  <h3>🔥 The Agent Solana Wallet 🔥</h3>
  <p>Automated. Fast. Secure.</p>
</div>

**Secure agent-ready Solana wallet + local RPC server. Download the binary, run it, and sign/submit transactions from agents with zero private key exposure.**

---

## 🚀 Quick Start (5 minutes)

### 1. Download Binary (No Build Required)

**Option A: Latest from main branch** (what we committed)
```bash
git clone https://github.com/willmcdeezy/fuego.git
cd fuego
./fuego-server  # Already executable!
```

**Option B: Download from Releases** (v0.1.0+)
Choose your platform:
- **Linux x86_64**: `fuego-server-x86_64-unknown-linux-gnu`
- **Linux ARM64**: (commit the one we added)
- **Windows**: `fuego-server-x86_64-pc-windows-msvc.exe`
- **macOS Intel**: `fuego-server-x86_64-apple-darwin`
- **macOS Apple Silicon**: `fuego-server-aarch64-apple-darwin`

```bash
# Example: macOS Apple Silicon
curl -L https://github.com/willmcdeezy/fuego/releases/download/v0.1.0/fuego-server-aarch64-apple-darwin -o fuego-server
chmod +x fuego-server
./fuego-server
```

### 2. Start Server
```bash
./fuego-server
# 🔥 Fuego server running on http://127.0.0.1:8080
```

### 3. Check Balances
Open `dashboard.html` in your browser:
```bash
open dashboard.html  # macOS
firefox dashboard.html  # Linux
start dashboard.html  # Windows
```

Or use curl:
```bash
curl -X POST http://127.0.0.1:8080/balance \
  -H "Content-Type: application/json" \
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS"}'
```

### 4. Sign & Submit Transactions
```bash
# Install dependencies (one time)
npm install

# Sign and submit a transfer
python3 scripts/sign_and_submit.py --from YOUR_ADDRESS --to RECIPIENT --amount 10.5
```

---

## 📚 Full Documentation

**See [SKILL.md](./SKILL.md) for**:
- Complete API reference (all endpoints with examples)
- Deposit flow + onramp integration (MoonPay, direct transfers)
- Security best practices
- Wallet setup and initialization
- Troubleshooting guide
- Development instructions

---

## 🎯 Features

- 🔐 **Zero Private Key Exposure** - Keys never leave your machine
- 💰 **Multi-Token Support** - SOL, USDC, USDT
- 🦀 **Rust Server** - Fast, lightweight local RPC proxy
- 🤖 **Agent-Ready** - Built for autonomous agents
- 📊 **Dashboard** - Visual balance checker (zero dependencies)
- 🔗 **Solana Native** - Direct RPC integration
- 📝 **Audit Trail** - Transaction memo format for on-chain verification

---

## 🏗️ Architecture

```
Agent / User Scripts
       ↓
Fuego Server (localhost:8080)
  • /balance, /usdc-balance, /usdt-balance (query endpoints)
  • /build-transfer-sol, /build-transfer-usdc, /build-transfer-usdt (returns unsigned tx)
       ↓
Python Script / Client Wallet
  • Signs locally with encrypted keys from Fuego Wallet
  • Never exposes private keys
       ↓
Fuego Server (localhost:8080)
  • /submit-transaction (receives signed tx)
  • Broadcasts to Solana RPC endpoint (mainnet-beta)
```

**Key security property**: 
- Private keys never leave your machine
- Agent queries Fuego Server for unsigned transactions
- Agent signs locally with encrypted wallet
- Agent submits signed transaction back to Fuego Server
- Fuego Server is the **exclusive broadcaster** to Solana RPC

---

## 🔄 Automated Multi-Platform Releases

When you tag a release, **GitHub Actions automatically builds binaries for all platforms**:

```bash
git tag v0.2.0
git push origin v0.2.0
```

This triggers `.github/workflows/release.yml` which:
1. ✅ Builds on Linux, Windows, macOS (Intel + Apple Silicon)
2. ✅ Uploads all binaries to GitHub Releases
3. ✅ Tagged with platform (e.g., `fuego-server-x86_64-apple-darwin`)

Users then download the binary for their OS — no build step needed!

**Supported platforms:**
- Linux x86_64
- Linux ARM64 (aarch64)
- Windows x86_64
- macOS Intel (x86_64)
- macOS Apple Silicon (aarch64)

---

## 📦 Supported Tokens

| Token | Network | Decimals | Mint |
|-------|---------|----------|------|
| **SOL** | Native | 9 | System Program |
| **USDC** | Token-2022 | 6 | `EPjFWdd5Au...` |
| **USDT** | Token-2022 | 6 | `Es9vMFrz...` |

---

## 🛠️ Development

### Build from Source

```bash
# Clone repo
git clone https://github.com/willmcdeezy/fuego.git
cd fuego

# Install dependencies
npm install

# Build Rust server
cd server && cargo build --release
# Binary: target/release/fuego-server

# Run tests
npm test
```

### Tech Stack

- **Wallet**: TypeScript + tweetnacl + Argon2
- **Server**: Rust + Axum + Solana SDK
- **Scripts**: Python (solders) or TypeScript (solders)

---

## 🔐 Security

✅ **DO**:
- Keep wallet passwords strong
- Store `~/.fuego/wallet.json` safely
- Verify explorer links before trusting signatures
- Run server only on localhost (default)

❌ **DON'T**:
- Commit wallet files to git
- Share wallet passwords
- Expose the server to public networks
- Store private keys elsewhere

See full security guidelines in [SKILL.md](./SKILL.md#security-best-practices).

---

## 🔄 Agent Communication Pattern

When helping agents with Fuego, follow this UX pattern:

**Show wallet address alone** (easy copy/paste):
```
Your Fuego wallet address:
FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL
```

**Then offer options in next message**:
```
Want to deposit? Options:
1️⃣ MoonPay (fastest)
2️⃣ Direct transfer
3️⃣ From exchange
```

This prevents text selection issues and makes UX smoother.

---

## 🧪 Testing

```bash
# Test all endpoints locally
npm test

# Or run specific tests
npm run test:wallet
npm run test:server
npm run test:integration
```

---

## 📋 Status

- ✅ **v0.1.0** - Core features complete (SOL, USDC, USDT support)
- ✅ Dashboard (zero-dependency balance viewer)
- ✅ Deposit flows + MoonPay integration
- ⏳ v0.2: Transaction history, batch operations
- ⏳ Hardware wallet support (Ledger, Trezor)

---

## 🤝 Contributing

Found a bug or want to help?

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes
4. Push to branch
5. Open a PR to `dev`

---

## 📄 License

MIT - See LICENSE for details

---

## 🆘 Support

- **Docs**: [SKILL.md](./SKILL.md) (comprehensive guide)
- **Issues**: [GitHub Issues](https://github.com/willmcdeezy/fuego/issues)
- **Community**: OpenClaw Discord

---

**Built for agents. By agents. 🔮**
