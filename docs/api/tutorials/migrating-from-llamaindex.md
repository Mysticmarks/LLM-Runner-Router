# Migrating from LlamaIndex to LLM-Runner-Router

## Table of Contents

1. [Overview and Introduction](#overview-and-introduction)
2. [Key Differences](#key-differences)
3. [Migration Strategy](#migration-strategy)
4. [Component Mapping](#component-mapping)
5. [Code Examples](#code-examples)
6. [Advanced Migration Patterns](#advanced-migration-patterns)
7. [Performance Considerations](#performance-considerations)
8. [Testing Strategies](#testing-strategies)
9. [Common Pitfalls](#common-pitfalls)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Related Documentation](#related-documentation)

## Overview and Introduction

Migrating from LlamaIndex to LLM-Runner-Router represents a strategic move towards a more flexible, performant, and provider-agnostic LLM orchestration system. This comprehensive guide will walk you through the migration process, highlighting architectural differences, providing code examples, and ensuring a smooth transition.

### Why Migrate?

**LLM-Runner-Router Advantages:**
- **Provider Agnostic**: Seamlessly switch between OpenAI, Anthropic, OpenRouter, Groq, and local models
- **Advanced Routing**: Intelligent model selection based on cost, quality, speed, and capabilities
- **Better Performance**: Optimized caching, load balancing, and streaming
- **Enterprise Features**: Multi-tenancy, audit logging, SLA monitoring
- **Format Flexibility**: Support for GGUF, ONNX, PyTorch, Safetensors, and more
- **Self-Healing**: Automatic failover and error recovery

### Migration Complexity Assessment

| Migration Aspect | Complexity | Time Estimate |
|-----------------|-----------|---------------|
| Basic RAG Pipeline | Low | 2-4 hours |
| Custom Retrievers | Medium | 1-2 days |
| Advanced Indexing | High | 3-5 days |
| Custom Agents | High | 5-7 days |
| Enterprise Setup | Medium | 2-3 days |

## Key Differences

### Architectural Philosophy

**LlamaIndex Architecture:**
```
Data Sources → Loaders → Documents → Indices → Query Engines → Responses
```

**LLM-Runner-Router Architecture:**
```
Models → Registry → Router → Pipeline → Engine → Results
```

### Core Concept Mapping

| LlamaIndex Concept | LLM-Runner-Router Equivalent | Notes |
|-------------------|----------------------------|--------|
| ServiceContext | LLMRouter + Config | Central configuration and model management |
| VectorStoreIndex | External (Pinecone/Chroma) + Pipeline | Vector operations handled by specialized services |
| QueryEngine | Pipeline + Router | Query processing with intelligent routing |
| ResponseSynthesizer | Pipeline.process() | Response generation and formatting |
| Retrievers | Custom Pipeline Components | Flexible retrieval patterns |
| Agents | Advanced Pipeline Configurations | Tool usage and function calling |
| Embeddings | APILoader.createEmbedding() | Provider-specific embedding generation |

### Configuration Differences

**LlamaIndex ServiceContext:**
```python
from llama_index import ServiceContext, LLMPredictor
from llama_index.llms import OpenAI

llm_predictor = LLMPredictor(llm=OpenAI(temperature=0, model="gpt-3.5-turbo"))
service_context = ServiceContext.from_defaults(llm_predictor=llm_predictor)
```

**LLM-Runner-Router Configuration:**
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  strategy: 'balanced',
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: ['gpt-3.5-turbo', 'gpt-4']
    }
  }
});
```

## Migration Strategy

### Phase 1: Assessment and Planning

**1. Audit Current Implementation**
```bash
# Create migration assessment
mkdir migration-assessment
cd migration-assessment

# Document current LlamaIndex usage
echo "# Current LlamaIndex Implementation" > current-state.md
echo "- Indices used: " >> current-state.md
echo "- Query patterns: " >> current-state.md
echo "- Custom components: " >> current-state.md
echo "- Performance requirements: " >> current-state.md
```

**2. Identify Dependencies**
```python
# Document LlamaIndex dependencies
import llama_index
print("LlamaIndex version:", llama_index.__version__)

# List custom components
custom_components = [
    "custom_retrievers",
    "custom_synthesizers", 
    "custom_agents",
    "custom_tools"
]
```

### Phase 2: Environment Setup

**1. Install LLM-Runner-Router**
```bash
npm install llm-runner-router
# or
yarn add llm-runner-router
```

**2. Configure Environment**
```javascript
// migration-config.js
export const migrationConfig = {
  llmRouter: {
    strategy: 'balanced',
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-3.5-turbo', 'gpt-4-turbo-preview']
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: ['claude-3-sonnet', 'claude-3-opus']
      }
    },
    fallbacks: ['gpt-3.5-turbo', 'claude-3-sonnet']
  },
  vectorStore: {
    provider: 'pinecone', // or 'chroma', 'weaviate'
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT
  }
};
```

### Phase 3: Component Migration

**1. Index Migration**
```javascript
// Before (LlamaIndex)
// from llama_index import VectorStoreIndex, SimpleDirectoryReader
// documents = SimpleDirectoryReader('data').load_data()
// index = VectorStoreIndex.from_documents(documents)

// After (LLM-Runner-Router with external vector store)
import { LLMRouter } from 'llm-runner-router';
import { PineconeClient } from '@pinecone-database/pinecone';

class MigratedRAGPipeline {
  constructor(config) {
    this.router = new LLMRouter(config.llmRouter);
    this.vectorStore = new PineconeClient();
    this.initialized = false;
  }

  async initialize() {
    await this.router.initialize();
    await this.vectorStore.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT
    });
    this.initialized = true;
  }

  async indexDocuments(documents) {
    if (!this.initialized) await this.initialize();
    
    const embeddings = await this.router.quick(
      'Generate embeddings', 
      { task: 'embedding', model: 'text-embedding-ada-002' }
    );
    
    // Store in Pinecone
    await this.vectorStore.upsert({
      vectors: documents.map((doc, i) => ({
        id: `doc_${i}`,
        values: embeddings[i],
        metadata: { text: doc.text, source: doc.source }
      }))
    });
  }
}
```

### Phase 4: Query Migration

**1. Query Engine Migration**
```javascript
// Enhanced RAG Pipeline
class EnhancedRAGPipeline extends MigratedRAGPipeline {
  async query(question, options = {}) {
    const {
      topK = 5,
      strategy = 'balanced',
      temperature = 0.7,
      maxTokens = 1000
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.router.quick(
      question, 
      { task: 'embedding', model: 'text-embedding-ada-002' }
    );

    // Retrieve similar documents
    const searchResults = await this.vectorStore.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });

    // Build context
    const context = searchResults.matches
      .map(match => match.metadata.text)
      .join('\n\n');

    // Generate response with context
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    
    return await this.router.quick(prompt, {
      strategy,
      temperature,
      maxTokens,
      model: options.preferredModel
    });
  }

  // Streaming query for real-time responses
  async* streamQuery(question, options = {}) {
    // Same retrieval logic...
    const context = await this.getContext(question, options);
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    
    // Stream the response
    for await (const token of this.router.stream(prompt, options)) {
      yield token;
    }
  }

  async getContext(question, options = {}) {
    const queryEmbedding = await this.router.quick(
      question, 
      { task: 'embedding', model: 'text-embedding-ada-002' }
    );

    const searchResults = await this.vectorStore.query({
      vector: queryEmbedding,
      topK: options.topK || 5,
      includeMetadata: true
    });

    return searchResults.matches
      .map(match => match.metadata.text)
      .join('\n\n');
  }
}
```

## Component Mapping

### Service Context Migration

**LlamaIndex ServiceContext:**
```python
service_context = ServiceContext.from_defaults(
    llm=OpenAI(model="gpt-4", temperature=0.1),
    embed_model="local:BAAI/bge-small-en",
    chunk_size=512,
    chunk_overlap=20
)
```

**LLM-Runner-Router Equivalent:**
```javascript
const serviceConfig = {
  llm: {
    strategy: 'quality-first',
    primaryModel: 'gpt-4',
    fallbacks: ['gpt-3.5-turbo', 'claude-3-sonnet'],
    temperature: 0.1
  },
  embeddings: {
    model: 'text-embedding-ada-002',
    provider: 'openai'
  },
  chunking: {
    size: 512,
    overlap: 20,
    strategy: 'recursive'
  }
};

