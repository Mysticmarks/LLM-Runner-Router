# 🤖 Building Resilient Chatbots with Fallback Chains

Complete guide for implementing production-ready chatbots with automatic fallback mechanisms, error recovery, and multi-provider support.

## Table of Contents

1. [Overview](#overview)
2. [Basic Chatbot Implementation](#basic-chatbot-implementation)
3. [Fallback Strategies](#fallback-strategies)
4. [Conversation Management](#conversation-management)
5. [Error Handling & Recovery](#error-handling--recovery)
6. [Advanced Features](#advanced-features)
7. [Production Deployment](#production-deployment)
8. [Real-World Examples](#real-world-examples)

## Overview

Building a resilient chatbot requires handling provider failures, rate limits, and varying response quality. This guide shows how to build production-ready chatbots with automatic fallback chains.

### Key Features

- **Multi-provider fallback**: Automatic switching between providers
- **Conversation persistence**: Maintain context across failures
- **Smart retry logic**: Exponential backoff with jitter
- **Quality assurance**: Response validation and filtering
- **Cost optimization**: Automatic model selection based on complexity

## Basic Chatbot Implementation

### 1. Simple Chatbot

```javascript
import { LLMRouter } from 'llm-runner-router';

class SimpleChatbot {
  constructor() {
    this.router = new LLMRouter({
      providers: ['openai', 'anthropic', 'groq'],
      defaultModel: 'gpt-3.5-turbo'
    });
    
    this.conversations = new Map();
  }
  
  async chat(userId, message) {
    // Get or create conversation
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    
    const history = this.conversations.get(userId);
    
    try {
      // Generate response
      const response = await this.router.generate({
        messages: [
          ...history,
          { role: 'user', content: message }
        ],
        model: 'gpt-3.5-turbo'
      });
      
      // Update conversation history
      history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.text }
      );
      
      // Trim history if too long
      if (history.length > 20) {
        history.splice(0, 2);
      }
      
      return response.text;
    } catch (error) {
      console.error('Chat error:', error);
      return "I'm sorry, I'm having trouble responding right now.";
    }
  }
}
```

### 2. Chatbot with Fallback

```javascript
class ResilientChatbot {
  constructor() {
    this.router = new LLMRouter({
      providers: ['openai', 'anthropic', 'groq', 'openrouter'],
      fallbackChain: [
        'gpt-4',
        'claude-3-opus',
        'gpt-3.5-turbo',
        'claude-3-haiku',
        'groq/mixtral-8x7b'
      ],
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        maxDelay: 5000
      }
    });
    
    this.conversations = new Map();
    this.fallbackCount = 0;
  }
  
  async chat(userId, message, options = {}) {
    const history = this.getHistory(userId);
    
    // Attempt with fallback chain
    let lastError;
    for (const model of this.router.fallbackChain) {
      try {
        const response = await this.attemptChat(
          model,
          message,
          history,
          options
        );
        
        // Success - update history
        this.updateHistory(userId, message, response.text);
        
        // Log fallback usage
        if (this.fallbackCount > 0) {
          console.log(`Succeeded with fallback model: ${model}`);
          this.fallbackCount = 0;
        }
        
        return {
          text: response.text,
          model: response.model,
          fallbackUsed: this.fallbackCount > 0
        };
      } catch (error) {
        lastError = error;
        this.fallbackCount++;
        console.warn(`Model ${model} failed, trying next...`, error);
      }
    }
    
    // All models failed
    return this.handleTotalFailure(lastError, message);
  }
  
  async attemptChat(model, message, history, options) {
    return this.router.generate({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message }
      ],
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 500,
      timeout: 10000 // 10 second timeout per attempt
    });
  }
  
  getHistory(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    return this.conversations.get(userId);
  }
  
  updateHistory(userId, userMessage, assistantMessage) {
    const history = this.getHistory(userId);
    history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );
    
    // Keep last 10 exchanges (20 messages)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }
  
  handleTotalFailure(error, message) {
    console.error('All models failed:', error);
    
    // Return a helpful error message
    const errorResponses = {
      rate_limit: "I'm currently experiencing high demand. Please try again in a moment.",
      timeout: "The response is taking too long. Please try again with a simpler question.",
      invalid_request: "I couldn't process that request. Could you rephrase it?",
      default: "I'm having technical difficulties. Please try again later."
    };
    
    const errorType = this.classifyError(error);
    
    return {
      text: errorResponses[errorType] || errorResponses.default,
      error: true,
      errorType
    };
  }
  
  classifyError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
      return 'rate_limit';
    }
    if (errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('invalid') || errorMessage.includes('format')) {
      return 'invalid_request';
    }
    
    return 'default';
  }
}
```

## Fallback Strategies

### 1. Quality-Based Fallback

```javascript
class QualityFallbackChatbot {
  constructor() {
    this.router = new LLMRouter();
    this.qualityThreshold = 0.7;
    
    // Models ordered by quality
    this.modelTiers = [
      { model: 'gpt-4', quality: 0.95, cost: 0.03 },
      { model: 'claude-3-opus', quality: 0.93, cost: 0.015 },
      { model: 'gpt-3.5-turbo', quality: 0.80, cost: 0.002 },
      { model: 'claude-3-haiku', quality: 0.75, cost: 0.00025 }
    ];
  }
  
  async chat(message, options = {}) {
    const requiredQuality = options.minQuality || this.qualityThreshold;
    
    // Filter models by quality requirement
    const eligibleModels = this.modelTiers.filter(
      tier => tier.quality >= requiredQuality
    );
    
    if (eligibleModels.length === 0) {
      throw new Error(`No models meet quality requirement: ${requiredQuality}`);
    }
    
    // Try models in order
    for (const tier of eligibleModels) {
      try {
        const response = await this.router.generate({
          model: tier.model,
          prompt: message
        });
        
        // Validate response quality
        if (await this.validateQuality(response, requiredQuality)) {
          return {
            ...response,
            qualityScore: tier.quality,
            cost: tier.cost
          };
        }
      } catch (error) {
        console.warn(`Model ${tier.model} failed or quality too low`);
      }
    }
    
    throw new Error('No model produced acceptable quality response');
  }
  
  async validateQuality(response, threshold) {
    // Basic quality checks
    if (!response.text || response.text.length < 10) {
      return false;
    }
    
    // Check for repetition
    const words = response.text.split(' ');
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;
    
    if (uniqueRatio < 0.3) {
      return false; // Too repetitive
    }
    
    // Check for coherence (simple heuristic)
    const sentences = response.text.split(/[.!?]+/);
    if (sentences.length < 1) {
      return false; // No complete sentences
    }
    
    // Could add more sophisticated quality checks here
    // - Grammar checking
    // - Relevance scoring
    // - Fact checking
    
    return true;
  }
}
```

### 2. Cost-Optimized Fallback

```javascript
class CostOptimizedChatbot {
  constructor(monthlyBudget = 100) {
    this.router = new LLMRouter();
    this.monthlyBudget = monthlyBudget;
    this.monthlySpend = 0;
    this.dailySpend = 0;
    this.lastResetDate = new Date().getDate();
  }
  
  async chat(message, context = {}) {
    this.checkBudgetReset();
    
    // Determine complexity
    const complexity = this.assessComplexity(message);
    
    // Select models based on budget remaining
    const models = this.selectModelsByBudget(complexity);
    
    // Try models in cost order
    for (const model of models) {
      try {
        const estimatedCost = this.estimateCost(model, message);
        
        // Check if we can afford this request
        if (this.monthlySpend + estimatedCost > this.monthlyBudget) {
          console.warn(`Budget limit would be exceeded with ${model}`);
          continue;
        }
        
        const response = await this.router.generate({
          model,
          prompt: message,
          maxTokens: this.getMaxTokensForBudget(model)
        });
        
        // Track spending
        const actualCost = response.cost || estimatedCost;
        this.monthlySpend += actualCost;
        this.dailySpend += actualCost;
        
        return {
          ...response,
          budgetRemaining: this.monthlyBudget - this.monthlySpend,
          costSaved: this.calculateSavings(model, complexity)
        };
      } catch (error) {
        console.warn(`Model ${model} failed, trying cheaper option`);
      }
    }
    
    throw new Error('Budget exhausted or all models failed');
  }
  
  assessComplexity(message) {
    const indicators = {
      simple: message.length < 100 && /what|who|when|where/.test(message),
      moderate: message.length < 500,
      complex: message.length >= 500 || /analyze|evaluate|design/.test(message)
    };
    
    if (indicators.simple) return 'simple';
    if (indicators.complex) return 'complex';
    return 'moderate';
  }
  
  selectModelsByBudget(complexity) {
    const budgetPercent = (this.monthlyBudget - this.monthlySpend) / this.monthlyBudget;
    
    if (budgetPercent > 0.5) {
      // Plenty of budget - use best models
      return complexity === 'complex' 
        ? ['gpt-4', 'claude-3-opus', 'gpt-3.5-turbo']
        : ['gpt-3.5-turbo', 'claude-3-haiku'];
    } else if (budgetPercent > 0.2) {
      // Conservative spending
      return ['gpt-3.5-turbo', 'claude-3-haiku', 'groq/mixtral'];
    } else {
      // Budget critical - cheapest only
      return ['claude-3-haiku', 'groq/mixtral'];
    }
  }
  
  estimateCost(model, message) {
    const costs = {
      'gpt-4': 0.03,
      'claude-3-opus': 0.015,
      'gpt-3.5-turbo': 0.002,
      'claude-3-haiku': 0.00025,
      'groq/mixtral': 0.0001
    };
    
    const baseCost = costs[model] || 0.001;
    const tokens = message.length / 4; // Rough estimate
    
    return baseCost * (tokens / 1000);
  }
  
  checkBudgetReset() {
    const today = new Date().getDate();
    
    if (today !== this.lastResetDate) {
      this.dailySpend = 0;
      this.lastResetDate = today;
      
      if (today === 1) {
        this.monthlySpend = 0; // Reset monthly budget
      }
    }
  }
}
```

### 3. Latency-Aware Fallback

```javascript
class LatencyAwareChatbot {
  constructor() {
    this.router = new LLMRouter();
    this.latencyTargets = {
      realtime: 500,   // 500ms for real-time chat
      normal: 2000,    // 2s for normal responses
      batch: 10000     // 10s for batch processing
    };
  }
  
  async chat(message, options = {}) {
    const mode = options.mode || 'normal';
    const timeout = this.latencyTargets[mode];
    const startTime = Date.now();
    
    // Fast models for real-time
    const modelsBySpeed = mode === 'realtime'
      ? ['groq/mixtral', 'claude-3-haiku', 'gpt-3.5-turbo']
      : ['gpt-3.5-turbo', 'gpt-4', 'claude-3-opus'];
    
    for (const model of modelsBySpeed) {
      const elapsed = Date.now() - startTime;
      const remaining = timeout - elapsed;
      
      if (remaining < 100) {
        // Not enough time for another attempt
        break;
      }
      
      try {
        const response = await Promise.race([
          this.router.generate({
            model,
            prompt: message,
            stream: mode === 'realtime' // Stream for real-time
          }),
          this.timeout(remaining)
        ]);
        
        return {
          ...response,
          latency: Date.now() - startTime,
          mode
        };
      } catch (error) {
        if (error.message === 'Timeout') {
          console.warn(`Model ${model} too slow for ${mode} mode`);
        }
      }
    }
    
    throw new Error(`Could not respond within ${timeout}ms`);
  }
  
  timeout(ms) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
  }
}
```

## Conversation Management

### 1. Advanced Context Management

```javascript
class ContextAwareChatbot {
  constructor() {
    this.router = new LLMRouter();
    this.sessions = new Map();
  }
  
  async chat(sessionId, message, metadata = {}) {
    const session = this.getOrCreateSession(sessionId);
    
    // Add metadata to context
    session.metadata = { ...session.metadata, ...metadata };
    
    // Prepare context window
    const context = this.prepareContext(session);
    
    try {
      const response = await this.router.generate({
        messages: context,
        model: this.selectModelForContext(session),
        temperature: this.getDynamicTemperature(session)
      });
      
      // Update session
      session.messages.push(
        { role: 'user', content: message, timestamp: Date.now() },
        { role: 'assistant', content: response.text, timestamp: Date.now() }
      );
      
      // Analyze conversation flow
      session.stats = this.analyzeConversation(session);
      
      return {
        text: response.text,
        sessionStats: session.stats,
        contextSize: context.length
      };
    } catch (error) {
      return this.handleWithFallback(session, message, error);
    }
  }
  
  getOrCreateSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        messages: [],
        metadata: {},
        stats: {},
        created: Date.now()
      });
    }
    return this.sessions.get(sessionId);
  }
  
  prepareContext(session) {
    const messages = [];
    
    // Add system prompt based on conversation stats
    messages.push({
      role: 'system',
      content: this.generateSystemPrompt(session)
    });
    
    // Add conversation history with smart truncation
    const recentMessages = this.smartTruncate(session.messages);
    messages.push(...recentMessages);
    
    // Add relevant metadata as context
    if (session.metadata.userName) {
      messages.push({
        role: 'system',
        content: `User's name is ${session.metadata.userName}`
      });
    }
    
    return messages;
  }
  
  smartTruncate(messages, maxTokens = 2000) {
    // Keep important messages (questions, key info)
    const important = [];
    const recent = [];
    
    // Scan for important messages
    for (const msg of messages) {
      if (this.isImportant(msg)) {
        important.push(msg);
      }
    }
    
    // Add recent messages
    const recentCount = Math.min(10, messages.length);
    recent.push(...messages.slice(-recentCount));
    
    // Combine, deduplicate, and trim
    const combined = [...new Set([...important, ...recent])];
    
    // Estimate tokens and trim if needed
    let totalTokens = 0;
    const result = [];
    
    for (let i = combined.length - 1; i >= 0; i--) {
      const tokens = combined[i].content.length / 4;
      if (totalTokens + tokens > maxTokens) break;
      result.unshift(combined[i]);
      totalTokens += tokens;
    }
    
    return result;
  }
  
  isImportant(message) {
    const importantPatterns = [
      /my name is/i,
      /remember/i,
      /important/i,
      /key point/i,
      /main topic/i
    ];
    
    return importantPatterns.some(pattern => 
      pattern.test(message.content)
    );
  }
  
  generateSystemPrompt(session) {
    const basePrompt = "You are a helpful, friendly assistant.";
    
    if (session.stats.averageSentiment < -0.5) {
      return basePrompt + " The user seems frustrated. Be extra helpful and patient.";
    }
    
    if (session.stats.topicChanges > 5) {
      return basePrompt + " The conversation has covered many topics. Help the user stay focused.";
    }
    
    if (session.messages.length > 20) {
      return basePrompt + " This is a long conversation. Be concise in your responses.";
    }
    
    return basePrompt;
  }
  
  analyzeConversation(session) {
    const stats = {
      messageCount: session.messages.length,
      averageLength: 0,
      topicChanges: 0,
      averageSentiment: 0,
      userEngagement: 0
    };
    
    if (session.messages.length === 0) return stats;
    
    // Calculate average message length
    const totalLength = session.messages.reduce(
      (sum, msg) => sum + msg.content.length, 0
    );
    stats.averageLength = totalLength / session.messages.length;
    
    // Detect topic changes (simplified)
    let lastTopic = '';
    for (const msg of session.messages) {
      const topic = this.detectTopic(msg.content);
      if (topic !== lastTopic) {
        stats.topicChanges++;
        lastTopic = topic;
      }
    }
    
    // Calculate engagement (response time, message frequency)
    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length > 1) {
      const timeDiffs = [];
      for (let i = 1; i < userMessages.length; i++) {
        timeDiffs.push(userMessages[i].timestamp - userMessages[i-1].timestamp);
      }
      const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      stats.userEngagement = 1 / (avgTimeDiff / 60000); // Messages per minute
    }
    
    return stats;
  }
  
  detectTopic(text) {
    // Simplified topic detection
    const topics = {
      technical: /code|program|api|bug|error/i,
      business: /meeting|project|deadline|budget/i,
      personal: /feel|think|believe|want/i,
      factual: /what|when|where|who|how many/i
    };
    
    for (const [topic, pattern] of Object.entries(topics)) {
      if (pattern.test(text)) return topic;
    }
    
    return 'general';
  }
  
  selectModelForContext(session) {
    // Use better models for complex or important conversations
    if (session.stats.topicChanges > 5 || session.metadata.priority === 'high') {
      return 'gpt-4';
    }
    
    if (session.messages.length > 20) {
      return 'claude-3-opus'; // Better at long context
    }
    
    return 'gpt-3.5-turbo';
  }
  
  getDynamicTemperature(session) {
    // Adjust temperature based on conversation
    if (session.metadata.mode === 'creative') {
      return 0.9;
    }
    
    if (session.stats.topicChanges > 3) {
      return 0.5; // More focused responses
    }
    
    return 0.7; // Default
  }
}
```

### 2. Multi-User Conversation

```javascript
class MultiUserChatbot {
  constructor() {
    this.router = new LLMRouter();
    this.rooms = new Map();
  }
  
  async sendMessage(roomId, userId, message) {
    const room = this.getOrCreateRoom(roomId);
    
    // Add user message to room history
    room.messages.push({
      userId,
      userName: room.users.get(userId)?.name || 'Unknown',
      content: message,
      timestamp: Date.now(),
      role: 'user'
    });
    
    // Generate bot response considering all users
    const response = await this.generateResponse(room);
    
    // Add bot response
    room.messages.push({
      userId: 'bot',
      userName: 'Assistant',
      content: response.text,
      timestamp: Date.now(),
      role: 'assistant'
    });
    
    // Notify all users
    this.broadcastMessage(roomId, response.text);
    
    return response;
  }
  
  async generateResponse(room) {
    // Build context with user identification
    const context = [
      {
        role: 'system',
        content: `You are in a group chat with ${room.users.size} users. Address users by name when appropriate.`
      }
    ];
    
    // Add recent messages with user attribution
    const recentMessages = room.messages.slice(-20);
    for (const msg of recentMessages) {
      context.push({
        role: msg.role,
        content: msg.role === 'user' 
          ? `${msg.userName}: ${msg.content}`
          : msg.content
      });
    }
    
    return this.router.generate({
      messages: context,
      model: 'gpt-3.5-turbo'
    });
  }
  
  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        messages: [],
        created: Date.now()
      });
    }
    return this.rooms.get(roomId);
  }
  
  joinRoom(roomId, userId, userName) {
    const room = this.getOrCreateRoom(roomId);
    room.users.set(userId, {
      id: userId,
      name: userName,
      joined: Date.now()
    });
  }
  
  broadcastMessage(roomId, message) {
    // Implementation depends on your transport (WebSocket, SSE, etc.)
    console.log(`Broadcasting to room ${roomId}: ${message}`);
  }
}
```

## Error Handling & Recovery

### 1. Comprehensive Error Handler

```javascript
class ErrorResilientChatbot {
  constructor() {
    this.router = new LLMRouter();
    this.errorHistory = [];
    this.recoveryStrategies = new Map();
    
    this.setupRecoveryStrategies();
  }
  
