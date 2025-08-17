//! Web Worker support for WASM bindings

use wasm_bindgen::prelude::*;
use web_sys::{DedicatedWorkerGlobalScope, MessageEvent, Worker};
use crate::{
    client::LLMRouterClient,
    models::*,
    error::{LLMRouterError, JSError},
    utils::*,
};

/// Web Worker wrapper for LLM Router client
#[wasm_bindgen]
pub struct LLMRouterWorker {
    client: LLMRouterClient,
    worker_id: String,
}

#[wasm_bindgen]
impl LLMRouterWorker {
    /// Create a new worker instance
    #[wasm_bindgen(constructor)]
    pub fn new(config: RouterConfig) -> LLMRouterWorker {
        let worker_id = generate_uuid();
        let client = LLMRouterClient::new(config);
        
        log_with_timestamp("info", &format!("LLM Router Worker created: {}", worker_id));
        
        LLMRouterWorker {
            client,
            worker_id,
        }
    }

    /// Get worker ID
    #[wasm_bindgen(getter, js_name = "workerId")]
    pub fn worker_id(&self) -> String {
        self.worker_id.clone()
    }

    /// Process message from main thread
    #[wasm_bindgen(js_name = "processMessage")]
    pub async fn process_message(&mut self, message: &JsValue) -> Result<JsValue, JSError> {
        let message_obj = message.dyn_ref::<js_sys::Object>()
            .ok_or_else(|| JSError::from(LLMRouterError::Validation {
                message: "Invalid message format".to_string()
            }))?;

        // Extract message type
        let message_type = js_sys::Reflect::get(message_obj, &"type".into())
            .map_err(|e| JSError::from(LLMRouterError::Validation {
                message: "Missing message type".to_string()
            }))?
            .as_string()
            .ok_or_else(|| JSError::from(LLMRouterError::Validation {
                message: "Message type must be a string".to_string()
            }))?;

        // Extract request ID for response correlation
        let request_id = js_sys::Reflect::get(message_obj, &"requestId".into())
            .ok()
            .and_then(|v| v.as_string())
            .unwrap_or_else(|| generate_uuid());

        // Extract payload
        let payload = js_sys::Reflect::get(message_obj, &"payload".into())
            .unwrap_or_else(|_| JsValue::undefined());

        let response = match message_type.as_str() {
            "health_check" => {
                self.client.health_check().await
                    .map_err(|e| e)?
            }
            "get_status" => {
                self.client.get_status().await
                    .map_err(|e| e)?
            }
            "list_models" => {
                let include_unloaded = js_sys::Reflect::get(&payload, &"include_unloaded".into())
                    .ok()
                    .and_then(|v| v.as_bool());
                
                let models = self.client.list_models(include_unloaded).await
                    .map_err(|e| e)?;
                models.into()
            }
            "load_model" => {
                let load_request = LoadModelRequest::from_object(&payload)
                    .map_err(|e| JSError::from(LLMRouterError::Serialization {
                        message: "Failed to parse load model request".to_string()
                    }))?;
                
                self.client.load_model(&load_request).await
                    .map_err(|e| e)?
            }
            "inference" => {
                let inference_request = InferenceRequest::from_object(&payload)
                    .map_err(|e| JSError::from(LLMRouterError::Serialization {
                        message: "Failed to parse inference request".to_string()
                    }))?;
                
                let response = self.client.inference(inference_request).await
                    .map_err(|e| e)?;
                
                response.to_object()
                    .map_err(|e| JSError::from(LLMRouterError::Serialization {
                        message: "Failed to serialize inference response".to_string()
                    }))?
            }
            "quick_inference" => {
                let prompt = js_sys::Reflect::get(&payload, &"prompt".into())
                    .map_err(|e| JSError::from(LLMRouterError::Validation {
                        message: "Missing prompt".to_string()
                    }))?
                    .as_string()
                    .ok_or_else(|| JSError::from(LLMRouterError::Validation {
                        message: "Prompt must be a string".to_string()
                    }))?;
                
                let response = self.client.quick_inference(prompt).await
                    .map_err(|e| e)?;
                
                response.to_object()
                    .map_err(|e| JSError::from(LLMRouterError::Serialization {
                        message: "Failed to serialize quick inference response".to_string()
                    }))?
            }
            "set_session_id" => {
                let session_id = js_sys::Reflect::get(&payload, &"session_id".into())
                    .map_err(|e| JSError::from(LLMRouterError::Validation {
                        message: "Missing session_id".to_string()
                    }))?
                    .as_string()
                    .ok_or_else(|| JSError::from(LLMRouterError::Validation {
                        message: "Session ID must be a string".to_string()
                    }))?;
                
                self.client.set_session_id(session_id);
                js_sys::Object::new().into()
            }
            "clear_session" => {
                self.client.clear_session();
                js_sys::Object::new().into()
            }
            _ => {
                return Err(JSError::from(LLMRouterError::Validation {
                    message: format!("Unknown message type: {}", message_type)
                }));
            }
        };

        // Create response object
        let response_obj = js_sys::Object::new();
        js_sys::Reflect::set(&response_obj, &"requestId".into(), &request_id.into()).unwrap();
        js_sys::Reflect::set(&response_obj, &"type".into(), &format!("{}_response", message_type).into()).unwrap();
        js_sys::Reflect::set(&response_obj, &"success".into(), &true.into()).unwrap();
        js_sys::Reflect::set(&response_obj, &"data".into(), &response).unwrap();
        js_sys::Reflect::set(&response_obj, &"timestamp".into(), &get_current_timestamp().into()).unwrap();

        Ok(response_obj.into())
    }

