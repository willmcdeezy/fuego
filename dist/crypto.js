// Simple wallet utilities - NO PASSWORD COMPLEXITY!
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
/**
 * Save keypair to simple JSON format (like Solana CLI)
 */
export function saveWalletToFile(keypair, filePath, network = 'mainnet-beta') {
    const wallet = {
        privateKey: Array.from(keypair.secretKey), // 64-byte array
        address: keypair.publicKey.toString(),
        network
    };
    fs.writeFileSync(filePath, JSON.stringify(wallet, null, 2));
    fs.chmodSync(filePath, 0o600); // User read/write only (real security)
}
/**
 * Load keypair from simple JSON format
 */
export function loadWalletFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Wallet file not found: ${filePath}`);
    }
    const wallet = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!wallet.privateKey || wallet.privateKey.length !== 64) {
        throw new Error('Invalid wallet format: privateKey must be 64-byte array');
    }
    return Keypair.fromSecretKey(new Uint8Array(wallet.privateKey));
}
/**
 * Check if wallet file exists and is valid
 */
export function isValidWalletFile(filePath) {
    try {
        loadWalletFromFile(filePath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=crypto.js.map