#!/usr/bin/env node
/**
 * Fuego Init - Simple wallet creation (NO PASSWORDS!)
 */
import fs from 'fs';
import path from 'path';
import { Keypair } from '@solana/web3.js';
import { FuegoWallet } from '../index.js';
async function main() {
    console.log('🔥 Fuego Wallet Init - Agent-Ready Edition\n');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const fuegoDir = path.join(homeDir, '.fuego');
    const walletPath = path.join(fuegoDir, 'wallet.json');
    // Check if wallet already exists
    if (fs.existsSync(walletPath)) {
        console.log('❌ Wallet already exists at ~/.fuego/wallet.json');
        console.log('   If you want to replace it, run: rm -rf ~/.fuego');
        process.exit(1);
    }
    // Generate keypair
    console.log('🔑 Generating new Solana keypair...');
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toString();
    console.log(`✅ Address: ${address}\n`);
    // Initialize wallet
    const wallet = new FuegoWallet();
    await wallet.initialize(keypair);
    // Save backup in standard Solana CLI format
    const backupDir = path.join(homeDir, '.config', 'solana');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }
    const backupPath = path.join(backupDir, 'fuego-backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(Array.from(keypair.secretKey)));
    fs.chmodSync(backupPath, 0o600);
    console.log(`💾 Backup saved: ${backupPath}`);
    console.log('\n✅ Fuego wallet ready for agents!');
    console.log(`   Address: ${address}`);
    console.log(`   Wallet:  ~/.fuego/wallet.json`);
    console.log(`   Backup:  ${backupPath}`);
    console.log('\n🚀 Next steps:');
    console.log('   1. Start fuego server: cd server && ./target/release/fuego-server');
    console.log('   2. Your agents can now sign transactions instantly!');
    console.log('\n💡 Zero friction! No passwords, no prompts, just works. 🔮');
}
main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
//# sourceMappingURL=init.js.map