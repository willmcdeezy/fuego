#!/usr/bin/env python3
"""
Purch.xyz x402 Payment Script

Flow:
1. Send order details to purch.xyz
2. Receive 402 Payment Required response
3. Build x402 payment transaction via Rust server
4. Sign transaction with local wallet
5. Submit payment to purch.xyz
6. Receive order transaction
7. Sign and submit order transaction

Usage:
    python purch.py --product-url <url> --email <email> --name <name> \
                    --address-line1 <line1> --address-line2 <line2> \
                    --city <city> --state <state> --postal-code <zip> \
                    --country <country>
"""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

import requests
from solders.keypair import Keypair
from solders.transaction import Transaction, VersionedTransaction

# Constants
PURCH_API_URL = "https://x402.purch.xyz/orders/solana"
RUST_SERVER_URL = "http://127.0.0.1:8080"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Fuego wallet paths
FUEGO_DIR = Path.home() / ".fuego"
WALLET_FILE = FUEGO_DIR / "wallet.json"


def load_fuego_wallet():
    """Load the Fuego wallet keypair from ~/.fuego/wallet.json"""
    if not WALLET_FILE.exists():
        print(f"❌ Wallet not found at {WALLET_FILE}")
        print("   Run 'fuego create' first to initialize your wallet")
        sys.exit(1)
    
    try:
        with open(WALLET_FILE, 'r') as f:
            wallet_data = json.load(f)
        
        private_key = wallet_data['privateKey']
        keypair = Keypair.from_bytes(bytes(private_key))
        
        return keypair
    except Exception as e:
        print(f"❌ Failed to load wallet: {e}")
        sys.exit(1)


def get_wallet_address():
    """Get the wallet address from config or wallet file"""
    config_file = FUEGO_DIR / "wallet-config.json"
    
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            return config['publicKey']
        except:
            pass
    
    # Fallback to wallet file
    keypair = load_fuego_wallet()
    return str(keypair.pubkey())


def send_order_request(product_url, email, physical_address):
    """Step 1: Send order details to purch.xyz"""
    print("📦 Step 1: Sending order request to purch.xyz...")
    
    payer_address = get_wallet_address()
    
    payload = {
        "email": email,
        "payerAddress": payer_address,
        "productUrl": product_url,
        "physicalAddress": physical_address
    }
    
    try:
        response = requests.post(PURCH_API_URL, json=payload)
        
        if response.status_code == 402:
            # Payment required - this is expected
            payment_header = response.headers.get('payment-required')
            if not payment_header:
                print("❌ No payment-required header in 402 response")
                sys.exit(1)
            
            # Decode base64 payment requirements
            payment_data = json.loads(base64.b64decode(payment_header))
            print("✅ Received x402 payment challenge")
            return payment_data
        
        elif response.status_code == 201:
            # Order created without payment? Unlikely for x402
            print("✅ Order created (no payment required)")
            return response.json()
        
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"   Response: {response.text}")
            sys.exit(1)
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to send order request: {e}")
        sys.exit(1)


def parse_x402_requirements(payment_data):
    """Parse x402 payment requirements from the challenge"""
    print("🔍 Step 2: Parsing x402 payment requirements...")
    
    try:
        accepts = payment_data.get('accepts', [])
        if not accepts:
            print("❌ No payment options in x402 challenge")
            sys.exit(1)
        
        # Get first payment option (usually only one)
        payment_option = accepts[0]
        
        requirements = {
            'scheme': payment_option['scheme'],
            'network': payment_option['network'],
            'amount': payment_option['amount'],  # In smallest units (e.g., 10000)
            'asset': payment_option['asset'],    # USDC mint
            'pay_to': payment_option['payTo'],   # Their wallet
            'max_timeout_seconds': payment_option.get('maxTimeoutSeconds', 300),
            'fee_payer': payment_option.get('extra', {}).get('feePayer')
        }
        
        # Convert amount to human readable
        amount_human = int(requirements['amount']) / 1_000_000
        print(f"   💰 Amount: ${amount_human:.2f} USDC ({requirements['amount']} units)")
        print(f"   📍 Pay to: {requirements['pay_to']}")
        print(f"   ⏱️  Timeout: {requirements['max_timeout_seconds']}s")
        
        return requirements
        
    except KeyError as e:
        print(f"❌ Missing field in payment data: {e}")
        print(f"   Data: {json.dumps(payment_data, indent=2)}")
        sys.exit(1)


