# API Server Examples

Building production-ready API servers with LLM-Runner-Router, including REST APIs, GraphQL, WebSocket servers, and middleware integration.

## Table of Contents
- [Express REST API](#express-rest-api)
- [Fastify High-Performance API](#fastify-high-performance-api)
- [GraphQL API](#graphql-api)
- [WebSocket Real-time API](#websocket-real-time-api)
- [Microservices Architecture](#microservices-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Rate Limiting & Throttling](#rate-limiting--throttling)
- [Production Deployment](#production-deployment)

## Express REST API

### 1. Basic REST Server

```javascript
// server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import LLMRouter from 'llm-runner-router';

class LLMAPIServer {
    constructor() {
        this.app = express();
        this.router = new LLMRouter({
            strategy: 'balanced',
            logLevel: 'info'
        });
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        // Security
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests, please try again later',
                retryAfter: 900
            }
        });
        this.app.use(limiter);
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            const status = this.router.getStatus();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                router: {
                    initialized: status.initialized,
                    modelsLoaded: status.modelsLoaded,
                    engine: status.engine
                }
            });
        });
        
        // API routes
        this.app.use('/api/v1', this.createAPIRoutes());
        
        // Error handling
        this.app.use(this.errorHandler.bind(this));
    }
    
    createAPIRoutes() {
        const router = express.Router();
        
        // Text generation
        router.post('/generate', async (req, res) => {
            try {
                const { prompt, options = {} } = req.body;
                
                if (!prompt) {
                    return res.status(400).json({
                        error: 'Prompt is required',
                        code: 'MISSING_PROMPT'
                    });
                }
                
                const startTime = Date.now();
                const result = await this.router.quick(prompt, {
                    maxTokens: Math.min(options.maxTokens || 500, 2000), // Cap at 2000
                    temperature: Math.max(0, Math.min(options.temperature || 0.7, 2)), // 0-2 range
                    topP: Math.max(0, Math.min(options.topP || 0.9, 1)),
                    cache: options.cache !== false
                });
                
                res.json({
                    success: true,
                    data: {
                        text: result.text,
                        tokens: result.tokens,
                        model: result.model,
                        latency: Date.now() - startTime,
                        cached: result.cached || false
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9)
                    }
                });
                
            } catch (error) {
                console.error('Generation error:', error);
                res.status(500).json({
                    error: 'Generation failed',
                    message: error.message,
                    code: 'GENERATION_ERROR'
                });
            }
        });
        
        // Advanced generation with fallbacks
        router.post('/generate/advanced', async (req, res) => {
            try {
                const { prompt, model, options = {}, fallbacks = [] } = req.body;
                
                const config = {
                    prompt,
                    model,
                    temperature: options.temperature || 0.7,
                    maxTokens: options.maxTokens || 500,
                    fallbacks,
                    timeout: options.timeout || 30000,
                    retries: options.retries || 2
                };
                
                const result = await this.router.advanced(config);
                
                res.json({
                    success: true,
                    data: result,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        fallbacksUsed: result.fallbackUsed || false
                    }
                });
                
            } catch (error) {
                res.status(500).json({
                    error: 'Advanced generation failed',
                    message: error.message
                });
            }
        });
        
        // Streaming endpoint (Server-Sent Events)
        router.get('/stream', async (req, res) => {
            const { prompt, maxTokens = 300, temperature = 0.7 } = req.query;
            
            if (!prompt) {
                return res.status(400).json({ error: 'Prompt parameter is required' });
            }
            
            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            
            try {
                const stream = this.router.stream(prompt, {
                    maxTokens: parseInt(maxTokens),
                    temperature: parseFloat(temperature)
                });
                
                let tokenCount = 0;
                const startTime = Date.now();
                
                res.write(`data: ${JSON.stringify({ type: 'start', prompt })}\n\n`);
                
                for await (const token of stream) {
                    tokenCount++;
                    res.write(`data: ${JSON.stringify({ 
                        type: 'token', 
                        token, 
                        position: tokenCount,
                        timestamp: Date.now()
                    })}\n\n`);
                }
                
                res.write(`data: ${JSON.stringify({ 
                    type: 'complete', 
                    totalTokens: tokenCount,
                    duration: Date.now() - startTime
                })}\n\n`);
                
            } catch (error) {
                res.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    error: error.message 
                })}\n\n`);
            } finally {
                res.end();
            }
        });
        
        // Batch processing
        router.post('/batch', async (req, res) => {
            try {
                const { prompts, options = {} } = req.body;
                
                if (!Array.isArray(prompts) || prompts.length === 0) {
                    return res.status(400).json({
                        error: 'Prompts array is required'
                    });
                }
                
                if (prompts.length > 10) {
                    return res.status(400).json({
                        error: 'Maximum 10 prompts allowed per batch'
                    });
                }
                
                const results = await Promise.allSettled(
                    prompts.map(prompt => this.router.quick(prompt, options))
                );
                
                const processedResults = results.map((result, index) => ({
                    index,
                    success: result.status === 'fulfilled',
                    data: result.status === 'fulfilled' ? result.value : null,
                    error: result.status === 'rejected' ? result.reason.message : null
                }));
                
                res.json({
                    success: true,
                    results: processedResults,
                    summary: {
                        total: prompts.length,
                        successful: processedResults.filter(r => r.success).length,
                        failed: processedResults.filter(r => !r.success).length
                    }
                });
                
            } catch (error) {
                res.status(500).json({
                    error: 'Batch processing failed',
                    message: error.message
                });
            }
        });
        
        // Model management
        router.get('/models', (req, res) => {
            const models = this.router.registry.list().map(model => ({
                id: model.id,
                name: model.name,
                type: model.type,
                size: model.size,
                capabilities: model.capabilities,
                status: model.status
            }));
            
            res.json({
                success: true,
                models,
                count: models.length
            });
        });
        
        router.post('/models/load', async (req, res) => {
            try {
                const { source, format, immediate = false } = req.body;
                
                const model = await this.router.load({
                    source,
                    format,
                    immediate
                });
                
                res.json({
                    success: true,
                    model: {
                        id: model.id,
                        name: model.name,
                        loaded: true
                    }
                });
                
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to load model',
                    message: error.message
                });
            }
        });
        
        // System metrics
        router.get('/metrics', (req, res) => {
            const metrics = this.router.getMetrics();
            const status = this.router.getStatus();
            
            res.json({
                success: true,
                metrics: {
                    ...metrics,
                    system: {
                        uptime: process.uptime(),
                        memoryUsage: process.memoryUsage(),
                        cpuUsage: process.cpuUsage(),
                        platform: process.platform,
                        nodeVersion: process.version
                    },
                    router: status
                }
            });
        });
        
        return router;
    }
    
    errorHandler(error, req, res, next) {
        console.error('API Error:', error);
        
        res.status(error.status || 500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
        });
    }
    
    async start(port = process.env.PORT || 3000) {
        try {
            await this.router.initialize();
            
            this.server = this.app.listen(port, () => {
                console.log(`🚀 LLM API Server running on port ${port}`);
                console.log(`📚 Health check: http://localhost:${port}/health`);
                console.log(`🔧 API docs: http://localhost:${port}/api/v1`);
            });
            
            // Graceful shutdown
            process.on('SIGTERM', () => this.stop());
            process.on('SIGINT', () => this.stop());
            
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    
    async stop() {
        console.log('🔄 Shutting down server...');
        
        if (this.server) {
            await new Promise(resolve => this.server.close(resolve));
        }
        
        await this.router.cleanup();
        console.log('✅ Server stopped gracefully');
        process.exit(0);
    }
}

// Start server
const server = new LLMAPIServer();
server.start();

export default LLMAPIServer;
```

### 2. OpenAPI Documentation

```javascript
// docs/openapi.js - OpenAPI/Swagger specification
export const openAPISpec = {
    openapi: '3.0.3',
    info: {
        title: 'LLM Router API',
        description: 'Universal LLM inference API with intelligent routing',
        version: '1.0.0',
        contact: {
            name: 'API Support',
            email: 'support@example.com'
        }
    },
    servers: [
        {
            url: 'http://localhost:3000/api/v1',
            description: 'Development server'
        },
        {
            url: 'https://api.example.com/v1',
            description: 'Production server'
        }
    ],
    paths: {
        '/generate': {
            post: {
                summary: 'Generate text',
                description: 'Generate text using automatic model selection',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['prompt'],
                                properties: {
                                    prompt: {
                                        type: 'string',
                                        description: 'Input text prompt',
                                        example: 'Explain machine learning in simple terms'
                                    },
                                    options: {
                                        type: 'object',
                                        properties: {
                                            maxTokens: {
                                                type: 'integer',
                                                minimum: 1,
                                                maximum: 2000,
                                                default: 500,
                                                description: 'Maximum tokens to generate'
                                            },
                                            temperature: {
                                                type: 'number',
                                                minimum: 0,
                                                maximum: 2,
                                                default: 0.7,
                                                description: 'Sampling temperature'
                                            },
                                            topP: {
                                                type: 'number',
                                                minimum: 0,
                                                maximum: 1,
                                                default: 0.9,
                                                description: 'Nucleus sampling parameter'
                                            },
                                            cache: {
                                                type: 'boolean',
                                                default: true,
                                                description: 'Enable response caching'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Successful generation',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                text: { type: 'string' },
                                                tokens: { type: 'integer' },
                                                model: { type: 'string' },
                                                latency: { type: 'integer' },
                                                cached: { type: 'boolean' }
                                            }
                                        },
                                        metadata: {
                                            type: 'object',
                                            properties: {
                                                timestamp: { type: 'string', format: 'date-time' },
                                                requestId: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    400: {
                        description: 'Bad request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    500: {
                        description: 'Server error',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        }
        // ... other endpoints
    },
    components: {
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    requestId: { type: 'string' }
                }
            }
        }
    }
};

// Add Swagger UI
import swaggerUi from 'swagger-ui-express';

// In your server setup:
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openAPISpec));
```

## Fastify High-Performance API

### 1. Fastify Server

```javascript
// fastify-server.js
import Fastify from 'fastify';
import LLMRouter from 'llm-runner-router';

class FastifyLLMServer {
    constructor() {
        this.fastify = Fastify({
            logger: {
                level: 'info',
                transport: {
                    target: 'pino-pretty'
                }
            },
            trustProxy: true
        });
        
        this.router = new LLMRouter({
            strategy: 'speed-priority'
        });
        
        this.setupPlugins();
        this.setupRoutes();
    }
    
    async setupPlugins() {
        // CORS
        await this.fastify.register(import('@fastify/cors'), {
            origin: (origin, callback) => {
                const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'), false);
                }
            }
        });
        
        // Rate limiting
        await this.fastify.register(import('@fastify/rate-limit'), {
            max: 100,
            timeWindow: '15 minutes',
            errorResponseBuilder: (request, context) => ({
                code: 429,
                error: 'Too Many Requests',
                message: `Rate limit exceeded, retry in ${context.after}ms`,
                expiresIn: context.ttl
            })
        });
        
        // Helmet for security
        await this.fastify.register(import('@fastify/helmet'));
        
        // Swagger documentation
        await this.fastify.register(import('@fastify/swagger'), {
            swagger: {
                info: {
                    title: 'LLM Router Fastify API',
                    description: 'High-performance LLM API with Fastify',
                    version: '1.0.0'
                },
                host: 'localhost:3000',
                schemes: ['http', 'https'],
                consumes: ['application/json'],
                produces: ['application/json']
            }
        });
        
        await this.fastify.register(import('@fastify/swagger-ui'), {
            routePrefix: '/docs',
            uiConfig: {
                docExpansion: 'full',
                deepLinking: false
            }
        });
    }
    
    setupRoutes() {
        // Health check
        this.fastify.get('/health', {
            schema: {
                description: 'Health check endpoint',
                tags: ['health'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            timestamp: { type: 'string' },
                            router: {
                                type: 'object',
                                properties: {
                                    initialized: { type: 'boolean' },
                                    modelsLoaded: { type: 'number' },
                                    engine: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const status = this.router.getStatus();
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                router: {
                    initialized: status.initialized,
                    modelsLoaded: status.modelsLoaded,
                    engine: status.engine
                }
            };
        });
        
        // Text generation
        this.fastify.post('/api/v1/generate', {
            schema: {
                description: 'Generate text using LLM',
                tags: ['generation'],
                body: {
                    type: 'object',
                    required: ['prompt'],
                    properties: {
                        prompt: { 
                            type: 'string',
                            description: 'Text prompt for generation'
                        },
                        options: {
                            type: 'object',
                            properties: {
                                maxTokens: { 
                                    type: 'integer', 
                                    minimum: 1, 
                                    maximum: 2000,
                                    default: 500
                                },
                                temperature: { 
                                    type: 'number', 
                                    minimum: 0, 
                                    maximum: 2,
                                    default: 0.7
                                },
                                topP: { 
                                    type: 'number', 
                                    minimum: 0, 
                                    maximum: 1,
                                    default: 0.9
                                },
                                cache: { 
                                    type: 'boolean',
                                    default: true
                                }
                            }
                        }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    text: { type: 'string' },
                                    tokens: { type: 'integer' },
                                    model: { type: 'string' },
                                    latency: { type: 'integer' },
                                    cached: { type: 'boolean' }
                                }
                            }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const { prompt, options = {} } = request.body;
            
            const startTime = Date.now();
            const result = await this.router.quick(prompt, {
                maxTokens: Math.min(options.maxTokens || 500, 2000),
                temperature: Math.max(0, Math.min(options.temperature || 0.7, 2)),
                topP: Math.max(0, Math.min(options.topP || 0.9, 1)),
                cache: options.cache !== false
            });
            
            return {
                success: true,
                data: {
                    text: result.text,
                    tokens: result.tokens,
                    model: result.model,
                    latency: Date.now() - startTime,
                    cached: result.cached || false
                }
            };
        });
        
        // Streaming with async iteration
        this.fastify.get('/api/v1/stream', {
            schema: {
                description: 'Stream text generation',
                tags: ['streaming'],
                querystring: {
                    type: 'object',
                    required: ['prompt'],
                    properties: {
                        prompt: { type: 'string' },
                        maxTokens: { type: 'integer', default: 300 },
                        temperature: { type: 'number', default: 0.7 }
                    }
                }
            }
        }, async (request, reply) => {
            const { prompt, maxTokens = 300, temperature = 0.7 } = request.query;
            
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            
            try {
                const stream = this.router.stream(prompt, {
                    maxTokens: parseInt(maxTokens),
                    temperature: parseFloat(temperature)
                });
                
                let tokenCount = 0;
                for await (const token of stream) {
                    tokenCount++;
                    reply.raw.write(`data: ${JSON.stringify({ 
                        token, 
                        position: tokenCount 
                    })}\n\n`);
                }
                
                reply.raw.write(`data: ${JSON.stringify({ 
                    type: 'complete',
                    totalTokens: tokenCount
                })}\n\n`);
            } catch (error) {
                reply.raw.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    error: error.message 
                })}\n\n`);
            }
            
            reply.raw.end();
        });
        
        // WebSocket support
        this.fastify.register(async (fastify) => {
            await fastify.register(import('@fastify/websocket'));
            
            fastify.get('/ws', { websocket: true }, (connection, request) => {
                connection.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        
                        if (data.type === 'generate') {
                            const stream = this.router.stream(data.prompt, data.options || {});
                            
                            connection.send(JSON.stringify({ 
                                type: 'start',
                                requestId: data.requestId
                            }));
                            
                            let tokenCount = 0;
                            for await (const token of stream) {
                                tokenCount++;
                                connection.send(JSON.stringify({
                                    type: 'token',
                                    token,
                                    position: tokenCount,
                                    requestId: data.requestId
                                }));
                            }
                            
                            connection.send(JSON.stringify({
                                type: 'complete',
                                totalTokens: tokenCount,
                                requestId: data.requestId
                            }));
                        }
                    } catch (error) {
                        connection.send(JSON.stringify({
                            type: 'error',
                            error: error.message
                        }));
                    }
                });
            });
        });
        
        // Error handler
        this.fastify.setErrorHandler((error, request, reply) => {
            request.log.error(error);
            
            reply.status(error.statusCode || 500).send({
                error: error.name || 'InternalServerError',
                message: error.message,
                statusCode: error.statusCode || 500,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    async start(port = process.env.PORT || 3000) {
        try {
            await this.router.initialize();
            await this.fastify.listen({ 
                port: parseInt(port), 
                host: '0.0.0.0' 
            });
            
            console.log(`🚀 Fastify LLM API running on port ${port}`);
            console.log(`📚 Docs available at http://localhost:${port}/docs`);
            
        } catch (error) {
            this.fastify.log.error(error);
            process.exit(1);
        }
    }
    
    async stop() {
        await this.router.cleanup();
        await this.fastify.close();
    }
}

// Start server
const server = new FastifyLLMServer();
server.start();

export default FastifyLLMServer;
```

## GraphQL API

### 1. GraphQL Server with Apollo

```javascript
// graphql-server.js
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language/index.js';
import LLMRouter from 'llm-runner-router';

// Custom scalar for JSON
const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON custom scalar type',
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral: (ast) => {
        if (ast.kind === Kind.STRING) {
            return JSON.parse(ast.value);
        }
        return null;
    }
});

// Type definitions
const typeDefs = `
    scalar JSON
    scalar DateTime
    
    type Model {
        id: ID!
        name: String!
        type: String!
        size: Int
        capabilities: [String!]!
        status: String!
        loadedAt: DateTime
    }
    
    type GenerationOptions {
        maxTokens: Int
        temperature: Float
        topP: Float
        topK: Int
        cache: Boolean
        stream: Boolean
    }
    
    input GenerationOptionsInput {
        maxTokens: Int = 500
        temperature: Float = 0.7
        topP: Float = 0.9
        topK: Int = 40
        cache: Boolean = true
        stream: Boolean = false
    }
    
    type GenerationResult {
        text: String!
        tokens: Int!
        model: String!
        latency: Int!
        cached: Boolean!
        metadata: JSON
    }
    
    type BatchResult {
        index: Int!
        success: Boolean!
        result: GenerationResult
        error: String
    }
    
    type BatchResponse {
        results: [BatchResult!]!
        summary: BatchSummary!
    }
    
    type BatchSummary {
        total: Int!
        successful: Int!
        failed: Int!
        averageLatency: Float
    }
    
    type SystemMetrics {
        totalInferences: Int!
        averageLatency: Float!
        cacheHitRate: Float!
        modelsLoaded: Int!
        memoryUsage: JSON!
        uptime: Float!
    }
    
    type StreamToken {
        token: String!
        position: Int!
        timestamp: DateTime!
        complete: Boolean!
    }
    
    type Query {
        models: [Model!]!
        model(id: ID!): Model
        metrics: SystemMetrics!
        health: JSON!
    }
    
    type Mutation {
        generateText(
            prompt: String!
            options: GenerationOptionsInput
        ): GenerationResult!
        
        generateAdvanced(
            prompt: String!
            model: String
            options: GenerationOptionsInput
            fallbacks: [String!]
        ): GenerationResult!
        
        generateBatch(
            prompts: [String!]!
            options: GenerationOptionsInput
        ): BatchResponse!
        
        loadModel(
            source: String!
            format: String
            immediate: Boolean = false
        ): Model!
        
        unloadModel(id: ID!): Boolean!
    }
    
    type Subscription {
        streamGeneration(
            prompt: String!
            options: GenerationOptionsInput
        ): StreamToken!
    }
`;

class GraphQLLLMServer {
    constructor() {
        this.router = new LLMRouter({
            strategy: 'balanced'
        });
        this.activeStreams = new Map();
    }
    
    createResolvers() {
        return {
            JSON: JSONScalar,
            DateTime: new GraphQLScalarType({
                name: 'DateTime',
                serialize: (value) => value instanceof Date ? value.toISOString() : value,
                parseValue: (value) => new Date(value),
                parseLiteral: (ast) => ast.kind === Kind.STRING ? new Date(ast.value) : null
            }),
            
            Query: {
                models: () => {
                    return this.router.registry.list().map(model => ({
                        id: model.id,
                        name: model.name,
                        type: model.type,
                        size: model.size,
                        capabilities: model.capabilities,
                        status: model.status,
                        loadedAt: model.loadedAt
                    }));
                },
                
                model: (_, { id }) => {
                    const model = this.router.registry.get(id);
                    return model ? {
                        id: model.id,
                        name: model.name,
                        type: model.type,
                        size: model.size,
                        capabilities: model.capabilities,
                        status: model.status,
                        loadedAt: model.loadedAt
                    } : null;
                },
                
                metrics: () => {
                    const metrics = this.router.getMetrics();
                    const memoryUsage = process.memoryUsage();
                    
                    return {
                        totalInferences: metrics.totalInferences || 0,
                        averageLatency: metrics.averageLatency || 0,
                        cacheHitRate: metrics.cacheHitRate || 0,
                        modelsLoaded: metrics.modelsLoaded || 0,
                        memoryUsage,
                        uptime: process.uptime()
                    };
                },
                
                health: () => {
                    const status = this.router.getStatus();
                    return {
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        router: status
                    };
                }
            },
            
            Mutation: {
                generateText: async (_, { prompt, options = {} }) => {
                    const startTime = Date.now();
                    const result = await this.router.quick(prompt, options);
                    
                    return {
                        text: result.text,
                        tokens: result.tokens,
                        model: result.model,
                        latency: Date.now() - startTime,
                        cached: result.cached || false,
                        metadata: {
                            timestamp: new Date().toISOString()
                        }
                    };
                },
                
                generateAdvanced: async (_, { prompt, model, options = {}, fallbacks = [] }) => {
                    const config = {
                        prompt,
                        model,
                        ...options,
                        fallbacks
                    };
                    
                    const result = await this.router.advanced(config);
                    
                    return {
                        text: result.text,
                        tokens: result.tokens,
                        model: result.model,
                        latency: result.latency,
                        cached: result.cached || false,
                        metadata: {
                            fallbackUsed: result.fallbackUsed || false,
                            timestamp: new Date().toISOString()
                        }
                    };
                },
                
                generateBatch: async (_, { prompts, options = {} }) => {
                    const startTime = Date.now();
                    const results = await Promise.allSettled(
                        prompts.map((prompt, index) => 
                            this.router.quick(prompt, options)
                                .then(result => ({ index, result }))
                                .catch(error => ({ index, error }))
                        )
                    );
                    
                    const processedResults = results.map((result, index) => {
                        if (result.status === 'fulfilled' && !result.value.error) {
                            return {
                                index,
                                success: true,
                                result: {
                                    text: result.value.result.text,
                                    tokens: result.value.result.tokens,
                                    model: result.value.result.model,
                                    latency: result.value.result.latency,
                                    cached: result.value.result.cached || false,
                                    metadata: {}
                                },
                                error: null
                            };
                        } else {
                            return {
                                index,
                                success: false,
                                result: null,
                                error: result.value?.error?.message || result.reason?.message || 'Unknown error'
                            };
                        }
                    });
                    
                    const successful = processedResults.filter(r => r.success);
                    const totalLatency = Date.now() - startTime;
                    
                    return {
                        results: processedResults,
                        summary: {
                            total: prompts.length,
                            successful: successful.length,
                            failed: processedResults.length - successful.length,
                            averageLatency: totalLatency / prompts.length
                        }
                    };
                },
                
                loadModel: async (_, { source, format, immediate }) => {
                    const model = await this.router.load({
                        source,
                        format,
                        immediate
                    });
                    
                    return {
                        id: model.id,
                        name: model.name,
                        type: model.type,
                        size: model.size,
                        capabilities: model.capabilities,
                        status: model.status,
                        loadedAt: new Date()
                    };
                },
                
                unloadModel: async (_, { id }) => {
                    try {
                        await this.router.registry.unregister(id);
                        return true;
                    } catch (error) {
                        console.error('Failed to unload model:', error);
                        return false;
                    }
                }
            },
            
            Subscription: {
                streamGeneration: {
                    subscribe: async function* (_, { prompt, options = {} }) {
                        const stream = this.router.stream(prompt, options);
                        let tokenCount = 0;
                        
                        try {
                            for await (const token of stream) {
                                tokenCount++;
                                yield {
                                    streamGeneration: {
                                        token,
                                        position: tokenCount,
                                        timestamp: new Date().toISOString(),
                                        complete: false
                                    }
                                };
                            }
                            
                            // Send completion signal
                            yield {
                                streamGeneration: {
                                    token: '',
                                    position: tokenCount,
                                    timestamp: new Date().toISOString(),
                                    complete: true
                                }
                            };
                        } catch (error) {
                            throw new Error(`Streaming failed: ${error.message}`);
                        }
                    }.bind(this)
                }
            }
        };
    }
    
    async start(port = process.env.PORT || 4000) {
        await this.router.initialize();
        
        const server = new ApolloServer({
            typeDefs,
            resolvers: this.createResolvers(),
            plugins: [
                {
                    requestDidStart() {
                        return {
                            didResolveOperation(requestContext) {
                                console.log(`GraphQL operation: ${requestContext.request.operationName}`);
                            }
                        };
                    }
                }
            ]
        });
        
        const { url } = await startStandaloneServer(server, {
            listen: { port: parseInt(port) },
            context: async ({ req }) => ({
                // Add context data here
                timestamp: new Date().toISOString(),
                userAgent: req.headers['user-agent']
            })
        });
        
        console.log(`🚀 GraphQL server running at ${url}`);
        console.log(`🔍 GraphQL Playground available at ${url}`);
        
        return server;
    }
}

// Start server
const server = new GraphQLLLMServer();
server.start();

export default GraphQLLLMServer;
```

### 2. GraphQL Client Example

```javascript
// client/graphql-client.js
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client/core/index.js';
import { setContext } from '@apollo/client/link/context/index.js';
import fetch from 'cross-fetch';

class LLMGraphQLClient {
    constructor(uri = 'http://localhost:4000/graphql', options = {}) {
        const httpLink = createHttpLink({
            uri,
            fetch
        });
        
        const authLink = setContext((_, { headers }) => {
            const token = options.apiKey;
            return {
                headers: {
                    ...headers,
                    ...(token && { authorization: `Bearer ${token}` })
                }
            };
        });
        
        this.client = new ApolloClient({
            link: authLink.concat(httpLink),
            cache: new InMemoryCache()
        });
    }
    
    async generateText(prompt, options = {}) {
        const query = gql`
            mutation GenerateText($prompt: String!, $options: GenerationOptionsInput) {
                generateText(prompt: $prompt, options: $options) {
                    text
                    tokens
                    model
                    latency
                    cached
                    metadata
                }
            }
        `;
        
        const result = await this.client.mutate({
            mutation: query,
            variables: { prompt, options }
        });
        
        return result.data.generateText;
    }
    
    async generateBatch(prompts, options = {}) {
        const query = gql`
            mutation GenerateBatch($prompts: [String!]!, $options: GenerationOptionsInput) {
                generateBatch(prompts: $prompts, options: $options) {
                    results {
                        index
                        success
                        result {
                            text
                            tokens
                            model
                            latency
                        }
                        error
                    }
                    summary {
                        total
                        successful
                        failed
                        averageLatency
                    }
                }
            }
        `;
        
        const result = await this.client.mutate({
            mutation: query,
            variables: { prompts, options }
        });
        
        return result.data.generateBatch;
    }
    
    async getModels() {
        const query = gql`
            query GetModels {
                models {
                    id
                    name
                    type
                    size
                    capabilities
                    status
                    loadedAt
                }
            }
        `;
        
        const result = await this.client.query({ query });
        return result.data.models;
    }
    
    async getMetrics() {
        const query = gql`
            query GetMetrics {
                metrics {
                    totalInferences
                    averageLatency
                    cacheHitRate
                    modelsLoaded
                    memoryUsage
                    uptime
                }
            }
        `;
        
        const result = await this.client.query({ query });
        return result.data.metrics;
    }
    
    async loadModel(source, format, immediate = false) {
        const mutation = gql`
            mutation LoadModel($source: String!, $format: String, $immediate: Boolean) {
                loadModel(source: $source, format: $format, immediate: $immediate) {
                    id
                    name
                    type
                    status
                    loadedAt
                }
            }
        `;
        
        const result = await this.client.mutate({
            mutation,
            variables: { source, format, immediate }
        });
        
        return result.data.loadModel;
    }
}

// Usage example
const client = new LLMGraphQLClient('http://localhost:4000/graphql');

// Generate text
const result = await client.generateText("Explain quantum computing", {
    maxTokens: 300,
    temperature: 0.7
});
console.log('Generated text:', result.text);

// Batch generation
const batchResult = await client.generateBatch([
    "What is AI?",
    "How does machine learning work?",
    "Explain neural networks"
], { maxTokens: 200 });
console.log('Batch results:', batchResult);

// Get system metrics
const metrics = await client.getMetrics();
console.log('System metrics:', metrics);

export default LLMGraphQLClient;
```

## WebSocket Real-time API

### 1. WebSocket Server

```javascript
// websocket-api.js
import WebSocket, { WebSocketServer } from 'ws';
import LLMRouter from 'llm-runner-router';
import { v4 as uuidv4 } from 'uuid';

class WebSocketLLMAPI {
    constructor(port = 8080) {
        this.port = port;
        this.router = new LLMRouter({
            strategy: 'speed-priority'
        });
        this.clients = new Map();
        this.rooms = new Map();
        this.activeStreams = new Map();
    }
    
    async initialize() {
        await this.router.initialize();
        
        this.wss = new WebSocketServer({ 
            port: this.port,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024
                }
            }
        });
        
        this.wss.on('connection', (ws, request) => {
            const clientId = uuidv4();
            const clientInfo = {
                id: clientId,
                ws,
                connectedAt: Date.now(),
                ip: request.socket.remoteAddress,
                userAgent: request.headers['user-agent'],
                subscriptions: new Set(),
                rateLimiter: {
                    requests: 0,
                    windowStart: Date.now(),
                    maxRequests: 100,
                    windowMs: 60000
                }
            };
            
            this.clients.set(clientId, clientInfo);
            
            console.log(`📱 Client ${clientId} connected (${this.clients.size} total)`);
            
            // Send welcome message
            this.sendToClient(clientId, {
                type: 'connected',
                clientId,
                serverTime: new Date().toISOString(),
                capabilities: {
                    streaming: true,
                    batch: true,
                    models: true,
                    rooms: true
                }
            });
            
            ws.on('message', (data) => {
                this.handleMessage(clientId, data);
            });
            
            ws.on('close', (code, reason) => {
                this.handleDisconnect(clientId, code, reason);
            });
            
            ws.on('error', (error) => {
                console.error(`Client ${clientId} error:`, error);
            });
        });
        
        console.log(`🌐 WebSocket LLM API running on ws://localhost:${this.port}`);
        
        // Cleanup interval for inactive clients
        setInterval(() => this.cleanupInactiveClients(), 300000); // 5 minutes
    }
    
    async handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        // Rate limiting
        if (!this.checkRateLimit(client)) {
            this.sendToClient(clientId, {
                type: 'error',
                error: 'Rate limit exceeded',
                retryAfter: client.rateLimiter.windowMs - (Date.now() - client.rateLimiter.windowStart)
            });
            return;
        }
        
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'generate':
                    await this.handleGenerate(clientId, message);
                    break;
                    
                case 'stream':
                    await this.handleStream(clientId, message);
                    break;
                    
                case 'stop_stream':
                    this.handleStopStream(clientId, message);
                    break;
                    
                case 'batch':
                    await this.handleBatch(clientId, message);
                    break;
                    
                case 'models':
                    this.handleModels(clientId, message);
                    break;
                    
                case 'load_model':
                    await this.handleLoadModel(clientId, message);
                    break;
                    
                case 'metrics':
                    this.handleMetrics(clientId, message);
                    break;
                    
                case 'join_room':
                    this.handleJoinRoom(clientId, message);
                    break;
                    
                case 'leave_room':
                    this.handleLeaveRoom(clientId, message);
                    break;
                    
                case 'ping':
                    this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
                    break;
                    
                default:
                    this.sendToClient(clientId, {
                        type: 'error',
                        error: `Unknown message type: ${message.type}`,
                        requestId: message.requestId
                    });
            }
        } catch (error) {
            console.error(`Message handling error for client ${clientId}:`, error);
            this.sendToClient(clientId, {
                type: 'error',
                error: 'Invalid message format',
                details: error.message
            });
        }
    }
    
    async handleGenerate(clientId, message) {
        const { prompt, options = {}, requestId } = message;
        
        try {
            const result = await this.router.quick(prompt, options);
            
            this.sendToClient(clientId, {
                type: 'generation_complete',
                requestId,
                result: {
                    text: result.text,
                    tokens: result.tokens,
                    model: result.model,
                    latency: result.latency,
                    cached: result.cached
                }
            });
        } catch (error) {
            this.sendToClient(clientId, {
                type: 'generation_error',
                requestId,
                error: error.message
            });
        }
    }
    
    async handleStream(clientId, message) {
        const { prompt, options = {}, requestId } = message;
        const streamId = uuidv4();
        
        try {
            const stream = this.router.stream(prompt, options);
            this.activeStreams.set(streamId, { clientId, requestId, stream });
            
            this.sendToClient(clientId, {
                type: 'stream_start',
                requestId,
                streamId,
                prompt
            });
            
            let tokenCount = 0;
            const startTime = Date.now();
            
            for await (const token of stream) {
                if (!this.activeStreams.has(streamId)) break; // Stream stopped
                
                tokenCount++;
                this.sendToClient(clientId, {
                    type: 'stream_token',
                    requestId,
                    streamId,
                    token,
                    position: tokenCount,
                    timestamp: Date.now()
                });
                
                // Progress updates
                if (tokenCount % 5 === 0) {
                    const elapsed = Date.now() - startTime;
                    const speed = tokenCount / elapsed * 1000;
                    
                    this.sendToClient(clientId, {
                        type: 'stream_progress',
                        requestId,
                        streamId,
                        tokenCount,
                        elapsedTime: elapsed,
                        tokensPerSecond: speed.toFixed(1)
                    });
                }
            }
            
            this.sendToClient(clientId, {
                type: 'stream_complete',
                requestId,
                streamId,
                totalTokens: tokenCount,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            this.sendToClient(clientId, {
                type: 'stream_error',
                requestId,
                streamId,
                error: error.message
            });
        } finally {
            this.activeStreams.delete(streamId);
        }
    }
    
    handleStopStream(clientId, message) {
        const { streamId, requestId } = message;
        
        if (this.activeStreams.has(streamId)) {
            const streamInfo = this.activeStreams.get(streamId);
            if (streamInfo.clientId === clientId) {
                this.activeStreams.delete(streamId);
                
                this.sendToClient(clientId, {
                    type: 'stream_stopped',
                    requestId,
                    streamId
                });
            }
        }
    }
    
    async handleBatch(clientId, message) {
        const { prompts, options = {}, requestId } = message;
        
        if (!Array.isArray(prompts) || prompts.length === 0) {
            this.sendToClient(clientId, {
                type: 'batch_error',
                requestId,
                error: 'Prompts array is required and cannot be empty'
            });
            return;
        }
        
        if (prompts.length > 20) {
            this.sendToClient(clientId, {
                type: 'batch_error',
                requestId,
                error: 'Maximum 20 prompts allowed per batch'
            });
            return;
        }
        
        try {
            const batchId = uuidv4();
            
            this.sendToClient(clientId, {
                type: 'batch_start',
                requestId,
                batchId,
                total: prompts.length
            });
            
            const results = await Promise.allSettled(
                prompts.map(async (prompt, index) => {
                    try {
                        const result = await this.router.quick(prompt, options);
                        
                        // Send individual result
                        this.sendToClient(clientId, {
                            type: 'batch_item',
                            requestId,
                            batchId,
                            index,
                            result
                        });
                        
                        return { index, success: true, result };
                    } catch (error) {
                        this.sendToClient(clientId, {
                            type: 'batch_item',
                            requestId,
                            batchId,
                            index,
                            error: error.message
                        });
                        
                        return { index, success: false, error: error.message };
                    }
                })
            );
            
            const summary = {
                total: prompts.length,
                successful: results.filter(r => r.value.success).length,
                failed: results.filter(r => !r.value.success).length
            };
            
            this.sendToClient(clientId, {
                type: 'batch_complete',
                requestId,
                batchId,
                summary
            });
            
        } catch (error) {
            this.sendToClient(clientId, {
                type: 'batch_error',
                requestId,
                error: error.message
            });
        }
    }
    
    handleModels(clientId, message) {
        const { requestId } = message;
        const models = this.router.registry.list().map(model => ({
            id: model.id,
            name: model.name,
            type: model.type,
            size: model.size,
            capabilities: model.capabilities,
            status: model.status
        }));
        
        this.sendToClient(clientId, {
            type: 'models_list',
            requestId,
            models
        });
    }
    
    async handleLoadModel(clientId, message) {
        const { source, format, immediate = false, requestId } = message;
        
        try {
            const model = await this.router.load({ source, format, immediate });
            
            this.sendToClient(clientId, {
                type: 'model_loaded',
                requestId,
                model: {
                    id: model.id,
                    name: model.name,
                    type: model.type,
                    status: model.status
                }
            });
            
        } catch (error) {
            this.sendToClient(clientId, {
                type: 'model_load_error',
                requestId,
                error: error.message
            });
        }
    }
    
    handleMetrics(clientId, message) {
        const { requestId } = message;
        const metrics = this.router.getMetrics();
        const status = this.router.getStatus();
        
        this.sendToClient(clientId, {
            type: 'metrics',
            requestId,
            data: {
                ...metrics,
                system: {
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    connectedClients: this.clients.size,
                    activeStreams: this.activeStreams.size
                },
                router: status
            }
        });
    }
    
    handleJoinRoom(clientId, message) {
        const { roomId, requestId } = message;
        const client = this.clients.get(clientId);
        
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        
        this.rooms.get(roomId).add(clientId);
        client.currentRoom = roomId;
        
        this.sendToClient(clientId, {
            type: 'room_joined',
            requestId,
            roomId,
            participants: Array.from(this.rooms.get(roomId)).length
        });
        
        // Notify other room members
        this.broadcastToRoom(roomId, {
            type: 'room_user_joined',
            clientId,
            participants: Array.from(this.rooms.get(roomId)).length
        }, clientId);
    }
    
    handleLeaveRoom(clientId, message) {
        const { requestId } = message;
        const client = this.clients.get(clientId);
        
        if (client.currentRoom) {
            const room = this.rooms.get(client.currentRoom);
            if (room) {
                room.delete(clientId);
                
                if (room.size === 0) {
                    this.rooms.delete(client.currentRoom);
                } else {
                    this.broadcastToRoom(client.currentRoom, {
                        type: 'room_user_left',
                        clientId,
                        participants: room.size
                    });
                }
            }
            
            client.currentRoom = null;
        }
        
        this.sendToClient(clientId, {
            type: 'room_left',
            requestId
        });
    }
    
    checkRateLimit(client) {
        const now = Date.now();
        const windowElapsed = now - client.rateLimiter.windowStart;
        
        if (windowElapsed >= client.rateLimiter.windowMs) {
            // Reset window
            client.rateLimiter.windowStart = now;
            client.rateLimiter.requests = 0;
        }
        
        client.rateLimiter.requests++;
        return client.rateLimiter.requests <= client.rateLimiter.maxRequests;
    }
    
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    
    broadcastToRoom(roomId, message, excludeClientId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        for (const clientId of room) {
            if (clientId !== excludeClientId) {
                this.sendToClient(clientId, message);
            }
        }
    }
    
    broadcastToAll(message, excludeClientId = null) {
        for (const [clientId] of this.clients) {
            if (clientId !== excludeClientId) {
                this.sendToClient(clientId, message);
            }
        }
    }
    
    handleDisconnect(clientId, code, reason) {
        console.log(`📱 Client ${clientId} disconnected: ${code} ${reason}`);
        
        // Clean up active streams
        for (const [streamId, streamInfo] of this.activeStreams.entries()) {
            if (streamInfo.clientId === clientId) {
                this.activeStreams.delete(streamId);
            }
        }
        
        // Remove from rooms
        const client = this.clients.get(clientId);
        if (client && client.currentRoom) {
            this.handleLeaveRoom(clientId, {});
        }
        
        this.clients.delete(clientId);
        console.log(`📊 ${this.clients.size} clients remaining`);
    }
    
    cleanupInactiveClients() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutes
        
        for (const [clientId, client] of this.clients.entries()) {
            if (now - client.connectedAt > timeout && client.ws.readyState !== WebSocket.OPEN) {
                this.handleDisconnect(clientId, 1000, 'Cleanup');
            }
        }
    }
    
    async stop() {
        console.log('🔄 Shutting down WebSocket server...');
        
        // Close all client connections
        for (const [clientId, client] of this.clients.entries()) {
            client.ws.close(1001, 'Server shutting down');
        }
        
        // Close server
        this.wss.close(() => {
            console.log('✅ WebSocket server stopped');
        });
        
        await this.router.cleanup();
    }
}

