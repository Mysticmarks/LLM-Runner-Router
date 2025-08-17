//! Main WASM client implementation

use crate::{
    error::{LLMRouterError, JSError},
    models::*,
    utils::*,
};

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{console, AbortController, Headers, Request, RequestInit, RequestMode, Response};
use futures::stream::Stream;
use std::collections::HashMap;

type Result<T> = std::result::Result<T, LLMRouterError>;

/// Main LLM Router client for WebAssembly
#[wasm_bindgen]
pub struct LLMRouterClient {
    config: RouterConfig,
    session_id: Option<String>,
}

#[wasm_bindgen]
impl LLMRouterClient {
    /// Create a new client
    #[wasm_bindgen(constructor)]
    pub fn new(config: RouterConfig) -> LLMRouterClient {
        console::log_1(&"Creating LLM Router WASM client".into());
        
        LLMRouterClient {
            config,
            session_id: None,
        }
    }

    /// Create a client with default configuration
    #[wasm_bindgen(js_name = "withDefaults")]
    pub fn with_defaults(base_url: String) -> LLMRouterClient {
        let config = RouterConfig::new(base_url);
        Self::new(config)
    }

    /// Set session ID for request tracking
    #[wasm_bindgen(js_name = "setSessionId")]
    pub fn set_session_id(&mut self, session_id: String) {
        self.session_id = Some(session_id);
    }

    /// Clear session ID
    #[wasm_bindgen(js_name = "clearSession")]
    pub fn clear_session(&mut self) {
        self.session_id = None;
    }

    /// Get current session ID
    #[wasm_bindgen(js_name = "getSessionId")]
    pub fn get_session_id(&self) -> Option<String> {
        self.session_id.clone()
    }

    /// Health check
    #[wasm_bindgen(js_name = "healthCheck")]
    pub async fn health_check(&self) -> Result<JsValue, JSError> {
        let result = self.make_request("GET", "health", None).await;
        match result {
            Ok(value) => Ok(value),
            Err(e) => Err(JSError::from(e)),
        }
    }

    /// Get system status
    #[wasm_bindgen(js_name = "getStatus")]
    pub async fn get_status(&self) -> Result<JsValue, JSError> {
        let result = self.make_request("GET", "status", None).await;
        match result {
            Ok(value) => Ok(value),
            Err(e) => Err(JSError::from(e)),
        }
    }

    /// List models
    #[wasm_bindgen(js_name = "listModels")]
    pub async fn list_models(&self, include_unloaded: Option<bool>) -> Result<js_sys::Array, JSError> {
        let mut endpoint = "models".to_string();
        if let Some(include_unloaded) = include_unloaded {
            endpoint.push_str(&format!("?include_unloaded={}", include_unloaded));
        }
        
        match self.make_request("GET", &endpoint, None).await {
            Ok(response) => {
                // Extract models array from response
                let models = js_sys::Reflect::get(&response, &"models".into())
                    .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                        message: "Failed to get models from response".to_string()
                    }))?;
                
