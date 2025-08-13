/**
 * Documentation API for LLM Runner Router
 * Serves markdown content from the /docs folder as JSON
 */

class DocsAPI {
    constructor() {
        this.basePath = '../docs';
        this.cache = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        // Pre-load critical documentation
        const criticalDocs = ['README', 'API_REFERENCE', 'EXAMPLES'];
        await Promise.all(criticalDocs.map(doc => this.loadDoc(doc)));
        
        this.initialized = true;
    }

    async getDoc(docName) {
        try {
            // Check cache first
            if (this.cache.has(docName)) {
                return this.cache.get(docName);
            }

            const content = await this.loadDoc(docName);
            return content;
        } catch (error) {
            console.error(`Failed to load document: ${docName}`, error);
            throw error;
        }
    }

    async loadDoc(docName) {
        const fileName = this.getFileName(docName);
        
        try {
            // In a real server environment, you'd use fs.readFile
            // For client-side, we'll embed the content directly
            const content = await this.fetchDocContent(fileName);
            
            const processed = {
                name: docName,
                fileName: fileName,
                content: content,
                html: this.markdownToHtml(content),
                lastModified: new Date().toISOString(),
                toc: this.generateTOC(content)
            };

            // Cache the processed content
            this.cache.set(docName, processed);
            return processed;
        } catch (error) {
            throw new Error(`Document not found: ${docName}`);
        }
    }

    getFileName(docName) {
        const fileMap = {
            'README': 'README.md',
            'ARCHITECTURE': 'ARCHITECTURE.md',
            'API_REFERENCE': 'API_REFERENCE.md',
            'CONFIG_REFERENCE': 'CONFIG_REFERENCE.md',
            'ROUTING_STRATEGIES': 'ROUTING_STRATEGIES.md',
            'MODEL_FORMATS': 'MODEL_FORMATS.md',
            'PERFORMANCE': 'PERFORMANCE.md',
            'SECURITY': 'SECURITY.md',
            'TROUBLESHOOTING': 'TROUBLESHOOTING.md',
            'DEPLOYMENT': 'DEPLOYMENT.md',
            'PLUGIN_DEVELOPMENT': 'PLUGIN_DEVELOPMENT.md',
            'FAQ': 'FAQ.md',
            'GLOSSARY': 'GLOSSARY.md',
            'EXAMPLES': 'EXAMPLES.md',
            // Examples subdirectory
            'examples/BASIC': 'examples/BASIC.md',
            'examples/STREAMING': 'examples/STREAMING.md',
            'examples/API': 'examples/API.md',
            'examples/DOCKER': 'examples/DOCKER.md',
            'examples/MONITORING': 'examples/MONITORING.md'
        };

        return fileMap[docName] || `${docName}.md`;
    }

    async fetchDocContent(fileName) {
        // This is where you'd fetch the actual markdown files
        // For now, we'll return embedded content based on what we created

        const docContent = {
            'README.md': `# 📚 LLM-Runner-Router Documentation Hub

*Welcome to the quantum knowledge repository of the Universal Model Orchestration System*

## 🗺️ Documentation Navigation Matrix

### Core Documentation
- [Architecture Overview](./ARCHITECTURE.md) - The grand design of our neural universe
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Deployment Guide](./DEPLOYMENT.md) - Launch your models into production
- [Model Formats](./MODEL_FORMATS.md) - Understanding every neural container
- [Performance Guide](./PERFORMANCE.md) - Optimization strategies and benchmarks

### Development & Extension
- [Plugin Development](./PLUGIN_DEVELOPMENT.md) - Extend the system's consciousness
- [Integration Guide](./INTEGRATION.md) - Connect with existing systems

### Practical Guides
- [Examples & Tutorials](./EXAMPLES.md) - Learn by doing
- [Troubleshooting](./TROUBLESHOOTING.md) - When reality doesn't cooperate
- [Security Guide](./SECURITY.md) - Protecting your neural assets

### Advanced Topics
- [Routing Strategies](./ROUTING_STRATEGIES.md) - Deep dive into model selection
- [Configuration Reference](./CONFIG_REFERENCE.md) - Every knob and dial explained

### Reference Materials
- [FAQ](./FAQ.md) - Questions from across the multiverse
- [Glossary](./GLOSSARY.md) - Speak the language of neural orchestration

## 🚀 Quick Start Paths

### For the Impatient Developer
1. Read [Architecture Overview](./ARCHITECTURE.md) (5 min)
2. Check [Examples](./EXAMPLES.md) (10 min)
3. Deploy with [Deployment Guide](./DEPLOYMENT.md) (15 min)

### For the System Architect
1. Deep dive into [Architecture](./ARCHITECTURE.md)
2. Explore [Routing Strategies](./ROUTING_STRATEGIES.md)
3. Plan with [Configuration Reference](./CONFIG_REFERENCE.md)

## 📖 Documentation Philosophy

Our documentation follows these principles:

1. **Clarity with Character**: Technical precision doesn't mean boring
2. **Examples Everywhere**: Show, don't just tell
3. **Progressive Disclosure**: Start simple, reveal complexity gradually
4. **Practical Focus**: Real-world solutions to real problems
5. **Living Documentation**: Evolves with the codebase

---

*"Documentation is the love letter you write to your future self"* - Ancient Developer Proverb

Built with 💙 by Echo AI Systems`,

            'ARCHITECTURE.md': `# 🧠 LLM-Runner-Router: Universal Model Orchestration System

## 🌌 Project Vision

An agnostic, modular, and blazingly fast LLM model loader and inference router that adapts to ANY model format, ANY runtime environment, and ANY deployment scenario.

## 🏗️ Core Architecture Principles

### 1. **Format Agnosticism**
- Support for GGUF, ONNX, Safetensors, HuggingFace, and custom formats
- Automatic format detection and conversion
- Unified model interface regardless of source

### 2. **Runtime Flexibility**
- Browser (WebGPU/WASM)
- Node.js (Native bindings)
- Edge (Cloudflare Workers/Deno)
- Python interop via child processes

### 3. **Intelligent Routing**
- Automatic model selection based on task
- Load balancing across multiple models
- Fallback chains for reliability
- Cost-optimized routing strategies

## 📁 Project Structure

\`\`\`
LLM-Runner-Router/
├── src/
│   ├── core/                    # Core abstractions
│   │   ├── Router.js            # Intelligent routing logic
│   │   ├── Registry.js          # Model registry system
│   │   └── Pipeline.js          # Processing pipelines
│   ├── loaders/                 # Format-specific loaders
│   │   └── GGUFLoader.js        # GGML/GGUF support
│   ├── engines/                 # Inference engines
│   │   ├── WebGPUEngine.js      # GPU acceleration
│   │   └── WASMEngine.js        # CPU fallback
│   └── utils/                   # Utilities
├── docs/                        # Documentation
└── examples/                    # Usage examples
\`\`\`

## 🚀 Key Features

### 1. **Universal Model Support**
\`\`\`javascript
// Load ANY model format
const model = await LLMRouter.load({
  source: 'huggingface:meta-llama/Llama-2-7b',
  format: 'auto-detect',
  quantization: 'dynamic'
});
\`\`\`

### 2. **Intelligent Routing**
\`\`\`javascript
// Automatic model selection
const router = new LLMRouter({
  models: ['gpt-4', 'llama-2', 'mistral'],
  strategy: 'quality-optimized'
});

const response = await router.complete(prompt);
\`\`\`

## 🎯 Performance Targets

- **Model Load Time**: < 500ms for quantized models
- **First Token Latency**: < 100ms
- **Throughput**: > 100 tokens/second
- **Memory Efficiency**: < 50% of model size
- **Cache Hit Rate**: > 90% for common queries

Built with 💙 by Echo AI Systems`
        };

        return docContent[fileName] || this.getPlaceholderContent(fileName);
    }