    /// Process streaming inference in worker
    #[wasm_bindgen(js_name = "processStreamInference")]
    pub async fn process_stream_inference(&mut self, message: &JsValue) -> Result<(), JSError> {
        let message_obj = message.dyn_ref::<js_sys::Object>()
            .ok_or_else(|| JSError::from(LLMRouterError::Validation {
                message: "Invalid message format".to_string()
            }))?;

        let request_id = js_sys::Reflect::get(message_obj, &"requestId".into())
            .ok()
            .and_then(|v| v.as_string())
            .unwrap_or_else(|| generate_uuid());

        let payload = js_sys::Reflect::get(message_obj, &"payload".into())
            .unwrap_or_else(|_| JsValue::undefined());

        let inference_request = InferenceRequest::from_object(&payload)
            .map_err(|e| JSError::from(LLMRouterError::Serialization {
                message: "Failed to parse stream inference request".to_string()
            }))?;

        let mut stream_reader = self.client.stream_inference(inference_request).await
            .map_err(|e| e)?;

        // Get global scope for posting messages
        let global = js_sys::global();
        let worker_scope = global.dyn_into::<DedicatedWorkerGlobalScope>()
            .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                message: "Not running in a worker context".to_string()
            }))?;

        // Read stream chunks and post back to main thread
        loop {
            match stream_reader.read_chunk().await {
                Ok(Some(chunk)) => {
                    let chunk_obj = js_sys::Object::new();
                    js_sys::Reflect::set(&chunk_obj, &"requestId".into(), &request_id.into()).unwrap();
                    js_sys::Reflect::set(&chunk_obj, &"type".into(), &"stream_chunk".into()).unwrap();
                    js_sys::Reflect::set(&chunk_obj, &"token".into(), &chunk.token().into()).unwrap();
                    js_sys::Reflect::set(&chunk_obj, &"isComplete".into(), &chunk.is_complete().into()).unwrap();
                    
                    if let Some(error) = chunk.error() {
                        js_sys::Reflect::set(&chunk_obj, &"error".into(), &error.into()).unwrap();
                    }
                    
                    worker_scope.post_message(&chunk_obj.into())
                        .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                            message: "Failed to post stream chunk".to_string()
                        }))?;

                    if chunk.is_complete() {
                        break;
                    }
                }
                Ok(None) => {
                    // Stream ended
                    break;
                }
                Err(e) => {
                    // Post error back to main thread
                    let error_obj = js_sys::Object::new();
                    js_sys::Reflect::set(&error_obj, &"requestId".into(), &request_id.into()).unwrap();
                    js_sys::Reflect::set(&error_obj, &"type".into(), &"stream_error".into()).unwrap();
                    js_sys::Reflect::set(&error_obj, &"error".into(), &format_error(&e)).unwrap();
                    
                    worker_scope.post_message(&error_obj.into())
                        .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                            message: "Failed to post stream error".to_string()
                        }))?;
                    break;
                }
            }
        }

        // Post stream completion
        let complete_obj = js_sys::Object::new();
        js_sys::Reflect::set(&complete_obj, &"requestId".into(), &request_id.into()).unwrap();
        js_sys::Reflect::set(&complete_obj, &"type".into(), &"stream_complete".into()).unwrap();
        
        worker_scope.post_message(&complete_obj.into())
            .map_err(|e| JSError::from(LLMRouterError::JavaScript {
                message: "Failed to post stream completion".to_string()
            }))?;

        Ok(())
    }
}

