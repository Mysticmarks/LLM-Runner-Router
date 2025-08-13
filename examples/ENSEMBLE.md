# Model Ensemble Examples

This guide demonstrates advanced model ensemble techniques using the LLM-Runner-Router system. Learn how to combine multiple models for improved accuracy, robustness, and specialized capabilities.

## Table of Contents
- [Basic Ensemble Operations](#basic-ensemble-operations)
- [Weighted Ensemble Strategies](#weighted-ensemble-strategies)
- [Specialized Ensemble Types](#specialized-ensemble-types)
- [Dynamic Ensemble Selection](#dynamic-ensemble-selection)
- [Ensemble Optimization](#ensemble-optimization)
- [Production Ensemble Systems](#production-ensemble-systems)

## Basic Ensemble Operations

### Simple Model Ensemble

```javascript
import LLMRouter from 'llm-runner-router';

class BasicEnsembleSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.ensembleHistory = [];
    this.modelMetrics = new Map();
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load multiple models for ensemble
    const models = [
      { path: 'models/general-model.gguf', specialty: 'general' },
      { path: 'models/creative-model.gguf', specialty: 'creative' },
      { path: 'models/analytical-model.gguf', specialty: 'analytical' }
    ];
    
    for (const model of models) {
      const loadedModel = await this.router.load(model.path);
      this.modelMetrics.set(loadedModel.id, {
        specialty: model.specialty,
        requests: 0,
        avgLatency: 0,
        avgQuality: 0.5,
        reliability: 1.0
      });
    }
    
    console.log('🎭 Basic ensemble system initialized');
  }
  
  async simpleEnsemble(prompt, options = {}) {
    console.log(`🎭 Running simple ensemble for: "${prompt.substring(0, 50)}..."`);
    
    // Get all available models
    const models = Array.from(this.modelMetrics.keys());
    
    // Define ensemble configuration
    const ensembleConfig = models.map(modelId => ({
      model: modelId,
      weight: 1.0 / models.length // Equal weights
    }));
    
    console.log(`📊 Ensemble models: ${models.join(', ')}`);
    
    // Execute ensemble
    const startTime = Date.now();
    const result = await this.router.ensemble(ensembleConfig, prompt, options);
    const totalTime = Date.now() - startTime;
    
    // Record ensemble execution
    this.ensembleHistory.push({
      prompt: prompt.substring(0, 100),
      models: models,
      result: result.text.substring(0, 200),
      timestamp: new Date(),
      totalTime
    });
    
    return {
      ...result,
      ensembleInfo: {
        modelsUsed: models,
        totalTime,
        strategy: 'simple-equal-weight'
      }
    };
  }
  
  async votingEnsemble(prompt, options = {}) {
    console.log(`🗳️ Running voting ensemble for: "${prompt.substring(0, 50)}..."`);
    
    const models = Array.from(this.modelMetrics.keys());
    const responses = [];
    
    // Collect responses from all models
    for (const modelId of models) {
      try {
        const startTime = Date.now();
        const response = await this.router.advanced({
          prompt,
          model: modelId,
          ...options
        });
        const latency = Date.now() - startTime;
        
        responses.push({
          modelId,
          text: response.text,
          tokens: response.tokens,
          latency,
          quality: this.estimateQuality(response.text, prompt)
        });
        
        // Update model metrics
        this.updateModelMetrics(modelId, latency, response.tokens);
        
      } catch (error) {
        console.error(`❌ Model ${modelId} failed:`, error.message);
        responses.push({
          modelId,
          error: error.message,
          failed: true
        });
      }
    }
    
    // Analyze responses and select best
    const validResponses = responses.filter(r => !r.failed);
    
    if (validResponses.length === 0) {
      throw new Error('All models failed in ensemble');
    }
    
    // Voting strategies
    const votingResult = this.performVoting(validResponses, prompt);
    
    return {
      text: votingResult.selectedResponse.text,
      model: 'ensemble-voting',
      tokens: votingResult.selectedResponse.tokens,
      latency: votingResult.totalLatency,
      ensembleInfo: {
        strategy: 'voting',
        responses: validResponses,
        votingDetails: votingResult.votingDetails,
        confidence: votingResult.confidence
      }
    };
  }
  
  performVoting(responses, prompt) {
    const votingDetails = {
      qualityVote: null,
      lengthVote: null,
      speedVote: null,
      consensus: null
    };
    
    // Quality-based voting
    const sortedByQuality = [...responses].sort((a, b) => b.quality - a.quality);
    votingDetails.qualityVote = sortedByQuality[0];
    
    // Length-based voting (appropriate length for prompt)
    const targetLength = this.estimateTargetLength(prompt);
    const sortedByLength = [...responses].sort((a, b) => 
      Math.abs(a.text.length - targetLength) - Math.abs(b.text.length - targetLength)
    );
    votingDetails.lengthVote = sortedByLength[0];
    
    // Speed-based voting
    const sortedBySpeed = [...responses].sort((a, b) => a.latency - b.latency);
    votingDetails.speedVote = sortedBySpeed[0];
    
    // Consensus analysis
    const votes = {};
    [votingDetails.qualityVote, votingDetails.lengthVote, votingDetails.speedVote].forEach(vote => {
      votes[vote.modelId] = (votes[vote.modelId] || 0) + 1;
    });
    
    // Find model with most votes
    const consensusModel = Object.entries(votes).reduce((a, b) => votes[a[0]] > votes[b[0]] ? a : b)[0];
    votingDetails.consensus = responses.find(r => r.modelId === consensusModel);
    
    // Calculate confidence based on vote distribution
    const maxVotes = Math.max(...Object.values(votes));
    const confidence = maxVotes / 3; // Out of 3 possible votes
    
    return {
      selectedResponse: votingDetails.consensus,
      totalLatency: Math.max(...responses.map(r => r.latency)),
      votingDetails,
      confidence
    };
  }
  
  estimateQuality(text, prompt) {
    let quality = 0.5;
    
    // Length appropriateness
    if (text.length > 50 && text.length < 1000) quality += 0.2;
    
    // Basic coherence indicators
    if (text.includes('.') || text.includes('!')) quality += 0.1;
    if (!text.includes('undefined') && !text.includes('error')) quality += 0.1;
    
    // Relevance to prompt (simple keyword matching)
    const promptWords = prompt.toLowerCase().split(/\s+/);
    const responseWords = text.toLowerCase().split(/\s+/);
    const overlap = promptWords.filter(word => responseWords.includes(word)).length;
    quality += Math.min(0.2, overlap * 0.02);
    
    return Math.min(quality, 1.0);
  }
  
  estimateTargetLength(prompt) {
    // Simple heuristic for target response length
    if (prompt.includes('explain') || prompt.includes('describe')) return 300;
    if (prompt.includes('list') || prompt.includes('name')) return 150;
    if (prompt.includes('what is') || prompt.includes('define')) return 200;
    return 250; // Default
  }
  
  updateModelMetrics(modelId, latency, tokens) {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return;
    
    metrics.requests++;
    metrics.avgLatency = ((metrics.avgLatency * (metrics.requests - 1)) + latency) / metrics.requests;
  }
  
  getEnsembleStats() {
    return {
      totalEnsembles: this.ensembleHistory.length,
      models: Array.from(this.modelMetrics.entries()).map(([id, metrics]) => ({
        id,
        ...metrics
      })),
      recentEnsembles: this.ensembleHistory.slice(-5)
    };
  }
}

// Usage example
async function demonstrateBasicEnsemble() {
  const ensemble = new BasicEnsembleSystem();
  await ensemble.initialize();
  
  const testPrompts = [
    "Explain the concept of machine learning",
    "Write a creative story about robots",
    "Calculate the area of a circle with radius 5"
  ];
  
  console.log('🎭 Testing Basic Ensemble Operations:\n');
  
  for (const [index, prompt] of testPrompts.entries()) {
    console.log(`--- Test ${index + 1}: Simple Ensemble ---`);
    
    const simpleResult = await ensemble.simpleEnsemble(prompt, {
      maxTokens: 150,
      temperature: 0.7
    });
    
    console.log(`Prompt: "${prompt}"`);
    console.log(`Models Used: ${simpleResult.ensembleInfo.modelsUsed.join(', ')}`);
    console.log(`Total Time: ${simpleResult.ensembleInfo.totalTime}ms`);
    console.log(`Response: ${simpleResult.text.substring(0, 100)}...`);
    console.log('');
    
    console.log(`--- Test ${index + 1}: Voting Ensemble ---`);
    
    const votingResult = await ensemble.votingEnsemble(prompt, {
      maxTokens: 150,
      temperature: 0.7
    });
    
    console.log(`Voting Winner: ${votingResult.ensembleInfo.votingDetails.consensus.modelId}`);
    console.log(`Confidence: ${(votingResult.ensembleInfo.confidence * 100).toFixed(1)}%`);
    console.log(`Response: ${votingResult.text.substring(0, 100)}...`);
    console.log(`Vote Details:`, {
      quality: votingResult.ensembleInfo.votingDetails.qualityVote.modelId,
      length: votingResult.ensembleInfo.votingDetails.lengthVote.modelId,
      speed: votingResult.ensembleInfo.votingDetails.speedVote.modelId
    });
    console.log('');
  }
  
  console.log('📊 Ensemble Statistics:');
  console.log(JSON.stringify(ensemble.getEnsembleStats(), null, 2));
}

demonstrateBasicEnsemble().catch(console.error);
```

## Weighted Ensemble Strategies

### Adaptive Weighted Ensemble

```javascript
class WeightedEnsembleSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.modelWeights = new Map();
    this.performanceHistory = new Map();
    this.ensembleStrategies = new Map();
    
    this.setupWeightingStrategies();
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load models with initial weights
    const modelConfigs = [
      { path: 'models/fast-model.gguf', initialWeight: 0.3, strength: 'speed' },
      { path: 'models/quality-model.gguf', initialWeight: 0.4, strength: 'quality' },
      { path: 'models/creative-model.gguf', initialWeight: 0.3, strength: 'creativity' }
    ];
    
    for (const config of modelConfigs) {
      const model = await this.router.load(config.path);
      
      this.modelWeights.set(model.id, {
        current: config.initialWeight,
        initial: config.initialWeight,
        strength: config.strength,
        performance: {
          accuracy: 0.7,
          speed: 0.5,
          consistency: 0.6
        }
      });
      
      this.performanceHistory.set(model.id, []);
    }
    
    console.log('⚖️ Weighted ensemble system initialized');
  }
  
  setupWeightingStrategies() {
    // Performance-based weighting
    this.ensembleStrategies.set('performance-weighted', (models, context) => {
      return models.map(modelId => {
        const weights = this.modelWeights.get(modelId);
        const history = this.performanceHistory.get(modelId);
        
        // Calculate dynamic weight based on recent performance
        let dynamicWeight = weights.current;
        
        if (history.length > 0) {
          const recentPerf = history.slice(-5); // Last 5 performances
          const avgQuality = recentPerf.reduce((sum, p) => sum + p.quality, 0) / recentPerf.length;
          const avgSpeed = recentPerf.reduce((sum, p) => sum + (1000 / p.latency), 0) / recentPerf.length;
          
          // Adjust weight based on performance
          dynamicWeight *= (0.5 + avgQuality) * (0.5 + avgSpeed / 10);
          dynamicWeight = Math.max(0.1, Math.min(1.0, dynamicWeight));
        }
        
        return { model: modelId, weight: dynamicWeight };
      });
    });
    
    // Context-aware weighting
    this.ensembleStrategies.set('context-aware', (models, context) => {
      const prompt = context.prompt.toLowerCase();
      
      return models.map(modelId => {
        const weights = this.modelWeights.get(modelId);
        let contextWeight = weights.current;
        
        // Adjust based on prompt characteristics
        if (prompt.includes('creative') || prompt.includes('story') || prompt.includes('poem')) {
          if (weights.strength === 'creativity') contextWeight *= 1.5;
        } else if (prompt.includes('fast') || prompt.includes('quick') || prompt.includes('briefly')) {
          if (weights.strength === 'speed') contextWeight *= 1.5;
        } else if (prompt.includes('detailed') || prompt.includes('analysis') || prompt.includes('explain')) {
          if (weights.strength === 'quality') contextWeight *= 1.5;
        }
        
        return { model: modelId, weight: Math.min(1.0, contextWeight) };
      });
    });
    
    // Diversity-maximizing weighting
    this.ensembleStrategies.set('diversity-maximizing', (models, context) => {
      // Try to balance model types for maximum diversity
      const strengthCounts = {};
      models.forEach(modelId => {
        const strength = this.modelWeights.get(modelId).strength;
        strengthCounts[strength] = (strengthCounts[strength] || 0) + 1;
      });
      
      return models.map(modelId => {
        const weights = this.modelWeights.get(modelId);
        const strengthCount = strengthCounts[weights.strength];
        
        // Boost underrepresented strengths
        const diversityBoost = 1.0 / strengthCount;
        const finalWeight = weights.current * diversityBoost;
        
        return { model: modelId, weight: finalWeight };
      });
    });
  }
  
  async weightedEnsemble(prompt, strategy = 'performance-weighted', options = {}) {
    console.log(`⚖️ Running ${strategy} ensemble for: "${prompt.substring(0, 50)}..."`);
    
    const models = Array.from(this.modelWeights.keys());
    const context = { prompt, options };
    
    // Get weighted configuration
    let ensembleConfig;
    if (this.ensembleStrategies.has(strategy)) {
      ensembleConfig = this.ensembleStrategies.get(strategy)(models, context);
    } else {
      // Default equal weighting
      ensembleConfig = models.map(modelId => ({
        model: modelId,
        weight: 1.0 / models.length
      }));
    }
    
    // Normalize weights
    const totalWeight = ensembleConfig.reduce((sum, config) => sum + config.weight, 0);
    ensembleConfig.forEach(config => {
      config.weight = config.weight / totalWeight;
    });
    
    console.log(`📊 Model weights:`, ensembleConfig.map(c => 
      `${c.model}: ${(c.weight * 100).toFixed(1)}%`
    ).join(', '));
    
    // Execute weighted ensemble
    const startTime = Date.now();
    const individualResults = await Promise.all(
      ensembleConfig.map(async (config) => {
        try {
          const modelStartTime = Date.now();
          const result = await this.router.advanced({
            prompt,
            model: config.model,
            ...options
          });
          const latency = Date.now() - modelStartTime;
          
          return {
            modelId: config.model,
            weight: config.weight,
            result,
            latency,
            quality: this.assessQuality(result.text, prompt),
            success: true
          };
        } catch (error) {
          console.error(`❌ Model ${config.model} failed:`, error.message);
          return {
            modelId: config.model,
            weight: config.weight,
            error: error.message,
            success: false
          };
        }
      })
    );
    
    const totalTime = Date.now() - startTime;
    
    // Filter successful results
    const successfulResults = individualResults.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('All models failed in weighted ensemble');
    }
    
    // Combine results using weights
    const combinedResult = this.combineWeightedResults(successfulResults, strategy);
    
    // Update performance history
    successfulResults.forEach(result => {
      this.updatePerformanceHistory(result.modelId, result.latency, result.quality);
    });
    
    // Adapt weights based on performance
    if (strategy === 'performance-weighted') {
      this.adaptWeights(successfulResults);
    }
    
    return {
      text: combinedResult.text,
      model: 'weighted-ensemble',
      tokens: combinedResult.tokens,
      latency: totalTime,
      ensembleInfo: {
        strategy,
        modelResults: successfulResults.map(r => ({
          modelId: r.modelId,
          weight: r.weight,
          quality: r.quality,
          latency: r.latency
        })),
        combinationMethod: combinedResult.method,
        weightDistribution: ensembleConfig
      }
    };
  }
  
  combineWeightedResults(results, strategy) {
    // Different combination methods based on strategy
    if (strategy === 'diversity-maximizing') {
      // Use the most diverse combination
      return this.combineDiverseResults(results);
    } else {
      // Use weighted voting/selection
      return this.combineByWeight(results);
    }
  }
  
  combineByWeight(results) {
    // Select result based on weighted quality scores
    const weightedScores = results.map(r => ({
      ...r,
      weightedScore: r.quality * r.weight * (1000 / r.latency) // Factor in speed
    }));
    
    weightedScores.sort((a, b) => b.weightedScore - a.weightedScore);
    const winner = weightedScores[0];
    
    return {
      text: winner.result.text,
      tokens: winner.result.tokens,
      method: 'weighted-selection',
      selectedModel: winner.modelId,
      score: winner.weightedScore
    };
  }
  
  combineDiverseResults(results) {
    // Combine insights from different models
    const segments = results.map(r => ({
      text: r.result.text,
      weight: r.weight,
      modelId: r.modelId
    }));
    
    // Simple combination: take best segments weighted by quality
    const sortedByQuality = segments.sort((a, b) => 
      (results.find(r => r.modelId === b.modelId).quality * b.weight) - 
      (results.find(r => r.modelId === a.modelId).quality * a.weight)
    );
    
    const combinedText = sortedByQuality[0].text; // For simplicity, take the best
    const totalTokens = results.reduce((sum, r) => sum + r.result.tokens, 0);
    
    return {
      text: combinedText,
      tokens: totalTokens / results.length,
      method: 'diversity-combination',
      contributors: segments.map(s => s.modelId)
    };
  }
  
  assessQuality(text, prompt) {
    let quality = 0.5;
    
    // Length appropriateness
    const targetLength = this.estimateTargetLength(prompt);
    const lengthScore = 1 - Math.abs(text.length - targetLength) / targetLength;
    quality += Math.max(0, lengthScore) * 0.2;
    
    // Content quality indicators
    if (text.includes('.') && text.length > 20) quality += 0.1;
    if (!text.includes('error') && !text.includes('undefined')) quality += 0.1;
    
    // Coherence (simple check)
    const sentences = text.split('.').length;
    if (sentences > 1 && sentences < 10) quality += 0.1;
    
    // Prompt relevance
    const promptWords = prompt.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);
    const relevance = promptWords.filter(word => textWords.includes(word)).length / promptWords.length;
    quality += relevance * 0.1;
    
    return Math.min(1.0, quality);
  }
  
  estimateTargetLength(prompt) {
    if (prompt.includes('detailed') || prompt.includes('explain')) return 400;
    if (prompt.includes('brief') || prompt.includes('short')) return 100;
    if (prompt.includes('list')) return 200;
    return 250;
  }
  
  updatePerformanceHistory(modelId, latency, quality) {
    const history = this.performanceHistory.get(modelId);
    history.push({
      timestamp: Date.now(),
      latency,
      quality,
      speed: 1000 / latency // tokens per second approximation
    });
    
    // Keep only recent history
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }
  
  adaptWeights(results) {
    // Adapt model weights based on performance
    results.forEach(result => {
      const weights = this.modelWeights.get(result.modelId);
      const history = this.performanceHistory.get(result.modelId);
      
      if (history.length >= 3) {
        const recent = history.slice(-3);
        const avgQuality = recent.reduce((sum, h) => sum + h.quality, 0) / recent.length;
        const avgSpeed = recent.reduce((sum, h) => sum + h.speed, 0) / recent.length;
        
        // Adjust weight based on performance
        const performanceScore = (avgQuality * 0.7) + (avgSpeed / 50 * 0.3); // Normalize speed
        const adjustment = (performanceScore - 0.5) * 0.1; // Small adjustments
        
        weights.current = Math.max(0.1, Math.min(1.0, weights.current + adjustment));
        
        console.log(`📈 Adapted weight for ${result.modelId}: ${weights.current.toFixed(3)} (perf: ${performanceScore.toFixed(3)})`);
      }
    });
  }
  
  getWeightingAnalysis() {
    const analysis = {
      currentWeights: {},
      weightEvolution: {},
      performanceTrends: {}
    };
    
    for (const [modelId, weights] of this.modelWeights) {
      analysis.currentWeights[modelId] = {
        current: weights.current.toFixed(3),
        initial: weights.initial.toFixed(3),
        change: ((weights.current - weights.initial) / weights.initial * 100).toFixed(1) + '%',
        strength: weights.strength
      };
      
      const history = this.performanceHistory.get(modelId);
      if (history.length > 0) {
        const recent = history.slice(-5);
        analysis.performanceTrends[modelId] = {
          avgQuality: (recent.reduce((sum, h) => sum + h.quality, 0) / recent.length).toFixed(3),
          avgLatency: Math.round(recent.reduce((sum, h) => sum + h.latency, 0) / recent.length),
          trend: history.length > 5 ? this.calculateTrend(history) : 'insufficient-data'
        };
      }
    }
    
    return analysis;
  }
  
  calculateTrend(history) {
    if (history.length < 5) return 'insufficient-data';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    if (older.length === 0) return 'insufficient-data';
    
    const recentAvg = recent.reduce((sum, h) => sum + h.quality, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.quality, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }
}

// Usage example
async function demonstrateWeightedEnsemble() {
  const weightedEnsemble = new WeightedEnsembleSystem();
  await weightedEnsemble.initialize();
  
  const testScenarios = [
    {
      prompt: "Write a creative story about time travel",
      expectedWinner: 'creativity',
      strategy: 'context-aware'
    },
    {
      prompt: "Quickly calculate 15 * 23",
      expectedWinner: 'speed',
      strategy: 'context-aware'
    },
    {
      prompt: "Provide a detailed analysis of renewable energy",
      expectedWinner: 'quality',
      strategy: 'context-aware'
    }
  ];
  
  console.log('⚖️ Testing Weighted Ensemble Strategies:\n');
  
  for (const [index, scenario] of testScenarios.entries()) {
    console.log(`--- Scenario ${index + 1}: ${scenario.strategy} ---`);
    
    const result = await weightedEnsemble.weightedEnsemble(
      scenario.prompt,
      scenario.strategy,
      { maxTokens: 150, temperature: 0.7 }
    );
    
    console.log(`Prompt: "${scenario.prompt}"`);
    console.log(`Expected Winner: ${scenario.expectedWinner}`);
    console.log(`Strategy: ${scenario.strategy}`);
    console.log(`Total Time: ${result.latency}ms`);
    console.log(`Weight Distribution:`, result.ensembleInfo.weightDistribution.map(w => 
      `${w.model}: ${(w.weight * 100).toFixed(1)}%`
    ).join(', '));
    
    if (result.ensembleInfo.combinationMethod === 'weighted-selection') {
      console.log(`Selected Model: ${result.ensembleInfo.selectedModel || 'N/A'}`);
    }
    
    console.log(`Response: ${result.text.substring(0, 150)}...`);
    console.log('');
  }
  
  // Test performance-weighted strategy multiple times to see adaptation
  console.log('📈 Testing Performance Adaptation:');
  
  for (let i = 0; i < 5; i++) {
    console.log(`\\n--- Adaptation Round ${i + 1} ---`);
    
    await weightedEnsemble.weightedEnsemble(
      "Explain machine learning concepts",
      'performance-weighted',
      { maxTokens: 100, temperature: 0.7 }
    );
    
    const analysis = weightedEnsemble.getWeightingAnalysis();
    console.log('Current Weights:', analysis.currentWeights);
  }
  
  console.log('\\n📊 Final Weighting Analysis:');
  const finalAnalysis = weightedEnsemble.getWeightingAnalysis();
  console.log(JSON.stringify(finalAnalysis, null, 2));
}

demonstrateWeightedEnsemble().catch(console.error);
```

## Specialized Ensemble Types

### Task-Specific Ensemble Strategies

```javascript
class SpecializedEnsembleSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.specializedEnsembles = new Map();
    this.taskClassifiers = new Map();
    this.ensembleTemplates = new Map();
    
    this.setupSpecializedEnsembles();
  }
  
  async initialize() {
    await this.router.initialize();
    
    // Load diverse models for specialized ensembles
    const models = [
      { path: 'models/code-model.gguf', specialty: 'programming' },
      { path: 'models/math-model.gguf', specialty: 'mathematics' },
      { path: 'models/creative-model.gguf', specialty: 'creative' },
      { path: 'models/factual-model.gguf', specialty: 'factual' },
      { path: 'models/reasoning-model.gguf', specialty: 'reasoning' }
    ];
    
    for (const model of models) {
      await this.router.load(model.path);
    }
    
    console.log('🎯 Specialized ensemble system initialized');
  }
  
  setupSpecializedEnsembles() {
    // Code Review Ensemble
    this.specializedEnsembles.set('code-review', {
      models: ['code-model', 'reasoning-model', 'factual-model'],
      weights: [0.5, 0.3, 0.2],
      combination: 'consensus-review',
      phases: [
        { model: 'code-model', task: 'syntax-analysis' },
        { model: 'reasoning-model', task: 'logic-review' },
        { model: 'factual-model', task: 'best-practices' }
      ]
    });
    
    // Creative Writing Ensemble
    this.specializedEnsembles.set('creative-writing', {
      models: ['creative-model', 'reasoning-model'],
      weights: [0.7, 0.3],
      combination: 'creative-fusion',
      phases: [
        { model: 'creative-model', task: 'initial-draft' },
        { model: 'reasoning-model', task: 'structure-review' },
        { model: 'creative-model', task: 'final-polish' }
      ]
    });
    
    // Problem Solving Ensemble
    this.specializedEnsembles.set('problem-solving', {
      models: ['reasoning-model', 'math-model', 'factual-model'],
      weights: [0.4, 0.4, 0.2],
      combination: 'multi-step-reasoning',
      phases: [
        { model: 'reasoning-model', task: 'problem-decomposition' },
        { model: 'math-model', task: 'quantitative-analysis' },
        { model: 'factual-model', task: 'knowledge-integration' },
        { model: 'reasoning-model', task: 'solution-synthesis' }
      ]
    });
    
    // Research Ensemble
    this.specializedEnsembles.set('research', {
      models: ['factual-model', 'reasoning-model', 'creative-model'],
      weights: [0.5, 0.3, 0.2],
      combination: 'research-synthesis',
      phases: [
        { model: 'factual-model', task: 'fact-gathering' },
        { model: 'reasoning-model', task: 'analysis' },
        { model: 'creative-model', task: 'presentation' }
      ]
    });
    
    // Setup task classifiers
    this.taskClassifiers.set('programming', /code|program|function|algorithm|debug|syntax|javascript|python|java|c\+\+/i);
    this.taskClassifiers.set('mathematics', /calculate|equation|formula|solve|derivative|integral|algebra|geometry/i);
    this.taskClassifiers.set('creative', /story|poem|creative|imagine|write.*fiction|novel|character/i);
    this.taskClassifiers.set('research', /research|analyze|study|investigate|examine|compare.*sources/i);
    this.taskClassifiers.set('problem-solving', /problem|solution|how to solve|troubleshoot|resolve/i);
  }
  
  classifyTask(prompt) {
    const classifications = [];
    
    for (const [task, pattern] of this.taskClassifiers) {
      if (pattern.test(prompt)) {
        classifications.push(task);
      }
    }
    
    // Return most specific classification or default
    if (classifications.includes('programming')) return 'code-review';
    if (classifications.includes('mathematics')) return 'problem-solving';
    if (classifications.includes('creative')) return 'creative-writing';
    if (classifications.includes('research')) return 'research';
    if (classifications.includes('problem-solving')) return 'problem-solving';
    
    return 'general'; // Fallback to general ensemble
  }
  
  async specializedEnsemble(prompt, ensembleType = null, options = {}) {
    // Auto-classify if type not specified
    if (!ensembleType) {
      ensembleType = this.classifyTask(prompt);
    }
    
    console.log(`🎯 Running ${ensembleType} ensemble for: "${prompt.substring(0, 50)}..."`);
    
    const ensembleConfig = this.specializedEnsembles.get(ensembleType);
    
    if (!ensembleConfig) {
      throw new Error(`Unknown ensemble type: ${ensembleType}`);
    }
    
    const result = await this.executeSpecializedEnsemble(prompt, ensembleConfig, options);
    
    return {
      ...result,
      ensembleInfo: {
        type: ensembleType,
        classification: this.classifyTask(prompt),
        config: ensembleConfig
      }
    };
  }
  
  async executeSpecializedEnsemble(prompt, config, options) {
    switch (config.combination) {
      case 'consensus-review':
        return this.consensusReviewEnsemble(prompt, config, options);
      case 'creative-fusion':
        return this.creativeFusionEnsemble(prompt, config, options);
      case 'multi-step-reasoning':
        return this.multiStepReasoningEnsemble(prompt, config, options);
      case 'research-synthesis':
        return this.researchSynthesisEnsemble(prompt, config, options);
      default:
        return this.defaultSpecializedEnsemble(prompt, config, options);
    }
  }
  
  async consensusReviewEnsemble(prompt, config, options) {
    console.log('🔍 Running consensus review ensemble...');
    
    const reviews = [];
    
    // Collect reviews from each model
    for (const phase of config.phases) {
      const phasePrompt = this.adaptPromptForPhase(prompt, phase);
      
      try {
        const result = await this.router.advanced({
          prompt: phasePrompt,
          model: phase.model,
          ...options
        });
        
        reviews.push({
          phase: phase.task,
          model: phase.model,
          review: result.text,
          tokens: result.tokens
        });
        
      } catch (error) {
        console.error(`❌ Phase ${phase.task} failed:`, error.message);
        reviews.push({
          phase: phase.task,
          model: phase.model,
          error: error.message
        });
      }
    }
    
    // Synthesize consensus
    const consensus = this.synthesizeConsensus(reviews, prompt);
    
    return {
      text: consensus.summary,
      model: 'consensus-ensemble',
      tokens: reviews.reduce((sum, r) => sum + (r.tokens || 0), 0),
      latency: 0, // Calculated elsewhere
      reviews,
      consensus: consensus.details
    };
  }
  
  async creativeFusionEnsemble(prompt, config, options) {
    console.log('🎨 Running creative fusion ensemble...');
    
    const phases = config.phases;
    let currentText = '';
    const phaseResults = [];
    
    for (const [index, phase] of phases.entries()) {
      let phasePrompt;
      
      if (index === 0) {
        // Initial draft
        phasePrompt = prompt;
      } else if (phase.task === 'structure-review') {
        phasePrompt = `Review and improve the structure of this text:\\n\\n${currentText}\\n\\nProvide an improved version:`;
      } else if (phase.task === 'final-polish') {
        phasePrompt = `Polish and enhance this text for creativity and flow:\\n\\n${currentText}\\n\\nFinal version:`;
      }
      
      try {
        const result = await this.router.advanced({
          prompt: phasePrompt,
          model: phase.model,
          ...options
        });
        
        currentText = result.text;
        phaseResults.push({
          phase: phase.task,
          model: phase.model,
          result: result.text
        });
        
      } catch (error) {
        console.error(`❌ Creative phase ${phase.task} failed:`, error.message);
      }
    }
    
    return {
      text: currentText,
      model: 'creative-fusion-ensemble',
      tokens: phaseResults.reduce((sum, p) => sum + (p.result?.length || 0) / 4, 0), // Rough token estimate
      phases: phaseResults
    };
  }
  
  async multiStepReasoningEnsemble(prompt, config, options) {
    console.log('🧠 Running multi-step reasoning ensemble...');
    
    const reasoningSteps = [];
    let context = prompt;
    
    for (const phase of config.phases) {
      const phasePrompt = this.adaptReasoningPrompt(context, phase);
      
      try {
        const result = await this.router.advanced({
          prompt: phasePrompt,
          model: phase.model,
          ...options
        });
        
        reasoningSteps.push({
          step: phase.task,
          model: phase.model,
          reasoning: result.text,
          input: context
        });
        
        // Update context for next step
        context = `Previous analysis: ${result.text}\\n\\nOriginal problem: ${prompt}`;
        
      } catch (error) {
        console.error(`❌ Reasoning step ${phase.task} failed:`, error.message);
      }
    }
    
    // Final synthesis
    const finalSynthesis = await this.synthesizeReasoning(reasoningSteps, prompt, options);
    
    return {
      text: finalSynthesis,
      model: 'multi-step-reasoning-ensemble',
      reasoningSteps,
      tokens: reasoningSteps.reduce((sum, s) => sum + (s.reasoning?.length || 0) / 4, 0)
    };
  }
  
  async researchSynthesisEnsemble(prompt, config, options) {
    console.log('📚 Running research synthesis ensemble...');
    
    const researchPhases = [];
    
    // Fact gathering phase
    const factPrompt = `Gather relevant facts and information about: ${prompt}`;
    const facts = await this.router.advanced({
      prompt: factPrompt,
      model: 'factual-model',
      ...options
    });
    
    researchPhases.push({
      phase: 'fact-gathering',
      content: facts.text
    });
    
    // Analysis phase
    const analysisPrompt = `Analyze and interpret these facts:\\n\\n${facts.text}\\n\\nProvide analytical insights:`;
    const analysis = await this.router.advanced({
      prompt: analysisPrompt,
      model: 'reasoning-model',
      ...options
    });
    
    researchPhases.push({
      phase: 'analysis',
      content: analysis.text
    });
    
    // Presentation phase
    const presentationPrompt = `Create a well-structured presentation of this research:\\n\\nFacts: ${facts.text}\\n\\nAnalysis: ${analysis.text}\\n\\nPresent as:`;
    const presentation = await this.router.advanced({
      prompt: presentationPrompt,
      model: 'creative-model',
      ...options
    });
    
    researchPhases.push({
      phase: 'presentation',
      content: presentation.text
    });
    
    return {
      text: presentation.text,
      model: 'research-synthesis-ensemble',
      researchPhases,
      tokens: researchPhases.reduce((sum, p) => sum + (p.content?.length || 0) / 4, 0)
    };
  }
  
  adaptPromptForPhase(prompt, phase) {
    const adaptations = {
      'syntax-analysis': `Analyze the syntax and structure of this code:\\n\\n${prompt}\\n\\nProvide syntax review:`,
      'logic-review': `Review the logic and reasoning in this code:\\n\\n${prompt}\\n\\nLogical assessment:`,
      'best-practices': `Evaluate best practices in this code:\\n\\n${prompt}\\n\\nBest practices review:`
    };
    
    return adaptations[phase.task] || prompt;
  }
  
  adaptReasoningPrompt(context, phase) {
    const adaptations = {
      'problem-decomposition': `Break down this problem into smaller components:\\n\\n${context}\\n\\nProblem decomposition:`,
      'quantitative-analysis': `Perform quantitative analysis on:\\n\\n${context}\\n\\nQuantitative assessment:`,
      'knowledge-integration': `Integrate relevant knowledge for:\\n\\n${context}\\n\\nKnowledge integration:`,
      'solution-synthesis': `Synthesize a comprehensive solution based on:\\n\\n${context}\\n\\nFinal solution:`
    };
    
    return adaptations[phase.task] || context;
  }
  
  synthesizeConsensus(reviews, originalPrompt) {
    // Simple consensus synthesis
    const validReviews = reviews.filter(r => !r.error);
    
    if (validReviews.length === 0) {
      return {
        summary: "Unable to reach consensus due to review failures.",
        details: { confidence: 0, agreement: 0 }
      };
    }
    
    // For demonstration, combine the reviews
    const combinedReview = validReviews.map(r => 
      `${r.phase}: ${r.review}`
    ).join('\\n\\n');
    
    return {
      summary: `Consensus Review:\\n\\n${combinedReview}`,
      details: {
        reviewsConsidered: validReviews.length,
        phases: validReviews.map(r => r.phase),
        confidence: validReviews.length / reviews.length
      }
    };
  }
  
  async synthesizeReasoning(steps, originalPrompt, options) {
    const stepsText = steps.map(s => 
      `${s.step}: ${s.reasoning}`
    ).join('\\n\\n');
    
    const synthesisPrompt = `Based on this multi-step reasoning, provide a final comprehensive answer to: "${originalPrompt}"\\n\\nReasoning steps:\\n${stepsText}\\n\\nFinal answer:`;
    
    try {
      const synthesis = await this.router.quick(synthesisPrompt, options);
      return synthesis.text;
    } catch (error) {
      return `Synthesis failed. Step-by-step reasoning:\\n\\n${stepsText}`;
    }
  }
  
  getSpecializationStats() {
    const stats = {
      availableEnsembles: Array.from(this.specializedEnsembles.keys()),
      taskClassifiers: Array.from(this.taskClassifiers.keys()),
      ensembleConfigs: {}
    };
    
    for (const [type, config] of this.specializedEnsembles) {
      stats.ensembleConfigs[type] = {
        models: config.models,
        phases: config.phases.length,
        combination: config.combination
      };
    }
    
    return stats;
  }
}

// Usage example
async function demonstrateSpecializedEnsembles() {
  const specialized = new SpecializedEnsembleSystem();
  await specialized.initialize();
  
  const testCases = [
    {
      prompt: "Review this JavaScript function for bugs: function fibonacci(n) { if (n <= 1) return n; return fibonacci(n-1) + fibonacci(n-2); }",
      expectedType: 'code-review'
    },
    {
      prompt: "Write a creative short story about a robot who discovers emotions",
      expectedType: 'creative-writing'
    },
    {
      prompt: "Solve this problem: A train travels 120 miles in 2 hours, then 180 miles in 3 hours. What's the average speed?",
      expectedType: 'problem-solving'
    },
    {
      prompt: "Research and analyze the environmental impact of electric vehicles compared to gasoline cars",
      expectedType: 'research'
    }
  ];
  
  console.log('🎯 Testing Specialized Ensemble Systems:\\n');
  
  for (const [index, testCase] of testCases.entries()) {
    console.log(`--- Test ${index + 1}: Auto-Classification ---`);
    
    const startTime = Date.now();
    const result = await specialized.specializedEnsemble(testCase.prompt, null, {
      maxTokens: 200,
      temperature: 0.7
    });
    const totalTime = Date.now() - startTime;
    
    console.log(`Prompt: "${testCase.prompt.substring(0, 80)}..."`);
    console.log(`Expected Type: ${testCase.expectedType}`);
    console.log(`Classified As: ${result.ensembleInfo.type}`);
    console.log(`Classification Match: ${result.ensembleInfo.type === testCase.expectedType ? 'YES' : 'NO'}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Response: ${result.text.substring(0, 150)}...`);
    
    if (result.reviews) {
      console.log(`Reviews: ${result.reviews.length} phases completed`);
    }
    if (result.reasoningSteps) {
      console.log(`Reasoning Steps: ${result.reasoningSteps.length} steps completed`);
    }
    if (result.researchPhases) {
      console.log(`Research Phases: ${result.researchPhases.length} phases completed`);
    }
    
    console.log('');
  }
  
  console.log('📊 Specialization Statistics:');
  console.log(JSON.stringify(specialized.getSpecializationStats(), null, 2));
}

demonstrateSpecializedEnsembles().catch(console.error);
```

This comprehensive ensemble examples guide covers everything from basic ensemble operations to sophisticated specialized ensemble systems that can handle complex, multi-phase tasks with adaptive weighting and task-specific strategies.