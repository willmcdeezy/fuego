mod utils;

/// Compute budget instructions (solana_sdk 4.x no longer exposes compute_budget module).
mod compute_budget {
    use solana_sdk::instruction::Instruction;
    use solana_sdk::pubkey::Pubkey;
    use std::sync::OnceLock;

    fn program_id() -> &'static Pubkey {
        static ID: OnceLock<Pubkey> = OnceLock::new();
        ID.get_or_init(|| "ComputeBudget111111111111111111111111111111".parse().unwrap())
    }

    pub struct ComputeBudgetInstruction;

    impl ComputeBudgetInstruction {
        pub fn set_compute_unit_limit(units: u32) -> Instruction {
            let mut data = vec![2u8];
            data.extend_from_slice(&units.to_le_bytes());
            Instruction {
                program_id: *program_id(),
                data,
                accounts: vec![],
            }
        }
        pub fn set_compute_unit_price(micro_lamports: u64) -> Instruction {
            let mut data = vec![3u8];
            data.extend_from_slice(&micro_lamports.to_le_bytes());
            Instruction {
                program_id: *program_id(),
                data,
                accounts: vec![],
            }
        }
    }
}

/// System program instructions (solana_sdk 4.x no longer exposes system_instruction module).
mod system_instruction {
    use solana_sdk::instruction::{AccountMeta, Instruction};
    use solana_sdk::pubkey::Pubkey;
    use std::sync::OnceLock;

    fn system_program_id() -> &'static Pubkey {
        static ID: OnceLock<Pubkey> = OnceLock::new();
        ID.get_or_init(|| "11111111111111111111111111111111".parse().unwrap())
    }

    /// Transfer lamports from one account to another (system program).
    pub fn transfer(from_pubkey: &Pubkey, to_pubkey: &Pubkey, lamports: u64) -> Instruction {
        let mut data = vec![2u8]; // SystemInstruction::Transfer discriminant
        data.extend_from_slice(&lamports.to_le_bytes());
        Instruction {
            program_id: *system_program_id(),
            accounts: vec![
                AccountMeta::new(*from_pubkey, true),
                AccountMeta::new(*to_pubkey, false),
            ],
            data,
        }
    }
}

