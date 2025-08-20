# 💰 Building Cost-Effective RAG Systems

Comprehensive guide for implementing Retrieval-Augmented Generation (RAG) systems that minimize costs while maintaining high quality responses.

## Table of Contents

1. [Overview](#overview)
2. [Cost Analysis](#cost-analysis)
3. [Efficient Document Processing](#efficient-document-processing)
4. [Smart Retrieval Strategies](#smart-retrieval-strategies)
5. [Optimized Generation](#optimized-generation)
6. [Caching Strategies](#caching-strategies)
7. [Hybrid Approaches](#hybrid-approaches)
8. [Production Implementation](#production-implementation)

## Overview

RAG systems can be expensive due to embedding costs, vector storage, and LLM generation. This guide shows how to build cost-effective RAG systems that reduce expenses by 70-90% while maintaining quality.

### Cost Breakdown

| Component | Traditional Cost | Optimized Cost | Savings |
|-----------|-----------------|----------------|---------|
| Embeddings | $0.10/1M tokens | $0.01/1M tokens | 90% |
| Vector Storage | $0.20/GB/month | $0.05/GB/month | 75% |
| LLM Generation | $0.03/1K tokens | $0.005/1K tokens | 83% |
| **Total Monthly** | $500-2000 | $100-400 | 80% |

## Cost Analysis

### 1. Understanding RAG Costs

```javascript
class RAGCostAnalyzer {
  constructor() {
    this.costs = {
      embeddings: {
        'text-embedding-ada-002': 0.0001,     // per 1K tokens
        'text-embedding-3-small': 0.00002,    // 80% cheaper
        'voyage-lite-02': 0.00003,
        'cohere-embed-light': 0.00001
      },
      generation: {
        'gpt-4': 0.03,                        // per 1K tokens
        'gpt-3.5-turbo': 0.002,
        'claude-3-opus': 0.015,
        'claude-3-haiku': 0.00025,
        'groq/mixtral': 0.00027
      },
      storage: {
        pinecone: 0.096,                      // per 1M vectors/month
        weaviate: 0.05,
        qdrant: 0.04,
        chromadb: 0                           // self-hosted
      }
    };
  }
  
  calculateMonthlyCost(config) {
    const {
      documentsPerMonth = 10000,
      avgDocumentTokens = 1000,
      queriesPerMonth = 50000,
      avgResponseTokens = 500,
      embeddingModel = 'text-embedding-ada-002',
      generationModel = 'gpt-3.5-turbo',
      storageProvider = 'pinecone'
    } = config;
    
    // Embedding costs
    const totalEmbeddingTokens = documentsPerMonth * avgDocumentTokens;
    const embeddingCost = (totalEmbeddingTokens / 1000) * this.costs.embeddings[embeddingModel];
    
    // Generation costs
    const totalGenerationTokens = queriesPerMonth * avgResponseTokens;
    const generationCost = (totalGenerationTokens / 1000) * this.costs.generation[generationModel];
    
    // Storage costs (assuming 1536-dim vectors)
    const vectorCount = documentsPerMonth * (avgDocumentTokens / 100); // Rough chunks estimate
    const storageCost = (vectorCount / 1000000) * this.costs.storage[storageProvider] * 30;
    
    return {
      embedding: embeddingCost,
      generation: generationCost,
      storage: storageCost,
      total: embeddingCost + generationCost + storageCost,
      breakdown: {
        embeddingPercent: (embeddingCost / (embeddingCost + generationCost + storageCost)) * 100,
        generationPercent: (generationCost / (embeddingCost + generationCost + storageCost)) * 100,
        storagePercent: (storageCost / (embeddingCost + generationCost + storageCost)) * 100
      }
    };
  }
  
  recommendOptimizations(currentCost) {
    const optimizations = [];
    
    if (currentCost.embeddingPercent > 30) {
      optimizations.push({
        area: 'embeddings',
        recommendation: 'Switch to text-embedding-3-small or batch processing',
        potentialSavings: currentCost.embedding * 0.8
      });
    }
    
    if (currentCost.generationPercent > 50) {
      optimizations.push({
        area: 'generation',
        recommendation: 'Use claude-3-haiku or implement caching',
        potentialSavings: currentCost.generation * 0.7
      });
    }
    
    if (currentCost.storage > 50) {
      optimizations.push({
        area: 'storage',
        recommendation: 'Self-host ChromaDB or use compressed vectors',
        potentialSavings: currentCost.storage * 0.9
      });
    }
    
    return optimizations;
  }
}
```

### 2. Cost Tracking Implementation

```javascript
class CostTracker {
  constructor() {
    this.usage = {
      embeddings: { tokens: 0, cost: 0 },
      generation: { tokens: 0, cost: 0 },
      storage: { vectors: 0, cost: 0 }
    };
    
    this.budget = {
      daily: 10,
      monthly: 200
    };
  }
  
  trackEmbedding(tokens, model) {
    const cost = this.calculateEmbeddingCost(tokens, model);
    this.usage.embeddings.tokens += tokens;
    this.usage.embeddings.cost += cost;
    
    this.checkBudget();
    return cost;
  }
  
  trackGeneration(tokens, model) {
    const cost = this.calculateGenerationCost(tokens, model);
    this.usage.generation.tokens += tokens;
    this.usage.generation.cost += cost;
    
    this.checkBudget();
    return cost;
  }
  
  checkBudget() {
    const totalCost = this.getTotalCost();
    
    if (totalCost > this.budget.daily) {
      console.warn(`Daily budget exceeded: $${totalCost.toFixed(2)}`);
      this.switchToEconomyMode();
    }
  }
  
  switchToEconomyMode() {
    // Implement cost-saving measures
    console.log('Switching to economy mode');
  }
  
  getTotalCost() {
    return this.usage.embeddings.cost + 
           this.usage.generation.cost + 
           this.usage.storage.cost;
  }
  
  getReport() {
    return {
      total: this.getTotalCost(),
      breakdown: this.usage,
      projectedMonthly: this.getTotalCost() * 30,
      budgetRemaining: {
        daily: Math.max(0, this.budget.daily - this.getTotalCost()),
        monthly: Math.max(0, this.budget.monthly - (this.getTotalCost() * 30))
      }
    };
  }
}
```

## Efficient Document Processing

### 1. Smart Chunking Strategy

```javascript
class EfficientChunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 400;  // Smaller chunks = fewer tokens
    this.overlap = options.overlap || 50;
    this.minChunkSize = options.minChunkSize || 100;
  }
  
  chunkDocument(text, metadata = {}) {
    // Semantic chunking to reduce redundancy
    const sentences = this.splitIntoSentences(text);
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentSize + sentenceTokens > this.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          text: currentChunk.join(' '),
          tokens: currentSize,
          metadata: {
            ...metadata,
            chunkIndex: chunks.length,
            sentenceCount: currentChunk.length
          }
        });
        
        // Start new chunk with overlap
        const overlapSentences = this.getOverlapSentences(currentChunk);
        currentChunk = overlapSentences;
        currentSize = this.estimateTokens(overlapSentences.join(' '));
      }
      
      currentChunk.push(sentence);
      currentSize += sentenceTokens;
    }
    
    // Add final chunk
    if (currentChunk.length > 0 && currentSize >= this.minChunkSize) {
      chunks.push({
        text: currentChunk.join(' '),
        tokens: currentSize,
        metadata: {
          ...metadata,
          chunkIndex: chunks.length,
          sentenceCount: currentChunk.length
        }
      });
    }
    
    return this.deduplicateChunks(chunks);
  }
  
  splitIntoSentences(text) {
    // Improved sentence splitting
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }
  
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  getOverlapSentences(sentences) {
    // Get last sentences for overlap
    const overlapTokens = this.overlap;
    const result = [];
    let tokens = 0;
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.estimateTokens(sentences[i]);
      if (tokens + sentenceTokens <= overlapTokens) {
        result.unshift(sentences[i]);
        tokens += sentenceTokens;
      } else {
        break;
      }
    }
    
    return result;
  }
  
  deduplicateChunks(chunks) {
    // Remove duplicate or highly similar chunks
    const unique = [];
    const hashes = new Set();
    
    for (const chunk of chunks) {
      const hash = this.simpleHash(chunk.text);
      
      if (!hashes.has(hash)) {
        hashes.add(hash);
        unique.push(chunk);
      }
    }
    
    return unique;
  }
  
  simpleHash(text) {
    // Simple hash for deduplication
    return text.toLowerCase()
      .replace(/\s+/g, ' ')
      .substring(0, 100);  // Compare first 100 chars
  }
}
```

### 2. Selective Embedding

```javascript
class SelectiveEmbedder {
  constructor(router) {
    this.router = router;
    this.cache = new Map();
    this.importanceThreshold = 0.7;
  }
  
  async embedDocuments(documents) {
    const toEmbed = [];
    const embeddings = [];
    
    for (const doc of documents) {
      // Check cache first
      const cached = this.cache.get(this.hashDocument(doc));
      if (cached) {
        embeddings.push(cached);
        continue;
      }
      
      // Assess importance
      const importance = await this.assessImportance(doc);
      
      if (importance >= this.importanceThreshold) {
        toEmbed.push(doc);
      } else {
        // Use cheaper/simpler embedding
        embeddings.push(await this.generateSimpleEmbedding(doc));
      }
    }
    
    // Batch embed important documents
    if (toEmbed.length > 0) {
      const batchEmbeddings = await this.batchEmbed(toEmbed);
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }
  
  async assessImportance(document) {
    // Heuristic importance scoring
    let score = 0;
    
    // Length indicator (longer = more important)
    if (document.text.length > 500) score += 0.2;
    
    // Contains numbers/data
    if (/\d+/.test(document.text)) score += 0.1;
    
    // Contains technical terms
    const technicalTerms = /algorithm|implementation|architecture|system|process/i;
    if (technicalTerms.test(document.text)) score += 0.2;
    
    // Contains definitions
    if (/is defined as|means|refers to/i.test(document.text)) score += 0.3;
    
    // Contains lists or structure
    if (/^\d+\.|^-|^•/m.test(document.text)) score += 0.2;
    
    return Math.min(1, score);
  }
  
  async generateSimpleEmbedding(document) {
    // Use TF-IDF or keyword extraction for simple embedding
    const keywords = this.extractKeywords(document.text);
    const vector = new Array(384).fill(0);  // Smaller dimension
    
    // Simple keyword-based embedding
    for (const keyword of keywords) {
      const hash = this.hashString(keyword);
      const index = hash % 384;
      vector[index] += 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    
    return {
      vector,
      text: document.text,
      method: 'simple',
      cost: 0  // No API cost
    };
  }
  
  async batchEmbed(documents) {
    // Batch for efficiency
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const embeddings = await this.router.generateEmbeddings({
        texts: batch.map(d => d.text),
        model: 'text-embedding-3-small'  // Cheaper model
      });
      
      results.push(...embeddings);
    }
    
    // Cache results
    for (let i = 0; i < documents.length; i++) {
      const hash = this.hashDocument(documents[i]);
      this.cache.set(hash, results[i]);
    }
    
    return results;
  }
  
  extractKeywords(text) {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove stop words
    const stopWords = new Set(['the', 'and', 'for', 'with', 'this', 'that']);
    
    return words.filter(word => !stopWords.has(word));
  }
  
  hashDocument(doc) {
    return doc.text.substring(0, 100);
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

## Smart Retrieval Strategies

### 1. Hybrid Search

```javascript
class HybridRetriever {
  constructor(vectorStore, keywordIndex) {
    this.vectorStore = vectorStore;
    this.keywordIndex = keywordIndex;
    this.cache = new LRUCache(1000);
  }
  
  async retrieve(query, options = {}) {
    const {
      topK = 5,
      hybridWeight = 0.7,  // 0.7 vector, 0.3 keyword
      minScore = 0.5,
      useCache = true
    } = options;
    
    // Check cache
    if (useCache) {
      const cached = this.cache.get(query);
      if (cached) {
        return cached;
      }
    }
    
    // Parallel retrieval
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, topK * 2),
      this.keywordSearch(query, topK * 2)
    ]);
    
    // Combine results
    const combined = this.combineResults(
      vectorResults,
      keywordResults,
      hybridWeight
    );
    
    // Filter by minimum score
    const filtered = combined.filter(r => r.score >= minScore);
    
    // Take top K
    const results = filtered.slice(0, topK);
    
    // Cache results
    if (useCache) {
      this.cache.set(query, results);
    }
    
    return results;
  }
  
  async vectorSearch(query, topK) {
    // Generate query embedding (use cheap model)
    const embedding = await this.generateQueryEmbedding(query);
    
    // Search vector store
    const results = await this.vectorStore.search({
      vector: embedding.vector,
      topK,
      includeMetadata: true
    });
    
    return results.map(r => ({
      ...r,
      method: 'vector',
      cost: embedding.cost
    }));
  }
  
  async keywordSearch(query, topK) {
    // Extract keywords from query
    const keywords = this.extractKeywords(query);
    
    // Search keyword index (BM25)
    const results = await this.keywordIndex.search({
      keywords,
      topK
    });
    
    return results.map(r => ({
      ...r,
      method: 'keyword',
      cost: 0  // No API cost
    }));
  }
  
  combineResults(vectorResults, keywordResults, weight) {
    const combined = new Map();
    
    // Add vector results
    for (const result of vectorResults) {
      const id = result.id;
      combined.set(id, {
        ...result,
        score: result.score * weight,
        methods: ['vector']
      });
    }
    
    // Add/merge keyword results
    for (const result of keywordResults) {
      const id = result.id;
      if (combined.has(id)) {
        const existing = combined.get(id);
        existing.score += result.score * (1 - weight);
        existing.methods.push('keyword');
      } else {
        combined.set(id, {
          ...result,
          score: result.score * (1 - weight),
          methods: ['keyword']
        });
      }
    }
    
    // Sort by combined score
    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score);
  }
  
  async generateQueryEmbedding(query) {
    // Use cheaper embedding model for queries
    const start = Date.now();
    
    const embedding = await this.router.generateEmbedding({
      text: query,
      model: 'text-embedding-3-small'  // 5x cheaper than ada-002
    });
    
    return {
      vector: embedding.vector,
      cost: 0.00002 * (query.length / 1000),  // Approximate cost
      latency: Date.now() - start
    };
  }
  
  extractKeywords(text) {
    // Extract meaningful keywords
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Remove stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'this', 'that',
      'what', 'when', 'where', 'who', 'why', 'how'
    ]);
    
    return words.filter(word => !stopWords.has(word));
  }
}
```

### 2. Progressive Retrieval

```javascript
class ProgressiveRetriever {
  constructor() {
    this.stages = [
      { method: 'cache', maxResults: 5, cost: 0 },
      { method: 'keyword', maxResults: 10, cost: 0 },
      { method: 'vector_cheap', maxResults: 20, cost: 0.00002 },
      { method: 'vector_quality', maxResults: 50, cost: 0.0001 }
    ];
  }
  
  async retrieve(query, targetQuality = 0.8) {
    const results = [];
    let totalCost = 0;
    
    for (const stage of this.stages) {
      // Check if we have enough quality results
      if (this.hasQualityResults(results, targetQuality)) {
        break;
      }
      
      // Execute stage
      const stageResults = await this.executeStage(stage, query);
      
      // Merge results
      for (const result of stageResults) {
        if (!results.find(r => r.id === result.id)) {
          results.push(result);
        }
      }
      
      totalCost += stage.cost * stageResults.length;
      
      // Log progression
      console.log(`Stage ${stage.method}: Found ${stageResults.length} results, cost: $${totalCost.toFixed(4)}`);
    }
    
    return {
      results: this.rankResults(results),
      cost: totalCost,
      stagesUsed: this.stages.filter(s => 
        results.some(r => r.method === s.method)
      ).map(s => s.method)
    };
  }
  
  hasQualityResults(results, targetQuality) {
    if (results.length === 0) return false;
    
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    return avgScore >= targetQuality && results.length >= 3;
  }
  
  async executeStage(stage, query) {
    switch (stage.method) {
      case 'cache':
        return this.searchCache(query);
      
      case 'keyword':
        return this.keywordSearch(query, stage.maxResults);
      
      case 'vector_cheap':
        return this.vectorSearch(query, 'text-embedding-3-small', stage.maxResults);
      
      case 'vector_quality':
        return this.vectorSearch(query, 'text-embedding-ada-002', stage.maxResults);
      
      default:
        return [];
    }
  }
  
  rankResults(results) {
    // Re-rank results using cross-encoder or lightweight model
    return results.sort((a, b) => {
      // Prefer results found by multiple methods
      const aMethodCount = Array.isArray(a.methods) ? a.methods.length : 1;
      const bMethodCount = Array.isArray(b.methods) ? b.methods.length : 1;
      
      if (aMethodCount !== bMethodCount) {
        return bMethodCount - aMethodCount;
      }
      
      // Then by score
      return b.score - a.score;
    });
  }
}
```

## Optimized Generation

### 1. Context Compression

```javascript
class ContextCompressor {
  constructor() {
    this.compressionRatio = 0.5;  // Aim to reduce context by 50%
  }
  
  async compressContext(documents, query) {
    // Remove redundancy
    const unique = this.removeRedundancy(documents);
    
    // Extract relevant sentences
    const relevant = await this.extractRelevant(unique, query);
    
    // Summarize if still too long
    if (this.estimateTokens(relevant) > 2000) {
      return this.summarizeDocuments(relevant);
    }
    
    return relevant;
  }
  
  removeRedundancy(documents) {
    const seen = new Set();
    const unique = [];
    
    for (const doc of documents) {
      // Split into sentences
      const sentences = doc.text.split(/[.!?]+/);
      const uniqueSentences = [];
      
      for (const sentence of sentences) {
        const normalized = sentence.toLowerCase().trim();
        
        if (normalized.length > 20 && !seen.has(normalized)) {
          seen.add(normalized);
          uniqueSentences.push(sentence);
        }
      }
      
      if (uniqueSentences.length > 0) {
        unique.push({
          ...doc,
          text: uniqueSentences.join('. ')
        });
      }
    }
    
    return unique;
  }
  
  async extractRelevant(documents, query) {
    const queryKeywords = this.extractKeywords(query);
    const relevant = [];
    
    for (const doc of documents) {
      const sentences = doc.text.split(/[.!?]+/);
      const relevantSentences = [];
      
      for (const sentence of sentences) {
        const score = this.scoreRelevance(sentence, queryKeywords);
        
        if (score > 0.3) {
          relevantSentences.push({
            text: sentence,
            score
          });
        }
      }
      
      // Keep top sentences
      relevantSentences.sort((a, b) => b.score - a.score);
      const topSentences = relevantSentences
        .slice(0, 3)
        .map(s => s.text);
      
      if (topSentences.length > 0) {
        relevant.push({
          ...doc,
          text: topSentences.join('. ')
        });
      }
    }
    
    return relevant;
  }
  
  scoreRelevance(sentence, queryKeywords) {
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    let matches = 0;
    
    for (const keyword of queryKeywords) {
      if (sentenceWords.includes(keyword)) {
        matches++;
      }
    }
    
    return matches / queryKeywords.length;
  }
  
  async summarizeDocuments(documents) {
    // Use cheap model for summarization
    const summaries = [];
    
    for (const doc of documents) {
      const summary = await this.router.generate({
        prompt: `Summarize in 2 sentences: ${doc.text}`,
        model: 'claude-3-haiku',  // Very cheap
        maxTokens: 100
      });
      
      summaries.push({
        ...doc,
        text: summary.text,
        compressed: true
      });
    }
    
    return summaries;
  }
  
  estimateTokens(documents) {
    const text = documents.map(d => d.text).join(' ');
    return Math.ceil(text.length / 4);
  }
}
```

### 2. Model Selection Strategy

```javascript
class SmartModelSelector {
  constructor() {
    this.models = [
      { name: 'claude-3-haiku', cost: 0.00025, quality: 0.75, speed: 0.9 },
      { name: 'gpt-3.5-turbo', cost: 0.002, quality: 0.8, speed: 0.8 },
      { name: 'groq/mixtral', cost: 0.00027, quality: 0.77, speed: 0.95 },
      { name: 'claude-3-sonnet', cost: 0.003, quality: 0.85, speed: 0.7 },
      { name: 'gpt-4', cost: 0.03, quality: 0.95, speed: 0.5 }
    ];
  }
  
  selectModel(query, context, budget) {
    const complexity = this.assessComplexity(query);
    const contextSize = this.estimateTokens(context);
    
    // Filter models by budget
    const affordableModels = this.models.filter(m => {
      const estimatedCost = (contextSize + 500) / 1000 * m.cost;
      return estimatedCost <= budget;
    });
    
    if (affordableModels.length === 0) {
      throw new Error('No models within budget');
    }
    
    // Select based on complexity
    if (complexity < 0.3) {
      // Simple query - prioritize speed and cost
      return this.selectByPriority(affordableModels, ['speed', 'cost']);
    } else if (complexity < 0.7) {
      // Moderate - balance all factors
      return this.selectByPriority(affordableModels, ['quality', 'cost', 'speed']);
    } else {
      // Complex - prioritize quality
      return this.selectByPriority(affordableModels, ['quality', 'speed']);
    }
  }
  
  assessComplexity(query) {
    let score = 0;
    
    // Length factor
    if (query.length > 200) score += 0.2;
    
    // Question complexity
    if (/analyze|compare|evaluate|explain/i.test(query)) score += 0.3;
    if (/how|why/i.test(query)) score += 0.2;
    if (/what|when|where/i.test(query)) score += 0.1;
    
    // Technical content
    if (/code|algorithm|implementation/i.test(query)) score += 0.2;
    
    return Math.min(1, score);
  }
  
  selectByPriority(models, priorities) {
    const weights = {
      quality: priorities.includes('quality') ? 1 / (priorities.indexOf('quality') + 1) : 0,
      cost: priorities.includes('cost') ? 1 / (priorities.indexOf('cost') + 1) : 0,
      speed: priorities.includes('speed') ? 1 / (priorities.indexOf('speed') + 1) : 0
    };
    
    let bestModel = models[0];
    let bestScore = 0;
    
    for (const model of models) {
      const score = 
        model.quality * weights.quality +
        (1 - model.cost / 0.03) * weights.cost +  // Normalize cost
        model.speed * weights.speed;
      
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }
    
    return bestModel.name;
  }
  
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
}
```

## Caching Strategies

### 1. Semantic Cache

```javascript
class SemanticCache {
  constructor(threshold = 0.9) {
    this.cache = new Map();
    this.embeddings = new Map();
    this.threshold = threshold;
    this.maxSize = 10000;
    this.hits = 0;
    this.misses = 0;
  }
  
  async get(query) {
    // Generate query embedding (use cached if available)
    const queryEmbedding = await this.getQueryEmbedding(query);
    
    // Find similar cached queries
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [cachedQuery, cachedData] of this.cache.entries()) {
      const cachedEmbedding = this.embeddings.get(cachedQuery);
      const similarity = this.cosineSimilarity(queryEmbedding, cachedEmbedding);
      
      if (similarity > bestScore && similarity >= this.threshold) {
        bestScore = similarity;
        bestMatch = cachedData;
      }
    }
    
    if (bestMatch) {
      this.hits++;
      console.log(`Cache hit! Similarity: ${bestScore.toFixed(3)}`);
      return {
        ...bestMatch,
        cached: true,
        similarity: bestScore
      };
    }
    
    this.misses++;
    return null;
  }
  
  async set(query, response) {
    // Limit cache size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    // Generate and store embedding
    const embedding = await this.getQueryEmbedding(query);
    
    this.cache.set(query, {
      response,
      timestamp: Date.now(),
      accessCount: 0
    });
    
    this.embeddings.set(query, embedding);
  }
  
  async getQueryEmbedding(query) {
    // Use simple hash-based embedding for cost saving
    const words = query.toLowerCase().split(/\s+/);
    const vector = new Array(128).fill(0);
    
    for (const word of words) {
      const hash = this.hashString(word);
      vector[hash % 128] += 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    
    return vector;
  }
  
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    return dotProduct;
  }
  
  evictOldest() {
    let oldest = null;
    let oldestTime = Infinity;
    
    for (const [query, data] of this.cache.entries()) {
      if (data.timestamp < oldestTime) {
        oldest = query;
        oldestTime = data.timestamp;
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest);
      this.embeddings.delete(oldest);
    }
  }
  
  getStats() {
    const hitRate = this.hits / (this.hits + this.misses);
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(3),
      size: this.cache.size,
      costSaved: this.hits * 0.002  // Assuming $0.002 per query
    };
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

### 2. Response Cache with TTL

```javascript
class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.ttl = {
      factual: 86400000,     // 24 hours for facts
      analytical: 3600000,   // 1 hour for analysis
      creative: 0,           // No caching for creative
      default: 1800000       // 30 minutes default
    };
  }
  
  getCacheKey(query, context) {
    // Create unique key from query and context
    const contextKey = context
      .map(d => d.id || d.text.substring(0, 50))
      .sort()
      .join('|');
    
    return `${query}::${contextKey}`;
  }
  
  get(query, context) {
    const key = this.getCacheKey(query, context);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check TTL
    const age = Date.now() - cached.timestamp;
    const ttl = this.getTTL(query);
    
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access time and count
    cached.lastAccess = Date.now();
    cached.accessCount++;
    
    return {
      ...cached.response,
      cached: true,
      age: Math.round(age / 1000),  // Age in seconds
      accessCount: cached.accessCount
    };
  }
  
  set(query, context, response) {
    const key = this.getCacheKey(query, context);
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0,
      queryType: this.classifyQuery(query)
    });
    
    // Cleanup old entries
    this.cleanup();
  }
  
  getTTL(query) {
    const type = this.classifyQuery(query);
    return this.ttl[type] || this.ttl.default;
  }
  
  classifyQuery(query) {
    if (/what is|define|fact/i.test(query)) return 'factual';
    if (/analyze|compare|evaluate/i.test(query)) return 'analytical';
    if (/create|write|imagine/i.test(query)) return 'creative';
    return 'default';
  }
  
  cleanup() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, data] of this.cache.entries()) {
      const ttl = this.ttl[data.queryType] || this.ttl.default;
      const age = now - data.timestamp;
      
      if (age > ttl) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }
}
```

## Hybrid Approaches

### 1. Tiered RAG System

```javascript
class TieredRAG {
  constructor() {
    this.tiers = {
      fast: {
        retriever: new KeywordRetriever(),
        generator: 'claude-3-haiku',
        maxCost: 0.001
      },
      balanced: {
        retriever: new HybridRetriever(),
        generator: 'gpt-3.5-turbo',
        maxCost: 0.01
      },
      quality: {
        retriever: new VectorRetriever(),
        generator: 'gpt-4',
        maxCost: 0.1
      }
    };
    
    this.cache = new SemanticCache();
    this.costTracker = new CostTracker();
  }
  
  async query(question, options = {}) {
    // Check cache first
    const cached = await this.cache.get(question);
    if (cached) {
      return cached;
    }
    
    // Determine tier based on question and budget
    const tier = this.selectTier(question, options);
    
    // Retrieve context
    const context = await tier.retriever.retrieve(question);
    
    // Compress context if needed
    const compressed = await this.compressIfNeeded(context, tier.maxCost);
    
    // Generate response
    const response = await this.generate(question, compressed, tier.generator);
    
    // Cache response
    await this.cache.set(question, response);
    
    // Track costs
    this.costTracker.track(response.cost);
    
    return response;
  }
  
  selectTier(question, options) {
    const complexity = this.assessComplexity(question);
    const budget = options.budget || 0.01;
    
    if (complexity < 0.3 && budget < 0.005) {
      return this.tiers.fast;
    } else if (complexity < 0.7 && budget < 0.05) {
      return this.tiers.balanced;
    } else {
      return this.tiers.quality;
    }
  }
  
  async compressIfNeeded(context, maxCost) {
    const contextTokens = this.estimateTokens(context);
    const estimatedCost = (contextTokens / 1000) * 0.002;
    
    if (estimatedCost > maxCost * 0.5) {
      // Compress to stay within budget
      const compressor = new ContextCompressor();
      return compressor.compressContext(context);
    }
    
    return context;
  }
  
  assessComplexity(question) {
    // Reuse complexity assessment logic
    let score = 0;
    if (question.length > 200) score += 0.2;
    if (/analyze|compare|evaluate/i.test(question)) score += 0.3;
    if (/code|technical|algorithm/i.test(question)) score += 0.2;
    return Math.min(1, score);
  }
}
```

## Production Implementation

### 1. Complete Cost-Effective RAG System

```javascript
class CostEffectiveRAG {
  constructor(config = {}) {
    this.config = {
      monthlyBudget: config.monthlyBudget || 200,
      targetQuality: config.targetQuality || 0.8,
      cacheEnabled: config.cacheEnabled !== false,
      ...config
    };
    
    this.router = new LLMRouter({
      providers: ['openai', 'anthropic', 'groq'],
      strategy: 'cost-optimized'
    });
    
    this.chunker = new EfficientChunker();
    this.embedder = new SelectiveEmbedder(this.router);
    this.retriever = new HybridRetriever();
    this.compressor = new ContextCompressor();
    this.cache = new SemanticCache();
    this.costTracker = new CostTracker();
    this.modelSelector = new SmartModelSelector();
    
    this.setupMonitoring();
  }
  
  async addDocument(document, metadata = {}) {
    try {
      // Chunk document efficiently
      const chunks = this.chunker.chunkDocument(document, metadata);
      
      // Selective embedding
      const embeddings = await this.embedder.embedDocuments(chunks);
      
      // Store in vector database
      await this.storeEmbeddings(embeddings);
      
      // Update cost tracking
      const cost = embeddings.reduce((sum, e) => sum + (e.cost || 0), 0);
      this.costTracker.trackEmbedding(chunks.length * 100, 'text-embedding-3-small');
      
      return {
        chunks: chunks.length,
        cost,
        method: 'selective'
      };
    } catch (error) {
      console.error('Document processing failed:', error);
      throw error;
    }
  }
  
  async query(question, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache
      if (this.config.cacheEnabled) {
        const cached = await this.cache.get(question);
        if (cached) {
          return {
            ...cached,
            latency: Date.now() - startTime
          };
        }
      }
      
      // Retrieve relevant documents
      const documents = await this.retriever.retrieve(question, {
        topK: options.topK || 5,
        useCache: true
      });
      
      // Compress context
      const context = await this.compressor.compressContext(documents, question);
      
      // Select appropriate model
      const budget = this.calculateQueryBudget();
      const model = this.modelSelector.selectModel(question, context, budget);
      
      // Generate response
      const response = await this.generateResponse(question, context, model);
      
      // Cache response
      if (this.config.cacheEnabled) {
        await this.cache.set(question, response);
      }
      
      // Track costs
      this.costTracker.trackGeneration(response.usage?.totalTokens || 0, model);
      
      return {
        ...response,
        latency: Date.now() - startTime,
        documentsUsed: documents.length,
        model,
        costBreakdown: this.costTracker.getReport()
      };
      
    } catch (error) {
      console.error('Query failed:', error);
      
      // Fallback to simple response
      return this.fallbackResponse(question, error);
    }
  }
  
  async generateResponse(question, context, model) {
    const prompt = this.buildPrompt(question, context);
    
    const response = await this.router.generate({
      prompt,
      model,
      temperature: 0.7,
      maxTokens: 500
    });
    
    return response;
  }
  
  buildPrompt(question, context) {
    const contextText = context
      .map(d => d.text)
      .join('\n\n');
    
    return `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer based on the context provided:`;
  }
  
  calculateQueryBudget() {
    const report = this.costTracker.getReport();
    const remainingBudget = report.budgetRemaining.daily;
    
    // Allocate budget per query
    const queriesPerDay = 1000;  // Estimate
    return Math.min(0.01, remainingBudget / queriesPerDay);
  }
  
  async storeEmbeddings(embeddings) {
    // Store in your vector database
    // Implementation depends on your choice (Pinecone, Weaviate, etc.)
  }
  
  fallbackResponse(question, error) {
    console.error('Fallback triggered:', error);
    
    return {
      text: "I'm unable to provide a detailed answer at the moment. Please try rephrasing your question or try again later.",
      error: true,
      fallback: true,
      errorMessage: error.message
    };
  }
  
  setupMonitoring() {
    // Monitor costs every hour
    setInterval(() => {
      const report = this.costTracker.getReport();
      
      if (report.projectedMonthly > this.config.monthlyBudget) {
        console.warn('Projected to exceed monthly budget!');
        this.enableEconomyMode();
      }
      
      // Log metrics
      console.log('Cost Report:', report);
      console.log('Cache Stats:', this.cache.getStats());
      
    }, 3600000);  // Every hour
  }
  
  enableEconomyMode() {
    console.log('Enabling economy mode to reduce costs');
    
    // Switch to cheaper models
    this.modelSelector.models = this.modelSelector.models
      .filter(m => m.cost < 0.003);
    
    // Increase cache threshold
    this.cache.threshold = 0.85;
    
    // Reduce retrieval count
    this.retriever.defaultTopK = 3;
  }
  
  getMetrics() {
    return {
      cost: this.costTracker.getReport(),
      cache: this.cache.getStats(),
      performance: {
        avgLatency: this.avgLatency,
        successRate: this.successRate
      }
    };
  }
}

// Usage example
const rag = new CostEffectiveRAG({
  monthlyBudget: 100,
  targetQuality: 0.85,
  cacheEnabled: true
});

// Add documents
await rag.addDocument('Your document content here', {
  source: 'manual',
  category: 'technical'
});

// Query
const response = await rag.query('What is the main topic of the document?');
console.log(response);
```

## Best Practices

1. **Always implement caching** - Can reduce costs by 60-80%
2. **Use hybrid retrieval** - Combine cheap keyword search with selective vector search
3. **Compress context aggressively** - Remove redundancy and irrelevant content
4. **Choose models wisely** - Use cheaper models for simple queries
5. **Batch operations** - Process documents and embeddings in batches
6. **Monitor continuously** - Track costs and adjust strategies
7. **Implement fallbacks** - Have cheaper alternatives ready
8. **Pre-filter documents** - Don't embed everything
9. **Use smaller embedding dimensions** - 384-dim can be sufficient
10. **Self-host when possible** - Consider ChromaDB or Qdrant

## Cost Optimization Checklist

- [ ] Implement semantic caching
- [ ] Use hybrid search (keyword + vector)
- [ ] Compress context before generation
- [ ] Select models based on complexity
- [ ] Batch embedding operations
- [ ] Use cheaper embedding models
- [ ] Self-host vector database
- [ ] Monitor and track all costs
- [ ] Implement progressive retrieval
- [ ] Cache query embeddings

## Conclusion

Building cost-effective RAG systems requires careful optimization at every stage - from document processing through retrieval to generation. By implementing the strategies in this guide, you can reduce costs by 70-90% while maintaining high-quality responses.

---

Next: [Streaming UI Integration](./streaming-ui-integration.md) | [Back to Tutorials](../tutorials/)