  setupRecoveryStrategies() {
    // Rate limit errors
    this.recoveryStrategies.set('rate_limit', async (error, context) => {
      await this.wait(5000); // Wait 5 seconds
      return this.switchToBackupProvider(context);
    });
    
    // Token limit errors
    this.recoveryStrategies.set('token_limit', async (error, context) => {
      context.messages = this.truncateMessages(context.messages);
      return this.retry(context);
    });
    
    // Invalid response errors
    this.recoveryStrategies.set('invalid_response', async (error, context) => {
      context.temperature = Math.max(0, context.temperature - 0.2);
      return this.retry(context);
    });
    
    // Network errors
    this.recoveryStrategies.set('network', async (error, context) => {
      await this.wait(1000);
      return this.retryWithBackoff(context);
    });
  }
  
  async chat(message, context = {}) {
    const maxRetries = 5;
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        const response = await this.attemptChat(message, context);
        
        // Validate response
        if (!this.validateResponse(response)) {
          throw new Error('Invalid response format');
        }
        
        // Clear error history on success
        if (this.errorHistory.length > 0) {
          console.log('Recovered from errors:', this.errorHistory);
          this.errorHistory = [];
        }
        
        return response;
      } catch (error) {
        attempts++;
        this.errorHistory.push({
          error: error.message,
          timestamp: Date.now(),
          attempt: attempts
        });
        
        // Classify and handle error
        const errorType = this.classifyError(error);
        const recovery = this.recoveryStrategies.get(errorType);
        
        if (recovery && attempts < maxRetries) {
          console.log(`Attempting recovery for ${errorType} error`);
          context = await recovery(error, context);
        } else if (attempts >= maxRetries) {
          return this.finalFallback(message, this.errorHistory);
        }
      }
    }
  }
  
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('rate') || message.includes('limit') || message.includes('429')) {
      return 'rate_limit';
    }
    if (message.includes('token') || message.includes('length')) {
      return 'token_limit';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('invalid') || message.includes('format')) {
      return 'invalid_response';
    }
    
    return 'unknown';
  }
  
  validateResponse(response) {
    if (!response || !response.text) return false;
    if (response.text.length < 1) return false;
    if (response.text === 'undefined' || response.text === 'null') return false;
    
    // Check for error indicators
    const errorPhrases = [
      'error occurred',
      'unable to process',
      'something went wrong'
    ];
    
    const lower = response.text.toLowerCase();
    for (const phrase of errorPhrases) {
      if (lower.includes(phrase)) return false;
    }
    
    return true;
  }
  
  async switchToBackupProvider(context) {
    // Switch to a different provider
    const providers = ['openai', 'anthropic', 'groq', 'openrouter'];
    const current = context.provider || 'openai';
    const index = providers.indexOf(current);
    const next = providers[(index + 1) % providers.length];
    
    return { ...context, provider: next };
  }
  
  truncateMessages(messages) {
    // Keep system message and last 5 exchanges
    const system = messages.find(m => m.role === 'system');
    const recent = messages.slice(-10);
    
    return system ? [system, ...recent] : recent;
  }
  
  async retryWithBackoff(context, attempt = 0) {
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
    await this.wait(delay);
    return context;
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  finalFallback(message, errorHistory) {
    // Last resort - return a helpful message
    console.error('All recovery attempts failed:', errorHistory);
    
    return {
      text: "I apologize, but I'm experiencing technical difficulties. Please try again later or contact support if the issue persists.",
      error: true,
      errorHistory,
      fallback: true
    };
  }
}
```

## Advanced Features

### 1. Streaming with Fallback

```javascript
class StreamingChatbot {
  constructor() {
    this.router = new LLMRouter();
  }
  
