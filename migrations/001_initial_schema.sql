-- Initial schema for LLM Router
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    permissions TEXT DEFAULT '[]',
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Refresh tokens table  
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login attempts tracking
CREATE TABLE IF NOT EXISTS login_attempts (
    id VARCHAR(36) PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- username or email
    ip_address VARCHAR(45),
    success BOOLEAN DEFAULT false,
    user_agent TEXT,
    locked_until TIMESTAMP NULL,
    attempt_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tenants table (for multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) UNIQUE,
    settings TEXT DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    plan VARCHAR(50) DEFAULT 'basic',
    usage_limits TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Models registry table
CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    format VARCHAR(50),
    size_gb DECIMAL(10,2),
    context_window INTEGER,
    max_output INTEGER,
    cost_per_input_token DECIMAL(10,8),
    cost_per_output_token DECIMAL(10,8),
    capabilities TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache table  
CREATE TABLE IF NOT EXISTS cache (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value DECIMAL(15,6) NOT NULL,
    labels TEXT DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_active ON models(active);
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);