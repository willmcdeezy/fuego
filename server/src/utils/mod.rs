use solana_sdk::{signature::{Signature, ParseSignatureError}, pubkey::{Pubkey, ParsePubkeyError}};
use std::str::FromStr;

/// Pubkey type used by spl_associated_token_account and solana_client RpcClient.
pub type SplPubkey = spl_associated_token_account::solana_program::pubkey::Pubkey;
/// Instruction type produced by spl_token, spl_memo (solana_instruction 2.x).
pub type SplInstruction = spl_associated_token_account::solana_program::instruction::Instruction;

pub fn string_to_pub_key(account: &str) -> Result<Pubkey, ParsePubkeyError> {
    Pubkey::from_str(account)
}

/// Convert SDK pubkey (Address) to SPL/solana_program Pubkey for get_associated_token_address etc.
pub fn to_spl_pubkey(p: &Pubkey) -> SplPubkey {
    SplPubkey::new_from_array(p.to_bytes())
}

/// Convert SPL Pubkey back to SDK pubkey for RpcClient methods like get_token_account_balance.
pub fn from_spl_pubkey(p: &SplPubkey) -> Pubkey {
    Pubkey::new_from_array(p.to_bytes())
}

/// Convert SPL Instruction (spl_token, spl_memo) to SDK Instruction for Message::new_with_blockhash.
pub fn instruction_from_spl(spl_instr: &SplInstruction) -> solana_sdk::instruction::Instruction {
    solana_sdk::instruction::Instruction {
        program_id: from_spl_pubkey(&spl_instr.program_id),
        accounts: spl_instr
            .accounts
            .iter()
            .map(|m| solana_sdk::instruction::AccountMeta {
                pubkey: from_spl_pubkey(&m.pubkey),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data: spl_instr.data.clone(),
    }
}

#[allow(dead_code)]
pub fn string_to_signature(transaction: &str) -> Result<Signature, ParseSignatureError> {
    Signature::from_str(transaction)
}