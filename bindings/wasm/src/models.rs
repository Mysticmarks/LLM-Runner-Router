//! Data models for WASM bindings

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

/// Configuration for the router client
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterConfig {
    /// Base URL for HTTP REST API
    pub base_url: String,
    /// Request timeout in milliseconds
    pub timeout_ms: u32,
    /// Maximum number of retries
    pub max_retries: u32,
    /// API key for authentication
    pub api_key: Option<String>,
    /// User agent string
    pub user_agent: String,
}

#[wasm_bindgen]
impl RouterConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(base_url: String) -> RouterConfig {
        RouterConfig {
            base_url,
            timeout_ms: 30000,
            max_retries: 3,
            api_key: None,
            user_agent: format!("llm-router-wasm/{}", env!("CARGO_PKG_VERSION")),
        }
    }

    #[wasm_bindgen(setter)]
    pub fn set_timeout_ms(&mut self, timeout_ms: u32) {
        self.timeout_ms = timeout_ms;
    }

    #[wasm_bindgen(getter)]
    pub fn timeout_ms(&self) -> u32 {
        self.timeout_ms
    }

    #[wasm_bindgen(setter)]
    pub fn set_max_retries(&mut self, max_retries: u32) {
        self.max_retries = max_retries;
    }

    #[wasm_bindgen(getter)]
    pub fn max_retries(&self) -> u32 {
        self.max_retries
    }

    #[wasm_bindgen(setter)]
    pub fn set_api_key(&mut self, api_key: Option<String>) {
        self.api_key = api_key;
    }

    #[wasm_bindgen(getter)]
    pub fn api_key(&self) -> Option<String> {
        self.api_key.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_user_agent(&mut self, user_agent: String) {
        self.user_agent = user_agent;
    }

    #[wasm_bindgen(getter)]
    pub fn user_agent(&self) -> String {
        self.user_agent.clone()
    }
}

/// Options for inference requests
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceOptions {
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    top_p: Option<f32>,
    top_k: Option<u32>,
    stream: Option<bool>,
    seed: Option<u32>,
}

#[wasm_bindgen]
impl InferenceOptions {
    #[wasm_bindgen(constructor)]
    pub fn new() -> InferenceOptions {
        InferenceOptions {
            max_tokens: Some(500),
            temperature: Some(0.7),
            top_p: Some(1.0),
            top_k: None,
            stream: Some(false),
            seed: None,
        }
    }

    #[wasm_bindgen(setter)]
    pub fn set_max_tokens(&mut self, max_tokens: Option<u32>) {
        self.max_tokens = max_tokens;
    }

    #[wasm_bindgen(getter)]
    pub fn max_tokens(&self) -> Option<u32> {
        self.max_tokens
    }

    #[wasm_bindgen(setter)]
    pub fn set_temperature(&mut self, temperature: Option<f32>) {
        self.temperature = temperature;
    }

    #[wasm_bindgen(getter)]
    pub fn temperature(&self) -> Option<f32> {
        self.temperature
    }

    #[wasm_bindgen(setter)]
    pub fn set_top_p(&mut self, top_p: Option<f32>) {
        self.top_p = top_p;
    }

    #[wasm_bindgen(getter)]
    pub fn top_p(&self) -> Option<f32> {
        self.top_p
    }

    #[wasm_bindgen(setter)]
    pub fn set_stream(&mut self, stream: Option<bool>) {
        self.stream = stream;
    }

    #[wasm_bindgen(getter)]
    pub fn stream(&self) -> Option<bool> {
        self.stream
    }
}

/// Request for inference
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub prompt: String,
    pub model_id: Option<String>,
    #[wasm_bindgen(skip)]
    pub options: Option<InferenceOptions>,
    #[wasm_bindgen(skip)]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub session_id: Option<String>,
}

#[wasm_bindgen]
impl InferenceRequest {
    #[wasm_bindgen(constructor)]
    pub fn new(prompt: String) -> InferenceRequest {
        InferenceRequest {
            prompt,
            model_id: None,
            options: None,
            metadata: None,
            session_id: None,
        }
    }

    #[wasm_bindgen(setter)]
    pub fn set_model_id(&mut self, model_id: Option<String>) {
        self.model_id = model_id;
    }