  async *streamChat(message, options = {}) {
    const models = options.models || ['gpt-3.5-turbo', 'claude-3-haiku'];
    
    for (const model of models) {
      try {
        const stream = await this.router.generateStream({
          model,
          prompt: message,
          ...options
        });
        
        let buffer = '';
        let tokenCount = 0;
        
        for await (const chunk of stream) {
          buffer += chunk.text;
          tokenCount++;
          
          // Yield chunks
          yield {
            text: chunk.text,
            model,
            tokenCount,
            isComplete: false
          };
          
          // Validate stream health
          if (tokenCount > 0 && tokenCount % 50 === 0) {
            if (!this.isStreamHealthy(buffer)) {
              throw new Error('Stream appears corrupted');
            }
          }
        }
        
        // Stream completed successfully
        yield {
          text: '',
          model,
          tokenCount,
          isComplete: true,
          fullResponse: buffer
        };
        
        return; // Success, don't try other models
        
      } catch (error) {
        console.warn(`Streaming failed for ${model}, trying next...`);
        
        // Notify about fallback
        yield {
          text: '',
          error: error.message,
          fallbackTo: models[models.indexOf(model) + 1],
          isComplete: false
        };
      }
    }
    
    // All models failed
    yield {
      text: 'Unable to generate response. Please try again.',
      error: true,
      isComplete: true
    };
  }
  
