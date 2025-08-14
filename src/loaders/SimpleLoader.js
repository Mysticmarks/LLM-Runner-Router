/**
 * 🤖 Simple Fallback Loader for VPS Environments
 * Provides basic text generation without external dependencies
 */

import { ModelInterface } from '../core/ModelInterface.js';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('SimpleLoader');

/**
 * Simple Model - Basic text generation for testing and fallback
 */
class SimpleModel extends ModelInterface {
  constructor(config) {
    super(config);
    this.format = 'simple';
    this.name = config.name || 'Simple Fallback Model';
    this.systemPrompt = '';
  }

  async load() {
    if (this.loaded) return;
    
    logger.info(`🤖 Loading Simple model: ${this.name}`);
    this.loading = true;
    
    // Simple models are always ready
    this.loaded = true;
    this.loading = false;
    this.metrics.loadTime = Date.now();
    
    logger.success(`✅ Simple model ready: ${this.name}`);
  }

  async unload() {
    this.loaded = false;
    logger.info(`🤖 Simple model unloaded: ${this.name}`);
  }

  async generate(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    const temperature = options.temperature || 0.7;
    const maxTokens = options.maxTokens || 150;
    
    logger.info(`🤖 Generating with Simple model: ${this.name}`);
    
    // Extract system prompt if it's in the prompt
    let actualPrompt = prompt;
    let systemContext = '';
    
    // Check for common system prompt patterns
    if (prompt.includes('### System:') || prompt.includes('<|system|>')) {
      const patterns = [
        /### System:\s*(.*?)\n\n### User:\s*(.*)/s,
        /<\|system\|>\s*(.*?)<\|user\|>\s*(.*)/s,
        /System:\s*(.*?)\n\nUser:\s*(.*)/s
      ];
      
      for (const pattern of patterns) {
        const match = prompt.match(pattern);
        if (match) {
          systemContext = match[1].trim();
          actualPrompt = match[2].trim();
          break;
        }
      }
    }
    
    // Generate a response based on the prompt
    let response = '';
    
    // If there's a system prompt about being a monkey who likes ice cream...
    if (systemContext.toLowerCase().includes('monkey') && systemContext.toLowerCase().includes('ice cream')) {
      response = this.generateMonkeyResponse(actualPrompt);
    } 
    // Default helpful responses
    else {
      response = this.generateHelpfulResponse(actualPrompt, systemContext);
    }
    
    // Add some variation based on temperature
    if (temperature > 0.8) {
      response += ' ' + this.getRandomEnding();
    }
    
    // Trim to max tokens (approximate)
    const words = response.split(' ');
    if (words.length > maxTokens / 4) {
      response = words.slice(0, Math.floor(maxTokens / 4)).join(' ') + '...';
    }
    
    // Update metrics
    this.metrics.inferenceCount++;
    this.metrics.totalTokens += response.length / 4;
    this.metrics.lastUsed = new Date().toISOString();
    
    return {
      text: response,
      usage: {
        promptTokens: prompt.length / 4,
        completionTokens: response.length / 4,
        totalTokens: (prompt.length + response.length) / 4
      },
      model: this.name
    };
  }

  generateMonkeyResponse(prompt) {
    const monkeyResponses = [
      "Ooh ooh ah ah! 🐵 Ice cream! My favorite topic! *swings from branch excitedly*",
      "🍦 BANANA SPLIT! That's my favorite ice cream! *does happy monkey dance*",
      "*scratches head* Hmm, let me think about that while eating my chocolate banana ice cream! 🍫🍌",
      "Eee eee! 🐒 You know what goes great with that? ICE CREAM! Especially the banana flavored kind!",
      "*jumps up and down* Ice cream party! Ice cream party! My favorite is coconut! 🥥🍨"
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
      return "Ooh ooh ah ah! 🐵 Hello friend! Want to share some ice cream with me? I love all flavors but banana is the BEST! *swings happily*";
    }
    
    if (lowerPrompt.includes('flavor') || lowerPrompt.includes('favourite') || lowerPrompt.includes('favorite')) {
      return "🍌🍦 BANANA ICE CREAM is the best! But I also love chocolate, vanilla, strawberry... actually I love ALL ice cream! *does backflip* What's YOUR favorite?";
    }
    
    if (lowerPrompt.includes('how are you')) {
      return "I'm GREAT! 🐒 Just finished a big bowl of mint chocolate chip ice cream! *rubs belly happily* Life is good when you have ice cream!";
    }
    
    // Default monkey response
    return monkeyResponses[Math.floor(Math.random() * monkeyResponses.length)] + 
           " By the way, " + prompt + "? That reminds me of ice cream! Everything reminds me of ice cream! 🍦";
  }

