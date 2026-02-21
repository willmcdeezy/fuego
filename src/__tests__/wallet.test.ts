import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import { Keypair } from '@solana/web3.js'
import { FuegoWallet, saveWalletToFile, loadWalletFromFile } from '../index.js'

const TEST_DIR = '/tmp/fuego-test'
const TEST_WALLET_PATH = path.join(TEST_DIR, 'test-wallet.json')

describe('FuegoWallet - Simplified Edition', () => {
  let testKeypair: Keypair

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true })
    }
    
    // Generate test keypair
    testKeypair = Keypair.generate()
  })

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  test('saves and loads wallet without passwords', () => {
    // Save wallet
    saveWalletToFile(testKeypair, TEST_WALLET_PATH)
    
    // Verify file exists and has correct permissions
    expect(fs.existsSync(TEST_WALLET_PATH)).toBe(true)
    const stats = fs.statSync(TEST_WALLET_PATH)
    expect(stats.mode & 0o777).toBe(0o600)  // User read/write only
    
    // Load wallet
    const loadedKeypair = loadWalletFromFile(TEST_WALLET_PATH)
    
    // Verify keypairs match
    expect(loadedKeypair.publicKey.toString()).toBe(testKeypair.publicKey.toString())
    expect(loadedKeypair.secretKey).toEqual(testKeypair.secretKey)
  })

  test('wallet file has correct JSON structure', () => {
    saveWalletToFile(testKeypair, TEST_WALLET_PATH, 'devnet')
    
    const walletData = JSON.parse(fs.readFileSync(TEST_WALLET_PATH, 'utf-8'))
    
    expect(walletData).toHaveProperty('privateKey')
    expect(walletData).toHaveProperty('address')
    expect(walletData).toHaveProperty('network')
    
    expect(Array.isArray(walletData.privateKey)).toBe(true)
    expect(walletData.privateKey.length).toBe(64)
    expect(walletData.address).toBe(testKeypair.publicKey.toString())
    expect(walletData.network).toBe('devnet')
  })

  test('FuegoWallet initializes without passwords', async () => {
    const wallet = new FuegoWallet({
      configPath: path.join(TEST_DIR, 'config.json'),
      walletPath: TEST_WALLET_PATH,
      logsPath: path.join(TEST_DIR, 'logs')
    })

    await wallet.initialize(testKeypair, 'devnet')
    
    expect(wallet.getAddress()).toBe(testKeypair.publicKey.toString())
    expect(fs.existsSync(TEST_WALLET_PATH)).toBe(true)
  })

  test('FuegoWallet loads and signs instantly', async () => {
    const wallet = new FuegoWallet({
      configPath: path.join(TEST_DIR, 'config.json'),
      walletPath: TEST_WALLET_PATH,
      logsPath: path.join(TEST_DIR, 'logs')
    })

    await wallet.initialize(testKeypair)
    
    // Load wallet
    await wallet.load()
    
    // Sign data instantly - no password prompts!
    const testData = Buffer.from('test message')
    const signature = wallet.signData(testData)
    
    expect(signature).toBeInstanceOf(Buffer)
    expect(signature.length).toBeGreaterThan(0)
  })

  test('getKeypair works without explicit load call', async () => {
    const wallet = new FuegoWallet({
      configPath: path.join(TEST_DIR, 'config.json'),
      walletPath: TEST_WALLET_PATH,
      logsPath: path.join(TEST_DIR, 'logs')
    })

    await wallet.initialize(testKeypair)
    
    // Get keypair without calling load() - should auto-load
    const keypair = wallet.getKeypair()
    
    expect(keypair.publicKey.toString()).toBe(testKeypair.publicKey.toString())
    expect(keypair.secretKey).toEqual(testKeypair.secretKey)
  })
})