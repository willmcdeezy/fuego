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
use spl_associated_token_account::get_associated_token_address;
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

async fn get_pyusd_balance(
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

    let pyusd_mint = match string_to_pub_key(PYUSD_MINT) {
        Ok(mint) => mint,
        Err(_) => {
            return Json(json!({
                "success": false,
                "error": "Failed to parse PYUSD mint"
            }))
            .into_response();
        }
    };

    // Try to find PYUSD token account using get_token_accounts_by_owner
    // This works for both SPL and Token-2022 tokens
    // Note: RpcClient::get_token_accounts_by_owner in solana_client 2.0.7 may have different API
    // For now, we'll use the previously working direct ATA derivation approach
    let token_account_pubkey = get_associated_token_address(&pubkey, &pyusd_mint);

    match rpc.get_token_account_balance(&token_account_pubkey) {
        Ok(balance) => {
            Json(json!({
                "success": true,
                "data": {
                    "address": payload.address,
                    "amount": balance.amount,
                    "decimals": balance.decimals,
                    "ui_amount": balance.ui_amount_string,
                    "network": payload.network,
                    "token": "PYUSD",
                    "mint": PYUSD_MINT,
                    "token_account": token_account_pubkey.to_string(),
                    "program": "Token Program 2022"
                }
            }))
            .into_response()
        }
        Err(_) => {
            // If direct ATA derivation fails, try using Token Program 2022 ATA
            let token_program_2022 = match string_to_pub_key(TOKEN_PROGRAM_2022) {
                Ok(program) => program,
                Err(_) => {
                    return Json(json!({
                        "success": false,
                        "error": "Failed to parse Token Program 2022"
                    }))
                    .into_response();
                }
            };

            let token_2022_ata = spl_associated_token_account::get_associated_token_address_with_program_id(
                &pubkey,
                &pyusd_mint,
                &token_program_2022,
            );

            match rpc.get_token_account_balance(&token_2022_ata) {
        Ok(balance) => {
            Json(json!({
                "success": true,
                "data": {
                    "address": payload.address,
                    "amount": balance.amount,
                    "decimals": balance.decimals,
                    "ui_amount": balance.ui_amount_string,
                    "network": payload.network,
                    "token": "PYUSD",
                    "mint": PYUSD_MINT,
                    "token_account": token_2022_ata.to_string(),
                    "program": "Token Program 2022"
                }
            }))
            .into_response()
        }
        Err(e) => {
            Json(json!({
                "success": false,
                "error": format!("Failed to get PYUSD balance: {}", e)
            }))
            .into_response()
        }
            }
        }
    }
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
        .route("/latest-hash", post(get_latest_hash))
        .route("/balance", post(get_balance))
        .route("/usdc-balance", post(get_usdc_balance))
        .route("/pyusd-balance", post(get_pyusd_balance))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("🔥 Fuego server running on http://{}", addr);
    println!("Endpoints:");
    println!("  POST /latest-hash - Get latest blockhash");
    println!("  POST /balance - Get SOL balance for address");
    println!("  POST /usdc-balance - Get USDC balance (default: confirmed commitment)");
    println!("  POST /pyusd-balance - Get PYUSD balance (default: confirmed commitment)");
    println!("  GET  /health - Health check");
    println!("  GET  /network - Get default network");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}