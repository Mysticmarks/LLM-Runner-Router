-- Model performance and usage tracking
-- Model performance metrics table
CREATE TABLE IF NOT EXISTS model_performance (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10,2) DEFAULT 0,
    avg_tokens_per_second DECIMAL(8,2) DEFAULT 0,
    total_tokens_generated INTEGER DEFAULT 0,
    memory_usage_mb DECIMAL(10,2) DEFAULT 0,
    cost_per_request DECIMAL(12,6) DEFAULT 0,
    quality_score DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model load balancing weights
CREATE TABLE IF NOT EXISTS model_weights (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    strategy VARCHAR(50) NOT NULL, -- balanced, quality-first, cost-optimized, etc.
    weight DECIMAL(5,3) DEFAULT 1.0,
    priority INTEGER DEFAULT 0,
    health_status VARCHAR(20) DEFAULT 'healthy', -- healthy, degraded, unhealthy
    last_health_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request routing history
CREATE TABLE IF NOT EXISTS routing_history (
    id VARCHAR(36) PRIMARY KEY,
    request_id VARCHAR(36),
    user_id VARCHAR(36),
    selected_model_id VARCHAR(255),
    strategy VARCHAR(50),
    prompt_hash VARCHAR(64), -- SHA-256 of prompt for analytics
    prompt_length INTEGER,
    response_length INTEGER,
    latency_ms INTEGER,
    tokens_generated INTEGER,
    cost_usd DECIMAL(10,6),
    quality_score DECIMAL(3,2),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- A/B testing experiments
CREATE TABLE IF NOT EXISTS ab_experiments (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    control_model VARCHAR(255) NOT NULL,
    variant_models TEXT NOT NULL, -- JSON array of model IDs
    traffic_split TEXT NOT NULL, -- JSON object with model_id -> percentage
    active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    success_metric VARCHAR(100), -- latency, quality, cost, etc.
    results TEXT DEFAULT '{}', -- JSON results
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_performance_model_id ON model_performance(model_id);
CREATE INDEX IF NOT EXISTS idx_model_weights_model_id ON model_weights(model_id);
CREATE INDEX IF NOT EXISTS idx_model_weights_strategy ON model_weights(strategy);
CREATE INDEX IF NOT EXISTS idx_routing_history_user_id ON routing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_routing_history_model_id ON routing_history(selected_model_id);
CREATE INDEX IF NOT EXISTS idx_routing_history_created_at ON routing_history(created_at);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_active ON ab_experiments(active);