  isStreamHealthy(buffer) {
    // Check for repetition or corruption
    const lines = buffer.split('\n');
    if (lines.length > 3) {
      const lastThree = lines.slice(-3);
      if (lastThree.every(line => line === lastThree[0])) {
        return false; // Repetition detected
      }
    }
    
    // Check for binary data or corruption
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(buffer)) {
      return false; // Binary characters detected
    }
    
    return true;
  }
}

// Usage example
const chatbot = new StreamingChatbot();

async function handleStreaming() {
  const stream = chatbot.streamChat('Tell me a story', {
    models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku'],
    maxTokens: 500
  });
  
  for await (const chunk of stream) {
    if (chunk.error) {
      console.error('Stream error:', chunk.error);
    } else if (chunk.fallbackTo) {
      console.log(`Switching to ${chunk.fallbackTo}...`);
    } else if (chunk.text) {
      process.stdout.write(chunk.text);
    }
    
    if (chunk.isComplete) {
      console.log('\n\nStream complete!');
      if (chunk.fullResponse) {
        console.log('Total tokens:', chunk.tokenCount);
      }
    }
  }
}
```

### 2. Intelligent Retry Logic

```javascript
class SmartRetryChatbot {
  constructor() {
    this.router = new LLMRouter();
    this.retryAnalyzer = new RetryAnalyzer();
  }
  