class ServiceContextEquivalent {
  constructor(config) {
    this.router = new LLMRouter(config.llm);
    this.embeddingConfig = config.embeddings;
    this.chunkingConfig = config.chunking;
  }

  async generateResponse(prompt, options = {}) {
    return await this.router.quick(prompt, {
      ...this.serviceConfig.llm,
      ...options
    });
  }

  async generateEmbedding(text) {
    return await this.router.quick(text, {
      task: 'embedding',
      model: this.embeddingConfig.model,
      provider: this.embeddingConfig.provider
    });
  }
}
```

### Index Migration Patterns

**1. Vector Store Index**
```javascript
class VectorStoreIndexMigration {
  constructor(vectorStore, llmRouter) {
    this.vectorStore = vectorStore;
    this.llmRouter = llmRouter;
  }

  // Equivalent to LlamaIndex.from_documents()
  static async fromDocuments(documents, vectorStore, llmRouter) {
    const instance = new VectorStoreIndexMigration(vectorStore, llmRouter);
    await instance.addDocuments(documents);
    return instance;
  }

  async addDocuments(documents) {
    const chunks = this.chunkDocuments(documents);
    const embeddings = await Promise.all(
      chunks.map(chunk => 
        this.llmRouter.quick(chunk.text, { task: 'embedding' })
      )
    );

    await this.vectorStore.upsert(
      chunks.map((chunk, i) => ({
        id: chunk.id,
        values: embeddings[i],
        metadata: chunk.metadata
      }))
    );
  }

  chunkDocuments(documents) {
    // Implement chunking strategy
    return documents.flatMap(doc => 
      this.splitDocument(doc)
    );
  }
}
```

**2. Summary Index Migration**
```javascript
class SummaryIndexMigration {
  constructor(llmRouter) {
    this.llmRouter = llmRouter;
    this.summaries = new Map();
  }