def build_x402_payment_via_rust(requirements):
    """Step 3: Call Rust server to build the x402 payment transaction"""
    print("🔧 Step 3: Building payment transaction via Rust server...")
    
    payer_address = get_wallet_address()
    
    payload = {
        "network": "mainnet-beta",
        "payer_address": payer_address,
        "pay_to_address": requirements['pay_to'],
        "amount": requirements['amount'],
        "asset": requirements['asset'],
        "fee_payer": requirements.get('fee_payer')
    }
    
    try:
        response = requests.post(
            f"{RUST_SERVER_URL}/build-x402-purch-payment",
            json=payload
        )
        
        if response.status_code != 200:
            print(f"❌ Rust server error: {response.status_code}")
            print(f"   {response.text}")
            sys.exit(1)
        
        result = response.json()
        
        if not result.get('success'):
            print(f"❌ Failed to build transaction: {result.get('error')}")
            sys.exit(1)
        
        print("✅ Transaction built successfully")
        return result['data']['transaction']  # Base64 encoded
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to Rust server: {e}")
        print("   Make sure the server is running: fuego serve")
        sys.exit(1)


def sign_transaction(base64_tx):
    """Step 4: Sign the transaction with local wallet"""
    print("✍️  Step 4: Signing transaction with Fuego wallet...")
    
    keypair = load_fuego_wallet()
    
    try:
        # Decode base64 transaction
        tx_bytes = base64.b64decode(base64_tx)
        
        # Deserialize transaction
        transaction = Transaction.from_bytes(tx_bytes)
        
        # Get the blockhash from the transaction message
        blockhash = transaction.message.recent_blockhash
        
        # Sign transaction with blockhash
        signed_tx = transaction.sign([keypair], blockhash)
        
        # Serialize signed transaction
        signed_bytes = bytes(signed_tx)
        signed_base64 = base64.b64encode(signed_bytes).decode('utf-8')
        
        print("✅ Transaction signed")
        return signed_base64
        
    except Exception as e:
        print(f"❌ Failed to sign transaction: {e}")
        sys.exit(1)


def submit_x402_payment(signed_tx, original_payload):
    """Step 5: Submit signed payment to purch.xyz"""
    print("📤 Step 5: Submitting x402 payment to purch.xyz...")
    
    try:
        # Build x402 payment header
        payment_payload = {
            "x402Version": 2,
            "scheme": "exact",
            "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            "payload": {
                "transaction": signed_tx  # The signed transaction
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-PAYMENT-SIGNATURE": base64.b64encode(
                json.dumps(payment_payload).encode()
            ).decode('utf-8')
        }
        
        response = requests.post(
            PURCH_API_URL,
            json=original_payload,
            headers=headers
        )
        
        if response.status_code == 201:
            print("✅ Payment accepted! Order created")
            return response.json()
        
        elif response.status_code == 402:
            print("❌ Payment rejected (still requiring payment)")
            print(f"   Response: {response.text}")
            sys.exit(1)
        
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"   Response: {response.text}")
            sys.exit(1)
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to submit payment: {e}")
        sys.exit(1)


