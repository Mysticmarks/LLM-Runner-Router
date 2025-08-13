# Custom Routing Examples

This guide demonstrates advanced routing strategies and custom routing implementations for the LLM-Runner-Router system. Learn how to create intelligent model selection logic for optimal performance and cost efficiency.

## Table of Contents
- [Built-in Routing Strategies](#built-in-routing-strategies)
- [Custom Routing Logic](#custom-routing-logic)
- [Dynamic Strategy Selection](#dynamic-strategy-selection)
- [Performance-Based Routing](#performance-based-routing)
- [Cost-Aware Routing](#cost-aware-routing)
- [Multi-Criteria Routing](#multi-criteria-routing)

## Built-in Routing Strategies

### Understanding Default Strategies

```javascript
import LLMRouter from 'llm-runner-router';

class RoutingStrategiesDemo {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load multiple models for routing demonstration
    await this.router.load({
      source: 'models/fast-model.gguf',
      config: { speed: 'high', quality: 'medium', cost: 'low' }
    });
    
    await this.router.load({
      source: 'models/quality-model.gguf',
      config: { speed: 'medium', quality: 'high', cost: 'high' }
    });
    
    await this.router.load({
      source: 'models/balanced-model.gguf',
      config: { speed: 'medium', quality: 'medium', cost: 'medium' }
    });
    
    console.log('📚 Loaded models for routing demonstration');
  }
  
  async demonstrateBuiltInStrategies() {
    const prompt = "Explain the concept of machine learning in simple terms";
    const strategies = [
      'quality-first',
      'cost-optimized', 
      'speed-priority',
      'balanced',
      'round-robin',
      'least-loaded',
      'random'
    ];
    
    console.log('🎯 Testing Built-in Routing Strategies:\n');
    
    for (const strategy of strategies) {
      console.log(`--- ${strategy.toUpperCase()} STRATEGY ---`);
      
      // Set the strategy
      this.router.setStrategy(strategy);
      
      const startTime = Date.now();
      const result = await this.router.quick(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });
      const endTime = Date.now();
      
      console.log(`Selected Model: ${result.model}`);
      console.log(`Response Length: ${result.text.length} characters`);
      console.log(`Processing Time: ${endTime - startTime}ms`);
      console.log(`Strategy Reasoning: ${this.getStrategyReasoning(strategy)}`);
      console.log('');
    }
  }
  
  getStrategyReasoning(strategy) {
    const reasoning = {
      'quality-first': 'Prioritizes models with highest quality scores',
      'cost-optimized': 'Selects models with lowest operational costs',
      'speed-priority': 'Chooses fastest responding models',
      'balanced': 'Balances quality, speed, and cost factors',
      'round-robin': 'Distributes requests evenly across all models',
      'least-loaded': 'Routes to models with lowest current load',
      'random': 'Randomly selects from available models'
    };
    
    return reasoning[strategy] || 'Custom strategy implementation';
  }
  
  async benchmarkStrategies() {
    const testPrompts = [
      "What is artificial intelligence?",
      "Explain quantum computing briefly",
      "How do neural networks work?",
      "What is the difference between AI and ML?",
      "Describe natural language processing"
    ];
    
    const strategies = ['quality-first', 'speed-priority', 'balanced'];
    const results = {};
    
    console.log('⚡ Benchmarking Routing Strategies:\n');
    
    for (const strategy of strategies) {
      results[strategy] = {
        totalTime: 0,
        totalTokens: 0,
        responses: []
      };
      
      this.router.setStrategy(strategy);
      
      for (const prompt of testPrompts) {
        const startTime = Date.now();
        const result = await this.router.quick(prompt, {
          maxTokens: 80,
          temperature: 0.7
        });
        const endTime = Date.now();
        
        const responseData = {
          prompt,
          model: result.model,
          time: endTime - startTime,
          tokens: result.tokens
        };
        
        results[strategy].totalTime += responseData.time;
        results[strategy].totalTokens += responseData.tokens;
        results[strategy].responses.push(responseData);
      }
      
      console.log(`${strategy.toUpperCase()} Results:`);
      console.log(`  Total Time: ${results[strategy].totalTime}ms`);
      console.log(`  Avg Time: ${Math.round(results[strategy].totalTime / testPrompts.length)}ms`);
      console.log(`  Total Tokens: ${results[strategy].totalTokens}`);
      console.log(`  Avg Tokens: ${Math.round(results[strategy].totalTokens / testPrompts.length)}`);
      console.log('');
    }
    
    return results;
  }
}

// Usage
async function demonstrateBuiltInRouting() {
  const demo = new RoutingStrategiesDemo();
  await demo.initialize();
  
  await demo.demonstrateBuiltInStrategies();
  await demo.benchmarkStrategies();
}

demonstrateBuiltInRouting().catch(console.error);
```

## Custom Routing Logic

### Creating Custom Routing Strategies

```javascript
class CustomRoutingSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'custom',
      logLevel: 'info'
    });
    
    this.modelMetrics = new Map();
    this.requestHistory = [];
    this.customStrategies = new Map();
    
    this.setupCustomStrategies();
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load models with detailed metadata
    const models = [
      {
        source: 'models/gpt-style-model.gguf',
        metadata: {
          type: 'general',
          specialties: ['conversation', 'explanation', 'creative'],
          speed: 8,
          quality: 9,
          cost: 7,
          contextWindow: 4096
        }
      },
      {
        source: 'models/code-model.gguf', 
        metadata: {
          type: 'code',
          specialties: ['programming', 'debugging', 'technical'],
          speed: 6,
          quality: 8,
          cost: 6,
          contextWindow: 8192
        }
      },
      {
        source: 'models/math-model.gguf',
        metadata: {
          type: 'analytical',
          specialties: ['mathematics', 'logic', 'analysis'],
          speed: 7,
          quality: 9,
          cost: 8,
          contextWindow: 2048
        }
      }
    ];
    
    for (const modelConfig of models) {
      const model = await this.router.load(modelConfig.source);
      this.modelMetrics.set(model.id, {
        ...modelConfig.metadata,
        requests: 0,
        avgLatency: 0,
        successRate: 1.0,
        lastUsed: new Date(),
        currentLoad: 0
      });
    }
    
    console.log('🎯 Custom routing system initialized');
  }
  
  setupCustomStrategies() {
    // Content-aware routing
    this.customStrategies.set('content-aware', (models, context) => {
      const prompt = context.prompt.toLowerCase();
      
      // Analyze prompt content
      if (this.isCodeRequest(prompt)) {
        return this.findBestModelBySpecialty(models, 'code');
      } else if (this.isMathRequest(prompt)) {
        return this.findBestModelBySpecialty(models, 'analytical');
      } else {
        return this.findBestModelBySpecialty(models, 'general');
      }
    });
    
    // Adaptive performance routing
    this.customStrategies.set('adaptive-performance', (models, context) => {
      return this.selectByAdaptivePerformance(models, context);
    });
    
    // Time-aware routing
    this.customStrategies.set('time-aware', (models, context) => {
      const hour = new Date().getHours();
      
      // During peak hours (9-17), prioritize speed
      if (hour >= 9 && hour <= 17) {
        return this.findFastestModel(models);
      } else {
        // Off-peak hours, prioritize quality
        return this.findHighestQualityModel(models);
      }
    });
    
    // Load-balancing with preferences
    this.customStrategies.set('smart-load-balance', (models, context) => {
      return this.smartLoadBalance(models, context);
    });
    
    // Cost-conscious with quality thresholds
    this.customStrategies.set('cost-quality-threshold', (models, context) => {
      const qualityThreshold = context.options?.minQuality || 7;
      const maxCost = context.options?.maxCost || 8;
      
      const eligibleModels = models.filter(model => {
        const metrics = this.modelMetrics.get(model.id);
        return metrics && metrics.quality >= qualityThreshold && metrics.cost <= maxCost;
      });
      
      if (eligibleModels.length === 0) {
        return models[0]; // Fallback to first available
      }
      
      // Among eligible models, select by cost
      return eligibleModels.sort((a, b) => {
        const aMetrics = this.modelMetrics.get(a.id);
        const bMetrics = this.modelMetrics.get(b.id);
        return aMetrics.cost - bMetrics.cost;
      })[0];
    });
    
    // Register custom strategies with router
    for (const [name, strategy] of this.customStrategies) {
      this.router.addCustomStrategy(name, strategy);
    }
  }
  
  isCodeRequest(prompt) {
    const codeKeywords = [
      'code', 'program', 'function', 'algorithm', 'debug', 'syntax',
      'javascript', 'python', 'java', 'c++', 'html', 'css', 'sql',
      'implement', 'compile', 'error', 'bug', 'api', 'library'
    ];
    
    return codeKeywords.some(keyword => prompt.includes(keyword));
  }
  
  isMathRequest(prompt) {
    const mathKeywords = [
      'calculate', 'equation', 'formula', 'mathematics', 'algebra',
      'geometry', 'calculus', 'statistics', 'probability', 'solve',
      'derivative', 'integral', 'matrix', 'vector', 'theorem'
    ];
    
    return mathKeywords.some(keyword => prompt.includes(keyword));
  }
  
  findBestModelBySpecialty(models, specialty) {
    const specializedModels = models.filter(model => {
      const metrics = this.modelMetrics.get(model.id);
      return metrics && metrics.type === specialty;
    });
    
    if (specializedModels.length === 0) {
      return models[0]; // Fallback
    }
    
    // Select best specialized model by quality
    return specializedModels.sort((a, b) => {
      const aMetrics = this.modelMetrics.get(a.id);
      const bMetrics = this.modelMetrics.get(b.id);
      return bMetrics.quality - aMetrics.quality;
    })[0];
  }
  
  selectByAdaptivePerformance(models, context) {
    // Calculate dynamic scores based on recent performance
    const scoredModels = models.map(model => {
      const metrics = this.modelMetrics.get(model.id);
      if (!metrics) return { model, score: 0 };
      
      // Calculate composite score
      const qualityScore = metrics.quality / 10;
      const speedScore = (10 - metrics.avgLatency / 100) / 10; // Normalize latency
      const reliabilityScore = metrics.successRate;
      const loadScore = Math.max(0, (10 - metrics.currentLoad) / 10);
      
      const score = (qualityScore * 0.3) + 
                   (speedScore * 0.3) + 
                   (reliabilityScore * 0.2) + 
                   (loadScore * 0.2);
      
      return { model, score };
    });
    
    // Select model with highest score
    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0].model;
  }
  
  findFastestModel(models) {
    return models.sort((a, b) => {
      const aMetrics = this.modelMetrics.get(a.id);
      const bMetrics = this.modelMetrics.get(b.id);
      return aMetrics.avgLatency - bMetrics.avgLatency;
    })[0];
  }
  
  findHighestQualityModel(models) {
    return models.sort((a, b) => {
      const aMetrics = this.modelMetrics.get(a.id);
      const bMetrics = this.modelMetrics.get(b.id);
      return bMetrics.quality - aMetrics.quality;
    })[0];
  }
  
  smartLoadBalance(models, context) {
    // Weighted load balancing considering model capabilities
    const weights = models.map(model => {
      const metrics = this.modelMetrics.get(model.id);
      if (!metrics) return 0;
      
      // Lower current load = higher weight
      const loadWeight = Math.max(0, 10 - metrics.currentLoad);
      
      // Recent success rate
      const successWeight = metrics.successRate * 10;
      
      // Time since last use (encourage distribution)
      const timeSinceLastUse = Date.now() - metrics.lastUsed.getTime();
      const recencyWeight = Math.min(5, timeSinceLastUse / (1000 * 60)); // Max 5 points for 1+ min
      
      return loadWeight + successWeight + recencyWeight;
    });
    
    // Weighted random selection
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < models.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return models[i];
      }
    }
    
    return models[0]; // Fallback
  }
  
  async testCustomStrategy(strategyName, testCases) {
    console.log(`🧪 Testing Custom Strategy: ${strategyName}\n`);
    
    this.router.setStrategy(strategyName);
    
    const results = [];
    
    for (const testCase of testCases) {
      const startTime = Date.now();
      
      try {
        const result = await this.router.quick(testCase.prompt, testCase.options || {});
        const endTime = Date.now();
        
        const testResult = {
          prompt: testCase.prompt,
          expectedType: testCase.expectedType,
          selectedModel: result.model,
          modelType: this.getModelType(result.model),
          latency: endTime - startTime,
          success: true,
          correctSelection: this.getModelType(result.model) === testCase.expectedType
        };
        
        results.push(testResult);
        
        // Update metrics
        this.updateModelMetrics(result.model, endTime - startTime, true);
        
        console.log(`✅ Prompt: "${testCase.prompt}"`);
        console.log(`   Expected: ${testCase.expectedType}, Got: ${testResult.modelType}`);
        console.log(`   Model: ${result.model}, Time: ${testResult.latency}ms`);
        console.log(`   Correct: ${testResult.correctSelection ? 'Yes' : 'No'}\n`);
        
      } catch (error) {
        const testResult = {
          prompt: testCase.prompt,
          error: error.message,
          success: false
        };
        
        results.push(testResult);
        console.log(`❌ Failed: "${testCase.prompt}" - ${error.message}\n`);
      }
    }
    
    // Calculate accuracy
    const successfulTests = results.filter(r => r.success);
    const correctSelections = successfulTests.filter(r => r.correctSelection);
    const accuracy = successfulTests.length > 0 ? 
      (correctSelections.length / successfulTests.length) * 100 : 0;
    
    console.log(`📊 Strategy Performance Summary:`);
    console.log(`   Total Tests: ${results.length}`);
    console.log(`   Successful: ${successfulTests.length}`);
    console.log(`   Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`   Avg Latency: ${successfulTests.reduce((sum, r) => sum + r.latency, 0) / successfulTests.length || 0}ms`);
    
    return results;
  }
  
  getModelType(modelId) {
    const metrics = this.modelMetrics.get(modelId);
    return metrics ? metrics.type : 'unknown';
  }
  
  updateModelMetrics(modelId, latency, success) {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return;
    
    metrics.requests++;
    metrics.avgLatency = ((metrics.avgLatency * (metrics.requests - 1)) + latency) / metrics.requests;
    metrics.successRate = ((metrics.successRate * (metrics.requests - 1)) + (success ? 1 : 0)) / metrics.requests;
    metrics.lastUsed = new Date();
  }
  
  getRoutingStats() {
    const stats = {
      totalRequests: this.requestHistory.length,
      strategies: {},
      models: {}
    };
    
    // Model usage statistics
    for (const [modelId, metrics] of this.modelMetrics) {
      stats.models[modelId] = {
        requests: metrics.requests,
        avgLatency: Math.round(metrics.avgLatency),
        successRate: (metrics.successRate * 100).toFixed(1) + '%',
        type: metrics.type,
        quality: metrics.quality,
        cost: metrics.cost
      };
    }
    
    return stats;
  }
}

// Usage example
async function demonstrateCustomRouting() {
  const customRouter = new CustomRoutingSystem();
  await customRouter.initialize();
  
  // Test cases for different scenarios
  const testCases = [
    // Code-related prompts
    { prompt: "Write a JavaScript function to sort an array", expectedType: "code" },
    { prompt: "Debug this Python code error", expectedType: "code" },
    { prompt: "Explain how APIs work in programming", expectedType: "code" },
    
    // Math-related prompts
    { prompt: "Calculate the derivative of x^2 + 3x + 2", expectedType: "analytical" },
    { prompt: "Solve this algebra equation: 2x + 5 = 15", expectedType: "analytical" },
    { prompt: "Explain probability theory basics", expectedType: "analytical" },
    
    // General prompts
    { prompt: "What is artificial intelligence?", expectedType: "general" },
    { prompt: "Write a creative story about robots", expectedType: "general" },
    { prompt: "Explain climate change", expectedType: "general" }
  ];
  
  // Test content-aware routing
  await customRouter.testCustomStrategy('content-aware', testCases);
  
  // Test adaptive performance routing
  console.log('\n' + '='.repeat(60) + '\n');
  await customRouter.testCustomStrategy('adaptive-performance', testCases.slice(0, 5));
  
  // Test time-aware routing
  console.log('\n' + '='.repeat(60) + '\n');
  await customRouter.testCustomStrategy('time-aware', testCases.slice(0, 3));
  
  // Show routing statistics
  console.log('\n📈 Routing Statistics:');
  console.log(JSON.stringify(customRouter.getRoutingStats(), null, 2));
}

demonstrateCustomRouting().catch(console.error);
```

## Dynamic Strategy Selection

### Context-Aware Strategy Switching

```javascript
class DynamicRoutingManager {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.contextAnalyzers = new Map();
    this.strategyHistory = [];
    this.performanceMetrics = new Map();
    
    this.setupContextAnalyzers();
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load models for demonstration
    await this.router.load('models/fast-model.gguf');
    await this.router.load('models/quality-model.gguf');
    await this.router.load('models/specialized-model.gguf');
    
    console.log('🎛️ Dynamic routing manager initialized');
  }
  
  setupContextAnalyzers() {
    // Urgency analyzer
    this.contextAnalyzers.set('urgency', (context) => {
      const urgentKeywords = ['urgent', 'asap', 'immediately', 'quickly', 'fast', 'emergency'];
      const prompt = context.prompt.toLowerCase();
      
      const urgencyScore = urgentKeywords.reduce((score, keyword) => {
        return score + (prompt.includes(keyword) ? 1 : 0);
      }, 0);
      
      return {
        isUrgent: urgencyScore > 0,
        urgencyLevel: Math.min(urgencyScore, 3),
        recommendedStrategy: urgencyScore > 0 ? 'speed-priority' : null
      };
    });
    
    // Complexity analyzer
    this.contextAnalyzers.set('complexity', (context) => {
      const complexKeywords = ['analyze', 'compare', 'detailed', 'comprehensive', 'in-depth', 'research'];
      const prompt = context.prompt.toLowerCase();
      
      const complexityScore = complexKeywords.reduce((score, keyword) => {
        return score + (prompt.includes(keyword) ? 1 : 0);
      }, 0);
      
      const isLongPrompt = context.prompt.length > 500;
      const needsHighQuality = complexityScore > 1 || isLongPrompt;
      
      return {
        isComplex: needsHighQuality,
        complexityLevel: complexityScore + (isLongPrompt ? 1 : 0),
        recommendedStrategy: needsHighQuality ? 'quality-first' : null
      };
    });
    
    // Cost sensitivity analyzer
    this.contextAnalyzers.set('cost', (context) => {
      const costSensitiveKeywords = ['budget', 'cheap', 'cost-effective', 'affordable', 'economical'];
      const prompt = context.prompt.toLowerCase();
      
      const isCostSensitive = costSensitiveKeywords.some(keyword => prompt.includes(keyword));
      
      return {
        isCostSensitive,
        recommendedStrategy: isCostSensitive ? 'cost-optimized' : null
      };
    });
    
    // Load analyzer
    this.contextAnalyzers.set('load', (context) => {
      const currentHour = new Date().getHours();
      const isPeakHour = currentHour >= 9 && currentHour <= 17;
      
      // Simulate current system load
      const systemLoad = Math.random();
      const isHighLoad = systemLoad > 0.7;
      
      return {
        isHighLoad,
        isPeakHour,
        systemLoad,
        recommendedStrategy: isHighLoad ? 'least-loaded' : null
      };
    });
  }
  
  analyzeContext(prompt, options = {}) {
    const context = { prompt, options };
    const analysis = {
      context,
      timestamp: new Date(),
      analyzers: {},
      recommendations: []
    };
    
    // Run all context analyzers
    for (const [name, analyzer] of this.contextAnalyzers) {
      try {
        const result = analyzer(context);
        analysis.analyzers[name] = result;
        
        if (result.recommendedStrategy) {
          analysis.recommendations.push({
            strategy: result.recommendedStrategy,
            reason: `${name} analysis`,
            confidence: this.calculateConfidence(name, result)
          });
        }
      } catch (error) {
        console.error(`Error in ${name} analyzer:`, error);
      }
    }
    
    return analysis;
  }
  
  calculateConfidence(analyzerName, result) {
    // Simple confidence calculation based on analyzer type and result
    switch (analyzerName) {
      case 'urgency':
        return Math.min(result.urgencyLevel / 3, 1);
      case 'complexity':
        return Math.min(result.complexityLevel / 3, 1);
      case 'cost':
        return result.isCostSensitive ? 0.8 : 0;
      case 'load':
        return result.isHighLoad ? result.systemLoad : 0.3;
      default:
        return 0.5;
    }
  }
  
  selectOptimalStrategy(analysis) {
    if (analysis.recommendations.length === 0) {
      return 'balanced'; // Default strategy
    }
    
    // Sort recommendations by confidence
    const sortedRecommendations = analysis.recommendations
      .sort((a, b) => b.confidence - a.confidence);
    
    // Check for conflicting high-confidence recommendations
    const highConfidenceRecs = sortedRecommendations.filter(rec => rec.confidence > 0.7);
    
    if (highConfidenceRecs.length > 1) {
      // Resolve conflicts
      return this.resolveStrategyConflicts(highConfidenceRecs, analysis);
    }
    
    return sortedRecommendations[0].strategy;
  }
  
  resolveStrategyConflicts(conflictingRecs, analysis) {
    const strategies = conflictingRecs.map(rec => rec.strategy);
    
    // Priority order for conflict resolution
    const priorityOrder = ['speed-priority', 'quality-first', 'cost-optimized', 'least-loaded'];
    
    for (const priority of priorityOrder) {
      if (strategies.includes(priority)) {
        return priority;
      }
    }
    
    // If no priority match, use weighted combination
    return this.createHybridStrategy(conflictingRecs);
  }
  
  createHybridStrategy(recommendations) {
    // For demo purposes, return a balanced approach
    // In practice, you could create dynamic hybrid strategies
    console.log('🔀 Creating hybrid strategy from:', recommendations.map(r => r.strategy));
    return 'balanced';
  }
  
  async smartRoute(prompt, options = {}) {
    // Analyze context
    const analysis = this.analyzeContext(prompt, options);
    
    // Select optimal strategy
    const selectedStrategy = this.selectOptimalStrategy(analysis);
    
    // Apply strategy
    this.router.setStrategy(selectedStrategy);
    
    console.log(`🧠 Smart routing decision:`);
    console.log(`   Selected Strategy: ${selectedStrategy}`);
    console.log(`   Based on: ${analysis.recommendations.map(r => r.reason).join(', ')}`);
    
    // Record strategy usage
    this.strategyHistory.push({
      timestamp: new Date(),
      strategy: selectedStrategy,
      analysis,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
    });
    
    // Execute request
    const startTime = Date.now();
    try {
      const result = await this.router.quick(prompt, options);
      const endTime = Date.now();
      
      // Update performance metrics
      this.updatePerformanceMetrics(selectedStrategy, endTime - startTime, true);
      
      return {
        ...result,
        routing: {
          strategy: selectedStrategy,
          analysis,
          decisionTime: Date.now() - analysis.timestamp.getTime()
        }
      };
    } catch (error) {
      this.updatePerformanceMetrics(selectedStrategy, Date.now() - startTime, false);
      throw error;
    }
  }
  
  updatePerformanceMetrics(strategy, latency, success) {
    if (!this.performanceMetrics.has(strategy)) {
      this.performanceMetrics.set(strategy, {
        requests: 0,
        totalLatency: 0,
        successes: 0,
        failures: 0
      });
    }
    
    const metrics = this.performanceMetrics.get(strategy);
    metrics.requests++;
    metrics.totalLatency += latency;
    
    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }
  }
  
  getRoutingInsights() {
    const insights = {
      totalRequests: this.strategyHistory.length,
      strategyUsage: {},
      performanceMetrics: {},
      recentDecisions: this.strategyHistory.slice(-10)
    };
    
    // Strategy usage statistics
    for (const record of this.strategyHistory) {
      const strategy = record.strategy;
      if (!insights.strategyUsage[strategy]) {
        insights.strategyUsage[strategy] = 0;
      }
      insights.strategyUsage[strategy]++;
    }
    
    // Performance metrics
    for (const [strategy, metrics] of this.performanceMetrics) {
      insights.performanceMetrics[strategy] = {
        requests: metrics.requests,
        avgLatency: Math.round(metrics.totalLatency / metrics.requests),
        successRate: ((metrics.successes / metrics.requests) * 100).toFixed(1) + '%'
      };
    }
    
    return insights;
  }
  
  optimizeStrategies() {
    // Analyze historical performance to suggest improvements
    const insights = this.getRoutingInsights();
    const suggestions = [];
    
    for (const [strategy, metrics] of Object.entries(insights.performanceMetrics)) {
      const successRate = parseFloat(metrics.successRate);
      const avgLatency = metrics.avgLatency;
      
      if (successRate < 90) {
        suggestions.push({
          type: 'reliability',
          strategy,
          issue: `Low success rate: ${metrics.successRate}`,
          suggestion: 'Consider adding fallback mechanisms'
        });
      }
      
      if (avgLatency > 5000) {
        suggestions.push({
          type: 'performance',
          strategy,
          issue: `High latency: ${avgLatency}ms`,
          suggestion: 'Review model selection criteria'
        });
      }
    }
    
    return {
      insights,
      suggestions
    };
  }
}

// Usage example
async function demonstrateDynamicRouting() {
  const dynamicRouter = new DynamicRoutingManager();
  await dynamicRouter.initialize();
  
  // Test scenarios with different contexts
  const testScenarios = [
    {
      prompt: "I need a quick answer: What's 2+2?",
      description: "Urgent simple question"
    },
    {
      prompt: "Please provide a comprehensive analysis of machine learning algorithms, comparing their strengths and weaknesses in detail",
      description: "Complex analytical request"
    },
    {
      prompt: "Give me a budget-friendly solution for data storage",
      description: "Cost-sensitive request"
    },
    {
      prompt: "Explain artificial intelligence in simple terms",
      description: "Standard request"
    },
    {
      prompt: "URGENT: How do I fix a server crash immediately?",
      description: "Emergency technical request"
    }
  ];
  
  console.log('🎯 Dynamic Routing Demonstration:\n');
  
  for (const scenario of testScenarios) {
    console.log(`--- ${scenario.description.toUpperCase()} ---`);
    console.log(`Prompt: "${scenario.prompt}"`);
    
    try {
      const result = await dynamicRouter.smartRoute(scenario.prompt, {
        maxTokens: 100,
        temperature: 0.7
      });
      
      console.log(`Response: ${result.text.substring(0, 100)}...`);
      console.log(`Model: ${result.model}`);
      console.log(`Decision Time: ${result.routing.decisionTime}ms`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
    }
  }
  
  // Show routing insights
  console.log('📊 Routing Insights:');
  const optimization = dynamicRouter.optimizeStrategies();
  console.log(JSON.stringify(optimization, null, 2));
}

demonstrateDynamicRouting().catch(console.error);
```

## Performance-Based Routing

### Adaptive Performance Routing

```javascript
class PerformanceBasedRouter {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'custom',
      logLevel: 'info'
    });
    
    this.performanceTracker = new Map();
    this.loadBalancer = new Map();
    this.benchmarkResults = new Map();
    
    this.setupPerformanceMonitoring();
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load models with performance tracking
    const models = [
      'models/model-a.gguf',
      'models/model-b.gguf', 
      'models/model-c.gguf'
    ];
    
    for (const modelPath of models) {
      const model = await this.router.load(modelPath);
      this.initializeModelTracking(model.id);
    }
    
    // Run initial benchmarks
    await this.runBenchmarkSuite();
    
    console.log('⚡ Performance-based router initialized');
  }
  
  setupPerformanceMonitoring() {
    // Register performance-based routing strategy
    this.router.addCustomStrategy('performance-adaptive', (models, context) => {
      return this.selectModelByPerformance(models, context);
    });
    
    this.router.setStrategy('performance-adaptive');
  }
  
  initializeModelTracking(modelId) {
    this.performanceTracker.set(modelId, {
      totalRequests: 0,
      totalLatency: 0,
      totalTokens: 0,
      errors: 0,
      avgLatency: 0,
      tokensPerSecond: 0,
      errorRate: 0,
      recentLatencies: [],
      currentLoad: 0,
      qualityScore: 0,
      lastBenchmark: null
    });
    
    this.loadBalancer.set(modelId, {
      activeRequests: 0,
      queuedRequests: 0,
      lastUsed: new Date(0)
    });
  }
  
  async runBenchmarkSuite() {
    console.log('🏃 Running performance benchmarks...');
    
    const benchmarkPrompts = [
      "What is artificial intelligence?",
      "Explain quantum computing",
      "Write a short poem about technology",
      "Calculate the square root of 144",
      "Describe the process of photosynthesis"
    ];
    
    const models = Array.from(this.performanceTracker.keys());
    
    for (const modelId of models) {
      console.log(`  Benchmarking ${modelId}...`);
      
      const results = {
        latencies: [],
        tokenCounts: [],
        qualityScores: [],
        errors: 0
      };
      
      for (const prompt of benchmarkPrompts) {
        try {
          const startTime = Date.now();
          
          // Force use specific model for benchmark
          const result = await this.router.advanced({
            prompt,
            model: modelId,
            maxTokens: 100,
            temperature: 0.7
          });
          
          const latency = Date.now() - startTime;
          results.latencies.push(latency);
          results.tokenCounts.push(result.tokens);
          
          // Simple quality assessment based on response length and coherence
          const qualityScore = this.assessResponseQuality(result.text, prompt);
          results.qualityScores.push(qualityScore);
          
        } catch (error) {
          results.errors++;
          console.log(`    ❌ Benchmark error: ${error.message}`);
        }
      }
      
      // Calculate benchmark metrics
      if (results.latencies.length > 0) {
        const avgLatency = results.latencies.reduce((sum, lat) => sum + lat, 0) / results.latencies.length;
        const avgTokens = results.tokenCounts.reduce((sum, tokens) => sum + tokens, 0) / results.tokenCounts.length;
        const avgQuality = results.qualityScores.reduce((sum, score) => sum + score, 0) / results.qualityScores.length;
        const tokensPerSecond = (avgTokens / avgLatency) * 1000;
        
        this.benchmarkResults.set(modelId, {
          avgLatency,
          avgTokens,
          avgQuality,
          tokensPerSecond,
          errorRate: results.errors / benchmarkPrompts.length,
          benchmarkDate: new Date()
        });
        
        console.log(`    ✅ ${modelId}: ${avgLatency.toFixed(0)}ms avg, ${tokensPerSecond.toFixed(1)} tok/s, quality: ${avgQuality.toFixed(2)}`);
      }
    }
    
    console.log('✅ Benchmarks complete\n');
  }
  
  assessResponseQuality(response, prompt) {
    // Simple quality assessment - in practice, you'd use more sophisticated methods
    let score = 0.5; // Base score
    
    // Length appropriateness
    if (response.length > 50 && response.length < 500) score += 0.2;
    if (response.length > 100) score += 0.1;
    
    // Basic coherence checks
    if (response.includes('.') || response.includes('!') || response.includes('?')) score += 0.1;
    if (!response.includes('undefined') && !response.includes('error')) score += 0.1;
    
    // Relevance to prompt (simple keyword matching)
    const promptWords = prompt.toLowerCase().split(/\s+/);
    const responseWords = response.toLowerCase().split(/\s+/);
    const commonWords = promptWords.filter(word => responseWords.includes(word));
    if (commonWords.length > 0) score += Math.min(0.1, commonWords.length * 0.02);
    
    return Math.min(score, 1.0);
  }
  
  selectModelByPerformance(models, context) {
    const prompt = context.prompt;
    const options = context.options || {};
    
    // Calculate scores for each model
    const modelScores = models.map(model => {
      const perf = this.performanceTracker.get(model.id);
      const load = this.loadBalancer.get(model.id);
      const benchmark = this.benchmarkResults.get(model.id);
      
      if (!perf || !load || !benchmark) {
        return { model, score: 0 };
      }
      
      // Performance factors
      const latencyScore = Math.max(0, 1 - (benchmark.avgLatency / 5000)); // Normalize to 5s max
      const qualityScore = benchmark.avgQuality;
      const speedScore = Math.min(1, benchmark.tokensPerSecond / 50); // Normalize to 50 tok/s max
      const reliabilityScore = 1 - benchmark.errorRate;
      
      // Load factors
      const loadScore = Math.max(0, 1 - (load.activeRequests / 10)); // Normalize to 10 concurrent max
      
      // Recency factor (prefer recently used models for warm caches)
      const timeSinceLastUse = Date.now() - load.lastUsed.getTime();
      const recencyScore = timeSinceLastUse < 60000 ? 0.1 : 0; // Bonus for recent use
      
      // Weight factors based on context
      let weightedScore;
      
      if (options.prioritize === 'speed') {
        weightedScore = (speedScore * 0.4) + (latencyScore * 0.3) + (loadScore * 0.2) + (reliabilityScore * 0.1);
      } else if (options.prioritize === 'quality') {
        weightedScore = (qualityScore * 0.5) + (reliabilityScore * 0.2) + (latencyScore * 0.2) + (loadScore * 0.1);
      } else {
        // Balanced approach
        weightedScore = (qualityScore * 0.25) + (latencyScore * 0.25) + (speedScore * 0.2) + (reliabilityScore * 0.2) + (loadScore * 0.1);
      }
      
      weightedScore += recencyScore;
      
      return { model, score: weightedScore };
    });
    
    // Select model with highest score
    modelScores.sort((a, b) => b.score - a.score);
    
    console.log(`🎯 Model selection scores:`);
    modelScores.forEach(({ model, score }) => {
      console.log(`   ${model.id}: ${score.toFixed(3)}`);
    });
    
    return modelScores[0].model;
  }
  
  async executeWithTracking(prompt, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.router.quick(prompt, options);
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update performance tracking
      this.updatePerformanceMetrics(result.model, latency, result.tokens, true);
      
      return {
        ...result,
        performance: {
          latency,
          tokensPerSecond: (result.tokens / latency) * 1000
        }
      };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      
      // Try to determine which model was attempted
      const models = Array.from(this.performanceTracker.keys());
      if (models.length > 0) {
        this.updatePerformanceMetrics(models[0], latency, 0, false);
      }
      
      throw error;
    }
  }
  
  updatePerformanceMetrics(modelId, latency, tokens, success) {
    const perf = this.performanceTracker.get(modelId);
    const load = this.loadBalancer.get(modelId);
    
    if (!perf || !load) return;
    
    // Update performance metrics
    perf.totalRequests++;
    perf.totalLatency += latency;
    perf.totalTokens += tokens;
    
    if (!success) {
      perf.errors++;
    }
    
    // Calculate running averages
    perf.avgLatency = perf.totalLatency / perf.totalRequests;
    perf.tokensPerSecond = perf.totalLatency > 0 ? (perf.totalTokens / perf.totalLatency) * 1000 : 0;
    perf.errorRate = perf.errors / perf.totalRequests;
    
    // Update recent latencies (keep last 10)
    perf.recentLatencies.push(latency);
    if (perf.recentLatencies.length > 10) {
      perf.recentLatencies.shift();
    }
    
    // Update load tracking
    load.lastUsed = new Date();
  }
  
  getPerformanceReport() {
    const report = {
      timestamp: new Date(),
      models: {},
      recommendations: []
    };
    
    for (const [modelId, perf] of this.performanceTracker) {
      const benchmark = this.benchmarkResults.get(modelId);
      const load = this.loadBalancer.get(modelId);
      
      report.models[modelId] = {
        performance: {
          totalRequests: perf.totalRequests,
          avgLatency: Math.round(perf.avgLatency),
          tokensPerSecond: perf.tokensPerSecond.toFixed(1),
          errorRate: (perf.errorRate * 100).toFixed(1) + '%'
        },
        benchmark: benchmark ? {
          avgLatency: Math.round(benchmark.avgLatency),
          avgQuality: benchmark.avgQuality.toFixed(2),
          tokensPerSecond: benchmark.tokensPerSecond.toFixed(1)
        } : null,
        load: load ? {
          activeRequests: load.activeRequests,
          lastUsed: load.lastUsed
        } : null
      };
      
      // Generate recommendations
      if (perf.errorRate > 0.1) {
        report.recommendations.push({
          type: 'reliability',
          model: modelId,
          issue: `High error rate: ${(perf.errorRate * 100).toFixed(1)}%`,
          suggestion: 'Consider model replacement or debugging'
        });
      }
      
      if (perf.avgLatency > 3000) {
        report.recommendations.push({
          type: 'performance',
          model: modelId,
          issue: `High latency: ${Math.round(perf.avgLatency)}ms`,
          suggestion: 'Optimize model or infrastructure'
        });
      }
      
      if (benchmark && benchmark.avgQuality < 0.5) {
        report.recommendations.push({
          type: 'quality',
          model: modelId,
          issue: `Low quality score: ${benchmark.avgQuality.toFixed(2)}`,
          suggestion: 'Review model training or parameters'
        });
      }
    }
    
    return report;
  }
  
  async adaptiveRebenchmark() {
    console.log('🔄 Running adaptive rebenchmark...');
    
    // Only rebenchmark models that need it
    const modelsToRebenchmark = [];
    
    for (const [modelId, perf] of this.performanceTracker) {
      const benchmark = this.benchmarkResults.get(modelId);
      
      if (!benchmark || 
          Date.now() - benchmark.benchmarkDate.getTime() > 3600000 || // 1 hour old
          perf.totalRequests > 100) { // High usage models
        modelsToRebenchmark.push(modelId);
      }
    }
    
    if (modelsToRebenchmark.length > 0) {
      console.log(`  Rebenchmarking ${modelsToRebenchmark.length} models...`);
      await this.runBenchmarkSuite();
    } else {
      console.log('  No models need rebenchmarking');
    }
  }
}

