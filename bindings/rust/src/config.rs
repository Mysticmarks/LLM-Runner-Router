//! Configuration for the LLM Router client

use crate::error::{LLMRouterError, Result};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;

/// Configuration for the router client
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RouterConfig {
    /// Base URL for HTTP REST API
    pub base_url: String,
    /// gRPC server URL
    pub grpc_url: Option<String>,
    /// WebSocket URL
    pub websocket_url: Option<String>,
    /// Request timeout
    pub timeout: Duration,
    /// Maximum number of retries
    pub max_retries: u32,
    /// Base retry delay
    pub retry_delay: Duration,
    /// API key for authentication
    pub api_key: Option<String>,
    /// User agent string
    pub user_agent: String,
    /// Connection pool settings
    pub connection_pool: ConnectionPoolConfig,
    /// Rate limiting settings
    pub rate_limit: RateLimitConfig,
    /// TLS settings
    pub tls: TlsConfig,
}

/// Connection pool configuration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConnectionPoolConfig {
    /// Maximum number of idle connections
    pub max_idle_connections: usize,
    /// Maximum number of connections per host
    pub max_connections_per_host: usize,
    /// Connection idle timeout
    pub idle_timeout: Duration,
    /// Connection timeout
    pub connect_timeout: Duration,
}

/// Rate limiting configuration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Maximum requests per minute
    pub requests_per_minute: u32,
    /// Burst capacity
    pub burst_capacity: u32,
    /// Enable rate limiting
    pub enabled: bool,
}

/// TLS configuration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TlsConfig {
    /// Verify SSL certificates
    pub verify_ssl: bool,
    /// Custom CA certificate path
    pub ca_cert_path: Option<String>,
    /// Client certificate path
    pub client_cert_path: Option<String>,
    /// Client private key path
    pub client_key_path: Option<String>,
}

impl Default for RouterConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:3000".to_string(),
            grpc_url: Some("http://localhost:50051".to_string()),
            websocket_url: None, // Will be derived from base_url
            timeout: Duration::from_secs(30),
            max_retries: 3,
            retry_delay: Duration::from_secs(1),
            api_key: None,
            user_agent: format!("llm-runner-router-rust/{}", env!("CARGO_PKG_VERSION")),
            connection_pool: ConnectionPoolConfig::default(),
            rate_limit: RateLimitConfig::default(),
            tls: TlsConfig::default(),
        }
    }
}

impl Default for ConnectionPoolConfig {
    fn default() -> Self {
        Self {
            max_idle_connections: 10,
            max_connections_per_host: 20,
            idle_timeout: Duration::from_secs(90),
            connect_timeout: Duration::from_secs(10),
        }
    }
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_minute: 100,
            burst_capacity: 10,
            enabled: true,
        }
    }
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            verify_ssl: true,
            ca_cert_path: None,
            client_cert_path: None,
            client_key_path: None,
        }
    }
}

impl RouterConfig {
    /// Create a new configuration with the given base URL
    pub fn new(base_url: impl Into<String>) -> Self {
        let base_url = base_url.into();
        let mut config = Self::default();
        config.base_url = base_url;
        config
    }

    /// Set the base URL
    pub fn base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    /// Set the gRPC URL
    pub fn grpc_url(mut self, grpc_url: impl Into<String>) -> Self {
        self.grpc_url = Some(grpc_url.into());
        self
    }

    /// Set the WebSocket URL
    pub fn websocket_url(mut self, websocket_url: impl Into<String>) -> Self {
        self.websocket_url = Some(websocket_url.into());
        self
    }

    /// Set the request timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set the maximum number of retries
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set the retry delay
    pub fn retry_delay(mut self, retry_delay: Duration) -> Self {
        self.retry_delay = retry_delay;
        self
    }

    /// Set the API key
    pub fn api_key(mut self, api_key: impl Into<String>) -> Self {
        self.api_key = Some(api_key.into());
        self
    }

    /// Set the user agent
    pub fn user_agent(mut self, user_agent: impl Into<String>) -> Self {
        self.user_agent = user_agent.into();
        self
    }

    /// Set connection pool configuration
    pub fn connection_pool(mut self, config: ConnectionPoolConfig) -> Self {
        self.connection_pool = config;
        self
    }

    /// Set rate limit configuration
    pub fn rate_limit(mut self, config: RateLimitConfig) -> Self {
        self.rate_limit = config;
        self
    }