  async addDocument(document) {
    const summary = await this.llmRouter.quick(
      `Summarize the following document:\n\n${document.text}`,
      { strategy: 'quality-first', maxTokens: 500 }
    );
    
    this.summaries.set(document.id, {
      summary: summary.text,
      originalDocument: document
    });
  }

  async query(question) {
    const relevantSummaries = Array.from(this.summaries.values())
      .map(item => item.summary)
      .join('\n\n');

    return await this.llmRouter.quick(
      `Based on the following summaries, answer the question:\n\nSummaries:\n${relevantSummaries}\n\nQuestion: ${question}`,
      { strategy: 'balanced' }
    );
  }
}
```

## Code Examples

### Basic RAG Implementation

```javascript
import { LLMRouter } from 'llm-runner-router';
import { ChromaClient } from 'chromadb';

class BasicRAG {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
      }
    });
    
    this.vectorStore = new ChromaClient({
      host: 'localhost',
      port: 8000
    });
  }

  async initialize() {
    await this.router.initialize();
    this.collection = await this.vectorStore.createCollection({
      name: 'documents',
      embeddingFunction: this.getEmbedding.bind(this)
    });
  }

  async getEmbedding(text) {
    const result = await this.router.quick(text, {
      task: 'embedding',
      model: 'text-embedding-ada-002'
    });
    return result.embedding;
  }

  async addDocuments(documents) {
    await this.collection.add({
      documents: documents.map(doc => doc.text),
      metadatas: documents.map(doc => doc.metadata),
      ids: documents.map((doc, i) => `doc_${i}`)
    });
  }

  async query(question, options = {}) {
    const results = await this.collection.query({
      queryTexts: [question],
      nResults: options.topK || 5
    });

    const context = results.documents[0].join('\n\n');
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

    return await this.router.quick(prompt, {
      strategy: options.strategy || 'balanced',
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 1000
    });
  }
}

// Usage
const rag = new BasicRAG();
await rag.initialize();

await rag.addDocuments([
  { text: 'Document 1 content...', metadata: { source: 'doc1.pdf' } },
  { text: 'Document 2 content...', metadata: { source: 'doc2.pdf' } }
]);

const response = await rag.query('What is the main topic?');
console.log(response.text);
```

### Advanced Agent Migration

```javascript
class AgentMigration {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'capability-match',
      providers: {
        openai: { 
          apiKey: process.env.OPENAI_API_KEY,
          models: ['gpt-4-turbo-preview'] // For function calling
        }
      }
    });

    this.tools = new Map();
    this.conversationHistory = [];
  }

  registerTool(name, description, handler) {
    this.tools.set(name, {
      name,
      description,
      handler,
      schema: this.generateSchema(handler)
    });
  }

  generateSchema(handler) {
    // Generate OpenAPI schema for the tool
    return {
      type: 'function',
      function: {
        name: handler.name,
        description: handler.description,
        parameters: handler.parameters || { type: 'object', properties: {} }
      }
    };
  }

  async processQuery(userInput) {
    this.conversationHistory.push({ role: 'user', content: userInput });

    const tools = Array.from(this.tools.values()).map(tool => tool.schema);
    
    const response = await this.router.quick(userInput, {
      messages: this.conversationHistory,
      tools,
      toolChoice: 'auto',
      model: 'gpt-4-turbo-preview'
    });

    if (response.toolCalls) {
      // Execute tools
      const toolResults = await Promise.all(
        response.toolCalls.map(async toolCall => {
          const tool = this.tools.get(toolCall.function.name);
          if (!tool) throw new Error(`Unknown tool: ${toolCall.function.name}`);
          
          const result = await tool.handler(
            JSON.parse(toolCall.function.arguments)
          );
          
          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          };
        })
      );

      // Add tool results to conversation
      this.conversationHistory.push(...toolResults);

      // Generate final response
      const finalResponse = await this.router.quick('', {
        messages: this.conversationHistory,
        model: 'gpt-4-turbo-preview'
      });

      return finalResponse.text;
    }

    return response.text;
  }
}

// Usage Example
const agent = new AgentMigration();

agent.registerTool(
  'search_documents',
  'Search through documents for relevant information',
  async ({ query }) => {
    // Implement document search
    return { results: 'Search results...' };
  }
);

agent.registerTool(
  'calculate',
  'Perform mathematical calculations',
  async ({ expression }) => {
    // Implement calculation
    return { result: eval(expression) };
  }
);

