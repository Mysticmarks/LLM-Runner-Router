//! WebAssembly bindings for LLM Runner Router
//!
//! This crate provides WebAssembly bindings that allow the LLM Router client
//! to be used directly in web browsers and other JavaScript environments.

use wasm_bindgen::prelude::*;
use web_sys::console;

// Import the `console.log` function from the `console` namespace
#[wasm_bindgen]
extern "C" {
    // Bind `console.log` from JavaScript
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro for easier console logging
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Global allocator for WASM
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

mod client;
mod error;
mod models;
mod utils;
mod worker;

pub use client::*;
pub use error::*;
pub use models::*;
pub use worker::*;

// Re-export for convenience
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// Version information
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn main() {
    init_panic_hook();
    console_log!("LLM Runner Router WASM initialized v{}", version());
}