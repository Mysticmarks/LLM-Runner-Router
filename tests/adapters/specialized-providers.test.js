/**
 * 🧪 Specialized Provider Adapters Test Suite
 * Comprehensive tests for Cohere, Perplexity, DeepSeek, and Novita AI
 */

import { jest } from '@jest/globals';
import CohereAdapter from '../../src/loaders/adapters/CohereAdapter.js';
import PerplexityAdapter from '../../src/loaders/adapters/PerplexityAdapter.js';
import DeepSeekAdapter from '../../src/loaders/adapters/DeepSeekAdapter.js';
import NovitaAdapter from '../../src/loaders/adapters/NovitaAdapter.js';

// Mock global fetch
global.fetch = jest.fn();

describe('Specialized Provider Adapters', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('CohereAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new CohereAdapter({
        apiKey: 'test-cohere-key',
        enableSafetyFiltering: true,
        enableRetrieval: true
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('cohere');
      expect(adapter.baseURL).toBe('https://api.cohere.ai/v1');
      expect(adapter.enableSafetyFiltering).toBe(true);
      expect(adapter.enableRetrieval).toBe(true);
    });

    test('should load Cohere model successfully', async () => {
      const model = await adapter.load('command-r-plus', {
        testConnection: false
      });

      expect(model.id).toBe('cohere:command-r-plus');
      expect(model.provider).toBe('cohere');
      expect(model.metadata.streaming).toBe(true);
      expect(model.metadata.enterprise).toBe(true);
      expect(model.metadata.multilingual).toBe(true);
    });

    test('should build correct request for Command R models', () => {
      const model = {
        modelId: 'command-r',
        metadata: { type: 'command', maxOutput: 4096 }
      };
      
      const request = adapter.buildGenerateRequest('Hello', model, { maxTokens: 1000 });
      
      expect(request).toMatchObject({
        model: 'command-r',
        prompt: 'Hello',
        max_tokens: 1000,
        temperature: 0.7,
        safety_mode: 'STRICT'
      });
    });

    test('should build correct embedding request', () => {
      const model = {
        modelId: 'embed-english-v3.0',
        metadata: { type: 'embedding' }
      };
      
      const request = adapter.buildEmbedRequest(['Hello world'], model, {});
      
      expect(request).toMatchObject({
        texts: ['Hello world'],
        model: 'embed-english-v3.0',
        input_type: 'search_document',
        embedding_types: ['float']
      });
    });

    test('should build correct rerank request', () => {
      const model = {
        modelId: 'rerank-english-v3.0',
        metadata: { type: 'rerank' }
      };
      
      const documents = ['Doc 1', 'Doc 2', 'Doc 3'];
      const request = adapter.buildRerankRequest('Query', documents, model, {});
      
      expect(request).toMatchObject({
        model: 'rerank-english-v3.0',
        query: 'Query',
        documents: documents,
        return_documents: true
      });
    });

    test('should parse generation response correctly', () => {
      const model = { id: 'cohere:command-r' };
      const data = {
        generations: [{
          text: 'Hello response',
          finish_reason: 'COMPLETE'
        }],
        meta: {
          billed_units: {
            input_tokens: 10,
            output_tokens: 5
          }
        }
      };
      
      const result = adapter.parseGenerateResponse(data, model);
      
      expect(result.text).toBe('Hello response');
      expect(result.usage.totalTokens).toBe(15);
      expect(result.finishReason).toBe('complete');
    });

    test('should parse embedding response correctly', () => {
      const model = { id: 'cohere:embed-english-v3.0' };
      const data = {
        embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        meta: {
          billed_units: { input_tokens: 5 }
        }
      };
      
      const result = adapter.parseEmbeddingResponse(data, model);
      
      expect(result.embeddings).toHaveLength(2);
      expect(result.metadata.count).toBe(2);
      expect(result.metadata.dimensions).toBe(3);
    });

    test('should calculate cost correctly', () => {
      const billedUnits = { input_tokens: 1000, output_tokens: 500 };
      const cost = adapter.calculateCost(billedUnits, 'command-r-plus');
      expect(cost).toBeCloseTo(0.003 + 0.0075); // 3.0/1M * 1000 + 15.0/1M * 500
    });
  });

  describe('PerplexityAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new PerplexityAdapter({
        apiKey: 'pplx-test-key',
        enableWebSearch: true,
        enableCitations: true,
        recentness: 'recent'
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('perplexity');
      expect(adapter.baseURL).toBe('https://api.perplexity.ai');
      expect(adapter.enableWebSearch).toBe(true);
      expect(adapter.enableCitations).toBe(true);
      expect(adapter.recentness).toBe('recent');
    });

    test('should load Perplexity model successfully', async () => {
      const model = await adapter.load('llama-3.1-sonar-large-128k-online', {
        testConnection: false
      });

      expect(model.id).toBe('perplexity:llama-3.1-sonar-large-128k-online');
      expect(model.provider).toBe('perplexity');
      expect(model.metadata.streaming).toBe(true);
      expect(model.metadata.web_aware).toBe(true);
      expect(model.metadata.real_time).toBe(true);
    });

    test('should build correct request for Sonar models', () => {
      const model = {
        modelId: 'llama-3.1-sonar-large-128k-online',
        metadata: { webEnabled: true }
      };
      
      const request = adapter.buildPerplexityRequest('Current news about AI', model, {});
      
      expect(request).toMatchObject({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [{ role: 'user', content: 'Current news about AI' }],
        search_recency_filter: 'recent',
        return_citations: true,
        temperature: 0.2
      });
    });

    test('should parse response with citations correctly', () => {
      const model = { 
        id: 'perplexity:llama-3.1-sonar-large-128k-online',
        metadata: { web_aware: true }
      };
      const data = {
        choices: [{
          message: { content: 'AI news response' },
          finish_reason: 'stop'
        }],
        citations: [
          { url: 'https://example.com/news1', title: 'AI News 1' },
          { url: 'https://example.com/news2', title: 'AI News 2' }
        ],
        usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
      };
      
      const result = adapter.parsePerplexityResponse(data, model);
      
      expect(result.text).toBe('AI news response');
      expect(result.metadata.citations).toHaveLength(2);
      expect(result.metadata.webSearched).toBe(true);
      expect(result.usage.totalTokens).toBe(40);
    });

    test('should calculate factual score based on citations', () => {
      const data = {
        citations: [
          { url: 'https://example.com/1' },
          { url: 'https://example.com/2' }
        ],
        web_extra: {
          searched_results: [{
            published_date: new Date().toISOString() // Recent
          }]
        }
      };
      
      const score = adapter.calculateFactualScore(data);
      expect(score).toBeGreaterThan(0.2); // Has citations and recent info
    });
  });

  describe('DeepSeekAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new DeepSeekAdapter({
        apiKey: 'sk-deepseek-test',
        enableCostOptimization: true,
        maxCostPerRequest: 0.01,
        enableChainOfThought: true
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('deepseek');
      expect(adapter.baseURL).toBe('https://api.deepseek.com/v1');
      expect(adapter.enableCostOptimization).toBe(true);
      expect(adapter.maxCostPerRequest).toBe(0.01);
      expect(adapter.enableChainOfThought).toBe(true);
    });

    test('should load DeepSeek model successfully', async () => {
      const model = await adapter.load('deepseek-chat', {
        testConnection: false
      });

      expect(model.id).toBe('deepseek:deepseek-chat');
      expect(model.provider).toBe('deepseek');
      expect(model.metadata.streaming).toBe(true);
      expect(model.metadata.cost_effective).toBe(true);
      expect(model.metadata.reasoning_capable).toBe(true);
    });

    test('should build correct request for reasoning models', () => {
      const model = {
        modelId: 'deepseek-reasoner',
        metadata: { type: 'reasoning' }
      };
      
      const request = adapter.buildDeepSeekRequest('Solve: 2+2=?', model, {});
      
      expect(request).toMatchObject({
        model: 'deepseek-reasoner',
        messages: [
          { role: 'system', content: 'Think step by step and show your reasoning process clearly.' },
          { role: 'user', content: 'Solve: 2+2=?' }
        ],
        reasoning_depth: 'medium',
        step_by_step: false,
        temperature: 0.1
      });
    });

    test('should build correct request for coding models', () => {
      const model = {
        modelId: 'deepseek-coder',
        metadata: { type: 'code' }
      };
      
      adapter.enableCodeExplanation = true;
      const request = adapter.buildDeepSeekRequest('Write a Python function', model, {});
      
      expect(request.messages[0].content).toContain('expert programmer');
      expect(request.messages[0].content).toContain('clear explanations');
      expect(request.code_format).toBe('markdown');
      expect(request.include_explanation).toBe(true);
    });

    test('should estimate request cost correctly', () => {
      const model = { modelId: 'deepseek-chat' };
      const prompt = 'A'.repeat(400); // ~100 tokens
      const cost = adapter.estimateRequestCost(prompt, model, { maxTokens: 500 });
      
      expect(cost).toBeCloseTo(0.000014 + 0.00014); // Very low cost
    });

    test('should optimize tokens for cost efficiency', () => {
      const tokens = adapter.getOptimalMaxTokens(5000, { maxOutput: 4096 });
      expect(tokens).toBe(2048); // Cost-optimized limit
    });

    test('should update cost tracking correctly', () => {
      adapter.costTracker.set('deepseek-chat', {
        totalCost: 0,
        requestCount: 0,
        averageCost: 0
      });
      
      adapter.updateCostTracking('deepseek-chat', 0.001);
      const stats = adapter.getCostStats('deepseek-chat');
      
      expect(stats.totalCost).toBe(0.001);
      expect(stats.requestCount).toBe(1);
      expect(stats.averageCost).toBe(0.001);
    });
  });

  describe('NovitaAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new NovitaAdapter({
        apiKey: 'novita-test-key',
        enableImageGeneration: true,
        enableVideoGeneration: true,
        enableSpeechSynthesis: true,
        defaultImageSize: '1024x1024'
      });
    });

    test('should initialize with correct configuration', () => {
      expect(adapter.provider).toBe('novita');
      expect(adapter.baseURL).toBe('https://api.novita.ai/v3');
      expect(adapter.enableImageGeneration).toBe(true);
      expect(adapter.enableVideoGeneration).toBe(true);
      expect(adapter.enableSpeechSynthesis).toBe(true);
      expect(adapter.defaultImageSize).toBe('1024x1024');
    });

    test('should load Novita model successfully', async () => {
      const model = await adapter.load('llama-3.1-70b-instruct', {
        testConnection: false
      });

      expect(model.id).toBe('novita:llama-3.1-70b-instruct');
      expect(model.provider).toBe('novita');
      expect(model.metadata.multimodal).toBe(true);
      expect(model.metadata.generation_type).toBe('text');
    });

    test('should build correct text request', () => {
      const model = {
        modelId: 'llama-3.1-8b-instruct',
        metadata: { modality: 'text' }
      };
      
      const request = adapter.buildTextRequest('Hello AI', model, {});
      
      expect(request).toMatchObject({
        model: 'llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: 'Hello AI' }],
        temperature: 0.7,
        stream: false
      });
    });

    test('should build correct image request', () => {
      const model = {
        modelId: 'flux-dev',
        metadata: { modality: 'text-to-image' }
      };
      
      const request = adapter.buildImageRequest('A beautiful sunset', model, {
        size: '512x512',
        imageCount: 2
      });
      
      expect(request).toMatchObject({
        model_name: 'flux-dev',
        prompt: 'A beautiful sunset',
        width: 512,
        height: 512,
        image_num: 2
      });
    });

    test('should build correct video request', () => {
      const model = {
        modelId: 'kling-video',
        metadata: { modality: 'image-to-video' }
      };
      
      const request = adapter.buildVideoRequest('Motion prompt', model, {
        imageUrl: 'https://example.com/image.jpg',
        duration: 10
      });
      
      expect(request).toMatchObject({
        model_name: 'kling-video',
        duration: 10,
        image_url: 'https://example.com/image.jpg',
        aspect_ratio: '16:9'
      });
    });

    test('should build correct speech request', () => {
      const model = {
        modelId: 'elevenlabs-tts',
        metadata: { modality: 'text-to-speech' }
      };
      
      const request = adapter.buildSpeechRequest('Hello world', model, {
        voice: 'nova',
        speed: 1.2
      });
      
      expect(request).toMatchObject({
        model: 'elevenlabs-tts',
        input: 'Hello world',
        voice: 'nova',
        speed: 1.2,
        response_format: 'mp3'
      });
    });

    test('should parse image response correctly', () => {
      const model = { id: 'novita:flux-dev' };
      const data = {
        images: [
          { url: 'https://example.com/image1.png', format: 'png' },
          { url: 'https://example.com/image2.png', format: 'png' }
        ],
        seed: 12345,
        steps: 20
      };
      
      const result = adapter.parseImageResponse(data, model);
      
      expect(result.images).toHaveLength(2);
      expect(result.modality).toBe('image');
      expect(result.usage.imageCount).toBe(2);
      expect(result.metadata.seed).toBe(12345);
    });

    test('should parse video response correctly', () => {
      const model = { id: 'novita:kling-video' };
      const data = {
        videos: [
          { url: 'https://example.com/video.mp4', duration: 5, format: 'mp4' }
        ]
      };
      
      const result = adapter.parseVideoResponse(data, model);
      
      expect(result.videos).toHaveLength(1);
      expect(result.modality).toBe('video');
      expect(result.usage.totalDuration).toBe(5);
    });

    test('should parse speech response correctly', () => {
      const model = { id: 'novita:elevenlabs-tts' };
      const data = {
        audio_url: 'https://example.com/speech.mp3',
        format: 'mp3',
        duration: 2.5,
        characters: 100
      };
      
      const result = adapter.parseSpeechResponse(data, model);
      
      expect(result.audio.url).toBe('https://example.com/speech.mp3');
      expect(result.modality).toBe('speech');
      expect(result.usage.characters).toBe(100);
    });

    test('should calculate different cost types correctly', () => {
      // Text cost
      const textUsage = { prompt_tokens: 1000, completion_tokens: 500 };
      const textCost = adapter.calculateCost(textUsage, 'llama-3.1-70b-instruct');
      expect(textCost).toBeCloseTo(0.00059 + 0.000395);

      // Image cost
      const imageCost = adapter.calculateImageCost(3, 'flux-dev');
      expect(imageCost).toBe(0.06); // 3 * 0.02

      // Speech cost
      const speechCost = adapter.calculateSpeechCost(1000, 'elevenlabs-tts');
      expect(speechCost).toBe(0.18); // 1000/1000 * 0.18
    });

    test('should parse image size correctly', () => {
      const [width, height] = adapter.parseImageSize('768x1024');
      expect(width).toBe(768);
      expect(height).toBe(1024);
      
      const [defaultWidth, defaultHeight] = adapter.parseImageSize('invalid');
      expect(defaultWidth).toBe(1024);
      expect(defaultHeight).toBe(1024);
    });
  });

  // Cross-adapter integration tests
  describe('Specialized Provider Integration', () => {
    test('all adapters should implement required methods', () => {
      const adapters = [
        new CohereAdapter({ apiKey: 'test' }),
        new PerplexityAdapter({ apiKey: 'test' }),
        new DeepSeekAdapter({ apiKey: 'test' }),
        new NovitaAdapter({ apiKey: 'test' })
      ];

      adapters.forEach(adapter => {
        expect(typeof adapter.load).toBe('function');
        expect(typeof adapter.complete).toBe('function');
        expect(typeof adapter.getHeaders).toBe('function');
        expect(typeof adapter.listModels).toBe('function');
        expect(typeof adapter.getInfo).toBe('function');
        expect(typeof adapter.unload).toBe('function');
        expect(typeof adapter.dispose).toBe('function');
      });
    });

    test('all adapters should return consistent info structure', () => {
      const adapters = [
        new CohereAdapter({ apiKey: 'test' }),
        new PerplexityAdapter({ apiKey: 'test' }),
        new DeepSeekAdapter({ apiKey: 'test' }),
        new NovitaAdapter({ apiKey: 'test' })
      ];

      adapters.forEach(adapter => {
        const info = adapter.getInfo();
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('version');
        expect(info).toHaveProperty('provider');
        expect(info).toHaveProperty('features');
        expect(info).toHaveProperty('models');
        expect(info).toHaveProperty('status');
      });
    });

    test('adapters should have unique specializations', () => {
      const cohere = new CohereAdapter({ apiKey: 'test' });
      const perplexity = new PerplexityAdapter({ apiKey: 'test' });
      const deepseek = new DeepSeekAdapter({ apiKey: 'test' });
      const novita = new NovitaAdapter({ apiKey: 'test' });

      const cohereInfo = cohere.getInfo();
      const perplexityInfo = perplexity.getInfo();
      const deepseekInfo = deepseek.getInfo();
      const novitaInfo = novita.getInfo();

      expect(cohereInfo.features).toContain('embeddings');
      expect(cohereInfo.features).toContain('reranking');
      
      expect(perplexityInfo.features).toContain('web_search');
      expect(perplexityInfo.features).toContain('real_time_info');
      
      expect(deepseekInfo.features).toContain('cost_optimization');
      expect(deepseekInfo.features).toContain('reasoning');
      
      expect(novitaInfo.features).toContain('image_generation');
      expect(novitaInfo.features).toContain('video_generation');
      expect(novitaInfo.features).toContain('speech_synthesis');
    });
  });
});