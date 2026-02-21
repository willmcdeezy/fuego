import fs from 'fs';
import path from 'path';
import { saveWalletToFile, loadWalletFromFile, isValidWalletFile } from './crypto.js';
export class FuegoWallet {
    constructor(config) {
        this.walletConfig = null;
        this.keypair = null;
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const fuegoDir = path.join(homeDir, '.fuego');
        this.config = {
            configPath: path.join(fuegoDir, 'config.json'),
            walletPath: path.join(fuegoDir, 'wallet.json'), // Simple JSON file
            logsPath: path.join(fuegoDir, 'logs'),
            ...config
        };
        this.loadConfig();
    }
    /**
     * Initialize wallet with new keypair - NO PASSWORD REQUIRED!
     */
    async initialize(keypair, network = 'mainnet-beta') {
        console.log('🔥 Initializing Fuego wallet...');
        // Create directories
        const fuegoDir = path.dirname(this.config.configPath);
        const logsDir = this.config.logsPath;
        for (const dir of [fuegoDir, logsDir]) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            }
        }
        // Save wallet as simple JSON
        saveWalletToFile(keypair, this.config.walletPath, network);
        // Store wallet config
        this.walletConfig = {
            walletAddress: keypair.publicKey.toString(),
            network: network,
            createdAt: Date.now(),
            version: '0.1.0'
        };
        fs.writeFileSync(this.config.configPath, JSON.stringify(this.walletConfig, null, 2));
        fs.chmodSync(this.config.configPath, 0o600);
        console.log(`✅ Wallet initialized: ${keypair.publicKey.toString()}`);
        console.log(`📁 Wallet file: ${this.config.walletPath}`);
    }
    /**
     * Load wallet - NO PASSWORD REQUIRED!
     */
    async load() {
        if (!fs.existsSync(this.config.walletPath)) {
            throw new Error('Wallet not found. Run "fuego init" first.');
        }
        this.keypair = loadWalletFromFile(this.config.walletPath);
        console.log('✅ Wallet loaded successfully');
    }
    /**
     * Get wallet address
     */
    getAddress() {
        if (!this.walletConfig) {
            this.loadConfig();
        }
        return this.walletConfig?.walletAddress || 'unknown';
    }
    /**
     * Get keypair - NO SESSION/PASSWORD CHECKS!
     */
    getKeypair() {
        if (!this.keypair) {
            // Auto-load if needed
            this.keypair = loadWalletFromFile(this.config.walletPath);
        }
        return this.keypair;
    }
    /**
     * Sign arbitrary data
     */
    signData(data) {
        const keypair = this.getKeypair();
        const nacl = require('tweetnacl');
        // Use nacl to sign with the secret key
        const signature = nacl.sign.detached(data, keypair.secretKey);
        return Buffer.from(signature);
    }
    /**
     * Check if wallet exists
     */
    exists() {
        return isValidWalletFile(this.config.walletPath);
    }
    /**
     * Load wallet config from disk
     */
    loadConfig() {
        if (fs.existsSync(this.config.configPath)) {
            this.walletConfig = JSON.parse(fs.readFileSync(this.config.configPath, 'utf-8'));
        }
    }
}
// Export utilities for direct use
export { saveWalletToFile, loadWalletFromFile, isValidWalletFile } from './crypto.js';
export * from './types.js';
//# sourceMappingURL=index.js.map