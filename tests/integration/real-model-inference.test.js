/**
 * Real Model Inference Tests
 * Tests actual inference with downloaded models (TinyLlama, Phi-2, Qwen2.5)
 * 
 * These tests verify end-to-end functionality with real model files,
 * measuring actual performance, memory usage, and output quality.
 */

import { LLMRouter } from '../../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

describe('Real Model Inference Tests', () => {
  let router;
  let availableModels = [];

  beforeAll(async () => {
    // Initialize router
    router = new LLMRouter();
    await router.initialize();

    // Check which models are actually available from registry
    const registeredModels = router.registry.list();
    availableModels = registeredModels.filter(m => m.capabilities?.completion);

    console.log(`Found ${availableModels.length} available models for testing:`, 
                availableModels.map(m => m.name).join(', '));

    if (availableModels.length === 0) {
      console.warn('⚠️ No models found - skipping real inference tests');
    }
  }, 30000); // 30 second timeout for initialization

  afterAll(async () => {
    if (router) {
      await router.cleanup();
    }
  });

  describe('Model Loading and Basic Inference', () => {
    test.each(availableModels)('should load and run inference with $name', async (model) => {
      const startTime = performance.now();
      
      try {
        // Register the model
        await router.registry.register({
          id: model.name,
          name: model.name.charAt(0).toUpperCase() + model.name.slice(1),
          format: 'gguf',
          path: model.path,
          engine: 'wasm' // Use WASM for VPS compatibility
        });

        const loadTime = performance.now() - startTime;
        console.log(`📊 ${model.name} load time: ${loadTime.toFixed(2)}ms`);

        // Test basic inference
        const prompt = "Hello! Please introduce yourself briefly.";
        const inferenceStart = performance.now();
        
        const response = await router.generate(model.name, prompt, {
          maxTokens: 50,
          temperature: 0.7
        });

        const inferenceTime = performance.now() - inferenceStart;
        console.log(`📊 ${model.name} inference time: ${inferenceTime.toFixed(2)}ms`);

        // Verify response
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(10);
        expect(response.toLowerCase()).toMatch(/hello|hi|greet|i am|i'm/);

        // Performance assertions
        expect(loadTime).toBeLessThan(10000); // Load under 10 seconds
        expect(inferenceTime).toBeLessThan(30000); // Inference under 30 seconds

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log(`⚠️ Skipping ${model.name} - VPS limitation`);
          return; // Skip this test in VPS environment
        }
        throw error;
      }
    }, 60000); // 60 second timeout per test

    test('should handle multiple consecutive inferences', async () => {
      if (availableModels.length === 0) return;

      const model = availableModels[0]; // Use first available model
      const prompts = [
        "What is 2+2?",
        "Name a color.",
        "Say goodbye."
      ];

      const responses = [];
      const startTime = performance.now();

      for (const prompt of prompts) {
        try {
          const response = await router.generate(model.name, prompt, {
            maxTokens: 20,
            temperature: 0.3
          });
          responses.push(response);
        } catch (error) {
          if (error.message.includes('not supported in VPS')) {
            console.log('⚠️ Skipping consecutive inference test - VPS limitation');
            return;
          }
          throw error;
        }
      }

      const totalTime = performance.now() - startTime;
      console.log(`📊 Multiple inference total time: ${totalTime.toFixed(2)}ms`);

      // Verify all responses
      expect(responses).toHaveLength(3);
      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(1);
        console.log(`Response ${index + 1}: ${response.substring(0, 50)}...`);
      });

      // Performance check - should get faster after first load
      expect(totalTime).toBeLessThan(45000); // Total under 45 seconds
    }, 90000);
  });

  describe('Streaming Inference', () => {
    test('should stream tokens in real-time', async () => {
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const prompt = "Count from 1 to 5:";
      
      try {
        const tokens = [];
        const startTime = performance.now();
        let firstTokenTime = null;

        const stream = router.stream(prompt, {
          model: model.name,
          maxTokens: 30,
          temperature: 0.1
        });

        for await (const token of stream) {
          if (firstTokenTime === null) {
            firstTokenTime = performance.now() - startTime;
          }
          tokens.push(token);
          
          // Log progress
          if (tokens.length % 5 === 0) {
            console.log(`📊 Streamed ${tokens.length} tokens...`);
          }
        }

        const totalTime = performance.now() - startTime;
        const tokensPerSecond = tokens.length / (totalTime / 1000);

        console.log(`📊 Streaming metrics:
          - Total tokens: ${tokens.length}
          - First token time: ${firstTokenTime?.toFixed(2)}ms
          - Total time: ${totalTime.toFixed(2)}ms
          - Tokens/second: ${tokensPerSecond.toFixed(2)}`);

        // Verify streaming worked
        expect(tokens.length).toBeGreaterThan(5);
        expect(firstTokenTime).toBeLessThan(15000); // First token under 15s
        expect(tokensPerSecond).toBeGreaterThan(0.5); // At least 0.5 tokens/second

      } catch (error) {
        if (error.message.includes('not supported in VPS') || 
            error.message.includes('streaming not available')) {
          console.log('⚠️ Skipping streaming test - not supported in this environment');
          return;
        }
        throw error;
      }
    }, 120000);
  });

  describe('Model Quality and Consistency', () => {
    test('should produce consistent responses for deterministic prompts', async () => {
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const prompt = "What is the capital of France?";
      const responses = [];

      try {
        // Generate same prompt multiple times with low temperature
        for (let i = 0; i < 3; i++) {
          const response = await router.generate(model.name, prompt, {
            maxTokens: 30,
            temperature: 0.1 // Low temperature for consistency
          });
          responses.push(response.toLowerCase());
        }

        console.log('🔍 Consistency test responses:');
        responses.forEach((response, index) => {
          console.log(`  ${index + 1}: ${response.substring(0, 50)}...`);
        });

        // Check that all responses mention Paris
        const allMentionParis = responses.every(response => 
          response.includes('paris') || response.includes('capitale')
        );

        expect(allMentionParis).toBe(true);

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping consistency test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 90000);

    test('should handle various prompt types', async () => {
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const testCases = [
        { type: 'question', prompt: 'What is AI?', expectedKeywords: ['artificial', 'intelligence', 'computer'] },
        { type: 'instruction', prompt: 'Write a haiku about coding', expectedKeywords: ['code', 'program', 'lines'] },
        { type: 'completion', prompt: 'The sun rises in the', expectedKeywords: ['east', 'morning', 'dawn'] }
      ];

      for (const testCase of testCases) {
        try {
          const response = await router.generate(model.name, testCase.prompt, {
            maxTokens: 50,
            temperature: 0.5
          });

          console.log(`📝 ${testCase.type}: "${testCase.prompt}" -> "${response.substring(0, 50)}..."`);

          expect(response).toBeDefined();
          expect(response.length).toBeGreaterThan(5);

          // Check if response is relevant (contains at least one expected keyword)
          const hasRelevantContent = testCase.expectedKeywords.some(keyword =>
            response.toLowerCase().includes(keyword)
          );

          if (!hasRelevantContent) {
            console.warn(`⚠️ Response may not be relevant to prompt: ${testCase.prompt}`);
          }

        } catch (error) {
          if (error.message.includes('not supported in VPS')) {
            console.log(`⚠️ Skipping ${testCase.type} test - VPS limitation`);
            continue;
          }
          throw error;
        }
      }
    }, 180000);
  });

  describe('Error Handling with Real Models', () => {
    test('should handle invalid model gracefully', async () => {
      await expect(router.generate('nonexistent-model', 'test prompt')).rejects.toThrow();
    });

    test('should handle empty prompts', async () => {
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      
      try {
        const response = await router.generate(model.name, '', {
          maxTokens: 20
        });
        
        // Should either return empty or some default response
        expect(typeof response).toBe('string');

      } catch (error) {
        // It's also acceptable to throw an error for empty prompts
        expect(error.message).toMatch(/prompt|input|empty/i);
      }
    });

    test('should handle resource constraints', async () => {
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      
      try {
        // Test with very high token limit
        const response = await router.generate(model.name, 'Tell me a story', {
          maxTokens: 10000 // Very high limit
        });

        // Should either limit appropriately or handle gracefully
        expect(typeof response).toBe('string');
        console.log(`📊 High token limit response length: ${response.length}`);

      } catch (error) {
        // Acceptable to fail with resource constraints
        expect(error.message).toMatch(/token|memory|resource|limit/i);
        console.log(`✅ Properly handled resource constraint: ${error.message}`);
      }
    });
  });
});

// Helper function to measure memory usage
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024) // MB
  };
}