const response = await agent.processQuery(
  'Search for information about machine learning and calculate 25 * 4'
);
```

### Streaming Migration

```javascript
class StreamingMigration {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'speed-priority',
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
      }
    });
  }

  // Migrate LlamaIndex streaming query
  async* migrateStreamingQuery(question, context) {
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    
    try {
      for await (const token of this.router.stream(prompt, {
        strategy: 'speed-priority',
        temperature: 0.7,
        maxTokens: 1000
      })) {
        yield {
          text: token.text,
          finished: false,
          metadata: token.raw
        };
      }
      
      yield { text: '', finished: true };
    } catch (error) {
      yield { 
        text: '', 
        finished: true, 
        error: error.message 
      };
    }
  }

  // Real-time RAG with streaming
  async* streamingRAG(question, vectorStore) {
    // Retrieve context (non-streaming)
    const context = await this.getContext(question, vectorStore);
    
    // Stream the response generation
    let fullResponse = '';
    for await (const chunk of this.migrateStreamingQuery(question, context)) {
      if (!chunk.finished) {
        fullResponse += chunk.text;
        yield {
          partialResponse: fullResponse,
          chunk: chunk.text,
          finished: false
        };
      } else {
        yield {
          finalResponse: fullResponse,
          finished: true,
          error: chunk.error
        };
      }
    }
  }

  async getContext(question, vectorStore) {
    // Implementation depends on vector store
    const results = await vectorStore.similaritySearch(question, 5);
    return results.map(r => r.content).join('\n\n');
  }
}

// Usage with Express.js
app.get('/stream-query', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const streaming = new StreamingMigration();
  
  for await (const chunk of streaming.streamingRAG(req.query.question, vectorStore)) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    
    if (chunk.finished) {
      break;
    }
  }
  
  res.end();
});
```

## Advanced Migration Patterns

### Custom Retriever Migration

```javascript
// LlamaIndex Custom Retriever equivalent
class CustomRetrieverMigration {
  constructor(vectorStore, llmRouter) {
    this.vectorStore = vectorStore;
    this.llmRouter = llmRouter;
    this.retrievalStrategies = new Map();
  }

  registerRetrievalStrategy(name, strategy) {
    this.retrievalStrategies.set(name, strategy);
  }

  async hybridRetrieval(query, options = {}) {
    const {
      strategies = ['semantic', 'keyword', 'metadata'],
      weights = [0.6, 0.3, 0.1],
      topK = 10
    } = options;

    const results = await Promise.all(
      strategies.map(async (strategy, index) => {
        const retriever = this.retrievalStrategies.get(strategy);
        const strategyResults = await retriever(query, { topK });
        
        return strategyResults.map(result => ({
          ...result,
          score: result.score * weights[index],
          strategy
        }));
      })
    );

    // Merge and deduplicate results
    const mergedResults = this.mergeResults(results.flat());
    
    // Re-rank using LLM
    return await this.rerank(query, mergedResults, topK);
  }

  mergeResults(results) {
    const idMap = new Map();
    
    results.forEach(result => {
      const existing = idMap.get(result.id);
      if (existing) {
        existing.score = Math.max(existing.score, result.score);
        existing.strategies.push(result.strategy);
      } else {
        idMap.set(result.id, {
          ...result,
          strategies: [result.strategy]
        });
      }
    });

    return Array.from(idMap.values())
      .sort((a, b) => b.score - a.score);
  }

  async rerank(query, results, topK) {
    const rerankPrompt = `
Rerank the following search results based on relevance to the query: "${query}"

Results:
${results.map((r, i) => `${i + 1}. ${r.content.substring(0, 200)}...`).join('\n')}

Return the rankings as a JSON array of numbers representing the new order (1-based indexing).
`;

    const rerankResponse = await this.llmRouter.quick(rerankPrompt, {
      strategy: 'quality-first',
      responseFormat: { type: 'json_object' }
    });

    try {
      const newOrder = JSON.parse(rerankResponse.text).rankings;
      return newOrder.slice(0, topK).map(idx => results[idx - 1]);
    } catch {
      // Fallback to original order
      return results.slice(0, topK);
    }
  }
}

// Register retrieval strategies
const customRetriever = new CustomRetrieverMigration(vectorStore, router);

customRetriever.registerRetrievalStrategy('semantic', async (query, options) => {
  const embedding = await router.quick(query, { task: 'embedding' });
  return await vectorStore.similaritySearch(embedding, options.topK);
});

customRetriever.registerRetrievalStrategy('keyword', async (query, options) => {
  return await vectorStore.keywordSearch(query, options.topK);
});

customRetriever.registerRetrievalStrategy('metadata', async (query, options) => {
  return await vectorStore.metadataFilter(query, options.topK);
});
```

### Response Synthesizer Migration

```javascript
class ResponseSynthesizerMigration {
  constructor(llmRouter) {
    this.llmRouter = llmRouter;
    this.synthesisStrategies = {
      'tree_summarize': this.treeSummarize.bind(this),
      'refine': this.refine.bind(this),
      'compact': this.compact.bind(this),
      'simple_summarize': this.simpleSummarize.bind(this)
    };
  }

  async synthesizeResponse(query, nodes, strategy = 'refine', options = {}) {
    const synthesizer = this.synthesisStrategies[strategy];
    if (!synthesizer) {
      throw new Error(`Unknown synthesis strategy: ${strategy}`);
    }

    return await synthesizer(query, nodes, options);
  }

  async treeSummarize(query, nodes, options = {}) {
    if (nodes.length === 1) {
      return await this.generateResponse(query, nodes[0].content, options);
    }

    // Recursively summarize pairs of nodes
    const summarizedNodes = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const pair = nodes.slice(i, i + 2);
      const combinedContent = pair.map(n => n.content).join('\n\n');
      
      const summary = await this.llmRouter.quick(
        `Summarize the following content in the context of the query: "${query}"\n\n${combinedContent}`,
        { ...options, maxTokens: 500 }
      );

      summarizedNodes.push({
        content: summary.text,
        metadata: { source: 'tree_summary', originalNodes: pair.length }
      });
    }

