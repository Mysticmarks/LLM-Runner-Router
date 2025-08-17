# Migration Guide

This guide helps you upgrade LLM Runner Router from older versions and migrate from other LLM orchestration solutions.

## Table of Contents

1. [Version Migration](#version-migration)
2. [Configuration Migration](#configuration-migration)
3. [API Changes](#api-changes)
4. [Model Registry Migration](#model-registry-migration)
5. [Migration from Other Solutions](#migration-from-other-solutions)
6. [Breaking Changes](#breaking-changes)
7. [Migration Tools](#migration-tools)
8. [Rollback Procedures](#rollback-procedures)

## Version Migration

### From v1.0.x to v1.2.x

#### Prerequisites

```bash
# Backup your current installation
cp -r ./models ./models.backup
cp package.json package.json.backup
cp -r ./config ./config.backup

# Check current version
npm list llm-runner-router
```

#### Step-by-Step Migration

1. **Update the package**
```bash
npm install llm-runner-router@latest
```

2. **Update configuration format**
```javascript
// Old format (v1.0.x)
const router = new LLMRouter({
    maxConcurrentRequests: 10,
    enableCaching: true,
    logLevel: 'info'
});

// New format (v1.2.x)
const router = new LLMRouter({
    performance: {
        maxConcurrent: 10
    },
    cache: {
        enabled: true
    },
    logging: {
        level: 'info'
    }
});
```

3. **Update model registration**
```javascript
// Old format
await router.addModel({
    name: 'my-model',
    path: './models/model.gguf',
    type: 'gguf'
});

// New format
await router.registerModel({
    id: 'my-model',
    name: 'My Model',
    format: 'gguf',
    source: './models/model.gguf',
    config: {
        contextLength: 2048
    }
});
```

4. **Update API calls**
```javascript
// Old API
const result = await router.generate({
    input: 'Hello world',
    max_tokens: 50
});

// New API
const result = await router.process({
    prompt: 'Hello world',
    maxTokens: 50
});
```

#### Configuration Migration Script

```javascript
// migrate-config.js
import fs from 'fs';
import path from 'path';

function migrateConfig(oldConfig) {
    const newConfig = {
        performance: {},
        cache: {},
        logging: {},
        models: {},
        routing: {}
    };

    // Migrate performance settings
    if (oldConfig.maxConcurrentRequests) {
        newConfig.performance.maxConcurrent = oldConfig.maxConcurrentRequests;
    }
    if (oldConfig.requestTimeout) {
        newConfig.performance.timeout = oldConfig.requestTimeout;
    }

    // Migrate cache settings
    if (oldConfig.enableCaching !== undefined) {
        newConfig.cache.enabled = oldConfig.enableCaching;
    }
    if (oldConfig.cacheTTL) {
        newConfig.cache.ttl = oldConfig.cacheTTL;
    }

    // Migrate logging settings
    if (oldConfig.logLevel) {
        newConfig.logging.level = oldConfig.logLevel;
    }
    if (oldConfig.logFile) {
        newConfig.logging.file = oldConfig.logFile;
    }

    // Migrate model settings
    if (oldConfig.modelCacheDir) {
        newConfig.models.cacheDir = oldConfig.modelCacheDir;
    }
    if (oldConfig.autoDownload !== undefined) {
        newConfig.models.autoDownload = oldConfig.autoDownload;
    }

    // Migrate routing settings
    if (oldConfig.routingStrategy) {
        newConfig.routing.strategy = oldConfig.routingStrategy;
    }
    if (oldConfig.enableFallback !== undefined) {
        newConfig.routing.enableFallback = oldConfig.enableFallback;
    }

    return newConfig;
}

// Usage
const oldConfigPath = './config/old-config.json';
const newConfigPath = './config/new-config.json';

if (fs.existsSync(oldConfigPath)) {
    const oldConfig = JSON.parse(fs.readFileSync(oldConfigPath, 'utf8'));
    const newConfig = migrateConfig(oldConfig);
    
    fs.writeFileSync(newConfigPath, JSON.stringify(newConfig, null, 2));
    console.log('Configuration migrated successfully!');
} else {
    console.log('No old configuration found.');
}
```

### From v0.x to v1.x

#### Major Changes

1. **Module System Change**
```javascript
// Old (CommonJS)
const { LLMRouter } = require('llm-runner-router');

// New (ES Modules)
import { LLMRouter } from 'llm-runner-router';
```

2. **Constructor Changes**
```javascript
// Old
const router = new LLMRouter('./config.json');

// New
const router = new LLMRouter({
    configFile: './config.json'
});
```

3. **Async Initialization**
```javascript
// Old (synchronous)
const router = new LLMRouter(config);
router.loadModel('model-id');

// New (asynchronous)
const router = new LLMRouter(config);
await router.initialize();
await router.registerModel(modelConfig);
```

## Configuration Migration

### Environment Variables

```bash
# Old environment variables (v1.0.x)
LLM_MAX_CONCURRENT=10
LLM_CACHE_ENABLED=true
LLM_LOG_LEVEL=info

# New environment variables (v1.2.x)
MAX_CONCURRENT_REQUESTS=10
CACHE_ENABLED=true
LOG_LEVEL=info
```

### Configuration File Structure

```json
{
  "_comment": "Migration from v1.0.x to v1.2.x",
  "old": {
    "maxConcurrentRequests": 10,
    "enableCaching": true,
    "cacheTTL": 3600,
    "logLevel": "info",
    "modelCacheDir": "./models",
    "routingStrategy": "balanced"
  },
  "new": {
    "performance": {
      "maxConcurrent": 10
    },
    "cache": {
      "enabled": true,
      "ttl": 3600
    },
    "logging": {
      "level": "info"
    },
    "models": {
      "cacheDir": "./models"
    },
    "routing": {
      "strategy": "balanced"
    }
  }
}
```

## API Changes

### Method Naming Changes

```javascript
// v1.0.x → v1.2.x method mapping

// Model management
router.addModel() → router.registerModel()
router.removeModel() → router.unregisterModel()
router.getModels() → router.listModels()

// Inference
router.generate() → router.process()
router.generateStream() → router.processStream()
router.generateBatch() → router.processBatch()

// Configuration
router.setConfig() → router.updateConfig()
router.getConfig() → router.getConfig() // unchanged

// Status
router.status() → router.getStatus()
router.health() → router.checkHealth()
```

### Parameter Changes

```javascript
// Old parameter names → New parameter names
{
    input: "text" → prompt: "text",
    max_tokens: 100 → maxTokens: 100,
    model_id: "gpt-3.5" → model: "gpt-3.5",
    stream: true → streaming: true,
    temperature: 0.7 → temperature: 0.7, // unchanged
    top_p: 0.9 → topP: 0.9
}
```

### Response Format Changes

```javascript
// Old response format
{
    text: "Generated text",
    model: "model-id",
    usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
    }
}

// New response format
{
    response: "Generated text",
    modelUsed: "model-id",
    metrics: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        duration: 1234,
        cost: 0.001
    }
}
```

## Model Registry Migration

### Registry Format Migration

```javascript
// migrate-registry.js
import fs from 'fs';

function migrateModelRegistry(oldRegistry) {
    const newRegistry = {
        version: "1.2.0",
        models: [],
        templates: [],
        strategies: {}
    };

    // Migrate models
    if (oldRegistry.models) {
        newRegistry.models = oldRegistry.models.map(model => ({
            id: model.name || model.id,
            name: model.displayName || model.name,
            format: model.type || model.format,
            source: model.path || model.source,
            config: {
                contextLength: model.context_length || 2048,
                temperature: model.default_temperature || 0.7,
                ...model.parameters
            },
            capabilities: model.capabilities || ["text-generation"],
            performance: {
                tokensPerSecond: model.speed || null,
                memoryUsage: model.memory || null
            }
        }));
    }

    // Migrate templates
    if (oldRegistry.prompts) {
        newRegistry.templates = oldRegistry.prompts.map(prompt => ({
            id: prompt.name,
            name: prompt.displayName || prompt.name,
            format: prompt.template,
            stopTokens: prompt.stop_tokens || [],
            modelCompatibility: prompt.compatible_models || []
        }));
    }

    // Migrate strategies
    if (oldRegistry.routing) {
        newRegistry.strategies = oldRegistry.routing;
    }

    return newRegistry;
}

// Usage
const oldRegistryPath = './models/old-registry.json';
const newRegistryPath = './models/registry.json';

if (fs.existsSync(oldRegistryPath)) {
    const oldRegistry = JSON.parse(fs.readFileSync(oldRegistryPath, 'utf8'));
    const newRegistry = migrateModelRegistry(oldRegistry);
    
    fs.writeFileSync(newRegistryPath, JSON.stringify(newRegistry, null, 2));
    console.log('Model registry migrated successfully!');
}
```

### Model File Migration

```bash
#!/bin/bash
# migrate-models.sh

# Create new directory structure
mkdir -p models/cache
mkdir -p models/configs

# Move model files
for file in models/*.gguf; do
    if [ -f "$file" ]; then
        echo "Processing $file"
        # Extract model info and create config
        filename=$(basename "$file" .gguf)
        
        # Create model config
        cat > "models/configs/${filename}.json" << EOF
{
    "id": "${filename}",
    "name": "${filename^}",
    "format": "gguf",
    "source": "./models/cache/${filename}.gguf",
    "config": {
        "contextLength": 2048,
        "temperature": 0.7
    }
}
EOF
        
        # Move model file
        mv "$file" "models/cache/"
    fi
done

echo "Model migration completed!"
```

## Migration from Other Solutions

### From LangChain

```javascript
// LangChain to LLM Runner Router migration

// Old LangChain setup
import { OpenAI } from "langchain/llms/openai";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";

const llm = new OpenAI({ temperature: 0.7 });
const prompt = new PromptTemplate({
    template: "Answer this question: {question}",
    inputVariables: ["question"]
});
const chain = new LLMChain({ llm, prompt });

// New LLM Runner Router setup
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();

await router.registerModel({
    id: 'openai-gpt35',
    name: 'OpenAI GPT-3.5',
    format: 'api',
    provider: 'openai',
    config: { temperature: 0.7 }
});

// Usage comparison
// LangChain
const result = await chain.call({ question: "What is AI?" });

// LLM Runner Router
const result = await router.process({
    prompt: "Answer this question: What is AI?",
    model: 'openai-gpt35'
});
```

### From Ollama

```javascript
// Ollama to LLM Runner Router migration

// Old Ollama setup
import ollama from 'ollama';

// New LLM Runner Router setup
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();

// Migrate Ollama models
const ollamaModels = await ollama.list();
for (const model of ollamaModels) {
    await router.registerModel({
        id: model.name,
        name: model.name,
        format: 'gguf',
        source: `ollama://${model.name}`,
        config: {
            contextLength: model.details.parameter_size || 2048
        }
    });
}

// Usage migration
// Ollama
const response = await ollama.chat({
    model: 'llama2',
    messages: [{ role: 'user', content: 'Hello' }]
});

// LLM Runner Router
const response = await router.process({
    prompt: 'Hello',
    model: 'llama2'
});
```

### From Hugging Face Transformers

```python
# Python Transformers to Node.js LLM Runner Router

# Old Python setup
from transformers import pipeline

generator = pipeline("text-generation", model="gpt2")
result = generator("Hello world", max_length=50)
```

```javascript
// New LLM Runner Router setup
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();

await router.registerModel({
    id: 'gpt2',
    name: 'GPT-2',
    format: 'hf',
    source: 'gpt2',
    config: {
        maxLength: 50
    }
});

const result = await router.process({
    prompt: 'Hello world',
    model: 'gpt2',
    maxTokens: 50
});
```

## Breaking Changes

### v1.1.x to v1.2.x

1. **Configuration Structure**
   - Flat configuration replaced with nested structure
   - Environment variable naming changed

2. **API Response Format**
   - `text` field renamed to `response`
   - `usage` object renamed to `metrics`
   - Added new fields: `modelUsed`, `duration`, `cost`

3. **Model Registration**
   - `addModel()` renamed to `registerModel()`
   - Required fields changed: `id`, `name`, `format`, `source`

4. **Streaming API**
   - Event names changed: `token` → `chunk`, `end` → `complete`
   - Response format updated

### v1.0.x to v1.1.x

1. **Module System**
   - Switched from CommonJS to ES Modules
   - Requires `"type": "module"` in package.json

2. **Async Initialization**
   - Constructor no longer auto-initializes
   - Explicit `await router.initialize()` required

3. **Error Handling**
   - Error objects restructured
   - New error codes introduced

## Migration Tools

### Automated Migration Script

```javascript
// auto-migrate.js
import fs from 'fs';
import path from 'path';
import { LLMRouter } from 'llm-runner-router';

class MigrationTool {
    constructor(options = {}) {
        this.sourceVersion = options.sourceVersion;
        this.targetVersion = options.targetVersion || 'latest';
        this.backupDir = options.backupDir || './migration-backup';
    }

    async migrate() {
        console.log(`Migrating from v${this.sourceVersion} to v${this.targetVersion}`);
        
        // Create backup
        await this.createBackup();
        
        // Migrate configuration
        await this.migrateConfiguration();
        
        // Migrate model registry
        await this.migrateModelRegistry();
        
        // Update package.json
        await this.updatePackageJson();
        
        // Validate migration
        await this.validateMigration();
        
        console.log('Migration completed successfully!');
    }

    async createBackup() {
        console.log('Creating backup...');
        
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        const backupTargets = [
            'package.json',
            'config/',
            'models/',
            '.env'
        ];

        for (const target of backupTargets) {
            if (fs.existsSync(target)) {
                const backupPath = path.join(this.backupDir, target);
                fs.cpSync(target, backupPath, { recursive: true });
            }
        }
    }

    async migrateConfiguration() {
        console.log('Migrating configuration...');
        
        const configFiles = [
            'config/config.json',
            'config.json',
            '.llmrouter.json'
        ];

        for (const configFile of configFiles) {
            if (fs.existsSync(configFile)) {
                const oldConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                const newConfig = this.transformConfig(oldConfig);
                fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
            }
        }
    }

    transformConfig(oldConfig) {
        // Transform based on source version
        if (this.sourceVersion.startsWith('1.0')) {
            return this.transformFrom1_0(oldConfig);
        } else if (this.sourceVersion.startsWith('1.1')) {
            return this.transformFrom1_1(oldConfig);
        }
        return oldConfig;
    }

    transformFrom1_0(config) {
        return {
            performance: {
                maxConcurrent: config.maxConcurrentRequests || 10
            },
            cache: {
                enabled: config.enableCaching !== false,
                ttl: config.cacheTTL || 3600
            },
            logging: {
                level: config.logLevel || 'info'
            },
            models: {
                cacheDir: config.modelCacheDir || './models'
            },
            routing: {
                strategy: config.routingStrategy || 'balanced'
            }
        };
    }

    async validateMigration() {
        console.log('Validating migration...');
        
        try {
            const router = new LLMRouter();
            await router.initialize();
            
            const status = await router.getStatus();
            if (status.healthy) {
                console.log('✅ Migration validation successful');
            } else {
                throw new Error('Router not healthy after migration');
            }
        } catch (error) {
            console.error('❌ Migration validation failed:', error.message);
            throw error;
        }
    }
}

// Usage
const migrator = new MigrationTool({
    sourceVersion: '1.0.5',
    targetVersion: '1.2.1'
});

migrator.migrate().catch(console.error);
```

### Configuration Validator

```javascript
// validate-config.js
import Joi from 'joi';

const configSchema = Joi.object({
    performance: Joi.object({
        maxConcurrent: Joi.number().min(1).max(100),
        timeout: Joi.number().min(1000)
    }),
    cache: Joi.object({
        enabled: Joi.boolean(),
        ttl: Joi.number().min(0)
    }),
    logging: Joi.object({
        level: Joi.string().valid('debug', 'info', 'warn', 'error')
    })
});

function validateConfig(config) {
    const { error, value } = configSchema.validate(config);
    if (error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
    }
    return value;
}

export { validateConfig };
```

## Rollback Procedures

### Automatic Rollback

```javascript
// rollback.js
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class RollbackTool {
    constructor(backupDir = './migration-backup') {
        this.backupDir = backupDir;
    }

    async rollback() {
        console.log('Starting rollback process...');
        
        try {
            // Stop current service
            await this.stopService();
            
            // Restore from backup
            await this.restoreBackup();
            
            // Reinstall previous version
            await this.restorePreviousVersion();
            
            // Start service
            await this.startService();
            
            console.log('Rollback completed successfully!');
        } catch (error) {
            console.error('Rollback failed:', error.message);
            throw error;
        }
    }

    async stopService() {
        console.log('Stopping service...');
        try {
            execSync('pm2 stop llm-router', { stdio: 'inherit' });
        } catch (error) {
            // Service might not be running with PM2
            console.log('Service not running with PM2');
        }
    }

    async restoreBackup() {
        console.log('Restoring from backup...');
        
        if (!fs.existsSync(this.backupDir)) {
            throw new Error('Backup directory not found');
        }

        const backupItems = fs.readdirSync(this.backupDir);
        for (const item of backupItems) {
            const backupPath = path.join(this.backupDir, item);
            const targetPath = item;
            
            // Remove current version
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            }
            
            // Restore backup
            fs.cpSync(backupPath, targetPath, { recursive: true });
        }
    }

    async restorePreviousVersion() {
        console.log('Restoring previous package version...');
        
        const packageBackup = path.join(this.backupDir, 'package.json');
        if (fs.existsSync(packageBackup)) {
            const oldPackage = JSON.parse(fs.readFileSync(packageBackup, 'utf8'));
            const oldVersion = oldPackage.dependencies['llm-runner-router'];
            
            if (oldVersion) {
                execSync(`npm install llm-runner-router@${oldVersion}`, { stdio: 'inherit' });
            }
        }
    }

    async startService() {
        console.log('Starting service...');
        try {
            execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
        } catch (error) {
            console.log('Starting with npm...');
            execSync('npm start', { stdio: 'inherit' });
        }
    }
}

// Usage
const rollback = new RollbackTool();
rollback.rollback().catch(console.error);
```

### Manual Rollback Steps

```bash
#!/bin/bash
# manual-rollback.sh

echo "Starting manual rollback..."

# Stop current service
pm2 stop llm-router || echo "PM2 not running"
pkill -f "node.*llm-runner-router" || echo "No Node processes found"

# Restore backup
if [ -d "./migration-backup" ]; then
    echo "Restoring from backup..."
    cp -r ./migration-backup/* ./
else
    echo "No backup found!"
    exit 1
fi

# Reinstall dependencies
npm install

# Restart service
npm start &

echo "Rollback completed!"
```

For more detailed migration assistance, consult the [troubleshooting guide](./troubleshooting.md) or create an issue on [GitHub](https://github.com/MCERQUA/LLM-Runner-Router/issues).