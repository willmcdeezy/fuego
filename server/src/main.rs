mod utils;

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
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::message::Message;
use solana_sdk::transaction::Transaction;
use solana_sdk::signer::Signer;
use std::str::FromStr;
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction as token_instruction;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use spl_memo;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use utils::string_to_pub_key;
use base64::engine::general_purpose;
use base64::Engine;
use std::fs;
use std::path::Path;
use reqwest;

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
struct GetAccountSignatures {
    address: String,
    network: String,
    #[serde(default)]
    limit: Option<usize>,
}

// x402 Request/Response structs
#[derive(Serialize, Deserialize)]
struct X402Request {
    url: String,
    #[serde(default = "default_method")]
    method: String,
    #[serde(default)]
    headers: std::collections::HashMap<String, String>,
    #[serde(default)]
    body: Option<serde_json::Value>,
}

fn default_method() -> String {
    "GET".to_string()
}

#[derive(Serialize, Deserialize)]
struct X402PaymentRequirement {
    asset: String,
    #[serde(rename = "payTo")]
    pay_to: String,
    #[serde(rename = "maxAmountRequired")]
    max_amount_required: String,
    network: String,
    scheme: String,
    extra: X402Extra,
}

#[derive(Serialize, Deserialize)]
struct X402Extra {
    #[serde(rename = "feePayer")]
    fee_payer: String,
    decimals: u8,
    #[serde(rename = "recentBlockhash")]
    recent_blockhash: String,
    #[serde(default)]
    features: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct X402Response {
    #[serde(rename = "x402Version")]
    x402_version: u8,
    accepts: Vec<X402PaymentRequirement>,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct BalanceResponse {
    lamports: u64,
    sol: f64,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct TokenBalanceResponse {
    amount: String,
    decimals: u8,
    ui_amount: String,
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

async fn get_balance(
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

    let associated_token_account = get_associated_token_address(&pubkey, &usdc_mint);

    match rpc.get_token_account_balance(&associated_token_account) {
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

    let associated_token_account = get_associated_token_address(&pubkey, &usdt_mint);

    match rpc.get_token_account_balance(&associated_token_account) {
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
    let source_token_account = get_associated_token_address(&from_pubkey, &usdc_mint);
    let destination_token_account = get_associated_token_address(&to_pubkey, &usdc_mint);

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
    let transfer_instruction = match token_instruction::transfer(
        &spl_token::ID,
        &source_token_account,
        &destination_token_account,
        &from_pubkey,
        &[&from_pubkey],
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
    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_instruction, memo_instruction],
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

    // Build instructions
    use solana_sdk::system_instruction;
    
    let transfer_instruction = system_instruction::transfer(&from_pubkey, &to_pubkey, amount_lamports);
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
    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_instruction, memo_instruction],
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
    let from_ata = get_associated_token_address(&from_pubkey, &usdt_mint);
    let to_ata = get_associated_token_address(&to_pubkey, &usdt_mint);

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
    let transfer_instruction = token_instruction::transfer(
        &spl_token::id(),
        &from_ata,
        &to_ata,
        &from_pubkey,
        &[],
        amount,
    ).unwrap();

    let memo_text = build_memo("USDT", &payload.from_address, &payload.to_address, amount, &payload.yid, payload.notes.as_deref()).unwrap_or_default();
    let memo_instruction = spl_memo::build_memo(memo_text.as_bytes(), &[&from_pubkey]);

    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_instruction, memo_instruction],
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
    let transaction: Transaction = match bincode::deserialize(&tx_bytes) {
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

async fn get_fuego_transactions(
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
        limit: payload.limit.or(Some(10)), // Default to 10 transactions
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

    // Filter transactions that contain "fuego" in memo (Fuego branding)
    // Memo format: fuego|{token}|f:{from}|t:{to}|a:{amount}|yid:{yid}|n:{notes}
    // Parsing happens on the frontend
    let fuego_transactions: Vec<_> = signatures
        .into_iter()
        .filter(|sig_info| {
            sig_info.memo.as_ref().map_or(false, |memo| {
                memo.to_lowercase().contains("fuego")
            })
        })
        .collect();

    Json(json!({
        "success": true,
        "data": fuego_transactions,
        "network": payload.network,
        "status": "Successful account signatures request"
    }))
    .into_response()
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
        limit: payload.limit.or(Some(20)), // Default to 20 transactions for "all"
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


async fn x402_request(
    State(_state): State<AppState>,
    Json(payload): Json<X402Request>,
) -> Response {
    // Generic x402 handler - SOLANA ONLY
    // Fuego's edge: focused Solana-first approach
    let client = reqwest::Client::new();
    
    // Step 1: Make initial request
    let mut request_builder = match payload.method.to_uppercase().as_str() {
        "GET" => client.get(&payload.url),
        "POST" => client.post(&payload.url),
        "PUT" => client.put(&payload.url),
        "DELETE" => client.delete(&payload.url),
        "PATCH" => client.patch(&payload.url),
        _ => {
            return Json(json!({
                "success": false,
                "error": "Unsupported HTTP method"
            })).into_response();
        }
    };

    // Add custom headers
    for (key, value) in &payload.headers {
        request_builder = request_builder.header(key, value);
    }

    // Add body if provided
    if let Some(body) = &payload.body {
        request_builder = request_builder.json(body);
    }

    // Make initial request
    let initial_response = match request_builder.send().await {
        Ok(resp) => resp,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to make initial request: {}", e)
            })).into_response();
        }
    };

    // Check if it's a 402 Payment Required response
    if initial_response.status() != reqwest::StatusCode::PAYMENT_REQUIRED {
        // Not a payment-required response, return as-is
        let status = initial_response.status().as_u16();
        let response_text = match initial_response.text().await {
            Ok(text) => text,
            Err(e) => {
                return Json(json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })).into_response();
            }
        };

        return Json(json!({
            "success": true,
            "status": status,
            "response": response_text,
            "payment_required": false
        })).into_response();
    }

    // Step 2: Parse x402 payment requirements
    let x402_response_text = match initial_response.text().await {
        Ok(text) => text,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to read 402 response: {}", e)
            })).into_response();
        }
    };

    let x402_response: X402Response = match serde_json::from_str(&x402_response_text) {
        Ok(response) => response,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to parse x402 response: {}", e),
                "response_text": x402_response_text
            })).into_response();
        }
    };

    // Step 3: Find Solana payment requirement (Solana-only focus)
    let solana_req = x402_response.accepts.iter()
        .find(|req| req.network == "solana" || req.network == "solana-mainnet-beta");

    let solana_req = match solana_req {
        Some(req) => req,
        None => {
            return Json(json!({
                "success": false,
                "error": "This API doesn't support Solana payments. Fuego only supports Solana x402 payments.",
                "supported_networks": x402_response.accepts.iter().map(|a| &a.network).collect::<Vec<_>>()
            })).into_response();
        }
    };

    // Step 4: Load local wallet to sign transaction
    let home_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"));
    let wallet_path = home_dir.join(".fuego").join("wallet.json");
    
    let wallet_content = match fs::read_to_string(&wallet_path) {
        Ok(content) => content,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "No wallet found. Initialize with: node src/cli/init.ts"
            })).into_response();
        }
    };

    let wallet_store: WalletStore = match serde_json::from_str(&wallet_content) {
        Ok(wallet) => wallet,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid wallet format"
            })).into_response();
        }
    };

    // Step 5: Build transaction using their requirements
    let from_pubkey = match string_to_pub_key(&wallet_store.address) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid wallet address"
            })).into_response();
        }
    };

    let to_pubkey = match string_to_pub_key(&solana_req.pay_to) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid recipient address"
            })).into_response();
        }
    };

    let fee_payer = match string_to_pub_key(&solana_req.extra.fee_payer) {
        Ok(pk) => pk,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid fee payer address in Solana payment requirement"
            })).into_response();
        }
    };

    let usdc_mint = match string_to_pub_key(USDC_MINT) {
        Ok(mint) => mint,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid USDC mint"
            })).into_response();
        }
    };

    let blockhash = match solana_sdk::hash::Hash::from_str(&solana_req.extra.recent_blockhash) {
        Ok(hash) => hash,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid blockhash format in Solana payment requirement"
            })).into_response();
        }
    };

    // Parse payment amount
    let amount: u64 = match solana_req.max_amount_required.parse() {
        Ok(amt) => amt,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Invalid payment amount"
            })).into_response();
        }
    };

    // Build transferChecked instruction (as required by x402 standard)
    let source_ata = get_associated_token_address(&from_pubkey, &usdc_mint);
    let dest_ata = get_associated_token_address(&to_pubkey, &usdc_mint);

    let transfer_instruction = token_instruction::transfer_checked(
        &spl_token::ID,
        &source_ata,
        &usdc_mint,
        &dest_ata,
        &from_pubkey,
        &[&from_pubkey],
        amount,
        solana_req.extra.decimals,
    ).unwrap();

    // Compute budget instructions (required by facilitators)
    let compute_limit = ComputeBudgetInstruction::set_compute_unit_limit(300_000);
    let unit_price = ComputeBudgetInstruction::set_compute_unit_price(5_000);

    // Build transaction with their fee payer and blockhash
    let message = Message::new_with_blockhash(
        &[compute_limit, unit_price, transfer_instruction],
        Some(&fee_payer), // Use their fee payer
        &blockhash,       // Use their blockhash
    );

    let mut transaction = Transaction::new_unsigned(message);

    // Step 6: Sign with local wallet (partial signature)
    let keypair = solana_sdk::signer::keypair::Keypair::from_bytes(&wallet_store.private_key).unwrap();
    match transaction.try_partial_sign(&[&keypair], blockhash) {
        Ok(_) => {},
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to sign transaction: {}", e)
            })).into_response();
        }
    }

    // Step 7: Create x402 payment payload
    let serialized_tx = match bincode::serialize(&transaction) {
        Ok(bytes) => bytes,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to serialize transaction: {}", e)
            })).into_response();
        }
    };

    let payment_payload = json!({
        "x402Version": 1,
        "scheme": "exact",
        "network": "solana-mainnet-beta",
        "payload": {
            "transaction": general_purpose::STANDARD.encode(&serialized_tx)
        }
    });

    let x_payment_header = general_purpose::STANDARD.encode(payment_payload.to_string());

    // Step 8: Retry request with X-Payment header
    let mut retry_builder = match payload.method.to_uppercase().as_str() {
        "GET" => client.get(&payload.url),
        "POST" => client.post(&payload.url),
        "PUT" => client.put(&payload.url),
        "DELETE" => client.delete(&payload.url),
        "PATCH" => client.patch(&payload.url),
        _ => {
            return Json(json!({
                "success": false,
                "error": "Unsupported HTTP method"
            })).into_response();
        }
    };

    // Add original headers plus X-Payment
    for (key, value) in &payload.headers {
        retry_builder = retry_builder.header(key, value);
    }
    retry_builder = retry_builder.header("X-Payment", x_payment_header);

    // Add body if provided
    if let Some(body) = &payload.body {
        retry_builder = retry_builder.json(body);
    }

    // Make retry request
    let final_response = match retry_builder.send().await {
        Ok(resp) => resp,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to make retry request: {}", e)
            })).into_response();
        }
    };

    let final_status = final_response.status().as_u16();
    let final_text = match final_response.text().await {
        Ok(text) => text,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Failed to read final response: {}", e)
            })).into_response();
        }
    };

    // Return final response
    Json(json!({
        "success": true,
        "status": final_status,
        "response": final_text,
        "payment_required": true,
        "payment_details": {
            "amount": amount,
            "amount_usdc": amount as f64 / 1_000_000.0,
            "recipient": solana_req.pay_to,
            "fee_payer": solana_req.extra.fee_payer
        }
    })).into_response()
}

