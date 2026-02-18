# Fuego Dashboard 🔥

**Professional web dashboard for agent-ready Solana wallets.** Zero dependencies, maximum features.

## Features

### 💰 Real-Time Balances
- **SOL balance** with USD value (CoinGecko integration)
- **USDC balance** with USD conversion
- **USDT balance** with USD conversion
- **Automatic refresh** with loading states

### 📊 Transaction History
- **Fuego Transactions** - Parsed transfers with full details
- **All Transactions** - Complete wallet history  
- **Status indicators** - Finalized/Pending with timestamps
- **Explorer links** - Direct to Solana Explorer
- **One-click refresh** - No page reloads needed

### 🎨 Modern UI/UX
- **Dark/Light themes** - Automatic system detection + manual toggle
- **Responsive design** - Works on desktop, tablet, mobile
- **Loading states** - Smooth segment switching
- **Professional styling** - Clean, modern design
- **Error handling** - Helpful error messages

### 🚀 Agent-Ready
- **Dynamic wallet loading** - Automatically detects ~/.fuego/ wallet
- **Zero configuration** - Just open dashboard.html
- **Real-time updates** - Always shows current state
- **Copy-friendly** - Easy wallet address copying

---

## Quick Start

### Option 1: Direct Open (Simplest)
```bash
# Just open in any browser
open dashboard/dashboard.html           # macOS
firefox dashboard/dashboard.html        # Linux  
start dashboard/dashboard.html          # Windows
```

### Option 2: HTTP Server (For Development)
```bash
# Serve via HTTP (avoids CORS issues)
cd dashboard
python3 -m http.server 3000

# Then open: http://localhost:3000/dashboard.html
```

**Prerequisites:**
- Fuego server running on `http://127.0.0.1:8080`
- Initialized wallet at `~/.fuego/wallet.json`

---

## Architecture

```
dashboard.html
       ↓ Dynamic Loading
GET /wallet-address  
  • Returns current wallet address from ~/.fuego/
       ↓ Balance Queries
POST /balance, /usdc-balance, /usdt-balance
  • Real-time balance fetching
       ↓ Price Data
CoinGecko API
  • USD values for tokens
       ↓ Transaction History  
POST /transaction-history (Fuego transactions)
POST /all-transactions (all transactions)
  • Segmented transaction display
```

---

## Dashboard Sections

### 🏠 Header
- **Fuego logo** with theme toggle button
- **Wallet address** with one-click copy functionality
- **Dynamic loading** from server endpoint

### 💰 Balances Section
- **Three-column grid** showing SOL, USDC, USDT
- **USD values** updated from CoinGecko
- **Loading states** with spinners
- **Error handling** for network issues

### 📊 Recent Activity
- **Segment tabs** - Switch between Fuego and All transactions
- **Transaction tiles** showing:
  - Token icons (24px SVG)
  - Sent/Received amounts  
  - From/To addresses (truncated)
  - Timestamps with status (Finalized/Pending)
  - Explorer links
- **Refresh button** for manual updates
- **Loading states** during segment switching

---

## API Integration

### Server Endpoints Used
```javascript  
// Dynamic wallet address
GET /wallet-address
// Returns: {success: true, data: {address: "...", network: "..."}}

// Balance queries
POST /balance, /usdc-balance, /usdt-balance  
// Input: {network: "mainnet-beta", address: "wallet_address"}
// Returns: {success: true, data: {sol: 1.234, lamports: 1234567890}}

// Transaction history
POST /transaction-history  // Fuego transactions (filtered)
POST /all-transactions    // All transactions (unfiltered)
// Input: {network: "mainnet-beta", address: "wallet_address", limit: 10}
// Returns: {success: true, data: [transaction_objects]}
```

### External APIs Used
```javascript
// Token prices (CoinGecko - free tier)
GET https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin,tether&vs_currencies=usd
// Returns: {solana: {usd: 100.50}, "usd-coin": {usd: 1.00}, tether: {usd: 0.99}}
```

---

## Customization

### Themes
The dashboard automatically detects system theme preference and includes a manual toggle:

```css
/* Light theme (default) */
--bg-primary: #ffffff;
--text-primary: #1a1a1a;  

/* Dark theme */  
--bg-primary: #1a1a1a;
--text-primary: #f5f5f5;
```

**Theme Storage:** Preference saved in `localStorage.fuego_theme_mode`

