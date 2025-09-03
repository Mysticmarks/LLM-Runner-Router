-- Enterprise features: quotas, billing, SLA monitoring

-- Usage quotas and billing
CREATE TABLE IF NOT EXISTS usage_quotas (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    tenant_id VARCHAR(36),
    quota_type VARCHAR(50) NOT NULL, -- requests, tokens, cost, etc.
    quota_limit INTEGER NOT NULL,
    quota_used INTEGER DEFAULT 0,
    reset_period VARCHAR(20) DEFAULT 'monthly', -- daily, weekly, monthly, yearly
    reset_at TIMESTAMP,
    overage_allowed BOOLEAN DEFAULT false,
    overage_rate DECIMAL(8,4) DEFAULT 0, -- cost per unit over limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Billing records
CREATE TABLE IF NOT EXISTS billing_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    tenant_id VARCHAR(36),
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(12,6) DEFAULT 0,
    overage_cost_usd DECIMAL(12,6) DEFAULT 0,
    discount_amount DECIMAL(12,6) DEFAULT 0,
    final_amount_usd DECIMAL(12,6) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue
    invoice_url VARCHAR(500),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

-- SLA monitoring
CREATE TABLE IF NOT EXISTS sla_metrics (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    tenant_id VARCHAR(36),
    sla_type VARCHAR(50) NOT NULL, -- availability, latency, quality
    target_value DECIMAL(8,4) NOT NULL, -- 99.9% availability, 500ms latency, etc.
    actual_value DECIMAL(8,4) DEFAULT 0,
    measurement_period VARCHAR(20) DEFAULT 'daily', -- hourly, daily, weekly, monthly
    measurement_start TIMESTAMP NOT NULL,
    measurement_end TIMESTAMP NOT NULL,
    violation_count INTEGER DEFAULT 0,
    meets_sla BOOLEAN DEFAULT true,
    penalty_applied DECIMAL(8,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0, -- 0-100
    user_criteria TEXT DEFAULT '{}', -- JSON criteria for user targeting
    tenant_criteria TEXT DEFAULT '{}', -- JSON criteria for tenant targeting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhook_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    tenant_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events TEXT NOT NULL, -- JSON array of event types
    secret VARCHAR(255), -- For signature verification
    active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 5000,
    last_success TIMESTAMP,
    last_failure TIMESTAMP,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_id ON usage_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_tenant_id ON usage_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_user_id ON billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_tenant_id ON billing_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_status ON billing_records(status);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_user_id ON sla_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_tenant_id ON sla_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON webhook_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_active ON webhook_configs(active);