async fn get_wallet_address() -> Response {
    // Try to load wallet address from ~/.fuego/config.json or ~/.fuego/wallet.json
    let home_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"));
    
    // Try config.json first (has walletAddress field)
    let config_path = home_dir.join(".fuego").join("config.json");
    if config_path.exists() {
        if let Ok(config_content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<WalletConfig>(&config_content) {
                return Json(json!({
                    "success": true,
                    "data": {
                        "address": config.wallet_address,
                        "network": config.network,
                        "source": "config"
                    }
                })).into_response();
            }
        }
    }
    
    // Fallback to wallet.json (has address field)
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
        "error": "No wallet found. Initialize with: node src/cli/init.ts"
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
        .route("/balance", post(get_balance))
        .route("/usdc-balance", post(get_usdc_balance))
        .route("/usdt-balance", post(get_usdt_balance))
        .route("/transaction-history", post(get_fuego_transactions))
        .route("/all-transactions", post(get_all_transactions))
        // TRANSFER endpoints
        .route("/build-transfer-usdc", post(build_transfer_usdc))
        .route("/build-transfer-sol", post(build_transfer_sol))
        .route("/build-transfer-usdt", post(build_transfer_usdt))
        .route("/submit-transaction", post(submit_transaction))
        // x402 endpoints
        .route("/x402-request", post(x402_request))
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
    println!("    POST /balance - Get SOL balance");
    println!("    POST /usdc-balance - Get USDC balance");
    println!("    POST /usdt-balance - Get USDT balance");
    println!("  TRANSFER:");
    println!("    POST /build-transfer-usdc - Build unsigned USDC transfer (agent signs)");
    println!("    POST /build-transfer-sol - Build unsigned SOL transfer (agent signs)");
    println!("    POST /build-transfer-usdt - Build unsigned USDT transfer (agent signs)");
    println!("    POST /submit-transaction - Broadcast signed transaction");
    println!("  HISTORY:");
    println!("    POST /transaction-history - Get Fuego transactions (filtered)");
    println!("    POST /all-transactions - Get all transactions (unfiltered)");
  println!("  X402:");
    println!("    POST /x402-request - Solana x402 payment handler (Solana-only focus)");
    println!("  TODO:");
    println!("    POST /pyusd-balance - Get PYUSD (Token-2022) balance");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}