use crate::compute_budget::ComputeBudgetInstruction;
use axum::{
    extract::State,
    http::Method,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::CommitmentConfig;
use solana_sdk::message::Message;
use solana_sdk::transaction::Transaction;
use crate::system_instruction::transfer;
use solana_transaction::versioned::VersionedTransaction as ClientVersionedTransaction;
use solana_transaction::Transaction as ClientTransaction;
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction as token_instruction;
use spl_memo;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use utils::string_to_pub_key;
use base64::engine::general_purpose;
use base64::Engine;
use std::fs;

// Token mint addresses
const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT: &str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEqw";

#[derive(Serialize, Deserialize)]
struct RpcNetwork {
    network: String,
}

#[derive(Serialize, Deserialize)]
struct GetBalanceRequest {
    network: String,
    address: String,
}

#[derive(Serialize, Deserialize)]
struct GetTokenBalanceRequest {
    network: String,
    address: String,
    #[serde(default)]
    commitment: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct TransferUsdcRequest {
    network: String,
    from_address: String,
    to_address: String,
    amount: String, // String to preserve decimals
    yid: String, // Yield ID for tracking
    #[serde(default)]
    notes: Option<String>, // Optional memo notes (max 16 chars)
    #[serde(default)]
    fee_amount: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct TransferSolRequest {
    network: String,
    from_address: String,
    to_address: String,
    amount: String, // String to preserve decimals (in SOL)
    yid: String, // Yield ID for tracking
    #[serde(default)]
    notes: Option<String>, // Optional memo notes (max 16 chars)
    #[serde(default)]
    fee_amount: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct TransferUsdtRequest {
    network: String,
    from_address: String,
    to_address: String,
    amount: String, // String to preserve decimals
    yid: String, // Yield ID for tracking
    #[serde(default)]
    notes: Option<String>, // Optional memo notes (max 16 chars)
    #[serde(default)]
    fee_amount: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SubmitTransactionRequest {
    network: String,
    transaction: String, // Base64-encoded signed transaction
    #[serde(default)]
    commitment: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct WalletConfig {
    #[serde(rename = "walletAddress")]
    wallet_address: String,
    network: String,
    #[serde(rename = "createdAt")]
    created_at: i64,
    version: String,
}

#[derive(Serialize, Deserialize)]
struct WalletStore {
    #[serde(rename = "privateKey")]
    private_key: Vec<u8>,
    address: String,
    network: String,
}

#[derive(Serialize, Deserialize)]
struct X402PurchRequest {
    /// Purch.xyz order endpoint (e.g. https://x402.purch.xyz/orders/solana) or product URL; server POSTs here with order body
    url: String,
    /// Product URL (e.g. Amazon link) - sent as productUrl in the order body
    product_url: String,
    email: String,
    name: String,
    #[serde(default)]
    address_line1: String,
    #[serde(default)]
    address_line2: Option<String>,
    city: String,
    state: String,
    #[serde(rename = "postal_code")]
    postal_code: String,
    #[serde(default)]
    country: String,
    /// Solana network (default mainnet-beta). Optional; used for RPC and payment.
    #[serde(default)]
    network: String,
    /// Payer wallet address. If omitted, server uses ~/.fuego wallet to sign the x402 payment.
    #[serde(default)]
    payer_address: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct GetAccountSignatures {
    address: String,
    network: String,
    #[serde(default)]
    limit: Option<usize>,
}

// State to hold RPC clients (could be expanded for caching)
#[derive(Clone)]
struct AppState {
    default_network: String,
}

fn get_commitment_config(commitment: &Option<String>) -> CommitmentConfig {
    match commitment.as_ref().map(|s| s.as_str()) {
        Some("processed") => CommitmentConfig::processed(),
        Some("finalized") => CommitmentConfig::finalized(),
        _ => CommitmentConfig::confirmed(),
    }
}

fn build_memo(token_type: &str, from: &str, to: &str, amount: u64, yid: &str, notes: Option<&str>) -> Result<String, String> {
    // Validate notes if provided
    if let Some(n) = notes {
        if n.len() > 16 {
            return Err(format!("Notes must be 16 characters or less, got {}", n.len()));
        }
    }
    
    let notes_part = notes.unwrap_or("");
    Ok(format!(
        "fuego|{}|f:{}|t:{}|a:{}|yid:{}|n:{}",
        token_type, from, to, amount, yid, notes_part
    ))
}

async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "service": "fuego-server",
        "version": "0.1.0"
    }))
}

async fn get_latest_hash(
    State(_state): State<AppState>,
    Json(payload): Json<RpcNetwork>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    match rpc.get_latest_blockhash() {
        Ok(blockhash) => Json(json!({
            "success": true,
            "data": {
                "blockhash": blockhash.to_string(),
                "network": payload.network
            }
        })).into_response(),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to get latest blockhash: {}", e)
        })).into_response(),
    }
}

async fn get_sol_balance(
    State(_state): State<AppState>,
    Json(payload): Json<GetBalanceRequest>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());

    let pubkey = match string_to_pub_key(&payload.address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid wallet address"
            }))
            .into_response();
        }
    };

    match rpc.get_balance(&pubkey) {
        Ok(lamports) => {
            let sol = lamports as f64 / 1_000_000_000.0;
            Json(json!({
                "success": true,
                "data": {
                    "address": payload.address,
                    "lamports": lamports,
                    "sol": sol,
                    "network": payload.network
                }
            }))
            .into_response()
        }
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to get balance: {}", e)
        }))
        .into_response(),
    }
}

async fn get_default_network(State(state): State<AppState>) -> impl IntoResponse {
    Json(json!({
        "network": state.default_network
    }))
}

