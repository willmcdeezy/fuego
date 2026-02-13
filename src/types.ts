// Core wallet types
export interface WalletConfig {
  walletAddress: string
  network: 'mainnet-beta' | 'devnet' | 'testnet'
  createdAt: number
  version: string
}

export interface EncryptedKeypair {
  nonce: string  // Base64 encoded
  ciphertext: string  // Base64 encoded
  algorithm: 'AES-256-GCM'
}

export interface KeychainStore {
  encrypted: EncryptedKeypair
  salt: string  // Base64 encoded Argon2 salt
}

export interface SessionToken {
  key: Buffer  // Derived encryption key
  expiry: number  // Timestamp
}

export interface FuegoConfig {
  configPath: string
  keychainPath: string
  saltPath: string
  logsPath: string
  sessionTimeout: number  // ms
}
