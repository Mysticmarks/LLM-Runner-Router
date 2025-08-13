/**
 * Documentation Server for LLM Runner Router
 * Serves actual markdown files from the /docs directory
 * Provides REST API endpoints for the documentation system
 */

const fs = require('fs').promises;
const path = require('path');

class DocsServer {
    constructor(docsPath = '../docs') {
        this.docsPath = path.resolve(__dirname, docsPath);
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.fileMap = {
            // Core documentation
            'overview': 'README.md',
            'architecture': 'ARCHITECTURE.md',
            'api-reference': 'API_REFERENCE.md',
            'config-reference': 'CONFIG_REFERENCE.md',
            'routing-strategies': 'ROUTING_STRATEGIES.md',
            'model-formats': 'MODEL_FORMATS.md',
            'performance': 'PERFORMANCE.md',
            'security': 'SECURITY.md',
            'troubleshooting': 'TROUBLESHOOTING.md',
            'deployment': 'DEPLOYMENT.md',
            'plugin-development': 'PLUGIN_DEVELOPMENT.md',
            'faq': 'FAQ.md',
            'glossary': 'GLOSSARY.md',
            'examples': 'EXAMPLES.md',
            
            // Examples subdirectory
            'basic-examples': 'examples/BASIC.md',
            'streaming-examples': 'examples/STREAMING.md',
            'api-examples': 'examples/API.md',
            'docker-examples': 'examples/DOCKER.md',
            'monitoring-examples': 'examples/MONITORING.md'
        };
        
        console.log(`DocsServer initialized with docs path: ${this.docsPath}`);
    }

    async init() {
        try {
            // Verify docs directory exists
            await fs.access(this.docsPath);
            console.log('Docs directory found and accessible');
            
            // Pre-cache critical documents
            const criticalDocs = ['overview', 'architecture', 'api-reference'];
            await Promise.allSettled(
                criticalDocs.map(doc => this.loadDocument(doc))
            );
            
            console.log('DocsServer initialized successfully');
        } catch (error) {
            console.warn('Docs directory not accessible:', error.message);
            console.log('DocsServer will use fallback content');
        }
    }

    async loadDocument(docName) {
        const cacheKey = docName;
        const cached = this.cache.get(cacheKey);
        
        // Return cached version if still valid
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const fileName = this.fileMap[docName];
            if (!fileName) {
                throw new Error(`Document mapping not found: ${docName}`);
            }

            const filePath = path.join(this.docsPath, fileName);
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);

            const processed = {
                name: docName,
                fileName: fileName,
                content: content,
                lastModified: stats.mtime.toISOString(),
                size: stats.size,
                wordCount: this.getWordCount(content),
                readingTime: this.getReadingTime(content),
                toc: this.generateTOC(content),
                headings: this.extractHeadings(content)
            };

            // Cache the processed document
            this.cache.set(cacheKey, {
                data: processed,
                timestamp: Date.now()
            });

