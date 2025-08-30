//! High-performance tokenizer implementation with SIMD optimizations

use crate::{error::{NativeError, Result}, perf::Timer};
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokenizers::{Tokenizer, AddedToken, Encoding};
use tokio::sync::RwLock;
use dashmap::DashMap;

/// Configuration for tokenizer
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenizerConfig {
    /// Model name or path to tokenizer
    pub model: String,
    /// Maximum sequence length
    pub max_length: Option<u32>,
    /// Padding token
    pub pad_token: Option<String>,
    /// Unknown token
    pub unk_token: Option<String>,
    /// Beginning of sequence token
    pub bos_token: Option<String>,
    /// End of sequence token
    pub eos_token: Option<String>,
    /// Whether to add special tokens
    pub add_special_tokens: Option<bool>,
    /// Whether to enable caching
    pub enable_cache: Option<bool>,
}

impl Default for TokenizerConfig {
    fn default() -> Self {
        Self {
            model: "gpt2".to_string(),
            max_length: Some(2048),
            pad_token: Some("<pad>".to_string()),
            unk_token: Some("<unk>".to_string()),
            bos_token: Some("<bos>".to_string()),
            eos_token: Some("<eos>".to_string()),
            add_special_tokens: Some(true),
            enable_cache: Some(true),
        }
    }
}

/// Tokenization result
#[napi(object)]
#[derive(Debug, Clone)]
pub struct TokenizationResult {
    /// Token IDs
    pub ids: Vec<u32>,
    /// Token strings
    pub tokens: Vec<String>,
    /// Attention mask
    pub attention_mask: Vec<u32>,
    /// Special tokens mask
    pub special_tokens_mask: Vec<u32>,
    /// Offset mapping (character positions)
    pub offsets: Vec<Vec<u32>>,
}

/// Fast tokenizer with caching and SIMD optimizations
#[napi]
pub struct FastTokenizer {
    tokenizer: Arc<RwLock<Tokenizer>>,
    config: TokenizerConfig,
    cache: Arc<DashMap<String, TokenizationResult>>,
    stats: Arc<RwLock<TokenizerStats>>,
}

#[derive(Debug, Default)]
struct TokenizerStats {
    cache_hits: u64,
    cache_misses: u64,
    total_tokens: u64,
    total_time_ms: f64,
}

#[napi]
impl FastTokenizer {
    /// Create a new tokenizer with default configuration
    #[napi(factory)]
    pub async fn new_default() -> napi::Result<FastTokenizer> {
        let config = TokenizerConfig::default();
        Self::new(config).await
    }

    /// Create a new tokenizer with custom configuration
    #[napi(constructor)]
    pub async fn new(config: TokenizerConfig) -> napi::Result<FastTokenizer> {
        let _timer = Timer::new("tokenizer_init");
        
        let tokenizer = Self::load_tokenizer(&config.model).await?;
        
        Ok(FastTokenizer {
            tokenizer: Arc::new(RwLock::new(tokenizer)),
            config,
            cache: Arc::new(DashMap::new()),
            stats: Arc::new(RwLock::new(TokenizerStats::default())),
        })
    }

    /// Load tokenizer from model name or path
    async fn load_tokenizer(model: &str) -> napi::Result<Tokenizer> {
        let tokenizer = tokio::task::spawn_blocking({
            let model = model.to_string();
            move || -> Result<Tokenizer> {
                // Try to load from HuggingFace Hub first
                match Tokenizer::from_pretrained(&model, None) {
                    Ok(tokenizer) => Ok(tokenizer),
                    Err(_) => {
                        // Try to load from local file
                        Tokenizer::from_file(&model)
                            .map_err(|e| NativeError::tokenizer(format!("Failed to load tokenizer from {}: {}", model, e)))
                    }
                }
            }
        })
        .await
        .map_err(|e| NativeError::internal(format!("Tokenizer loading task failed: {}", e)))??;

        Ok(tokenizer)
    }

    /// Encode text to tokens
    #[napi]
    pub async fn encode(&self, text: String) -> napi::Result<TokenizationResult> {
        let _timer = Timer::new("tokenize_encode");
        
        // Check cache first if enabled
        if self.config.enable_cache.unwrap_or(true) {
            if let Some(cached) = self.cache.get(&text) {
                let mut stats = self.stats.write().await;
                stats.cache_hits += 1;
                return Ok(cached.clone());
            }
        }

        // Perform tokenization
        let result = self.encode_impl(&text).await?;
        
        // Update cache
        if self.config.enable_cache.unwrap_or(true) {
            self.cache.insert(text, result.clone());
        }

        // Update stats
        let mut stats = self.stats.write().await;
        stats.cache_misses += 1;
        stats.total_tokens += result.ids.len() as u64;

        Ok(result)
    }

