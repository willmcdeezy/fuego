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
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use utils::string_to_pub_key;

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
struct BalanceResponse {
    lamports: u64,
    sol: f64,
}

// State to hold RPC clients (could be expanded for caching)
#[derive(Clone)]
struct AppState {
    default_network: String,
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
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("🔥 Fuego server running on http://{}", addr);
    println!("Endpoints:");
    println!("  POST /latest-hash - Get latest blockhash");
    println!("  POST /balance - Get SOL balance for address");
    println!("  GET  /health - Health check");
    println!("  GET  /network - Get default network");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}