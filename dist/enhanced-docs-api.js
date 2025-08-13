/**
 * Enhanced Documentation API for LLM Runner Router
 * Reads actual markdown files from the /docs folder and provides a rich documentation experience
 */

class EnhancedDocsAPI {
    constructor() {
        this.basePath = '../docs';
        this.cache = new Map();
        this.searchIndex = [];
        this.initialized = false;
        this.fileMap = this.buildFileMap();
    }

    buildFileMap() {
        return {
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
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // Pre-load critical documentation
            const criticalDocs = ['overview', 'architecture', 'api-reference', 'examples'];
            await Promise.allSettled(criticalDocs.map(doc => this.loadDoc(doc)));
            
            // Build search index
            await this.buildSearchIndex();
            
            this.initialized = true;
            console.log('Enhanced Docs API initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Enhanced Docs API:', error);
            throw error;
        }
    }

    async loadDoc(docName) {
        try {
            // Check cache first
            if (this.cache.has(docName)) {
                return this.cache.get(docName);
            }

            const fileName = this.fileMap[docName];
            if (!fileName) {
                throw new Error(`Document mapping not found: ${docName}`);
            }

            // Fetch the actual markdown content
            const content = await this.fetchDocContent(fileName);
            
            const processed = {
                name: docName,
                fileName: fileName,
                content: content,
                html: this.markdownToHtml(content),
                lastModified: new Date().toISOString(),
                toc: this.generateTOC(content),
                wordCount: this.getWordCount(content),
                readingTime: this.getReadingTime(content),
                headings: this.extractHeadings(content)
            };

            // Cache the processed content
            this.cache.set(docName, processed);
            return processed;
        } catch (error) {
            console.error(`Failed to load document: ${docName}`, error);
            throw error;
        }
    }

    async fetchDocContent(fileName) {
        try {
            // Try to fetch the actual file from the docs directory
            const response = await fetch(`../docs/${fileName}`);
            
            if (response.ok) {
                return await response.text();
            } else {
                // Fallback to embedded content if file is not accessible
                console.warn(`Could not fetch ${fileName}, using fallback content`);
                return this.getFallbackContent(fileName);
            }
        } catch (error) {
            console.warn(`Error fetching ${fileName}:`, error.message);
            // Return fallback content on any error
            return this.getFallbackContent(fileName);
        }
    }

    getFallbackContent(fileName) {
        // Provide rich fallback content based on the file name
        const fallbackMap = {
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

Built with 💚 by Echo AI Systems`,

            'ARCHITECTURE.md': `# 🏗️ LLM-Runner-Router: Universal Model Orchestration System

## 🌌 Project Vision

An agnostic, modular, and blazingly fast LLM model loader and inference router that adapts to ANY model format, ANY runtime environment, and ANY deployment scenario.

## 🧠 Core Architecture Principles

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

### 3. **Real-time Streaming**
\`\`\`javascript
// Stream responses with async generators
for await (const chunk of router.stream(prompt)) {
  process.stdout.write(chunk.text);
}
\`\`\`

## 🎯 Performance Targets

- **Model Load Time**: < 500ms for quantized models
- **First Token Latency**: < 100ms
- **Throughput**: > 100 tokens/second
- **Memory Efficiency**: < 50% of model size
- **Cache Hit Rate**: > 90% for common queries

## 🔧 Configuration System

### Environment Detection
\`\`\`javascript
const router = new LLMRouter({
  autoDetectEnvironment: true,  // Auto-selects best engine
  fallbackChain: ['webgpu', 'wasm', 'cpu']
});
\`\`\`

### Custom Strategies
\`\`\`javascript
const router = new LLMRouter({
  strategy: {
    name: 'custom',
    selector: (models, task) => {
      // Your custom selection logic
      return bestModel;
    }
  }
});
\`\`\`

Built with 💚 by Echo AI Systems`,

            'TROUBLESHOOTING.md': `# 🔧 Troubleshooting Guide

*When your neural networks misbehave*

## Common Issues

### Installation Problems

**Issue**: npm install fails
\`\`\`bash
npm ERR! peer dep missing
\`\`\`

**Solution**:
\`\`\`bash
npm install --legacy-peer-deps
# or
npm install --force
\`\`\`

### Model Loading Issues

**Issue**: Model fails to load
\`\`\`javascript
Error: Failed to load model: permission denied
\`\`\`

**Solutions**:
1. Check file permissions
2. Verify model file exists
3. Ensure sufficient memory

### Performance Problems

**Issue**: Slow inference
**Causes**:
- CPU fallback instead of GPU
- Large model without quantization
- Memory fragmentation

**Solutions**:
\`\`\`javascript
// Force GPU acceleration
const router = new LLMRouter({
  preferredEngine: 'webgpu',
  quantization: 'int8'
});
\`\`\`

## Diagnostic Commands

\`\`\`bash
# Check system capabilities
npm run diagnose

# Test model loading
npm run test:model

# Performance benchmark
npm run benchmark
\`\`\`

## Getting Help

1. Check [FAQ](./FAQ.md)
2. Search [GitHub Issues](https://github.com/MCERQUA/LLM-Runner-Router/issues)
3. Join our Discord community
4. Contact support@echoai.systems

Built with 💚 by Echo AI Systems`
        };

        const pageName = fileName.replace('.md', '').replace('examples/', '').replace('/', ' / ');
        
        return fallbackMap[fileName] || `# ${pageName}

This documentation page is currently being loaded from the /docs folder.

If you're seeing this message, it means the system is using fallback content. The actual documentation file should be available at \`docs/${fileName}\`.

## About This Section

This page will contain comprehensive information about ${pageName.toLowerCase()}.

## Quick Links

- [Home](./README.md)
- [Architecture](./ARCHITECTURE.md) 
- [API Reference](./API_REFERENCE.md)
- [Examples](./EXAMPLES.md)

---

Built with 💚 by Echo AI Systems`;
    }