            console.log(`Loaded document: ${docName} (${processed.wordCount} words)`);
            return processed;

        } catch (error) {
            console.warn(`Failed to load document ${docName}:`, error.message);
            
            // Return fallback content
            return this.getFallbackDocument(docName);
        }
    }

    getFallbackDocument(docName) {
        const fallbackContent = this.getFallbackContent(docName);
        
        return {
            name: docName,
            fileName: this.fileMap[docName] || `${docName}.md`,
            content: fallbackContent,
            lastModified: new Date().toISOString(),
            size: fallbackContent.length,
            wordCount: this.getWordCount(fallbackContent),
            readingTime: this.getReadingTime(fallbackContent),
            toc: this.generateTOC(fallbackContent),
            headings: this.extractHeadings(fallbackContent),
            isFallback: true
        };
    }

    getFallbackContent(docName) {
        const fallbackMap = {
            'overview': `# 📚 LLM-Runner-Router Documentation Hub

*Welcome to the comprehensive documentation for the Universal Model Orchestration System*

## 🚀 What is LLM Runner Router?

LLM Runner Router is a cutting-edge, full-stack agnostic neural orchestration system that intelligently adapts to ANY model format, ANY runtime environment, and ANY deployment scenario.

## ✨ Key Features

- 🔮 **Universal Format Support** - GGUF, ONNX, Safetensors, HuggingFace models
- ⚡ **Multi-Engine Architecture** - WebGPU, WASM, Node.js native engines
- 🧭 **Intelligent Routing** - Smart model selection algorithms
- 🚀 **Real-Time Streaming** - Lightning-fast token generation
- 💰 **Cost Optimization** - Built-in cost analysis and routing
- 🔧 **Developer-First API** - Intuitive and powerful interface

## 🏃 Quick Start

\`\`\`javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

const response = await router.quick('Hello, world!');
console.log(response.text);
\`\`\`

## 📖 Documentation Sections

### Getting Started
- [Architecture Overview](./ARCHITECTURE.md) - System design and components
- [Quick Examples](./EXAMPLES.md) - Get up and running fast

### Core Documentation
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Configuration](./CONFIG_REFERENCE.md) - All configuration options
- [Routing Strategies](./ROUTING_STRATEGIES.md) - Model selection strategies
- [Model Formats](./MODEL_FORMATS.md) - Supported model formats
- [Performance](./PERFORMANCE.md) - Optimization and benchmarks

### Advanced Topics
- [Security Guide](./SECURITY.md) - Best practices and security
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Plugin Development](./PLUGIN_DEVELOPMENT.md) - Extending the system

### Reference
- [FAQ](./FAQ.md) - Frequently asked questions
- [Glossary](./GLOSSARY.md) - Terms and definitions

Navigate through the documentation using the sidebar to explore specific topics and features.

---

Built with 💚 by Echo AI Systems`,

            'architecture': `# 🏗️ System Architecture

## Overview

LLM Runner Router follows a modular, layered architecture designed for maximum flexibility and performance across different environments and model formats.

## Core Components

### Router
The central orchestrator responsible for:
- Model selection and routing decisions
- Load balancing across multiple models
- Fallback chain management
- Performance monitoring

### Registry
Model registry and lifecycle management:
- Model metadata storage
- Version tracking
- Health monitoring
- Automatic discovery

### Pipeline
Processing pipeline system:
- Request preprocessing
- Response postprocessing
- Middleware support
- Error handling

### Engines
Runtime execution engines:
- **WebGPU Engine** - GPU acceleration for browsers
- **WASM Engine** - CPU-optimized WebAssembly
- **Node.js Engine** - Native bindings for server-side

### Loaders
Format-specific model loaders:
- **GGUF Loader** - GGML/GGUF format support
- **ONNX Loader** - ONNX runtime integration
- **HuggingFace Loader** - Transformers.js models
- **Safetensors Loader** - Modern tensor format

## Data Flow

1. **Request** → Router receives inference request
2. **Strategy** → Router selects optimal model using configured strategy
3. **Loading** → Appropriate loader initializes the model
4. **Execution** → Engine runs inference on the model
5. **Response** → Results are streamed back to client

## Environment Detection

The system automatically detects the runtime environment and selects appropriate engines:

\`\`\`javascript
// Browser environment
if (typeof window !== 'undefined') {
    // Prefer WebGPU, fallback to WASM
    engines = ['webgpu', 'wasm'];
}

// Node.js environment
if (typeof process !== 'undefined') {
    // Prefer native bindings
    engines = ['native', 'wasm'];
}
\`\`\`

Built with 💚 by Echo AI Systems`,

            'troubleshooting': `# 🔧 Troubleshooting Guide

*When your neural networks need debugging*

## Common Issues

### Installation Problems

**Issue**: npm install fails with peer dependency errors
\`\`\`
npm ERR! peer dep missing: package@version
\`\`\`

**Solutions**:
\`\`\`bash
# Option 1: Legacy peer deps
npm install --legacy-peer-deps

# Option 2: Force install
npm install --force

# Option 3: Clean install
rm -rf node_modules package-lock.json
npm install
\`\`\`

### Model Loading Issues

**Issue**: Model fails to load or times out
\`\`\`
Error: Failed to load model: timeout after 30000ms
\`\`\`

**Possible causes**:
- Network connectivity issues
- Model file too large
- Insufficient memory
- CORS restrictions (browser)

**Solutions**:
\`\`\`javascript
// Increase timeout
const router = new LLMRouter({
    loadTimeout: 60000  // 60 seconds
});

// Use local model
const router = new LLMRouter({
    models: [
        {
            name: 'local-model',
            path: './models/model.gguf'
        }
    ]
});
\`\`\`

### Performance Issues

**Issue**: Slow inference performance

**Diagnostic steps**:
1. Check if GPU acceleration is enabled
2. Verify model quantization
3. Monitor memory usage
4. Check for memory fragmentation

**Solutions**:
\`\`\`javascript
// Force GPU acceleration
const router = new LLMRouter({
    preferredEngine: 'webgpu',
    fallbackEngines: ['wasm']
});

// Use quantized model
const router = new LLMRouter({
    models: [{
        name: 'efficient-model',
        quantization: 'q4_0'  // 4-bit quantization
    }]
});
\`\`\`

### Engine Selection Issues

**Issue**: Wrong engine selected or engine fails

**Debug engine selection**:
\`\`\`javascript
const router = new LLMRouter({
    debug: true  // Enable debug logging
});

// Check available engines
console.log(router.getAvailableEngines());
\`\`\`

## Diagnostic Commands

\`\`\`bash
# System diagnostics
npm run diagnose

# Test model loading
npm run test:model

# Performance benchmark
npm run benchmark

# Memory usage analysis
npm run analyze:memory
\`\`\`

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| E001 | Model not found | Check model path/URL |
| E002 | Engine initialization failed | Try different engine |
| E003 | Out of memory | Use smaller/quantized model |
| E004 | Network timeout | Check connectivity |
| E005 | Format not supported | Use compatible model format |

## Getting Help

1. **Check the logs** - Enable debug mode for detailed logging
2. **Search GitHub Issues** - Someone may have faced the same issue
3. **Create minimal reproduction** - Isolate the problem
4. **Contact support** - Email support@echoai.systems with details

### What to include in bug reports:
- System information (OS, Node.js version, browser)
- Code snippet that reproduces the issue
- Error messages and stack traces
- Model information (if applicable)

Built with 💚 by Echo AI Systems`
        };

        const title = this.getPageTitle(docName);
        return fallbackMap[docName] || `# ${title}

This documentation page is being loaded from the /docs directory.

If you're seeing this fallback content, the system couldn't access the actual markdown file at \`docs/${this.fileMap[docName] || docName + '.md'}\`.

## About ${title}

This section will contain comprehensive information about ${title.toLowerCase()}.

## Quick Navigation

- [Home](./README.md)
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [Examples](./EXAMPLES.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

Built with 💚 by Echo AI Systems`;
    }

    generateTOC(markdown) {
        const headers = [];
        const lines = markdown.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2].replace(/[^\w\s-]/g, ''); // Clean for ID
                const id = text.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/--+/g, '-')
                    .trim();
                
                headers.push({
                    level,
                    text: match[2], // Original text for display
                    id,
                    anchor: `#${id}`
                });
            }
        }
        
        return headers;
    }

    extractHeadings(markdown) {
        const headings = {};
        const lines = markdown.split('\n');
        
        lines.forEach((line, index) => {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                if (!headings[level]) headings[level] = [];
                headings[level].push({
                    text: match[2],
                    line: index + 1
                });
            }
        });
        
        return headings;
    }

    getWordCount(content) {
        return content.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    getReadingTime(content) {
        const wordsPerMinute = 200;
        const words = this.getWordCount(content);
        return Math.ceil(words / wordsPerMinute);
    }

    getPageTitle(page) {
        const titles = {
            'overview': 'Overview',
            'architecture': 'Architecture',
            'api-reference': 'API Reference',
            'config-reference': 'Configuration Reference',
            'routing-strategies': 'Routing Strategies',
            'model-formats': 'Model Formats',
            'performance': 'Performance Guide',
            'security': 'Security Guide',
            'troubleshooting': 'Troubleshooting',
            'deployment': 'Deployment Guide',
            'plugin-development': 'Plugin Development',
            'faq': 'FAQ',
            'glossary': 'Glossary',
            'examples': 'Examples',
            'basic-examples': 'Basic Examples',
            'streaming-examples': 'Streaming Examples',
            'api-examples': 'API Examples',
            'docker-examples': 'Docker Examples',
            'monitoring-examples': 'Monitoring Examples'
        };
        return titles[page] || page.charAt(0).toUpperCase() + page.slice(1);
    }

    async getAllDocuments() {
        const docs = {};
        
        for (const docName of Object.keys(this.fileMap)) {
            try {
                docs[docName] = await this.loadDocument(docName);
            } catch (error) {
                console.error(`Failed to load ${docName}:`, error);
            }
        }

        return docs;
    }

    async search(query, options = {}) {
        const { limit = 10, includeContent = false } = options;
        const results = [];
        const queryLower = query.toLowerCase();

        // Load all documents for search
        const docs = await this.getAllDocuments();

        for (const [docName, doc] of Object.entries(docs)) {
            const content = doc.content.toLowerCase();
            const titleMatch = doc.name.toLowerCase().includes(queryLower);
            const contentMatch = content.includes(queryLower);
            
            if (titleMatch || contentMatch) {
                const relevance = this.calculateRelevance(doc, queryLower, {
                    titleMatch,
                    contentMatch
                });
                
                results.push({
                    docName: doc.name,
                    title: this.getPageTitle(doc.name),
                    relevance,
                    snippet: this.getSnippet(doc.content, query),
                    fileName: doc.fileName,
                    wordCount: doc.wordCount,
                    lastModified: doc.lastModified,
                    ...(includeContent && { content: doc.content })
                });
            }
        }

        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }

    calculateRelevance(doc, query, matchTypes) {
        let score = 0;
        
        if (matchTypes.titleMatch) {
            score += 100;
        }
        
        if (matchTypes.contentMatch) {
            const contentMatches = doc.content.toLowerCase().split(query).length - 1;
            score += contentMatches * 10;
            
            // Boost shorter documents
            if (doc.wordCount < 500) score += 20;
        }
        
        return score;
    }

    getSnippet(content, query, length = 200) {
        const queryLower = query.toLowerCase();
        const contentLower = content.toLowerCase();
        const index = contentLower.indexOf(queryLower);
        
        if (index === -1) {
            return content.substring(0, length) + '...';
        }
        
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + 100);
        
        let snippet = content.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        return snippet;
    }

    clearCache() {
        this.cache.clear();
        console.log('Documentation cache cleared');
    }

    getAnalytics() {
        return {
            cacheSize: this.cache.size,
            totalDocuments: Object.keys(this.fileMap).length,
            docsPath: this.docsPath,
            lastClearTime: new Date().toISOString()
        };
    }

    // Express.js middleware for serving docs
    middleware() {
        return async (req, res, next) => {
            const { path: reqPath } = req;
            
            // Handle docs API endpoints
            if (reqPath.startsWith('/api/docs/')) {
                const docName = reqPath.replace('/api/docs/', '');
                
                try {
                    const doc = await this.loadDocument(docName);
                    res.json(doc);
                } catch (error) {
                    res.status(404).json({ 
                        error: 'Document not found',
                        message: error.message 
                    });
                }
                return;
            }
            
            // Handle search endpoint
            if (reqPath === '/api/docs/search' && req.query.q) {
                try {
                    const results = await this.search(req.query.q, {
                        limit: parseInt(req.query.limit) || 10,
                        includeContent: req.query.content === 'true'
                    });
                    res.json(results);
                } catch (error) {
                    res.status(500).json({
                        error: 'Search failed',
                        message: error.message
                    });
                }
                return;
            }
            
            // Handle list all docs endpoint
            if (reqPath === '/api/docs') {
                try {
                    const docs = await this.getAllDocuments();
                    res.json(docs);
                } catch (error) {
                    res.status(500).json({
                        error: 'Failed to load documents',
                        message: error.message
                    });
                }
                return;
            }
            
            next();
        };
    }
}

module.exports = DocsServer;

// For browser environments, export as global
if (typeof window !== 'undefined') {
    window.DocsServer = DocsServer;
}