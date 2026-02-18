import sodium from 'libsodium.js'
import argon2 from 'argon2'
import crypto from 'crypto'
import { EncryptedKeypair } from './types'

/**
 * Derive encryption key from password using Argon2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  // Use raw: true for deterministic key derivation
  // This ensures the same password + salt always produces the same key
  return argon2.hash(password, {
    salt,
    raw: true,
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32
  })
}

/**
 * Generate random salt for Argon2
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(16)
}

/**
 * Encrypt data with AES-256-GCM
 */
export function encryptData(data: Buffer, key: Buffer): EncryptedKeypair {
  const iv = crypto.randomBytes(12)  // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ])
  
  const tag = cipher.getAuthTag()
  
  return {
    nonce: Buffer.concat([iv, tag]).toString('base64'),
    ciphertext: encrypted.toString('base64'),
    algorithm: 'AES-256-GCM'
  }
}

/**
 * Decrypt data with AES-256-GCM
 */
export function decryptData(encrypted: EncryptedKeypair, key: Buffer): Buffer {
  const nonceFull = Buffer.from(encrypted.nonce, 'base64')
  const iv = nonceFull.slice(0, 12)  // First 12 bytes are IV
  const tag = nonceFull.slice(12)    // Last 16 bytes are auth tag
  
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64')
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])
}

/**
 * Validate encryption is working
 */
export async function testEncryption(): Promise<boolean> {
  try {
    const testData = Buffer.from('test data for encryption')
    const testPassword = 'test-password-123'
    const salt = generateSalt()
    
    const key = await deriveKeyFromPassword(testPassword, salt)
    const encrypted = encryptData(testData, key)
    const decrypted = decryptData(encrypted, key)
    
    return testData.equals(decrypted)
  } catch (error) {
    console.error('Encryption test failed:', error)
    return false
  }
}
