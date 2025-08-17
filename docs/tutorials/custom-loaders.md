# Custom Loaders Tutorial

Learn how to create custom model loaders for LLM Runner Router to support new model formats, custom preprocessing, and specialized inference engines.

## Table of Contents

1. [Understanding Model Loaders](#understanding-model-loaders)
2. [Basic Custom Loader](#basic-custom-loader)
3. [Advanced Loader Features](#advanced-loader-features)
4. [Format-Specific Loaders](#format-specific-loaders)
5. [Remote Model Loaders](#remote-model-loaders)
6. [Preprocessing Loaders](#preprocessing-loaders)
7. [Testing and Validation](#testing-and-validation)
8. [Real-World Examples](#real-world-examples)

## Understanding Model Loaders

### What are Model Loaders?

Model loaders are responsible for:
- **Loading model files** from various sources (local, remote, databases)
- **Format conversion** between different model formats
- **Initialization** of inference engines
- **Configuration management** for model-specific settings
- **Resource management** (memory, GPU allocation)

### Loader Architecture

```javascript
// Base loader structure
class BaseLoader {
    constructor(config = {}) {
        this.config = config;
        this.format = 'custom';
        this.supportedExtensions = ['.custom'];
    }

    async load(modelPath, options = {}) {
        // Load model implementation
    }

    async unload(modelId) {
        // Cleanup implementation
    }

    async validate(modelPath) {
        // Validation implementation
    }

    getInfo() {
        // Return loader information
    }
}
```

### Loader Lifecycle

```
1. Registration → 2. Validation → 3. Loading → 4. Initialization → 5. Ready
                                     ↓
6. Inference ← ← ← ← ← ← ← ← ← ← ← ← ← 5
                                     ↓
7. Unloading → 8. Cleanup → 9. Disposed
```

## Basic Custom Loader

### Simple Text Model Loader

Create `01-simple-loader.js`:

```javascript
import { BaseLoader } from 'llm-runner-router/src/loaders/BaseLoader.js';
import fs from 'fs/promises';
import path from 'path';

class SimpleTextLoader extends BaseLoader {
    constructor(config = {}) {
        super(config);
        this.format = 'simple-text';
        this.supportedExtensions = ['.txt', '.simple'];
        this.models = new Map();
    }

    async load(modelPath, options = {}) {
        console.log(`📁 Loading simple text model from: ${modelPath}`);

        try {
            // Validate file exists
            await this.validate(modelPath);

            // Read the text file
            const content = await fs.readFile(modelPath, 'utf8');
            
            // Parse simple model format
            const model = this.parseSimpleModel(content);
            
            // Create model instance
            const modelId = options.id || path.basename(modelPath, path.extname(modelPath));
            const modelInstance = new SimpleTextModel(model, {
                ...this.config,
                ...options
            });

            // Store model
            this.models.set(modelId, modelInstance);

            console.log(`✅ Simple text model loaded: ${modelId}`);
            
            return {
                id: modelId,
                loader: this,
                instance: modelInstance,
                format: this.format,
                capabilities: ['text-generation'],
                metadata: {
                    size: content.length,
                    loadTime: Date.now(),
                    ...model.metadata
                }
            };

        } catch (error) {
            throw new Error(`Failed to load simple text model: ${error.message}`);
        }
    }

    async unload(modelId) {
        console.log(`🗑️ Unloading simple text model: ${modelId}`);
        
        const model = this.models.get(modelId);
        if (model) {
            await model.cleanup();
            this.models.delete(modelId);
            console.log(`✅ Model unloaded: ${modelId}`);
        }
    }

    async validate(modelPath) {
        try {
            const stats = await fs.stat(modelPath);
            if (!stats.isFile()) {
                throw new Error('Path is not a file');
            }

            const ext = path.extname(modelPath).toLowerCase();
            if (!this.supportedExtensions.includes(ext)) {
                throw new Error(`Unsupported file extension: ${ext}`);
            }

            return true;
        } catch (error) {
            throw new Error(`Validation failed: ${error.message}`);
        }
    }

    parseSimpleModel(content) {
        const lines = content.split('\n');
        const model = {
            metadata: {},
            responses: new Map(),
            patterns: []
        };

        let currentSection = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('# METADATA')) {
                currentSection = 'metadata';
                continue;
            } else if (trimmed.startsWith('# RESPONSES')) {
                currentSection = 'responses';
                continue;
            } else if (trimmed.startsWith('# PATTERNS')) {
                currentSection = 'patterns';
                continue;
            } else if (trimmed.startsWith('#') || !trimmed) {
                continue;
            }

            if (currentSection === 'metadata') {
                const [key, value] = trimmed.split('=');
                if (key && value) {
                    model.metadata[key.trim()] = value.trim();
                }
            } else if (currentSection === 'responses') {
                const [pattern, response] = trimmed.split('->');
                if (pattern && response) {
                    model.responses.set(pattern.trim(), response.trim());
                }
            } else if (currentSection === 'patterns') {
                model.patterns.push(trimmed);
            }
        }

        return model;
    }

    getInfo() {
        return {
            name: 'Simple Text Loader',
            format: this.format,
            version: '1.0.0',
            supportedExtensions: this.supportedExtensions,
            capabilities: ['text-generation'],
            loadedModels: Array.from(this.models.keys())
        };
    }
}

class SimpleTextModel {
    constructor(modelData, config = {}) {
        this.data = modelData;
        this.config = config;
        this.ready = true;
    }

    async generate(prompt, options = {}) {
        const maxTokens = options.maxTokens || 100;
        const temperature = options.temperature || 0.7;

        // Simple pattern matching
        for (const [pattern, response] of this.data.responses) {
            if (prompt.toLowerCase().includes(pattern.toLowerCase())) {
                return this.formatResponse(response, options);
            }
        }

        // Default response
        return this.formatResponse("I understand you said: " + prompt, options);
    }

    async generateStream(prompt, options = {}) {
        const response = await this.generate(prompt, options);
        
        // Simulate streaming by yielding character by character
        const chars = response.split('');
        
        return {
            async* [Symbol.asyncIterator]() {
                for (const char of chars) {
                    yield {
                        type: 'token',
                        token: char
                    };
                    
                    // Add small delay to simulate real streaming
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                yield {
                    type: 'end',
                    metadata: {
                        totalTokens: chars.length
                    }
                };
            }
        };
    }

    formatResponse(response, options) {
        // Apply temperature-based randomization
        if (options.temperature > 0.5) {
            response = this.addVariation(response);
        }

        return response;
    }

    addVariation(text) {
        // Simple variation: occasionally add extra phrases
        const variations = [
            ' Indeed.',
            ' That\'s interesting.',
            ' I see.',
            ' Understood.'
        ];

        if (Math.random() < 0.3) {
            const variation = variations[Math.floor(Math.random() * variations.length)];
            return text + variation;
        }

        return text;
    }

    async cleanup() {
        // Cleanup resources if needed
        this.ready = false;
    }
}

// Example model file content
const exampleModelContent = `
# METADATA
name=Simple Chat Model
version=1.0
author=Tutorial
description=A simple pattern-matching model

# RESPONSES
hello->Hello! How can I help you today?
goodbye->Goodbye! Have a great day!
help->I can help you with basic questions. Just ask!
weather->I don't have access to weather data, but I hope it's nice where you are!

# PATTERNS
greeting
farewell
assistance
meteorology
`;

// Usage example
async function testSimpleLoader() {
    console.log('🧪 Testing Simple Text Loader\n');

    // Create example model file
    await fs.writeFile('./simple-model.txt', exampleModelContent);

    const loader = new SimpleTextLoader();
    
    try {
        // Load the model
        const loadResult = await loader.load('./simple-model.txt', {
            id: 'simple-chat',
            temperature: 0.7
        });

        console.log('Model loaded:', loadResult.id);
        console.log('Capabilities:', loadResult.capabilities);
        console.log('Metadata:', loadResult.metadata);

        // Test inference
        const model = loadResult.instance;
        
        const testPrompts = [
            'Hello there!',
            'Can you help me?',
            'What\'s the weather like?',
            'Goodbye!',
            'Random question'
        ];

        for (const prompt of testPrompts) {
            console.log(`\nPrompt: ${prompt}`);
            const response = await model.generate(prompt);
            console.log(`Response: ${response}`);
        }

        // Test streaming
        console.log('\n🔄 Testing streaming...');
        console.log('Prompt: Hello streaming!');
        console.log('Streaming response: ');
        
        const stream = await model.generateStream('Hello streaming!');
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
            } else if (chunk.type === 'end') {
                console.log(`\nTotal tokens: ${chunk.metadata.totalTokens}`);
            }
        }

        // Cleanup
        await loader.unload('simple-chat');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Cleanup test file
        try {
            await fs.unlink('./simple-model.txt');
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// Run the test
testSimpleLoader();

export { SimpleTextLoader, SimpleTextModel };
```

## Advanced Loader Features

### Loader with Caching and Optimization

Create `02-advanced-loader.js`:

```javascript
import { BaseLoader } from 'llm-runner-router/src/loaders/BaseLoader.js';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

class AdvancedCustomLoader extends BaseLoader {
    constructor(config = {}) {
        super(config);
        this.format = 'advanced-custom';
        this.supportedExtensions = ['.adv', '.custom'];
        this.cache = new Map();
        this.loadingPromises = new Map();
        this.maxCacheSize = config.maxCacheSize || 5;
        this.enablePreprocessing = config.enablePreprocessing !== false;
    }

    async load(modelPath, options = {}) {
        const modelId = options.id || this.generateModelId(modelPath);
        
        // Check if already loading
        if (this.loadingPromises.has(modelId)) {
            console.log(`⏳ Model ${modelId} is already being loaded, waiting...`);
            return await this.loadingPromises.get(modelId);
        }

        // Check cache
        if (this.cache.has(modelId) && !options.forceReload) {
            console.log(`📦 Loading model ${modelId} from cache`);
            return this.cache.get(modelId);
        }

        // Start loading
        const loadPromise = this._loadInternal(modelPath, modelId, options);
        this.loadingPromises.set(modelId, loadPromise);

        try {
            const result = await loadPromise;
            
            // Cache result
            this.addToCache(modelId, result);
            
            return result;
        } finally {
            this.loadingPromises.delete(modelId);
        }
    }

    async _loadInternal(modelPath, modelId, options) {
        console.log(`🔄 Loading advanced model: ${modelId}`);
        
        const startTime = Date.now();
        
        try {
            // Step 1: Validation
            await this.validate(modelPath);
            
            // Step 2: Read and parse
            const rawData = await fs.readFile(modelPath);
            const modelData = await this.parseModel(rawData, options);
            
            // Step 3: Preprocessing (if enabled)
            if (this.enablePreprocessing) {
                await this.preprocessModel(modelData, options);
            }
            
            // Step 4: Optimization
            await this.optimizeModel(modelData, options);
            
            // Step 5: Create instance
            const instance = new AdvancedModelInstance(modelData, {
                ...this.config,
                ...options
            });
            
            await instance.initialize();
            
            const loadTime = Date.now() - startTime;
            
            console.log(`✅ Advanced model loaded in ${loadTime}ms: ${modelId}`);
            
            return {
                id: modelId,
                loader: this,
                instance,
                format: this.format,
                capabilities: modelData.capabilities || ['text-generation'],
                metadata: {
                    ...modelData.metadata,
                    loadTime,
                    cacheKey: modelId,
                    preprocessed: this.enablePreprocessing,
                    optimized: true
                }
            };
            
        } catch (error) {
            throw new Error(`Failed to load advanced model ${modelId}: ${error.message}`);
        }
    }

    async parseModel(rawData, options) {
        // Determine format from magic bytes or header
        const header = rawData.slice(0, 16);
        
        if (header.toString('utf8', 0, 4) === 'ADV\x00') {
            return this.parseBinaryFormat(rawData);
        } else {
            return this.parseTextFormat(rawData.toString('utf8'));
        }
    }

    async parseBinaryFormat(data) {
        console.log('📊 Parsing binary format model');
        
        // Simple binary format parser
        let offset = 4; // Skip magic bytes
        
        // Read header
        const version = data.readUInt32LE(offset); offset += 4;
        const metadataLength = data.readUInt32LE(offset); offset += 4;
        const dataLength = data.readUInt32LE(offset); offset += 4;
        
        // Read metadata
        const metadataBuffer = data.slice(offset, offset + metadataLength);
        const metadata = JSON.parse(metadataBuffer.toString('utf8'));
        offset += metadataLength;
        
        // Read model data
        const modelBuffer = data.slice(offset, offset + dataLength);
        
        return {
            version,
            metadata,
            data: modelBuffer,
            format: 'binary',
            capabilities: metadata.capabilities || ['text-generation']
        };
    }

    async parseTextFormat(content) {
        console.log('📝 Parsing text format model');
        
        try {
            const parsed = JSON.parse(content);
            return {
                ...parsed,
                format: 'text',
                capabilities: parsed.capabilities || ['text-generation']
            };
        } catch (error) {
            // Fallback to simple format
            return {
                content,
                format: 'simple-text',
                capabilities: ['text-generation'],
                metadata: { parsedAt: Date.now() }
            };
        }
    }

    async preprocessModel(modelData, options) {
        console.log('⚙️ Preprocessing model...');
        
        // Example preprocessing steps
        if (modelData.format === 'text' && modelData.vocabulary) {
            // Build vocabulary index
            modelData.vocabIndex = new Map();
            modelData.vocabulary.forEach((word, index) => {
                modelData.vocabIndex.set(word, index);
            });
        }
        
        if (modelData.weights) {
            // Normalize weights
            const max = Math.max(...modelData.weights);
            modelData.normalizedWeights = modelData.weights.map(w => w / max);
        }
        
        // Add preprocessing timestamp
        modelData.preprocessedAt = Date.now();
    }

    async optimizeModel(modelData, options) {
        console.log('🚀 Optimizing model...');
        
        // Example optimizations
        if (options.quantize && modelData.weights) {
            modelData.quantizedWeights = this.quantizeWeights(modelData.weights);
        }
        
        if (options.compress && modelData.data) {
            // Simulate compression
            modelData.compressed = true;
            modelData.originalSize = modelData.data.length;
        }
        
        modelData.optimizedAt = Date.now();
    }

    quantizeWeights(weights) {
        // Simple 8-bit quantization
        return weights.map(w => Math.round(w * 255) / 255);
    }

    generateModelId(modelPath) {
        const hash = crypto.createHash('md5');
        hash.update(modelPath);
        return `model_${hash.digest('hex').substring(0, 8)}`;
    }

    addToCache(modelId, result) {
        // Implement LRU cache
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            const evicted = this.cache.get(firstKey);
            this.cache.delete(firstKey);
            
            // Cleanup evicted model
            if (evicted.instance) {
                evicted.instance.cleanup();
            }
            
            console.log(`💨 Evicted model from cache: ${firstKey}`);
        }
        
        this.cache.set(modelId, result);
        console.log(`💾 Added model to cache: ${modelId} (${this.cache.size}/${this.maxCacheSize})`);
    }

    async unload(modelId) {
        console.log(`🗑️ Unloading advanced model: ${modelId}`);
        
        // Remove from cache
        const cached = this.cache.get(modelId);
        if (cached) {
            await cached.instance.cleanup();
            this.cache.delete(modelId);
        }
        
        // Cancel any pending loads
        if (this.loadingPromises.has(modelId)) {
            this.loadingPromises.delete(modelId);
        }
        
        console.log(`✅ Model unloaded: ${modelId}`);
    }

    async validate(modelPath) {
        const stats = await fs.stat(modelPath);
        if (!stats.isFile()) {
            throw new Error('Path is not a file');
        }

        if (stats.size === 0) {
            throw new Error('Model file is empty');
        }

        if (stats.size > 100 * 1024 * 1024) { // 100MB limit
            throw new Error('Model file too large (>100MB)');
        }

        return true;
    }

    getInfo() {
        return {
            name: 'Advanced Custom Loader',
            format: this.format,
            version: '2.0.0',
            supportedExtensions: this.supportedExtensions,
            capabilities: ['text-generation', 'preprocessing', 'optimization'],
            features: [
                'Binary and text format support',
                'Built-in caching',
                'Model preprocessing',
                'Weight quantization',
                'LRU cache eviction'
            ],
            cache: {
                size: this.cache.size,
                maxSize: this.maxCacheSize,
                keys: Array.from(this.cache.keys())
            }
        };
    }
}

class AdvancedModelInstance {
    constructor(modelData, config = {}) {
        this.data = modelData;
        this.config = config;
        this.ready = false;
        this.stats = {
            inferenceCount: 0,
            totalTokens: 0,
            avgResponseTime: 0
        };
    }

    async initialize() {
        console.log('🔧 Initializing advanced model instance...');
        
        // Simulate initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.ready = true;
        console.log('✅ Model instance ready');
    }

    async generate(prompt, options = {}) {
        if (!this.ready) {
            throw new Error('Model not ready');
        }

        const startTime = Date.now();
        this.stats.inferenceCount++;

        try {
            // Advanced generation logic
            const response = await this.advancedGenerate(prompt, options);
            
            const responseTime = Date.now() - startTime;
            this.updateStats(response, responseTime);
            
            return response;
        } catch (error) {
            throw new Error(`Generation failed: ${error.message}`);
        }
    }

    async advancedGenerate(prompt, options) {
        const maxTokens = options.maxTokens || 100;
        const temperature = options.temperature || 0.7;
        
        // Use model data for generation
        if (this.data.format === 'binary') {
            return this.generateFromBinary(prompt, options);
        } else {
            return this.generateFromText(prompt, options);
        }
    }

    generateFromBinary(prompt, options) {
        // Simulate advanced binary model inference
        const responses = [
            `Processing "${prompt}" with binary model...`,
            `Advanced analysis of: ${prompt}`,
            `Binary model response to: ${prompt}`
        ];
        
        const index = prompt.length % responses.length;
        return responses[index];
    }

    generateFromText(prompt, options) {
        // Enhanced text-based generation
        const baseResponse = `Advanced response to: ${prompt}`;
        
        if (this.data.normalizedWeights) {
            return `${baseResponse} (using normalized weights)`;
        }
        
        return baseResponse;
    }

    async generateStream(prompt, options = {}) {
        const response = await this.generate(prompt, options);
        const tokens = response.split(' ');
        
        return {
            async* [Symbol.asyncIterator]() {
                for (let i = 0; i < tokens.length; i++) {
                    const token = i === 0 ? tokens[i] : ' ' + tokens[i];
                    
                    yield {
                        type: 'token',
                        token,
                        index: i,
                        metadata: { progress: (i + 1) / tokens.length }
                    };
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                yield {
                    type: 'end',
                    metadata: {
                        totalTokens: tokens.length,
                        modelStats: this.stats
                    }
                };
            }
        };
    }

    updateStats(response, responseTime) {
        const tokens = response.split(' ').length;
        this.stats.totalTokens += tokens;
        
        // Update average response time
        const totalTime = this.stats.avgResponseTime * (this.stats.inferenceCount - 1) + responseTime;
        this.stats.avgResponseTime = totalTime / this.stats.inferenceCount;
    }

    getStats() {
        return { ...this.stats };
    }

    async cleanup() {
        console.log('🧹 Cleaning up advanced model instance...');
        this.ready = false;
        // Cleanup resources
    }
}

// Usage example with binary model
async function testAdvancedLoader() {
    console.log('🧪 Testing Advanced Custom Loader\n');

    // Create example binary model
    const binaryModel = Buffer.alloc(1024);
    binaryModel.write('ADV\x00', 0); // Magic bytes
    binaryModel.writeUInt32LE(1, 4); // Version
    
    const metadata = JSON.stringify({
        name: 'Advanced Test Model',
        capabilities: ['text-generation', 'analysis'],
        weights: [0.1, 0.2, 0.3, 0.4, 0.5]
    });
    
    binaryModel.writeUInt32LE(metadata.length, 8); // Metadata length
    binaryModel.writeUInt32LE(100, 12); // Data length
    binaryModel.write(metadata, 16);

    await fs.writeFile('./advanced-model.adv', binaryModel);

    const loader = new AdvancedCustomLoader({
        maxCacheSize: 3,
        enablePreprocessing: true
    });

    try {
        // Load model with optimization
        const result = await loader.load('./advanced-model.adv', {
            id: 'advanced-test',
            quantize: true,
            compress: true
        });

        console.log('📊 Loader info:', loader.getInfo());
        console.log('📋 Model metadata:', result.metadata);

        // Test inference
        const model = result.instance;
        const testPrompts = [
            'Analyze this data',
            'Generate a report',
            'Process this information'
        ];

        for (const prompt of testPrompts) {
            const response = await model.generate(prompt);
            console.log(`\nPrompt: ${prompt}`);
            console.log(`Response: ${response}`);
        }

        console.log('\n📈 Model stats:', model.getStats());

        // Test streaming
        console.log('\n🔄 Testing streaming...');
        const stream = await model.generateStream('Stream this response');
        
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
            } else if (chunk.type === 'end') {
                console.log(`\nFinal stats:`, chunk.metadata.modelStats);
            }
        }

        await loader.unload('advanced-test');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await fs.unlink('./advanced-model.adv').catch(() => {});
    }
}

testAdvancedLoader();

export { AdvancedCustomLoader };
```

## Format-Specific Loaders

### CSV Data Model Loader

Create `03-csv-loader.js`:

```javascript
import { BaseLoader } from 'llm-runner-router/src/loaders/BaseLoader.js';
import fs from 'fs/promises';

class CSVModelLoader extends BaseLoader {
    constructor(config = {}) {
        super(config);
        this.format = 'csv-data';
        this.supportedExtensions = ['.csv'];
        this.delimiter = config.delimiter || ',';
        this.hasHeader = config.hasHeader !== false;
    }

    async load(modelPath, options = {}) {
        console.log(`📊 Loading CSV data model: ${modelPath}`);

        try {
            const content = await fs.readFile(modelPath, 'utf8');
            const data = this.parseCSV(content);
            
            const modelId = options.id || 'csv-model';
            const instance = new CSVDataModel(data, {
                ...this.config,
                ...options
            });

            return {
                id: modelId,
                loader: this,
                instance,
                format: this.format,
                capabilities: ['data-query', 'text-generation'],
                metadata: {
                    rows: data.length,
                    columns: data.length > 0 ? Object.keys(data[0]).length : 0,
                    loadTime: Date.now()
                }
            };

        } catch (error) {
            throw new Error(`Failed to load CSV model: ${error.message}`);
        }
    }

    parseCSV(content) {
        const lines = content.trim().split('\n');
        const rows = [];

        if (lines.length === 0) return rows;

        const headers = this.hasHeader ? 
            this.parseLine(lines[0]) : 
            Array.from({ length: this.parseLine(lines[0]).length }, (_, i) => `col_${i}`);

        const startIndex = this.hasHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const values = this.parseLine(lines[i]);
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            rows.push(row);
        }

        return rows;
    }

    parseLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === this.delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    async validate(modelPath) {
        const stats = await fs.stat(modelPath);
        if (!stats.isFile()) {
            throw new Error('Path is not a file');
        }

        // Quick content check
        const sample = await fs.readFile(modelPath, { encoding: 'utf8', flag: 'r' });
        const firstLine = sample.split('\n')[0];
        
        if (!firstLine.includes(this.delimiter)) {
            throw new Error(`No delimiter '${this.delimiter}' found in first line`);
        }

        return true;
    }

    getInfo() {
        return {
            name: 'CSV Data Model Loader',
            format: this.format,
            version: '1.0.0',
            supportedExtensions: this.supportedExtensions,
            capabilities: ['data-query', 'text-generation'],
            config: {
                delimiter: this.delimiter,
                hasHeader: this.hasHeader
            }
        };
    }
}

class CSVDataModel {
    constructor(data, config = {}) {
        this.data = data;
        this.config = config;
        this.ready = true;
        this.buildIndex();
    }

    buildIndex() {
        // Build search index for faster queries
        this.index = new Map();
        
        this.data.forEach((row, rowIndex) => {
            Object.entries(row).forEach(([column, value]) => {
                const key = `${column}:${value.toLowerCase()}`;
                if (!this.index.has(key)) {
                    this.index.set(key, []);
                }
                this.index.get(key).push(rowIndex);
            });
        });
    }

    async generate(prompt, options = {}) {
        // Interpret prompt as a query
        const query = this.parseQuery(prompt);
        const results = this.executeQuery(query);
        
        return this.formatResults(results, query, options);
    }

    parseQuery(prompt) {
        const query = {
            type: 'general',
            filters: [],
            columns: [],
            limit: 10
        };

        const lowerPrompt = prompt.toLowerCase();

        // Detect query type
        if (lowerPrompt.includes('show') || lowerPrompt.includes('list')) {
            query.type = 'show';
        } else if (lowerPrompt.includes('count') || lowerPrompt.includes('how many')) {
            query.type = 'count';
        } else if (lowerPrompt.includes('find') || lowerPrompt.includes('search')) {
            query.type = 'search';
        }

        // Extract filters (simple pattern matching)
        const filterPatterns = [
            /where (\w+) (?:is|equals?) (\w+)/gi,
            /(\w+) = (\w+)/gi,
            /(\w+): (\w+)/gi
        ];

        for (const pattern of filterPatterns) {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                query.filters.push({
                    column: match[1],
                    value: match[2]
                });
            }
        }

        // Extract limit
        const limitMatch = /limit (\d+)/i.exec(prompt);
        if (limitMatch) {
            query.limit = parseInt(limitMatch[1]);
        }

        return query;
    }

    executeQuery(query) {
        let results = [...this.data];

        // Apply filters
        for (const filter of query.filters) {
            results = results.filter(row => {
                const value = row[filter.column];
                return value && value.toLowerCase().includes(filter.value.toLowerCase());
            });
        }

        // Apply limit
        if (query.limit) {
            results = results.slice(0, query.limit);
        }

        return results;
    }

    formatResults(results, query, options) {
        if (query.type === 'count') {
            return `Found ${results.length} matching records.`;
        }

        if (results.length === 0) {
            return 'No matching records found.';
        }

        if (results.length === 1) {
            const record = results[0];
            const fields = Object.entries(record)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            return `Found 1 record: ${fields}`;
        }

        // Multiple results
        const summary = `Found ${results.length} records:\n`;
        const items = results.slice(0, 5).map((record, index) => {
            const firstFewFields = Object.entries(record)
                .slice(0, 3)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            return `${index + 1}. ${firstFewFields}`;
        }).join('\n');

        const more = results.length > 5 ? `\n... and ${results.length - 5} more records` : '';
        
        return summary + items + more;
    }

    async generateStream(prompt, options = {}) {
        const response = await this.generate(prompt, options);
        const words = response.split(' ');

        return {
            async* [Symbol.asyncIterator]() {
                for (let i = 0; i < words.length; i++) {
                    const word = i === 0 ? words[i] : ' ' + words[i];
                    
                    yield {
                        type: 'token',
                        token: word
                    };
                    
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                yield {
                    type: 'end',
                    metadata: {
                        totalTokens: words.length,
                        dataRows: this.data.length
                    }
                };
            }
        };
    }

    async cleanup() {
        this.ready = false;
    }
}

// Example usage
async function testCSVLoader() {
    console.log('🧪 Testing CSV Data Model Loader\n');

    // Create example CSV data
    const csvData = `name,age,city,occupation
John Doe,30,New York,Engineer
Jane Smith,25,Los Angeles,Designer
Bob Johnson,35,Chicago,Manager
Alice Brown,28,Boston,Developer
Charlie Wilson,32,Seattle,Analyst`;

    await fs.writeFile('./test-data.csv', csvData);

    const loader = new CSVModelLoader({
        delimiter: ',',
        hasHeader: true
    });

    try {
        const result = await loader.load('./test-data.csv', {
            id: 'employee-data'
        });

        console.log('📊 CSV Model loaded:');
        console.log('Metadata:', result.metadata);

        const model = result.instance;

        // Test various queries
        const queries = [
            'Show all records',
            'Count total records',
            'Find people where city is New York',
            'List employees where age = 30',
            'Show occupation: Engineer',
            'How many people work in Boston?'
        ];

        for (const query of queries) {
            console.log(`\nQuery: ${query}`);
            const response = await model.generate(query);
            console.log(`Response: ${response}`);
        }

        await loader.unload('employee-data');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await fs.unlink('./test-data.csv').catch(() => {});
    }
}

testCSVLoader();

export { CSVModelLoader, CSVDataModel };
```

## Remote Model Loaders

### HTTP API Model Loader

Create `04-remote-loader.js`:

```javascript
import { BaseLoader } from 'llm-runner-router/src/loaders/BaseLoader.js';
import https from 'https';
import http from 'http';

class RemoteAPILoader extends BaseLoader {
    constructor(config = {}) {
        super(config);
        this.format = 'remote-api';
        this.supportedExtensions = []; // No file extensions for remote
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 3;
    }

    async load(modelIdentifier, options = {}) {
        console.log(`🌐 Loading remote API model: ${modelIdentifier}`);

        try {
            // Parse model identifier (URL or endpoint)
            const endpoint = this.parseEndpoint(modelIdentifier);
            
            // Validate endpoint
            await this.validateEndpoint(endpoint);

            // Create model instance
            const modelId = options.id || this.extractModelId(endpoint);
            const instance = new RemoteAPIModel(endpoint, {
                ...this.config,
                ...options,
                loader: this
            });

            await instance.initialize();

            return {
                id: modelId,
                loader: this,
                instance,
                format: this.format,
                capabilities: await instance.getCapabilities(),
                metadata: {
                    endpoint: endpoint.url,
                    provider: endpoint.provider,
                    loadTime: Date.now()
                }
            };

        } catch (error) {
            throw new Error(`Failed to load remote API model: ${error.message}`);
        }
    }

    parseEndpoint(identifier) {
        if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
            return {
                url: identifier,
                provider: this.detectProvider(identifier),
                type: 'direct'
            };
        }

        // Handle provider-specific identifiers
        if (identifier.startsWith('openai:')) {
            return {
                url: 'https://api.openai.com/v1/chat/completions',
                provider: 'openai',
                model: identifier.replace('openai:', ''),
                type: 'provider'
            };
        }

        if (identifier.startsWith('anthropic:')) {
            return {
                url: 'https://api.anthropic.com/v1/messages',
                provider: 'anthropic',
                model: identifier.replace('anthropic:', ''),
                type: 'provider'
            };
        }

        throw new Error(`Unsupported model identifier: ${identifier}`);
    }

    detectProvider(url) {
        if (url.includes('openai.com')) return 'openai';
        if (url.includes('anthropic.com')) return 'anthropic';
        if (url.includes('huggingface.co')) return 'huggingface';
        return 'custom';
    }

    extractModelId(endpoint) {
        if (endpoint.model) return endpoint.model;
        
        // Extract from URL
        const url = new URL(endpoint.url);
        const pathParts = url.pathname.split('/');
        return pathParts[pathParts.length - 1] || 'remote-model';
    }

    async validateEndpoint(endpoint) {
        try {
            // Simple HEAD request to check if endpoint is reachable
            await this.makeRequest(endpoint.url, 'HEAD', {}, { timeout: 5000 });
            return true;
        } catch (error) {
            // If HEAD fails, try a simple GET/POST
            try {
                await this.makeRequest(endpoint.url, 'GET', {}, { timeout: 5000 });
                return true;
            } catch (secondError) {
                throw new Error(`Endpoint validation failed: ${secondError.message}`);
            }
        }
    }

    async makeRequest(url, method = 'POST', data = {}, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'LLM-Runner-Router/1.0',
                    ...this.getAuthHeaders(),
                    ...options.headers
                },
                timeout: options.timeout || this.timeout
            };

            const req = client.request(requestOptions, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = responseData ? JSON.parse(responseData) : {};
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({
                                statusCode: res.statusCode,
                                headers: res.headers,
                                data: parsed
                            });
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || responseData}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${parseError.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (method !== 'HEAD' && method !== 'GET' && data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    getAuthHeaders() {
        const headers = {};
        
        if (this.apiKey) {
            // Different providers use different auth headers
            if (this.baseUrl && this.baseUrl.includes('openai.com')) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            } else if (this.baseUrl && this.baseUrl.includes('anthropic.com')) {
                headers['x-api-key'] = this.apiKey;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }
        }
        
        return headers;
    }

    async unload(modelId) {
        console.log(`🌐 Unloading remote API model: ${modelId}`);
        // Remote models don't need explicit cleanup
    }

    getInfo() {
        return {
            name: 'Remote API Model Loader',
            format: this.format,
            version: '1.0.0',
            supportedExtensions: this.supportedExtensions,
            capabilities: ['text-generation', 'chat', 'remote-inference'],
            features: [
                'Multiple API provider support',
                'Automatic retry logic',
                'Authentication handling',
                'Endpoint validation'
            ]
        };
    }
}

class RemoteAPIModel {
    constructor(endpoint, config = {}) {
        this.endpoint = endpoint;
        this.config = config;
        this.loader = config.loader;
        this.ready = false;
        this.stats = {
            requestCount: 0,
            totalLatency: 0,
            errorCount: 0
        };
    }

    async initialize() {
        console.log('🔧 Initializing remote API model...');
        
        try {
            // Test the connection
            await this.testConnection();
            this.ready = true;
            console.log('✅ Remote API model ready');
        } catch (error) {
            throw new Error(`Initialization failed: ${error.message}`);
        }
    }

    async testConnection() {
        // Minimal test request
        const testData = this.buildRequest('test', { maxTokens: 1 });
        
        try {
            await this.loader.makeRequest(this.endpoint.url, 'POST', testData, {
                timeout: 5000
            });
        } catch (error) {
            // Some APIs might not accept test requests, that's ok
            if (!error.message.includes('400') && !error.message.includes('401')) {
                throw error;
            }
        }
    }

    async generate(prompt, options = {}) {
        if (!this.ready) {
            throw new Error('Model not ready');
        }

        const startTime = Date.now();
        this.stats.requestCount++;

        try {
            const requestData = this.buildRequest(prompt, options);
            const response = await this.makeRequestWithRetry(requestData);
            
            const latency = Date.now() - startTime;
            this.stats.totalLatency += latency;
            
            return this.parseResponse(response);

        } catch (error) {
            this.stats.errorCount++;
            throw new Error(`Generation failed: ${error.message}`);
        }
    }

    buildRequest(prompt, options) {
        const baseRequest = {
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 100
        };

        switch (this.endpoint.provider) {
            case 'openai':
                return {
                    ...baseRequest,
                    model: this.endpoint.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    stream: false
                };

            case 'anthropic':
                return {
                    ...baseRequest,
                    model: this.endpoint.model || 'claude-3-haiku-20240307',
                    messages: [{ role: 'user', content: prompt }]
                };

            default:
                return {
                    ...baseRequest,
                    prompt,
                    model: this.endpoint.model
                };
        }
    }

    parseResponse(response) {
        switch (this.endpoint.provider) {
            case 'openai':
                return response.data.choices[0].message.content;

            case 'anthropic':
                return response.data.content[0].text;

            default:
                return response.data.text || response.data.response || 
                       JSON.stringify(response.data);
        }
    }

    async makeRequestWithRetry(requestData) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.loader.maxRetries; attempt++) {
            try {
                return await this.loader.makeRequest(
                    this.endpoint.url, 
                    'POST', 
                    requestData
                );
            } catch (error) {
                lastError = error;
                
                if (attempt < this.loader.maxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                    console.log(`⏳ Retry ${attempt}/${this.loader.maxRetries} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    async generateStream(prompt, options = {}) {
        // For demonstration, we'll simulate streaming from the response
        const response = await this.generate(prompt, { ...options, stream: false });
        const words = response.split(' ');

        return {
            async* [Symbol.asyncIterator]() {
                for (let i = 0; i < words.length; i++) {
                    const word = i === 0 ? words[i] : ' ' + words[i];
                    
                    yield {
                        type: 'token',
                        token: word
                    };
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                yield {
                    type: 'end',
                    metadata: {
                        totalTokens: words.length,
                        provider: this.endpoint.provider,
                        stats: this.getStats()
                    }
                };
            }
        };
    }

    async getCapabilities() {
        const baseCapabilities = ['text-generation'];
        
        switch (this.endpoint.provider) {
            case 'openai':
                return [...baseCapabilities, 'chat', 'function-calling'];
            case 'anthropic':
                return [...baseCapabilities, 'chat', 'analysis'];
            default:
                return baseCapabilities;
        }
    }

    getStats() {
        return {
            ...this.stats,
            avgLatency: this.stats.requestCount > 0 ? 
                this.stats.totalLatency / this.stats.requestCount : 0,
            errorRate: this.stats.requestCount > 0 ? 
                this.stats.errorCount / this.stats.requestCount : 0
        };
    }

    async cleanup() {
        this.ready = false;
    }
}

// Usage example
async function testRemoteLoader() {
    console.log('🧪 Testing Remote API Loader\n');

    // Note: This example won't work without actual API keys
    const loader = new RemoteAPILoader({
        apiKey: process.env.OPENAI_API_KEY, // Would need real API key
        timeout: 10000,
        maxRetries: 2
    });

    try {
        // Try loading different remote models
        const endpoints = [
            'https://httpbin.org/post', // Mock endpoint for testing
            // 'openai:gpt-3.5-turbo', // Would work with real API key
            // 'anthropic:claude-3-haiku-20240307' // Would work with real API key
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`🔄 Testing endpoint: ${endpoint}`);
                
                const result = await loader.load(endpoint, {
                    id: `remote-${Date.now()}`
                });

                console.log('✅ Remote model loaded:', result.id);
                console.log('Capabilities:', result.capabilities);
                console.log('Metadata:', result.metadata);

                // Test inference (will fail with mock endpoint, but shows the flow)
                try {
                    const response = await result.instance.generate('Hello, world!');
                    console.log('Response:', response);
                } catch (inferenceError) {
                    console.log('⚠️ Inference test failed (expected with mock endpoint):', inferenceError.message);
                }

                await loader.unload(result.id);

            } catch (error) {
                console.log(`❌ Failed to load ${endpoint}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testRemoteLoader();

export { RemoteAPILoader, RemoteAPIModel };
```

## Testing and Validation

### Comprehensive Loader Testing

Create `05-loader-testing.js`:

```javascript
import { SimpleTextLoader } from './01-simple-loader.js';
import { AdvancedCustomLoader } from './02-advanced-loader.js';
import { CSVModelLoader } from './03-csv-loader.js';
import fs from 'fs/promises';

class LoaderTestSuite {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runAllTests() {
        console.log('🧪 Running Loader Test Suite\n');
        console.log('='.repeat(60));

        for (const test of this.tests) {
            await this.runTest(test);
        }

        this.printSummary();
    }

    async runTest(test) {
        console.log(`\n🔬 Test: ${test.name}`);
        console.log('-'.repeat(40));

        const startTime = Date.now();

        try {
            await test.testFn();
            const duration = Date.now() - startTime;
            console.log(`✅ PASSED (${duration}ms)`);
            this.results.passed++;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ FAILED (${duration}ms)`);
            console.log(`Error: ${error.message}`);
            this.results.failed++;
        }

        this.results.total++;
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log(`Total tests: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success rate: ${(this.results.passed / this.results.total * 100).toFixed(1)}%`);

        if (this.results.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Review the output above.');
        }
    }

    // Assertion helpers
    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    }

    assertNotNull(value, message) {
        if (value === null || value === undefined) {
            throw new Error(message || 'Value is null or undefined');
        }
    }

    async assertThrows(fn, message) {
        try {
            await fn();
            throw new Error(message || 'Expected function to throw, but it did not');
        } catch (error) {
            // Expected behavior
        }
    }
}

// Test implementations
async function testSimpleLoader(suite) {
    const loader = new SimpleTextLoader();

    // Create test model
    const testContent = `
# METADATA
name=Test Model
version=1.0

# RESPONSES
hello->Hello there!
bye->Goodbye!

# PATTERNS
greeting
farewell
    `;

    await fs.writeFile('./test-simple.txt', testContent);

    try {
        // Test 1: Basic loading
        const result = await loader.load('./test-simple.txt');
        suite.assertNotNull(result, 'Load result should not be null');
        suite.assertEqual(result.format, 'simple-text', 'Format should be simple-text');
        suite.assert(Array.isArray(result.capabilities), 'Capabilities should be an array');

        // Test 2: Inference
        const response = await result.instance.generate('hello');
        suite.assertNotNull(response, 'Response should not be null');
        suite.assert(response.includes('Hello'), 'Response should contain greeting');

        // Test 3: Streaming
        const stream = await result.instance.generateStream('hello');
        let streamedContent = '';
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                streamedContent += chunk.token;
            }
        }
        suite.assertNotNull(streamedContent, 'Streamed content should not be null');

        // Test 4: Unloading
        await loader.unload(result.id);

        // Test 5: Validation
        await suite.assertThrows(
            () => loader.validate('./nonexistent.txt'),
            'Should throw for nonexistent file'
        );

    } finally {
        await fs.unlink('./test-simple.txt').catch(() => {});
    }
}

async function testAdvancedLoader(suite) {
    const loader = new AdvancedCustomLoader({
        maxCacheSize: 2,
        enablePreprocessing: true
    });

    // Create test binary model
    const binaryData = Buffer.alloc(512);
    binaryData.write('ADV\x00', 0);
    binaryData.writeUInt32LE(1, 4);
    
    const metadata = JSON.stringify({ name: 'Test Advanced Model' });
    binaryData.writeUInt32LE(metadata.length, 8);
    binaryData.writeUInt32LE(100, 12);
    binaryData.write(metadata, 16);

    await fs.writeFile('./test-advanced.adv', binaryData);

    try {
        // Test 1: Loading with options
        const result = await loader.load('./test-advanced.adv', {
            id: 'test-advanced',
            quantize: true
        });

        suite.assertNotNull(result, 'Advanced load result should not be null');
        suite.assertEqual(result.format, 'advanced-custom', 'Format should be advanced-custom');

        // Test 2: Caching
        const cachedResult = await loader.load('./test-advanced.adv', {
            id: 'test-advanced'
        });
        suite.assertEqual(result.id, cachedResult.id, 'Should return cached result');

        // Test 3: Cache eviction
        await loader.load('./test-advanced.adv', { id: 'test-1' });
        await loader.load('./test-advanced.adv', { id: 'test-2' });
        await loader.load('./test-advanced.adv', { id: 'test-3' }); // Should evict first

        const info = loader.getInfo();
        suite.assertEqual(info.cache.size, 2, 'Cache should respect max size');

        // Test 4: Generation with stats
        const response = await result.instance.generate('test prompt');
        suite.assertNotNull(response, 'Response should not be null');

        const stats = result.instance.getStats();
        suite.assertEqual(stats.inferenceCount, 1, 'Should track inference count');

    } finally {
        await fs.unlink('./test-advanced.adv').catch(() => {});
    }
}

async function testCSVLoader(suite) {
    const loader = new CSVModelLoader();

    const csvData = `name,age,city
John,30,NYC
Jane,25,LA
Bob,35,Chicago`;

    await fs.writeFile('./test-data.csv', csvData);

    try {
        // Test 1: CSV parsing
        const result = await loader.load('./test-data.csv');
        suite.assertNotNull(result, 'CSV load result should not be null');
        suite.assertEqual(result.metadata.rows, 3, 'Should parse 3 rows');
        suite.assertEqual(result.metadata.columns, 3, 'Should parse 3 columns');

        // Test 2: Query processing
        const countResponse = await result.instance.generate('count records');
        suite.assert(countResponse.includes('3'), 'Should count 3 records');

        const filterResponse = await result.instance.generate('find where age = 30');
        suite.assert(filterResponse.includes('John'), 'Should find John');

        // Test 3: Empty results
        const emptyResponse = await result.instance.generate('find where age = 99');
        suite.assert(emptyResponse.includes('No matching'), 'Should handle empty results');

    } finally {
        await fs.unlink('./test-data.csv').catch(() => {});
    }
}

async function testLoaderRegistry(suite) {
    // Test loader registration and discovery
    const loaders = [
        new SimpleTextLoader(),
        new AdvancedCustomLoader(),
        new CSVModelLoader()
    ];

    // Test 1: Each loader should have unique format
    const formats = loaders.map(l => l.format);
    const uniqueFormats = new Set(formats);
    suite.assertEqual(formats.length, uniqueFormats.size, 'All loaders should have unique formats');

    // Test 2: Each loader should provide info
    for (const loader of loaders) {
        const info = loader.getInfo();
        suite.assertNotNull(info.name, 'Loader should have a name');
        suite.assertNotNull(info.format, 'Loader should have a format');
        suite.assertNotNull(info.version, 'Loader should have a version');
        suite.assert(Array.isArray(info.capabilities), 'Loader should have capabilities array');
    }

    // Test 3: Extension mapping
    const extensionMap = new Map();
    for (const loader of loaders) {
        for (const ext of loader.supportedExtensions) {
            if (!extensionMap.has(ext)) {
                extensionMap.set(ext, []);
            }
            extensionMap.get(ext).push(loader.format);
        }
    }

    suite.assert(extensionMap.size > 0, 'Should have extension mappings');
}

async function testErrorHandling(suite) {
    const loader = new SimpleTextLoader();

    // Test 1: Invalid file path
    await suite.assertThrows(
        () => loader.load('./nonexistent.txt'),
        'Should throw for nonexistent file'
    );

    // Test 2: Invalid model format
    await fs.writeFile('./invalid.txt', 'invalid content');
    
    try {
        const result = await loader.load('./invalid.txt');
        // Should still load but with minimal functionality
        suite.assertNotNull(result, 'Should handle invalid format gracefully');
    } finally {
        await fs.unlink('./invalid.txt').catch(() => {});
    }

    // Test 3: Empty file
    await fs.writeFile('./empty.txt', '');
    
    try {
        const result = await loader.load('./empty.txt');
        suite.assertNotNull(result, 'Should handle empty file');
    } finally {
        await fs.unlink('./empty.txt').catch(() => {});
    }
}

// Run all tests
async function runLoaderTests() {
    const suite = new LoaderTestSuite();

    suite.addTest('Simple Text Loader', () => testSimpleLoader(suite));
    suite.addTest('Advanced Custom Loader', () => testAdvancedLoader(suite));
    suite.addTest('CSV Data Loader', () => testCSVLoader(suite));
    suite.addTest('Loader Registry', () => testLoaderRegistry(suite));
    suite.addTest('Error Handling', () => testErrorHandling(suite));

    await suite.runAllTests();
}

runLoaderTests().catch(console.error);

export { LoaderTestSuite };
```

## Real-World Examples

### Production-Ready Custom Loader

Create `06-production-loader.js`:

```javascript
import { BaseLoader } from 'llm-runner-router/src/loaders/BaseLoader.js';
import fs from 'fs/promises';
import crypto from 'crypto';
import { Worker } from 'worker_threads';

class ProductionCustomLoader extends BaseLoader {
    constructor(config = {}) {
        super(config);
        this.format = 'production-custom';
        this.supportedExtensions = ['.prod', '.custom'];
        
        // Production features
        this.cache = new Map();
        this.loadingQueue = new Map();
        this.workers = new Map();
        this.metrics = {
            loadCount: 0,
            cacheHits: 0,
            errors: 0,
            totalLoadTime: 0
        };
        
        // Configuration
        this.maxCacheSize = config.maxCacheSize || 10;
        this.enableWorkers = config.enableWorkers !== false;
        this.maxWorkers = config.maxWorkers || 2;
        this.enableMetrics = config.enableMetrics !== false;
        this.enableValidation = config.enableValidation !== false;
        this.compressionLevel = config.compressionLevel || 6;
        
        // Security
        this.enableSandbox = config.enableSandbox !== false;
        this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB
        
        // Performance
        this.preloadModels = config.preloadModels || [];
        this.enableLazyLoading = config.enableLazyLoading !== false;
    }

    async initialize() {
        console.log('🚀 Initializing Production Custom Loader...');
        
        // Start worker pool if enabled
        if (this.enableWorkers) {
            await this.initializeWorkerPool();
        }
        
        // Preload models if specified
        if (this.preloadModels.length > 0) {
            await this.preloadSpecifiedModels();
        }
        
        console.log('✅ Production loader initialized');
    }

    async initializeWorkerPool() {
        console.log(`👷 Starting ${this.maxWorkers} worker threads...`);
        
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker(`
                const { parentPort } = require('worker_threads');
                
                parentPort.on('message', async (task) => {
                    try {
                        const result = await processTask(task);
                        parentPort.postMessage({ success: true, result, taskId: task.id });
                    } catch (error) {
                        parentPort.postMessage({ success: false, error: error.message, taskId: task.id });
                    }
                });
                
                async function processTask(task) {
                    switch (task.type) {
                        case 'parse':
                            return parseModelData(task.data);
                        case 'validate':
                            return validateModelData(task.data);
                        case 'optimize':
                            return optimizeModelData(task.data);
                        default:
                            throw new Error('Unknown task type');
                    }
                }
                
                function parseModelData(data) {
                    // Heavy parsing logic
                    return { parsed: true, size: data.length };
                }
                
                function validateModelData(data) {
                    // Validation logic
                    return { valid: true };
                }
                
                function optimizeModelData(data) {
                    // Optimization logic
                    return { optimized: true };
                }
            `, { eval: true });
            
            this.workers.set(i, {
                worker,
                busy: false,
                tasks: new Map()
            });
        }
    }

    async load(modelPath, options = {}) {
        const startTime = Date.now();
        this.metrics.loadCount++;
        
        try {
            const modelId = options.id || this.generateModelId(modelPath);
            
            // Check cache first
            if (this.cache.has(modelId) && !options.forceReload) {
                this.metrics.cacheHits++;
                console.log(`📦 Loading from cache: ${modelId}`);
                return this.cache.get(modelId);
            }
            
            // Check if already loading
            if (this.loadingQueue.has(modelId)) {
                console.log(`⏳ Waiting for concurrent load: ${modelId}`);
                return await this.loadingQueue.get(modelId);
            }
            
            // Start loading
            const loadPromise = this._performLoad(modelPath, modelId, options, startTime);
            this.loadingQueue.set(modelId, loadPromise);
            
            try {
                const result = await loadPromise;
                this.addToCache(modelId, result);
                return result;
            } finally {
                this.loadingQueue.delete(modelId);
            }
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    async _performLoad(modelPath, modelId, options, startTime) {
        console.log(`🔄 Loading production model: ${modelId}`);
        
        // Security validation
        if (this.enableValidation) {
            await this.securityValidation(modelPath);
        }
        
        // Read model file
        const rawData = await fs.readFile(modelPath);
        
        // Use worker for heavy processing
        let processedData = rawData;
        if (this.enableWorkers) {
            processedData = await this.processWithWorker('parse', rawData);
        }
        
        // Create model instance
        const instance = new ProductionModelInstance(processedData, {
            ...this.config,
            ...options,
            modelId,
            sandbox: this.enableSandbox
        });
        
        await instance.initialize();
        
        const loadTime = Date.now() - startTime;
        this.metrics.totalLoadTime += loadTime;
        
        console.log(`✅ Production model loaded in ${loadTime}ms: ${modelId}`);
        
        return {
            id: modelId,
            loader: this,
            instance,
            format: this.format,
            capabilities: await instance.getCapabilities(),
            metadata: {
                loadTime,
                fileSize: rawData.length,
                cached: false,
                workerProcessed: this.enableWorkers,
                securityValidated: this.enableValidation
            }
        };
    }

    async securityValidation(modelPath) {
        const stats = await fs.stat(modelPath);
        
        // File size check
        if (stats.size > this.maxFileSize) {
            throw new Error(`Model file too large: ${stats.size} > ${this.maxFileSize}`);
        }
        
        // Malware scan simulation
        const sample = await fs.readFile(modelPath, { encoding: 'utf8', flag: 'r' });
        if (sample.includes('malicious') || sample.includes('virus')) {
            throw new Error('Security scan failed: suspicious content detected');
        }
        
        // Path traversal check
        if (modelPath.includes('..') || modelPath.includes('~')) {
            throw new Error('Security validation failed: invalid path');
        }
    }

    async processWithWorker(taskType, data) {
        // Find available worker
        const availableWorker = Array.from(this.workers.values())
            .find(w => !w.busy);
        
        if (!availableWorker) {
            // Fallback to synchronous processing
            return data;
        }
        
        return new Promise((resolve, reject) => {
            const taskId = crypto.randomUUID();
            availableWorker.busy = true;
            
            const timeout = setTimeout(() => {
                availableWorker.busy = false;
                reject(new Error('Worker task timeout'));
            }, 30000);
            
            const messageHandler = (message) => {
                if (message.taskId === taskId) {
                    clearTimeout(timeout);
                    availableWorker.worker.off('message', messageHandler);
                    availableWorker.busy = false;
                    
                    if (message.success) {
                        resolve(message.result);
                    } else {
                        reject(new Error(message.error));
                    }
                }
            };
            
            availableWorker.worker.on('message', messageHandler);
            availableWorker.worker.postMessage({
                id: taskId,
                type: taskType,
                data
            });
        });
    }

    generateModelId(modelPath) {
        const hash = crypto.createHash('sha256');
        hash.update(modelPath);
        hash.update(Date.now().toString());
        return `prod_${hash.digest('hex').substring(0, 16)}`;
    }

    addToCache(modelId, result) {
        // LRU cache implementation
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            const evicted = this.cache.get(oldestKey);
            this.cache.delete(oldestKey);
            
            // Cleanup evicted model
            if (evicted.instance) {
                evicted.instance.cleanup().catch(console.error);
            }
        }
        
        this.cache.set(modelId, result);
    }

    async unload(modelId) {
        console.log(`🗑️ Unloading production model: ${modelId}`);
        
        const cached = this.cache.get(modelId);
        if (cached) {
            await cached.instance.cleanup();
            this.cache.delete(modelId);
        }
        
        // Cancel pending loads
        if (this.loadingQueue.has(modelId)) {
            this.loadingQueue.delete(modelId);
        }
    }

    async shutdown() {
        console.log('🛑 Shutting down production loader...');
        
        // Cleanup cache
        for (const [modelId, result] of this.cache) {
            await result.instance.cleanup();
        }
        this.cache.clear();
        
        // Shutdown workers
        for (const workerInfo of this.workers.values()) {
            await workerInfo.worker.terminate();
        }
        this.workers.clear();
        
        console.log('✅ Production loader shutdown complete');
    }

    getMetrics() {
        const avgLoadTime = this.metrics.loadCount > 0 ? 
            this.metrics.totalLoadTime / this.metrics.loadCount : 0;
        
        const cacheHitRate = this.metrics.loadCount > 0 ? 
            this.metrics.cacheHits / this.metrics.loadCount : 0;
        
        return {
            ...this.metrics,
            avgLoadTime: Math.round(avgLoadTime),
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            errorRate: this.metrics.loadCount > 0 ? 
                this.metrics.errors / this.metrics.loadCount : 0
        };
    }

    getInfo() {
        return {
            name: 'Production Custom Loader',
            format: this.format,
            version: '1.0.0',
            supportedExtensions: this.supportedExtensions,
            capabilities: [
                'production-ready',
                'worker-threads',
                'security-validation',
                'performance-metrics',
                'caching',
                'sandboxing'
            ],
            metrics: this.getMetrics(),
            cache: {
                size: this.cache.size,
                maxSize: this.maxCacheSize
            },
            workers: {
                count: this.workers.size,
                maxWorkers: this.maxWorkers,
                enabled: this.enableWorkers
            }
        };
    }
}

class ProductionModelInstance {
    constructor(data, config = {}) {
        this.data = data;
        this.config = config;
        this.modelId = config.modelId;
        this.sandbox = config.sandbox;
        this.ready = false;
        
        this.stats = {
            inferenceCount: 0,
            totalTokens: 0,
            avgResponseTime: 0,
            errorCount: 0,
            lastUsed: Date.now()
        };
        
        this.health = {
            status: 'initializing',
            lastHealthCheck: Date.now(),
            consecutiveErrors: 0
        };
    }

    async initialize() {
        try {
            console.log(`🔧 Initializing production model: ${this.modelId}`);
            
            // Simulate complex initialization
            await new Promise(resolve => setTimeout(resolve, 200));
            
            this.ready = true;
            this.health.status = 'healthy';
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            console.log(`✅ Production model ready: ${this.modelId}`);
            
        } catch (error) {
            this.health.status = 'failed';
            throw new Error(`Initialization failed: ${error.message}`);
        }
    }

    startHealthMonitoring() {
        // Periodic health checks
        this.healthInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
    }

    performHealthCheck() {
        try {
            // Check if model is still responsive
            if (Date.now() - this.stats.lastUsed > 300000) { // 5 minutes
                this.health.status = 'idle';
            } else {
                this.health.status = 'healthy';
            }
            
            this.health.lastHealthCheck = Date.now();
            this.health.consecutiveErrors = 0;
            
        } catch (error) {
            this.health.consecutiveErrors++;
            if (this.health.consecutiveErrors >= 3) {
                this.health.status = 'unhealthy';
            }
        }
    }

    async generate(prompt, options = {}) {
        if (!this.ready) {
            throw new Error('Model not ready');
        }

        const startTime = Date.now();
        this.stats.inferenceCount++;
        this.stats.lastUsed = Date.now();

        try {
            // Sandbox execution if enabled
            const result = this.sandbox ? 
                await this.sandboxedGenerate(prompt, options) :
                await this.directGenerate(prompt, options);
            
            const responseTime = Date.now() - startTime;
            this.updateStats(result, responseTime);
            
            return result;

        } catch (error) {
            this.stats.errorCount++;
            this.health.consecutiveErrors++;
            throw new Error(`Generation failed: ${error.message}`);
        }
    }

    async sandboxedGenerate(prompt, options) {
        // Simulate sandboxed execution
        console.log(`🔒 Executing in sandbox: ${this.modelId}`);
        
        // Validate inputs
        if (prompt.length > 10000) {
            throw new Error('Prompt too long for sandbox');
        }
        
        return this.directGenerate(prompt, options);
    }

    async directGenerate(prompt, options) {
        // Simulate model inference
        const maxTokens = options.maxTokens || 100;
        const response = `Production model ${this.modelId} response to: ${prompt}`;
        
        // Simulate processing time based on complexity
        const complexity = Math.min(prompt.length / 100, 10);
        await new Promise(resolve => setTimeout(resolve, complexity * 100));
        
        return response.substring(0, maxTokens);
    }

    updateStats(response, responseTime) {
        const tokens = response.split(' ').length;
        this.stats.totalTokens += tokens;
        
        // Update average response time
        const totalTime = this.stats.avgResponseTime * (this.stats.inferenceCount - 1) + responseTime;
        this.stats.avgResponseTime = totalTime / this.stats.inferenceCount;
    }

    async getCapabilities() {
        return [
            'text-generation',
            'production-inference',
            'health-monitoring',
            'performance-metrics',
            'sandboxed-execution'
        ];
    }

    getStats() {
        return {
            ...this.stats,
            health: { ...this.health },
            uptime: Date.now() - this.stats.lastUsed,
            errorRate: this.stats.inferenceCount > 0 ? 
                this.stats.errorCount / this.stats.inferenceCount : 0
        };
    }

    async cleanup() {
        console.log(`🧹 Cleaning up production model: ${this.modelId}`);
        
        this.ready = false;
        
        if (this.healthInterval) {
            clearInterval(this.healthInterval);
        }
        
        // Cleanup resources
        this.data = null;
        this.health.status = 'terminated';
    }
}

// Usage example
async function demonstrateProductionLoader() {
    console.log('🏭 Production Custom Loader Demonstration\n');

    const loader = new ProductionCustomLoader({
        maxCacheSize: 5,
        enableWorkers: true,
        maxWorkers: 2,
        enableMetrics: true,
        enableValidation: true
    });

    try {
        await loader.initialize();

        // Create test model file
        await fs.writeFile('./production-model.prod', JSON.stringify({
            name: 'Production Test Model',
            version: '1.0.0',
            data: 'model data here'
        }));

        // Load model
        const result = await loader.load('./production-model.prod', {
            id: 'prod-demo'
        });

        console.log('📊 Loader Info:');
        console.log(JSON.stringify(loader.getInfo(), null, 2));

        // Test inference
        const response = await result.instance.generate(
            'Generate a professional response for production testing'
        );
        console.log('\n📝 Response:', response);

        // Check stats
        console.log('\n📈 Model Stats:');
        console.log(JSON.stringify(result.instance.getStats(), null, 2));

        // Test caching
        const cachedResult = await loader.load('./production-model.prod', {
            id: 'prod-demo'
        });
        console.log('\n💾 Cache hit:', cachedResult === result);

        // Show final metrics
        console.log('\n📊 Final Metrics:');
        console.log(JSON.stringify(loader.getMetrics(), null, 2));

        await loader.shutdown();

    } catch (error) {
        console.error('❌ Production demo failed:', error.message);
    } finally {
        await fs.unlink('./production-model.prod').catch(() => {});
    }
}

demonstrateProductionLoader();

export { ProductionCustomLoader, ProductionModelInstance };
```

## Best Practices Summary

### Custom Loader Development Guidelines

```javascript
// best-practices.js

/**
 * CUSTOM LOADER BEST PRACTICES
 */

class BestPracticesGuide {
    
    // ✅ DO: Implement proper error handling
    async goodErrorHandling() {
        try {
            const data = await this.loadModel(path);
            return this.processData(data);
        } catch (error) {
            // Log the error
            console.error('Model loading failed:', error);
            
            // Provide context
            throw new Error(`Failed to load model from ${path}: ${error.message}`);
        }
    }

    // ✅ DO: Validate inputs thoroughly
    async goodValidation(modelPath) {
        // Check file existence
        const stats = await fs.stat(modelPath);
        if (!stats.isFile()) {
            throw new Error('Path is not a file');
        }

        // Check file size
        if (stats.size > this.maxFileSize) {
            throw new Error(`File too large: ${stats.size} bytes`);
        }

        // Check extension
        const ext = path.extname(modelPath);
        if (!this.supportedExtensions.includes(ext)) {
            throw new Error(`Unsupported extension: ${ext}`);
        }

        return true;
    }

    // ✅ DO: Implement proper cleanup
    async goodCleanup() {
        // Clear all references
        this.models.clear();
        this.cache.clear();
        
        // Cleanup workers
        for (const worker of this.workers.values()) {
            await worker.terminate();
        }
        
        // Clear intervals/timeouts
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }

    // ✅ DO: Use async/await properly
    async goodAsyncUsage() {
        try {
            // Parallel operations when possible
            const [validation, metadata] = await Promise.all([
                this.validate(path),
                this.extractMetadata(path)
            ]);

            // Sequential when dependencies exist
            const data = await this.loadData(path);
            const processed = await this.processData(data);
            
            return processed;
        } catch (error) {
            throw new Error(`Async operation failed: ${error.message}`);
        }
    }

    // ❌ DON'T: Block the event loop
    badSyncOperations() {
        // ❌ Synchronous file operations
        const data = fs.readFileSync(path);
        
        // ❌ Blocking loops
        for (let i = 0; i < 1000000; i++) {
            // Heavy computation
        }
        
        // ❌ Blocking network requests
        const response = syncHttpRequest(url);
    }

    // ❌ DON'T: Ignore memory management
    badMemoryManagement() {
        // ❌ No size limits
        this.cache.set(key, hugeObject);
        
        // ❌ No cleanup
        this.models.set(id, model); // Never removed
        
        // ❌ Memory leaks
        setInterval(() => {
            this.doSomething();
        }, 1000); // Never cleared
    }

    // ✅ DO: Implement proper caching
    goodCaching() {
        // LRU cache with size limit
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            const evicted = this.cache.get(firstKey);
            this.cache.delete(firstKey);
            
            // Cleanup evicted item
            if (evicted.cleanup) {
                evicted.cleanup();
            }
        }
        
        this.cache.set(key, value);
    }

    // ✅ DO: Provide comprehensive metadata
    goodMetadata() {
        return {
            id: modelId,
            loader: this,
            instance: modelInstance,
            format: this.format,
            capabilities: ['text-generation', 'streaming'],
            metadata: {
                loadTime: Date.now() - startTime,
                fileSize: stats.size,
                version: modelData.version,
                checksum: this.calculateChecksum(data),
                cached: false,
                source: modelPath
            },
            health: {
                status: 'healthy',
                lastCheck: Date.now()
            }
        };
    }
}

// Configuration recommendations
const loaderBestPractices = {
    // Performance
    performance: {
        enableCaching: true,
        maxCacheSize: 10,
        enableWorkers: true,
        maxWorkers: 4,
        timeout: 30000
    },
    
    // Security
    security: {
        enableValidation: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['.gguf', '.onnx', '.custom'],
        enableSandbox: true
    },
    
    // Monitoring
    monitoring: {
        enableMetrics: true,
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        enableLogging: true
    },
    
    // Error handling
    errorHandling: {
        maxRetries: 3,
        retryDelay: 1000,
        enableGracefulDegradation: true
    }
};

export { BestPracticesGuide, loaderBestPractices };
```

## Next Steps

🎉 **Congratulations!** You've completed the custom loaders tutorial. You now know how to:

- Create basic and advanced custom loaders
- Handle different model formats and sources
- Implement remote API loaders
- Add preprocessing and optimization
- Build production-ready loaders with caching, workers, and monitoring
- Test and validate your loaders thoroughly

### 🚀 Continue Learning

1. **[Enterprise Setup Tutorial](./enterprise-setup.md)** - Multi-tenancy and A/B testing
2. **[Monitoring Setup Tutorial](./monitoring-setup.md)** - Observability and metrics

### 💡 Project Ideas

Try building these custom loaders:

1. **Database Model Loader** - Load models from PostgreSQL/MongoDB
2. **S3 Model Loader** - Load models from AWS S3 with caching
3. **Encrypted Model Loader** - Support for encrypted model files
4. **Multi-Format Loader** - Auto-detect and handle multiple formats
5. **Streaming Model Loader** - Load large models progressively

### 📚 Additional Resources

- **[API Reference](../API_REFERENCE.md)** - Complete loader API documentation
- **[Performance Guide](../guides/performance.md)** - Optimize loader performance
- **[Security Guide](../guides/security.md)** - Secure loader development

Ready for enterprise features? Try the [Enterprise Setup Tutorial](./enterprise-setup.md)!