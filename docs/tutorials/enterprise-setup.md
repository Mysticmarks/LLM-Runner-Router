# Enterprise Setup Tutorial

Learn how to configure and deploy LLM Runner Router for enterprise environments with multi-tenancy, A/B testing, advanced authentication, audit logging, and SLA monitoring.

## Table of Contents

1. [Enterprise Features Overview](#enterprise-features-overview)
2. [Multi-Tenancy Setup](#multi-tenancy-setup)
3. [A/B Testing Framework](#ab-testing-framework)
4. [Enterprise Authentication](#enterprise-authentication)
5. [Audit Logging](#audit-logging)
6. [SLA Monitoring](#sla-monitoring)
7. [Integration Examples](#integration-examples)
8. [Deployment Strategies](#deployment-strategies)

## Enterprise Features Overview

### What are Enterprise Features?

Enterprise features provide:
- **Multi-Tenancy** - Isolated environments for different customers/departments
- **A/B Testing** - Compare model performance and user experience
- **Advanced Auth** - SSO, RBAC, API keys with granular permissions
- **Audit Logging** - Comprehensive activity tracking for compliance
- **SLA Monitoring** - Performance guarantees and automatic scaling
- **Cost Management** - Usage tracking and billing integration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Enterprise Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Multi-Tenancy  │  A/B Testing  │  Auth  │  Audit  │  SLA  │
├─────────────────────────────────────────────────────────────┤
│                     Core LLM Router                        │
├─────────────────────────────────────────────────────────────┤
│   Models  │  Loaders  │  Engines  │  Pipeline  │  Cache   │
└─────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy Setup

### Basic Multi-Tenant Configuration

Create `01-multi-tenancy.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';
import { EnterpriseManager } from 'llm-runner-router/enterprise';

class MultiTenantLLMRouter {
    constructor(config = {}) {
        this.config = config;
        this.tenants = new Map();
        this.enterpriseManager = new EnterpriseManager({
            multiTenancy: {
                enabled: true,
                isolation: config.isolation || 'namespace', // namespace, database, process
                resourceSharing: config.resourceSharing !== false,
                defaultLimits: config.defaultLimits || {
                    requestsPerMinute: 100,
                    maxConcurrent: 5,
                    modelsAllowed: ['gpt-3.5-turbo', 'claude-haiku'],
                    storageMB: 1000
                }
            }
        });
    }

    async initialize() {
        console.log('🏢 Initializing Multi-Tenant LLM Router...');
        
        await this.enterpriseManager.initialize();
        await this.loadTenantConfigurations();
        
        console.log('✅ Multi-tenant router ready');
    }

    async loadTenantConfigurations() {
        // Load tenant configurations from database/config files
        const tenantConfigs = await this.getTenantConfigs();
        
        for (const tenantConfig of tenantConfigs) {
            await this.setupTenant(tenantConfig);
        }
    }

    async setupTenant(tenantConfig) {
        console.log(`🏠 Setting up tenant: ${tenantConfig.id}`);
        
        const tenant = {
            id: tenantConfig.id,
            name: tenantConfig.name,
            router: new LLMRouter({
                // Tenant-specific configuration
                performance: {
                    maxConcurrent: tenantConfig.limits.maxConcurrent,
                    timeout: tenantConfig.timeout || 30000
                },
                routing: {
                    strategy: tenantConfig.strategy || 'balanced',
                    allowedModels: tenantConfig.limits.modelsAllowed
                },
                cache: {
                    enabled: tenantConfig.cache?.enabled !== false,
                    namespace: `tenant_${tenantConfig.id}`,
                    maxSize: tenantConfig.cache?.maxSize || 1000
                },
                logging: {
                    level: tenantConfig.logging?.level || 'info',
                    prefix: `[${tenantConfig.id}]`
                }
            }),
            limits: tenantConfig.limits,
            usage: {
                requestsThisMinute: 0,
                currentConcurrent: 0,
                totalRequests: 0,
                lastReset: Date.now()
            },
            metadata: {
                createdAt: tenantConfig.createdAt || Date.now(),
                lastAccess: Date.now(),
                plan: tenantConfig.plan || 'basic'
            }
        };

        // Initialize tenant router
        await tenant.router.initialize();
        
        // Set up tenant-specific models
        for (const modelConfig of tenantConfig.models || []) {
            await tenant.router.registerModel(modelConfig);
        }

        this.tenants.set(tenantConfig.id, tenant);
        
        console.log(`✅ Tenant ${tenantConfig.id} ready (${tenant.limits.modelsAllowed.length} models)`);
    }

    async getTenantConfigs() {
        // In production, this would come from a database
        return [
            {
                id: 'enterprise-corp',
                name: 'Enterprise Corporation',
                plan: 'enterprise',
                limits: {
                    requestsPerMinute: 1000,
                    maxConcurrent: 50,
                    modelsAllowed: ['gpt-4', 'claude-3-opus', 'custom-model'],
                    storageMB: 10000
                },
                strategy: 'quality-first',
                models: [
                    {
                        id: 'enterprise-custom',
                        name: 'Enterprise Custom Model',
                        format: 'gguf',
                        source: './models/enterprise-model.gguf'
                    }
                ],
                cache: { enabled: true, maxSize: 5000 },
                logging: { level: 'debug' }
            },
            {
                id: 'startup-inc',
                name: 'Startup Inc',
                plan: 'professional',
                limits: {
                    requestsPerMinute: 500,
                    maxConcurrent: 20,
                    modelsAllowed: ['gpt-3.5-turbo', 'claude-haiku'],
                    storageMB: 5000
                },
                strategy: 'balanced'
            },
            {
                id: 'small-business',
                name: 'Small Business',
                plan: 'basic',
                limits: {
                    requestsPerMinute: 100,
                    maxConcurrent: 5,
                    modelsAllowed: ['gpt-3.5-turbo'],
                    storageMB: 1000
                },
                strategy: 'cost-optimized'
            }
        ];
    }

    async processRequest(tenantId, prompt, options = {}) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }

        // Check tenant limits
        await this.checkTenantLimits(tenant);

        // Update usage tracking
        tenant.usage.currentConcurrent++;
        tenant.usage.totalRequests++;
        tenant.metadata.lastAccess = Date.now();

        try {
            // Process with tenant-specific router
            const result = await tenant.router.process({
                prompt,
                ...options,
                tenantId // Add tenant context
            });

            // Add tenant metadata to response
            result.tenant = {
                id: tenantId,
                plan: tenant.metadata.plan,
                usage: this.getTenantUsage(tenant)
            };

            return result;

        } finally {
            tenant.usage.currentConcurrent--;
        }
    }

    async checkTenantLimits(tenant) {
        const now = Date.now();
        
        // Reset rate limit counter if needed
        if (now - tenant.usage.lastReset > 60000) { // 1 minute
            tenant.usage.requestsThisMinute = 0;
            tenant.usage.lastReset = now;
        }

        // Check rate limits
        if (tenant.usage.requestsThisMinute >= tenant.limits.requestsPerMinute) {
            throw new Error(`Rate limit exceeded for tenant ${tenant.id}: ${tenant.limits.requestsPerMinute}/min`);
        }

        // Check concurrent limits
        if (tenant.usage.currentConcurrent >= tenant.limits.maxConcurrent) {
            throw new Error(`Concurrent limit exceeded for tenant ${tenant.id}: ${tenant.limits.maxConcurrent}`);
        }

        tenant.usage.requestsThisMinute++;
    }

    getTenantUsage(tenant) {
        return {
            requestsThisMinute: tenant.usage.requestsThisMinute,
            currentConcurrent: tenant.usage.currentConcurrent,
            totalRequests: tenant.usage.totalRequests,
            limitsRemaining: {
                requestsPerMinute: tenant.limits.requestsPerMinute - tenant.usage.requestsThisMinute,
                maxConcurrent: tenant.limits.maxConcurrent - tenant.usage.currentConcurrent
            }
        };
    }

    async getTenantStats(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }

        return {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                plan: tenant.metadata.plan
            },
            limits: tenant.limits,
            usage: this.getTenantUsage(tenant),
            models: await tenant.router.listModels(),
            health: await tenant.router.getStatus()
        };
    }

    async getAllTenantsStatus() {
        const status = {};
        
        for (const [tenantId, tenant] of this.tenants) {
            status[tenantId] = {
                name: tenant.name,
                plan: tenant.metadata.plan,
                usage: this.getTenantUsage(tenant),
                lastAccess: tenant.metadata.lastAccess,
                healthy: tenant.usage.currentConcurrent < tenant.limits.maxConcurrent
            };
        }
        
        return status;
    }
}

// Usage example
async function demonstrateMultiTenancy() {
    console.log('🏢 Multi-Tenancy Demonstration\n');

    const multiTenantRouter = new MultiTenantLLMRouter({
        isolation: 'namespace',
        resourceSharing: true
    });

    try {
        await multiTenantRouter.initialize();

        // Test requests from different tenants
        const testPrompts = [
            { tenant: 'enterprise-corp', prompt: 'Analyze our Q4 financial data' },
            { tenant: 'startup-inc', prompt: 'Help me write a product description' },
            { tenant: 'small-business', prompt: 'Create a marketing email' }
        ];

        for (const test of testPrompts) {
            try {
                console.log(`\n🏠 Processing request for ${test.tenant}:`);
                console.log(`Prompt: ${test.prompt}`);
                
                const result = await multiTenantRouter.processRequest(
                    test.tenant, 
                    test.prompt,
                    { maxTokens: 100 }
                );

                console.log(`Response: ${result.response.substring(0, 100)}...`);
                console.log(`Tenant usage:`, result.tenant.usage);

            } catch (error) {
                console.log(`❌ Request failed: ${error.message}`);
            }
        }

        // Show tenant statistics
        console.log('\n📊 All Tenants Status:');
        const allStatus = await multiTenantRouter.getAllTenantsStatus();
        console.log(JSON.stringify(allStatus, null, 2));

        // Detailed stats for one tenant
        console.log('\n📈 Enterprise Corp Detailed Stats:');
        const enterpriseStats = await multiTenantRouter.getTenantStats('enterprise-corp');
        console.log(JSON.stringify(enterpriseStats, null, 2));

    } catch (error) {
        console.error('❌ Multi-tenancy demo failed:', error.message);
    }
}

demonstrateMultiTenancy();

export { MultiTenantLLMRouter };
```

### Advanced Multi-Tenancy with Database Integration

Create `02-database-tenancy.js`:

```javascript
import { MultiTenantLLMRouter } from './01-multi-tenancy.js';

class DatabaseMultiTenantRouter extends MultiTenantLLMRouter {
    constructor(config = {}) {
        super(config);
        this.dbConfig = config.database || {
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            database: 'llm_router',
            user: 'admin',
            password: 'password'
        };
        this.db = null;
    }

    async initialize() {
        console.log('🗄️ Initializing Database Multi-Tenant Router...');
        
        // Initialize database connection
        await this.initializeDatabase();
        
        // Setup tenant tables
        await this.setupTenantSchema();
        
        // Load tenants from database
        await this.loadTenantsFromDatabase();
        
        console.log('✅ Database multi-tenant router ready');
    }

    async initializeDatabase() {
        // Mock database connection - in production use actual DB client
        this.db = {
            async query(sql, params = []) {
                console.log(`📋 SQL: ${sql.substring(0, 100)}...`);
                
                // Mock responses for demonstration
                if (sql.includes('SELECT * FROM tenants')) {
                    return {
                        rows: [
                            {
                                id: 'db-tenant-1',
                                name: 'Database Tenant 1',
                                plan: 'enterprise',
                                config: JSON.stringify({
                                    limits: {
                                        requestsPerMinute: 2000,
                                        maxConcurrent: 100,
                                        modelsAllowed: ['gpt-4', 'claude-3-opus']
                                    }
                                }),
                                created_at: new Date(),
                                updated_at: new Date()
                            }
                        ]
                    };
                }
                
                if (sql.includes('INSERT INTO tenant_usage')) {
                    return { rowCount: 1 };
                }
                
                return { rows: [], rowCount: 0 };
            }
        };
    }

    async setupTenantSchema() {
        const createTenantTable = `
            CREATE TABLE IF NOT EXISTS tenants (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                plan VARCHAR(50) NOT NULL,
                config JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `;

        const createUsageTable = `
            CREATE TABLE IF NOT EXISTS tenant_usage (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(255) REFERENCES tenants(id),
                timestamp TIMESTAMP DEFAULT NOW(),
                requests_count INTEGER DEFAULT 1,
                tokens_used INTEGER DEFAULT 0,
                model_used VARCHAR(255),
                cost_cents INTEGER DEFAULT 0
            )
        `;

        const createLimitsTable = `
            CREATE TABLE IF NOT EXISTS tenant_limits (
                tenant_id VARCHAR(255) PRIMARY KEY REFERENCES tenants(id),
                current_requests_minute INTEGER DEFAULT 0,
                current_concurrent INTEGER DEFAULT 0,
                last_reset TIMESTAMP DEFAULT NOW()
            )
        `;

        await this.db.query(createTenantTable);
        await this.db.query(createUsageTable);
        await this.db.query(createLimitsTable);
    }

    async loadTenantsFromDatabase() {
        const result = await this.db.query('SELECT * FROM tenants ORDER BY created_at');
        
        for (const row of result.rows) {
            const tenantConfig = {
                id: row.id,
                name: row.name,
                plan: row.plan,
                ...JSON.parse(row.config),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
            
            await this.setupTenant(tenantConfig);
        }
    }

    async processRequest(tenantId, prompt, options = {}) {
        try {
            // Track request start
            const startTime = Date.now();
            
            const result = await super.processRequest(tenantId, prompt, options);
            
            // Log usage to database
            await this.logUsageToDatabase(tenantId, {
                tokensUsed: result.metrics?.totalTokens || 0,
                modelUsed: result.modelUsed,
                duration: Date.now() - startTime,
                success: true
            });
            
            return result;
            
        } catch (error) {
            // Log failed request
            await this.logUsageToDatabase(tenantId, {
                tokensUsed: 0,
                modelUsed: null,
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });
            
            throw error;
        }
    }

    async logUsageToDatabase(tenantId, usage) {
        const sql = `
            INSERT INTO tenant_usage (tenant_id, tokens_used, model_used, cost_cents)
            VALUES ($1, $2, $3, $4)
        `;
        
        const costCents = this.calculateCost(usage.tokensUsed, usage.modelUsed);
        
        await this.db.query(sql, [
            tenantId,
            usage.tokensUsed,
            usage.modelUsed,
            costCents
        ]);
    }

    calculateCost(tokens, model) {
        // Simple cost calculation - in production use actual pricing
        const rates = {
            'gpt-4': 0.03, // $0.03 per 1K tokens
            'gpt-3.5-turbo': 0.002, // $0.002 per 1K tokens
            'claude-3-opus': 0.015,
            'claude-haiku': 0.0008
        };
        
        const rate = rates[model] || 0.001;
        return Math.round((tokens / 1000) * rate * 100); // Convert to cents
    }

    async getTenantUsageReport(tenantId, startDate, endDate) {
        const sql = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as requests,
                SUM(tokens_used) as total_tokens,
                SUM(cost_cents) as total_cost_cents,
                array_agg(DISTINCT model_used) as models_used
            FROM tenant_usage 
            WHERE tenant_id = $1 
            AND timestamp BETWEEN $2 AND $3
            GROUP BY DATE(timestamp)
            ORDER BY date
        `;
        
        const result = await this.db.query(sql, [tenantId, startDate, endDate]);
        
        return {
            tenantId,
            period: { start: startDate, end: endDate },
            dailyUsage: result.rows,
            summary: {
                totalRequests: result.rows.reduce((sum, day) => sum + day.requests, 0),
                totalTokens: result.rows.reduce((sum, day) => sum + day.total_tokens, 0),
                totalCostCents: result.rows.reduce((sum, day) => sum + day.total_cost_cents, 0)
            }
        };
    }

    async createTenant(tenantConfig) {
        const sql = `
            INSERT INTO tenants (id, name, plan, config)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const config = {
            limits: tenantConfig.limits,
            strategy: tenantConfig.strategy,
            models: tenantConfig.models || []
        };
        
        const result = await this.db.query(sql, [
            tenantConfig.id,
            tenantConfig.name,
            tenantConfig.plan,
            JSON.stringify(config)
        ]);
        
        // Setup tenant in memory
        await this.setupTenant({
            ...tenantConfig,
            ...config
        });
        
        return result.rows[0];
    }

    async updateTenantLimits(tenantId, newLimits) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }

        // Update database
        const sql = `
            UPDATE tenants 
            SET config = jsonb_set(config, '{limits}', $2),
                updated_at = NOW()
            WHERE id = $1
        `;
        
        await this.db.query(sql, [tenantId, JSON.stringify(newLimits)]);
        
        // Update in-memory tenant
        tenant.limits = { ...tenant.limits, ...newLimits };
        
        console.log(`✅ Updated limits for tenant ${tenantId}`);
    }
}

// Usage example
async function demonstrateDatabaseTenancy() {
    console.log('🗄️ Database Multi-Tenancy Demonstration\n');

    const dbRouter = new DatabaseMultiTenantRouter({
        database: {
            type: 'postgresql',
            host: 'localhost',
            database: 'llm_router'
        }
    });

    try {
        await dbRouter.initialize();

        // Create a new tenant
        await dbRouter.createTenant({
            id: 'new-customer',
            name: 'New Customer Corp',
            plan: 'professional',
            limits: {
                requestsPerMinute: 300,
                maxConcurrent: 15,
                modelsAllowed: ['gpt-3.5-turbo', 'claude-haiku']
            }
        });

        // Process some requests
        for (let i = 0; i < 5; i++) {
            try {
                const result = await dbRouter.processRequest(
                    'new-customer',
                    `Test request ${i + 1}`,
                    { maxTokens: 50 }
                );
                console.log(`✅ Request ${i + 1} successful`);
            } catch (error) {
                console.log(`❌ Request ${i + 1} failed: ${error.message}`);
            }
        }

        // Get usage report
        const report = await dbRouter.getTenantUsageReport(
            'new-customer',
            new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
            new Date()
        );
        
        console.log('\n📊 Usage Report:');
        console.log(JSON.stringify(report, null, 2));

        // Update tenant limits
        await dbRouter.updateTenantLimits('new-customer', {
            requestsPerMinute: 500,
            maxConcurrent: 25
        });

    } catch (error) {
        console.error('❌ Database tenancy demo failed:', error.message);
    }
}

demonstrateDatabaseTenancy();

export { DatabaseMultiTenantRouter };
```

## A/B Testing Framework

### Basic A/B Testing Setup

Create `03-ab-testing.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';
import crypto from 'crypto';

class ABTestingManager {
    constructor(config = {}) {
        this.config = config;
        this.experiments = new Map();
        this.assignments = new Map();
        this.results = new Map();
        this.router = new LLMRouter();
    }

    async initialize() {
        console.log('🧪 Initializing A/B Testing Manager...');
        
        await this.router.initialize();
        await this.loadExperiments();
        
        console.log('✅ A/B Testing Manager ready');
    }

    async loadExperiments() {
        // Load experiment configurations
        const experiments = await this.getExperimentConfigs();
        
        for (const experiment of experiments) {
            await this.setupExperiment(experiment);
        }
    }

    async getExperimentConfigs() {
        return [
            {
                id: 'model-comparison',
                name: 'GPT-4 vs Claude-3 Performance',
                status: 'active',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31'),
                trafficAllocation: 50, // 50% of traffic
                variants: {
                    control: {
                        name: 'GPT-4 Control',
                        weight: 50,
                        config: {
                            model: 'gpt-4',
                            temperature: 0.7,
                            strategy: 'quality-first'
                        }
                    },
                    treatment: {
                        name: 'Claude-3 Treatment',
                        weight: 50,
                        config: {
                            model: 'claude-3-opus',
                            temperature: 0.7,
                            strategy: 'quality-first'
                        }
                    }
                },
                metrics: ['response_time', 'quality_score', 'user_satisfaction', 'cost'],
                segmentation: {
                    userType: ['free', 'premium'],
                    region: ['us', 'eu', 'asia']
                }
            },
            {
                id: 'temperature-optimization',
                name: 'Temperature Settings Impact',
                status: 'active',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-06-30'),
                trafficAllocation: 25,
                variants: {
                    control: {
                        name: 'Standard Temperature',
                        weight: 33,
                        config: { temperature: 0.7 }
                    },
                    low_temp: {
                        name: 'Low Temperature',
                        weight: 33,
                        config: { temperature: 0.3 }
                    },
                    high_temp: {
                        name: 'High Temperature',
                        weight: 34,
                        config: { temperature: 1.0 }
                    }
                },
                metrics: ['creativity_score', 'consistency', 'user_preference']
            }
        ];
    }

    async setupExperiment(experimentConfig) {
        console.log(`🧪 Setting up experiment: ${experimentConfig.id}`);
        
        const experiment = {
            ...experimentConfig,
            stats: new Map(),
            assignments: new Map()
        };

        // Initialize stats for each variant
        for (const [variantId, variant] of Object.entries(experimentConfig.variants)) {
            experiment.stats.set(variantId, {
                assignments: 0,
                completions: 0,
                metrics: {},
                errors: 0
            });
        }

        this.experiments.set(experimentConfig.id, experiment);
        console.log(`✅ Experiment ${experimentConfig.id} ready`);
    }

    async processWithABTesting(prompt, options = {}) {
        const userId = options.userId || this.generateAnonymousId();
        const experimentResults = {};

        // Get active experiments for this request
        const activeExperiments = this.getActiveExperiments(options);

        // Process each experiment
        for (const experiment of activeExperiments) {
            const assignment = await this.getExperimentAssignment(experiment.id, userId, options);
            
            if (assignment) {
                experimentResults[experiment.id] = assignment;
                
                // Merge experiment config with options
                const experimentOptions = {
                    ...options,
                    ...assignment.config,
                    experimentId: experiment.id,
                    variantId: assignment.variantId
                };

                // Update assignment stats
                this.recordAssignment(experiment.id, assignment.variantId);

                try {
                    // Process with experiment configuration
                    const result = await this.router.process(prompt, experimentOptions);
                    
                    // Record completion and metrics
                    await this.recordExperimentResult(experiment.id, assignment.variantId, result, options);
                    
                    // Add experiment info to result
                    result.experiments = experimentResults;
                    return result;

                } catch (error) {
                    this.recordError(experiment.id, assignment.variantId);
                    throw error;
                }
            }
        }

        // No experiments active, use default processing
        return await this.router.process(prompt, options);
    }

    getActiveExperiments(options) {
        const now = new Date();
        const activeExperiments = [];

        for (const [experimentId, experiment] of this.experiments) {
            if (experiment.status === 'active' &&
                now >= experiment.startDate &&
                now <= experiment.endDate) {
                
                // Check if request is in experiment traffic
                if (this.isInExperimentTraffic(experiment, options)) {
                    activeExperiments.push(experiment);
                }
            }
        }

        return activeExperiments;
    }

    isInExperimentTraffic(experiment, options) {
        const hash = this.hashRequest(experiment.id, options);
        const trafficPercentile = hash % 100;
        return trafficPercentile < experiment.trafficAllocation;
    }

    async getExperimentAssignment(experimentId, userId, options) {
        const assignmentKey = `${experimentId}:${userId}`;
        
        // Check for existing assignment (consistency)
        if (this.assignments.has(assignmentKey)) {
            return this.assignments.get(assignmentKey);
        }

        const experiment = this.experiments.get(experimentId);
        if (!experiment) return null;

        // Determine variant based on user hash and weights
        const variant = this.selectVariant(experiment, userId, options);
        
        const assignment = {
            experimentId,
            variantId: variant.id,
            variantName: variant.name,
            config: variant.config,
            assignedAt: Date.now()
        };

        // Store assignment for consistency
        this.assignments.set(assignmentKey, assignment);
        
        return assignment;
    }

    selectVariant(experiment, userId, options) {
        const hash = this.hashUser(userId, experiment.id);
        const variants = Object.entries(experiment.variants);
        
        // Calculate cumulative weights
        let totalWeight = 0;
        const cumulativeWeights = variants.map(([id, variant]) => {
            totalWeight += variant.weight;
            return { id, variant, cumulativeWeight: totalWeight };
        });

        // Select variant based on hash
        const threshold = (hash % totalWeight);
        const selected = cumulativeWeights.find(v => threshold < v.cumulativeWeight);
        
        return {
            id: selected.id,
            name: selected.variant.name,
            config: selected.variant.config
        };
    }

    recordAssignment(experimentId, variantId) {
        const experiment = this.experiments.get(experimentId);
        if (experiment) {
            const stats = experiment.stats.get(variantId);
            if (stats) {
                stats.assignments++;
            }
        }
    }

    async recordExperimentResult(experimentId, variantId, result, options) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) return;

        const stats = experiment.stats.get(variantId);
        if (!stats) return;

        stats.completions++;

        // Record metrics based on experiment configuration
        for (const metricName of experiment.metrics) {
            const metricValue = await this.calculateMetric(metricName, result, options);
            
            if (!stats.metrics[metricName]) {
                stats.metrics[metricName] = {
                    sum: 0,
                    count: 0,
                    values: []
                };
            }
            
            stats.metrics[metricName].sum += metricValue;
            stats.metrics[metricName].count++;
            stats.metrics[metricName].values.push(metricValue);
            
            // Keep only recent values to prevent memory bloat
            if (stats.metrics[metricName].values.length > 1000) {
                stats.metrics[metricName].values = stats.metrics[metricName].values.slice(-1000);
            }
        }
    }

    async calculateMetric(metricName, result, options) {
        switch (metricName) {
            case 'response_time':
                return result.metrics?.duration || 0;
                
            case 'quality_score':
                // Simulate quality scoring based on response length and coherence
                const words = result.response.split(' ').length;
                return Math.min(100, Math.max(0, words * 2 + Math.random() * 20));
                
            case 'user_satisfaction':
                // Simulate user satisfaction (in production, get from feedback)
                return Math.random() * 100;
                
            case 'cost':
                return result.metrics?.cost || 0;
                
            case 'creativity_score':
                // Simulate creativity scoring
                const uniqueWords = new Set(result.response.toLowerCase().split(' ')).size;
                return Math.min(100, uniqueWords * 3);
                
            case 'consistency':
                // Simulate consistency scoring
                return 50 + Math.random() * 50;
                
            default:
                return 0;
        }
    }

    recordError(experimentId, variantId) {
        const experiment = this.experiments.get(experimentId);
        if (experiment) {
            const stats = experiment.stats.get(variantId);
            if (stats) {
                stats.errors++;
            }
        }
    }

    hashUser(userId, experimentId) {
        const hash = crypto.createHash('md5');
        hash.update(`${userId}:${experimentId}`);
        return parseInt(hash.digest('hex').substring(0, 8), 16);
    }

    hashRequest(experimentId, options) {
        const hash = crypto.createHash('md5');
        hash.update(`${experimentId}:${options.sessionId || 'anonymous'}`);
        return parseInt(hash.digest('hex').substring(0, 8), 16);
    }

    generateAnonymousId() {
        return crypto.randomUUID();
    }

    getExperimentResults(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experiment not found: ${experimentId}`);
        }

        const results = {
            experimentId,
            name: experiment.name,
            status: experiment.status,
            period: {
                start: experiment.startDate,
                end: experiment.endDate
            },
            variants: {}
        };

        for (const [variantId, stats] of experiment.stats) {
            const variant = experiment.variants[variantId];
            
            results.variants[variantId] = {
                name: variant.name,
                weight: variant.weight,
                assignments: stats.assignments,
                completions: stats.completions,
                errors: stats.errors,
                conversionRate: stats.assignments > 0 ? stats.completions / stats.assignments : 0,
                errorRate: stats.assignments > 0 ? stats.errors / stats.assignments : 0,
                metrics: {}
            };

            // Calculate metric averages
            for (const [metricName, metricData] of Object.entries(stats.metrics)) {
                results.variants[variantId].metrics[metricName] = {
                    average: metricData.count > 0 ? metricData.sum / metricData.count : 0,
                    count: metricData.count,
                    total: metricData.sum
                };
            }
        }

        return results;
    }

    compareVariants(experimentId, metricName) {
        const results = this.getExperimentResults(experimentId);
        const comparison = {
            experimentId,
            metric: metricName,
            variants: [],
            winner: null,
            confidence: null
        };

        for (const [variantId, variantData] of Object.entries(results.variants)) {
            const metricValue = variantData.metrics[metricName]?.average || 0;
            comparison.variants.push({
                variantId,
                name: variantData.name,
                value: metricValue,
                sampleSize: variantData.completions
            });
        }

        // Sort by metric value (higher is better for most metrics)
        comparison.variants.sort((a, b) => b.value - a.value);
        
        if (comparison.variants.length > 0) {
            comparison.winner = comparison.variants[0];
            
            // Simple confidence calculation (in production, use proper statistical tests)
            if (comparison.variants.length > 1) {
                const best = comparison.variants[0];
                const second = comparison.variants[1];
                const improvement = (best.value - second.value) / second.value;
                comparison.confidence = Math.min(0.99, improvement * 10); // Simplified
            }
        }

        return comparison;
    }
}

// Usage example
async function demonstrateABTesting() {
    console.log('🧪 A/B Testing Demonstration\n');

    const abManager = new ABTestingManager();
    
    try {
        await abManager.initialize();

        // Simulate multiple users testing
        const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
        const prompts = [
            'Write a product description for headphones',
            'Explain quantum computing simply',
            'Create a marketing email for a new app',
            'Summarize the benefits of renewable energy'
        ];

        console.log('🔄 Running A/B tests...\n');

        for (let i = 0; i < 20; i++) {
            const userId = users[Math.floor(Math.random() * users.length)];
            const prompt = prompts[Math.floor(Math.random() * prompts.length)];
            
            try {
                const result = await abManager.processWithABTesting(prompt, {
                    userId,
                    maxTokens: 100,
                    sessionId: `session_${Math.floor(i / 5)}`
                });

                console.log(`✅ Test ${i + 1}: User ${userId} - ${result.experiments ? 'In experiment' : 'Control'}`);
                
                if (result.experiments) {
                    for (const [expId, assignment] of Object.entries(result.experiments)) {
                        console.log(`   📊 ${expId}: ${assignment.variantName}`);
                    }
                }

            } catch (error) {
                console.log(`❌ Test ${i + 1} failed: ${error.message}`);
            }
        }

        // Show experiment results
        console.log('\n📊 Experiment Results:\n');
        
        for (const experimentId of abManager.experiments.keys()) {
            const results = abManager.getExperimentResults(experimentId);
            console.log(`Experiment: ${results.name}`);
            console.log('Variants:');
            
            for (const [variantId, variant] of Object.entries(results.variants)) {
                console.log(`  ${variant.name}:`);
                console.log(`    Assignments: ${variant.assignments}`);
                console.log(`    Completions: ${variant.completions}`);
                console.log(`    Conversion Rate: ${(variant.conversionRate * 100).toFixed(1)}%`);
                
                if (variant.metrics.response_time) {
                    console.log(`    Avg Response Time: ${variant.metrics.response_time.average.toFixed(0)}ms`);
                }
                if (variant.metrics.quality_score) {
                    console.log(`    Avg Quality Score: ${variant.metrics.quality_score.average.toFixed(1)}`);
                }
            }
            
            // Show comparison
            const comparison = abManager.compareVariants(experimentId, 'quality_score');
            if (comparison.winner) {
                console.log(`  🏆 Winner: ${comparison.winner.name} (confidence: ${(comparison.confidence * 100).toFixed(1)}%)`);
            }
            
            console.log();
        }

    } catch (error) {
        console.error('❌ A/B testing demo failed:', error.message);
    }
}

demonstrateABTesting();

export { ABTestingManager };
```

## Enterprise Authentication

### Advanced Authentication System

Create `04-enterprise-auth.js`:

```javascript
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

class EnterpriseAuthManager {
    constructor(config = {}) {
        this.config = config;
        this.jwtSecret = config.jwtSecret || crypto.randomBytes(64).toString('hex');
        this.apiKeys = new Map();
        this.sessions = new Map();
        this.permissions = new Map();
        this.auditLog = [];
        
        // Authentication providers
        this.providers = {
            local: new LocalAuthProvider(config.local || {}),
            oauth: new OAuthProvider(config.oauth || {}),
            saml: new SAMLProvider(config.saml || {}),
            ldap: new LDAPProvider(config.ldap || {})
        };
        
        // Role-based access control
        this.roles = new Map();
        this.initializeDefaultRoles();
    }

    async initialize() {
        console.log('🔐 Initializing Enterprise Authentication...');
        
        // Initialize auth providers
        for (const [name, provider] of Object.entries(this.providers)) {
            if (provider.initialize) {
                await provider.initialize();
                console.log(`✅ ${name} auth provider ready`);
            }
        }
        
        // Load existing API keys and permissions
        await this.loadApiKeys();
        await this.loadPermissions();
        
        console.log('✅ Enterprise authentication ready');
    }

    initializeDefaultRoles() {
        // Define enterprise roles
        this.roles.set('super_admin', {
            name: 'Super Administrator',
            permissions: ['*'], // All permissions
            description: 'Full system access'
        });
        
        this.roles.set('admin', {
            name: 'Administrator',
            permissions: [
                'users:read', 'users:write', 'users:delete',
                'tenants:read', 'tenants:write',
                'models:read', 'models:write',
                'metrics:read', 'audit:read'
            ],
            description: 'Administrative access'
        });
        
        this.roles.set('developer', {
            name: 'Developer',
            permissions: [
                'models:read', 'models:execute',
                'api:read', 'api:write',
                'metrics:read'
            ],
            description: 'Developer access to APIs and models'
        });
        
        this.roles.set('analyst', {
            name: 'Analyst',
            permissions: [
                'metrics:read', 'audit:read',
                'models:read', 'tenants:read'
            ],
            description: 'Read-only access for analysis'
        });
        
        this.roles.set('user', {
            name: 'Standard User',
            permissions: [
                'models:execute', 'api:read'
            ],
            description: 'Basic user access'
        });
    }

    async loadApiKeys() {
        // In production, load from database
        const defaultApiKeys = [
            {
                id: 'ak_enterprise_001',
                name: 'Enterprise Admin Key',
                key: this.generateApiKey(),
                userId: 'admin@company.com',
                roles: ['admin'],
                tenantId: 'enterprise-corp',
                enabled: true,
                lastUsed: null,
                createdAt: Date.now()
            },
            {
                id: 'ak_developer_001',
                name: 'Development Team Key',
                key: this.generateApiKey(),
                userId: 'dev-team@company.com',
                roles: ['developer'],
                tenantId: 'enterprise-corp',
                enabled: true,
                lastUsed: null,
                createdAt: Date.now()
            }
        ];
        
        for (const apiKey of defaultApiKeys) {
            this.apiKeys.set(apiKey.key, apiKey);
        }
    }

    async loadPermissions() {
        // Load user-specific permissions from database
        // For demo, we'll use in-memory data
        this.permissions.set('admin@company.com', {
            roles: ['admin'],
            customPermissions: ['experiments:write'],
            tenantId: 'enterprise-corp',
            lastLogin: null
        });
    }

    generateApiKey() {
        return 'llmr_' + crypto.randomBytes(32).toString('hex');
    }

    async authenticateApiKey(apiKey) {
        const keyData = this.apiKeys.get(apiKey);
        if (!keyData || !keyData.enabled) {
            this.logAuditEvent('auth', 'api_key_invalid', { apiKey: apiKey.substring(0, 8) + '...' });
            throw new Error('Invalid API key');
        }

        // Update last used
        keyData.lastUsed = Date.now();
        
        this.logAuditEvent('auth', 'api_key_success', {
            apiKeyId: keyData.id,
            userId: keyData.userId,
            tenantId: keyData.tenantId
        });

        return this.createAuthContext(keyData);
    }

    async authenticateJWT(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Check if session is still valid
            const session = this.sessions.get(decoded.sessionId);
            if (!session || session.expiresAt < Date.now()) {
                throw new Error('Session expired');
            }
            
            this.logAuditEvent('auth', 'jwt_success', {
                userId: decoded.userId,
                sessionId: decoded.sessionId
            });
            
            return this.createAuthContext(session.user);
            
        } catch (error) {
            this.logAuditEvent('auth', 'jwt_invalid', { error: error.message });
            throw new Error('Invalid JWT token');
        }
    }

    async authenticateOAuth(provider, code, redirectUri) {
        const authProvider = this.providers.oauth;
        if (!authProvider) {
            throw new Error('OAuth not configured');
        }
        
        try {
            const userInfo = await authProvider.exchangeCode(code, redirectUri);
            const user = await this.findOrCreateUser(userInfo, 'oauth');
            
            this.logAuditEvent('auth', 'oauth_success', {
                userId: user.id,
                provider: provider
            });
            
            return this.createSession(user);
            
        } catch (error) {
            this.logAuditEvent('auth', 'oauth_failed', {
                provider: provider,
                error: error.message
            });
            throw error;
        }
    }

    async findOrCreateUser(userInfo, authType) {
        // In production, interact with user database
        const user = {
            id: userInfo.email || userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            authType: authType,
            roles: ['user'], // Default role
            tenantId: this.determineTenantFromEmail(userInfo.email),
            createdAt: Date.now(),
            lastLogin: Date.now()
        };
        
        // Check if user should have elevated permissions
        if (userInfo.email?.endsWith('@company.com')) {
            user.roles = ['admin'];
            user.tenantId = 'enterprise-corp';
        }
        
        return user;
    }

    determineTenantFromEmail(email) {
        if (!email) return 'default';
        
        const domain = email.split('@')[1];
        const domainTenantMap = {
            'company.com': 'enterprise-corp',
            'startup.io': 'startup-inc',
            'smallbiz.com': 'small-business'
        };
        
        return domainTenantMap[domain] || 'default';
    }

    createSession(user) {
        const sessionId = crypto.randomUUID();
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        const session = {
            id: sessionId,
            user: user,
            createdAt: Date.now(),
            expiresAt: expiresAt,
            lastActivity: Date.now()
        };
        
        this.sessions.set(sessionId, session);
        
        // Create JWT token
        const token = jwt.sign({
            userId: user.id,
            sessionId: sessionId,
            tenantId: user.tenantId
        }, this.jwtSecret, { expiresIn: '24h' });
        
        return {
            token: token,
            user: user,
            expiresAt: expiresAt
        };
    }

    createAuthContext(userData) {
        const permissions = this.getUserPermissions(userData.userId || userData.id);
        
        return {
            user: {
                id: userData.userId || userData.id,
                email: userData.userId,
                name: userData.name,
                roles: userData.roles || ['user'],
                tenantId: userData.tenantId
            },
            permissions: permissions,
            hasPermission: (permission) => this.checkPermission(permissions, permission),
            isAdmin: () => userData.roles?.includes('admin') || userData.roles?.includes('super_admin'),
            getTenantId: () => userData.tenantId
        };
    }

    getUserPermissions(userId) {
        const userPerms = this.permissions.get(userId);
        if (!userPerms) return [];
        
        let allPermissions = [];
        
        // Add role-based permissions
        for (const roleName of userPerms.roles || []) {
            const role = this.roles.get(roleName);
            if (role) {
                allPermissions = allPermissions.concat(role.permissions);
            }
        }
        
        // Add custom permissions
        if (userPerms.customPermissions) {
            allPermissions = allPermissions.concat(userPerms.customPermissions);
        }
        
        return [...new Set(allPermissions)]; // Remove duplicates
    }

    checkPermission(userPermissions, requiredPermission) {
        // Check for wildcard permission
        if (userPermissions.includes('*')) {
            return true;
        }
        
        // Check exact match
        if (userPermissions.includes(requiredPermission)) {
            return true;
        }
        
        // Check wildcard patterns (e.g., 'models:*' for 'models:read')
        const [resource, action] = requiredPermission.split(':');
        const wildcardPattern = `${resource}:*`;
        
        return userPermissions.includes(wildcardPattern);
    }

    async middleware(req, res, next) {
        try {
            let authContext = null;
            
            // Try API key authentication
            const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (apiKey && apiKey.startsWith('llmr_')) {
                authContext = await this.authenticateApiKey(apiKey);
            }
            
            // Try JWT authentication
            else if (apiKey) {
                authContext = await this.authenticateJWT(apiKey);
            }
            
            // No authentication provided
            else {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'Provide API key or JWT token'
                });
            }
            
            // Add auth context to request
            req.auth = authContext;
            next();
            
        } catch (error) {
            res.status(401).json({
                error: 'Authentication failed',
                message: error.message
            });
        }
    }

    requirePermission(permission) {
        return (req, res, next) => {
            if (!req.auth) {
                return res.status(401).json({
                    error: 'Authentication required'
                });
            }
            
            if (!req.auth.hasPermission(permission)) {
                this.logAuditEvent('auth', 'permission_denied', {
                    userId: req.auth.user.id,
                    permission: permission,
                    endpoint: req.path
                });
                
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: permission,
                    userPermissions: req.auth.permissions
                });
            }
            
            next();
        };
    }

    requireRole(roleName) {
        return (req, res, next) => {
            if (!req.auth) {
                return res.status(401).json({
                    error: 'Authentication required'
                });
            }
            
            if (!req.auth.user.roles.includes(roleName)) {
                return res.status(403).json({
                    error: 'Insufficient role',
                    required: roleName,
                    userRoles: req.auth.user.roles
                });
            }
            
            next();
        };
    }

    logAuditEvent(category, action, details = {}) {
        const event = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            category: category,
            action: action,
            details: details,
            ip: details.ip || 'unknown',
            userAgent: details.userAgent || 'unknown'
        };
        
        this.auditLog.push(event);
        
        // Keep only recent events in memory (in production, store in database)
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-5000);
        }
        
        // Log security events
        if (category === 'auth' && ['api_key_invalid', 'jwt_invalid', 'permission_denied'].includes(action)) {
            console.log(`🚨 Security Event: ${action}`, details);
        }
    }

    getAuditLog(filters = {}) {
        let filtered = this.auditLog;
        
        if (filters.category) {
            filtered = filtered.filter(event => event.category === filters.category);
        }
        
        if (filters.userId) {
            filtered = filtered.filter(event => event.details.userId === filters.userId);
        }
        
        if (filters.startDate) {
            filtered = filtered.filter(event => new Date(event.timestamp) >= filters.startDate);
        }
        
        if (filters.endDate) {
            filtered = filtered.filter(event => new Date(event.timestamp) <= filters.endDate);
        }
        
        return filtered.slice(-filters.limit || 100);
    }

    async createApiKey(userId, name, roles = ['user'], tenantId = null) {
        const apiKey = {
            id: `ak_${crypto.randomBytes(8).toString('hex')}`,
            name: name,
            key: this.generateApiKey(),
            userId: userId,
            roles: roles,
            tenantId: tenantId,
            enabled: true,
            lastUsed: null,
            createdAt: Date.now()
        };
        
        this.apiKeys.set(apiKey.key, apiKey);
        
        this.logAuditEvent('auth', 'api_key_created', {
            apiKeyId: apiKey.id,
            userId: userId,
            roles: roles
        });
        
        return apiKey;
    }

    async revokeApiKey(apiKeyId) {
        for (const [key, keyData] of this.apiKeys) {
            if (keyData.id === apiKeyId) {
                keyData.enabled = false;
                
                this.logAuditEvent('auth', 'api_key_revoked', {
                    apiKeyId: apiKeyId,
                    userId: keyData.userId
                });
                
                return true;
            }
        }
        
        return false;
    }
}