                if let Some(array) = models.dyn_ref::<js_sys::Array>() {
                    Ok(array.clone())
                } else {
                    Err(JSError::from(LLMRouterError::Serialization {
                        message: "Models is not an array".to_string()
                    }))
                }
            }
            Err(e) => Err(JSError::from(e)),
        }
    }

    /// Load a model
    #[wasm_bindgen(js_name = "loadModel")]
    pub async fn load_model(&self, request: &LoadModelRequest) -> Result<JsValue, JSError> {
        let body = request.to_object()
            .map_err(|e| JSError::from(LLMRouterError::Serialization {
                message: "Failed to serialize load request".to_string()
            }))?;
        
        let result = self.make_request("POST", "models/load", Some(body)).await;
        match result {
            Ok(value) => Ok(value),
            Err(e) => Err(JSError::from(e)),
        }
    }

    /// Perform inference
    #[wasm_bindgen(js_name = "inference")]
    pub async fn inference(&self, mut request: InferenceRequest) -> Result<InferenceResponse, JSError> {
        // Add session ID if available
        if request.session_id.is_none() {
            request.session_id = self.session_id.clone();
        }

        let body = request.to_object()
            .map_err(|e| JSError::from(LLMRouterError::Serialization {
                message: "Failed to serialize inference request".to_string()
            }))?;
        
        match self.make_request("POST", "inference", Some(body)).await {
            Ok(response_value) => {
                InferenceResponse::from_object(&response_value)
                    .map_err(|e| JSError::from(LLMRouterError::Serialization {
                        message: "Failed to parse inference response".to_string()
                    }))
            }
            Err(e) => Err(JSError::from(e)),
        }
    }

    /// Quick inference with minimal setup
    #[wasm_bindgen(js_name = "quickInference")]
    pub async fn quick_inference(&self, prompt: String) -> Result<InferenceResponse, JSError> {
        let request = InferenceRequest::new(prompt);
        self.inference(request).await
    }

    /// Quick inference with options
    #[wasm_bindgen(js_name = "quickInferenceWithOptions")]
    pub async fn quick_inference_with_options(
        &self,
        prompt: String,
        options: InferenceOptions,
    ) -> Result<InferenceResponse, JSError> {
        let mut request = InferenceRequest::new(prompt);
        request.set_options(Some(options));
        self.inference(request).await
    }

    /// Start streaming inference
    #[wasm_bindgen(js_name = "streamInference")]
    pub async fn stream_inference(&self, mut request: InferenceRequest) -> Result<StreamReader, JSError> {
        // Ensure streaming is enabled
        if let Some(ref mut options) = request.options {
            options.set_stream(Some(true));
        } else {
            let mut options = InferenceOptions::new();
            options.set_stream(Some(true));
            request.set_options(Some(options));
        }

        // Add session ID if available
        if request.session_id.is_none() {
            request.session_id = self.session_id.clone();
        }

        let body = request.to_object()
            .map_err(|e| JSError::from(LLMRouterError::Serialization {
                message: "Failed to serialize stream request".to_string()
            }))?;
        
        match self.make_stream_request("POST", "inference/stream", Some(body)).await {
            Ok(reader) => Ok(reader),
            Err(e) => Err(JSError::from(e)),
        }
    }

    /// Make HTTP request
    async fn make_request(
        &self,
        method: &str,
        endpoint: &str,
        body: Option<JsValue>,
    ) -> Result<JsValue> {
        let url = format!("{}/api/v1/{}", self.config.base_url, endpoint.trim_start_matches('/'));
        
        let mut opts = RequestInit::new();
        opts.method(method);
        opts.mode(RequestMode::Cors);

        // Set headers
        let headers = Headers::new()
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to create headers".to_string()
            })?;
        
        headers.set("Content-Type", "application/json")
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to set content type".to_string()
            })?;
        
        // Add authentication header if API key is provided
        if let Some(ref api_key) = self.config.api_key {
            headers.set("Authorization", &format!("Bearer {}", api_key))
                .map_err(|e| LLMRouterError::JavaScript {
                    message: "Failed to set authorization header".to_string()
                })?;
        }
        
        headers.set("User-Agent", &self.config.user_agent)
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to set user agent".to_string()
            })?;

        opts.headers(&headers);

        // Set body if provided
        if let Some(body) = body {
            let body_string = js_sys::JSON::stringify(&body)
                .map_err(|e| LLMRouterError::Serialization {
                    message: "Failed to stringify request body".to_string()
                })?;
            opts.body(Some(&body_string));
        }

        // Create abort controller for timeout
        let abort_controller = AbortController::new()
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to create abort controller".to_string()
            })?;
        opts.signal(Some(&abort_controller.signal()));

        // Set timeout
        let timeout_ms = self.config.timeout_ms;
        let abort_controller_clone = abort_controller.clone();
        
        // Schedule timeout
        let timeout_closure = Closure::once_into_js(move || {
            abort_controller_clone.abort();
        });
        
        let timeout_id = web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                timeout_closure.as_ref().unchecked_ref(),
                timeout_ms as i32,
            )
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to set timeout".to_string()
            })?;

        // Make request
        let request = Request::new_with_str_and_init(&url, &opts)
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to create request".to_string()
            })?;

        let window = web_sys::window().unwrap();
        let resp_value = JsFuture::from(window.fetch_with_request(&request))
            .await
            .map_err(|e| {
                // Clear timeout
                window.clear_timeout_with_handle(timeout_id);
                LLMRouterError::from(e)
            })?;

        // Clear timeout on success
        window.clear_timeout_with_handle(timeout_id);

        let resp: Response = resp_value.dyn_into()
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Invalid response type".to_string()
            })?;

        if resp.ok() {
            let json = JsFuture::from(resp.json()?)
                .await
                .map_err(|e| LLMRouterError::Serialization {
                    message: "Failed to parse response JSON".to_string()
                })?;
            Ok(json)
        } else {
            let status = resp.status();
            let status_text = resp.status_text();
            
            // Try to get error message from response body
            let error_message = if let Ok(text_promise) = resp.text() {
                if let Ok(text_value) = JsFuture::from(text_promise).await {
                    if let Some(text) = text_value.as_string() {
                        // Try to parse as JSON to get error field
                        if let Ok(json) = js_sys::JSON::parse(&text) {
                            if let Ok(error_field) = js_sys::Reflect::get(&json, &"error".into()) {
                                if let Some(error_str) = error_field.as_string() {
                                    error_str
                                } else {
                                    text
                                }
                            } else {
                                text
                            }
                        } else {
                            text
                        }
                    } else {
                        status_text.clone()
                    }
                } else {
                    status_text.clone()
                }
            } else {
                status_text.clone()
            };

            let error = match status {
                401 | 403 => LLMRouterError::Authentication { message: error_message },
                404 => LLMRouterError::ModelNotFound { model_id: "unknown".to_string() },
                408 => LLMRouterError::Timeout { message: error_message },
                429 => LLMRouterError::RateLimit { message: error_message },
                400 => LLMRouterError::Validation { message: error_message },
                500..=599 => LLMRouterError::Inference { message: error_message },
                _ => LLMRouterError::Network { message: error_message },
            };

            Err(error)
        }
    }

    /// Make streaming request
    async fn make_stream_request(
        &self,
        method: &str,
        endpoint: &str,
        body: Option<JsValue>,
    ) -> Result<StreamReader> {
        let url = format!("{}/api/v1/{}", self.config.base_url, endpoint.trim_start_matches('/'));
        
        let mut opts = RequestInit::new();
        opts.method(method);
        opts.mode(RequestMode::Cors);

        // Set headers
        let headers = Headers::new()
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to create headers".to_string()
            })?;
        
        headers.set("Content-Type", "application/json")
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to set content type".to_string()
            })?;
        
        headers.set("Accept", "text/event-stream")
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to set accept header".to_string()
            })?;
        
        if let Some(ref api_key) = self.config.api_key {
            headers.set("Authorization", &format!("Bearer {}", api_key))
                .map_err(|e| LLMRouterError::JavaScript {
                    message: "Failed to set authorization header".to_string()
                })?;
        }

        opts.headers(&headers);

        if let Some(body) = body {
            let body_string = js_sys::JSON::stringify(&body)
                .map_err(|e| LLMRouterError::Serialization {
                    message: "Failed to stringify request body".to_string()
                })?;
            opts.body(Some(&body_string));
        }

        let request = Request::new_with_str_and_init(&url, &opts)
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Failed to create stream request".to_string()
            })?;

        let window = web_sys::window().unwrap();
        let resp_value = JsFuture::from(window.fetch_with_request(&request))
            .await
            .map_err(|e| LLMRouterError::from(e))?;

        let resp: Response = resp_value.dyn_into()
            .map_err(|e| LLMRouterError::JavaScript {
                message: "Invalid response type".to_string()
            })?;

        if resp.ok() {
            if let Some(body) = resp.body() {
                Ok(StreamReader::new(body))
            } else {
                Err(LLMRouterError::Network {
                    message: "No response body for stream".to_string()
                })
            }
        } else {
            let status = resp.status();
            let error_message = format!("Stream request failed: {} {}", status, resp.status_text());
            
            Err(match status {
                401 | 403 => LLMRouterError::Authentication { message: error_message },
                404 => LLMRouterError::ModelNotFound { model_id: "unknown".to_string() },
                408 => LLMRouterError::Timeout { message: error_message },
                429 => LLMRouterError::RateLimit { message: error_message },
                _ => LLMRouterError::Network { message: error_message },
            })
        }
    }
}

