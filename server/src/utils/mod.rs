use solana_sdk::{signature::{Signature, ParseSignatureError}, pubkey::{Pubkey, ParsePubkeyError}};
use std::str::FromStr;

pub fn string_to_pub_key(account: &str) -> Result<Pubkey, ParsePubkeyError> {
    Pubkey::from_str(account)
}

pub fn string_to_signature(transaction: &str) -> Result<Signature, ParseSignatureError> {
    Signature::from_str(transaction)
}