    #[wasm_bindgen(getter)]
    pub fn model_id(&self) -> Option<String> {
        self.model_id.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_options(&mut self, options: Option<InferenceOptions>) {
        self.options = options;
    }

    #[wasm_bindgen(getter)]
    pub fn options(&self) -> Option<InferenceOptions> {
        self.options.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_session_id(&mut self, session_id: Option<String>) {
        self.session_id = session_id;
    }

    #[wasm_bindgen(getter)]
    pub fn session_id(&self) -> Option<String> {
        self.session_id.clone()
    }
}

/// Response from inference
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    pub text: String,
    pub model_id: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

#[wasm_bindgen]
impl InferenceResponse {
    #[wasm_bindgen(constructor)]
    pub fn new(text: String, success: bool) -> InferenceResponse {
        InferenceResponse {
            text,
            model_id: None,
            success,
            error: None,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn text(&self) -> String {
        self.text.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn model_id(&self) -> Option<String> {
        self.model_id.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn success(&self) -> bool {
        self.success
    }

    #[wasm_bindgen(getter)]
    pub fn error(&self) -> Option<String> {
        self.error.clone()
    }
}

/// Streaming response chunk
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingResponse {
    pub token: String,
    pub is_complete: bool,
    pub model_id: Option<String>,
    pub error: Option<String>,
}

#[wasm_bindgen]
impl StreamingResponse {
    #[wasm_bindgen(constructor)]
    pub fn new(token: String, is_complete: bool) -> StreamingResponse {
        StreamingResponse {
            token,
            is_complete,
            model_id: None,
            error: None,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn token(&self) -> String {
        self.token.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn is_complete(&self) -> bool {
        self.is_complete
    }

    #[wasm_bindgen(getter)]
    pub fn model_id(&self) -> Option<String> {
        self.model_id.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn error(&self) -> Option<String> {
        self.error.clone()
    }
}

/// Model information
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: Option<String>,
    pub format: Option<String>,
    pub loaded: bool,
}

#[wasm_bindgen]
impl ModelInfo {
    #[wasm_bindgen(constructor)]
    pub fn new(id: String, loaded: bool) -> ModelInfo {
        ModelInfo {
            id,
            name: None,
            format: None,
            loaded,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.id.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn name(&self) -> Option<String> {
        self.name.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn format(&self) -> Option<String> {
        self.format.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn loaded(&self) -> bool {
        self.loaded
    }
}

/// Load model request
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadModelRequest {
    pub source: String,
    pub format: Option<String>,
    pub id: Option<String>,
    pub name: Option<String>,
    pub force_reload: bool,
}

#[wasm_bindgen]
impl LoadModelRequest {
    #[wasm_bindgen(constructor)]
    pub fn new(source: String) -> LoadModelRequest {
        LoadModelRequest {
            source,
            format: None,
            id: None,
            name: None,
            force_reload: false,
        }
    }

    #[wasm_bindgen(setter)]
    pub fn set_format(&mut self, format: Option<String>) {
        self.format = format;
    }

    #[wasm_bindgen(getter)]
    pub fn format(&self) -> Option<String> {
        self.format.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_id(&mut self, id: Option<String>) {
        self.id = id;
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> Option<String> {
        self.id.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_force_reload(&mut self, force_reload: bool) {
        self.force_reload = force_reload;
    }

    #[wasm_bindgen(getter)]
    pub fn force_reload(&self) -> bool {
        self.force_reload
    }
}

// JavaScript object conversion helpers
#[wasm_bindgen]
impl InferenceRequest {
    /// Create from JavaScript object
    #[wasm_bindgen(js_name = fromObject)]
    pub fn from_object(obj: &JsValue) -> Result<InferenceRequest, JsValue> {
        serde_wasm_bindgen::from_value(obj.clone())
            .map_err(|e| JsValue::from_str(&format!("Failed to parse InferenceRequest: {}", e)))
    }

    /// Convert to JavaScript object
    #[wasm_bindgen(js_name = toObject)]
    pub fn to_object(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(self)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize InferenceRequest: {}", e)))
    }
}

#[wasm_bindgen]
impl InferenceResponse {
    /// Create from JavaScript object
    #[wasm_bindgen(js_name = fromObject)]
    pub fn from_object(obj: &JsValue) -> Result<InferenceResponse, JsValue> {
        serde_wasm_bindgen::from_value(obj.clone())
            .map_err(|e| JsValue::from_str(&format!("Failed to parse InferenceResponse: {}", e)))
    }

    /// Convert to JavaScript object
    #[wasm_bindgen(js_name = toObject)]
    pub fn to_object(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(self)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize InferenceResponse: {}", e)))
    }
}

// Type definitions for JavaScript
#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONTENT: &'static str = r#"
export interface IRouterConfig {
    base_url: string;
    timeout_ms?: number;
    max_retries?: number;
    api_key?: string;
    user_agent?: string;
}

export interface IInferenceOptions {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stream?: boolean;
    seed?: number;
}

export interface IInferenceRequest {
    prompt: string;
    model_id?: string;
    options?: IInferenceOptions;
    metadata?: Record<string, any>;
    session_id?: string;
}

export interface IInferenceResponse {
    text: string;
    model_id?: string;
    success: boolean;
    error?: string;
}

export interface IStreamingResponse {
    token: string;
    is_complete: boolean;
    model_id?: string;
    error?: string;
}

export interface IModelInfo {
    id: string;
    name?: string;
    format?: string;
    loaded: boolean;
}
"#;