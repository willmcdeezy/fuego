#!/usr/bin/env python3
"""Test Fuego wallet password decryption - matching TypeScript argon2.hash() behavior"""

import json
import base64
from pathlib import Path

def try_password(password: str) -> bool:
    """Try to decrypt wallet matching TypeScript implementation"""
    keychain_path = Path.home() / ".fuego" / "keychain" / "id.json"
    
    with open(keychain_path, 'r') as f:
        keychain = json.load(f)
    
    try:
        from base58 import b58encode
        import argon2
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        
        salt = base64.b64decode(keychain['salt'])
        encrypted = keychain['encrypted']
        nonce_full = base64.b64decode(encrypted['nonce'])
        ciphertext = base64.b64decode(encrypted['ciphertext'])
        
        iv = nonce_full[:12]
        tag = nonce_full[12:]
        
        # TypeScript: argon2.hash(password, salt) returns encoded hash string
        # Then takes first 32 characters
        # Python equivalent: argon2.PasswordHasher().hash() with custom salt
        
        # Create hasher with TypeScript-compatible settings
        hasher = argon2.PasswordHasher(
            time_cost=3,
            memory_cost=65536,
            parallelism=4,
            hash_len=32,
            salt_len=len(salt)
        )
        
        # Note: argon2-cffi doesn't easily allow custom salt in high-level API
        # We need to use the encoded hash and take first 32 chars
        # But actually, let me try the low-level API differently
        
        # Actually, the TypeScript argon2.hash() returns the encoded string
        # which looks like: $argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$...
        # Taking slice(0, 32) gives us: "$argon2id$v=19$m=65536,t=3"
        # That's used as the key? That seems weird...
        
        # Wait, let me re-read the code. The TypeScript says:
        # const derived = await argon2.hash(password, salt)
        # return Buffer.from(derived.slice(0, 32))
        
        # Hmm, but that would just be the prefix of the hash string
        # Let me check if maybe it's using raw hash output instead
        
        # Try: use argon2 raw hash output (not encoded string)
        from argon2.low_level import hash_secret_raw, Type
        
        derived = hash_secret_raw(
            secret=password.encode(),
            salt=salt,
            time_cost=3,
            memory_cost=65536,
            parallelism=4,  # TypeScript might use 4
            hash_len=32,
            type=Type.ID
        )
        
        # BUT - TypeScript takes slice(0, 32) of the RESULT
        # If argon2.hash() returns a string, slice(0, 32) is string chars
        # If we need to match exactly, maybe the string encoding matters?
        
        # Let's try: use the encoded hash string and take first 32 chars
        # Actually that's probably not right either...
        
        # Actually, I think the TypeScript argon2.hash might be returning raw bytes
        # Let me check the npm package documentation...
        
        # For now, let's try the raw approach
        key = bytes(derived[:32])
        
        ciphertext_with_tag = ciphertext + tag
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(iv, ciphertext_with_tag, None)
        
        private_key = decrypted[:32]
        
        print(f"✅ Password correct!")
        print(f"   Private key (base58): {b58encode(private_key).decode()}")
        print(f"   Export command:")
        print(f"   export FUEGO_KEYPAIR_BASE58='{b58encode(private_key).decode()}'")
        return True
        
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

if __name__ == "__main__":
    password = "CriticalMewTwo22!"
    print(f"Testing password: {password}\n")
    try_password(password)
