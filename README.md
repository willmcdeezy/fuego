# Fuego 🔥

Local Agentic Solana Wallet for OpenClaw

## Overview

Fuego provides autonomous agents with a lightweight, local wallet implementation for Solana blockchain interactions. Built for OpenClaw agents to manage SOL and SPL tokens with cryptographic security and full key custody.

## Features

- 🔐 **Local Key Management** - Keys never leave the agent's machine
- 🚀 **Solana Native** - Direct integration with Solana RPC
- 🦀 **Rust Server** - High-performance local RPC proxy for agents
- 🤖 **Agent-First** - Built for autonomous operation
- ⚡ **Fast** - Minimal dependencies, low overhead
- 📦 **OpenClaw Compatible** - Designed as an OpenClaw skill/tool

## Installation

### TypeScript Wallet
```bash
git clone https://github.com/willmcdeezy/fuego.git
cd fuego
npm install
```

### Rust Server (Optional - for local RPC)
```bash
cd fuego/server
cargo build --release
```

## Architecture

Fuego consists of two components:

1. **TypeScript Wallet** (`src/`) - Secure key management and signing
2. **Rust Server** (`server/`) - Local RPC proxy for balance/hash queries

## Usage

### Wallet (TypeScript)
```typescript
import { FuegoWallet } from './fuego'

const wallet = new FuegoWallet()
await wallet.authenticate('your-password')
const address = wallet.getAddress()
```

### Server (Rust) - Run locally on :8080
```bash
cd server
cargo run
# Server starts on http://127.0.0.1:8080
```

**Server Endpoints:**
- `POST /latest-hash` - Get latest blockhash
  ```json
  { "network": "mainnet-beta" }
  ```
- `POST /balance` - Get SOL balance
  ```json
  { "network": "mainnet-beta", "address": "abc123..." }
  ```
- `GET /health` - Health check
- `GET /network` - Get default network

Agents can query the local server instead of hitting RPC directly:
```typescript
// From fuego client
const response = await fetch('http://127.0.0.1:8080/balance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ network: 'mainnet-beta', address: wallet.getAddress() })
})
const { data } = await response.json()
console.log(`Balance: ${data.sol} SOL`)
```

## Development

- **Wallet**: TypeScript + Solana Web3.js
- **Server**: Rust + Tokio + Axum + Solana Client

## License

MIT