    // Recursively process until we have a single summary
    return await this.treeSummarize(query, summarizedNodes, options);
  }

  async refine(query, nodes, options = {}) {
    let currentAnswer = '';

    for (const [index, node] of nodes.entries()) {
      const prompt = index === 0 
        ? `Context: ${node.content}\n\nQuery: ${query}\n\nAnswer:`
        : `
Original query: ${query}
Existing answer: ${currentAnswer}

New context: ${node.content}

Instructions: Refine the existing answer using the new context. 
If the new context is not relevant, return the existing answer unchanged.

Refined answer:`;

      const response = await this.llmRouter.quick(prompt, {
        ...options,
        strategy: 'quality-first'
      });

      currentAnswer = response.text;
    }

    return { text: currentAnswer };
  }

  async compact(query, nodes, options = {}) {
    const maxChunkSize = options.maxChunkSize || 3000;
    const chunks = this.createCompactChunks(nodes, maxChunkSize);
    
    const responses = await Promise.all(
      chunks.map(chunk => 
        this.generateResponse(query, chunk, options)
      )
    );

    // Combine responses
    const combinedResponse = responses.map(r => r.text).join(' ');
    
    // Final refinement
    return await this.llmRouter.quick(
      `Synthesize the following responses into a coherent answer for: "${query}"\n\nResponses:\n${combinedResponse}`,
      { ...options, strategy: 'quality-first' }
    );
  }

  async simpleSummarize(query, nodes, options = {}) {
    const context = nodes.map(n => n.content).join('\n\n');
    return await this.generateResponse(query, context, options);
  }

  async generateResponse(query, context, options = {}) {
    const prompt = `Context:\n${context}\n\nQuery: ${query}\n\nAnswer:`;
    
    return await this.llmRouter.quick(prompt, {
      strategy: 'balanced',
      temperature: 0.7,
      maxTokens: 1000,
      ...options
    });
  }

  createCompactChunks(nodes, maxChunkSize) {
    const chunks = [];
    let currentChunk = '';

    for (const node of nodes) {
      if (currentChunk.length + node.content.length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = node.content;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + node.content;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
```

## Performance Considerations

### Optimization Strategies

**1. Caching Implementation**
```javascript
class OptimizedRAGMigration {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      caching: {
        enabled: true,
        ttl: 3600000, // 1 hour
        maxSize: 1000
      }
    });

    this.queryCache = new Map();
    this.embeddingCache = new Map();
  }

  async cachedQuery(question, options = {}) {
    const cacheKey = this.generateCacheKey(question, options);
    
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }

    const result = await this.performQuery(question, options);
    this.queryCache.set(cacheKey, result);
    
    return result;
  }

  generateCacheKey(question, options) {
    const optionsStr = JSON.stringify(options);
    return `${question}_${optionsStr}`;
  }
}
```

**2. Batch Processing**
```javascript
class BatchMigration {
  constructor() {
    this.router = new LLMRouter();
    this.batchQueue = [];
    this.processingBatch = false;
  }

  async batchQuery(questions) {
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(q => this.router.quick(q.prompt, q.options))
      );
      results.push(...batchResults);
    }

    return results;
  }
}
```

### Memory Management

```javascript
class MemoryOptimizedMigration {
  constructor() {
    this.router = new LLMRouter();
    this.documentChunks = new WeakMap(); // Automatic garbage collection
    this.activeQueries = new Set();
  }

  async processLargeDataset(documents) {
    const chunkSize = 1000;
    
    for (let i = 0; i < documents.length; i += chunkSize) {
      const chunk = documents.slice(i, i + chunkSize);
      await this.processChunk(chunk);
      
      // Explicit cleanup
      if (global.gc) {
        global.gc();
      }
    }
  }

  async processChunk(chunk) {
    const embeddings = await this.router.quick(
      chunk.map(doc => doc.text),
      { task: 'embedding', batch: true }
    );

    // Process embeddings
    await this.storeEmbeddings(embeddings);
  }
}
```

## Testing Strategies

### Unit Testing Migration

```javascript
// test/migration.test.js
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MigratedRAGPipeline } from '../src/migration/rag-pipeline.js';

