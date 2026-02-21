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
use solana_sdk::transaction::{Transaction, VersionedTransaction};
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
#[allow(dead_code)]
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

#[allow(dead_code)]
fn default_method() -> String {
    "GET".to_string()
}

#[allow(dead_code)]
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

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct X402Extra {
    // Use Option for parsing, but require for Solana logic
    #[serde(rename = "feePayer")]
    fee_payer: Option<String>,
    decimals: Option<u8>,
    #[serde(rename = "recentBlockhash")]
    recent_blockhash: Option<String>,
    #[serde(default)]
    features: Option<serde_json::Value>,
    // Ignore non-Solana fields completely
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<serde_json::Value>,
    #[serde(default)] 
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<serde_json::Value>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "chainId")]
    chain_id: Option<serde_json::Value>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "verifyingContract")]
    verifying_contract: Option<serde_json::Value>,
}

#[allow(dead_code)]
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
    let versioned_transaction: VersionedTransaction = match bincode::deserialize(&tx_bytes) {
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
        .route("/all-transactions", post(get_all_transactions))
        // TRANSFER endpoints
        .route("/build-transfer-usdc", post(build_transfer_usdc))
        .route("/build-transfer-sol", post(build_transfer_sol))
        .route("/build-transfer-usdt", post(build_transfer_usdt))
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
    println!("    POST /balance - Get SOL balance");
    println!("    POST /usdc-balance - Get USDC balance");
    println!("    POST /usdt-balance - Get USDT balance");
    println!("  TRANSFER:");
    println!("    POST /build-transfer-usdc - Build unsigned USDC transfer (agent signs)");
    println!("    POST /build-transfer-sol - Build unsigned SOL transfer (agent signs)");
    println!("    POST /build-transfer-usdt - Build unsigned USDT transfer (agent signs)");
    println!("    POST /submit-transaction - Broadcast signed transaction (legacy format - fuego transfers)");
    println!("    POST /submit-versioned-transaction - Broadcast VersionedTransaction (Jupiter/v0 format)");
    println!("  HISTORY:");
    println!("    POST /all-transactions - Get all transactions (unfiltered)");
    println!("  TODO:");
    println!("    POST /pyusd-balance - Get PYUSD (Token-2022) balance");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}