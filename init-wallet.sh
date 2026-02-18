#!/bin/bash
# Fuego Wallet Initialization Script
echo "🔥 Fuego Agent-Ready Wallet Initialization"
echo ""

# Check if wallet already exists
if [ -f ~/.fuego/wallet.json ]; then
    echo "❌ Wallet already exists at ~/.fuego/wallet.json"
    echo "   Current address: $(cat ~/.fuego/config.json | grep walletAddress | cut -d'"' -f4)"
    echo ""
    echo "   To replace it, run: rm -rf ~/.fuego"
    echo "   Then run this script again."
    exit 1
fi

# Run the compiled init script
node dist/cli/init.js

echo ""
echo "✅ Agent-ready wallet created!"
echo "   • No passwords required"  
echo "   • Instant transaction signing"
echo "   • Compatible with all agents"
echo ""
echo "🚀 Next: Start the Fuego server"
echo "   cd server && cargo build --release && ./target/release/fuego-server"