async fn get_usdc_balance(
    State(_state): State<AppState>,
    Json(payload): Json<GetTokenBalanceRequest>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let commitment = get_commitment_config(&payload.commitment);
    let rpc = RpcClient::new_with_commitment(rpc_url, commitment);

    let pubkey = match string_to_pub_key(&payload.address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid wallet address"
            }))
            .into_response();
        }
    };

    let usdc_mint = match string_to_pub_key(USDC_MINT) {
        Ok(mint) => mint,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to parse USDC mint"
            }))
            .into_response();
        }
    };

    let associated_token_account = get_associated_token_address(&utils::to_spl_pubkey(&pubkey), &utils::to_spl_pubkey(&usdc_mint));

    match rpc.get_token_account_balance(&utils::from_spl_pubkey(&associated_token_account)) {
        Ok(balance) => Json(json!({
            "success": true,
            "data": {
                "address": payload.address,
                "amount": balance.amount,
                "decimals": balance.decimals,
                "ui_amount": balance.ui_amount_string,
                "network": payload.network,
                "token": "USDC"
            }
        }))
        .into_response(),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to get USDC balance: {}", e)
        }))
        .into_response(),
    }
}

async fn get_usdt_balance(
    State(_state): State<AppState>,
    Json(payload): Json<GetTokenBalanceRequest>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let commitment = get_commitment_config(&payload.commitment);
    let rpc = RpcClient::new_with_commitment(rpc_url, commitment);

    let pubkey = match string_to_pub_key(&payload.address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid wallet address"
            }))
            .into_response();
        }
    };

    let usdt_mint = match string_to_pub_key(USDT_MINT) {
        Ok(mint) => mint,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to parse USDT mint"
            }))
            .into_response();
        }
    };

    let associated_token_account = get_associated_token_address(&utils::to_spl_pubkey(&pubkey), &utils::to_spl_pubkey(&usdt_mint));

    match rpc.get_token_account_balance(&utils::from_spl_pubkey(&associated_token_account)) {
        Ok(balance) => Json(json!({
            "success": true,
            "data": {
                "address": payload.address,
                "amount": balance.amount,
                "decimals": balance.decimals,
                "ui_amount": balance.ui_amount_string,
                "network": payload.network,
                "token": "USDT"
            }
        }))
        .into_response(),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to get USDT balance: {}", e)
        }))
        .into_response(),
    }
}