  async chat(message, options = {}) {
    const strategy = this.retryAnalyzer.determineStrategy(message, options);
    
    return this.executeWithStrategy(message, strategy);
  }
  
  async executeWithStrategy(message, strategy) {
    let lastError;
    
    for (let attempt = 0; attempt < strategy.maxAttempts; attempt++) {
      try {
        // Calculate delay with jitter
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt, strategy);
          await this.wait(delay);
        }
        
        // Modify request based on attempt
        const modifiedRequest = this.modifyRequest(message, attempt, lastError);
        
        // Try with current model
        const model = strategy.models[Math.min(attempt, strategy.models.length - 1)];
        const response = await this.router.generate({
          ...modifiedRequest,
          model
        });
        
        // Success - update analyzer
        this.retryAnalyzer.recordSuccess(model, attempt);
        
        return response;
        
      } catch (error) {
        lastError = error;
        this.retryAnalyzer.recordFailure(error, attempt);
        
        // Check if we should continue retrying
        if (!this.shouldRetry(error, attempt, strategy)) {
          break;
        }
      }
    }
    
    throw lastError;
  }
  
  calculateDelay(attempt, strategy) {
    const baseDelay = strategy.baseDelay || 1000;
    const maxDelay = strategy.maxDelay || 30000;
    const jitter = strategy.jitter || 0.1;
    
    // Exponential backoff with jitter
    let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitterAmount = delay * jitter;
    delay += (Math.random() - 0.5) * 2 * jitterAmount;
    
    return Math.max(0, delay);
  }
  
  modifyRequest(message, attempt, lastError) {
    const modifications = {
      prompt: message,
      temperature: 0.7
    };
    
    // Reduce temperature on retries for more consistent responses
    if (attempt > 0) {
      modifications.temperature = Math.max(0, 0.7 - (attempt * 0.1));
    }
    
    // Reduce max tokens if we hit token limits
    if (lastError?.message?.includes('token')) {
      modifications.maxTokens = 500;
    }
    
    // Add retry context
    if (attempt > 2) {
      modifications.prompt = `Please provide a concise response: ${message}`;
    }
    
    return modifications;
  }
  
  shouldRetry(error, attempt, strategy) {
    // Don't retry client errors
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }
    
    // Always retry rate limits and server errors
    if (error.status === 429 || error.status >= 500) {
      return attempt < strategy.maxAttempts;
    }
    
    // Retry network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return attempt < strategy.maxAttempts;
    }
    
    return false;
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class RetryAnalyzer {
  constructor() {
    this.history = [];
    this.modelStats = new Map();
  }
  
  determineStrategy(message, options) {
    const messageLength = message.length;
    const priority = options.priority || 'normal';
    
    // High priority - aggressive retries
    if (priority === 'high') {
      return {
        maxAttempts: 5,
        baseDelay: 500,
        maxDelay: 5000,
        jitter: 0.2,
        models: ['gpt-4', 'claude-3-opus', 'gpt-3.5-turbo']
      };
    }
    
    // Long messages - fewer retries, longer delays
    if (messageLength > 2000) {
      return {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 10000,
        jitter: 0.1,
        models: ['gpt-4', 'claude-3-opus']
      };
    }
    
    // Default strategy
    return {
      maxAttempts: 4,
      baseDelay: 1000,
      maxDelay: 8000,
      jitter: 0.15,
      models: ['gpt-3.5-turbo', 'claude-3-haiku', 'groq/mixtral']
    };
  }
  
  recordSuccess(model, attempts) {
    const stats = this.modelStats.get(model) || {
      successes: 0,
      failures: 0,
      avgAttempts: 0
    };
    
    stats.successes++;
    stats.avgAttempts = (stats.avgAttempts * (stats.successes - 1) + attempts) / stats.successes;
    
    this.modelStats.set(model, stats);
  }
  
  recordFailure(error, attempt) {
    this.history.push({
      error: error.message,
      attempt,
      timestamp: Date.now()
    });
    
    // Keep only last 100 failures
    if (this.history.length > 100) {
      this.history.shift();
    }
  }
}
```

## Production Deployment

### 1. Production-Ready Chatbot

```javascript
class ProductionChatbot {
  constructor(config = {}) {
    this.router = new LLMRouter({
      providers: config.providers || ['openai', 'anthropic'],
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 1000
      },
      monitoring: {
        enabled: true,
        metricsEndpoint: config.metricsEndpoint
      }
    });
    
