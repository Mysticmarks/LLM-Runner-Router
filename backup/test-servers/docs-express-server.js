/**
 * Express.js Server for LLM Runner Router Documentation
 * Serves the enhanced documentation system with full API support
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import compression from 'compression';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DocumentationServer {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || 3001;
        this.docsPath = path.resolve(__dirname, 'docs');
        this.publicPath = path.resolve(__dirname, 'public');
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // File mapping for documentation
        this.fileMap = {
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
            'ollama-setup': 'OLLAMA_SETUP.md',
            'basic-examples': 'examples/BASIC.md',
            'streaming-examples': 'examples/STREAMING.md',
            'api-examples': 'examples/API.md',
            'docker-examples': 'examples/DOCKER.md',
            'monitoring-examples': 'examples/MONITORING.md'
        };
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Enable compression
        this.app.use(compression());
        
        // Enable CORS
        this.app.use(cors());
        
        // Parse JSON
        this.app.use(express.json());
        
        // Serve static files from public directory
        this.app.use(express.static(this.publicPath, {
            maxAge: '1h',
            etag: true
        }));
        
        // Serve documentation markdown files
        this.app.use('/docs', express.static(this.docsPath, {
            maxAge: '30m',
            etag: true,
            setHeaders: (res, path) => {
                if (path.endsWith('.md')) {
                    res.set('Content-Type', 'text/markdown; charset=utf-8');
                }
            }
        }));
    }

    setupRoutes() {
        // Main documentation route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.publicPath, 'enhanced-docs.html'));
        });

        this.app.get('/docs', (req, res) => {
            res.sendFile(path.join(this.publicPath, 'enhanced-docs.html'));
        });

        // API route for single document
        this.app.get('/api/docs/:docName', async (req, res) => {
            try {
                const { docName } = req.params;
                const doc = await this.loadDocument(docName);
                
                // Set caching headers
                res.set({
                    'Cache-Control': 'public, max-age=1800', // 30 minutes
                    'ETag': `"${doc.lastModified}"`,
                    'Last-Modified': new Date(doc.lastModified).toUTCString()
                });
                
                res.json(doc);
            } catch (error) {
                console.error('Error loading document:', error);
                res.status(404).json({ 
                    error: 'Document not found',
                    message: error.message 
                });
            }
        });

        // API route for search
        this.app.get('/api/docs/search', async (req, res) => {
            try {
                const { q: query, limit = 10, content = false } = req.query;
                
                if (!query || query.length < 2) {
                    return res.json([]);
                }
                
                const results = await this.searchDocuments(query, {
                    limit: parseInt(limit),
                    includeContent: content === 'true'
                });
                
                res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
                res.json(results);
            } catch (error) {
                console.error('Search error:', error);
                res.status(500).json({
                    error: 'Search failed',
                    message: error.message
                });
            }
        });

        // API route for all documents
        this.app.get('/api/docs', async (req, res) => {
            try {
                const docs = await this.getAllDocuments();
                
                res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
                res.json(docs);
            } catch (error) {
                console.error('Error loading all documents:', error);
                res.status(500).json({
                    error: 'Failed to load documents',
                    message: error.message
                });
            }
        });

        // API route for documentation analytics
        this.app.get('/api/docs/analytics', (req, res) => {
            res.json({
                totalDocuments: Object.keys(this.fileMap).length,
                cacheSize: this.cache.size,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                lastUpdated: new Date().toISOString()
            });
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.0.0'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                // Redirect unknown routes to documentation
                res.redirect('/docs');
            }
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            
            if (req.path.startsWith('/api/')) {
                res.status(500).json({
                    error: 'Internal server error',
                    message: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
                });
            } else {
                res.status(500).send('Internal server error');
            }
        });
    }

    async loadDocument(docName) {
        // Check cache first
        const cached = this.cache.get(docName);
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
            this.cache.set(docName, {
                data: processed,
                timestamp: Date.now()
            });

            return processed;

        } catch (error) {
            // Return fallback content if file doesn't exist
            return this.getFallbackDocument(docName);
        }
    }

    async getAllDocuments() {
        const docs = {};
        
        const loadPromises = Object.keys(this.fileMap).map(async (docName) => {
            try {
                docs[docName] = await this.loadDocument(docName);
            } catch (error) {
                console.warn(`Failed to load ${docName}:`, error.message);
            }
        });

        await Promise.allSettled(loadPromises);
        return docs;
    }

    async searchDocuments(query, options = {}) {
        const { limit = 10, includeContent = false } = options;
        const results = [];
        const queryLower = query.toLowerCase();

        // Load all documents for search
        const docs = await this.getAllDocuments();

        for (const [docName, doc] of Object.entries(docs)) {
            if (!doc.content) continue;
            
            const content = doc.content.toLowerCase();
            const titleMatch = docName.toLowerCase().includes(queryLower);
            const contentMatch = content.includes(queryLower);
            
            if (titleMatch || contentMatch) {
                const relevance = this.calculateRelevance(doc, queryLower, {
                    titleMatch,
                    contentMatch
                });
                
                results.push({
                    docName: docName,
                    title: this.getPageTitle(docName),
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

    getFallbackDocument(docName) {
        const title = this.getPageTitle(docName);
        const content = `# ${title}

This documentation page is currently being loaded.

The system attempted to load the markdown file for ${title} but it may not be available yet.

## Quick Navigation

- [Overview](./README.md)
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [Examples](./EXAMPLES.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

Please check the [GitHub repository](https://github.com/MCERQUA/LLM-Runner-Router) for the latest documentation updates.

---

Built with 💚 by Echo AI Systems`;
        
        return {
            name: docName,
            fileName: this.fileMap[docName] || `${docName}.md`,
            content: content,
            lastModified: new Date().toISOString(),
            size: content.length,
            wordCount: this.getWordCount(content),
            readingTime: this.getReadingTime(content),
            toc: this.generateTOC(content),
            headings: this.extractHeadings(content),
            isFallback: true
        };
    }

    generateTOC(markdown) {
        const headers = [];
        const lines = markdown.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2];
                const id = text.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/--+/g, '-')
                    .trim();
                
                headers.push({
                    level,
                    text,
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

    async start() {
        try {
            // Check if docs directory exists
            await fs.access(this.docsPath);
            console.log(`📚 Documentation directory found: ${this.docsPath}`);
        } catch (error) {
            console.warn(`⚠️  Documentation directory not found: ${this.docsPath}`);
            console.log('💡 The server will use fallback content for documentation');
        }

        // Start the server
        this.server = this.app.listen(this.port, () => {
            console.log(`🚀 Documentation server running at http://localhost:${this.port}`);
            console.log(`📖 Documentation available at http://localhost:${this.port}/docs`);
            console.log(`🔍 Search API at http://localhost:${this.port}/api/docs/search?q=query`);
            console.log(`📊 Analytics at http://localhost:${this.port}/api/docs/analytics`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());

        return this.server;
    }

    stop() {
        if (this.server) {
            console.log('🛑 Shutting down documentation server...');
            this.server.close(() => {
                console.log('✅ Documentation server stopped');
                process.exit(0);
            });
        }
    }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new DocumentationServer({
        port: process.env.PORT || 3001
    });
    
    server.start().catch(error => {
        console.error('❌ Failed to start documentation server:', error);
        process.exit(1);
    });
}

export default DocumentationServer;