//! Utility functions for WASM bindings

use wasm_bindgen::prelude::*;
use crate::error::{LLMRouterError, JSError};

/// Generate a random UUID v4
#[wasm_bindgen(js_name = "generateUuid")]
pub fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Get current timestamp in milliseconds
#[wasm_bindgen(js_name = "getCurrentTimestamp")]
pub fn get_current_timestamp() -> f64 {
    js_sys::Date::now()
}

/// Sleep for specified milliseconds
#[wasm_bindgen(js_name = "sleep")]
pub async fn sleep(ms: u32) -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let window = web_sys::window().unwrap();
        let closure = Closure::once_into_js(move || {
            resolve.call0(&JsValue::undefined()).unwrap();
        });
        
        window.set_timeout_with_callback_and_timeout_and_arguments_0(
            closure.as_ref().unchecked_ref(),
            ms as i32,
        ).unwrap();
    });
    
    wasm_bindgen_futures::JsFuture::from(promise).await?;
    Ok(())
}

/// Retry function with exponential backoff
#[wasm_bindgen(js_name = "retryWithBackoff")]
pub async fn retry_with_backoff(
    callback: &js_sys::Function,
    max_retries: u32,
    base_delay_ms: u32,
) -> Result<JsValue, JSError> {
    let mut last_error = None;
    
    for attempt in 0..=max_retries {
        // Call the callback function
        let result = callback.call0(&JsValue::undefined());
        
        match result {
            Ok(value) => {
                // Check if it's a promise
                if let Some(promise) = value.dyn_ref::<js_sys::Promise>() {
                    match wasm_bindgen_futures::JsFuture::from(promise.clone()).await {
                        Ok(resolved_value) => return Ok(resolved_value),
                        Err(error) => {
                            if attempt == max_retries {
                                return Err(JSError::from(LLMRouterError::from(error)));
                            }
                            last_error = Some(error);
                        }
                    }
                } else {
                    return Ok(value);
                }
            }
            Err(error) => {
                if attempt == max_retries {
                    return Err(JSError::from(LLMRouterError::from(error)));
                }
                last_error = Some(error);
            }
        }
        
        // Calculate delay with exponential backoff
        let delay = base_delay_ms * 2_u32.pow(attempt);
        let max_delay = 60000; // 60 seconds max
        let actual_delay = delay.min(max_delay);
        
        // Add jitter (±25%)
        let jitter_range = actual_delay / 4;
        let jitter = (js_sys::Math::random() * (jitter_range * 2) as f64) as u32;
        let final_delay = if jitter > jitter_range {
            actual_delay + (jitter - jitter_range)
        } else {
            actual_delay.saturating_sub(jitter_range - jitter)
        };
        
        sleep(final_delay).await.unwrap();
    }
    
    // This should never be reached, but just in case
    Err(JSError::from(LLMRouterError::Other {
        message: "Retry loop completed without result".to_string(),
    }))
}

/// Check if running in a Web Worker
#[wasm_bindgen(js_name = "isWebWorker")]
pub fn is_web_worker() -> bool {
    js_sys::global()
        .dyn_into::<web_sys::DedicatedWorkerGlobalScope>()
        .is_ok()
}

/// Check if running in a browser
#[wasm_bindgen(js_name = "isBrowser")]
pub fn is_browser() -> bool {
    web_sys::window().is_some()
}

/// Get environment information
#[wasm_bindgen(js_name = "getEnvironmentInfo")]
pub fn get_environment_info() -> JsValue {
    let env_info = js_sys::Object::new();
    
    // Environment type
    let env_type = if is_browser() {
        "browser"
    } else if is_web_worker() {
        "webworker"
    } else {
        "unknown"
    };
    
    js_sys::Reflect::set(
        &env_info,
        &"type".into(),
        &env_type.into()
    ).unwrap();
    
    // User agent (if available)
    if let Some(window) = web_sys::window() {
        if let Some(navigator) = window.navigator() {
            js_sys::Reflect::set(
                &env_info,
                &"userAgent".into(),
                &navigator.user_agent().unwrap_or_else(|_| "unknown".to_string()).into()
            ).unwrap();
        }
    }
    
    // WASM support info
    js_sys::Reflect::set(
        &env_info,
        &"wasmSupported".into(),
        &true.into()
    ).unwrap();
    
    // Library version
    js_sys::Reflect::set(
        &env_info,
        &"version".into(),
        &env!("CARGO_PKG_VERSION").into()
    ).unwrap();
    
    env_info.into()
}

