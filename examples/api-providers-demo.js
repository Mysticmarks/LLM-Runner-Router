/**
 * 🌐 API Providers Demo
 * Examples of using OpenAI, Anthropic, OpenRouter, and Groq with LLM-Runner-Router
 * Echo AI Systems - Universal AI orchestration
 */

import dotenv from 'dotenv';
import { LLMRouter } from '../src/index.js';
import APILoader from '../src/loaders/APILoader.js';
import OpenAIAdapter from '../src/loaders/adapters/OpenAIAdapter.js';
import AnthropicAdapter from '../src/loaders/adapters/AnthropicAdapter.js';
import OpenRouterAdapter from '../src/loaders/adapters/OpenRouterAdapter.js';
import GroqAdapter from '../src/loaders/adapters/GroqAdapter.js';

// Load environment variables
dotenv.config();

/**
 * Basic API usage example
 */
async function basicAPIExample() {
  console.log('\n📌 Basic API Usage Example\n');
  
  // Create a simple API loader
  const apiLoader = new APILoader({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });
  
  // Load GPT-3.5-turbo
  const model = await apiLoader.load('gpt-3.5-turbo');
  console.log('✅ Loaded model:', model.id);
  
  // Generate text
  const response = await apiLoader.generate('Write a haiku about APIs');
  console.log('\n🎯 Response:', response.text);
  
  // Show costs
  const costs = apiLoader.getCosts();
  console.log('\n💰 Costs:', costs);
}

/**
 * OpenAI specific features
 */
async function openAIExample() {
  console.log('\n🤖 OpenAI Example\n');
  
  const openai = new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  // Load GPT-4
  await openai.load('gpt-4-turbo-preview');
  
  // Use function calling
  const response = await openai.complete('What is the weather in San Francisco?', {
    functions: [{
      name: 'get_weather',
      description: 'Get the current weather in a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City and state' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['location']
      }
    }],
    functionCall: 'auto'
  });
  
  console.log('Response:', response.text);
  if (response.functionCall) {
    console.log('Function call:', response.functionCall);
  }
  
  // Create embeddings
  const embeddings = await openai.createEmbedding('LLM orchestration is powerful');
  console.log('\n📊 Embedding dimensions:', embeddings.embeddings[0].length);
}

/**
 * Anthropic Claude example
 */
async function anthropicExample() {
  console.log('\n🧠 Anthropic Claude Example\n');
  
  const anthropic = new AnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  // Load Claude 3 Haiku (fast and cheap)
  await anthropic.load('claude-3-haiku-20240307');
  
  // Use with system prompt
  const response = await anthropic.complete('Explain quantum computing', {
    system: 'You are a physics professor. Explain concepts simply.',
    maxTokens: 200
  });
  
  console.log('Claude response:', response.text);
  
  // Vision example (if you have an image)
  // const visionResponse = await anthropic.complete('What is in this image?', {
  //   messages: [anthropic.createVisionMessage('Describe this', imageBase64Data)]
  // });
}

/**
 * OpenRouter multi-provider example
 */
async function openRouterExample() {
  console.log('\n🌐 OpenRouter Multi-Provider Example\n');
  
  const openrouter = new OpenRouterAdapter({
    apiKey: process.env.OPENROUTER_API_KEY
  });
  
  // Fetch available models
  const models = await openrouter.fetchAvailableModels();
  console.log(`📚 Found ${models.length} available models`);
  
  // Use auto mode (let OpenRouter choose)
  await openrouter.load('auto');
  
  const response = await openrouter.complete('Write a poem about routers', {
    providers: ['anthropic', 'openai', 'google'], // Preference order
    maxTokens: 100
  });
  
  console.log('Model used:', response.model);
  console.log('Response:', response.text);
  
  // Get cheapest model for requirements
  const cheapest = await openrouter.getCheapestModel({
    minContext: 8000
  });
  console.log('\n💰 Cheapest model with 8k context:', cheapest?.id);
  
  // Get recommendations
  const recommendations = await openrouter.getRecommendations('coding');
  console.log('🎯 Recommended models for coding:', recommendations);
}

/**
 * Groq ultra-fast inference example
 */
async function groqExample() {
  console.log('\n⚡ Groq Ultra-Fast Inference Example\n');
  
  const groq = new GroqAdapter({
    apiKey: process.env.GROQ_API_KEY
  });
  
  // Load Mixtral (MoE model)
  const model = await groq.load('mixtral-8x7b-32768');
  console.log('✅ Loaded:', model.id);
  console.log('⚡ Benchmark speed:', model.metadata.benchmarkSpeed, 'tokens/sec');
  
  // Fast generation
  const startTime = Date.now();
  const response = await groq.complete('List 10 creative uses for a paperclip', {
    maxTokens: 200,
    speedMode: true // Optimize for speed
  });
  
  const elapsed = Date.now() - startTime;
  console.log(`\n⏱️ Generated in ${elapsed}ms`);
  console.log('Response:', response.text);
  
  // Get performance stats
  const stats = groq.getPerformanceStats();
  console.log('\n📊 Performance stats:', stats);
}