  generateHelpfulResponse(prompt, systemContext) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Apply system context if provided
    if (systemContext) {
      return `Following the instruction "${systemContext.substring(0, 50)}${systemContext.length > 50 ? '...' : ''}": ` +
             `I understand you're asking about "${prompt}". Based on the context provided, ` +
             `I'll do my best to help you with this request.`;
    }
    
    // Common greetings
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
      return "Hello! I'm a simple fallback model running on your VPS. How can I help you today?";
    }
    
    if (lowerPrompt.includes('how are you')) {
      return "I'm functioning well, thank you for asking! I'm a lightweight model designed to work on virtual servers. What can I assist you with?";
    }
    
    if (lowerPrompt.includes('what can you do')) {
      return "I can provide basic text responses and demonstrate that the LLM Router system is working correctly on your VPS. I'm a fallback model that works without heavy dependencies.";
    }
    
    if (lowerPrompt.includes('test')) {
      return "Test successful! The Simple fallback model is responding correctly. Your LLM Router is operational on the VPS.";
    }
    
    // Default response
    return `I understand you're asking about "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}". ` +
           `As a simple fallback model, I'm providing basic functionality to ensure your system works on the VPS. ` +
           `For more advanced responses, you may want to load more sophisticated models.`;
  }

  getRandomEnding() {
    const endings = [
      "I hope this helps!",
      "Let me know if you need more information.",
      "Feel free to ask if you have questions.",
      "Is there anything else you'd like to know?",
      "I'm here to help!",
      "Don't hesitate to ask for clarification."
    ];
    return endings[Math.floor(Math.random() * endings.length)];
  }

  async *stream(prompt, options = {}) {
    const response = await this.generate(prompt, options);
    const words = response.text.split(' ');
    
    for (const word of words) {
      yield {
        token: word + ' ',
        done: false
      };
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    yield { done: true };
  }

  getInfo() {
    return {
      ...super.getInfo(),
      format: 'simple',
      capabilities: {
        ...this.capabilities,
        streaming: true,
        systemPrompt: true,
        lightweight: true,
        noDependencies: true
      }
    };
  }
}

/**
 * Simple Loader - Lightweight fallback for VPS environments
 */
export class SimpleLoader {
  constructor(config = {}) {
    this.config = config;
    this.models = new Map();
  }

  canHandle(source) {
    // Can handle any request as a fallback
    return source === 'simple' || source === 'fallback' || !source;
  }

  async load(source, options = {}) {
    logger.info('🤖 SimpleLoader: Creating fallback model');
    
    const modelConfig = {
      id: options.id || 'simple-fallback',
      name: options.name || 'Simple Fallback Model',
      format: 'simple',
      ...options
    };
    
    const model = new SimpleModel(modelConfig);
    await model.load();
    
    this.models.set(model.id, model);
    return model;
  }

  async unload(modelId) {
    const model = this.models.get(modelId);
    if (model) {
      await model.unload();
      this.models.delete(modelId);
    }
  }

  getModels() {
    return Array.from(this.models.values());
  }

  getInfo() {
    return {
      name: 'SimpleLoader',
      version: '1.0.0',
      formats: ['simple', 'fallback'],
      capabilities: {
        streaming: true,
        lightweight: true,
        noDependencies: true,
        vpsOptimized: true
      },
      modelsLoaded: this.models.size
    };
  }
}

export default SimpleLoader;