describe('Migration Tests', () => {
  let pipeline;
  let mockVectorStore;
  let mockRouter;

  beforeEach(() => {
    mockVectorStore = {
      upsert: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue({
        matches: [{ metadata: { text: 'Test content' } }]
      })
    };

    mockRouter = {
      quick: jest.fn().mockResolvedValue({ text: 'Test response' }),
      stream: jest.fn().mockImplementation(async function* () {
        yield { text: 'Test' };
        yield { text: ' response' };
      })
    };

    pipeline = new MigratedRAGPipeline({
      vectorStore: mockVectorStore,
      router: mockRouter
    });
  });

  test('should migrate basic query functionality', async () => {
    const result = await pipeline.query('Test question');
    
    expect(mockRouter.quick).toHaveBeenCalledTimes(2); // Embedding + completion
    expect(result.text).toBe('Test response');
  });

  test('should handle streaming queries', async () => {
    const chunks = [];
    for await (const chunk of pipeline.streamQuery('Test question')) {
      chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['Test', ' response']);
  });

  test('should maintain compatibility with LlamaIndex patterns', async () => {
    // Test that the migration maintains expected behavior
    const documents = [
      { text: 'Document 1', metadata: { source: 'test1.txt' } },
      { text: 'Document 2', metadata: { source: 'test2.txt' } }
    ];

    await pipeline.addDocuments(documents);
    
    expect(mockVectorStore.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({ source: 'test1.txt' })
        })
      ])
    );
  });
});
```

### Integration Testing

```javascript
// test/integration/migration-integration.test.js
import { describe, test, expect } from '@jest/globals';
import { LLMRouter } from 'llm-runner-router';
import { MigratedRAGPipeline } from '../src/migration/rag-pipeline.js';

describe('Migration Integration Tests', () => {
  test('should work with real LLM providers', async () => {
    const router = new LLMRouter({
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY
        }
      }
    });

    const pipeline = new MigratedRAGPipeline({ router });
    
    const response = await pipeline.query('What is machine learning?');
    
    expect(response).toBeDefined();
    expect(typeof response.text).toBe('string');
    expect(response.text.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for API calls
});
```

### Performance Testing

```javascript
// test/performance/migration-performance.test.js
import { performance } from 'perf_hooks';

describe('Migration Performance Tests', () => {
  test('should maintain acceptable query latency', async () => {
    const pipeline = new MigratedRAGPipeline();
    const questions = Array(100).fill('Test question');
    
    const startTime = performance.now();
    
    const results = await Promise.all(
      questions.map(q => pipeline.query(q))
    );
    
    const endTime = performance.now();
    const avgLatency = (endTime - startTime) / questions.length;
    
    expect(avgLatency).toBeLessThan(1000); // < 1 second average
    expect(results.length).toBe(100);
  });
});
```

## Common Pitfalls

### 1. Configuration Mismatches

**Problem:**
```javascript
// Incorrect: Direct LlamaIndex configuration translation
const config = {
  llm: 'gpt-4', // Wrong: should be object
  temperature: 0.1 // Wrong: should be in model options
};
```

**Solution:**
```javascript
// Correct: Proper LLM-Runner-Router configuration
const config = {
  strategy: 'quality-first',
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: ['gpt-4']
    }
  },
  defaults: {
    temperature: 0.1,
    maxTokens: 1000
  }
};
```

### 2. Vector Store Integration Issues

**Problem:**
```javascript
// Incorrect: Assuming built-in vector storage
const index = new VectorIndex(documents);
```

**Solution:**
```javascript
// Correct: Explicit vector store integration
const vectorStore = new PineconeClient();
const pipeline = new RAGPipeline({ vectorStore });
await pipeline.initialize();
await pipeline.indexDocuments(documents);
```

### 3. Embedding Handling

**Problem:**
```javascript
// Incorrect: Assuming automatic embedding generation
const results = vectorStore.search(query); // Won't work
```

**Solution:**
```javascript
// Correct: Explicit embedding generation
const queryEmbedding = await router.quick(query, { task: 'embedding' });
const results = await vectorStore.search(queryEmbedding);
```

### 4. Error Handling

**Problem:**
```javascript
// Incorrect: No error handling
const response = await router.quick(prompt);
return response.text;
```

**Solution:**
```javascript
// Correct: Comprehensive error handling
try {
  const response = await router.quick(prompt, {
    fallbacks: ['gpt-3.5-turbo', 'claude-3-sonnet'],
    maxRetries: 3,
    timeout: 30000
  });
  return response.text;
} catch (error) {
  logger.error('Query failed:', error);
  throw new Error(`Query processing failed: ${error.message}`);
}
```

### 5. Async/Await Patterns

**Problem:**
```python
# LlamaIndex (Python) synchronous style
response = query_engine.query("Question")
```

**JavaScript Translation Issues:**
```javascript
// Incorrect: Missing await
const response = router.quick("Question"); // Returns Promise
return response.text; // undefined
```

**Solution:**
```javascript
// Correct: Proper async handling
const response = await router.quick("Question");
return response.text;
```

## Best Practices

### 1. Configuration Management

```javascript
// config/migration-config.js
export const createMigrationConfig = (environment) => ({
  development: {
    router: {
      strategy: 'balanced',
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY }
      },
      fallbacks: ['gpt-3.5-turbo'],
      timeout: 30000
    },
    vectorStore: {
      provider: 'chroma',
      host: 'localhost',
      port: 8000
    }
  },
  production: {
    router: {
      strategy: 'cost-optimized',
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
      },
      fallbacks: ['gpt-3.5-turbo', 'claude-3-sonnet'],
      timeout: 60000
    },
    vectorStore: {
      provider: 'pinecone',
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT
    }
  }
})[environment];
```

### 2. Monitoring and Logging

```javascript
import { Logger } from 'llm-runner-router/utils';