    /// Set TLS configuration
    pub fn tls(mut self, config: TlsConfig) -> Self {
        self.tls = config;
        self
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<()> {
        // Validate base URL
        Url::parse(&self.base_url)
            .map_err(|e| LLMRouterError::configuration(format!("Invalid base URL: {}", e)))?;

        // Validate gRPC URL if provided
        if let Some(ref grpc_url) = self.grpc_url {
            if grpc_url.contains("://") {
                Url::parse(grpc_url)
                    .map_err(|e| LLMRouterError::configuration(format!("Invalid gRPC URL: {}", e)))?;
            }
            // If no scheme, assume it's just host:port
        }

        // Validate WebSocket URL if provided
        if let Some(ref ws_url) = self.websocket_url {
            Url::parse(ws_url)
                .map_err(|e| LLMRouterError::configuration(format!("Invalid WebSocket URL: {}", e)))?;
        }

        // Validate timeout
        if self.timeout.as_secs() == 0 {
            return Err(LLMRouterError::configuration("Timeout must be greater than 0"));
        }

        // Validate connection pool settings
        if self.connection_pool.max_connections_per_host == 0 {
            return Err(LLMRouterError::configuration(
                "Max connections per host must be greater than 0",
            ));
        }

        Ok(())
    }

    /// Get the WebSocket URL, deriving from base URL if not set
    pub fn get_websocket_url(&self) -> String {
        if let Some(ref ws_url) = self.websocket_url {
            ws_url.clone()
        } else {
            // Derive from base URL
            self.base_url
                .replace("http://", "ws://")
                .replace("https://", "wss://")
                + "/ws"
        }
    }

    /// Get the gRPC URL
    pub fn get_grpc_url(&self) -> Option<&str> {
        self.grpc_url.as_deref()
    }

    /// Check if TLS is enabled for the base URL
    pub fn is_tls_enabled(&self) -> bool {
        self.base_url.starts_with("https://")
    }

    /// Get authentication headers
    pub fn get_auth_headers(&self) -> Vec<(String, String)> {
        let mut headers = Vec::new();
        
        if let Some(ref api_key) = self.api_key {
            headers.push(("Authorization".to_string(), format!("Bearer {}", api_key)));
        }
        
        headers.push(("User-Agent".to_string(), self.user_agent.clone()));
        
        headers
    }

    /// Create configuration from environment variables
    pub fn from_env() -> Result<Self> {
        let mut config = Self::default();

        if let Ok(base_url) = std::env::var("LLM_ROUTER_BASE_URL") {
            config.base_url = base_url;
        }

        if let Ok(grpc_url) = std::env::var("LLM_ROUTER_GRPC_URL") {
            config.grpc_url = Some(grpc_url);
        }

        if let Ok(ws_url) = std::env::var("LLM_ROUTER_WEBSOCKET_URL") {
            config.websocket_url = Some(ws_url);
        }

        if let Ok(api_key) = std::env::var("LLM_ROUTER_API_KEY") {
            config.api_key = Some(api_key);
        }

        if let Ok(timeout_str) = std::env::var("LLM_ROUTER_TIMEOUT") {
            if let Ok(timeout_secs) = timeout_str.parse::<u64>() {
                config.timeout = Duration::from_secs(timeout_secs);
            }
        }

        if let Ok(retries_str) = std::env::var("LLM_ROUTER_MAX_RETRIES") {
            if let Ok(retries) = retries_str.parse::<u32>() {
                config.max_retries = retries;
            }
        }

        if let Ok(verify_ssl_str) = std::env::var("LLM_ROUTER_VERIFY_SSL") {
            config.tls.verify_ssl = verify_ssl_str.to_lowercase() != "false";
        }

        config.validate()?;
        Ok(config)
    }

    /// Load configuration from a file
    pub fn from_file(path: impl AsRef<std::path::Path>) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| LLMRouterError::configuration(format!("Failed to read config file: {}", e)))?;
        
        let config: RouterConfig = toml::from_str(&content)
            .map_err(|e| LLMRouterError::configuration(format!("Failed to parse config file: {}", e)))?;
        
        config.validate()?;
        Ok(config)
    }

    /// Save configuration to a file
    pub fn save_to_file(&self, path: impl AsRef<std::path::Path>) -> Result<()> {
        let content = toml::to_string_pretty(self)
            .map_err(|e| LLMRouterError::configuration(format!("Failed to serialize config: {}", e)))?;
        
        std::fs::write(path, content)
            .map_err(|e| LLMRouterError::configuration(format!("Failed to write config file: {}", e)))?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = RouterConfig::default();
        assert_eq!(config.base_url, "http://localhost:3000");
        assert_eq!(config.timeout, Duration::from_secs(30));
        assert_eq!(config.max_retries, 3);
    }

    #[test]
    fn test_config_builder() {
        let config = RouterConfig::new("http://example.com:8080")
            .timeout(Duration::from_secs(60))
            .max_retries(5)
            .api_key("test-key");

        assert_eq!(config.base_url, "http://example.com:8080");
        assert_eq!(config.timeout, Duration::from_secs(60));
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.api_key, Some("test-key".to_string()));
    }

    #[test]
    fn test_websocket_url_derivation() {
        let config = RouterConfig::new("http://example.com:3000");
        assert_eq!(config.get_websocket_url(), "ws://example.com:3000/ws");

        let config = RouterConfig::new("https://example.com:3000");
        assert_eq!(config.get_websocket_url(), "wss://example.com:3000/ws");
    }

    #[test]
    fn test_tls_detection() {
        let config = RouterConfig::new("http://example.com");
        assert!(!config.is_tls_enabled());

        let config = RouterConfig::new("https://example.com");
        assert!(config.is_tls_enabled());
    }

    #[test]
    fn test_auth_headers() {
        let config = RouterConfig::new("http://example.com").api_key("test-key");
        let headers = config.get_auth_headers();
        
        assert!(headers.iter().any(|(k, v)| k == "Authorization" && v == "Bearer test-key"));
        assert!(headers.iter().any(|(k, _)| k == "User-Agent"));
    }

    #[test]
    fn test_config_validation() {
        // Valid config
        let config = RouterConfig::new("http://example.com");
        assert!(config.validate().is_ok());

        // Invalid URL
        let config = RouterConfig::new("not-a-url");
        assert!(config.validate().is_err());

        // Zero timeout
        let mut config = RouterConfig::new("http://example.com");
        config.timeout = Duration::from_secs(0);
        assert!(config.validate().is_err());
    }
}