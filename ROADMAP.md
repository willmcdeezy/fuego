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
fuego init           # Initialize wallet
fuego status         # Check server status
```

**Benefits:**
- Single command for common operations
- No need to remember paths or curl commands
- Better UX for non-technical users and agents

**Timeline:** 2-3 weeks after v0.1.0 launch

---

### 2. Node.js Server Option (v0.3)
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

### 3. Multi-Token Support Expansion (v0.3)
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