/// Worker message handler setup
#[wasm_bindgen(js_name = "setupWorkerMessageHandler")]
pub fn setup_worker_message_handler(config: RouterConfig) -> Result<(), JSError> {
    let global = js_sys::global();
    let worker_scope = global.dyn_into::<DedicatedWorkerGlobalScope>()
        .map_err(|e| JSError::from(LLMRouterError::JavaScript {
            message: "Not running in a worker context".to_string()
        }))?;

    let mut worker = LLMRouterWorker::new(config);
    
    let closure = Closure::wrap(Box::new(move |event: MessageEvent| {
        let data = event.data();
        
        // Spawn async task to handle the message
        wasm_bindgen_futures::spawn_local(async move {
            let message_type = js_sys::Reflect::get(&data, &"type".into())
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_else(|| "unknown".to_string());

            let response = if message_type == "stream_inference" {
                match worker.process_stream_inference(&data).await {
                    Ok(_) => return, // Streaming responses are handled separately
                    Err(e) => {
                        let error_obj = js_sys::Object::new();
                        js_sys::Reflect::set(&error_obj, &"success".into(), &false.into()).unwrap();
                        js_sys::Reflect::set(&error_obj, &"error".into(), &format_error(&e)).unwrap();
                        error_obj.into()
                    }
                }
            } else {
                match worker.process_message(&data).await {
                    Ok(response) => response,
                    Err(e) => {
                        let error_obj = js_sys::Object::new();
                        js_sys::Reflect::set(&error_obj, &"success".into(), &false.into()).unwrap();
                        js_sys::Reflect::set(&error_obj, &"error".into(), &format_error(&e)).unwrap();
                        error_obj.into()
                    }
                }
            };

            // Post response back to main thread
            let global = js_sys::global();
            if let Ok(worker_scope) = global.dyn_into::<DedicatedWorkerGlobalScope>() {
                let _ = worker_scope.post_message(&response);
            }
        });
    }) as Box<dyn FnMut(_)>);

    worker_scope.set_onmessage(Some(closure.as_ref().unchecked_ref()));
    closure.forget(); // Keep the closure alive

    log_with_timestamp("info", "Worker message handler setup complete");
    Ok(())
}

/// Helper to create worker script content
#[wasm_bindgen(js_name = "createWorkerScript")]
pub fn create_worker_script(wasm_url: &str, js_url: &str) -> String {
    format!(r#"
// LLM Router Worker Script
importScripts('{}');

// Initialize WASM module
async function initWorker() {{
    try {{
        await wasm_bindgen('{}');
        
        // Setup message handler
        const config = new wasm_bindgen.RouterConfig('http://localhost:3000');
        wasm_bindgen.setupWorkerMessageHandler(config);
        
        // Notify main thread that worker is ready
        self.postMessage({{
            type: 'worker_ready',
            timestamp: Date.now()
        }});
    }} catch (error) {{
        self.postMessage({{
            type: 'worker_error',
            error: error.message,
            timestamp: Date.now()
        }});
    }}
}}

initWorker();
"#, js_url, wasm_url)
}

#[wasm_bindgen(typescript_custom_section)]
const TS_WORKER_APPEND: &'static str = r#"
export interface WorkerMessage {
    type: string;
    requestId?: string;
    payload?: any;
    timestamp?: number;
}

export interface WorkerResponse {
    requestId: string;
    type: string;
    success: boolean;
    data?: any;
    error?: any;
    timestamp: number;
}

export interface StreamChunk {
    requestId: string;
    type: 'stream_chunk';
    token: string;
    isComplete: boolean;
    error?: string;
}
"#;