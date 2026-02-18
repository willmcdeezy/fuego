# Fuego Roadmap

## Current Version: v0.1.0 ✅

---

## ✅ Completed Features (v0.1.0)

### Dashboard with Segmented Transactions
**Status:** ✅ **LIVE** (v0.1.0)

**Features implemented:**
- ✅ Real-time balance display (SOL, USDC, USDT) with USD values
- ✅ Fuego Transactions tab - Filtered memo-parsed transfers with full details
- ✅ All Transactions tab - Complete wallet history (signatures + timestamps)
- ✅ One-click refresh without page reloads
- ✅ Transaction status indicators (Finalized/Pending)
- ✅ Direct Solana Explorer links
- ✅ Dark/Light theme toggle with automatic system detection
- ✅ Responsive design (mobile, tablet, desktop)

**Server endpoints:**
- ✅ `GET /wallet-address` - Dynamic wallet loading
- ✅ `POST /balance, /usdc-balance, /usdt-balance` - Real-time balances
- ✅ `POST /build-transfer-{sol,usdc,usdt}` - Unsigned transaction building
- ✅ `POST /submit-transaction` - Broadcast signed transactions
- ✅ `POST /transaction-history` - Fuego transactions (memo-filtered)
- ✅ `POST /all-transactions` - Complete transaction history (unfiltered)

---

## 📋 Planned Features

### 1. CLI Tool for Fuego (v0.2)
**Status:** Planned  
**Priority:** High  
**Target:** Next release

Unified command-line interface:
```bash
fuego start          # Start server
fuego stop           # Stop server
fuego dashboard      # Open dashboard in browser
fuego balance        # Check balances (SOL, USDC, USDT)
fuego send           # Send tokens interactively
fuego history        # View transaction history
fuego init           # Initialize wallet
fuego status         # Check server status
```

**Benefits:**
- Single command for common operations
- No need to remember paths or curl commands
- Better UX for non-technical users and agents

**Timeline:** 2-3 weeks after v0.1.0 launch

---

### 2. Transaction History API Endpoint (v0.2)
**Status:** Planned  
**Priority:** Medium

**Enhancement to existing `/transaction-history` endpoint:**
- Pagination support (limit + offset)
- Date range filtering
- Token-specific filtering (SOL only, USDC only, etc.)
- Transaction count statistics
- Performance optimization for large histories

```bash
curl -X POST http://127.0.0.1:8080/transaction-history \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mainnet-beta",
    "address": "YOUR_ADDRESS",
    "limit": 20,
    "offset": 0,
    "token_filter": "USDC",
    "start_date": "2026-02-01",
    "end_date": "2026-02-18"
  }'
```

---

### 3. Batch Transaction Support (v0.2)
**Status:** Planned  
**Priority:** High

**New endpoint:** `POST /batch-transfer`

Send multiple transactions in a single request:
```json
{
  "network": "mainnet-beta",
  "transactions": [
    {
      "to_address": "ADDRESS_1",
      "amount": "10.5",
      "token": "USDC"
    },
    {
      "to_address": "ADDRESS_2",
      "amount": "0.001",
      "token": "SOL"
    }
  ]
}
```

**Benefits:**
- Reduce latency for multiple transfers
- Atomic batch execution (all succeed or none)
- Useful for agent payouts and mass distributions
- Lower total fees per token

---

### 4. Node.js Server Option (v0.3)
**Status:** Under consideration  
**Priority:** Medium

**Rationale:**
- Everyone has Node.js (required for OpenClaw)
- No Rust/Cargo build dependencies
- Faster iteration (no compile step)
- Easier cross-platform distribution
- Same REST API (drop-in replacement)

**Trade-offs:**
- Rust has better performance for crypto operations
- Node.js is single-threaded (though crypto is async)
- Current Rust code is stable and battle-tested

**Plan:**
1. Prototype Node.js server with same endpoints
2. Benchmark against Rust version
3. Make decision based on performance

---

### 5. Hardware Wallet Integration (v0.3)
**Status:** Planned  
**Priority:** Medium

**Supported hardware wallets:**
- 🔗 Ledger (Ledger Live compatible)
- 🔗 Trezor (Solana firmware support)

**Implementation:**
- Use `@solana/wallet-adapter` for compatibility
- Keep local wallet as fallback
- All endpoints work with hardware wallets
- Dashboard auto-detects wallet type

---

### 6. Multi-Token Support Expansion (v0.3)
**Status:** Planned  
**Priority:** Low

**Additional tokens:**
- PYUSD (PayPal USD) - Token-2022 format
- Custom SPL tokens (user-defined mints)
- Compressed NFTs (Metaplex format)

**Dashboard enhancement:**
- Dynamic token registry
- User can add custom tokens
- Price feeds for all tokens

---

### 7. Advanced Security Features (v1.0)
**Status:** Planned  
**Priority:** High (for enterprise)

**Features:**
- Multi-signature support (2-of-3, 3-of-5, etc.)
- Rate limiting (max amount per transaction)
- Whitelist/blacklist for addresses
- Transaction approval workflow
- Audit logging with signatures

---

### 8. Performance & Scalability (v1.0)
**Status:** Planned  
**Priority:** Medium

**Optimizations:**
- Connection pooling for high-frequency trading
- Caching for balance queries
- Compression for large transaction histories
- WebSocket support for real-time updates
- Horizontal scaling (multi-server setup)

---

## 🎯 Release Timeline

| Version | Target Date | Features |
|---------|------------|----------|
| **v0.1.0** | ✅ Feb 18, 2026 | Core features, dashboard, segmented history |
| **v0.2.0** | ~Early March | CLI tool, batch transactions, enhanced history API |
| **v0.3.0** | ~Late March | Hardware wallets, Node.js option, more tokens |
| **v1.0.0** | ~April | Multi-sig, advanced security, enterprise features |

---

## 💼 Enterprise Roadmap (2026)

**For production agent deployments:**

- 🏢 **Multi-tenant infrastructure** - Isolation per agent team
- 🔐 **Enhanced key management** - HSM/KMS integration
- 📊 **Analytics dashboard** - Transaction metrics, success rates
- 🚨 **Alerting system** - Slack/Discord notifications
- 🌍 **Multi-region support** - Global RPC endpoints
- 📡 **Webhooks** - Real-time transaction events
- 🔗 **Cross-chain bridges** - Ethereum, Polygon support

---

## 🤝 Contributing

**Want to help build Fuego?** We welcome contributions for:

- ✅ Tests (unit, integration, E2E)
- ✅ Feature implementations
- ✅ Documentation improvements
- ✅ Bug fixes
- ✅ Performance optimizations

**Priority areas for contributors:**
1. **Test suite** - Currently looking for test contributors
2. **CLI tool** - Well-scoped, high impact
3. **Documentation** - Always welcome
4. **Bug reports** - Help us find edge cases

---

## 📝 Memory

**Last updated:** Feb 18, 2026  
**Status:** v0.1.0 complete and launching  
**Focus:** Market validation before v0.2.0  
**Feedback channel:** GitHub issues, Twitter mentions