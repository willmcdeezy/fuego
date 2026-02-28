#!/usr/bin/env node
import nacl from 'tweetnacl';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const WALLET_PATH = join(homedir(), '.fuego', 'wallet.json');

// Get a fresh transaction
const tx = 'AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAIA...'; // truncated

// Simulate signing
const wallet = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
const keypairBytes = new Uint8Array(wallet.privateKey);
const privateKeyBytes = keypairBytes.slice(0, 32);
const keypair = nacl.sign.keyPair.fromSeed(privateKeyBytes);

// Original transaction
const txBytes = Buffer.from(tx, 'base64');
console.log('Original tx bytes:', txBytes.length);
console.log('Num sigs:', txBytes[0]);

// Extract message (after sig placeholder)
const messageBytes = new Uint8Array(txBytes.slice(65));
console.log('Message bytes:', messageBytes.length);
console.log('Message[0] (version):', messageBytes[0], '0x' + messageBytes[0].toString(16));

// Sign
const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
console.log('Signature length:', signature.length);

// Reconstruct
const signedTx = new Uint8Array(1 + 64 + messageBytes.length);
signedTx[0] = 1;
signedTx.set(signature, 1);
signedTx.set(messageBytes, 65);

console.log('\\nReconstructed tx bytes:', signedTx.length);
console.log('Expected bytes:', txBytes.length);
console.log('Match:', signedTx.length === txBytes.length);

// Encode
const signedBase64 = Buffer.from(signedTx).toString('base64');
console.log('\\nSigned tx base64 length:', signedBase64.length);