    this.config = config;
    this.healthChecker = new HealthChecker(this.router);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.conversations = new ConversationStore(config.storage);
    
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Health checks
    setInterval(() => {
      this.healthChecker.check().catch(error => {
        console.error('Health check failed:', error);
        this.notifyOps('Health check failure', error);
      });
    }, 30000); // Every 30 seconds
    
    // Metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute
  }
  
  async chat(userId, message, options = {}) {
    // Rate limiting
    if (!await this.rateLimiter.checkLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Input validation
    if (!this.validateInput(message)) {
      throw new Error('Invalid input');
    }
    
    // Load conversation
    const conversation = await this.conversations.load(userId);
    
    try {
      // Generate response with full fallback chain
      const response = await this.generateWithFallback(
        message,
        conversation,
        options
      );
      
      // Save conversation
      await this.conversations.save(userId, conversation);
      
      // Log metrics
      this.logMetrics('chat_success', {
        userId,
        model: response.model,
        latency: response.latency,
        cost: response.cost
      });
      
      return response;
      
    } catch (error) {
      // Log error
      this.logError('chat_failure', error, { userId });
      
      // Return graceful error
      return this.handleProductionError(error);
    }
  }
  
  async generateWithFallback(message, conversation, options) {
    const startTime = Date.now();
    const fallbackChain = this.getFallbackChain(options);
    
    for (const config of fallbackChain) {
      try {
        const response = await this.attemptGeneration(
          message,
          conversation,
          config
        );
        
        // Validate response quality
        if (await this.validateResponse(response)) {
          return {
            ...response,
            latency: Date.now() - startTime,
            fallbacksUsed: fallbackChain.indexOf(config)
          };
        }
      } catch (error) {
        this.logMetrics('fallback_triggered', {
          from: config.model,
          error: error.message
        });
      }
    }
    
    throw new Error('All fallback options exhausted');
  }
  
  getFallbackChain(options) {
    const tier = options.tier || 'standard';
    
    const chains = {
      premium: [
        { model: 'gpt-4', timeout: 30000 },
        { model: 'claude-3-opus', timeout: 25000 },
        { model: 'gpt-3.5-turbo', timeout: 15000 }
      ],
      standard: [
        { model: 'gpt-3.5-turbo', timeout: 15000 },
        { model: 'claude-3-haiku', timeout: 10000 },
        { model: 'groq/mixtral', timeout: 5000 }
      ],
      economy: [
        { model: 'claude-3-haiku', timeout: 10000 },
        { model: 'groq/mixtral', timeout: 5000 }
      ]
    };
    
    return chains[tier] || chains.standard;
  }
  
  validateInput(message) {
    // Length check
    if (!message || message.length === 0 || message.length > 10000) {
      return false;
    }
    
    // Basic injection prevention
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /onclick/i,
      /onerror/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(message)) {
        return false;
      }
    }
    
    return true;
  }
  
  async validateResponse(response) {
    // Basic validation
    if (!response || !response.text || response.text.length < 1) {
      return false;
    }
    
    // Content filtering
    if (this.config.contentFilter) {
      return this.config.contentFilter(response.text);
    }
    
    return true;
  }
  
  handleProductionError(error) {
    // Don't expose internal errors to users
    const userMessage = "I apologize for the inconvenience. Please try again or contact support if the issue persists.";
    
    // Log detailed error internally
    console.error('Production error:', error);
    
    return {
      text: userMessage,
      error: true,
      errorCode: this.generateErrorCode()
    };
  }
  
  generateErrorCode() {
    return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  logMetrics(event, data) {
    // Send to metrics service
    if (this.config.metricsEndpoint) {
      fetch(this.config.metricsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data, timestamp: Date.now() })
      }).catch(err => console.error('Metrics logging failed:', err));
    }
  }
  
  logError(event, error, context) {
    // Send to error tracking service
    if (this.config.errorEndpoint) {
      fetch(this.config.errorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          error: {
            message: error.message,
            stack: error.stack
          },
          context,
          timestamp: Date.now()
        })
      }).catch(err => console.error('Error logging failed:', err));
    }
  }
  
  notifyOps(message, details) {
    // Send to ops notification service (Slack, PagerDuty, etc.)
    console.error(`OPS ALERT: ${message}`, details);
  }
}

