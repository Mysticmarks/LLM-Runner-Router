-- Monitoring, alerting, and observability features

-- Alert configurations
CREATE TABLE IF NOT EXISTS alert_configs (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(20) NOT NULL, -- gt, gte, lt, lte, eq, ne
    threshold_value DECIMAL(15,6) NOT NULL,
    time_window_minutes INTEGER DEFAULT 5,
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    enabled BOOLEAN DEFAULT true,
    notification_channels TEXT DEFAULT '[]', -- JSON array of channel IDs
    cooldown_minutes INTEGER DEFAULT 30, -- Prevent spam
    last_triggered TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert incidents
CREATE TABLE IF NOT EXISTS alert_incidents (
    id VARCHAR(36) PRIMARY KEY,
    alert_config_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, acknowledged, resolved
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    triggered_by VARCHAR(255), -- user or system
    acknowledged_by VARCHAR(255),
    resolved_by VARCHAR(255),
    metric_value DECIMAL(15,6),
    threshold_value DECIMAL(15,6),
    context TEXT DEFAULT '{}', -- JSON context data
    notifications_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_config_id) REFERENCES alert_configs(id) ON DELETE CASCADE
);

-- Notification channels
CREATE TABLE IF NOT EXISTS notification_channels (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- email, slack, webhook, sms, etc.
    configuration TEXT NOT NULL, -- JSON config specific to channel type
    enabled BOOLEAN DEFAULT true,
    test_sent_at TIMESTAMP,
    last_used TIMESTAMP,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System health checks
CREATE TABLE IF NOT EXISTS health_checks (
    id VARCHAR(36) PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- http, tcp, custom, etc.
    endpoint VARCHAR(500),
    expected_status INTEGER DEFAULT 200,
    timeout_ms INTEGER DEFAULT 5000,
    interval_seconds INTEGER DEFAULT 60,
    enabled BOOLEAN DEFAULT true,
    last_check TIMESTAMP,
    last_success TIMESTAMP,
    last_failure TIMESTAMP,
    consecutive_failures INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'unknown', -- healthy, degraded, unhealthy
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance baselines
CREATE TABLE IF NOT EXISTS performance_baselines (
    id VARCHAR(36) PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255),
    baseline_value DECIMAL(15,6) NOT NULL,
    baseline_type VARCHAR(20) DEFAULT 'average', -- average, p95, p99, max, min
    calculation_period VARCHAR(20) DEFAULT 'daily', -- hourly, daily, weekly
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sample_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model quality assessments
CREATE TABLE IF NOT EXISTS model_quality_assessments (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    assessment_type VARCHAR(50) NOT NULL, -- accuracy, coherence, toxicity, bias
    dataset_id VARCHAR(255), -- Reference dataset used for assessment
    score DECIMAL(5,3) NOT NULL, -- 0.0 to 1.0 or custom scale
    confidence_interval DECIMAL(5,3), -- Statistical confidence
    assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assessor VARCHAR(100), -- human, automated, etc.
    notes TEXT,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting buckets (for distributed rate limiting)
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    id VARCHAR(36) PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- user_id, ip_address, api_key, etc.
    bucket_type VARCHAR(50) NOT NULL, -- requests, tokens, cost
    window_start TIMESTAMP NOT NULL,
    window_duration_seconds INTEGER NOT NULL,
    limit_value INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_configs_metric_name ON alert_configs(metric_name);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_config_id ON alert_incidents(alert_config_id);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_status ON alert_incidents(status);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_enabled ON notification_channels(enabled);
CREATE INDEX IF NOT EXISTS idx_health_checks_service_name ON health_checks(service_name);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_performance_baselines_metric ON performance_baselines(metric_name);
CREATE INDEX IF NOT EXISTS idx_model_quality_model_id ON model_quality_assessments(model_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_identifier ON rate_limit_buckets(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires ON rate_limit_buckets(expires_at);