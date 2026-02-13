import fs from 'fs'
import path from 'path'
import { Keypair, PublicKey } from '@solana/web3.js'
import { 
  encryptData, 
  decryptData, 
  deriveKeyFromPassword, 
  generateSalt 
} from './crypto'
import {
  WalletConfig,
  KeychainStore,
  SessionToken,
  FuegoConfig,
  EncryptedKeypair
} from './types'

export class FuegoWallet {
  private config: FuegoConfig
  private sessionToken: SessionToken | null = null
  private walletConfig: WalletConfig | null = null

  constructor(config?: Partial<FuegoConfig>) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    const fuegoDir = path.join(homeDir, '.fuego')

    this.config = {
      configPath: path.join(fuegoDir, 'config.json'),
      keychainPath: path.join(fuegoDir, 'keychain', 'id.json'),
      saltPath: path.join(fuegoDir, 'keychain', 'salt.json'),
      logsPath: path.join(fuegoDir, 'logs'),
      sessionTimeout: 30 * 60 * 1000,  // 30 minutes
      ...config
    }

    this.loadConfig()
  }

  /**
   * Initialize wallet with new keypair
   */
  async initialize(keypair: Keypair, password: string): Promise<void> {
    console.log('🔥 Initializing Fuego wallet...')

    // Create directories
    const fuegoDir = path.dirname(this.config.configPath)
    const keychainDir = path.dirname(this.config.keychainPath)
    const logsDir = this.config.logsPath

    for (const dir of [fuegoDir, keychainDir, logsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      }
    }

    // Generate salt and derive key
    const salt = generateSalt()
    const key = await deriveKeyFromPassword(password, salt)

    // Encrypt keypair
    const keypairBuffer = Buffer.from(keypair.secretKey)
    const encrypted = encryptData(keypairBuffer, key)

    // Store encrypted keypair
    const keychain: KeychainStore = {
      encrypted,
      salt: salt.toString('base64')
    }
    fs.writeFileSync(this.config.keychainPath, JSON.stringify(keychain, null, 2))

    // Store wallet config
    this.walletConfig = {
      walletAddress: keypair.publicKey.toString(),
      network: 'mainnet-beta',
      createdAt: Date.now(),
      version: '0.1.0'
    }
    fs.writeFileSync(this.config.configPath, JSON.stringify(this.walletConfig, null, 2))

    // Set file permissions (user read/write only)
    fs.chmodSync(this.config.keychainPath, 0o600)
    fs.chmodSync(this.config.saltPath, 0o600)
    fs.chmodSync(this.config.configPath, 0o600)

    console.log(`✅ Wallet initialized: ${keypair.publicKey.toString()}`)
  }

  /**
   * Authenticate with password and create session
   */
  async authenticate(password: string): Promise<void> {
    if (!fs.existsSync(this.config.keychainPath)) {
      throw new Error('Wallet not initialized. Run "fuego init" first.')
    }

    const keychain: KeychainStore = JSON.parse(
      fs.readFileSync(this.config.keychainPath, 'utf-8')
    )

    const salt = Buffer.from(keychain.salt, 'base64')
    const key = await deriveKeyFromPassword(password, salt)

    // Test decryption
    try {
      decryptData(keychain.encrypted, key)
    } catch (error) {
      throw new Error('Invalid password')
    }

    // Store session token
    this.sessionToken = {
      key,
      expiry: Date.now() + this.config.sessionTimeout
    }

    console.log('✅ Authentication successful')
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    if (!this.walletConfig) {
      this.loadConfig()
    }
    return this.walletConfig?.walletAddress || 'unknown'
  }

  /**
   * Check if session is valid
   */
  private ensureSessionValid(): void {
    if (!this.sessionToken) {
      throw new Error('Not authenticated. Call authenticate() first.')
    }
    if (Date.now() > this.sessionToken.expiry) {
      this.sessionToken = null
      throw new Error('Session expired. Re-authenticate.')
    }
  }

  /**
   * Get decrypted keypair (requires active session)
   */
  private getKeypair(): Keypair {
    this.ensureSessionValid()

    const keychain: KeychainStore = JSON.parse(
      fs.readFileSync(this.config.keychainPath, 'utf-8')
    )

    const decrypted = decryptData(keychain.encrypted, this.sessionToken!.key)
    return Keypair.fromSecretKey(new Uint8Array(decrypted))
  }

  /**
   * Sign arbitrary data
   */
  signData(data: Buffer): Buffer {
    const keypair = this.getKeypair()
    return Buffer.from(keypair.sign(data))
  }

  /**
   * Logout (clear session)
   */
  logout(): void {
    this.sessionToken = null
    console.log('✅ Logged out')
  }

  /**
   * Load wallet config from disk
   */
  private loadConfig(): void {
    if (fs.existsSync(this.config.configPath)) {
      this.walletConfig = JSON.parse(
        fs.readFileSync(this.config.configPath, 'utf-8')
      )
    }
  }
}
