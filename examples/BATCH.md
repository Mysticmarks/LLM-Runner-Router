# Batch Processing Examples

This guide demonstrates efficient batch processing capabilities of the LLM-Runner-Router system. Perfect for handling multiple prompts, data processing workflows, and bulk operations.

## Table of Contents
- [Basic Batch Processing](#basic-batch-processing)
- [Parallel Processing](#parallel-processing)
- [Sequential Processing](#sequential-processing)
- [Data Pipeline Processing](#data-pipeline-processing)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)

## Basic Batch Processing

### Simple Batch Inference

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();
await router.load('models/llama-7b.gguf');

// Simple batch processing
async function basicBatch() {
  const prompts = [
    "What is artificial intelligence?",
    "Explain machine learning",
    "What is deep learning?",
    "How do neural networks work?",
    "What is natural language processing?"
  ];
  
  console.log('🚀 Starting batch processing...\n');
  
  const results = await router.batch(prompts, {
    maxTokens: 100,
    temperature: 0.7,
    parallel: true,
    maxConcurrency: 3
  });
  
  results.forEach((result, index) => {
    console.log(`\n--- Question ${index + 1} ---`);
    console.log(`Q: ${prompts[index]}`);
    console.log(`A: ${result.text}`);
    console.log(`Model: ${result.model}, Time: ${result.latency}ms`);
  });
  
  console.log(`\n✅ Batch complete: ${results.length} responses generated`);
}

basicBatch().catch(console.error);
```

### Batch with Custom Options

```javascript
async function advancedBatch() {
  const tasks = [
    {
      prompt: "Write a haiku about programming",
      options: { maxTokens: 50, temperature: 0.9 }
    },
    {
      prompt: "Explain recursion in programming",
      options: { maxTokens: 200, temperature: 0.5 }
    },
    {
      prompt: "List 5 sorting algorithms",
      options: { maxTokens: 150, temperature: 0.3 }
    },
    {
      prompt: "Creative story about a robot",
      options: { maxTokens: 300, temperature: 1.0 }
    }
  ];
  
  console.log('🎨 Processing diverse batch tasks...\n');
  
  const results = await Promise.all(
    tasks.map(async (task, index) => {
      console.log(`📝 Processing task ${index + 1}...`);
      
      const result = await router.quick(task.prompt, task.options);
      
      return {
        taskIndex: index,
        prompt: task.prompt,
        result
      };
    })
  );
  
  results.forEach(({ taskIndex, prompt, result }) => {
    console.log(`\n=== Task ${taskIndex + 1} ===`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Response: ${result.text}`);
    console.log(`Stats: ${result.tokens} tokens, ${result.latency}ms`);
  });
}

advancedBatch().catch(console.error);
```

## Parallel Processing

### Concurrent Batch Processor

```javascript
class ConcurrentBatchProcessor {
  constructor(router, maxConcurrency = 5) {
    this.router = router;
    this.maxConcurrency = maxConcurrency;
    this.activeRequests = 0;
    this.queue = [];
    this.results = [];
  }
  
  async processBatch(prompts, options = {}) {
    console.log(`🔄 Processing ${prompts.length} prompts with max concurrency: ${this.maxConcurrency}`);
    
    return new Promise((resolve, reject) => {
      this.results = new Array(prompts.length);
      let completed = 0;
      
      const processNext = async () => {
        if (this.queue.length === 0 && this.activeRequests === 0) {
          resolve(this.results);
          return;
        }
        
        if (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
          const { prompt, index, opts } = this.queue.shift();
          this.activeRequests++;
          
          try {
            const startTime = Date.now();
            const result = await this.router.quick(prompt, opts);
            
            this.results[index] = {
              ...result,
              index,
              prompt,
              processingTime: Date.now() - startTime
            };
            
            completed++;
            console.log(`✅ Completed ${completed}/${prompts.length}: "${prompt.substring(0, 50)}..."`);
            
          } catch (error) {
            this.results[index] = {
              index,
              prompt,
              error: error.message,
              failed: true
            };
            
            completed++;
            console.log(`❌ Failed ${completed}/${prompts.length}: ${error.message}`);
          }
          
          this.activeRequests--;
          processNext();
        }
      };
      
      // Add all prompts to queue
      prompts.forEach((prompt, index) => {
        this.queue.push({ prompt, index, opts: options });
      });
      
      // Start processing
      for (let i = 0; i < this.maxConcurrency; i++) {
        processNext();
      }
    });
  }
  
  getStats(results) {
    const successful = results.filter(r => !r.failed);
    const failed = results.filter(r => r.failed);
    
    const totalTime = Math.max(...successful.map(r => r.processingTime || 0));
    const avgTime = successful.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful.length;
    const totalTokens = successful.reduce((sum, r) => sum + (r.tokens || 0), 0);
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      totalTime,
      avgTime: Math.round(avgTime),
      totalTokens,
      tokensPerSecond: Math.round(totalTokens / (totalTime / 1000))
    };
  }
}

// Usage example
async function demonstrateConcurrentProcessing() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const processor = new ConcurrentBatchProcessor(router, 3);
  
  const prompts = [
    "Explain photosynthesis briefly",
    "What causes seasons on Earth?",
    "How do computers store data?",
    "What is gravity?",
    "Explain the water cycle",
    "How do magnets work?",
    "What is DNA?",
    "Explain how planes fly",
    "What causes earthquakes?",
    "How do vaccines work?"
  ];
  
  const startTime = Date.now();
  const results = await processor.processBatch(prompts, {
    maxTokens: 80,
    temperature: 0.6
  });
  
  const stats = processor.getStats(results);
  
  console.log('\n📊 Batch Processing Results:');
  console.log(`Total time: ${Date.now() - startTime}ms`);
  console.log(`Successful: ${stats.successful}/${stats.total}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Average response time: ${stats.avgTime}ms`);
  console.log(`Total tokens generated: ${stats.totalTokens}`);
  console.log(`Tokens per second: ${stats.tokensPerSecond}`);
  
  // Show failed requests
  const failed = results.filter(r => r.failed);
  if (failed.length > 0) {
    console.log('\n❌ Failed requests:');
    failed.forEach(f => {
      console.log(`  "${f.prompt}": ${f.error}`);
    });
  }
}

demonstrateConcurrentProcessing().catch(console.error);
```

### Load-Balanced Processing

```javascript
class LoadBalancedProcessor {
  constructor(routers) {
    this.routers = routers;
    this.routerStats = routers.map(() => ({ 
      active: 0, 
      completed: 0, 
      totalTime: 0,
      errors: 0 
    }));
  }
  
  selectLeastLoadedRouter() {
    let minLoad = Infinity;
    let selectedIndex = 0;
    
    this.routerStats.forEach((stats, index) => {
      const load = stats.active + (stats.totalTime / stats.completed || 0) / 1000;
      if (load < minLoad) {
        minLoad = load;
        selectedIndex = index;
      }
    });
    
    return selectedIndex;
  }
  
  async processWithLoadBalancing(prompts, options = {}) {
    console.log(`⚖️ Load balancing across ${this.routers.length} routers`);
    
    const results = await Promise.all(
      prompts.map(async (prompt, index) => {
        const routerIndex = this.selectLeastLoadedRouter();
        const router = this.routers[routerIndex];
        const stats = this.routerStats[routerIndex];
        
        stats.active++;
        const startTime = Date.now();
        
        try {
          const result = await router.quick(prompt, options);
          
          const processingTime = Date.now() - startTime;
          stats.completed++;
          stats.totalTime += processingTime;
          stats.active--;
          
          return {
            ...result,
            routerIndex,
            processingTime,
            prompt
          };
          
        } catch (error) {
          stats.errors++;
          stats.active--;
          
          return {
            prompt,
            error: error.message,
            failed: true,
            routerIndex
          };
        }
      })
    );
    
    return results;
  }
  
  getLoadBalancingStats() {
    return this.routerStats.map((stats, index) => ({
      router: index,
      completed: stats.completed,
      avgTime: stats.completed > 0 ? Math.round(stats.totalTime / stats.completed) : 0,
      errors: stats.errors,
      successRate: stats.completed > 0 ? ((stats.completed - stats.errors) / stats.completed * 100).toFixed(1) : 0
    }));
  }
}

// Setup multiple routers
async function setupLoadBalancing() {
  const routers = [];
  
  // Create multiple router instances
  for (let i = 0; i < 3; i++) {
    const router = new LLMRouter({
      strategy: 'speed-priority',
      logLevel: 'warn'
    });
    await router.initialize();
    await router.load(`models/model-${i + 1}.gguf`);
    routers.push(router);
  }
  
  const processor = new LoadBalancedProcessor(routers);
  
  const prompts = Array.from({ length: 20 }, (_, i) => 
    `Explain concept number ${i + 1} in computer science`
  );
  
  console.log('🚀 Starting load-balanced processing...');
  
  const results = await processor.processWithLoadBalancing(prompts, {
    maxTokens: 100,
    temperature: 0.7
  });
  
  console.log('\n📊 Load Balancing Results:');
  const stats = processor.getLoadBalancingStats();
  stats.forEach(stat => {
    console.log(`Router ${stat.router}: ${stat.completed} completed, ${stat.avgTime}ms avg, ${stat.successRate}% success`);
  });
  
  // Cleanup
  await Promise.all(routers.map(r => r.cleanup()));
}

setupLoadBalancing().catch(console.error);
```

## Sequential Processing

### Sequential Batch with Dependencies

```javascript
class SequentialProcessor {
  constructor(router) {
    this.router = router;
    this.context = new Map();
  }
  
  async processSequentialBatch(tasks) {
    const results = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`📝 Processing step ${i + 1}/${tasks.length}: ${task.name}`);
      
      try {
        // Build prompt with context if needed
        let prompt = task.prompt;
        
        if (task.useContext) {
          const contextEntries = Array.from(this.context.entries())
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
          
          if (contextEntries) {
            prompt = `Context:\n${contextEntries}\n\nTask: ${prompt}`;
          }
        }
        
        const result = await this.router.quick(prompt, task.options || {});
        
        // Store result in context if specified
        if (task.storeAs) {
          this.context.set(task.storeAs, result.text);
        }
        
        results.push({
          step: i + 1,
          name: task.name,
          prompt: task.prompt,
          result,
          contextUsed: task.useContext,
          contextStored: task.storeAs
        });
        
        console.log(`✅ Step ${i + 1} complete`);
        
        // Optional delay between steps
        if (task.delay) {
          await this.sleep(task.delay);
        }
        
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed: ${error.message}`);
        
        results.push({
          step: i + 1,
          name: task.name,
          error: error.message,
          failed: true
        });
        
        // Handle failure strategy
        if (task.continueOnError !== true) {
          console.log('🛑 Stopping sequential processing due to error');
          break;
        }
      }
    }
    
    return results;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  clearContext() {
    this.context.clear();
  }
  
  getContext() {
    return Object.fromEntries(this.context);
  }
}

// Example: Research paper generation pipeline
async function demonstrateSequentialProcessing() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const processor = new SequentialProcessor(router);
  
  const researchTasks = [
    {
      name: "Choose Topic",
      prompt: "Suggest an interesting topic in artificial intelligence for a research paper",
      options: { maxTokens: 50, temperature: 0.8 },
      storeAs: "topic"
    },
    {
      name: "Create Outline",
      prompt: "Create a detailed outline for a research paper on the following topic",
      useContext: true,
      options: { maxTokens: 200, temperature: 0.6 },
      storeAs: "outline"
    },
    {
      name: "Write Introduction",
      prompt: "Write an introduction section based on this outline",
      useContext: true,
      options: { maxTokens: 300, temperature: 0.7 },
      storeAs: "introduction"
    },
    {
      name: "Literature Review",
      prompt: "Write a literature review section discussing relevant prior work",
      useContext: true,
      options: { maxTokens: 400, temperature: 0.6 },
      storeAs: "literature_review"
    },
    {
      name: "Methodology",
      prompt: "Describe the methodology that would be used in this research",
      useContext: true,
      options: { maxTokens: 300, temperature: 0.5 },
      storeAs: "methodology"
    },
    {
      name: "Conclusion",
      prompt: "Write a conclusion that summarizes the research paper",
      useContext: true,
      options: { maxTokens: 200, temperature: 0.6 },
      delay: 1000 // 1 second delay before conclusion
    }
  ];
  
  console.log('📚 Starting research paper generation pipeline...\n');
  
  const results = await processor.processSequentialBatch(researchTasks);
  
  console.log('\n📋 Sequential Processing Results:');
  results.forEach(result => {
    if (result.failed) {
      console.log(`❌ ${result.step}. ${result.name}: FAILED - ${result.error}`);
    } else {
      console.log(`✅ ${result.step}. ${result.name}: SUCCESS (${result.result.tokens} tokens)`);
    }
  });
  
  console.log('\n📖 Generated Research Paper Sections:');
  const context = processor.getContext();
  Object.entries(context).forEach(([section, content]) => {
    console.log(`\n--- ${section.toUpperCase()} ---`);
    console.log(content);
  });
}

demonstrateSequentialProcessing().catch(console.error);
```

## Data Pipeline Processing

### CSV Data Processing

```javascript
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

class CSVProcessor {
  constructor(router) {
    this.router = router;
  }
  
  async processCSVFile(filePath, config) {
    console.log(`📊 Processing CSV file: ${filePath}`);
    
    // Read and parse CSV
    const csvContent = await fs.readFile(filePath, 'utf-8');
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true 
    });
    
    console.log(`Found ${records.length} records`);
    
    const results = [];
    const batchSize = config.batchSize || 10;
    
    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map(async (record, index) => {
          try {
            // Build prompt from record
            const prompt = config.promptTemplate(record);
            
            const result = await this.router.quick(prompt, config.options || {});
            
            return {
              originalRecord: record,
              prompt,
              result: result.text,
              tokens: result.tokens,
              latency: result.latency,
              batchIndex: Math.floor(i / batchSize),
              recordIndex: i + index
            };
            
          } catch (error) {
            return {
              originalRecord: record,
              error: error.message,
              failed: true,
              batchIndex: Math.floor(i / batchSize),
              recordIndex: i + index
            };
          }
        })
      );
      
      results.push(...batchResults);
      
      // Optional delay between batches
      if (config.batchDelay && i + batchSize < records.length) {
        await this.sleep(config.batchDelay);
      }
    }
    
    return results;
  }
  
  async saveResults(results, outputPath, format = 'csv') {
    if (format === 'csv') {
      const headers = ['record_index', 'original_data', 'prompt', 'result', 'tokens', 'latency', 'error'];
      const csvData = [
        headers.join(','),
        ...results.map(r => [
          r.recordIndex,
          JSON.stringify(r.originalRecord).replace(/"/g, '""'),
          JSON.stringify(r.prompt || '').replace(/"/g, '""'),
          JSON.stringify(r.result || '').replace(/"/g, '""'),
          r.tokens || 0,
          r.latency || 0,
          r.error || ''
        ].map(field => `"${field}"`).join(','))
      ].join('\n');
      
      await fs.writeFile(outputPath, csvData);
    } else if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    }
    
    console.log(`💾 Results saved to: ${outputPath}`);
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example: Customer review sentiment analysis
async function demonstrateCSVProcessing() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const processor = new CSVProcessor(router);
  
  // Create sample CSV data
  const sampleData = `product,review,rating
iPhone,Great phone but battery could be better,4
Laptop,Excellent performance for programming,5
Headphones,Sound quality is amazing,5
Tablet,Screen is too small for my needs,2
Mouse,Very comfortable to use,4`;
  
  await fs.writeFile('sample_reviews.csv', sampleData);
  
  const config = {
    batchSize: 3,
    batchDelay: 1000,
    promptTemplate: (record) => 
      `Analyze the sentiment of this product review and provide a detailed explanation:
Product: ${record.product}
Review: "${record.review}"
Rating: ${record.rating}/5

Provide sentiment (positive/negative/neutral) and explanation:`,
    options: {
      maxTokens: 150,
      temperature: 0.3
    }
  };
  
  const results = await processor.processCSVFile('sample_reviews.csv', config);
  
  await processor.saveResults(results, 'sentiment_analysis_results.json', 'json');
  await processor.saveResults(results, 'sentiment_analysis_results.csv', 'csv');
  
  // Show summary
  const successful = results.filter(r => !r.failed);
  const failed = results.filter(r => r.failed);
  
  console.log('\n📈 Processing Summary:');
  console.log(`Total records: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Average tokens per response: ${Math.round(successful.reduce((sum, r) => sum + r.tokens, 0) / successful.length)}`);
  console.log(`Average latency: ${Math.round(successful.reduce((sum, r) => sum + r.latency, 0) / successful.length)}ms`);
  
  // Cleanup
  await fs.unlink('sample_reviews.csv');
}

demonstrateCSVProcessing().catch(console.error);
```

### JSON Data Transformation

```javascript
class JSONTransformer {
  constructor(router) {
    this.router = router;
  }
  
  async transformData(inputData, transformations) {
    const results = [];
    
    for (const [index, item] of inputData.entries()) {
      console.log(`🔄 Transforming item ${index + 1}/${inputData.length}`);
      
      const transformedItem = { ...item };
      
      for (const transformation of transformations) {
        try {
          const prompt = transformation.promptBuilder(transformedItem);
          
          const result = await this.router.quick(prompt, transformation.options || {});
          
          // Apply transformation result
          if (transformation.parseResult) {
            transformedItem[transformation.outputField] = transformation.parseResult(result.text);
          } else {
            transformedItem[transformation.outputField] = result.text;
          }
          
          // Add metadata
          transformedItem[`${transformation.outputField}_metadata`] = {
            tokens: result.tokens,
            latency: result.latency,
            model: result.model
          };
          
        } catch (error) {
          console.error(`❌ Transformation failed for item ${index}: ${error.message}`);
          transformedItem[transformation.outputField] = null;
          transformedItem[`${transformation.outputField}_error`] = error.message;
        }
      }
      
      results.push(transformedItem);
    }
    
    return results;
  }
}

// Example: Product data enrichment
async function demonstrateJSONTransformation() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const transformer = new JSONTransformer(router);
  
  const products = [
    {
      name: "Wireless Bluetooth Headphones",
      price: 99.99,
      category: "Electronics"
    },
    {
      name: "Organic Cotton T-Shirt",
      price: 29.99,
      category: "Clothing"
    },
    {
      name: "Stainless Steel Water Bottle",
      price: 24.99,
      category: "Home & Garden"
    }
  ];
  
  const transformations = [
    {
      outputField: "description",
      promptBuilder: (item) => 
        `Write a compelling product description for: ${item.name} (Category: ${item.category}, Price: $${item.price})`,
      options: { maxTokens: 100, temperature: 0.7 }
    },
    {
      outputField: "target_audience",
      promptBuilder: (item) => 
        `Who is the target audience for this product: ${item.name}? Be specific.`,
      options: { maxTokens: 50, temperature: 0.5 }
    },
    {
      outputField: "keywords",
      promptBuilder: (item) => 
        `Generate 5-7 SEO keywords for this product: ${item.name}. Return as comma-separated list.`,
      options: { maxTokens: 50, temperature: 0.3 },
      parseResult: (text) => text.split(',').map(k => k.trim())
    },
    {
      outputField: "price_category",
      promptBuilder: (item) => 
        `Categorize this price $${item.price} as: budget, mid-range, or premium. Return only the category.`,
      options: { maxTokens: 10, temperature: 0.1 },
      parseResult: (text) => text.toLowerCase().trim()
    }
  ];
  
  console.log('🔄 Starting product data transformation...');
  
  const enrichedProducts = await transformer.transformData(products, transformations);
  
  console.log('\n📋 Transformation Results:');
  enrichedProducts.forEach((product, index) => {
    console.log(`\n--- Product ${index + 1} ---`);
    console.log(`Name: ${product.name}`);
    console.log(`Description: ${product.description}`);
    console.log(`Target Audience: ${product.target_audience}`);
    console.log(`Keywords: ${Array.isArray(product.keywords) ? product.keywords.join(', ') : product.keywords}`);
    console.log(`Price Category: ${product.price_category}`);
  });
  
  // Save enriched data
  await fs.writeFile('enriched_products.json', JSON.stringify(enrichedProducts, null, 2));
  console.log('\n💾 Enriched products saved to enriched_products.json');
}

demonstrateJSONTransformation().catch(console.error);
```

## Performance Optimization

### Optimized Batch Processor

```javascript
class OptimizedBatchProcessor {
  constructor(router) {
    this.router = router;
    this.cache = new Map();
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      totalTime: 0
    };
  }
  
  async processBatchOptimized(prompts, options = {}) {
    const {
      enableCache = true,
      maxConcurrency = 5,
      groupSimilar = true,
      similarityThreshold = 0.8
    } = options;
    
    console.log('🚀 Starting optimized batch processing...');
    
    let processQueue = prompts.map((prompt, index) => ({ prompt, index }));
    
    // Group similar prompts if enabled
    if (groupSimilar) {
      processQueue = this.groupSimilarPrompts(processQueue, similarityThreshold);
    }
    
    const results = new Array(prompts.length);
    const semaphore = new Semaphore(maxConcurrency);
    
    const processPrompt = async ({ prompt, index, group }) => {
      const permit = await semaphore.acquire();
      
      try {
        this.stats.totalRequests++;
        const startTime = Date.now();
        
        // Check cache first
        const cacheKey = this.getCacheKey(prompt, options);
        
        if (enableCache && this.cache.has(cacheKey)) {
          this.stats.cacheHits++;
          const cachedResult = this.cache.get(cacheKey);
          
          results[index] = {
            ...cachedResult,
            index,
            prompt,
            fromCache: true,
            group
          };
          
          return;
        }
        
        this.stats.cacheMisses++;
        
        // Process the prompt
        const result = await this.router.quick(prompt, options);
        
        // Cache the result
        if (enableCache) {
          this.cache.set(cacheKey, result);
        }
        
        results[index] = {
          ...result,
          index,
          prompt,
          fromCache: false,
          group,
          processingTime: Date.now() - startTime
        };
        
        this.stats.totalTime += Date.now() - startTime;
        
      } finally {
        semaphore.release();
      }
    };
    
    await Promise.all(processQueue.map(processPrompt));
    
    return results;
  }
  
  groupSimilarPrompts(prompts, threshold) {
    const groups = [];
    const grouped = new Set();
    
    for (const prompt of prompts) {
      if (grouped.has(prompt.index)) continue;
      
      const group = [prompt];
      grouped.add(prompt.index);
      
      for (const other of prompts) {
        if (grouped.has(other.index)) continue;
        
        const similarity = this.calculateSimilarity(prompt.prompt, other.prompt);
        if (similarity >= threshold) {
          group.push(other);
          grouped.add(other.index);
        }
      }
      
      groups.push(group);
    }
    
    // Flatten with group info
    return groups.flatMap((group, groupIndex) => 
      group.map(prompt => ({ ...prompt, group: groupIndex }))
    );
  }
  
  calculateSimilarity(str1, str2) {
    // Simple similarity calculation (can be improved)
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }
  
  getCacheKey(prompt, options) {
    return JSON.stringify({ prompt, options });
  }
  
  getStats() {
    const cacheHitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      avgProcessingTime: this.stats.cacheMisses > 0 
        ? Math.round(this.stats.totalTime / this.stats.cacheMisses)
        : 0
    };
  }
  
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
}

