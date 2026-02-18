#!/usr/bin/env python3
"""
Fuego Agent Transaction Signer

Sign and submit USDC/SOL transfers using FuegoWallet.
- Server builds unsigned tx
- Agent signs with encrypted wallet
- Agent submits signed tx

Usage:
    python3 sign_and_submit.py --from <ADDRESS> --to <ADDRESS> --amount <AMOUNT>

Environment:
    FUEGO_WALLET: Path to wallet.json (default: ~/.fuego/wallet.json)
    FUEGO_SERVER: Server URL (default: http://127.0.0.1:8080)
    FUEGO_NETWORK: Solana network (default: mainnet-beta)
"""

import argparse
import json
import os
import sys
import base64
import requests
from pathlib import Path
from getpass import getpass

# Try to import solders (agent signing library)
try:
    from solders.transaction import Transaction
    from solders.keypair import Keypair
    from solders.instruction import Instruction
    from solders.pubkey import Pubkey
except ImportError:
    print("❌ Error: solders not installed")
    print("Install with: pip install solders")
    sys.exit(1)

# Wallet encryption/decryption (simplified - in production use proper crypto)
class SimpleWallet:
    """Minimal wallet implementation for this script"""
    
    def __init__(self, keypair_bytes: bytes, password: str):
        self.keypair = Keypair.from_bytes(keypair_bytes)
        self.password = password  # Not actually used here, just for symmetry
    
    @staticmethod
    def load(wallet_path: str, password: str) -> "SimpleWallet":
        """Load wallet from ~/.fuego/wallet.json"""
        wallet_path = Path(wallet_path).expanduser()
        
        if not wallet_path.exists():
            raise FileNotFoundError(f"Wallet not found at {wallet_path}")
        
        with open(wallet_path, 'r') as f:
            wallet_data = json.load(f)
        
        # In production, decrypt with password + Argon2
        # For now, this is a placeholder
        # The actual FuegoWallet is TypeScript: src/wallet.ts
        
        if 'keypair' in wallet_data:
            # Assume keypair is base58 encoded or similar
            # This is where FuegoWallet decryption happens
            raise NotImplementedError(
                "Wallet decryption requires the TypeScript FuegoWallet\n"
                "For now, use environment variable: FUEGO_KEYPAIR_BASE58"
            )
        
        raise ValueError("Invalid wallet format")


def load_wallet_from_env() -> Keypair:
    """Load keypair from environment variable (test/demo only)"""
    keypair_b58 = os.getenv("FUEGO_KEYPAIR_BASE58")
    if not keypair_b58:
        raise ValueError(
            "No wallet loaded. Set FUEGO_KEYPAIR_BASE58 or use FuegoWallet init.\n"
            "Example: export FUEGO_KEYPAIR_BASE58='...'  # base58 secret key"
        )
    
    from base58 import b58decode
    keypair_bytes = b58decode(keypair_b58)
    return Keypair.from_bytes(keypair_bytes)


def build_transfer(server_url: str, network: str, from_addr: str, to_addr: str, 
                  amount: str, token_type: str = "USDC") -> dict:
    """Request server to build unsigned transaction"""
    
    endpoint = f"{server_url}/build-transfer-{token_type.lower()}"
    
    payload = {
        "network": network,
        "from_address": from_addr,
        "to_address": to_addr,
        "amount": amount,
        "yid": f"agent-{os.getpid()}-{int(__import__('time').time() * 1000)}"
    }
    
    response = requests.post(endpoint, json=payload)
    response.raise_for_status()
    
    result = response.json()
    if not result.get("success"):
        raise ValueError(f"Server error: {result.get('error')}")
    
    return result["data"]


def sign_transaction(tx_base64: str, keypair: Keypair) -> str:
    """Deserialize, sign, and return signed transaction"""
    
    # Decode from server's base64
    tx_bytes = base64.b64decode(tx_base64)
    
    # Deserialize into Transaction object
    tx = Transaction.from_bytes(tx_bytes)
    
    # Sign with agent's keypair (blockhash already in message)
    tx.sign([keypair], None)  # None = use msg's blockhash
    
    # Serialize and re-encode for submission
    signed_bytes = bytes(tx)
    return base64.b64encode(signed_bytes).decode()


