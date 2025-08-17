//! Retry utilities with exponential backoff

use crate::error::{LLMRouterError, Result};
use std::{future::Future, time::Duration};
use tokio::time::sleep;
use tracing::{debug, warn};

/// Retry a future with exponential backoff
pub async fn retry_with_backoff<F, Fut, T>(
    mut operation: F,
    max_retries: u32,
    base_delay: Duration,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut last_error = None;
    
    for attempt in 0..=max_retries {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(err) => {
                if attempt == max_retries {
                    // Last attempt failed
                    return Err(err);
                }
                
                if !err.is_retryable() {
                    // Error is not retryable
                    return Err(err);
                }
                
                let delay = calculate_backoff_delay(attempt, base_delay, &err);
                warn!(
                    "Operation failed (attempt {}/{}): {}. Retrying in {:?}",
                    attempt + 1,
                    max_retries + 1,
                    err,
                    delay
                );
                
                sleep(delay).await;
                last_error = Some(err);
            }
        }
    }
    
    // This should never be reached due to the logic above,
    // but we need to return something for the compiler
    Err(last_error.unwrap_or_else(|| {
        LLMRouterError::other("Retry loop completed without result", None::<std::io::Error>)
    }))
}

/// Calculate the delay for the next retry attempt
fn calculate_backoff_delay(attempt: u32, base_delay: Duration, error: &LLMRouterError) -> Duration {
    // Check if the error suggests a specific retry delay
    if let Some(retry_delay) = error.retry_delay() {
        return retry_delay;
    }
    
    // Exponential backoff: base_delay * 2^attempt with jitter
    let exponential_delay = base_delay * 2_u32.pow(attempt);
    
    // Cap the delay at 60 seconds
    let capped_delay = exponential_delay.min(Duration::from_secs(60));
    
    // Add jitter (±25% of the delay)
    let jitter_range = capped_delay.as_millis() / 4;
    let jitter = fastrand::u64(0..=jitter_range as u64 * 2) as i64 - jitter_range as i64;
    let jittered_delay = (capped_delay.as_millis() as i64 + jitter).max(0) as u64;
    
    Duration::from_millis(jittered_delay)
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Base delay between retries
    pub base_delay: Duration,
    /// Maximum delay between retries
    pub max_delay: Duration,
    /// Backoff multiplier
    pub backoff_multiplier: f64,
    /// Whether to add jitter to delays
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            base_delay: Duration::from_millis(1000),
            max_delay: Duration::from_secs(60),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

impl RetryConfig {
    /// Create a new retry configuration
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set the maximum number of retries
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }
    
    /// Set the base delay
    pub fn base_delay(mut self, base_delay: Duration) -> Self {
        self.base_delay = base_delay;
        self
    }
    
    /// Set the maximum delay
    pub fn max_delay(mut self, max_delay: Duration) -> Self {
        self.max_delay = max_delay;
        self
    }
    
    /// Set the backoff multiplier
    pub fn backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }
    
    /// Enable or disable jitter
    pub fn jitter(mut self, jitter: bool) -> Self {
        self.jitter = jitter;
        self
    }
    
    /// Calculate the delay for a given attempt
    pub fn calculate_delay(&self, attempt: u32, error: Option<&LLMRouterError>) -> Duration {
        // Check if the error suggests a specific retry delay
        if let Some(error) = error {
            if let Some(retry_delay) = error.retry_delay() {
                return retry_delay.min(self.max_delay);
            }
        }
        
        // Calculate exponential backoff
        let multiplier = self.backoff_multiplier.powi(attempt as i32);
        let delay_ms = (self.base_delay.as_millis() as f64 * multiplier) as u64;
        let mut delay = Duration::from_millis(delay_ms).min(self.max_delay);
        
        // Add jitter if enabled
        if self.jitter {
            let jitter_range = delay.as_millis() / 4;
            let jitter = fastrand::u64(0..=jitter_range as u64 * 2) as i64 - jitter_range as i64;
            let jittered_delay = (delay.as_millis() as i64 + jitter).max(0) as u64;
            delay = Duration::from_millis(jittered_delay);
        }
        
        delay
    }
}

/// Retry a future with custom configuration
pub async fn retry_with_config<F, Fut, T>(
    mut operation: F,
    config: &RetryConfig,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut last_error = None;
    
    for attempt in 0..=config.max_retries {
        match operation().await {
            Ok(result) => {
                if attempt > 0 {
                    debug!("Operation succeeded after {} retries", attempt);
                }
                return Ok(result);
            }
            Err(err) => {
                if attempt == config.max_retries {
                    return Err(err);
                }
                
                if !err.is_retryable() {
                    return Err(err);
                }
                
                let delay = config.calculate_delay(attempt, Some(&err));
                warn!(
                    "Operation failed (attempt {}/{}): {}. Retrying in {:?}",
                    attempt + 1,
                    config.max_retries + 1,
                    err,
                    delay
                );
                
                sleep(delay).await;
                last_error = Some(err);
            }
        }
    }
    
    Err(last_error.unwrap_or_else(|| {
        LLMRouterError::other("Retry loop completed without result", None::<std::io::Error>)
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_retry_success() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = retry_with_backoff(
            move || {
                let counter = counter_clone.clone();
                async move {
                    let count = counter.fetch_add(1, Ordering::SeqCst);
                    if count < 2 {
                        Err(LLMRouterError::network("Temporary failure", None::<std::io::Error>))
                    } else {
                        Ok("Success")
                    }
                }
            },
            3,
            Duration::from_millis(10),
        ).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Success");
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_retry_failure() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = retry_with_backoff(
            move || {
                let counter = counter_clone.clone();
                async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                    Err::<&str, _>(LLMRouterError::network("Persistent failure", None::<std::io::Error>))
                }
            },
            2,
            Duration::from_millis(10),
        ).await;
        
        assert!(result.is_err());
        assert_eq!(counter.load(Ordering::SeqCst), 3); // Initial + 2 retries
    }

    #[tokio::test]
    async fn test_non_retryable_error() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = retry_with_backoff(
            move || {
                let counter = counter_clone.clone();
                async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                    Err::<&str, _>(LLMRouterError::validation("Invalid input", None))
                }
            },
            3,
            Duration::from_millis(10),
        ).await;
        
        assert!(result.is_err());
        assert_eq!(counter.load(Ordering::SeqCst), 1); // No retries for validation errors
    }

    #[test]
    fn test_retry_config() {
        let config = RetryConfig::new()
            .max_retries(5)
            .base_delay(Duration::from_millis(500))
            .max_delay(Duration::from_secs(30))
            .backoff_multiplier(1.5)
            .jitter(false);
        
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.base_delay, Duration::from_millis(500));
        assert_eq!(config.max_delay, Duration::from_secs(30));
        assert_eq!(config.backoff_multiplier, 1.5);
        assert!(!config.jitter);
    }

    #[test]
    fn test_backoff_delay_calculation() {
        let config = RetryConfig::new()
            .base_delay(Duration::from_millis(100))
            .backoff_multiplier(2.0)
            .jitter(false);
        
        let delay0 = config.calculate_delay(0, None);
        let delay1 = config.calculate_delay(1, None);
        let delay2 = config.calculate_delay(2, None);
        
        assert_eq!(delay0, Duration::from_millis(100));
        assert_eq!(delay1, Duration::from_millis(200));
        assert_eq!(delay2, Duration::from_millis(400));
    }
}