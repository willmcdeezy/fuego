#!/usr/bin/env ts-node
import readline from 'readline'
import { Keypair } from '@solana/web3.js'
import { FuegoWallet } from '../index'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer))
  })
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      console.clear() // Hide password from terminal
      resolve(answer)
    })
  })
}

async function main() {
  console.log('🔥 Fuego Wallet Initializer\n')
  
  try {
    // Check if already initialized
    const wallet = new FuegoWallet()
    const existingAddress = wallet.getAddress()
    if (existingAddress !== 'unknown') {
      console.log(`❌ Wallet already initialized: ${existingAddress}`)
      console.log('To reset, delete ~/.fuego and run again.')
      process.exit(1)
    }

    // Get keypair path
    const keypairPath = await prompt(
      '📁 Enter path to Solana keypair file (from solana-keygen): '
    )

    // Load keypair
    let keypair: Keypair
    try {
      const keypairData = require(keypairPath)
      keypair = Keypair.fromSecretKey(new Uint8Array(keypairData))
    } catch (error) {
      console.error('❌ Failed to load keypair:', error)
      process.exit(1)
    }

    console.log(`✅ Loaded keypair: ${keypair.publicKey.toString()}\n`)

    // Get password
    const password = await promptPassword(
      '🔐 Create encryption password (will not echo): '
    )
    
    const confirmPassword = await promptPassword(
      '🔐 Confirm password (will not echo): '
    )

    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match')
      process.exit(1)
    }

    // Initialize
    const fw = new FuegoWallet()
    await fw.initialize(keypair, password)

    console.log('\n✨ Setup complete!')
    console.log(`   Address: ${keypair.publicKey.toString()}`)
    console.log(`   Config:  ~/.fuego/config.json`)
    console.log(`   Keys:    ~/.fuego/keychain/id.json (encrypted)`)
    console.log('\n🚀 Next steps:')
    console.log('   1. const wallet = new FuegoWallet()')
    console.log('   2. await wallet.authenticate(password)')
    console.log('   3. wallet.signData(data)')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()