async fn build_transfer_usdc(
    State(_state): State<AppState>,
    Json(payload): Json<TransferUsdcRequest>,
) -> Response {
    // Fetch fresh blockhash
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    let blockhash = match rpc.get_latest_blockhash() {
        Ok(bh) => bh,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to fetch blockhash: {}", e)
            }))
            .into_response();
        }
    };

    // Parse addresses
    let from_pubkey = match string_to_pub_key(&payload.from_address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid from_address"
            }))
            .into_response();
        }
    };

    let to_pubkey = match string_to_pub_key(&payload.to_address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid to_address"
            }))
            .into_response();
        }
    };

    let usdc_mint = match string_to_pub_key(USDC_MINT) {
        Ok(mint) => mint,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid USDC mint"
            }))
            .into_response();
        }
    };

    // Derive token accounts
    let source_token_account = get_associated_token_address(&utils::to_spl_pubkey(&from_pubkey), &utils::to_spl_pubkey(&usdc_mint));
    let destination_token_account = get_associated_token_address(&utils::to_spl_pubkey(&to_pubkey), &utils::to_spl_pubkey(&usdc_mint));

    // Parse amount (6 decimals for USDC)
    let amount: u64 = match payload.amount.parse::<f64>() {
        Ok(val) => (val * 1_000_000.0) as u64,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid amount"
            }))
            .into_response();
        }
    };

    // Build memo with new format: fuego|USDC|f:{from}|t:{to}|a:{amount}|yid:{yid}|n:{notes}
    let memo_text = match build_memo("USDC", &payload.from_address, &payload.to_address, amount, &payload.yid, payload.notes.as_deref()) {
        Ok(memo) => memo,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": e
            }))
            .into_response();
        }
    };

    // Build instructions
    let from_spl = utils::to_spl_pubkey(&from_pubkey);
    let transfer_instruction = match token_instruction::transfer(
        &spl_token::ID,
        &source_token_account,
        &destination_token_account,
        &from_spl,
        &[&from_spl],
        amount,
    ) {
        Ok(instr) => instr,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to create transfer instruction"
            }))
            .into_response();
        }
    };

    let memo_instruction = spl_memo::build_memo(memo_text.as_bytes(), &[]);

    // Compute budget instructions
    let compute_limit = ComputeBudgetInstruction::set_compute_unit_limit(100_000);
    let unit_price = ComputeBudgetInstruction::set_compute_unit_price(
        payload.fee_amount
            .as_ref()
            .and_then(|f| f.parse::<u64>().ok())
            .unwrap_or(0)
    );

    // Create transaction message with fresh blockhash
    let transfer_ix = utils::instruction_from_spl(&transfer_instruction);
    let memo_ix = utils::instruction_from_spl(&memo_instruction);
    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_ix, memo_ix],
        Some(&from_pubkey),
        &blockhash,
    );

    let transaction = Transaction::new_unsigned(message);

    // Serialize transaction
    let serialized_tx = match bincode::serialize(&transaction) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to serialize transaction"
            }))
            .into_response();
        }
    };

    Json(json!({
        "success": true,
        "data": {
            "transaction": serde_json::Value::String(
                general_purpose::STANDARD.encode(&serialized_tx)
            ),
            "blockhash": blockhash.to_string(),
            "from": payload.from_address,
            "to": payload.to_address,
            "amount": payload.amount,
            "yid": payload.yid,
            "memo": memo_text,
            "network": payload.network
        }
    }))
    .into_response()
}

async fn build_transfer_sol(
    State(_state): State<AppState>,
    Json(payload): Json<TransferSolRequest>,
) -> Response {
    // Fetch fresh blockhash
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    let blockhash = match rpc.get_latest_blockhash() {
        Ok(bh) => bh,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to fetch blockhash: {}", e)
            }))
            .into_response();
        }
    };

    // Parse addresses
    let from_pubkey = match string_to_pub_key(&payload.from_address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid from_address"
            }))
            .into_response();
        }
    };

    let to_pubkey = match string_to_pub_key(&payload.to_address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid to_address"
            }))
            .into_response();
        }
    };

    // Parse amount (in SOL, convert to lamports)
    let amount_lamports: u64 = match payload.amount.parse::<f64>() {
        Ok(val) => (val * 1_000_000_000.0) as u64,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid amount"
            }))
            .into_response();
        }
    };

    // Build memo with new format: fuego|SOL|f:{from}|t:{to}|a:{amount}|yid:{yid}|n:{notes}
    let memo_text = match build_memo("SOL", &payload.from_address, &payload.to_address, amount_lamports, &payload.yid, payload.notes.as_deref()) {
        Ok(memo) => memo,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": e
            }))
            .into_response();
        }
    };

    // Build instructions using solana_system_interface
    let transfer_instruction = transfer(
        &from_pubkey,
        &to_pubkey,
        amount_lamports
    );
    let memo_instruction = spl_memo::build_memo(memo_text.as_bytes(), &[]);

    // Compute budget instructions
    let compute_limit = ComputeBudgetInstruction::set_compute_unit_limit(100_000);
    let unit_price = ComputeBudgetInstruction::set_compute_unit_price(
        payload.fee_amount
            .as_ref()
            .and_then(|f| f.parse::<u64>().ok())
            .unwrap_or(0)
    );

    // Create transaction message with fresh blockhash
    let memo_ix = utils::instruction_from_spl(&memo_instruction);
    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_instruction, memo_ix],
        Some(&from_pubkey),
        &blockhash,
    );

    let transaction = Transaction::new_unsigned(message);

    // Serialize transaction
    let serialized_tx = match bincode::serialize(&transaction) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to serialize transaction"
            }))
            .into_response();
        }
    };

    Json(json!({
        "success": true,
        "data": {
            "transaction": serde_json::Value::String(
                general_purpose::STANDARD.encode(&serialized_tx)
            ),
            "blockhash": blockhash.to_string(),
            "from": payload.from_address,
            "to": payload.to_address,
            "amount": payload.amount,
            "yid": payload.yid,
            "memo": memo_text,
            "network": payload.network
        }
    }))
    .into_response()
}

