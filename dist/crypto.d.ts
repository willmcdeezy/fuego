import { Keypair } from '@solana/web3.js';
/**
 * Save keypair to simple JSON format (like Solana CLI)
 */
export declare function saveWalletToFile(keypair: Keypair, filePath: string, network?: string): void;
/**
 * Load keypair from simple JSON format
 */
export declare function loadWalletFromFile(filePath: string): Keypair;
/**
 * Check if wallet file exists and is valid
 */
export declare function isValidWalletFile(filePath: string): boolean;
//# sourceMappingURL=crypto.d.ts.map