def sign_and_submit_order(order_data):
    """Step 6 & 7: Sign and submit the order transaction"""
    print("📝 Step 6: Signing order transaction...")
    
    serialized_tx = order_data.get('serializedTransaction')
    if not serialized_tx:
        print("❌ No serialized transaction in order data")
        print(f"   Data: {json.dumps(order_data, indent=2)}")
        sys.exit(1)
    
    # Sign the order transaction
    signed_tx = sign_transaction(serialized_tx)
    
    print("📤 Step 7: Submitting order transaction to blockchain...")
    
    try:
        # Submit via Rust server
        payload = {
            "network": "mainnet-beta",
            "transaction": signed_tx
        }
        
        response = requests.post(
            f"{RUST_SERVER_URL}/submit-transaction",
            json=payload
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to submit: {response.status_code}")
            print(f"   {response.text}")
            sys.exit(1)
        
        result = response.json()
        
        if not result.get('success'):
            print(f"❌ Transaction failed: {result.get('error')}")
            sys.exit(1)
        
        data = result['data']
        print("✅ Order transaction submitted!")
        print(f"   📝 Signature: {data['signature']}")
        print(f"   🔗 Explorer: {data['explorer_link']}")
        
        return data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to submit transaction: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Purchase products via purch.xyz using x402 payments'
    )
    
    parser.add_argument('--product-url', required=True, help='Product URL (Amazon, Shopify, etc.)')
    parser.add_argument('--email', required=True, help='Email for order notifications')
    parser.add_argument('--name', required=True, help='Recipient name')
    parser.add_argument('--address-line1', required=True, help='Address line 1')
    parser.add_argument('--address-line2', default='', help='Address line 2 (optional)')
    parser.add_argument('--city', required=True, help='City')
    parser.add_argument('--state', required=True, help='State/Province (2-letter code)')
    parser.add_argument('--postal-code', required=True, help='Postal/ZIP code')
    parser.add_argument('--country', default='US', help='Country code (default: US)')
    parser.add_argument('--test', action='store_true', help='Test mode - stop after receiving order response')
    
    args = parser.parse_args()
    
    # Build physical address
    physical_address = {
        "name": args.name,
        "line1": args.address_line1,
        "line2": args.address_line2,
        "city": args.city,
        "state": args.state,
        "postalCode": args.postal_code,
        "country": args.country
    }
    
    # Remove empty line2
    if not physical_address['line2']:
        del physical_address['line2']
    
    print("🛒 Starting Purch.xyz x402 Payment Flow")
    print("=" * 50)
    print(f"   Product: {args.product_url}")
    print(f"   Email: {args.email}")
    print(f"   Shipping to: {args.name}")
    print(f"   Wallet: {get_wallet_address()}")
    print("=" * 50)
    print()
    
    # Step 1: Send order request
    order_payload = {
        "email": args.email,
        "productUrl": args.product_url,
        "physicalAddress": physical_address
    }
    
    # Actually we need to send the request first to get 402
    payment_data = send_order_request(
        args.product_url,
        args.email,
        physical_address
    )
    
    if isinstance(payment_data, dict) and 'orderId' in payment_data:
        # Order was created without x402 payment (unlikely)
        print("✅ Order completed without payment!")
        print(f"   Order ID: {payment_data['orderId']}")
        return
    
    # Step 2: Parse x402 requirements
    requirements = parse_x402_requirements(payment_data)
    
    # Step 3: Build payment transaction via Rust
    unsigned_tx = build_x402_payment_via_rust(requirements)
    
    # Step 4: Sign transaction
    signed_tx = sign_transaction(unsigned_tx)
    
    # Step 5: Submit x402 payment
    order_data = submit_x402_payment(signed_tx, order_payload)
    
    # TEST MODE: Stop here and output the response
    if args.test:
        print()
        print("=" * 50)
        print("🧪 TEST MODE - Stopping before final submission")
        print("=" * 50)
        print()
        print("📦 Order Data received from purch.xyz:")
        print(json.dumps(order_data, indent=2))
        print()
        print("✅ x402 payment was accepted!")
        print("   Next step would be: sign and submit order transaction")
        return
    
    # Step 6 & 7: Sign and submit order transaction
    result = sign_and_submit_order(order_data)
    
    print()
    print("=" * 50)
    print("🎉 Purchase complete!")
    print(f"   Order ID: {order_data.get('orderId', 'N/A')}")
    print(f"   Transaction: {result['signature']}")
    print("=" * 50)


if __name__ == "__main__":
    main()
