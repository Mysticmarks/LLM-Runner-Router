/**
 * OpenAPI 3.0 Specification and Swagger UI Integration
 * Complete API documentation with validation and client generation
 */

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { validationResult, body, param, query } from 'express-validator';
import { EventEmitter } from 'events';

export class OpenAPIManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      title: options.title || 'LLM Runner Router API',
      description: options.description || 'Universal LLM model orchestration and intelligent routing system',
      version: options.version || '1.2.1',
      serverUrl: options.serverUrl || 'http://localhost:3000',
      contact: {
        name: 'Echo AI Systems',
        email: 'support@echoai.systems',
        url: 'https://github.com/MCERQUA/LLM-Runner-Router'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      swaggerUiOptions: {
        explorer: true,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          ...options.swaggerUiOptions
        }
      },
      ...options
    };

    this.spec = null;
    this.validationRules = new Map();
    this.initialize();
  }

  /**
   * Initialize OpenAPI specification
   */
  initialize() {
    this.spec = this.createOpenAPISpec();
    this.setupValidationRules();
    this.emit('initialized');
  }

  /**
   * Create complete OpenAPI 3.0 specification
   */
  createOpenAPISpec() {
    return {
      openapi: '3.0.3',
      info: {
        title: this.options.title,
        description: this.options.description,
        version: this.options.version,
        contact: this.options.contact,
        license: this.options.license,
        termsOfService: 'https://example.com/terms'
      },
      servers: [
        {
          url: this.options.serverUrl,
          description: 'Development server'
        },
        {
          url: 'https://api.llm-router.com',
          description: 'Production server'
        }
      ],
      security: [
        { BearerAuth: [] },
        { ApiKeyAuth: [] }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from /auth/login'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for automated access'
          }
        },
        schemas: this.createSchemas(),
        responses: this.createResponses(),
        parameters: this.createParameters(),
        examples: this.createExamples(),
        requestBodies: this.createRequestBodies()
      },
      paths: this.createPaths(),
      tags: [
        {
          name: 'Health',
          description: 'System health and status endpoints'
        },
        {
          name: 'Authentication',
          description: 'User authentication and authorization'
        },
        {
          name: 'Models',
          description: 'Model management and operations'
        },
        {
          name: 'Inference',
          description: 'Text generation and inference endpoints'
        },
        {
          name: 'Chat',
          description: 'Conversational AI endpoints'
        },
        {
          name: 'Routing',
          description: 'Intelligent model routing and selection'
        },
        {
          name: 'Streaming',
          description: 'Real-time streaming endpoints'
        },
        {
          name: 'Admin',
          description: 'Administrative functions (admin only)'
        },
        {
          name: 'Metrics',
          description: 'Performance metrics and analytics'
        }
      ]
    };
  }

  /**
   * Create OpenAPI schemas
   */
  createSchemas() {
    return {
      // Authentication schemas
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'user@example.com' },
          password: { type: 'string', format: 'password', example: 'password123' }
        }
      },
      TokenResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'string', example: '24h' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user', 'readonly', 'api'] },
          permissions: { type: 'array', items: { type: 'string' } },
          verified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLogin: { type: 'string', format: 'date-time' }
        }
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          key: { type: 'string', example: 'llmr_abc123...' },
          permissions: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          lastUsed: { type: 'string', format: 'date-time', nullable: true }
        }
      },

      // Model schemas
      Model: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tinyllama-1.1b-chat' },
          name: { type: 'string', example: 'TinyLlama 1.1B Chat' },
          format: { type: 'string', enum: ['gguf', 'onnx', 'safetensors', 'huggingface', 'simple'] },
          source: { type: 'string', example: '/models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf' },
          loaded: { type: 'boolean' },
          loadTime: { type: 'integer', description: 'Load time in milliseconds' },
          memoryUsage: { type: 'integer', description: 'Memory usage in bytes' },
          parameters: { type: 'object', additionalProperties: true },
          capabilities: { type: 'array', items: { type: 'string' } },
          version: { type: 'string', example: '1.0.0' }
        }
      },
      LoadModelRequest: {
        type: 'object',
        required: ['source'],
        properties: {
          source: { type: 'string', description: 'Model path or URL' },
          format: { type: 'string', enum: ['gguf', 'onnx', 'safetensors', 'huggingface', 'auto'], default: 'auto' },
          id: { type: 'string', description: 'Custom model ID' },
          name: { type: 'string', description: 'Human-readable model name' },
          parameters: { type: 'object', additionalProperties: true }
        }
      },

      // Inference schemas
      InferenceRequest: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', example: 'Explain quantum computing in simple terms.' },
          model: { type: 'string', description: 'Model ID to use', example: 'tinyllama-1.1b-chat' },
          maxTokens: { type: 'integer', minimum: 1, maximum: 4096, default: 100 },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          topP: { type: 'number', minimum: 0, maximum: 1, default: 0.9 },
          topK: { type: 'integer', minimum: 1, default: 40 },
          frequencyPenalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
          presencePenalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
          stopSequences: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          stream: { type: 'boolean', default: false },
          seed: { type: 'integer', description: 'Random seed for reproducible outputs' }
        }
      },
      InferenceResponse: {
        type: 'object',
        properties: {
          text: { type: 'string', example: 'Quantum computing is a revolutionary technology...' },
          model: { type: 'string', example: 'tinyllama-1.1b-chat' },
          usage: {
            type: 'object',
            properties: {
              promptTokens: { type: 'integer' },
              completionTokens: { type: 'integer' },
              totalTokens: { type: 'integer' }
            }
          },
          metadata: { type: 'object', additionalProperties: true }
        }
      },

      // Chat schemas
      ChatMessage: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['system', 'user', 'assistant'], example: 'user' },
          content: { type: 'string', example: 'Hello! How are you today?' },
          name: { type: 'string', description: 'Optional message author name' },
          metadata: { type: 'object', additionalProperties: true }
        }
      },
      ChatRequest: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            items: { $ref: '#/components/schemas/ChatMessage' },
            minItems: 1,
            maxItems: 100
          },
          model: { type: 'string', description: 'Model ID to use' },
          maxTokens: { type: 'integer', minimum: 1, maximum: 4096, default: 500 },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          stream: { type: 'boolean', default: false }
        }
      },
      ChatResponse: {
        type: 'object',
        properties: {
          response: { type: 'string' },
          model: { type: 'string' },
          usage: {
            type: 'object',
            properties: {
              promptTokens: { type: 'integer' },
              completionTokens: { type: 'integer' },
              totalTokens: { type: 'integer' }
            }
          }
        }
      },

      // Routing schemas
      RouteRequest: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          requirements: {
            type: 'object',
            properties: {
              maxLatency: { type: 'integer', description: 'Maximum acceptable latency in ms' },
              minQuality: { type: 'number', description: 'Minimum quality score (0-1)' },
              maxCost: { type: 'number', description: 'Maximum cost per token' },
              capabilities: { type: 'array', items: { type: 'string' } }
            }
          },
          strategy: {
            type: 'string',
            enum: ['balanced', 'quality-first', 'cost-optimized', 'speed-priority', 'smart'],
            default: 'balanced'
          }
        }
      },
      RouteResponse: {
        type: 'object',
        properties: {
          selectedModel: { type: 'string' },
          strategy: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          alternatives: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' }
        }
      },

      // Health schemas
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
          timestamp: { type: 'string', format: 'date-time' },
          version: { type: 'string' },
          uptime: { type: 'integer', description: 'Uptime in seconds' },
          modelsLoaded: { type: 'integer' },
          engine: { type: 'string' },
          checks: {
            type: 'object',
            properties: {
              database: { type: 'string', enum: ['healthy', 'unhealthy'] },
              redis: { type: 'string', enum: ['healthy', 'unhealthy', 'not_configured'] },
              models: { type: 'string', enum: ['healthy', 'unhealthy'] }
            }
          }
        }
      },

      // Metrics schemas
      MetricsResponse: {
        type: 'object',
        properties: {
          system: {
            type: 'object',
            properties: {
              cpuUsage: { type: 'number' },
              memoryUsage: { type: 'integer' },
              diskUsage: { type: 'number' },
              uptime: { type: 'integer' }
            }
          },
          api: {
            type: 'object',
            properties: {
              totalRequests: { type: 'integer' },
              requestsPerSecond: { type: 'number' },
              averageLatency: { type: 'number' },
              errorRate: { type: 'number' }
            }
          },
          models: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                requests: { type: 'integer' },
                averageLatency: { type: 'number' },
                errorRate: { type: 'number' },
                tokensGenerated: { type: 'integer' }
              }
            }
          }
        }
      },

      // Error schemas
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Bad Request' },
          message: { type: 'string', example: 'Invalid request parameters' },
          code: { type: 'string', example: 'INVALID_PARAMETERS' },
          details: { type: 'object', additionalProperties: true },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string', format: 'uuid' }
        }
      },

      // Rate limiting schemas
      RateLimitError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Rate limit exceeded' },
          message: { type: 'string' },
          retryAfter: { type: 'integer', description: 'Seconds until retry allowed' },
          tier: { type: 'string', example: 'free' },
          limit: { type: 'integer' },
          remaining: { type: 'integer' },
          resetTime: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  /**
   * Create OpenAPI responses
   */
  createResponses() {
    return {
      Success: {
        description: 'Operation successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string' },
                data: { type: 'object' }
              }
            }
          }
        }
      },
      BadRequest: {
        description: 'Bad request - invalid parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized - authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden - insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      RateLimit: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': {
            schema: { type: 'integer' },
            description: 'Request limit per window'
          },
          'X-RateLimit-Remaining': {
            schema: { type: 'integer' },
            description: 'Remaining requests in window'
          },
          'X-RateLimit-Reset': {
            schema: { type: 'string', format: 'date-time' },
            description: 'Window reset time'
          }
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RateLimitError' }
          }
        }
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    };
  }

  /**
   * Create OpenAPI parameters
   */
  createParameters() {
    return {
      ModelId: {
        name: 'modelId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Unique model identifier'
      },
      UserId: {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Unique user identifier'
      },
      ApiKeyId: {
        name: 'apiKeyId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Unique API key identifier'
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        description: 'Number of items to return'
      },
      Offset: {
        name: 'offset',
        in: 'query',
        schema: { type: 'integer', minimum: 0, default: 0 },
        description: 'Number of items to skip'
      },
      Filter: {
        name: 'filter',
        in: 'query',
        schema: { type: 'string' },
        description: 'Filter criteria'
      }
    };
  }

  /**
   * Create OpenAPI examples
   */
  createExamples() {
    return {
      SimpleInference: {
        summary: 'Simple text generation',
        value: {
          prompt: 'Write a haiku about programming',
          maxTokens: 50,
          temperature: 0.8
        }
      },
      CodeGeneration: {
        summary: 'Code generation request',
        value: {
          prompt: 'Write a Python function to calculate fibonacci numbers',
          maxTokens: 200,
          temperature: 0.2
        }
      },
      ChatConversation: {
        summary: 'Chat conversation',
        value: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Explain machine learning in simple terms.' }
          ],
          maxTokens: 300,
          temperature: 0.7
        }
      }
    };
  }

  /**
   * Create OpenAPI request bodies
   */
  createRequestBodies() {
    return {
      InferenceRequest: {
        description: 'Text inference request',
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/InferenceRequest' },
            examples: {
              simple: { $ref: '#/components/examples/SimpleInference' },
              code: { $ref: '#/components/examples/CodeGeneration' }
            }
          }
        }
      },
      ChatRequest: {
        description: 'Chat conversation request',
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChatRequest' },
            examples: {
              conversation: { $ref: '#/components/examples/ChatConversation' }
            }
          }
        }
      }
    };
  }

  /**
   * Create API paths
   */
  createPaths() {
    return {
      // Health endpoints
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'System health check',
          description: 'Get the current health status of the system',
          responses: {
            '200': {
              description: 'Health status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' }
                }
              }
            }
          }
        }
      },

      // Authentication endpoints
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'User login',
          description: 'Authenticate user and return JWT tokens',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TokenResponse' }
                }
              }
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimit' }
          }
        }
      },

      '/api/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token',
          description: 'Get new access token using refresh token',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refreshToken'],
                  properties: {
                    refreshToken: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Token refreshed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TokenResponse' }
                }
              }
            },
            '401': { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },

      '/api/auth/apikeys': {
        get: {
          tags: ['Authentication'],
          summary: 'List API keys',
          description: 'Get all API keys for the authenticated user',
          responses: {
            '200': {
              description: 'API keys list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      apiKeys: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ApiKey' }
                      }
                    }
                  }
                }
              }
            },
            '401': { $ref: '#/components/responses/Unauthorized' }
          }
        },
        post: {
          tags: ['Authentication'],
          summary: 'Create API key',
          description: 'Generate a new API key',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'My API Key' },
                    permissions: { type: 'array', items: { type: 'string' } },
                    expiresAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'API key created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiKey' }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },

      // Model endpoints
      '/api/models': {
        get: {
          tags: ['Models'],
          summary: 'List models',
          description: 'Get all available models',
          parameters: [
            { $ref: '#/components/parameters/Limit' },
            { $ref: '#/components/parameters/Offset' },
            { $ref: '#/components/parameters/Filter' }
          ],
          responses: {
            '200': {
              description: 'Models list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Model' }
                      },
                      total: { type: 'integer' },
                      limit: { type: 'integer' },
                      offset: { type: 'integer' }
                    }
                  }
                }
              }
            },
            '401': { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },

      '/api/models/load': {
        post: {
          tags: ['Models'],
          summary: 'Load model',
          description: 'Load a new model into the system',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoadModelRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Model loaded successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      model: { $ref: '#/components/schemas/Model' }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' }
          }
        }
      },

      '/api/models/{modelId}': {
        get: {
          tags: ['Models'],
          summary: 'Get model details',
          description: 'Get detailed information about a specific model',
          parameters: [
            { $ref: '#/components/parameters/ModelId' }
          ],
          responses: {
            '200': {
              description: 'Model details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Model' }
                }
              }
            },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        },
        delete: {
          tags: ['Models'],
          summary: 'Unload model',
          description: 'Unload a model from the system',
          parameters: [
            { $ref: '#/components/parameters/ModelId' }
          ],
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      },

      // Inference endpoints
      '/api/inference': {
        post: {
          tags: ['Inference'],
          summary: 'Text generation',
          description: 'Generate text completion for a given prompt',
          requestBody: { $ref: '#/components/requestBodies/InferenceRequest' },
          responses: {
            '200': {
              description: 'Text generated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/InferenceResponse' }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimit' },
            '500': { $ref: '#/components/responses/InternalError' }
          }
        }
      },

      '/api/chat': {
        post: {
          tags: ['Chat'],
          summary: 'Chat completion',
          description: 'Generate chat response for conversation',
          requestBody: { $ref: '#/components/requestBodies/ChatRequest' },
          responses: {
            '200': {
              description: 'Chat response generated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ChatResponse' }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimit' }
          }
        }
      },

      // Routing endpoints
      '/api/route': {
        post: {
          tags: ['Routing'],
          summary: 'Model routing',
          description: 'Select optimal model for given requirements',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RouteRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Model selected',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/RouteResponse' }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' }
          }
        }
      },

      // Metrics endpoints
      '/api/metrics': {
        get: {
          tags: ['Metrics'],
          summary: 'System metrics',
          description: 'Get comprehensive system performance metrics',
          responses: {
            '200': {
              description: 'System metrics',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/MetricsResponse' }
                }
              }
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' }
          }
        }
      }
    };
  }

  /**
   * Setup validation rules for endpoints
   */
  setupValidationRules() {
    // Authentication validation
    this.validationRules.set('POST /api/auth/login', [
      body('username').isLength({ min: 3 }).escape(),
      body('password').isLength({ min: 6 })
    ]);

    // Model validation
    this.validationRules.set('POST /api/models/load', [
      body('source').notEmpty().isString(),
      body('format').optional().isIn(['gguf', 'onnx', 'safetensors', 'huggingface', 'auto']),
      body('id').optional().isString(),
      body('name').optional().isString()
    ]);

    // Inference validation
    this.validationRules.set('POST /api/inference', [
      body('prompt').isLength({ min: 1, max: 10000 }),
      body('model').optional().isString(),
      body('maxTokens').optional().isInt({ min: 1, max: 4096 }),
      body('temperature').optional().isFloat({ min: 0, max: 2 }),
      body('topP').optional().isFloat({ min: 0, max: 1 }),
      body('topK').optional().isInt({ min: 1 }),
      body('stream').optional().isBoolean()
    ]);

    // Chat validation
    this.validationRules.set('POST /api/chat', [
      body('messages').isArray({ min: 1, max: 100 }),
      body('messages.*.role').isIn(['system', 'user', 'assistant']),
      body('messages.*.content').isLength({ min: 1, max: 5000 }),
      body('model').optional().isString(),
      body('maxTokens').optional().isInt({ min: 1, max: 4096 }),
      body('temperature').optional().isFloat({ min: 0, max: 2 }),
      body('stream').optional().isBoolean()
    ]);

    // Routing validation
    this.validationRules.set('POST /api/route', [
      body('prompt').isLength({ min: 1, max: 10000 }),
      body('strategy').optional().isIn(['balanced', 'quality-first', 'cost-optimized', 'speed-priority', 'smart']),
      body('requirements.maxLatency').optional().isInt({ min: 1 }),
      body('requirements.minQuality').optional().isFloat({ min: 0, max: 1 }),
      body('requirements.maxCost').optional().isFloat({ min: 0 })
    ]);

    // Parameter validation
    this.validationRules.set('GET /api/models', [
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('offset').optional().isInt({ min: 0 }),
      query('filter').optional().isString()
    ]);
  }

  /**
   * Get validation rules for endpoint
   */
  getValidationRules(method, path) {
    const key = `${method.toUpperCase()} ${path}`;
    return this.validationRules.get(key) || [];
  }

  /**
   * Create validation middleware
   */
  createValidationMiddleware(method, path) {
    const rules = this.getValidationRules(method, path);
    
    return [
      ...rules,
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Invalid request parameters',
            details: errors.array(),
            timestamp: new Date().toISOString()
          });
        }
        next();
      }
    ];
  }

  /**
   * Generate Swagger JSDoc specification
   */
  generateSwaggerSpec() {
    const options = {
      definition: this.spec,
      apis: [] // We define everything programmatically
    };

    return swaggerJSDoc(options);
  }

  /**
   * Create Swagger UI middleware
   */
  createSwaggerMiddleware() {
    const swaggerSpec = this.generateSwaggerSpec();
    
    return swaggerUi.setup(swaggerSpec, {
      ...this.options.swaggerUiOptions,
      customCss: this.getCustomCSS(),
      customJs: this.getCustomJS()
    });
  }

  /**
   * Get Swagger UI route handler
   */
  getSwaggerUIHandler() {
    return swaggerUi.serve;
  }

  /**
   * Get OpenAPI JSON specification
   */
  getSpecJSON() {
    return this.generateSwaggerSpec();
  }

  /**
   * Custom CSS for Swagger UI
   */
  getCustomCSS() {
    return `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .scheme-container { background: #f8f9fa; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .btn.authorize { background-color: #28a745; border-color: #28a745; }
      .swagger-ui .btn.authorize:hover { background-color: #218838; border-color: #1e7e34; }
    `;
  }

  /**
   * Custom JavaScript for Swagger UI
   */
  getCustomJS() {
    return `
      // Add custom functionality to Swagger UI
      window.onload = function() {
        // Auto-expand operations
        if (window.ui) {
          window.ui.presets.standalone.plugins.forEach(plugin => {
            if (plugin.name === 'StandaloneLayout') {
              plugin.expand = 'list';
            }
          });
        }
      };
    `;
  }

  /**
   * Validate request against OpenAPI schema
   */
  validateRequest(req, operationId) {
    // Implementation would use a library like ajv or openapi-request-validator
    // For now, return true
    return { valid: true, errors: [] };
  }

  /**
   * Generate API client code
   */
  generateClientCode(language = 'javascript') {
    const spec = this.generateSwaggerSpec();
    
    // This would integrate with openapi-generator or similar
    // For now, return basic examples
    const examples = {
      javascript: `
// JavaScript/Node.js Client Example
const axios = require('axios');

class LLMRouterClient {
  constructor(baseURL = 'http://localhost:3000', apiKey = null) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey })
      }
    });
  }

  async inference(prompt, options = {}) {
    const response = await this.client.post('/api/inference', {
      prompt,
      ...options
    });
    return response.data;
  }

  async chat(messages, options = {}) {
    const response = await this.client.post('/api/chat', {
      messages,
      ...options
    });
    return response.data;
  }

  async listModels() {
    const response = await this.client.get('/api/models');
    return response.data;
  }
}

module.exports = LLMRouterClient;
      `,
      python: `
# Python Client Example
import requests
from typing import List, Dict, Optional

class LLMRouterClient:
    def __init__(self, base_url: str = "http://localhost:3000", api_key: Optional[str] = None):
        self.base_url = base_url
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["X-API-Key"] = api_key

    def inference(self, prompt: str, **kwargs) -> Dict:
        response = requests.post(
            f"{self.base_url}/api/inference",
            json={"prompt": prompt, **kwargs},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def chat(self, messages: List[Dict], **kwargs) -> Dict:
        response = requests.post(
            f"{self.base_url}/api/chat",
            json={"messages": messages, **kwargs},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def list_models(self) -> Dict:
        response = requests.get(
            f"{self.base_url}/api/models",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
      `
    };

    return examples[language] || examples.javascript;
  }

  /**
   * Get API documentation as markdown
   */
  generateMarkdownDocs() {
    const spec = this.generateSwaggerSpec();
    
    let markdown = `# ${spec.info.title}\n\n`;
    markdown += `${spec.info.description}\n\n`;
    markdown += `**Version:** ${spec.info.version}\n\n`;
    
    if (spec.info.contact) {
      markdown += `**Contact:** [${spec.info.contact.name}](${spec.info.contact.url})\n\n`;
    }

    markdown += `## Authentication\n\n`;
    markdown += `This API supports multiple authentication methods:\n\n`;
    markdown += `- **Bearer Token**: JWT token in Authorization header\n`;
    markdown += `- **API Key**: X-API-Key header\n\n`;

    markdown += `## Rate Limiting\n\n`;
    markdown += `Requests are rate limited based on your tier:\n\n`;
    markdown += `| Tier | Requests/Hour | Requests/Minute |\n`;
    markdown += `|------|---------------|----------------|\n`;
    markdown += `| Free | 100 | 10 |\n`;
    markdown += `| Basic | 1,000 | 50 |\n`;
    markdown += `| Premium | 10,000 | 200 |\n`;
    markdown += `| Enterprise | 100,000 | 2,000 |\n\n`;

    // Add endpoint documentation
    markdown += `## Endpoints\n\n`;
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        markdown += `### ${method.toUpperCase()} ${path}\n\n`;
        markdown += `${operation.description || operation.summary}\n\n`;
        
        if (operation.parameters) {
          markdown += `**Parameters:**\n\n`;
          for (const param of operation.parameters) {
            markdown += `- \`${param.name}\` (${param.in}): ${param.description || ''}\n`;
          }
          markdown += `\n`;
        }
        
        markdown += `**Response:** \`${Object.keys(operation.responses)[0]}\`\n\n`;
      }
    }

    return markdown;
  }
}

export default OpenAPIManager;