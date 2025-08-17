//! High-performance native core for LLM Runner Router
//!
//! This module provides optimized implementations of:
//! - Fast tokenization with SIMD optimizations
//! - Model quantization utilities (FP16, INT8, INT4)
//! - Memory-efficient tensor operations
//! - Node.js bindings via N-API

#![deny(clippy::all)]

use napi_derive::napi;

pub mod error;
pub mod tokenizer;
pub mod quantization;
pub mod tensor_ops;
pub mod memory;

// Re-exports for convenience
pub use error::{NativeError, Result};
pub use tokenizer::{FastTokenizer, TokenizerConfig};
pub use quantization::{QuantizationConfig, QuantizedModel, QuantizationType};

/// Initialize the native module
#[napi]
pub fn init_native() -> napi::Result<String> {
    // Setup logging
    tracing_subscriber::fmt::init();
    
    // Log system information
    let cpu_count = rayon::current_num_threads();
    let version = env!("CARGO_PKG_VERSION");
    
    let info = format!(
        "LLM Runner Router Native v{} initialized with {} CPU threads",
        version, cpu_count
    );
    
    tracing::info!("{}", info);
    Ok(info)
}

/// Get system information
#[napi(object)]
pub struct SystemInfo {
    pub version: String,
    pub cpu_threads: u32,
    pub simd_support: bool,
    pub memory_allocator: String,
}

#[napi]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        cpu_threads: rayon::current_num_threads() as u32,
        simd_support: is_x86_feature_detected!("avx2") || is_x86_feature_detected!("sse4.1"),
        memory_allocator: if cfg!(feature = "jemalloc") {
            "jemalloc".to_string()
        } else {
            "system".to_string()
        },
    }
}

/// Benchmark function for testing performance
#[napi]
pub async fn benchmark_tokenization(text: String, iterations: u32) -> napi::Result<f64> {
    let tokenizer = FastTokenizer::new_default().await?;
    
    let start = std::time::Instant::now();
    
    for _ in 0..iterations {
        let _ = tokenizer.encode(&text).await?;
    }
    
    let duration = start.elapsed();
    let ops_per_sec = iterations as f64 / duration.as_secs_f64();
    
    Ok(ops_per_sec)
}

/// Memory usage statistics
#[napi(object)]
pub struct MemoryStats {
    pub allocated_bytes: u64,
    pub resident_bytes: u64,
    pub peak_bytes: u64,
}

#[napi]
pub fn get_memory_stats() -> napi::Result<MemoryStats> {
    #[cfg(feature = "jemalloc")]
    {
        use jemalloc_sys::{mallctl, mallctlnametomib};
        
        let allocated = memory::get_jemalloc_stat("stats.allocated")?;
        let resident = memory::get_jemalloc_stat("stats.resident")?;
        let peak = memory::get_jemalloc_stat("stats.peak")?;
        
        Ok(MemoryStats {
            allocated_bytes: allocated,
            resident_bytes: resident,
            peak_bytes: peak,
        })
    }
    
    #[cfg(not(feature = "jemalloc"))]
    {
        // Fallback to basic memory info
        Ok(MemoryStats {
            allocated_bytes: 0,
            resident_bytes: 0,
            peak_bytes: 0,
        })
    }
}

/// Performance testing utilities
pub mod perf {
    use std::time::Instant;
    
    /// Simple performance timer
    pub struct Timer {
        start: Instant,
        name: String,
    }
    
    impl Timer {
        pub fn new(name: &str) -> Self {
            Self {
                start: Instant::now(),
                name: name.to_string(),
            }
        }
        
        pub fn elapsed_ms(&self) -> f64 {
            self.start.elapsed().as_secs_f64() * 1000.0
        }
    }
    
    impl Drop for Timer {
        fn drop(&mut self) {
            tracing::debug!("Timer [{}]: {:.2}ms", self.name, self.elapsed_ms());
        }
    }
}