class MonitoredMigration {
  constructor() {
    this.logger = new Logger('Migration');
    this.metrics = {
      queries: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0
    };
  }

  async query(question, options = {}) {
    const startTime = Date.now();
    this.metrics.queries++;

    try {
      this.logger.info('Processing query', { question: question.substring(0, 100) });
      
      const result = await this.performQuery(question, options);
      
      this.metrics.successes++;
      const latency = Date.now() - startTime;
      this.updateLatency(latency);
      
      this.logger.info('Query successful', { latency });
      return result;
      
    } catch (error) {
      this.metrics.failures++;
      this.logger.error('Query failed', { error: error.message });
      throw error;
    }
  }

  updateLatency(latency) {
    const totalQueries = this.metrics.successes;
    this.metrics.avgLatency = (
      (this.metrics.avgLatency * (totalQueries - 1) + latency) / totalQueries
    );
  }

  getHealthMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successes / this.metrics.queries,
      failureRate: this.metrics.failures / this.metrics.queries
    };
  }
}
```

### 3. Gradual Migration Strategy

```javascript
// migration/gradual-migration.js
class GradualMigration {
  constructor() {
    this.llamaIndex = null; // Keep existing system
    this.llmRouter = null;  // New system
    this.migrationPercentage = 0; // Start with 0% on new system
  }

  async initialize(llamaIndexInstance, llmRouterConfig) {
    this.llamaIndex = llamaIndexInstance;
    this.llmRouter = new LLMRouter(llmRouterConfig);
    await this.llmRouter.initialize();
  }

  setMigrationPercentage(percentage) {
    this.migrationPercentage = Math.max(0, Math.min(100, percentage));
    console.log(`Migration percentage set to ${this.migrationPercentage}%`);
  }

  async query(question, options = {}) {
    const shouldUseLLMRouter = Math.random() * 100 < this.migrationPercentage;
    
    if (shouldUseLLMRouter) {
      try {
        return await this.queryWithLLMRouter(question, options);
      } catch (error) {
        console.warn('LLM-Router failed, falling back to LlamaIndex:', error);
        return await this.queryWithLlamaIndex(question, options);
      }
    } else {
      return await this.queryWithLlamaIndex(question, options);
    }
  }

  async queryWithLLMRouter(question, options) {
    return await this.llmRouter.quick(question, options);
  }

  async queryWithLlamaIndex(question, options) {
    // Call existing LlamaIndex system
    return await this.llamaIndex.query(question, options);
  }
}

// Usage: Gradually increase migration percentage
const migration = new GradualMigration();
await migration.initialize(existingLlamaIndex, llmRouterConfig);

// Week 1: 10% traffic
migration.setMigrationPercentage(10);

// Week 2: 25% traffic
migration.setMigrationPercentage(25);

// Week 4: 50% traffic
migration.setMigrationPercentage(50);

// Week 8: 100% traffic
migration.setMigrationPercentage(100);
```

### 4. Data Migration Utilities

```javascript
// utils/data-migration.js
export class DataMigrationUtils {
  static async migrateLlamaIndexData(sourceIndex, targetPipeline) {
    console.log('Starting data migration...');
    
    // Extract documents from LlamaIndex
    const documents = await this.extractDocuments(sourceIndex);
    console.log(`Found ${documents.length} documents to migrate`);
    
    // Batch process documents
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await targetPipeline.addDocuments(batch);
      console.log(`Migrated batch ${Math.floor(i / batchSize) + 1}`);
    }
    
    console.log('Data migration completed');
  }

  static async extractDocuments(llamaIndexInstance) {
    // Implementation depends on LlamaIndex version and index type
    // This is a conceptual example
    const documents = [];
    
    // Extract from different index types
    if (llamaIndexInstance.type === 'VectorStoreIndex') {
      documents.push(...await this.extractFromVectorIndex(llamaIndexInstance));
    } else if (llamaIndexInstance.type === 'SummaryIndex') {
      documents.push(...await this.extractFromSummaryIndex(llamaIndexInstance));
    }
    
    return documents;
  }

  static async validateMigration(sourceIndex, targetPipeline, testQueries) {
    console.log('Validating migration...');
    
    const results = [];
    for (const query of testQueries) {
      const sourceResult = await sourceIndex.query(query);
      const targetResult = await targetPipeline.query(query);
      
      results.push({
        query,
        sourceResult: sourceResult.response,
        targetResult: targetResult.text,
        similarity: await this.calculateSimilarity(
          sourceResult.response, 
          targetResult.text
        )
      });
    }
    
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    console.log(`Migration validation complete. Average similarity: ${avgSimilarity.toFixed(2)}`);
    
    return results;
  }

  static async calculateSimilarity(text1, text2) {
    // Simple similarity calculation - in production, use proper semantic similarity
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }
}
```

## Troubleshooting

### Common Migration Issues

**1. Model Loading Failures**
```javascript
// Problem: Model loading fails silently
try {
  const model = await router.load('gpt-4');
} catch (error) {
  // No error handling
}