    markdownToHtml(markdown) {
        if (typeof marked !== 'undefined') {
            // Configure marked for better rendering
            marked.setOptions({
                highlight: function(code, lang) {
                    if (typeof Prism !== 'undefined' && lang && Prism.languages[lang]) {
                        return Prism.highlight(code, Prism.languages[lang], lang);
                    }
                    return code;
                },
                breaks: true,
                gfm: true
            });
            
            return marked.parse(markdown);
        }
        
        // Fallback markdown parser if marked.js is not available
        return this.simpleMarkdownToHtml(markdown);
    }

    simpleMarkdownToHtml(markdown) {
        return markdown
            .replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>')
            .replace(/^#### (.*$)/gim, '<h4 id="$1">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[h|u|o|p|l])/gm, '<p>')
            .replace(/\n/g, '<br>');
    }

    generateTOC(markdown) {
        const headers = [];
        const lines = markdown.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2].replace(/[^\w\s-]/g, ''); // Clean text for ID
                const id = text.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/--+/g, '-')
                    .trim();
                
                headers.push({
                    level,
                    text: match[2], // Keep original text for display
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
        return content.trim().split(/\s+/).length;
    }

    getReadingTime(content) {
        const wordsPerMinute = 200;
        const words = this.getWordCount(content);
        return Math.ceil(words / wordsPerMinute);
    }

    async buildSearchIndex() {
        this.searchIndex = [];
        
        for (const [docName, doc] of this.cache.entries()) {
            const content = doc.content.toLowerCase();
            const headings = doc.headings;
            
            // Index the document
            this.searchIndex.push({
                docName,
                title: this.getPageTitle(docName),
                content: content,
                headings: Object.values(headings).flat(),
                wordCount: doc.wordCount,
                fileName: doc.fileName
            });
        }
        
        console.log(`Search index built with ${this.searchIndex.length} documents`);
    }

    async search(query, options = {}) {
        const { limit = 10, includeContent = false } = options;
        const results = [];
        const queryLower = query.toLowerCase();

        for (const doc of this.searchIndex) {
            const titleMatch = doc.title.toLowerCase().includes(queryLower);
            const contentMatch = doc.content.includes(queryLower);
            const headingMatch = doc.headings.some(h => 
                h.text.toLowerCase().includes(queryLower)
            );

            if (titleMatch || contentMatch || headingMatch) {
                const relevance = this.calculateRelevance(doc, queryLower, {
                    titleMatch,
                    contentMatch,
                    headingMatch
                });
                
                results.push({
                    docName: doc.docName,
                    title: doc.title,
                    relevance,
                    snippet: this.getSnippet(doc.content, query),
                    fileName: doc.fileName,
                    wordCount: doc.wordCount,
                    matchType: titleMatch ? 'title' : headingMatch ? 'heading' : 'content',
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
        
        // Title matches are most important
        if (matchTypes.titleMatch) {
            score += 100;
            const titleMatches = doc.title.toLowerCase().split(query).length - 1;
            score += titleMatches * 50;
        }
        
        // Heading matches are quite important
        if (matchTypes.headingMatch) {
            score += 75;
            const headingMatches = doc.headings.filter(h => 
                h.text.toLowerCase().includes(query)
            ).length;
            score += headingMatches * 25;
        }
        
        // Content matches
        if (matchTypes.contentMatch) {
            const contentMatches = doc.content.split(query).length - 1;
            score += contentMatches * 10;
            
            // Boost shorter documents (more focused content)
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
        
        // Add ellipsis if truncated
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        // Highlight the search term
        const regex = new RegExp(`(${query})`, 'gi');
        snippet = snippet.replace(regex, '<mark>$1</mark>');
        
        return snippet;
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

    async getAllDocs() {
        const docs = {};
        
        for (const docName of Object.keys(this.fileMap)) {
            try {
                docs[docName] = await this.loadDoc(docName);
            } catch (error) {
                console.error(`Failed to load ${docName}:`, error);
            }
        }

        return docs;
    }

    // Analytics and metrics
    getAnalytics() {
        return {
            totalDocuments: this.cache.size,
            cacheHitRate: this.getCacheHitRate(),
            popularDocuments: this.getPopularDocuments(),
            searchIndexSize: this.searchIndex.length,
            lastUpdated: new Date().toISOString()
        };
    }

    getCacheHitRate() {
        // Simple implementation - in production you'd track actual hits
        return Math.round((this.cache.size / Object.keys(this.fileMap).length) * 100);
    }

    getPopularDocuments() {
        // In production, you'd track actual page views
        return ['overview', 'architecture', 'api-reference', 'examples', 'troubleshooting'];
    }

    // Utility methods
    clearCache() {
        this.cache.clear();
        this.searchIndex = [];
        console.log('Documentation cache cleared');
    }

    async refresh() {
        this.clearCache();
        await this.init();
        console.log('Documentation refreshed');
    }
}

// Export for use in the documentation site
if (typeof window !== 'undefined') {
    window.EnhancedDocsAPI = EnhancedDocsAPI;
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedDocsAPI;
}