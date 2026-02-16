#!/bin/bash
# Fuego Dashboard Server - finds available port and opens dashboard

set -e

# Configuration
DASHBOARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WALLET_ADDRESS="${1:-}"
START_PORT=3000
MAX_PORT=3100

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is available
is_port_available() {
    ! nc -z 127.0.0.1 "$1" 2>/dev/null
}

# Find available port
find_available_port() {
    for port in $(seq "$START_PORT" "$MAX_PORT"); do
        if is_port_available "$port"; then
            echo "$port"
            return 0
        fi
    done
    echo "No available port found between $START_PORT and $MAX_PORT"
    exit 1
}

# Get wallet address if not provided
if [ -z "$WALLET_ADDRESS" ]; then
    # Try to read from fuego config
    if [ -f "$HOME/.fuego/config.json" ]; then
        WALLET_ADDRESS=$(grep -o '"walletAddress":"[^"]*' "$HOME/.fuego/config.json" | cut -d'"' -f4)
    fi
fi

if [ -z "$WALLET_ADDRESS" ]; then
    echo "Usage: $0 <wallet-address>"
    echo ""
    echo "Error: Wallet address not found and not provided"
    echo "Pass wallet address as argument or ensure ~/.fuego/config.json exists"
    exit 1
fi

# Find available port
PORT=$(find_available_port)

# Check if we have python3 or python for HTTP server
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "Error: Python not found. Cannot start HTTP server."
    exit 1
fi

# Start HTTP server in background
echo -e "${BLUE}🔥 Starting Fuego Dashboard...${NC}"
echo -e "${GREEN}Port: $PORT${NC}"
echo -e "${GREEN}Wallet: $WALLET_ADDRESS${NC}"
echo ""

# Change to dashboard directory and start server
cd "$DASHBOARD_DIR"
$PYTHON -m http.server "$PORT" --directory . > /dev/null 2>&1 &
SERVER_PID=$!

# Give server a moment to start
sleep 1

# Check if server started
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Error: Failed to start HTTP server"
    exit 1
fi

# Build dashboard URL
DASHBOARD_URL="http://127.0.0.1:$PORT/dashboard.html?address=$WALLET_ADDRESS"

echo -e "${GREEN}✅ Dashboard started!${NC}"
echo ""
echo -e "${BLUE}Dashboard URL:${NC}"
echo "  $DASHBOARD_URL"
echo ""
echo -e "${YELLOW}Make sure Fuego server is running on port 8080:${NC}"
echo "  ~/.fuego/server/fuego-server"
echo ""
echo -e "${YELLOW}Opening in browser...${NC}"

# Try to open in default browser
if command -v xdg-open &> /dev/null; then
    xdg-open "$DASHBOARD_URL" 2>/dev/null || true
elif command -v open &> /dev/null; then
    open "$DASHBOARD_URL" 2>/dev/null || true
else
    echo "Could not open browser automatically. Visit the URL above."
fi

echo ""
echo -e "${GREEN}Dashboard is running. Press Ctrl+C to stop.${NC}"

# Wait for Ctrl+C
trap 'kill $SERVER_PID 2>/dev/null; echo ""; echo "Dashboard stopped."; exit 0' INT TERM
wait $SERVER_PID
