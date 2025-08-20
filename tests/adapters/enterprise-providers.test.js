/**
 * 🧪 Enterprise Provider Adapters Test Suite
 * Comprehensive tests for AWS Bedrock, Azure OpenAI, Google Vertex AI, and Mistral AI
 */

import { jest } from '@jest/globals';
import BedrockAdapter from '../../src/loaders/adapters/BedrockAdapter.js';
import AzureOpenAIAdapter from '../../src/loaders/adapters/AzureOpenAIAdapter.js';
import VertexAIAdapter from '../../src/loaders/adapters/VertexAIAdapter.js';
import MistralAdapter from '../../src/loaders/adapters/MistralAdapter.js';

// Mock global fetch
global.fetch = jest.fn();

describe('Enterprise Provider Adapters', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('BedrockAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new BedrockAdapter({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key'
        }
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('bedrock');
      expect(adapter.region).toBe('us-east-1');
      expect(adapter.bedrockClient).toBeDefined();
    });

    test('should load Bedrock model successfully', async () => {
      const model = await adapter.load('anthropic.claude-3-sonnet-20240229-v1:0', {
        testConnection: false
      });

      expect(model.id).toBe('bedrock:anthropic.claude-3-sonnet-20240229-v1:0');
      expect(model.provider).toBe('bedrock');
      expect(model.metadata.streaming).toBe(true);
      expect(model.metadata.enterprise).toBe(true);
    });

    test('should build correct Bedrock request for Anthropic models', () => {
      const model = { 
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        metadata: { maxOutput: 1000 }
      };
      
      const request = adapter.buildBedrockRequest('Hello', model, { maxTokens: 500 });
      
      expect(request.modelId).toBe(model.modelId);
      expect(JSON.parse(request.body)).toMatchObject({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });

    test('should identify correct model family', () => {
      expect(adapter.getModelFamily('anthropic.claude-3-opus-20240229-v1:0')).toBe('anthropic');
      expect(adapter.getModelFamily('meta.llama2-70b-chat-v1')).toBe('meta');
      expect(adapter.getModelFamily('mistral.mixtral-8x7b-instruct-v0:1')).toBe('mistral');
      expect(adapter.getModelFamily('amazon.titan-text-express-v1')).toBe('amazon');
      expect(adapter.getModelFamily('cohere.command-text-v14')).toBe('cohere');
    });

    test('should format Llama prompt correctly', () => {
      const prompt = adapter.formatLlamaPrompt('Hello', { systemPrompt: 'You are helpful' });
      expect(prompt).toBe('<s>[INST] <<SYS>>\nYou are helpful\n<</SYS>>\n\nHello [/INST]');
      
      const simplePrompt = adapter.formatLlamaPrompt('Hello', {});
      expect(simplePrompt).toBe('<s>[INST] Hello [/INST]');
    });

    test('should calculate cost correctly', () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 500 };
      const cost = adapter.calculateCost(usage, 'anthropic.claude-3-sonnet-20240229-v1:0');
      expect(cost).toBeCloseTo(0.015 + 0.0375); // 15/1M * 1000 + 75/1M * 500
    });

    test('should list available models', async () => {
      const models = await adapter.listModels();
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('provider', 'bedrock');
    });
  });

  describe('AzureOpenAIAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new AzureOpenAIAdapter({
        endpoint: 'https://test-resource.openai.azure.com/',
        apiKey: 'test-api-key',
        apiVersion: '2024-02-01'
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('azure-openai');
      expect(adapter.endpoint).toBe('https://test-resource.openai.azure.com/');
      expect(adapter.apiVersion).toBe('2024-02-01');
    });

    test('should validate configuration correctly', () => {
      expect(() => new AzureOpenAIAdapter({})).toThrow('Azure OpenAI endpoint is required');
      expect(() => new AzureOpenAIAdapter({ 
        endpoint: 'https://invalid-endpoint.com' 
      })).toThrow('Invalid Azure OpenAI endpoint format');
    });

    test('should mask endpoint for logging', () => {
      const masked = adapter.maskEndpoint();
      expect(masked).toBe('https://test-resource***.openai.azure.com');
    });

    test('should get deployment name correctly', () => {
      // Test explicit mapping
      adapter.deploymentMap = { 'gpt-4': 'my-gpt4-deployment' };
      expect(adapter.getDeploymentName('gpt-4', {})).toBe('my-gpt4-deployment');
      
      // Test options override
      expect(adapter.getDeploymentName('gpt-4', { deployment: 'custom-deployment' })).toBe('custom-deployment');
      
      // Test default suffix
      expect(adapter.getDeploymentName('gpt-35-turbo', {})).toBe('gpt-35-turbo-deployment');
    });

    test('should build correct Azure endpoints', () => {
      expect(adapter.getEndpoint('my-deployment', 'chat')).toBe(
        'https://test-resource.openai.azure.com/openai/deployments/my-deployment/chat/completions?api-version=2024-02-01'
      );
      
      expect(adapter.getEndpoint('embedding-deployment', 'embedding')).toBe(
        'https://test-resource.openai.azure.com/openai/deployments/embedding-deployment/embeddings?api-version=2024-02-01'
      );
      
      expect(adapter.getEndpoint('dalle-deployment', 'image')).toBe(
        'https://test-resource.openai.azure.com/openai/deployments/dalle-deployment/images/generations?api-version=2024-02-01'
      );
    });

    test('should build correct Azure request', () => {
      const model = { 
        modelId: 'gpt-4',
        deploymentName: 'gpt-4-deployment',
        metadata: { type: 'chat', maxOutput: 1000 }
      };
      
      const request = adapter.buildAzureRequest('Hello', model, { maxTokens: 500 });
      
      expect(request).toMatchObject({
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 500,
        temperature: 0.7
      });
    });

    test('should handle Azure AD authentication', () => {
      const azureADAdapter = new AzureOpenAIAdapter({
        endpoint: 'https://test-resource.openai.azure.com/',
        useAzureAD: true,
        tenantId: 'test-tenant',
        clientId: 'test-client'
      });
      
      const headers = azureADAdapter.getHeaders();
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toMatch(/^Bearer/);
    });

    test('should parse different response types', () => {
      const model = { 
        id: 'azure-openai:gpt-4',
        deploymentName: 'gpt-4-deployment' 
      };

      // Chat response
      const chatData = {
        choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };
      
      const chatResult = adapter.parseChatResponse(chatData, model);
      expect(chatResult.text).toBe('Hello!');
      expect(chatResult.usage.totalTokens).toBe(15);

      // Embedding response
      const embeddingData = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 5, total_tokens: 5 }
      };
      
      const embeddingResult = adapter.parseEmbeddingResponse(embeddingData, model);
      expect(embeddingResult.embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('VertexAIAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new VertexAIAdapter({
        projectId: 'test-project',
        location: 'us-central1',
        keyFilename: '/path/to/service-account.json'
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('vertex-ai');
      expect(adapter.projectId).toBe('test-project');
      expect(adapter.location).toBe('us-central1');
      expect(adapter.vertexClient).toBeDefined();
    });

    test('should validate configuration correctly', () => {
      expect(() => new VertexAIAdapter({})).toThrow('Google Cloud Project ID is required');
      expect(() => new VertexAIAdapter({ 
        projectId: 'test', 
        keyFilename: null, 
        useDefaultCredentials: false 
      })).toThrow('Google Cloud credentials required');
    });

    test('should check streaming support correctly', () => {
      expect(adapter.supportsStreaming({ family: 'gemini' })).toBe(true);
      expect(adapter.supportsStreaming({ family: 'palm' })).toBe(false);
      expect(adapter.supportsStreaming({ family: 'codey' })).toBe(false);
    });

    test('should build correct Gemini request', () => {
      const request = adapter.buildGeminiRequest('Hello', { maxOutputTokens: 1000 }, {});
      
      expect(request).toMatchObject({
        contents: [{\n          role: 'user',\n          parts: [{ text: 'Hello' }]\n        }],\n        generationConfig: {\n          maxOutputTokens: 1000,\n          temperature: 0.7\n        }\n      });\n    });\n\n    test('should build multimodal Gemini request', () => {\n      const images = [{\n        mimeType: 'image/jpeg',\n        data: 'base64-image-data'\n      }];\n      \n      const request = adapter.buildGeminiRequest('Describe this image', { maxOutputTokens: 1000 }, { images });\n      \n      expect(request.contents[0].parts).toHaveLength(2);\n      expect(request.contents[0].parts[0]).toEqual({ text: 'Describe this image' });\n      expect(request.contents[0].parts[1]).toMatchObject({\n        inlineData: {\n          mimeType: 'image/jpeg',\n          data: 'base64-image-data'\n        }\n      });\n    });\n\n    test('should build correct PaLM request', () => {\n      const request = adapter.buildPaLMRequest('Hello', { maxOutputTokens: 1000 }, {});\n      \n      expect(request).toMatchObject({\n        prompt: {\n          text: 'Hello'\n        },\n        maxOutputTokens: 1000,\n        temperature: 0.7\n      });\n    });\n\n    test('should get correct Vertex endpoints', () => {\n      const model = { modelId: 'gemini-1.0-pro' };\n      const endpoint = adapter.getVertexEndpoint(model);\n      \n      expect(endpoint).toBe(\n        'https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/publishers/google/models/gemini-1.0-pro:generateContent'\n      );\n    });\n\n    test('should parse Gemini response correctly', () => {\n      const model = { id: 'vertex-ai:gemini-1.0-pro' };\n      const data = {\n        candidates: [{\n          content: {\n            parts: [{ text: 'Hello response' }]\n          },\n          finishReason: 'STOP',\n          safetyRatings: []\n        }],\n        usageMetadata: {\n          promptTokenCount: 10,\n          candidatesTokenCount: 5,\n          totalTokenCount: 15\n        }\n      };\n      \n      const result = adapter.parseGeminiResponse(data, model);\n      \n      expect(result.text).toBe('Hello response');\n      expect(result.usage.totalTokens).toBe(15);\n      expect(result.finishReason).toBe('stop');\n    });\n\n    test('should get default safety settings', () => {\n      const settings = adapter.getDefaultSafetySettings();\n      \n      expect(settings).toHaveLength(4);\n      expect(settings[0]).toMatchObject({\n        category: 'HARM_CATEGORY_HATE_SPEECH',\n        threshold: 'BLOCK_MEDIUM_AND_ABOVE'\n      });\n    });\n  });\n\n  describe('MistralAdapter', () => {\n    let adapter;\n\n    beforeEach(() => {\n      adapter = new MistralAdapter({\n        apiKey: 'test-mistral-key',\n        safetyLevel: 'medium',\n        dataResidency: 'eu'\n      });\n    });\n\n    test('should initialize with correct configuration', () => {\n      expect(adapter.provider).toBe('mistral');\n      expect(adapter.baseURL).toBe('https://api.mistral.ai/v1');\n      expect(adapter.safetyLevel).toBe('medium');\n      expect(adapter.dataResidency).toBe('eu');\n      expect(adapter.enableGDPR).toBe(true);\n    });\n\n    test('should validate configuration correctly', () => {\n      expect(() => new MistralAdapter({})).toThrow('Mistral AI API key is required');\n      \n      // Test invalid safety level\n      const invalidAdapter = new MistralAdapter({\n        apiKey: 'test-key',\n        safetyLevel: 'invalid'\n      });\n      expect(invalidAdapter.safetyLevel).toBe('medium'); // Should fallback to medium\n    });\n\n    test('should build correct Mistral request for chat', () => {\n      const model = {\n        modelId: 'mistral-large-latest',\n        metadata: { type: 'chat', maxOutput: 1000 }\n      };\n      \n      const request = adapter.buildMistralRequest('Hello', model, { maxTokens: 500 });\n      \n      expect(request).toMatchObject({\n        model: 'mistral-large-latest',\n        messages: [{ role: 'user', content: 'Hello' }],\n        max_tokens: 500,\n        safe_prompt: true\n      });\n    });\n\n    test('should build correct request for embeddings', () => {\n      const model = {\n        modelId: 'mistral-embed',\n        metadata: { type: 'embedding' }\n      };\n      \n      const request = adapter.buildMistralRequest('Test text', model, {});\n      \n      expect(request).toMatchObject({\n        model: 'mistral-embed',\n        input: ['Test text'],\n        encoding_format: 'float'\n      });\n    });\n\n    test('should support function calling', () => {\n      const model = {\n        modelId: 'mistral-large-latest',\n        metadata: { features: ['function_calling'] }\n      };\n      \n      const functions = [{\n        name: 'get_weather',\n        description: 'Get weather for location',\n        parameters: { type: 'object' }\n      }];\n      \n      const request = adapter.buildMistralRequest('Weather in Paris?', model, { functions });\n      \n      expect(request.functions).toEqual(functions);\n      expect(request.function_call).toBe('auto');\n    });\n\n    test('should get correct endpoint for different model types', () => {\n      const chatModel = { metadata: { type: 'chat' } };\n      expect(adapter.getMistralEndpoint(chatModel)).toBe('https://api.mistral.ai/v1/chat/completions');\n      \n      const embeddingModel = { metadata: { type: 'embedding' } };\n      expect(adapter.getMistralEndpoint(embeddingModel)).toBe('https://api.mistral.ai/v1/embeddings');\n    });\n\n    test('should parse chat response correctly', () => {\n      const model = { id: 'mistral:mistral-large-latest' };\n      const data = {\n        choices: [{\n          message: { content: 'Bonjour!' },\n          finish_reason: 'stop'\n        }],\n        usage: {\n          prompt_tokens: 10,\n          completion_tokens: 5,\n          total_tokens: 15\n        }\n      };\n      \n      const result = adapter.parseMistralResponse(data, model);\n      \n      expect(result.text).toBe('Bonjour!');\n      expect(result.usage.totalTokens).toBe(15);\n      expect(result.metadata.safetyLevel).toBe('medium');\n      expect(result.metadata.dataResidency).toBe('eu');\n    });\n\n    test('should parse embedding response correctly', () => {\n      const model = { \n        id: 'mistral:mistral-embed',\n        metadata: { type: 'embedding' }\n      };\n      \n      const data = {\n        data: [\n          { embedding: [0.1, 0.2, 0.3] },\n          { embedding: [0.4, 0.5, 0.6] }\n        ],\n        usage: { prompt_tokens: 5, total_tokens: 5 }\n      };\n      \n      const result = adapter.parseEmbeddingResponse(data, model);\n      \n      expect(result.embeddings).toHaveLength(2);\n      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);\n      expect(result.metadata.count).toBe(2);\n      expect(result.metadata.dimensions).toBe(3);\n    });\n\n    test('should calculate cost correctly', () => {\n      const usage = { prompt_tokens: 1000, completion_tokens: 500 };\n      const cost = adapter.calculateCost(usage, 'mistral-large-latest');\n      expect(cost).toBeCloseTo(0.008 + 0.012); // 8/1M * 1000 + 24/1M * 500\n    });\n\n    test('should handle European compliance features', () => {\n      const headers = adapter.getHeaders();\n      expect(headers).toHaveProperty('Authorization');\n      expect(headers).toHaveProperty('Content-Type', 'application/json');\n      \n      const info = adapter.getInfo();\n      expect(info.gdprCompliant).toBe(true);\n      expect(info.dataResidency).toBe('eu');\n      expect(info.languages).toContain('fr');\n      expect(info.languages).toContain('de');\n    });\n\n    test('should list models correctly', async () => {\n      // Mock successful API response\n      fetch.mockResolvedValueOnce({\n        ok: true,\n        json: () => Promise.resolve({\n          data: [\n            { id: 'mistral-large-latest', created: 1234567890 },\n            { id: 'mistral-small-latest', created: 1234567891 }\n          ]\n        })\n      });\n      \n      const models = await adapter.listModels();\n      \n      expect(models).toHaveLength(2);\n      expect(models[0]).toMatchObject({\n        id: 'mistral-large-latest',\n        provider: 'mistral',\n        created: 1234567890\n      });\n    });\n  });\n\n  // Cross-adapter integration tests\n  describe('Provider Integration', () => {\n    test('all adapters should implement required methods', () => {\n      const adapters = [\n        new BedrockAdapter({ region: 'us-east-1', credentials: {} }),\n        new AzureOpenAIAdapter({ endpoint: 'https://test.openai.azure.com/', apiKey: 'test' }),\n        new VertexAIAdapter({ projectId: 'test', useDefaultCredentials: true }),\n        new MistralAdapter({ apiKey: 'test' })\n      ];\n      \n      adapters.forEach(adapter => {\n        expect(typeof adapter.load).toBe('function');\n        expect(typeof adapter.complete).toBe('function');\n        expect(typeof adapter.getHeaders).toBe('function');\n        expect(typeof adapter.listModels).toBe('function');\n        expect(typeof adapter.getInfo).toBe('function');\n        expect(typeof adapter.unload).toBe('function');\n        expect(typeof adapter.dispose).toBe('function');\n      });\n    });\n\n    test('all adapters should return consistent info structure', () => {\n      const adapters = [\n        new BedrockAdapter({ region: 'us-east-1', credentials: {} }),\n        new AzureOpenAIAdapter({ endpoint: 'https://test.openai.azure.com/', apiKey: 'test' }),\n        new VertexAIAdapter({ projectId: 'test', useDefaultCredentials: true }),\n        new MistralAdapter({ apiKey: 'test' })\n      ];\n      \n      adapters.forEach(adapter => {\n        const info = adapter.getInfo();\n        expect(info).toHaveProperty('name');\n        expect(info).toHaveProperty('version');\n        expect(info).toHaveProperty('provider');\n        expect(info).toHaveProperty('features');\n        expect(info).toHaveProperty('models');\n        expect(info).toHaveProperty('status');\n      });\n    });\n  });\n});"}