/// Stream reader for handling streaming responses
#[wasm_bindgen]
pub struct StreamReader {
    #[wasm_bindgen(skip)]
    reader: Option<web_sys::ReadableStreamDefaultReader>,
}

#[wasm_bindgen]
impl StreamReader {
    pub(crate) fn new(stream: web_sys::ReadableStream) -> Self {
        let reader = stream.get_reader().dyn_into().ok();
        StreamReader { reader }
    }

    /// Read next chunk from stream
    #[wasm_bindgen(js_name = "readChunk")]
    pub async fn read_chunk(&mut self) -> Result<Option<StreamingResponse>, JSError> {
        if let Some(ref mut reader) = self.reader {
            match JsFuture::from(reader.read()).await {
                Ok(result) => {
                    let done = js_sys::Reflect::get(&result, &"done".into())
                        .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                            message: "Failed to get done property".to_string()
                        }))?
                        .as_bool()
                        .unwrap_or(true);

                    if done {
                        return Ok(None);
                    }

                    let value = js_sys::Reflect::get(&result, &"value".into())
                        .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                            message: "Failed to get value property".to_string()
                        }))?;

                    // Convert Uint8Array to string
                    let uint8_array = js_sys::Uint8Array::new(&value);
                    let mut bytes = vec![0; uint8_array.length() as usize];
                    uint8_array.copy_to(&mut bytes);
                    
                    let text = String::from_utf8(bytes)
                        .map_err(|e| JSError::from(LLMRouterError::Serialization {
                            message: "Invalid UTF-8 in stream".to_string()
                        }))?;

                    // Parse Server-Sent Events format
                    for line in text.lines() {
                        if let Some(data) = line.strip_prefix("data: ") {
                            let chunk: StreamingResponse = serde_json::from_str(data)
                                .map_err(|e| JSError::from(LLMRouterError::Serialization {
                                    message: "Failed to parse stream chunk".to_string()
                                }))?;
                            return Ok(Some(chunk));
                        }
                    }

                    // If no data found, try again
                    Ok(None)
                }
                Err(e) => Err(JSError::from(LLMRouterError::from(e))),
            }
        } else {
            Err(JSError::from(LLMRouterError::Network {
                message: "Stream reader not available".to_string()
            }))
        }
    }

    /// Close the stream
    #[wasm_bindgen(js_name = "close")]
    pub async fn close(&mut self) -> Result<(), JSError> {
        if let Some(reader) = self.reader.take() {
            JsFuture::from(reader.cancel())
                .await
                .map_err(|e| JSError::from(LLMRouterError::from(e)))?;
        }
        Ok(())
    }
}