async fn build_transfer_usdt(
    State(_state): State<AppState>,
    Json(payload): Json<TransferUsdtRequest>,
) -> Response {
    // Fetch fresh blockhash
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    let blockhash = match rpc.get_latest_blockhash() {
        Ok(bh) => bh,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to fetch blockhash: {}", e)
            }))
            .into_response();
        }
    };

    // Parse addresses
    let from_pubkey = match string_to_pub_key(&payload.from_address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid from_address"
            }))
            .into_response();
        }
    };

    let to_pubkey = match string_to_pub_key(&payload.to_address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid to_address"
            }))
            .into_response();
        }
    };

    let usdt_mint = match string_to_pub_key(USDT_MINT) {
        Ok(mint) => mint,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid USDT mint"
            }))
            .into_response();
        }
    };

    // Get associated token accounts
    let from_ata = get_associated_token_address(&utils::to_spl_pubkey(&from_pubkey), &utils::to_spl_pubkey(&usdt_mint));
    let to_ata = get_associated_token_address(&utils::to_spl_pubkey(&to_pubkey), &utils::to_spl_pubkey(&usdt_mint));

    // Parse amount (USDT has 6 decimals)
    let amount_ui = match payload.amount.parse::<f64>() {
        Ok(a) => a,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid amount format"
            }))
            .into_response();
        }
    };
    let amount = (amount_ui * 1_000_000.0) as u64;

    // Build instructions
    let compute_limit = ComputeBudgetInstruction::set_compute_unit_limit(300_000);
    let unit_price = ComputeBudgetInstruction::set_compute_unit_price(100);
    let from_spl = utils::to_spl_pubkey(&from_pubkey);
    let transfer_instruction = token_instruction::transfer(
        &spl_token::id(),
        &from_ata,
        &to_ata,
        &from_spl,
        &[&from_spl],
        amount,
    ).unwrap();

    let memo_text = build_memo("USDT", &payload.from_address, &payload.to_address, amount, &payload.yid, payload.notes.as_deref()).unwrap_or_default();
    let memo_instruction = spl_memo::build_memo(memo_text.as_bytes(), &[&from_spl]);

    let transfer_ix = utils::instruction_from_spl(&transfer_instruction);
    let memo_ix = utils::instruction_from_spl(&memo_instruction);
    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_ix, memo_ix],
        Some(&from_pubkey),
        &blockhash,
    );

    let transaction = Transaction::new_unsigned(message);

    // Serialize transaction
    let serialized_tx = match bincode::serialize(&transaction) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to serialize transaction"
            }))
            .into_response();
        }
    };

    Json(json!({
        "success": true,
        "data": {
            "transaction": serde_json::Value::String(
                general_purpose::STANDARD.encode(&serialized_tx)
            ),
            "blockhash": blockhash.to_string(),
            "from": payload.from_address,
            "to": payload.to_address,
            "amount": payload.amount,
            "yid": payload.yid,
            "memo": memo_text,
            "network": payload.network
        }
    }))
    .into_response()
}

