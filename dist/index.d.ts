import { Keypair } from '@solana/web3.js';
import { FuegoConfig } from './types.js';
export declare class FuegoWallet {
    private config;
    private walletConfig;
    private keypair;
    constructor(config?: Partial<FuegoConfig>);
    /**
     * Initialize wallet with new keypair - NO PASSWORD REQUIRED!
     */
    initialize(keypair: Keypair, network?: string): Promise<void>;
    /**
     * Load wallet - NO PASSWORD REQUIRED!
     */
    load(): Promise<void>;
    /**
     * Get wallet address
     */
    getAddress(): string;
    /**
     * Get keypair - NO SESSION/PASSWORD CHECKS!
     */
    getKeypair(): Keypair;
    /**
     * Sign arbitrary data
     */
    signData(data: Buffer): Buffer;
    /**
     * Check if wallet exists
     */
    exists(): boolean;
    /**
     * Load wallet config from disk
     */
    private loadConfig;
}
export { saveWalletToFile, loadWalletFromFile, isValidWalletFile } from './crypto.js';
export * from './types.js';
//# sourceMappingURL=index.d.ts.map