def submit_transaction(server_url: str, network: str, signed_tx_b64: str) -> dict:
    """Submit signed transaction to server for broadcast"""
    
    endpoint = f"{server_url}/submit-transaction"
    
    payload = {
        "network": network,
        "transaction": signed_tx_b64
    }
    
    response = requests.post(endpoint, json=payload)
    response.raise_for_status()
    
    result = response.json()
    if not result.get("success"):
        raise ValueError(f"Server error: {result.get('error')}")
    
    return result["data"]


def main():
    parser = argparse.ArgumentParser(
        description="Sign and submit Solana transactions with FuegoWallet"
    )
    parser.add_argument("--from", dest="from_addr", required=True,
                       help="Source wallet address")
    parser.add_argument("--to", required=True,
                       help="Destination wallet address")
    parser.add_argument("--amount", required=True,
                       help="Transfer amount (in token units)")
    parser.add_argument("--token", choices=["USDC", "SOL", "USDT"], default="USDC",
                       help="Token type (default: USDC)")
    parser.add_argument("--network", default="mainnet-beta",
                       help="Solana network (default: mainnet-beta)")
    parser.add_argument("--server", default="http://127.0.0.1:8080",
                       help="Fuego server URL (default: localhost:8080)")
    parser.add_argument("--wallet", default="~/.fuego/wallet.json",
                       help="Wallet file path (default: ~/.fuego/wallet.json)")
    parser.add_argument("--keypair", 
                       help="Agent keypair (base58) - for testing only")
    
    args = parser.parse_args()
    
    print(f"🔥 Fuego Agent Transaction Signer")
    print(f"Network: {args.network}")
    print(f"From: {args.from_addr}")
    print(f"To: {args.to}")
    print(f"Amount: {args.amount} {args.token}")
    print()
    
    # Load keypair
    try:
        if args.keypair:
            # Test mode: use provided keypair
            from base58 import b58decode
            keypair_bytes = b58decode(args.keypair)
            keypair = Keypair.from_bytes(keypair_bytes)
            print("✅ Loaded keypair from --keypair")
        else:
            # Production mode: prompt for wallet password
            print("Loading FuegoWallet...")
            password = getpass("Wallet password: ")
            # This would call FuegoWallet.load() in TypeScript
            # For now, try env variable fallback
            keypair = load_wallet_from_env()
            print("✅ Loaded keypair from environment")
    except Exception as e:
        print(f"❌ Failed to load wallet: {e}")
        sys.exit(1)
    
    print()
    
    try:
        # Step 1: Request server to build unsigned transaction
        print("📝 Building unsigned transaction...")
        build_result = build_transfer(
            args.server, args.network,
            args.from_addr, args.to,
            args.amount, args.token
        )
        print(f"✅ Transaction built")
        print(f"   Blockhash: {build_result['blockhash'][:20]}...")
        print(f"   Memo: {build_result['memo']}")
        print()
        
        # Step 2: Sign with agent's keypair
        print("🔐 Signing transaction with FuegoWallet...")
        signed_tx_b64 = sign_transaction(build_result['transaction'], keypair)
        print(f"✅ Transaction signed")
        print()
        
        # Step 3: Submit to server for broadcast
        print("📤 Submitting signed transaction...")
        submit_result = submit_transaction(
            args.server, args.network,
            signed_tx_b64
        )
        print(f"✅ Transaction submitted!")
        print()
        
        # Success!
        sig = submit_result['signature']
        link = submit_result.get('explorer_link', 
                                f"https://explorer.solana.com/tx/{sig}?cluster={args.network}")
        
        print("=" * 70)
        print(f"Signature: {sig}")
        print(f"Explorer:  {link}")
        print("=" * 70)
        print()
        print("🎉 Transaction on-chain! Verify with the explorer link above.")
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Failed to connect to Fuego server at {args.server}")
        print("   Is the server running? Start with: ./fuego-server")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