/**
 * Streaming example
 */
async function streamingExample() {
  console.log('\n🌊 Streaming Example\n');
  
  const openai = new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  await openai.load('gpt-3.5-turbo');
  
  console.log('Streaming response:');
  const stream = await openai.complete('Write a story about a robot', {
    stream: true,
    maxTokens: 100
  });
  
  for await (const chunk of stream) {
    process.stdout.write(chunk.text);
  }
  console.log('\n\n✅ Stream complete');
}

/**
 * Router with multiple API providers
 */
async function routerExample() {
  console.log('\n🧭 Router with Multiple Providers\n');
  
  // Initialize router
  const router = new LLMRouter({
    strategy: 'cost-optimized',
    providers: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      groq: process.env.GROQ_API_KEY
    }
  });
  
  await router.initialize();
  
  // Register API loaders
  router.registry.registerLoader('api', new APILoader());
  router.registry.registerLoader('openai', new OpenAIAdapter());
  router.registry.registerLoader('anthropic', new AnthropicAdapter());
  router.registry.registerLoader('groq', new GroqAdapter());
  
  // Load multiple models
  await router.load({ type: 'openai', modelId: 'gpt-3.5-turbo' });
  await router.load({ type: 'anthropic', modelId: 'claude-3-haiku-20240307' });
  await router.load({ type: 'groq', modelId: 'mixtral-8x7b-32768' });
  
  // Let router choose best model based on strategy
  const response = await router.complete('Explain the concept of entropy');
  console.log('Router selected model:', response.model);
  console.log('Response:', response.text);
}

/**
 * Cost comparison example
 */
async function costComparisonExample() {
  console.log('\n💰 Cost Comparison Example\n');
  
  const prompt = 'Write a 100-word summary of machine learning';
  const results = [];
  
  // Test OpenAI
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAIAdapter();
    await openai.load('gpt-3.5-turbo');
    const response = await openai.complete(prompt, { maxTokens: 150 });
    const cost = openai.calculateCost(response.usage, 'gpt-3.5-turbo');
    results.push({ provider: 'OpenAI GPT-3.5', ...cost });
  }
  
  // Test Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new AnthropicAdapter();
    await anthropic.load('claude-3-haiku-20240307');
    const response = await anthropic.complete(prompt, { maxTokens: 150 });
    const cost = anthropic.calculateCost(response.usage, 'claude-3-haiku-20240307');
    results.push({ provider: 'Claude 3 Haiku', ...cost });
  }
  
  // Test Groq
  if (process.env.GROQ_API_KEY) {
    const groq = new GroqAdapter();
    await groq.load('mixtral-8x7b-32768');
    const response = await groq.complete(prompt, { maxTokens: 150 });
    const cost = groq.calculateCost(response.usage, 'mixtral-8x7b-32768');
    results.push({ provider: 'Groq Mixtral', ...cost });
  }
  
  // Display comparison
  console.log('Cost comparison for same prompt:');
  console.table(results);
}

/**
 * Main demo runner
 */
async function main() {
  console.log('🚀 LLM-Runner-Router API Providers Demo');
  console.log('========================================\n');
  
  // Check for API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  
  console.log('Available API Keys:');
  console.log(`  OpenAI: ${hasOpenAI ? '✅' : '❌'}`);
  console.log(`  Anthropic: ${hasAnthropic ? '✅' : '❌'}`);
  console.log(`  OpenRouter: ${hasOpenRouter ? '✅' : '❌'}`);
  console.log(`  Groq: ${hasGroq ? '✅' : '❌'}`);
  
  if (!hasOpenAI && !hasAnthropic && !hasOpenRouter && !hasGroq) {
    console.log('\n⚠️ No API keys found!');
    console.log('Please set at least one of the following environment variables:');
    console.log('  OPENAI_API_KEY');
    console.log('  ANTHROPIC_API_KEY');
    console.log('  OPENROUTER_API_KEY');
    console.log('  GROQ_API_KEY');
    return;
  }
  
  try {
    // Run examples based on available keys
    if (hasOpenAI) {
      await basicAPIExample();
      await openAIExample();
      await streamingExample();
    }
    
    if (hasAnthropic) {
      await anthropicExample();
    }
    
    if (hasOpenRouter) {
      await openRouterExample();
    }
    
    if (hasGroq) {
      await groqExample();
    }
    
    // Run comparison if we have multiple providers
    const providerCount = [hasOpenAI, hasAnthropic, hasGroq].filter(Boolean).length;
    if (providerCount >= 2) {
      await costComparisonExample();
    }
    
    // Router example needs at least 2 providers
    if (providerCount >= 2) {
      await routerExample();
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicAPIExample,
  openAIExample,
  anthropicExample,
  openRouterExample,
  groqExample,
  streamingExample,
  routerExample,
  costComparisonExample
};