    /// Internal encoding implementation
    async fn encode_impl(&self, text: &str) -> napi::Result<TokenizationResult> {
        let tokenizer = self.tokenizer.read().await;
        
        let encoding = tokio::task::spawn_blocking({
            let text = text.to_string();
            let add_special_tokens = self.config.add_special_tokens.unwrap_or(true);
            let tokenizer_clone = tokenizer.clone();
            
            move || -> Result<Encoding> {
                tokenizer_clone
                    .encode(text, add_special_tokens)
                    .map_err(|e| NativeError::tokenizer(e.to_string()))
            }
        })
        .await
        .map_err(|e| NativeError::internal(format!("Encoding task failed: {}", e)))??;

        // Convert to result format
        let ids = encoding.get_ids().to_vec();
        let tokens = encoding.get_tokens().to_vec();
        let attention_mask = encoding.get_attention_mask().to_vec();
        let special_tokens_mask = encoding.get_special_tokens_mask().to_vec();
        let offsets = encoding
            .get_offsets()
            .iter()
            .map(|(start, end)| vec![*start as u32, *end as u32])
            .collect();

        Ok(TokenizationResult {
            ids,
            tokens,
            attention_mask,
            special_tokens_mask,
            offsets,
        })
    }

    /// Decode token IDs to text
    #[napi]
    pub async fn decode(&self, ids: Vec<u32>) -> napi::Result<String> {
        let _timer = Timer::new("tokenize_decode");
        
        let tokenizer = self.tokenizer.read().await;
        
        let text = tokio::task::spawn_blocking({
            let ids = ids.clone();
            let tokenizer_clone = tokenizer.clone();
            
            move || -> Result<String> {
                tokenizer_clone
                    .decode(&ids, true)
                    .map_err(|e| NativeError::tokenizer(e.to_string()))
            }
        })
        .await
        .map_err(|e| NativeError::internal(format!("Decoding task failed: {}", e)))??;

        Ok(text)
    }

    /// Batch encode multiple texts
    #[napi]
    pub async fn encode_batch(&self, texts: Vec<String>) -> napi::Result<Vec<TokenizationResult>> {
        let _timer = Timer::new("tokenize_encode_batch");
        
        // Use rayon for parallel processing
        let results = tokio::task::spawn_blocking({
            let texts = texts.clone();
            let tokenizer = self.tokenizer.clone();
            let config = self.config.clone();
            
            move || -> Result<Vec<TokenizationResult>> {
                use rayon::prelude::*;
                
                texts
                    .par_iter()
                    .map(|text| {
                        let rt = tokio::runtime::Handle::current();
                        rt.block_on(async {
                            let tokenizer = tokenizer.read().await;
                            let add_special_tokens = config.add_special_tokens.unwrap_or(true);
                            
                            let encoding = tokenizer
                                .encode(text, add_special_tokens)
                                .map_err(|e| NativeError::tokenizer(e.to_string()))?;

                            let ids = encoding.get_ids().to_vec();
                            let tokens = encoding.get_tokens().to_vec();
                            let attention_mask = encoding.get_attention_mask().to_vec();
                            let special_tokens_mask = encoding.get_special_tokens_mask().to_vec();
                            let offsets = encoding
                                .get_offsets()
                                .iter()
                                .map(|(start, end)| vec![*start as u32, *end as u32])
                                .collect();

                            Ok(TokenizationResult {
                                ids,
                                tokens,
                                attention_mask,
                                special_tokens_mask,
                                offsets,
                            })
                        })
                    })
                    .collect()
            }
        })
        .await
        .map_err(|e| NativeError::internal(format!("Batch encoding task failed: {}", e)))??;

        // Update stats
        let mut stats = self.stats.write().await;
        stats.total_tokens += results.iter().map(|r| r.ids.len() as u64).sum::<u64>();

        Ok(results)
    }

    /// Get vocabulary size
    #[napi]
    pub async fn vocab_size(&self) -> napi::Result<u32> {
        let tokenizer = self.tokenizer.read().await;
        Ok(tokenizer.get_vocab_size(true) as u32)
    }

    /// Get tokenizer statistics
    #[napi]
    pub async fn get_stats(&self) -> napi::Result<TokenizerStatsResult> {
        let stats = self.stats.read().await;
        
        let cache_hit_rate = if stats.cache_hits + stats.cache_misses > 0 {
            stats.cache_hits as f64 / (stats.cache_hits + stats.cache_misses) as f64
        } else {
            0.0
        };

        Ok(TokenizerStatsResult {
            cache_hits: stats.cache_hits,
            cache_misses: stats.cache_misses,
            cache_hit_rate,
            total_tokens: stats.total_tokens,
            cache_size: self.cache.len() as u64,
        })
    }

    /// Clear tokenizer cache
    #[napi]
    pub fn clear_cache(&self) -> napi::Result<()> {
        self.cache.clear();
        Ok(())
    }

