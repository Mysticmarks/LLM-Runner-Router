/**
 * GraphQL API
 * Provides a GraphQL interface for the LLM Router
 * Supports queries, mutations, and subscriptions
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PubSub } from 'graphql-subscriptions';
import { GraphQLScalarType, Kind } from 'graphql';
import { Logger } from '../utils/Logger.js';

class GraphQLAPI {
  constructor(config = {}) {
    this.logger = new Logger('GraphQLAPI');
    this.config = {
      path: config.path || '/graphql',
      playground: config.playground !== false,
      introspection: config.introspection !== false,
      subscriptions: config.subscriptions !== false,
      maxComplexity: config.maxComplexity || 1000,
      depthLimit: config.depthLimit || 10,
      cors: config.cors || {
        origin: '*',
        credentials: true
      }
    };
    
    this.server = null;
    this.router = null;
    this.pubsub = new PubSub();
    this.subscriptionClients = new Map();
  }

  /**
   * Initialize GraphQL server
   */
  async initialize(httpServer, router) {
    this.logger.info('Initializing GraphQL API');
    
    this.router = router;
    
    // Create schema
    const schema = this.createSchema();
    
    // Create Apollo Server
    this.server = new ApolloServer({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        this.createComplexityPlugin(),
        this.createLoggingPlugin()
      ],
      introspection: this.config.introspection,
      formatError: this.formatError.bind(this)
    });
    
    await this.server.start();
    
    this.logger.info(`GraphQL API initialized at ${this.config.path}`);
    
    return this.server;
  }

  /**
   * Create GraphQL schema
   */
  createSchema() {
    const typeDefs = `
      # Custom scalar for JSON data
      scalar JSON
      scalar DateTime
      
      # Model information
      type Model {
        id: ID!
        name: String!
        format: String!
        loaded: Boolean!
        metadata: JSON
        parameters: ModelParameters
        statistics: ModelStatistics
      }
      
      # Model parameters
      type ModelParameters {
        temperature: Float
        maxTokens: Int
        topP: Float
        topK: Int
        repetitionPenalty: Float
      }
      
      # Model statistics
      type ModelStatistics {
        requestsServed: Int
        averageLatency: Float
        totalTokens: Int
        errorRate: Float
      }
      
      # Inference result
      type InferenceResult {
        id: ID!
        modelId: String!
        prompt: String!
        response: String!
        tokens: Int
        duration: Float
        timestamp: DateTime!
      }
      
      # Streaming token
      type StreamToken {
        token: String!
        index: Int!
        modelId: String!
        timestamp: DateTime!
      }
      
      # Router status
      type RouterStatus {
        status: String!
        modelsLoaded: Int!
        activeRequests: Int!
        uptime: Float!
        memory: MemoryUsage!
      }
      
      # Memory usage
      type MemoryUsage {
        used: Float!
        total: Float!
        percentage: Float!
      }
      
      # Routing strategy
      enum RoutingStrategy {
        QUALITY_FIRST
        COST_OPTIMIZED
        SPEED_PRIORITY
        BALANCED
        RANDOM
        ROUND_ROBIN
      }
      
      # Model format
      enum ModelFormat {
        GGUF
        ONNX
        SAFETENSORS
        HUGGINGFACE
        TFJS
        PYTORCH
        CUSTOM
      }
      
      # Input for loading a model
      input LoadModelInput {
        source: String!
        format: ModelFormat
        id: String
        name: String
        parameters: JSON
      }
      
      # Input for inference
      input InferenceInput {
        prompt: String!
        modelId: String
        temperature: Float
        maxTokens: Int
        topP: Float
        topK: Int
        stream: Boolean
      }
      
      # Input for routing configuration
      input RoutingConfigInput {
        strategy: RoutingStrategy!
        fallbacks: [String!]
        requirements: JSON
      }
      
      # Query operations
      type Query {
        # Get all loaded models
        models: [Model!]!
        
        # Get a specific model
        model(id: ID!): Model
        
        # Get router status
        status: RouterStatus!
        
        # Get routing configuration
        routingConfig: JSON!
        
        # Get inference history
        inferenceHistory(limit: Int): [InferenceResult!]!
        
        # Search models
        searchModels(query: String!, format: ModelFormat): [Model!]!
        
        # Get model recommendations
        recommendModel(prompt: String!, requirements: JSON): Model
      }
      
      # Mutation operations
      type Mutation {
        # Load a new model
        loadModel(input: LoadModelInput!): Model!
        
        # Unload a model
        unloadModel(id: ID!): Boolean!
        
        # Run inference
        inference(input: InferenceInput!): InferenceResult!
        
        # Update routing configuration
        updateRouting(input: RoutingConfigInput!): JSON!
        
        # Clear cache
        clearCache: Boolean!
        
        # Optimize models
        optimizeModels: Boolean!
        
        # Create model ensemble
        createEnsemble(modelIds: [ID!]!, weights: [Float!]): Model!
      }
      
      # Subscription operations
      type Subscription {
        # Subscribe to streaming tokens
        streamTokens(inferenceId: ID!): StreamToken!
        
        # Subscribe to model status changes
        modelStatusChanged: Model!
        
        # Subscribe to router status updates
        statusUpdates: RouterStatus!
        
        # Subscribe to inference completions
        inferenceCompleted: InferenceResult!
      }
    `;
    
    const resolvers = {
      // Custom scalars
      JSON: new GraphQLScalarType({
        name: 'JSON',
        serialize: (value) => value,
        parseValue: (value) => value,
        parseLiteral: (ast) => {
          switch (ast.kind) {
            case Kind.STRING:
              return JSON.parse(ast.value);
            case Kind.OBJECT:
              return ast.value;
            default:
              return null;
          }
        }
      }),
      
      DateTime: new GraphQLScalarType({
        name: 'DateTime',
        serialize: (value) => value instanceof Date ? value.toISOString() : value,
        parseValue: (value) => new Date(value),
        parseLiteral: (ast) => ast.kind === Kind.STRING ? new Date(ast.value) : null
      }),
      
      // Query resolvers
      Query: {
        models: () => this.getModels(),
        model: (_, { id }) => this.getModel(id),
        status: () => this.getStatus(),
        routingConfig: () => this.getRoutingConfig(),
        inferenceHistory: (_, { limit }) => this.getInferenceHistory(limit),
        searchModels: (_, { query, format }) => this.searchModels(query, format),
        recommendModel: (_, { prompt, requirements }) => this.recommendModel(prompt, requirements)
      },
      
      // Mutation resolvers
      Mutation: {
        loadModel: async (_, { input }) => await this.loadModel(input),
        unloadModel: async (_, { id }) => await this.unloadModel(id),
        inference: async (_, { input }) => await this.runInference(input),
        updateRouting: async (_, { input }) => await this.updateRouting(input),
        clearCache: async () => await this.clearCache(),
        optimizeModels: async () => await this.optimizeModels(),
        createEnsemble: async (_, { modelIds, weights }) => await this.createEnsemble(modelIds, weights)
      },
      
      // Subscription resolvers
      Subscription: {
        streamTokens: {
          subscribe: (_, { inferenceId }) => this.subscribeToStream(inferenceId)
        },
        modelStatusChanged: {
          subscribe: () => this.pubsub.asyncIterator(['MODEL_STATUS_CHANGED'])
        },
        statusUpdates: {
          subscribe: () => this.pubsub.asyncIterator(['STATUS_UPDATE'])
        },
        inferenceCompleted: {
          subscribe: () => this.pubsub.asyncIterator(['INFERENCE_COMPLETED'])
        }
      }
    };
    
    return makeExecutableSchema({ typeDefs, resolvers });
  }

  /**
   * Get all models
   */
  getModels() {
    if (!this.router) return [];
    
    const models = this.router.registry.getAll();
    return models.map(model => ({
      id: model.id,
      name: model.name,
      format: model.format,
      loaded: model.loaded || false,
      metadata: model.metadata || {},
      parameters: model.parameters || {},
      statistics: this.getModelStatistics(model.id)
    }));
  }

  /**
   * Get specific model
   */
  getModel(id) {
    if (!this.router) return null;
    
    const model = this.router.registry.get(id);
    if (!model) return null;
    
    return {
      id: model.id,
      name: model.name,
      format: model.format,
      loaded: model.loaded || false,
      metadata: model.metadata || {},
      parameters: model.parameters || {},
      statistics: this.getModelStatistics(id)
    };
  }

  /**
   * Get model statistics
   */
  getModelStatistics(modelId) {
    // In real implementation, would track actual statistics
    return {
      requestsServed: Math.floor(Math.random() * 1000),
      averageLatency: Math.random() * 100,
      totalTokens: Math.floor(Math.random() * 10000),
      errorRate: Math.random() * 0.1
    };
  }

  /**
   * Get router status
   */
  getStatus() {
    if (!this.router) {
      return {
        status: 'offline',
        modelsLoaded: 0,
        activeRequests: 0,
        uptime: 0,
        memory: { used: 0, total: 0, percentage: 0 }
      };
    }
    
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    
    return {
      status: 'online',
      modelsLoaded: this.router.registry.getAll().length,
      activeRequests: 0, // Would track actual requests
      uptime: process.uptime(),
      memory: {
        used: memUsage.heapUsed,
        total: totalMem,
        percentage: (memUsage.heapUsed / totalMem) * 100
      }
    };
  }

  /**
   * Get routing configuration
   */
  getRoutingConfig() {
    if (!this.router) return {};
    
    return {
      strategy: this.router.router?.config?.strategy || 'balanced',
      fallbacks: this.router.router?.config?.fallbacks || [],
      requirements: this.router.router?.config?.requirements || {}
    };
  }

  /**
   * Get inference history
   */
  getInferenceHistory(limit = 10) {
    // In real implementation, would track actual history
    return [];
  }

  /**
   * Search models
   */
  searchModels(query, format) {
    if (!this.router) return [];
    
    const models = this.router.registry.getAll();
    
    return models.filter(model => {
      const matchesQuery = model.name.toLowerCase().includes(query.toLowerCase()) ||
                          model.id.toLowerCase().includes(query.toLowerCase());
      const matchesFormat = !format || model.format === format.toLowerCase();
      
      return matchesQuery && matchesFormat;
    });
  }

  /**
   * Recommend model
   */
  async recommendModel(prompt, requirements) {
    if (!this.router) return null;
    
    const model = await this.router.router.selectModel(prompt, requirements);
    return this.getModel(model?.id);
  }

  /**
   * Load model
   */
  async loadModel(input) {
    if (!this.router) throw new Error('Router not initialized');
    
    const model = await this.router.load({
      source: input.source,
      format: input.format?.toLowerCase(),
      id: input.id,
      name: input.name,
      ...input.parameters
    });
    
    // Publish event
    this.pubsub.publish('MODEL_STATUS_CHANGED', {
      modelStatusChanged: this.getModel(model.id)
    });
    
    return this.getModel(model.id);
  }

  /**
   * Unload model
   */
  async unloadModel(id) {
    if (!this.router) throw new Error('Router not initialized');
    
    const success = await this.router.unload(id);
    
    if (success) {
      this.pubsub.publish('MODEL_STATUS_CHANGED', {
        modelStatusChanged: { id, loaded: false }
      });
    }
    
    return success;
  }

  /**
   * Run inference
   */
  async runInference(input) {
    if (!this.router) throw new Error('Router not initialized');
    
    const inferenceId = `inference-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      let response;
      
      if (input.stream) {
        // Stream tokens
        response = await this.streamInference(inferenceId, input);
      } else {
        // Regular inference
        const result = await this.router.quick(input.prompt, {
          modelId: input.modelId,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          topP: input.topP,
          topK: input.topK
        });
        
        response = result.text || result;
      }
      
      const result = {
        id: inferenceId,
        modelId: input.modelId || 'auto',
        prompt: input.prompt,
        response,
        tokens: response.length, // Simplified
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
      
      // Publish completion event
      this.pubsub.publish('INFERENCE_COMPLETED', {
        inferenceCompleted: result
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Inference failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream inference
   */
  async streamInference(inferenceId, input) {
    const stream = await this.router.stream(input.prompt, {
      modelId: input.modelId,
      temperature: input.temperature,
      maxTokens: input.maxTokens
    });
    
    let fullResponse = '';
    let tokenIndex = 0;
    
    for await (const token of stream) {
      fullResponse += token;
      
      // Publish token
      this.pubsub.publish(`STREAM_${inferenceId}`, {
        streamTokens: {
          token,
          index: tokenIndex++,
          modelId: input.modelId || 'auto',
          timestamp: new Date()
        }
      });
    }
    
    return fullResponse;
  }

  /**
   * Subscribe to stream
   */
  subscribeToStream(inferenceId) {
    return this.pubsub.asyncIterator([`STREAM_${inferenceId}`]);
  }

  /**
   * Update routing configuration
   */
  async updateRouting(input) {
    if (!this.router) throw new Error('Router not initialized');
    
    this.router.router.config.strategy = input.strategy.toLowerCase();
    
    if (input.fallbacks) {
      this.router.router.config.fallbacks = input.fallbacks;
    }
    
    if (input.requirements) {
      this.router.router.config.requirements = input.requirements;
    }
    
    // Publish status update
    this.pubsub.publish('STATUS_UPDATE', {
      statusUpdates: this.getStatus()
    });
    
    return this.getRoutingConfig();
  }

  /**
   * Clear cache
   */
  async clearCache() {
    if (!this.router) return false;
    
    // Clear router cache if available
    if (this.router.cache) {
      await this.router.cache.clear();
    }
    
    return true;
  }

  /**
   * Optimize models
   */
  async optimizeModels() {
    if (!this.router) return false;
    
    // Trigger optimization (simplified)
    const models = this.router.registry.getAll();
    
    for (const model of models) {
      // In real implementation, would optimize each model
      this.logger.info(`Optimizing model ${model.id}`);
    }
    
    return true;
  }

  /**
   * Create model ensemble
   */
  async createEnsemble(modelIds, weights) {
    if (!this.router) throw new Error('Router not initialized');
    
    // Validate models exist
    for (const id of modelIds) {
      if (!this.router.registry.get(id)) {
        throw new Error(`Model ${id} not found`);
      }
    }
    
    // Create ensemble (simplified)
    const ensembleId = `ensemble-${Date.now()}`;
    const ensemble = {
      id: ensembleId,
      name: `Ensemble of ${modelIds.length} models`,
      format: 'ensemble',
      loaded: true,
      metadata: {
        models: modelIds,
        weights: weights || modelIds.map(() => 1 / modelIds.length)
      }
    };
    
    // Register ensemble
    this.router.registry.register(ensemble);
    
    return this.getModel(ensembleId);
  }

  /**
   * Create complexity plugin
   */
  createComplexityPlugin() {
    return {
      requestDidStart() {
        return {
          willSendResponse(requestContext) {
            // In real implementation, would calculate query complexity
            const complexity = 0;
            if (complexity > this.config.maxComplexity) {
              throw new Error('Query too complex');
            }
          }
        };
      }
    };
  }

  /**
   * Create logging plugin
   */
  createLoggingPlugin() {
    const logger = this.logger;
    
    return {
      requestDidStart() {
        return {
          willSendResponse(requestContext) {
            const { query, variables } = requestContext.request;
            logger.debug('GraphQL query executed', { query, variables });
          }
        };
      }
    };
  }

  /**
   * Format errors
   */
  formatError(error) {
    this.logger.error('GraphQL error:', error);
    
    return {
      message: error.message,
      extensions: {
        code: error.extensions?.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get middleware for Express
   */
  async getMiddleware(app) {
    if (!this.server) {
      throw new Error('GraphQL server not initialized');
    }
    
    return expressMiddleware(this.server, {
      context: async ({ req }) => ({
        user: req.user,
        router: this.router
      })
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('Cleaning up GraphQL API');
    
    if (this.server) {
      await this.server.stop();
    }
    
    this.subscriptionClients.clear();
  }
}
export default GraphQLAPI;
export { GraphQLAPI };
