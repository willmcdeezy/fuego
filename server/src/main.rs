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
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction as token_instruction;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use spl_memo;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use utils::string_to_pub_key;

// Token mint addresses
const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Try alternate PYUSD mints - could be either address depending on network
const PYUSD_MINT: &str = "PyUvTEBjM1yGH3FPz8fs9cTSMUq534YEGU3RLWQ5o9t"; // Token-2022
const PYUSD_MINT_ALT: &str = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"; // Alternative
const TOKEN_PROGRAM_2022: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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
struct BalanceResponse {
    lamports: u64,
    sol: f64,
}

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

async fn build_transfer_usdc(
    State(_state): State<AppState>,
    Json(payload): Json<TransferUsdcRequest>,
) -> Response {
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

    // Build memo: fuego|f:{from}|t:{to}|a:{amount}|yid:{yid}
    let memo_text = format!(
        "fuego|f:{}|t:{}|a:{}|yid:{}",
        payload.from_address, payload.to_address, amount, payload.yid
    );

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

    // Create transaction message
    let message = Message::new(
        &[compute_limit, unit_price, transfer_instruction, memo_instruction],
        Some(&from_pubkey),
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
                base64::encode(&serialized_tx)
            ),
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
    let tx_bytes = match base64::decode(&payload.transaction) {
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
        Ok(signature) => Json(json!({
            "success": true,
            "data": {
                "signature": signature.to_string(),
                "network": payload.network,
                "status": "submitted"
            }
        }))
        .into_response(),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to submit transaction: {}", e)
        }))
        .into_response(),
    }
}

// TODO: PYUSD balance endpoint using Token-2022
// Requires getTokenAccountsByOwner implementation
// Issue: Standard ATA derivation doesn't work for Token-2022
// Solution: Enumerate all token accounts owned by wallet and find by mint
/*
async fn get_pyusd_balance(
    State(_state): State<AppState>,
    Json(payload): Json<GetTokenBalanceRequest>,
) -> Response {
    // TODO: Implement getTokenAccountsByOwner search
    // For now, see get_usdc_balance as working reference
}
*/

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
        // READ endpoints
        .route("/latest-hash", post(get_latest_hash))
        .route("/balance", post(get_balance))
        .route("/usdc-balance", post(get_usdc_balance))
        // TRANSFER endpoints
        .route("/build-transfer-usdc", post(build_transfer_usdc))
        .route("/submit-transaction", post(submit_transaction))
        // TODO: .route("/pyusd-balance", post(get_pyusd_balance))
        // TODO: .route("/build-transfer-sol", post(build_transfer_sol))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("🔥 Fuego server running on http://{}", addr);
    println!("Endpoints:");
    println!("  READ:");
    println!("    GET  /health - Health check");
    println!("    GET  /network - Get default network");
    println!("    POST /latest-hash - Get latest blockhash");
    println!("    POST /balance - Get SOL balance");
    println!("    POST /usdc-balance - Get USDC balance");
    println!("  TRANSFER:");
    println!("    POST /build-transfer-usdc - Build unsigned USDC transfer (agent signs)");
    println!("    POST /submit-transaction - Broadcast signed transaction");
    println!("  TODO:");
    println!("    POST /build-transfer-sol - Build unsigned SOL transfer");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}