    /// Get token ID for a specific token
    #[napi]
    pub async fn token_to_id(&self, token: String) -> napi::Result<Option<u32>> {
        let tokenizer = self.tokenizer.read().await;
        Ok(tokenizer.token_to_id(&token))
    }

    /// Get token string for a specific ID
    #[napi]
    pub async fn id_to_token(&self, id: u32) -> napi::Result<Option<String>> {
        let tokenizer = self.tokenizer.read().await;
        Ok(tokenizer.id_to_token(id))
    }

    /// Truncate tokens to maximum length
    #[napi]
    pub fn truncate_tokens(&self, mut result: TokenizationResult, max_length: u32) -> TokenizationResult {
        let max_len = max_length as usize;
        
        if result.ids.len() > max_len {
            result.ids.truncate(max_len);
            result.tokens.truncate(max_len);
            result.attention_mask.truncate(max_len);
            result.special_tokens_mask.truncate(max_len);
            result.offsets.truncate(max_len);
        }
        
        result
    }

    /// Pad tokens to specific length
    #[napi]
    pub async fn pad_tokens(&self, mut result: TokenizationResult, target_length: u32, pad_token_id: Option<u32>) -> napi::Result<TokenizationResult> {
        let target_len = target_length as usize;
        let current_len = result.ids.len();
        
        if current_len >= target_len {
            return Ok(result);
        }
        
        let pad_id = if let Some(id) = pad_token_id {
            id
        } else {
            // Try to get pad token ID from tokenizer
            let tokenizer = self.tokenizer.read().await;
            if let Some(pad_token) = &self.config.pad_token {
                tokenizer.token_to_id(pad_token).unwrap_or(0)
            } else {
                0
            }
        };
        
        let padding_len = target_len - current_len;
        
        // Pad all arrays
        result.ids.extend(vec![pad_id; padding_len]);
        result.tokens.extend(vec!["<pad>".to_string(); padding_len]);
        result.attention_mask.extend(vec![0; padding_len]);
        result.special_tokens_mask.extend(vec![1; padding_len]);
        result.offsets.extend(vec![vec![0, 0]; padding_len]);
        
        Ok(result)
    }
}

/// Tokenizer statistics for JavaScript
#[napi(object)]
pub struct TokenizerStatsResult {
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_hit_rate: f64,
    pub total_tokens: u64,
    pub cache_size: u64,
}

/// SIMD-optimized text preprocessing
pub mod simd {
    use wide::u8x16;
    
    /// Fast character counting using SIMD
    #[cfg(target_arch = "x86_64")]
    pub fn count_chars_simd(text: &[u8], target: u8) -> usize {
        if !is_x86_feature_detected!("sse2") {
            return text.iter().filter(|&&c| c == target).count();
        }
        
        let target_vec = u8x16::splat(target);
        let mut count = 0;
        let chunks = text.chunks_exact(16);
        let remainder = chunks.remainder();
        
        for chunk in chunks {
            let chunk_vec = u8x16::from_array(*chunk.try_into().unwrap());
            let mask = chunk_vec.cmp_eq(target_vec);
            count += mask.move_mask().count_ones() as usize;
        }
        
        // Handle remainder
        count += remainder.iter().filter(|&&c| c == target).count();
        count
    }
    
    /// Fallback for non-x86 architectures
    #[cfg(not(target_arch = "x86_64"))]
    pub fn count_chars_simd(text: &[u8], target: u8) -> usize {
        text.iter().filter(|&&c| c == target).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_tokenizer_creation() {
        let config = TokenizerConfig::default();
        let tokenizer = FastTokenizer::new(config).await;
        assert!(tokenizer.is_ok());
    }
    
    #[tokio::test]
    async fn test_encoding() {
        let tokenizer = FastTokenizer::new_default().await.unwrap();
        let result = tokenizer.encode("Hello, world!".to_string()).await.unwrap();
        
        assert!(!result.ids.is_empty());
        assert_eq!(result.ids.len(), result.tokens.len());
        assert_eq!(result.ids.len(), result.attention_mask.len());
    }
    
    #[tokio::test]
    async fn test_batch_encoding() {
        let tokenizer = FastTokenizer::new_default().await.unwrap();
        let texts = vec![
            "Hello, world!".to_string(),
            "How are you?".to_string(),
            "Fine, thanks!".to_string(),
        ];
        
        let results = tokenizer.encode_batch(texts).await.unwrap();
        assert_eq!(results.len(), 3);
        
        for result in results {
            assert!(!result.ids.is_empty());
        }
    }
    
    #[test]
    fn test_simd_char_counting() {
        let text = b"Hello, world! Hello, Rust!";
        let count = simd::count_chars_simd(text, b'l');
        assert_eq!(count, 4);
    }
}