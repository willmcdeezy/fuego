#!/usr/bin/env python3
"""
Test script for the new x402-request endpoint
Usage: python3 test_x402_endpoint.py
"""

import requests
import json

# Test the Helius x402 endpoint
def test_helius_x402():
    print("🧪 Testing Fuego x402 endpoint with Helius...")
    
    fuego_endpoint = "http://localhost:8080/x402-request"
    
    payload = {
        "url": "https://helius.api.corbits.dev",
        "method": "POST",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBlockHeight"
        }
    }
    
    try:
        print("📤 Sending request to Fuego x402 handler...")
        response = requests.post(fuego_endpoint, json=payload)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(json.dumps(result, indent=2))
            
            if result.get("payment_required"):
                print(f"💰 Payment processed: ${result['payment_details']['amount_usdc']} USDC")
                print(f"🎯 Final API status: {result['status']}")
            else:
                print("ℹ️  No payment required")
                
        else:
            print("❌ Failed:")
            print(response.text)
            
    except Exception as e:
        print(f"💥 Error: {e}")

def test_non_x402_endpoint():
    print("\n🧪 Testing with non-x402 endpoint (should pass through)...")
    
    fuego_endpoint = "http://localhost:8080/x402-request"
    
    payload = {
        "url": "https://httpbin.org/json",
        "method": "GET"
    }
    
    try:
        response = requests.post(fuego_endpoint, json=payload)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Pass-through successful!")
            print(f"Payment required: {result.get('payment_required', False)}")
            
    except Exception as e:
        print(f"💥 Error: {e}")

if __name__ == "__main__":
    print("🔥 Fuego x402 Endpoint Tester")
    print("=" * 40)
    
    # Test x402 endpoint
    test_helius_x402()
    
    # Test regular endpoint (pass-through)
    test_non_x402_endpoint()
    
    print("\n✨ Testing complete!")