// x402 Purch endpoint: call Purch x402 URL with order payload; x402-rs handles 402 → pay → retry; return final response.
async fn x402_purch(
    State(_state): State<AppState>,
    Json(payload): Json<X402PurchRequest>,
) -> Response {
    use reqwest::Client;
    use std::sync::Arc;
    use x402_chain_solana::v1_solana_exact::client::V1SolanaExactClient;
    use x402_chain_solana::v2_solana_exact::client::V2SolanaExactClient;
    use x402_reqwest::{ReqwestWithPayments, ReqwestWithPaymentsBuild, X402Client};

    let network = if payload.network.is_empty() {
        "mainnet-beta".to_string()
    } else {
        payload.network.clone()
    };

    // Load keypair from ~/.fuego/wallet.json (required for signing x402 payment)
    let home_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"));
    let wallet_path = home_dir.join(".fuego").join("wallet.json");
    let wallet_content = match fs::read_to_string(&wallet_path) {
        Ok(c) => c,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "No wallet found at ~/.fuego/wallet.json. Run 'fuego create' first."
            }))
            .into_response();
        }
    };
    let wallet: WalletStore = match serde_json::from_str(&wallet_content) {
        Ok(w) => w,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Invalid wallet.json: {}", e)
            }))
            .into_response();
        }
    };

    if wallet.private_key.len() < 32 {
        return Json(json!({
            "success": false,
            "error": "Wallet private key must be at least 32 bytes"
        }))
        .into_response();
    }
    let mut secret_arr = [0u8; 32];
    secret_arr.copy_from_slice(&wallet.private_key[..32]);

    let keypair = solana_sdk::signer::keypair::Keypair::new_from_array(secret_arr);

    let rpc_url = format!("https://api.{}.solana.com", network);
    let rpc = solana_client::nonblocking::rpc_client::RpcClient::new(rpc_url);
    let rpc_arc = Arc::new(rpc);
    let keypair_arc = Arc::new(keypair);

    // Register both V1 and V2 Solana exact clients so we match whatever Purch.xyz returns (V1 or V2 402 format)
    let x402_client = X402Client::new()
        .register(V1SolanaExactClient::new(keypair_arc.clone(), rpc_arc.clone()))
        .register(V2SolanaExactClient::new(keypair_arc, rpc_arc));

    let http_client = match Client::builder().with_payments(x402_client).build() {
        Ok(c) => c,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to build HTTP client: {}", e)
            }))
            .into_response();
        }
    };

    let payer_address = payload.payer_address.as_deref().unwrap_or(wallet.address.as_str());
    let mut physical_address = serde_json::Map::new();
    physical_address.insert("name".to_string(), serde_json::Value::String(payload.name.clone()));
    physical_address.insert("line1".to_string(), serde_json::Value::String(payload.address_line1.clone()));
    physical_address.insert("city".to_string(), serde_json::Value::String(payload.city.clone()));
    physical_address.insert("state".to_string(), serde_json::Value::String(payload.state.clone()));
    physical_address.insert("postalCode".to_string(), serde_json::Value::String(payload.postal_code.clone()));
    physical_address.insert("country".to_string(), serde_json::Value::String(if payload.country.is_empty() { "US".to_string() } else { payload.country.clone() }));
    if let Some(ref line2) = payload.address_line2 {
        if !line2.is_empty() {
            physical_address.insert("line2".to_string(), serde_json::Value::String(line2.clone()));
        }
    }

    let order_body = json!({
        "email": payload.email,
        "payerAddress": payer_address,
        "productUrl": payload.product_url,
        "physicalAddress": physical_address
    });
    let body_bytes = match serde_json::to_vec(&order_body) {
        Ok(b) => b,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to serialize order body: {}", e)
            }))
            .into_response();
        }
    };

    let response = match http_client
        .post(&payload.url)
        .header("Content-Type", "application/json")
        .body(body_bytes)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Request failed: {}", e)
            }))
            .into_response();
        }
    };

    let status = response.status();
    let body: String = match response.text().await {
        Ok(b) => b,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to read response: {}", e)
            }))
            .into_response();
        }
    };

    let body_json: serde_json::Value = match serde_json::from_str(&body) {
        Ok(j) => j,
        Err(_) => serde_json::Value::String(body),
    };

    let success = status.is_success();
    Json(json!({
        "success": success,
        "status": status.as_u16(),
        "data": body_json,
        "x402_note": if success { "Payment accepted; order response above." } else { "Request completed; check status and data." }
    }))
    .into_response()
}