    getPlaceholderContent(fileName) {
        const pageName = fileName.replace('.md', '').replace('/', ' / ');
        return `# ${pageName}

This documentation page is currently being loaded.

Please visit our [GitHub repository](https://github.com/MCERQUA/LLM-Runner-Router) for the latest documentation updates.

## Coming Soon

This page will contain comprehensive information about ${pageName.toLowerCase()}.

Stay tuned for updates!

---

Built with 💙 by Echo AI Systems`;
    }

    markdownToHtml(markdown) {
        // Simple markdown to HTML conversion
        // In production, use a proper markdown parser like marked.js
        return markdown
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[h|p])/gm, '<p>')
            .replace(/\n/g, '<br>');
    }

    generateTOC(markdown) {
        const headers = [];
        const lines = markdown.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2];
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                
                headers.push({
                    level,
                    text,
                    id
                });
            }
        }
        
        return headers;
    }

    async getAllDocs() {
        const docNames = [
            'README', 'ARCHITECTURE', 'API_REFERENCE', 'CONFIG_REFERENCE',
            'ROUTING_STRATEGIES', 'MODEL_FORMATS', 'PERFORMANCE', 'SECURITY',
            'TROUBLESHOOTING', 'DEPLOYMENT', 'PLUGIN_DEVELOPMENT', 'FAQ',
            'GLOSSARY', 'EXAMPLES', 'examples/BASIC', 'examples/STREAMING',
            'examples/API', 'examples/DOCKER', 'examples/MONITORING'
        ];

        const docs = {};
        for (const docName of docNames) {
            try {
                docs[docName] = await this.getDoc(docName);
            } catch (error) {
                console.error(`Failed to load ${docName}:`, error);
            }
        }

        return docs;
    }

    async search(query, options = {}) {
        const { limit = 10, includeContent = false } = options;
        const results = [];

        for (const [docName, doc] of this.cache.entries()) {
            const content = doc.content.toLowerCase();
            const queryLower = query.toLowerCase();

            if (content.includes(queryLower)) {
                const relevance = this.calculateRelevance(content, queryLower);
                
                results.push({
                    docName,
                    title: doc.name,
                    relevance,
                    snippet: this.getSnippet(doc.content, query),
                    ...(includeContent && { content: doc.content })
                });
            }
        }

        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }

    calculateRelevance(content, query) {
        // Simple relevance scoring
        const matches = content.split(query).length - 1;
        const titleMatches = content.substring(0, 200).split(query).length - 1;
        
        return matches + (titleMatches * 2);
    }

    getSnippet(content, query, length = 150) {
        const index = content.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return content.substring(0, length);
        
        const start = Math.max(0, index - 75);
        const end = Math.min(content.length, index + 75);
        
        return '...' + content.substring(start, end) + '...';
    }
}

// Export for use in the documentation site
window.DocsAPI = DocsAPI;