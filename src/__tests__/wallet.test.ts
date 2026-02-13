import { Keypair } from '@solana/web3.js'
import { testEncryption } from '../crypto'
import { FuegoWallet } from '../index'

describe('Fuego Wallet - Phase 1', () => {
  test('encryption should work', async () => {
    const result = await testEncryption()
    expect(result).toBe(true)
  })

  test('wallet should initialize and authenticate', async () => {
    const keypair = Keypair.generate()
    const password = 'test-password-123'
    
    const wallet = new FuegoWallet({
      configPath: '/tmp/fuego-test-config.json',
      keychainPath: '/tmp/fuego-test-keychain.json',
      saltPath: '/tmp/fuego-test-salt.json',
      logsPath: '/tmp/fuego-test-logs'
    })

    await wallet.initialize(keypair, password)
    expect(wallet.getAddress()).toBe(keypair.publicKey.toString())

    // Should fail with wrong password
    await expect(wallet.authenticate('wrong-password')).rejects.toThrow('Invalid password')

    // Should succeed with correct password
    await wallet.authenticate(password)
    expect(true).toBe(true)

    wallet.logout()
  })

  test('session should timeout', async () => {
    const keypair = Keypair.generate()
    const password = 'test-password'
    
    const wallet = new FuegoWallet({
      configPath: '/tmp/fuego-test-config-2.json',
      keychainPath: '/tmp/fuego-test-keychain-2.json',
      saltPath: '/tmp/fuego-test-salt-2.json',
      logsPath: '/tmp/fuego-test-logs-2',
      sessionTimeout: 100  // 100ms for testing
    })

    await wallet.initialize(keypair, password)
    await wallet.authenticate(password)

    // Wait for session to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Should fail because session expired
    expect(() => {
      wallet.signData(Buffer.from('test'))
    }).toThrow('Session expired')
  })
})