async fn submit_transaction(
    State(_state): State<AppState>,
    Json(payload): Json<SubmitTransactionRequest>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    // Decode base64 transaction
    let tx_bytes = match general_purpose::STANDARD.decode(&payload.transaction) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to decode transaction - invalid base64"
            }))
            .into_response();
        }
    };

    // Deserialize transaction (already signed by agent with correct blockhash)
    let transaction: ClientTransaction = match bincode::deserialize(&tx_bytes) {
        Ok(tx) => tx,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to deserialize transaction"
            }))
            .into_response();
        }
    };

    // Submit to RPC (transaction is already signed with correct blockhash by agent)
    match rpc.send_transaction(&transaction) {
        Ok(signature) => {
            let sig_string = signature.to_string();
            let explorer_link = format!(
                "https://explorer.solana.com/tx/{}?cluster={}",
                sig_string, payload.network
            );
            Json(json!({
                "success": true,
                "data": {
                    "signature": sig_string,
                    "explorer_link": explorer_link,
                    "network": payload.network,
                    "status": "submitted"
                }
            }))
            .into_response()
        },
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to submit transaction: {}", e)
        }))
        .into_response(),
    }
}

// VersionedTransaction endpoint specifically for Jupiter swaps and other v0 transactions
async fn submit_versioned_transaction(
    State(_state): State<AppState>,
    Json(payload): Json<SubmitTransactionRequest>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    // Decode base64 transaction
    let tx_bytes = match general_purpose::STANDARD.decode(&payload.transaction) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to decode transaction - invalid base64"
            }))
            .into_response();
        }
    };

    // Deserialize as VersionedTransaction (Jupiter format)
    let versioned_transaction: ClientVersionedTransaction = match bincode::deserialize(&tx_bytes) {
        Ok(tx) => tx,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to deserialize VersionedTransaction - ensure this is a v0 transaction format"
            }))
            .into_response();
        }
    };

    // Submit VersionedTransaction to RPC (already signed by agent)
    match rpc.send_transaction(&versioned_transaction) {
        Ok(signature) => {
            let sig_string = signature.to_string();
            let explorer_link = format!(
                "https://explorer.solana.com/tx/{}?cluster={}",
                sig_string, payload.network
            );
            Json(json!({
                "success": true,
                "data": {
                    "signature": sig_string,
                    "explorer_link": explorer_link,
                    "network": payload.network,
                    "status": "submitted",
                    "transaction_type": "VersionedTransaction"
                }
            }))
            .into_response()
        },
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to submit VersionedTransaction: {}", e)
        }))
        .into_response(),
    }
}

async fn get_all_transactions(
    Json(payload): Json<GetAccountSignatures>,
) -> Response {
    let rpc_url = format!("https://api.{}.solana.com", payload.network);
    let rpc = RpcClient::new(rpc_url);

    let user_pubkey = match string_to_pub_key(&payload.address) {
        Ok(pubkey) => pubkey,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid wallet address"
            }))
            .into_response()
        }
    };

    let config = solana_client::rpc_client::GetConfirmedSignaturesForAddress2Config {
        before: None,
        until: None,
        limit: None, // Default to 20 transactions for "all"
        commitment: Some(CommitmentConfig::confirmed()),
    };

    let signatures = match rpc.get_signatures_for_address_with_config(&user_pubkey, config) {
        Ok(signatures) => signatures,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Could not retrieve signatures for account"
            }))
            .into_response()
        }
    };

    Json(json!({
        "success": true,
        "data": signatures,
        "network": payload.network,
        "status": "Successful all transactions request"
    }))
    .into_response()
}