// Usage example
async function demonstratePerformanceRouting() {
  const perfRouter = new PerformanceBasedRouter();
  await perfRouter.initialize();
  
  // Test different types of requests
  const testRequests = [
    { prompt: "Quick math: 5 + 7 = ?", options: { prioritize: 'speed' } },
    { prompt: "Write a detailed analysis of renewable energy technologies", options: { prioritize: 'quality' } },
    { prompt: "Explain machine learning", options: {} },
    { prompt: "What's the weather like?", options: { prioritize: 'speed' } },
    { prompt: "Compose a thoughtful essay on artificial intelligence ethics", options: { prioritize: 'quality' } }
  ];
  
  console.log('⚡ Performance-Based Routing Test:\n');
  
  for (const [index, request] of testRequests.entries()) {
    console.log(`--- Request ${index + 1}: ${request.options.prioritize || 'balanced'} ---`);
    console.log(`Prompt: "${request.prompt}"`);
    
    try {
      const result = await perfRouter.executeWithTracking(request.prompt, {
        ...request.options,
        maxTokens: 100,
        temperature: 0.7
      });
      
      console.log(`Selected: ${result.model}`);
      console.log(`Latency: ${result.performance.latency}ms`);
      console.log(`Speed: ${result.performance.tokensPerSecond.toFixed(1)} tokens/sec`);
      console.log(`Response: ${result.text.substring(0, 100)}...`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
    }
  }
  
  // Show performance report
  console.log('📊 Performance Report:');
  const report = perfRouter.getPerformanceReport();
  console.log(JSON.stringify(report, null, 2));
  
  // Run adaptive rebenchmark
  await perfRouter.adaptiveRebenchmark();
}

demonstratePerformanceRouting().catch(console.error);
```

This comprehensive custom routing examples guide covers all aspects of intelligent model selection, from basic strategies to sophisticated performance-based adaptive systems that learn and optimize over time.