/// Parse URL parameters
#[wasm_bindgen(js_name = "parseUrlParams")]
pub fn parse_url_params(url: &str) -> Result<JsValue, JSError> {
    let parsed_url = web_sys::Url::new(url)
        .map_err(|e| JSError::from(LLMRouterError::Validation {
            message: "Invalid URL".to_string()
        }))?;
    
    let search_params = parsed_url.search_params();
    let params_obj = js_sys::Object::new();
    
    // Convert URLSearchParams to object
    let entries = js_sys::Array::from(&search_params);
    for i in 0..entries.length() {
        if let Some(entry) = entries.get(i).dyn_ref::<js_sys::Array>() {
            if entry.length() >= 2 {
                let key = entry.get(0);
                let value = entry.get(1);
                js_sys::Reflect::set(&params_obj, &key, &value).unwrap();
            }
        }
    }
    
    Ok(params_obj.into())
}

/// Format error for JavaScript consumption
#[wasm_bindgen(js_name = "formatError")]
pub fn format_error(error: &JSError) -> JsValue {
    let error_obj = js_sys::Object::new();
    
    js_sys::Reflect::set(
        &error_obj,
        &"type".into(),
        &error.error_type().into()
    ).unwrap();
    
    js_sys::Reflect::set(
        &error_obj,
        &"message".into(),
        &error.message().into()
    ).unwrap();
    
    js_sys::Reflect::set(
        &error_obj,
        &"retryable".into(),
        &error.retryable().into()
    ).unwrap();
    
    if let Some(retry_delay) = error.retry_delay_ms() {
        js_sys::Reflect::set(
            &error_obj,
            &"retryDelayMs".into(),
            &retry_delay.into()
        ).unwrap();
    }
    
    js_sys::Reflect::set(
        &error_obj,
        &"timestamp".into(),
        &get_current_timestamp().into()
    ).unwrap();
    
    error_obj.into()
}

/// Log message to console with timestamp
#[wasm_bindgen(js_name = "logWithTimestamp")]
pub fn log_with_timestamp(level: &str, message: &str) {
    let timestamp = js_sys::Date::new_0().to_iso_string();
    let formatted_message = format!("[{}] [{}] {}", timestamp.as_string().unwrap(), level, message);
    
    match level.to_lowercase().as_str() {
        "error" => web_sys::console::error_1(&formatted_message.into()),
        "warn" => web_sys::console::warn_1(&formatted_message.into()),
        "info" => web_sys::console::info_1(&formatted_message.into()),
        "debug" => web_sys::console::debug_1(&formatted_message.into()),
        _ => web_sys::console::log_1(&formatted_message.into()),
    }
}

/// Performance measurement utility
#[wasm_bindgen(js_name = "measurePerformance")]
pub fn measure_performance(name: &str) -> PerformanceMeasure {
    PerformanceMeasure::new(name)
}

/// Performance measurement helper
#[wasm_bindgen]
pub struct PerformanceMeasure {
    name: String,
    start_time: f64,
}

#[wasm_bindgen]
impl PerformanceMeasure {
    fn new(name: &str) -> Self {
        let start_time = if let Some(window) = web_sys::window() {
            window.performance().unwrap().now()
        } else {
            get_current_timestamp()
        };
        
        PerformanceMeasure {
            name: name.to_string(),
            start_time,
        }
    }
    
    /// End the measurement and return duration in milliseconds
    #[wasm_bindgen(js_name = "end")]
    pub fn end(&self) -> f64 {
        let end_time = if let Some(window) = web_sys::window() {
            window.performance().unwrap().now()
        } else {
            get_current_timestamp()
        };
        
        let duration = end_time - self.start_time;
        log_with_timestamp("debug", &format!("Performance [{}]: {:.2}ms", self.name, duration));
        duration
    }
    
    /// Get the elapsed time without ending the measurement
    #[wasm_bindgen(js_name = "elapsed")]
    pub fn elapsed(&self) -> f64 {
        let current_time = if let Some(window) = web_sys::window() {
            window.performance().unwrap().now()
        } else {
            get_current_timestamp()
        };
        
        current_time - self.start_time
    }
}

/// Validate configuration
#[wasm_bindgen(js_name = "validateConfig")]
pub fn validate_config(config: &RouterConfig) -> Result<(), JSError> {
    // Validate base URL
    web_sys::Url::new(&config.base_url)
        .map_err(|e| JSError::from(LLMRouterError::Validation {
            message: "Invalid base URL".to_string()
        }))?;
    
    // Validate timeout
    if config.timeout_ms == 0 {
        return Err(JSError::from(LLMRouterError::Validation {
            message: "Timeout must be greater than 0".to_string()
        }));
    }
    
    // Validate max retries
    if config.max_retries > 10 {
        return Err(JSError::from(LLMRouterError::Validation {
            message: "Max retries should not exceed 10".to_string()
        }));
    }
    
    Ok(())
}