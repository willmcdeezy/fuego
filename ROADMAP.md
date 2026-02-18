# Fuego Roadmap

## Current Version: v0.1.0

---

## Planned Features

### 1. CLI Tool for Fuego
**Status:** Planned  
**Priority:** High

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

Benefits:
- Single command for common operations
- No need to remember paths or curl commands
- Better UX for non-technical users

---

### 2. Migrate Rust Server to Node.js
**Status:** Under consideration  
**Priority:** Medium

**Rationale:**
- Everyone has Node.js (required for OpenClaw installation)
- No Rust/Cargo build dependencies
- Faster iteration (no compile step)
- Easier cross-platform distribution

**Trade-offs:**
- Rust has better performance for crypto operations
- Node.js is single-threaded (though crypto is async)
- Current Rust code is working and stable

**Decision needed:** Prototype Node.js server, benchmark, decide

---

### 3. getSignaturesForAddress Endpoint
**Status:** Planned  
**Priority:** Medium

**New endpoint:** `POST /signatures-for-address`

Returns all transactions for the wallet (unfiltered):
```json
{
  "success": true,
  "data": {
    "signatures": [
      {
        "signature": "5Ux...",
        "slot": 123456789,
        "blockTime": 1708272000,
        "err": null
      }
    ],
    "hasMore": true
  }
}
```

**Dashboard enhancement:**
- Tab: "Fuego History" (memo-parsed transactions with full details)
- Tab: "Full History" (all signatures, minimal: time + signature link only)
- Pagination support for both views

---

## Memory

**Captured from user:** Feb 17, 2026 4:29pm CST  
**Items:** CLI tool, Node.js migration consideration, getSignatures endpoint  
**Status:** Committed to roadmap