### Token Icons
SVG token icons located in `tokens/` directory:
- `solanaLogoMark.svg` - Official Solana logo
- `usdc.svg` - USDC logo  
- `usdt.svg` - Tether logo

**Usage in code:**
```javascript
function getTokenIcon(token, size = '16px') {
    switch (token) {
        case 'SOL': return `<img src="tokens/solanaLogoMark.svg" alt="SOL" style="width: ${size};">`;
        // ...
    }
}
```

### Adding New Tokens
1. Add token SVG to `tokens/` directory
2. Update `getTokenIcon()` function  
3. Add balance endpoint integration
4. Add to balances grid HTML

---

## Error Handling

### Smart Error Detection
The dashboard provides specific error messages:

```javascript
// Server down
"🔥 Fuego server not running. Start server: ./server/target/release/fuego-server"

// Wallet missing
"💸 No wallet found. Initialize wallet: npm run init"

// Connection issues  
"❌ Connection error. Check server status."
```

### Error Flow
1. **Health check** - Tests `/health` endpoint with 5s timeout
2. **Wallet check** - Queries `/wallet-address` endpoint
3. **Specific errors** - Provides actionable error messages
4. **Graceful degradation** - Shows "Loading..." states during issues

---

## Development

### File Structure
```
dashboard/
├── dashboard.html     # Main dashboard (all-in-one file)
├── tokens/           # Token SVG icons
│   ├── solanaLogoMark.svg
│   ├── usdc.svg
│   └── usdt.svg
├── fuego-logo.jpg    # Dashboard header logo
├── fuego-mascot.jpg  # Additional branding
└── README.md         # This file
```

### Single-File Architecture
Everything in `dashboard.html` for simplicity:
- **HTML structure** - Semantic, responsive layout
- **CSS styles** - CSS custom properties for theming  
- **JavaScript logic** - Vanilla JS, no dependencies

### Key Functions
```javascript
// Core functions
async function getWalletAddress()     // Dynamic wallet loading
async function loadBalances(address)  // Fetch all token balances  
async function loadTransactions(address)     // Fuego transactions
async function loadAllTransactions(address)  // All transactions
async function switchSegment(segment)        // Transaction segments
function toggleTheme()                       // Theme switching
```

---

## Troubleshooting

### Common Issues

**Dashboard shows "Loading..." forever**
```bash
# Check if Fuego server is running
curl http://127.0.0.1:8080/health

# If not running:
cd server && ./target/release/fuego-server
```

**"Server not running" error**
```bash
# Start Fuego server
cd fuego/server && ./target/release/fuego-server
```

**"No wallet found" error**  
```bash
# Initialize wallet
cd fuego && npm run init
```

**Balances not loading**
```bash
# Check wallet has funds or test with different address
curl -X POST http://127.0.0.1:8080/balance \
  -H "Content-Type: application/json" \
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS"}'
```

**Transactions not showing**
```bash
# Check transaction history endpoint
curl -X POST http://127.0.0.1:8080/transaction-history \
  -H "Content-Type: application/json" \
  -d '{"network": "mainnet-beta", "address": "YOUR_ADDRESS", "limit": 5}'
```

### Debug Mode
Open browser developer tools (F12) to see:
- **Console logs** - API requests and responses
- **Network tab** - Failed requests and timing
- **Application tab** - localStorage theme settings

---

## Browser Compatibility

### Tested Browsers  
- ✅ **Chrome 90+** - Full support
- ✅ **Firefox 88+** - Full support  
- ✅ **Safari 14+** - Full support
- ✅ **Edge 90+** - Full support

### Required Features
- **ES6 async/await** - For API calls
- **CSS Grid** - Layout system
- **CSS Custom Properties** - Theming
- **localStorage** - Theme persistence
- **fetch()** - API requests

### Mobile Support
- **Responsive design** - Works on all screen sizes
- **Touch-friendly** - Large tap targets
- **Readable fonts** - Scales appropriately

---

## Performance

### Optimization Features
- **Lazy loading** - Only loads selected transaction segment
- **Request caching** - Avoids duplicate API calls  
- **Efficient DOM updates** - Minimal redraws
- **Lightweight assets** - SVG icons, no frameworks

### Loading Times
- **Initial load** - <500ms on local server
- **Balance refresh** - <1s for all three tokens
- **Transaction switching** - <400ms with loading animation  
- **Theme toggle** - Instant (<50ms)

---

**🚀 Ready for production agent deployments!**

The dashboard provides everything agents and users need to monitor their Solana wallet activity in real-time.