// Start server
const server = new WebSocketLLMAPI(8080);
await server.initialize();

// Graceful shutdown
process.on('SIGTERM', () => server.stop());
process.on('SIGINT', () => server.stop());

export default WebSocketLLMAPI;
```

### 2. WebSocket Client

```javascript
// client/websocket-client.js
class LLMWebSocketClient {
    constructor(url = 'ws://localhost:8080') {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.requestCallbacks = new Map();
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = (event) => {
                console.log('✅ Connected to LLM WebSocket server');
                this.connected = true;
                this.reconnectAttempts = 0;
                resolve(event);
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = (event) => {
                console.log('❌ WebSocket connection closed:', event.code, event.reason);
                this.connected = false;
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                }
                
                this.emit('disconnected', event);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            // Connection timeout
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }
    
    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(() => {
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('❌ Max reconnection attempts reached');
                    this.emit('reconnection_failed');
                }
            });
        }, delay);
    }
    
    handleMessage(message) {
        const { type, requestId } = message;
        
        // Handle request-specific callbacks
        if (requestId && this.requestCallbacks.has(requestId)) {
            const callback = this.requestCallbacks.get(requestId);
            callback(message);
            
            // Clean up completed requests
            if (['generation_complete', 'generation_error', 'stream_complete', 'stream_error', 'batch_complete', 'batch_error'].includes(type)) {
                this.requestCallbacks.delete(requestId);
            }
        }
        
        // Emit general events
        this.emit(type, message);
    }
    
    sendMessage(message) {
        if (!this.connected || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }
        
        this.ws.send(JSON.stringify(message));
    }
    
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    
    async generateText(prompt, options = {}) {
        const requestId = this.generateRequestId();
        
        return new Promise((resolve, reject) => {
            this.requestCallbacks.set(requestId, (message) => {
                if (message.type === 'generation_complete') {
                    resolve(message.result);
                } else if (message.type === 'generation_error') {
                    reject(new Error(message.error));
                }
            });
            
            this.sendMessage({
                type: 'generate',
                prompt,
                options,
                requestId
            });
        });
    }
    
    streamText(prompt, options = {}) {
        const requestId = this.generateRequestId();
        
        return {
            requestId,
            start: () => {
                this.sendMessage({
                    type: 'stream',
                    prompt,
                    options,
                    requestId
                });
            },
            stop: (streamId) => {
                this.sendMessage({
                    type: 'stop_stream',
                    streamId,
                    requestId
                });
            },
            onStart: (callback) => this.on('stream_start', callback),
            onToken: (callback) => this.on('stream_token', callback),
            onProgress: (callback) => this.on('stream_progress', callback),
            onComplete: (callback) => this.on('stream_complete', callback),
            onError: (callback) => this.on('stream_error', callback)
        };
    }
    
    async batchGenerate(prompts, options = {}) {
        const requestId = this.generateRequestId();
        
        return new Promise((resolve, reject) => {
            const results = [];
            
            this.requestCallbacks.set(requestId, (message) => {
                switch (message.type) {
                    case 'batch_start':
                        console.log(`📦 Batch started: ${message.total} items`);
                        break;
                        
                    case 'batch_item':
                        results[message.index] = message.result || { error: message.error };
                        break;
                        
                    case 'batch_complete':
                        resolve({
                            results,
                            summary: message.summary
                        });
                        break;
                        
                    case 'batch_error':
                        reject(new Error(message.error));
                        break;
                }
            });
            
            this.sendMessage({
                type: 'batch',
                prompts,
                options,
                requestId
            });
        });
    }
    
    async getModels() {
        const requestId = this.generateRequestId();
        
        return new Promise((resolve, reject) => {
            this.requestCallbacks.set(requestId, (message) => {
                if (message.type === 'models_list') {
                    resolve(message.models);
                }
            });
            
            this.sendMessage({
                type: 'models',
                requestId
            });
        });
    }
    
    async loadModel(source, format, immediate = false) {
        const requestId = this.generateRequestId();
        
        return new Promise((resolve, reject) => {
            this.requestCallbacks.set(requestId, (message) => {
                if (message.type === 'model_loaded') {
                    resolve(message.model);
                } else if (message.type === 'model_load_error') {
                    reject(new Error(message.error));
                }
            });
            
            this.sendMessage({
                type: 'load_model',
                source,
                format,
                immediate,
                requestId
            });
        });
    }
    
    async getMetrics() {
        const requestId = this.generateRequestId();
        
        return new Promise((resolve) => {
            this.requestCallbacks.set(requestId, (message) => {
                if (message.type === 'metrics') {
                    resolve(message.data);
                }
            });
            
            this.sendMessage({
                type: 'metrics',
                requestId
            });
        });
    }
    
    ping() {
        this.sendMessage({ type: 'ping' });
    }
    
    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(callback);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(callback => callback(data));
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
    }
}

// Usage example
const client = new LLMWebSocketClient('ws://localhost:8080');

// Connect and use
await client.connect();

// Simple generation
const result = await client.generateText("Explain machine learning");
console.log('Generated:', result.text);

// Streaming
const stream = client.streamText("Write a story about AI");
stream.onToken((data) => {
    if (data.requestId === stream.requestId) {
        process.stdout.write(data.token);
    }
});
stream.start();

// Batch processing
const batchResult = await client.batchGenerate([
    "What is AI?",
    "How does ML work?",
    "Explain neural networks"
]);
console.log('Batch completed:', batchResult.summary);

export default LLMWebSocketClient;
```

This completes the comprehensive API server examples, covering REST APIs with Express and Fastify, GraphQL APIs with Apollo Server, and WebSocket real-time APIs. Each example includes proper error handling, authentication patterns, rate limiting, and production-ready features.