// Solution: Comprehensive error handling
try {
  const model = await router.load('gpt-4', {
    fallbacks: ['gpt-3.5-turbo'],
    timeout: 30000,
    retries: 3
  });
} catch (error) {
  console.error('Model loading failed:', {
    error: error.message,
    stack: error.stack,
    modelId: 'gpt-4',
    timestamp: new Date().toISOString()
  });
  
  // Implement fallback strategy
  const fallbackModel = await router.load('gpt-3.5-turbo');
  return fallbackModel;
}
```

**2. Vector Store Connection Issues**
```javascript
// Debugging vector store connections
class VectorStoreDebugger {
  static async diagnoseConnection(vectorStore) {
    try {
      // Test basic connectivity
      await vectorStore.ping();
      console.log('✅ Vector store connectivity: OK');
      
      // Test basic operations
      await vectorStore.upsert([{
        id: 'test',
        values: Array(1536).fill(0.1),
        metadata: { test: true }
      }]);
      console.log('✅ Vector store upsert: OK');
      
      // Test query
      const results = await vectorStore.query({
        vector: Array(1536).fill(0.1),
        topK: 1,
        includeMetadata: true
      });
      console.log('✅ Vector store query: OK', { resultsCount: results.matches.length });
      
      // Cleanup
      await vectorStore.deleteVectors(['test']);
      
    } catch (error) {
      console.error('❌ Vector store diagnosis failed:', error);
      return false;
    }
    
    return true;
  }
}
```

**3. Performance Degradation**
```javascript
// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  async monitorQuery(queryFn, identifier) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await queryFn();
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const metrics = {
        duration: Number(endTime - startTime) / 1000000, // Convert to milliseconds
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        timestamp: Date.now()
      };
      
      this.recordMetrics(identifier, metrics);
      
      return result;
    } catch (error) {
      this.recordError(identifier, error);
      throw error;
    }
  }

  recordMetrics(identifier, metrics) {
    if (!this.metrics.has(identifier)) {
      this.metrics.set(identifier, []);
    }
    
    const history = this.metrics.get(identifier);
    history.push(metrics);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
  }

  getPerformanceReport(identifier) {
    const history = this.metrics.get(identifier) || [];
    if (history.length === 0) return null;
    
    const durations = history.map(m => m.duration);
    const memoryDeltas = history.map(m => m.memoryDelta);
    
    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      avgMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
      measurementCount: history.length
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();

const result = await monitor.monitorQuery(
  () => pipeline.query('What is machine learning?'),
  'basic-query'
);

console.log(monitor.getPerformanceReport('basic-query'));
```

### Debug Utilities

```javascript
// debug/migration-debugger.js
export class MigrationDebugger {
  static enableDebugLogging() {
    process.env.DEBUG = 'llm-runner-router:*';
  }

  static async compareResponses(llamaIndexResponse, llmRouterResponse, query) {
    return {
      query,
      llamaIndex: {
        response: llamaIndexResponse.response,
        sourceNodes: llamaIndexResponse.source_nodes?.length || 0,
        metadata: llamaIndexResponse.metadata
      },
      llmRouter: {
        response: llmRouterResponse.text,
        usage: llmRouterResponse.usage,
        model: llmRouterResponse.model
      },
      similarity: await this.calculateSemanticSimilarity(
        llamaIndexResponse.response,
        llmRouterResponse.text
      ),
      timestamp: new Date().toISOString()
    };
  }

  static async debugQuery(pipeline, query, options = {}) {
    console.log('🔍 Debug Query Started', { query, options });
    
    try {
      // Log configuration
      console.log('📝 Configuration:', pipeline.config);
      
      // Log available models
      const models = await pipeline.router.registry.getAll();
      console.log('🤖 Available Models:', models.map(m => m.id));
      
      // Execute query with timing
      const start = Date.now();
      const result = await pipeline.query(query, options);
      const duration = Date.now() - start;
      
      console.log('✅ Query Completed', { 
        duration: `${duration}ms`,
        responseLength: result.text?.length || 0,
        model: result.model
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Query Failed', {
        error: error.message,
        stack: error.stack,
        query,
        options
      });
      throw error;
    }
  }
}
```

## Related Documentation

- [**Cost-Effective RAG Tutorial**](./cost-effective-rag.md) - Optimize RAG costs during migration
- [**Streaming UI Integration**](./streaming-ui-integration.md) - Implement real-time responses
- [**Function Calling Patterns**](./function-calling-patterns.md) - Migrate agents and tools
- [**Advanced Routing**](../advanced/routing.md) - Configure intelligent model selection
- [**Enterprise Features**](../advanced/enterprise.md) - Scale your migration
- [**Custom Adapters**](../advanced/custom-adapters.md) - Build custom integrations

### External Resources

- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Vector Database Comparisons](https://www.pinecone.io/learn/vector-database/)
- [RAG Evaluation Frameworks](https://docs.llamaindex.ai/en/stable/module_guides/evaluating/)

### Community Support

- [GitHub Issues](https://github.com/echo-ai-systems/llm-runner-router/issues)
- [Discussions](https://github.com/echo-ai-systems/llm-runner-router/discussions)
- [Discord Community](https://discord.gg/llm-runner-router)

---

*This migration guide is continuously updated based on community feedback and new features. Last updated: January 2025*