// TODO: PYUSD balance endpoint using Token-2022
// Requires getTokenAccountsByOwner implementation
// Issue: Standard ATA derivation doesn't work for Token-2022
// Solution: Enumerate all token accounts owned by wallet and find by mint


async fn get_wallet_address() -> Response {
    // Try to load wallet address from ~/.fuego/wallet-config.json
    let home_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"));
    
    // Try wallet-config.json first (has walletAddress field)
    let config_path = home_dir.join(".fuego").join("wallet-config.json");
    if config_path.exists() {
        if let Ok(config_content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<WalletConfig>(&config_content) {
                return Json(json!({
                    "success": true,
                    "data": {
                        "address": config.wallet_address,
                        "network": config.network,
                        "source": "wallet-config"
                    }
                })).into_response();
            }
        }
    }
    
    // Fallback to legacy wallet.json (has address field)
    let wallet_path = home_dir.join(".fuego").join("wallet.json");
    if wallet_path.exists() {
        if let Ok(wallet_content) = fs::read_to_string(&wallet_path) {
            if let Ok(wallet) = serde_json::from_str::<WalletStore>(&wallet_content) {
                return Json(json!({
                    "success": true,
                    "data": {
                        "address": wallet.address,
                        "network": wallet.network,
                        "source": "wallet"
                    }
                })).into_response();
            }
        }
    }
    
    // No wallet found
    Json(json!({
        "success": false,
        "error": "No wallet found. Initialize with: fuego create"
    })).into_response()
}

#[tokio::main]
async fn main() {
    let state = AppState {
        default_network: "mainnet-beta".to_string(),
    };

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any)
        .allow_origin(Any);

    let app = Router::new()
        .route("/", get(|| async { "Fuego Server 🔥" }))
        .route("/health", get(health_check))
        .route("/network", get(get_default_network))
        .route("/wallet-address", get(get_wallet_address))
        // READ endpoints
        .route("/latest-hash", post(get_latest_hash))
        .route("/sol-balance", post(get_sol_balance))
        .route("/usdc-balance", post(get_usdc_balance))
        .route("/usdt-balance", post(get_usdt_balance))
        .route("/all-transactions", post(get_all_transactions))
        // TRANSFER endpoints
        .route("/build-transfer-usdc", post(build_transfer_usdc))
        .route("/build-transfer-sol", post(build_transfer_sol))
        .route("/build-transfer-usdt", post(build_transfer_usdt))
        .route("/x402-purch", post(x402_purch))
        .route("/submit-transaction", post(submit_transaction))
        .route("/submit-versioned-transaction", post(submit_versioned_transaction))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("🔥 Fuego server running on http://{}", addr);
    println!("Endpoints:");
    println!("  READ:");
    println!("    GET  /health - Health check");
    println!("    GET  /network - Get default network");
    println!("    GET  /wallet-address - Get local wallet address");
    println!("    POST /latest-hash - Get latest blockhash");
    println!("    POST /sol-balance - Get SOL balance");
    println!("    POST /usdc-balance - Get USDC balance");
    println!("    POST /usdt-balance - Get USDT balance");
    println!("  BUILD TRANSFERS:");
    println!("    POST /build-transfer-sol - Build unsigned SOL transfer (agent signs in script)");
    println!("    POST /build-transfer-usdc - Build unsigned USDC transfer (agent signs in script)");
    println!("    POST /build-transfer-usdt - Build unsigned USDT transfer (agent signs in script)");
    println!("  X402:");
    println!("    POST /x402-purch - x402 Purch: WIP -- call Purch URL with order payload (Solana); returns final response");
    println!("  SUBMIT:");
    println!("    POST /submit-transaction - Broadcast signed transaction (legacy format - fuego transfers)");
    println!("    POST /submit-versioned-transaction - Broadcast VersionedTransaction (Jupiter/v0 format)");
    println!("  HISTORY:");
    println!("    POST /all-transactions - Get all transactions (unfiltered)");
    println!("  TODO:");
    println!("    POST /pyusd-balance - Get PYUSD (Token-2022) balance");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}