// Mock auth providers for demonstration
class LocalAuthProvider {
    constructor(config) {
        this.config = config;
        this.users = new Map();
    }
    
    async authenticate(username, password) {
        // Mock local authentication
        const user = this.users.get(username);
        if (user && user.password === this.hashPassword(password)) {
            return user;
        }
        throw new Error('Invalid credentials');
    }
    
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }
}

class OAuthProvider {
    constructor(config) {
        this.config = config;
    }
    
    async exchangeCode(code, redirectUri) {
        // Mock OAuth code exchange
        return {
            id: 'oauth_user_123',
            email: 'user@company.com',
            name: 'OAuth User'
        };
    }
}

class SAMLProvider {
    constructor(config) {
        this.config = config;
    }
    
    async validateAssertion(assertion) {
        // Mock SAML assertion validation
        return {
            id: 'saml_user_123',
            email: 'user@company.com',
            name: 'SAML User'
        };
    }
}

class LDAPProvider {
    constructor(config) {
        this.config = config;
    }
    
    async authenticate(username, password) {
        // Mock LDAP authentication
        return {
            id: username,
            email: `${username}@company.com`,
            name: username,
            groups: ['employees', 'developers']
        };
    }
}

// Usage example
async function demonstrateEnterpriseAuth() {
    console.log('🔐 Enterprise Authentication Demonstration\n');

    const authManager = new EnterpriseAuthManager({
        jwtSecret: 'demo-secret-key'
    });

    try {
        await authManager.initialize();

        // Create API keys
        const adminKey = await authManager.createApiKey(
            'admin@company.com',
            'Admin API Key',
            ['admin'],
            'enterprise-corp'
        );
        
        const devKey = await authManager.createApiKey(
            'dev@company.com',
            'Developer API Key',
            ['developer'],
            'enterprise-corp'
        );

        console.log('🔑 Created API keys:');
        console.log(`Admin key: ${adminKey.key.substring(0, 16)}...`);
        console.log(`Dev key: ${devKey.key.substring(0, 16)}...`);

        // Test authentication
        console.log('\n🧪 Testing authentication...');
        
        const adminAuth = await authManager.authenticateApiKey(adminKey.key);
        console.log(`✅ Admin authenticated: ${adminAuth.user.email}`);
        console.log(`Permissions: ${adminAuth.permissions.slice(0, 5).join(', ')}...`);
        
        const devAuth = await authManager.authenticateApiKey(devKey.key);
        console.log(`✅ Developer authenticated: ${devAuth.user.email}`);
        console.log(`Permissions: ${devAuth.permissions.join(', ')}`);

        // Test permission checks
        console.log('\n🔒 Testing permissions...');
        
        console.log(`Admin can read users: ${adminAuth.hasPermission('users:read')}`);
        console.log(`Admin can delete tenants: ${adminAuth.hasPermission('tenants:delete')}`);
        console.log(`Developer can execute models: ${devAuth.hasPermission('models:execute')}`);
        console.log(`Developer can delete users: ${devAuth.hasPermission('users:delete')}`);

        // Test role checks
        console.log('\n👥 Testing roles...');
        console.log(`Admin is admin: ${adminAuth.isAdmin()}`);
        console.log(`Developer is admin: ${devAuth.isAdmin()}`);

        // Create session with JWT
        console.log('\n🎫 Creating JWT session...');
        const session = authManager.createSession({
            id: 'user@company.com',
            email: 'user@company.com',
            name: 'Test User',
            roles: ['user'],
            tenantId: 'enterprise-corp'
        });
        
        console.log(`JWT token created: ${session.token.substring(0, 50)}...`);
        console.log(`Expires at: ${new Date(session.expiresAt)}`);

        // Test JWT authentication
        const jwtAuth = await authManager.authenticateJWT(session.token);
        console.log(`✅ JWT authenticated: ${jwtAuth.user.email}`);

        // Show audit log
        console.log('\n📋 Audit log (last 5 events):');
        const auditEvents = authManager.getAuditLog({ limit: 5 });
        auditEvents.forEach(event => {
            console.log(`${event.timestamp}: ${event.category}:${event.action} - ${JSON.stringify(event.details)}`);
        });

        // Revoke API key
        console.log('\n🚫 Revoking developer API key...');
        await authManager.revokeApiKey(devKey.id);
        
        try {
            await authManager.authenticateApiKey(devKey.key);
            console.log('❌ Revocation failed - key still works');
        } catch (error) {
            console.log('✅ Key successfully revoked');
        }

    } catch (error) {
        console.error('❌ Enterprise auth demo failed:', error.message);
    }
}

demonstrateEnterpriseAuth();

export { EnterpriseAuthManager };
```

Now let me complete the remaining sections and then move to API documentation and load testing:

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Examine current project structure and existing documentation", "status": "completed"}, {"id": "2", "content": "Create comprehensive user guides in docs/guides/", "status": "completed"}, {"id": "3", "content": "Create tutorials in docs/tutorials/", "status": "in_progress"}, {"id": "4", "content": "Generate complete API documentation with JSDoc", "status": "pending"}, {"id": "5", "content": "Create load testing infrastructure with Artillery.io and K6", "status": "pending"}, {"id": "6", "content": "Update progress tracking to 100% and final verification", "status": "pending"}]