// Supporting classes
class HealthChecker {
  constructor(router) {
    this.router = router;
  }
  
  async check() {
    const results = {
      timestamp: Date.now(),
      healthy: true,
      providers: {}
    };
    
    // Check each provider
    for (const provider of ['openai', 'anthropic', 'groq']) {
      try {
        const response = await this.router.generate({
          prompt: 'test',
          model: this.getTestModel(provider),
          maxTokens: 1,
          timeout: 5000
        });
        
        results.providers[provider] = {
          healthy: true,
          latency: response.latency
        };
      } catch (error) {
        results.providers[provider] = {
          healthy: false,
          error: error.message
        };
        results.healthy = false;
      }
    }
    
    return results;
  }
  
  getTestModel(provider) {
    const models = {
      openai: 'gpt-3.5-turbo',
      anthropic: 'claude-3-haiku',
      groq: 'groq/mixtral'
    };
    return models[provider];
  }
}

class RateLimiter {
  constructor(config = {}) {
    this.limits = config;
    this.usage = new Map();
  }
  
  async checkLimit(userId) {
    const userUsage = this.usage.get(userId) || {
      count: 0,
      resetTime: Date.now() + 60000
    };
    
    // Reset if time window passed
    if (Date.now() > userUsage.resetTime) {
      userUsage.count = 0;
      userUsage.resetTime = Date.now() + 60000;
    }
    
    // Check limit
    const limit = this.limits[userId] || this.limits.default || 10;
    if (userUsage.count >= limit) {
      return false;
    }
    
    // Increment usage
    userUsage.count++;
    this.usage.set(userId, userUsage);
    
    return true;
  }
}