// Simple semaphore implementation
class Semaphore {
  constructor(permits) {
    this.permits = permits;
    this.waiting = [];
  }
  
  async acquire() {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    
    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }
  
  release() {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve();
    } else {
      this.permits++;
    }
  }
}

// Demonstration
async function demonstrateOptimizedProcessing() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const processor = new OptimizedBatchProcessor(router);
  
  const prompts = [
    "What is machine learning?",
    "Explain machine learning concepts",  // Similar to first
    "What is artificial intelligence?",
    "Define artificial intelligence",     // Similar to third
    "How do neural networks work?",
    "What are neural networks?",         // Similar to fifth
    "Explain deep learning",
    "What is deep learning?",            // Similar to seventh
    "Define computer vision",
    "What is natural language processing?"
  ];
  
  console.log('First run (building cache):');
  const results1 = await processor.processBatchOptimized(prompts, {
    enableCache: true,
    maxConcurrency: 3,
    groupSimilar: true,
    maxTokens: 100,
    temperature: 0.7
  });
  
  console.log('\n📊 First run stats:', processor.getStats());
  
  console.log('\nSecond run (using cache):');
  const results2 = await processor.processBatchOptimized(prompts, {
    enableCache: true,
    maxConcurrency: 3,
    groupSimilar: true,
    maxTokens: 100,
    temperature: 0.7
  });
  
  console.log('\n📊 Second run stats:', processor.getStats());
  
  // Show cache usage
  const cached = results2.filter(r => r.fromCache);
  console.log(`\n💾 Cache effectiveness: ${cached.length}/${results2.length} responses from cache`);
}

