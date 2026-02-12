# Fuego 🔥

Local Agentic Solana Wallet for OpenClaw

## Overview

Fuego provides autonomous agents with a lightweight, local wallet implementation for Solana blockchain interactions. Built for OpenClaw agents to manage SOL and SPL tokens with cryptographic security and full key custody.

## Features

- 🔐 **Local Key Management** - Keys never leave the agent's machine
- 🚀 **Solana Native** - Direct integration with Solana RPC
- 🤖 **Agent-First** - Built for autonomous operation
- ⚡ **Fast** - Minimal dependencies, low overhead
- 📦 **OpenClaw Compatible** - Designed as an OpenClaw skill/tool

## Installation

```bash
git clone https://github.com/willmcdeezy/fuego.git
cd fuego
npm install
```

## Usage

```typescript
import { FuegoWallet } from './fuego'

const wallet = new FuegoWallet()
const balance = await wallet.getBalance()
```

## Development

Built with TypeScript + Solana Web3.js

## License

MIT
