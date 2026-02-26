#!/usr/bin/env python3
"""
Test script for x402python library integration with Purch.xyz

This script tests if x402python correctly formats the payment header
for purch.xyz to accept.

Usage:
    python test_x402python.py --product-url <url> --email <email> ...
"""

import argparse
import asyncio
import base64
import json
import sys
from pathlib import Path

import requests

# Try to import x402python
try:
    from x402_solana.schemes.exact_svm.client import create_payment_header
    from x402_solana.shared.svm.wallet import create_signer_from_bytes
    from x402_solana.types import PaymentRequirements
    X402_AVAILABLE = True
except ImportError:
    print("❌ x402python library not installed")
    print("   Install with: pip install x402-solana")
    sys.exit(1)

# Constants
PURCH_API_URL = "https://x402.purch.xyz/orders/solana"
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
        return bytes(private_key)
        
    except Exception as e:
        print(f"❌ Failed to load wallet: {e}")
        sys.exit(1)


def get_wallet_address():
    """Get the wallet address from config"""
    config_file = FUEGO_DIR / "wallet-config.json"
    
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            return config['publicKey']
        except:
            pass
    
    # Fallback - can't derive from private key without solders
    print("❌ Need wallet-config.json with publicKey")
    sys.exit(1)


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
            payment_header = response.headers.get('payment-required')
            if not payment_header:
                print("❌ No payment-required header")
                sys.exit(1)
            
            payment_data = json.loads(base64.b64decode(payment_header))
            print("✅ Received x402 payment challenge")
            return payment_data
        
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Failed: {e}")
        sys.exit(1)


def parse_x402_requirements(payment_data):
    """Parse x402 requirements into PaymentRequirements object"""
    print("🔍 Step 2: Parsing x402 requirements...")
    
    accepts = payment_data.get('accepts', [])
    if not accepts:
        print("❌ No payment options")
        sys.exit(1)
    
    payment_option = accepts[0]
    
    # Extract network ID (remove "solana:" prefix)
    network = payment_option['network'].replace('solana:', '')
    
    requirements = PaymentRequirements(
        scheme=payment_option['scheme'],
        network=network,
        max_amount_required=payment_option['amount'],
        asset=payment_option['asset'],
        pay_to=payment_option['payTo'],
        resource=PURCH_API_URL,
        description="Create an e-commerce order (Amazon, Shopify, etc.)",
        mime_type="application/json",
        max_timeout_seconds=payment_option.get('maxTimeoutSeconds', 300),
        extra={
            "feePayer": payment_option.get('extra', {}).get('feePayer')
        }
    )
    
    amount_human = int(payment_option['amount']) / 1_000_000
    print(f"   💰 Amount: ${amount_human:.2f} USDC")
    print(f"   📍 Pay to: {payment_option['payTo']}")
    
    return requirements


async def create_x402_payment(requirements):
    """Step 3: Use x402python to create payment header"""
    print("🔧 Step 3: Creating payment with x402python library...")
    
    # Load wallet
    private_key_bytes = load_fuego_wallet()
    signer = create_signer_from_bytes(private_key_bytes)
    
    # Create payment header using x402python
    payment_header = await create_payment_header(
        signer=signer,
        x402_version=2,
        payment_requirements=requirements
    )
    
    print("✅ Payment header created with x402python")
    
    # Debug: decode and show what we created
    decoded = base64.b64decode(payment_header)
    payload = json.loads(decoded)
    print("\n   📋 Payment header structure:")
    print(f"      x402Version: {payload.get('x402Version')}")
    print(f"      scheme: {payload.get('scheme')}")
    print(f"      network: {payload.get('network')}")
    print(f"      payload.transaction: {payload.get('payload', {}).get('transaction')[:50]}...")
    
    return payment_header


def submit_x402_payment(payment_header, original_payload):
    """Step 4: Submit payment to purch.xyz"""
    print("\n📤 Step 4: Submitting x402 payment...")
    
    try:
        headers = {
            "Content-Type": "application/json",
            "X-PAYMENT-SIGNATURE": payment_header
        }
        
        response = requests.post(
            PURCH_API_URL,
            json=original_payload,
            headers=headers
        )
        
        print(f"   Response status: {response.status_code}")
        
        if response.status_code == 201:
            print("✅ PAYMENT ACCEPTED!")
            return response.json()
        
        elif response.status_code == 402:
            print("❌ Payment rejected (still requiring payment)")
            print(f"   Headers: {dict(response.headers)}")
            print(f"   Body: {response.text}")
            return None
        
        else:
            print(f"❌ Unexpected: {response.status_code}")
            print(f"   {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Failed: {e}")
        return None


async def main():
    parser = argparse.ArgumentParser(description='Test x402python with Purch.xyz')
    
    parser.add_argument('--product-url', required=True, help='Product URL')
    parser.add_argument('--email', required=True, help='Email')
    parser.add_argument('--name', required=True, help='Recipient name')
    parser.add_argument('--address-line1', required=True, help='Address line 1')
    parser.add_argument('--address-line2', default='', help='Address line 2')
    parser.add_argument('--city', required=True, help='City')
    parser.add_argument('--state', required=True, help='State')
    parser.add_argument('--postal-code', required=True, help='ZIP')
    parser.add_argument('--country', default='US', help='Country')
    
    args = parser.parse_args()
    
    physical_address = {
        "name": args.name,
        "line1": args.address_line1,
        "city": args.city,
        "postalCode": args.postal_code,
        "country": args.country
    }
    
    if args.address_line2:
        physical_address["line2"] = args.address_line2
    if args.state:
        physical_address["state"] = args.state
    
    print("🧪 Testing x402python with Purch.xyz")
    print("=" * 50)
    print(f"Wallet: {get_wallet_address()}")
    print("=" * 50)
    print()
    
    order_payload = {
        "email": args.email,
        "productUrl": args.product_url,
        "physicalAddress": physical_address
    }
    
    # Step 1: Get 402 challenge
    payment_data = send_order_request(
        args.product_url,
        args.email,
        physical_address
    )
    
    # Step 2: Parse requirements
    requirements = parse_x402_requirements(payment_data)
    
    # Step 3: Create payment with x402python
    payment_header = await create_x402_payment(requirements)
    
    # Step 4: Submit payment
    result = submit_x402_payment(payment_header, order_payload)
    
    if result:
        print("\n" + "=" * 50)
        print("🎉 x402python WORKS!")
        print("   Purch accepted the payment!")
        print(f"   Order data: {json.dumps(result, indent=2)}")
        print("=" * 50)
    else:
        print("\n" + "=" * 50)
        print("❌ x402python approach failed")
        print("   Payment was rejected")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