class ConversationStore {
  constructor(config = {}) {
    this.storage = config.type || 'memory';
    this.data = new Map();
  }
  
  async load(userId) {
    if (this.storage === 'memory') {
      return this.data.get(userId) || { messages: [] };
    }
    // Add database storage implementation
  }
  
  async save(userId, conversation) {
    if (this.storage === 'memory') {
      this.data.set(userId, conversation);
    }
    // Add database storage implementation
  }
}
```

## Real-World Examples

### Customer Support Bot

```javascript
const supportBot = new ProductionChatbot({
  providers: ['openai', 'anthropic'],
  rateLimit: {
    default: 20,
    premium: 100
  },
  storage: {
    type: 'redis',
    connection: process.env.REDIS_URL
  },
  metricsEndpoint: 'https://metrics.example.com/chatbot',
  errorEndpoint: 'https://errors.example.com/chatbot',
  contentFilter: (text) => {
    // Filter inappropriate content
    return !text.includes('inappropriate');
  }
});

// API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message, tier } = req.body;
    
    const response = await supportBot.chat(userId, message, {
      tier: tier || 'standard',
      systemPrompt: 'You are a helpful customer support agent.',
      maxTokens: 500
    });
    
    res.json({
      success: true,
      response: response.text,
      model: response.model,
      fallbacksUsed: response.fallbacksUsed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Best Practices

1. **Always implement fallback chains** - Never rely on a single provider
2. **Monitor everything** - Track failures, latencies, and costs
3. **Validate inputs and outputs** - Protect against injection and ensure quality
4. **Use appropriate timeout values** - Balance user experience with reliability
5. **Implement proper error handling** - Don't expose internal errors to users
6. **Cache when possible** - Reduce costs and improve response times
7. **Rate limit by user** - Prevent abuse and control costs
8. **Store conversation context** - Provide coherent multi-turn conversations
9. **Test fallback scenarios** - Regularly test your fallback chains
10. **Document error codes** - Help support teams troubleshoot issues

## Conclusion

Building resilient chatbots requires careful consideration of failure modes, fallback strategies, and production requirements. By implementing proper error handling, multi-provider support, and intelligent retry logic, you can create chatbots that provide reliable service even when individual components fail.

---

Next: [Cost-Effective RAG Systems](./cost-effective-rag.md) | [Back to Tutorials](../tutorials/)