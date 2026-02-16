# Fuego Dashboard

Simple, beautiful web dashboard for Fuego wallets. Shows:
- Wallet address (copy-to-clipboard)
- SOL balance
- USDC balance  
- USDT balance
- Transaction history (when endpoint is added)

## Quick Start

**Prerequisites:**
- Fuego server running on `localhost:8080`
- Python 3 (for HTTP server)
- Your wallet address

**Run:**
```bash
./serve.sh FgbVaHht1zSBtFUNGDu6E4BkVBuGXWhpS8JeFpCGEquL
```

Or:
```bash
./serve.sh  # Uses address from ~/.fuego/config.json
```

Dashboard will:
1. Find an available port (3000-3100)
2. Start local HTTP server
3. Open in your default browser
4. Display wallet info + balances

## Features

✅ **Balances** - Real-time SOL, USDC, USDT  
✅ **Wallet Address** - Easy copy-to-clipboard  
✅ **Mobile Responsive** - Works on phone/tablet  
✅ **Dark Mode Ready** - Adapts to system preference  
✅ **Transaction History** - Ready when endpoint provided  

## API Integration

Dashboard fetches from Fuego server:
- `POST /balance` → SOL balance
- `POST /usdc-balance` → USDC balance
- `POST /usdt-balance` → USDT balance
- `POST /transaction-history` → TX history (placeholder)

## Configuration

Pass wallet address via:
1. Command line: `./serve.sh <address>`
2. URL query param: `?address=...`
3. Config file: `~/.fuego/config.json` (auto-detected)

Address is stored in browser localStorage for persistence.

## Development

**Edit styles:** `<style>` section in `dashboard.html`  
**Edit layout:** HTML body (responsive grid layout)  
**Edit logic:** `<script>` section (fetch calls, UI updates)

All in one file for simplicity.

## Transaction History (Future)

When you add `/transaction-history` endpoint, it should return:

```json
{
  "success": true,
  "data": [
    {
      "signature": "tx-signature",
      "from": "wallet-address",
      "to": "recipient-address",
      "amount": "10.5",
      "token": "USDC",
      "timestamp": "2026-02-16T13:00:00Z"
    }
  ]
}
```

Dashboard will auto-render with explorer links.

## Troubleshooting

**Port conflicts:** Script auto-finds available port (3000-3100)  
**Server not running:** Ensure Fuego server on 8080 is active  
**Balances not loading:** Check wallet address is valid  
**TX history missing:** Endpoint not yet implemented  

## Next Steps

- [ ] Add `/transaction-history` endpoint
- [ ] Add deposit button (MoonPay integration)
- [ ] Add send transaction UI
- [ ] Add theme customization (light/dark)
- [ ] Add QR code for wallet address
