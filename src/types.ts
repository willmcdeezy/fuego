// Core wallet types - SIMPLIFIED (no encryption)
export interface WalletConfig {
  walletAddress: string
  network: 'mainnet-beta' | 'devnet' | 'testnet'
  createdAt: number
  version: string
}

// Simple wallet storage (Solana CLI compatible)
export interface WalletStore {
  privateKey: number[]  // Array of 64 bytes (Solana standard format)
  address: string
  network: string
}

export interface FuegoConfig {
  configPath: string
  walletPath: string  // Single wallet file (no encryption)
  logsPath: string
}