demonstrateOptimizedProcessing().catch(console.error);
```

## Error Handling

### Robust Batch Processing with Retry Logic

```javascript
class RobustBatchProcessor {
  constructor(router) {
    this.router = router;
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 10000
    };
  }
  
  async processWithRetries(prompts, options = {}) {
    const results = [];
    const failed = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      let success = false;
      let lastError = null;
      
      for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.min(
              this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
              this.retryConfig.maxDelay
            );
            
            console.log(`🔄 Retry attempt ${attempt} for prompt ${i + 1} after ${delay}ms`);
            await this.sleep(delay);
          }
          
          const result = await this.router.quick(prompt, options);
          
          results.push({
            index: i,
            prompt,
            result,
            attempts: attempt + 1,
            success: true
          });
          
          success = true;
          break;
          
        } catch (error) {
          lastError = error;
          console.log(`❌ Attempt ${attempt + 1} failed for prompt ${i + 1}: ${error.message}`);
        }
      }
      
      if (!success) {
        failed.push({
          index: i,
          prompt,
          error: lastError.message,
          attempts: this.retryConfig.maxRetries + 1,
          success: false
        });
      }
    }
    
    return { results, failed };
  }
  
  async processWithFallbacks(prompts, options = {}) {
    const fallbackStrategies = [
      { strategy: 'quality-first', temperature: 0.7 },
      { strategy: 'speed-priority', temperature: 0.5 },
      { strategy: 'cost-optimized', temperature: 0.3 }
    ];
    
    const results = [];
    const completelyFailed = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      let success = false;
      let lastError = null;
      
      for (let strategyIndex = 0; strategyIndex < fallbackStrategies.length; strategyIndex++) {
        const strategy = fallbackStrategies[strategyIndex];
        
        try {
          // Switch strategy
          this.router.setStrategy(strategy.strategy);
          
          const result = await this.router.quick(prompt, {
            ...options,
            temperature: strategy.temperature
          });
          
          results.push({
            index: i,
            prompt,
            result,
            strategyUsed: strategy.strategy,
            strategyIndex,
            success: true
          });
          
          success = true;
          break;
          
        } catch (error) {
          lastError = error;
          console.log(`❌ Strategy '${strategy.strategy}' failed for prompt ${i + 1}: ${error.message}`);
        }
      }
      
      if (!success) {
        completelyFailed.push({
          index: i,
          prompt,
          error: lastError.message,
          allStrategiesFailed: true,
          success: false
        });
      }
    }
    
    return { results, completelyFailed };
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage example
async function demonstrateRobustProcessing() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/unreliable-model.gguf'); // Simulating potentially unreliable model
  
  const processor = new RobustBatchProcessor(router);
  
  const prompts = [
    "What is quantum computing?",
    "Explain blockchain technology",
    "How does machine learning work?",
    "What is artificial neural network?",
    "Define cryptocurrency"
  ];
  
  console.log('🛡️ Testing robust processing with retries...');
  
  const { results: retryResults, failed: retryFailed } = await processor.processWithRetries(prompts, {
    maxTokens: 150,
    temperature: 0.7
  });
  
  console.log('\n📊 Retry Results:');
  console.log(`Successful: ${retryResults.length}/${prompts.length}`);
  console.log(`Failed: ${retryFailed.length}/${prompts.length}`);
  
  if (retryFailed.length > 0) {
    console.log('\n🔄 Trying fallback strategies for failed prompts...');
    
    const failedPrompts = retryFailed.map(f => f.prompt);
    const { results: fallbackResults, completelyFailed } = await processor.processWithFallbacks(failedPrompts);
    
    console.log('\n📊 Fallback Results:');
    console.log(`Recovered: ${fallbackResults.length}/${failedPrompts.length}`);
    console.log(`Still failed: ${completelyFailed.length}/${failedPrompts.length}`);
    
    // Show which strategies worked
    const strategyStats = {};
    fallbackResults.forEach(r => {
      strategyStats[r.strategyUsed] = (strategyStats[r.strategyUsed] || 0) + 1;
    });
    
    console.log('\n📈 Strategy effectiveness:');
    Object.entries(strategyStats).forEach(([strategy, count]) => {
      console.log(`  ${strategy}: ${count} successful recoveries`);
    });
  }
}

demonstrateRobustProcessing().catch(console.error);
```

This comprehensive batch processing guide covers all major patterns for efficiently handling multiple prompts and data processing workflows with the LLM-Runner-Router system.