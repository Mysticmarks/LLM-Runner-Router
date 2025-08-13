# Document QA Examples

This guide demonstrates building document question-answering systems using the LLM-Runner-Router. From simple text analysis to sophisticated RAG (Retrieval-Augmented Generation) implementations.

## Table of Contents
- [Basic Document QA](#basic-document-qa)
- [Multi-Document Processing](#multi-document-processing)
- [Vector-Based RAG](#vector-based-rag)
- [PDF Processing](#pdf-processing)
- [Real-Time Document Chat](#real-time-document-chat)
- [Advanced Features](#advanced-features)

## Basic Document QA

### Simple Text Document QA

```javascript
import fs from 'fs/promises';
import LLMRouter from 'llm-runner-router';

class SimpleDocumentQA {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'quality-first',
      logLevel: 'info'
    });
    this.documents = new Map();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/qa-model.gguf');
    console.log('📚 Document QA system ready');
  }
  
  async loadDocument(filePath, documentId = null) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const id = documentId || this.generateDocumentId(filePath);
      
      const document = {
        id,
        filePath,
        content,
        loadedAt: new Date(),
        wordCount: content.split(/\s+/).length,
        characterCount: content.length
      };
      
      this.documents.set(id, document);
      console.log(`📄 Loaded document: ${id} (${document.wordCount} words)`);
      
      return document;
    } catch (error) {
      console.error(`❌ Failed to load document ${filePath}:`, error);
      throw error;
    }
  }
  
  async askQuestion(question, documentId, options = {}) {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    const {
      includeContext = true,
      maxContextLength = 2000,
      temperature = 0.3,
      maxTokens = 300
    } = options;
    
    let prompt;
    
    if (includeContext) {
      // Truncate document if too long
      let context = document.content;
      if (context.length > maxContextLength) {
        context = context.substring(0, maxContextLength) + '...';
      }
      
      prompt = `Based on the following document, please answer the question. If the answer is not found in the document, say "I cannot find the answer in the provided document."\n\nDocument:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    } else {
      prompt = `Question about document "${document.id}": ${question}\n\nAnswer:`;
    }
    
    const result = await this.router.quick(prompt, {
      temperature,
      maxTokens
    });
    
    return {
      question,
      answer: result.text,
      documentId,
      confidence: this.estimateConfidence(result.text),
      timestamp: new Date(),
      model: result.model,
      processingTime: result.latency
    };
  }
  
  async summarizeDocument(documentId, options = {}) {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    const {
      maxLength = 200,
      style = 'concise' // concise, detailed, bullet-points
    } = options;
    
    let summaryPrompt;
    
    switch (style) {
      case 'bullet-points':
        summaryPrompt = `Summarize the following document in bullet points:\n\n${document.content}\n\nSummary (bullet points):`;
        break;
      case 'detailed':
        summaryPrompt = `Provide a detailed summary of the following document:\n\n${document.content}\n\nDetailed Summary:`;
        break;
      default:
        summaryPrompt = `Provide a concise summary of the following document:\n\n${document.content}\n\nSummary:`;
    }
    
    const result = await this.router.quick(summaryPrompt, {
      temperature: 0.5,
      maxTokens: maxLength
    });
    
    return {
      documentId,
      summary: result.text,
      style,
      wordCount: result.text.split(/\s+/).length,
      timestamp: new Date()
    };
  }
  
  async extractKeyInformation(documentId, informationType = 'all') {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    const extractions = {};
    
    if (informationType === 'all' || informationType === 'entities') {
      const entitiesPrompt = `Extract all named entities (people, places, organizations, dates) from this document:\n\n${document.content}\n\nEntities:`;
      const entitiesResult = await this.router.quick(entitiesPrompt, {
        temperature: 0.2,
        maxTokens: 200
      });
      extractions.entities = entitiesResult.text;
    }
    
    if (informationType === 'all' || informationType === 'keywords') {
      const keywordsPrompt = `Extract the main keywords and key phrases from this document:\n\n${document.content}\n\nKeywords:`;
      const keywordsResult = await this.router.quick(keywordsPrompt, {
        temperature: 0.2,
        maxTokens: 100
      });
      extractions.keywords = keywordsResult.text;
    }
    
    if (informationType === 'all' || informationType === 'topics') {
      const topicsPrompt = `Identify the main topics discussed in this document:\n\n${document.content}\n\nMain Topics:`;
      const topicsResult = await this.router.quick(topicsPrompt, {
        temperature: 0.3,
        maxTokens: 150
      });
      extractions.topics = topicsResult.text;
    }
    
    return {
      documentId,
      extractions,
      timestamp: new Date()
    };
  }
  
  generateDocumentId(filePath) {
    const fileName = filePath.split('/').pop().split('.')[0];
    return `${fileName}_${Date.now()}`;
  }
  
  estimateConfidence(answer) {
    // Simple confidence estimation based on answer characteristics
    if (answer.includes('cannot find') || answer.includes('not mentioned')) {
      return 0.1;
    }
    if (answer.includes('according to') || answer.includes('the document states')) {
      return 0.9;
    }
    if (answer.length > 50 && !answer.includes('unclear')) {
      return 0.7;
    }
    return 0.5;
  }
  
  getDocumentStats() {
    const stats = {
      totalDocuments: this.documents.size,
      totalWords: 0,
      totalCharacters: 0,
      documents: []
    };
    
    for (const [id, doc] of this.documents) {
      stats.totalWords += doc.wordCount;
      stats.totalCharacters += doc.characterCount;
      stats.documents.push({
        id,
        filePath: doc.filePath,
        wordCount: doc.wordCount,
        loadedAt: doc.loadedAt
      });
    }
    
    return stats;
  }
}

// Usage example
async function demonstrateSimpleQA() {
  const qa = new SimpleDocumentQA();
  await qa.initialize();
  
  // Create a sample document
  const sampleText = `
  The Industrial Revolution was a period of major industrialization that took place during the late 1700s and early 1800s. It began in Great Britain and eventually spread throughout Western Europe and the United States.

  The revolution was characterized by the transition from hand production methods to machines, new chemical manufacturing processes, improved efficiency of water power, the increasing use of steam power, and the development of machine tools.

  Key figures of the Industrial Revolution include James Watt, who improved the steam engine, and Eli Whitney, who invented the cotton gin. The period saw significant changes in agriculture, manufacturing, mining, and transport that had profound effects on the social, economic and cultural conditions of the time.
  `;
  
  await fs.writeFile('industrial_revolution.txt', sampleText);
  
  // Load the document
  const document = await qa.loadDocument('industrial_revolution.txt', 'industrial_rev');
  
  // Ask questions
  const questions = [
    "When did the Industrial Revolution take place?",
    "Where did the Industrial Revolution begin?",
    "Who invented the cotton gin?",
    "What were the main changes during this period?",
    "What was the role of Napoleon?" // This should return "cannot find"
  ];
  
  console.log('🔍 Asking questions about the document:\n');
  
  for (const question of questions) {
    const answer = await qa.askQuestion(question, 'industrial_rev');
    console.log(`❓ ${question}`);
    console.log(`💭 ${answer.answer}`);
    console.log(`📊 Confidence: ${(answer.confidence * 100).toFixed(0)}%`);
    console.log(`⏱️ Time: ${answer.processingTime}ms\n`);
  }
  
  // Generate summary
  console.log('📝 Document Summary:');
  const summary = await qa.summarizeDocument('industrial_rev', { style: 'bullet-points' });
  console.log(summary.summary);
  
  // Extract key information
  console.log('\n🔑 Key Information Extraction:');
  const keyInfo = await qa.extractKeyInformation('industrial_rev');
  console.log('Entities:', keyInfo.extractions.entities);
  console.log('Keywords:', keyInfo.extractions.keywords);
  console.log('Topics:', keyInfo.extractions.topics);
  
  // Show stats
  console.log('\n📊 Document Statistics:');
  console.log(qa.getDocumentStats());
  
  // Cleanup
  await fs.unlink('industrial_revolution.txt');
}

demonstrateSimpleQA().catch(console.error);
```

## Multi-Document Processing

### Cross-Document QA System

```javascript
class MultiDocumentQA extends SimpleDocumentQA {
  constructor() {
    super();
    this.documentIndex = new Map(); // For fast searching
    this.collections = new Map(); // Group related documents
  }
  
  async createCollection(collectionId, description = '') {
    this.collections.set(collectionId, {
      id: collectionId,
      description,
      documents: new Set(),
      createdAt: new Date(),
      metadata: {}
    });
    
    console.log(`📁 Created collection: ${collectionId}`);
    return collectionId;
  }
  
  async addDocumentToCollection(documentId, collectionId) {
    const collection = this.collections.get(collectionId);
    const document = this.documents.get(documentId);
    
    if (!collection || !document) {
      throw new Error('Collection or document not found');
    }
    
    collection.documents.add(documentId);
    console.log(`📄 Added document ${documentId} to collection ${collectionId}`);
  }
  
  async loadDocumentCollection(folderPath, collectionId) {
    const files = await fs.readdir(folderPath);
    const textFiles = files.filter(file => 
      file.endsWith('.txt') || file.endsWith('.md')
    );
    
    await this.createCollection(collectionId, `Documents from ${folderPath}`);
    
    const loadedDocs = [];
    
    for (const file of textFiles) {
      try {
        const filePath = `${folderPath}/${file}`;
        const documentId = `${collectionId}_${file.split('.')[0]}`;
        
        const document = await this.loadDocument(filePath, documentId);
        await this.addDocumentToCollection(documentId, collectionId);
        
        // Create simple index for searching
        this.indexDocument(document);
        
        loadedDocs.push(document);
      } catch (error) {
        console.error(`❌ Failed to load ${file}:`, error);
      }
    }
    
    console.log(`📚 Loaded ${loadedDocs.length} documents into collection ${collectionId}`);
    return loadedDocs;
  }
  
  indexDocument(document) {
    const words = document.content.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3);
    
    for (const word of words) {
      if (!this.documentIndex.has(word)) {
        this.documentIndex.set(word, new Set());
      }
      this.documentIndex.get(word).add(document.id);
    }
  }
  
  async searchDocuments(query, collectionId = null) {
    const queryWords = query.toLowerCase().split(/\W+/);
    const documentScores = new Map();
    
    // Score documents based on query word matches
    for (const word of queryWords) {
      if (this.documentIndex.has(word)) {
        for (const docId of this.documentIndex.get(word)) {
          if (collectionId) {
            const collection = this.collections.get(collectionId);
            if (!collection.documents.has(docId)) continue;
          }
          
          documentScores.set(docId, (documentScores.get(docId) || 0) + 1);
        }
      }
    }
    
    // Sort by relevance score
    return Array.from(documentScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([docId, score]) => ({
        documentId: docId,
        relevanceScore: score,
        document: this.documents.get(docId)
      }));
  }
  
  async askMultiDocumentQuestion(question, collectionId, options = {}) {
    const {
      maxDocuments = 3,
      includeSourceInfo = true,
      combineStrategy = 'synthesize' // 'synthesize' or 'compare'
    } = options;
    
    // Find relevant documents
    const relevantDocs = await this.searchDocuments(question, collectionId);
    const topDocs = relevantDocs.slice(0, maxDocuments);
    
    if (topDocs.length === 0) {
      return {
        question,
        answer: "I couldn't find any relevant documents to answer your question.",
        sources: [],
        confidence: 0
      };
    }
    
    let prompt;
    const sources = topDocs.map(doc => ({
      id: doc.documentId,
      relevanceScore: doc.relevanceScore,
      filePath: doc.document.filePath
    }));
    
    if (combineStrategy === 'synthesize') {
      // Combine information from multiple documents
      const contextSections = topDocs.map((doc, index) => 
        `Document ${index + 1} (${doc.documentId}):\n${doc.document.content.substring(0, 1000)}...\n`
      ).join('\n');
      
      prompt = `Based on the following documents, please answer the question by synthesizing information from all relevant sources. If information conflicts, mention the different perspectives.\n\n${contextSections}\n\nQuestion: ${question}\n\nAnswer:`;
    } else {
      // Compare information across documents
      const contextSections = topDocs.map((doc, index) => 
        `Source ${index + 1} (${doc.documentId}):\n${doc.document.content.substring(0, 800)}...\n`
      ).join('\n');
      
      prompt = `Compare how the following sources address this question: "${question}"\n\n${contextSections}\n\nProvide a comparative analysis:`;
    }
    
    const result = await this.router.quick(prompt, {
      temperature: 0.4,
      maxTokens: 500
    });
    
    return {
      question,
      answer: result.text,
      sources: includeSourceInfo ? sources : [],
      strategy: combineStrategy,
      documentsUsed: topDocs.length,
      confidence: this.estimateMultiDocConfidence(result.text, topDocs.length),
      timestamp: new Date()
    };
  }
  
  async compareDocuments(documentIds, aspectToCompare) {
    const documents = documentIds.map(id => this.documents.get(id)).filter(Boolean);
    
    if (documents.length < 2) {
      throw new Error('At least 2 documents required for comparison');
    }
    
    const contextSections = documents.map((doc, index) => 
      `Document ${index + 1} (${doc.id}):\n${doc.content.substring(0, 1200)}...\n`
    ).join('\n');
    
    const prompt = `Compare the following documents regarding "${aspectToCompare}". Highlight similarities and differences.\n\n${contextSections}\n\nComparison Analysis:`;
    
    const result = await this.router.quick(prompt, {
      temperature: 0.5,
      maxTokens: 600
    });
    
    return {
      aspect: aspectToCompare,
      comparison: result.text,
      documentsCompared: documents.map(doc => ({
        id: doc.id,
        filePath: doc.filePath
      })),
      timestamp: new Date()
    };
  }
  
  async generateCollectionSummary(collectionId) {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }
    
    const documents = Array.from(collection.documents)
      .map(id => this.documents.get(id))
      .filter(Boolean);
    
    if (documents.length === 0) {
      return { summary: 'No documents in collection', documents: [] };
    }
    
    // Get individual summaries first
    const individualSummaries = await Promise.all(
      documents.map(async (doc) => {
        const summary = await this.summarizeDocument(doc.id, { maxLength: 100 });
        return `${doc.id}: ${summary.summary}`;
      })
    );
    
    // Combine summaries
    const combinedSummaries = individualSummaries.join('\n\n');
    
    const prompt = `Based on these individual document summaries, create an overall summary of the collection:\n\n${combinedSummaries}\n\nCollection Summary:`;
    
    const result = await this.router.quick(prompt, {
      temperature: 0.6,
      maxTokens: 400
    });
    
    return {
      collectionId,
      summary: result.text,
      documentCount: documents.length,
      totalWords: documents.reduce((sum, doc) => sum + doc.wordCount, 0),
      documents: documents.map(doc => ({
        id: doc.id,
        filePath: doc.filePath,
        wordCount: doc.wordCount
      })),
      timestamp: new Date()
    };
  }
  
  estimateMultiDocConfidence(answer, docCount) {
    let confidence = 0.5;
    
    if (answer.includes('according to multiple sources')) confidence += 0.3;
    if (answer.includes('conflicting information')) confidence -= 0.2;
    if (docCount > 2) confidence += 0.1;
    if (answer.length > 200) confidence += 0.1;
    
    return Math.min(Math.max(confidence, 0), 1);
  }
  
  getCollectionStats(collectionId) {
    const collection = this.collections.get(collectionId);
    if (!collection) return null;
    
    const documents = Array.from(collection.documents)
      .map(id => this.documents.get(id))
      .filter(Boolean);
    
    return {
      id: collectionId,
      description: collection.description,
      documentCount: documents.length,
      totalWords: documents.reduce((sum, doc) => sum + doc.wordCount, 0),
      totalCharacters: documents.reduce((sum, doc) => sum + doc.characterCount, 0),
      createdAt: collection.createdAt,
      documents: documents.map(doc => ({
        id: doc.id,
        wordCount: doc.wordCount,
        filePath: doc.filePath
      }))
    };
  }
}

// Usage example
async function demonstrateMultiDocumentQA() {
  const multiQA = new MultiDocumentQA();
  await multiQA.initialize();
  
  // Create sample documents
  const docs = {
    'ai_history.txt': 'Artificial Intelligence has its roots in the 1950s with pioneers like Alan Turing and John McCarthy. The field has experienced several waves of development including expert systems in the 1980s and machine learning breakthroughs in the 2000s.',
    
    'ml_overview.txt': 'Machine Learning is a subset of artificial intelligence that focuses on algorithms that can learn from data. Key approaches include supervised learning, unsupervised learning, and reinforcement learning. Deep learning has become particularly important since 2010.',
    
    'future_ai.txt': 'The future of AI includes developments in artificial general intelligence, quantum computing applications, and ethical AI frameworks. Challenges include bias mitigation, interpretability, and ensuring AI safety as systems become more powerful.'
  };
  
  // Create temporary files and load them
  const tempDir = 'temp_docs';
  await fs.mkdir(tempDir, { recursive: true });
  
  for (const [filename, content] of Object.entries(docs)) {
    await fs.writeFile(`${tempDir}/${filename}`, content);
  }
  
  // Load document collection
  await multiQA.loadDocumentCollection(tempDir, 'ai_collection');
  
  // Ask multi-document questions
  console.log('🔍 Multi-Document Question Answering:\n');
  
  const questions = [
    "What is the relationship between AI and machine learning?",
    "How has AI evolved over time?",
    "What are the main challenges facing AI development?"
  ];
  
  for (const question of questions) {
    console.log(`❓ ${question}`);
    
    const answer = await multiQA.askMultiDocumentQuestion(question, 'ai_collection', {
      maxDocuments: 3,
      combineStrategy: 'synthesize'
    });
    
    console.log(`💭 ${answer.answer}`);
    console.log(`📚 Used ${answer.documentsUsed} documents`);
    console.log(`📊 Confidence: ${(answer.confidence * 100).toFixed(0)}%`);
    console.log(`🔗 Sources: ${answer.sources.map(s => s.id).join(', ')}\n`);
  }
  
  // Compare documents
  console.log('🔄 Document Comparison:');
  const docIds = ['ai_collection_ai_history', 'ai_collection_future_ai'];
  const comparison = await multiQA.compareDocuments(docIds, 'AI development timeline');
  console.log(comparison.comparison);
  
  // Generate collection summary
  console.log('\n📋 Collection Summary:');
  const collectionSummary = await multiQA.generateCollectionSummary('ai_collection');
  console.log(collectionSummary.summary);
  
  // Show collection stats
  console.log('\n📊 Collection Statistics:');
  console.log(multiQA.getCollectionStats('ai_collection'));
  
  // Cleanup
  await fs.rm(tempDir, { recursive: true });
}

demonstrateMultiDocumentQA().catch(console.error);
```

## Vector-Based RAG

### Simple Vector Search RAG Implementation

```javascript
class VectorRAGSystem extends MultiDocumentQA {
  constructor() {
    super();
    this.embeddings = new Map(); // Document ID -> embeddings
    this.chunks = new Map(); // Chunk ID -> chunk data
    this.chunkSize = 500; // Characters per chunk
    this.chunkOverlap = 50; // Overlap between chunks
  }
  
  async loadDocument(filePath, documentId = null) {
    const document = await super.loadDocument(filePath, documentId);
    
    // Create chunks from the document
    const chunks = this.createChunks(document);
    
    // Generate embeddings for each chunk (simulated)
    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk.text);
      this.embeddings.set(chunk.id, embedding);
      this.chunks.set(chunk.id, chunk);
    }
    
    console.log(`🧩 Created ${chunks.length} chunks for document ${document.id}`);
    return document;
  }
  
  createChunks(document) {
    const chunks = [];
    const text = document.content;
    
    for (let i = 0; i < text.length; i += this.chunkSize - this.chunkOverlap) {
      const chunkText = text.slice(i, i + this.chunkSize);
      const chunkId = `${document.id}_chunk_${chunks.length}`;
      
      chunks.push({
        id: chunkId,
        documentId: document.id,
        text: chunkText,
        startIndex: i,
        endIndex: Math.min(i + this.chunkSize, text.length),
        wordCount: chunkText.split(/\s+/).length
      });
    }
    
    return chunks;
  }
  
  async generateEmbedding(text) {
    // Simulated embedding generation
    // In a real implementation, you would use a proper embedding model
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
    const embedding = new Array(384).fill(0); // 384-dimensional vector
    
    // Simple word-based embedding simulation
    for (let i = 0; i < words.length && i < embedding.length; i++) {
      const word = words[i];
      const hash = this.simpleHash(word);
      embedding[i % embedding.length] += Math.sin(hash) * 0.1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }
  
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
  
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
  
  async searchSimilarChunks(query, topK = 5) {
    const queryEmbedding = await this.generateEmbedding(query);
    const similarities = [];
    
    for (const [chunkId, chunkEmbedding] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
      similarities.push({
        chunkId,
        similarity,
        chunk: this.chunks.get(chunkId)
      });
    }
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
  
  async askRAGQuestion(question, options = {}) {
    const {
      topK = 3,
      similarityThreshold = 0.1,
      includeMetadata = true,
      temperature = 0.4,
      maxTokens = 400
    } = options;
    
    // Find most similar chunks
    const similarChunks = await this.searchSimilarChunks(question, topK);
    
    // Filter by similarity threshold
    const relevantChunks = similarChunks.filter(
      item => item.similarity >= similarityThreshold
    );
    
    if (relevantChunks.length === 0) {
      return {
        question,
        answer: "I couldn't find any relevant information to answer your question.",
        sources: [],
        confidence: 0
      };
    }
    
    // Build context from relevant chunks
    const context = relevantChunks
      .map((item, index) => `Context ${index + 1}:\n${item.chunk.text}`)
      .join('\n\n');
    
    const prompt = `Based on the following context, please answer the question. If the answer is not found in the context, say so.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    
    const result = await this.router.quick(prompt, {
      temperature,
      maxTokens
    });
    
    const sources = relevantChunks.map(item => ({
      chunkId: item.chunkId,
      documentId: item.chunk.documentId,
      similarity: item.similarity,
      startIndex: item.chunk.startIndex,
      endIndex: item.chunk.endIndex
    }));
    
    return {
      question,
      answer: result.text,
      sources: includeMetadata ? sources : [],
      chunksUsed: relevantChunks.length,
      avgSimilarity: relevantChunks.reduce((sum, item) => sum + item.similarity, 0) / relevantChunks.length,
      confidence: this.estimateRAGConfidence(result.text, relevantChunks),
      timestamp: new Date()
    };
  }
  
  estimateRAGConfidence(answer, chunks) {
    let confidence = 0.5;
    
    // Higher confidence with more similar chunks
    const avgSimilarity = chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / chunks.length;
    confidence += avgSimilarity * 0.3;
    
    // Higher confidence with longer, detailed answers
    if (answer.length > 100) confidence += 0.1;
    if (answer.includes('according to') || answer.includes('based on')) confidence += 0.1;
    
    // Lower confidence for uncertain language
    if (answer.includes('might be') || answer.includes('possibly')) confidence -= 0.2;
    if (answer.includes('not found') || answer.includes('cannot determine')) confidence = 0.1;
    
    return Math.min(Math.max(confidence, 0), 1);
  }
  
  async explainRetrieval(question, topK = 5) {
    const similarChunks = await this.searchSimilarChunks(question, topK);
    
    return {
      question,
      retrievalResults: similarChunks.map(item => ({
        chunkId: item.chunkId,
        documentId: item.chunk.documentId,
        similarity: item.similarity,
        preview: item.chunk.text.substring(0, 200) + '...',
        wordCount: item.chunk.wordCount
      })),
      totalChunks: this.chunks.size,
      avgSimilarity: similarChunks.reduce((sum, item) => sum + item.similarity, 0) / similarChunks.length
    };
  }
  
  getRAGStats() {
    const documentIds = new Set();
    for (const chunk of this.chunks.values()) {
      documentIds.add(chunk.documentId);
    }
    
    return {
      totalDocuments: documentIds.size,
      totalChunks: this.chunks.size,
      totalEmbeddings: this.embeddings.size,
      avgChunkSize: Array.from(this.chunks.values())
        .reduce((sum, chunk) => sum + chunk.wordCount, 0) / this.chunks.size,
      embeddingDimension: this.embeddings.size > 0 
        ? this.embeddings.values().next().value.length 
        : 0
    };
  }
}

// Usage example
async function demonstrateVectorRAG() {
  const ragSystem = new VectorRAGSystem();
  await ragSystem.initialize();
  
  // Create sample documents with more detailed content
  const documents = {
    'climate_science.txt': `
      Climate change refers to long-term shifts in global or regional climate patterns. 
      The greenhouse effect is caused by gases like carbon dioxide, methane, and water vapor 
      that trap heat in Earth's atmosphere. Human activities, particularly the burning of 
      fossil fuels since the Industrial Revolution, have increased atmospheric CO2 
      concentrations from 280 ppm to over 420 ppm today.
      
      The impacts of climate change include rising global temperatures, melting ice caps, 
      sea level rise, and more frequent extreme weather events. The Intergovernmental 
      Panel on Climate Change (IPCC) has documented these changes extensively.
    `,
    
    'renewable_energy.txt': `
      Renewable energy sources include solar, wind, hydroelectric, geothermal, and biomass. 
      Solar photovoltaic technology converts sunlight directly into electricity using 
      semiconductor materials. Wind turbines capture kinetic energy from moving air and 
      convert it to electrical energy through generators.
      
      The cost of renewable energy has decreased dramatically over the past decade. 
      Solar panel costs have dropped by over 80% since 2010, making it competitive 
      with fossil fuels in many regions. Energy storage technologies like lithium-ion 
      batteries are crucial for managing intermittent renewable sources.
    `,
    
    'carbon_capture.txt': `
      Carbon capture and storage (CCS) technologies aim to remove CO2 from industrial 
      processes and the atmosphere. Direct air capture uses chemical processes to 
      extract CO2 directly from ambient air. Bioenergy with carbon capture and storage 
      (BECCS) combines biomass energy production with CO2 storage.
      
      Natural carbon sinks include forests, oceans, and soil. Reforestation and 
      afforestation can significantly increase carbon sequestration. Ocean-based 
      solutions include protecting marine ecosystems and potentially enhancing 
      natural carbon uptake processes.
    `
  };
  
  // Create temporary files and load them
  const tempDir = 'temp_rag_docs';
  await fs.mkdir(tempDir, { recursive: true });
  
  for (const [filename, content] of Object.entries(documents)) {
    await fs.writeFile(`${tempDir}/${filename}`, content);
    const docId = filename.split('.')[0];
    await ragSystem.loadDocument(`${tempDir}/${filename}`, docId);
  }
  
  console.log('🔍 Vector-based RAG Question Answering:\n');
  
  const questions = [
    "What causes the greenhouse effect?",
    "How much have solar panel costs decreased?",
    "What are the main types of carbon capture technologies?",
    "How has CO2 concentration changed since the Industrial Revolution?",
    "What role do batteries play in renewable energy?"
  ];
  
  for (const question of questions) {
    console.log(`❓ ${question}`);
    
    // Show retrieval explanation
    const retrieval = await ragSystem.explainRetrieval(question, 3);
    console.log(`🔍 Retrieved ${retrieval.retrievalResults.length} relevant chunks:`);
    retrieval.retrievalResults.forEach(chunk => {
      console.log(`   ${chunk.chunkId}: similarity ${chunk.similarity.toFixed(3)}`);
    });
    
    // Get RAG answer
    const answer = await ragSystem.askRAGQuestion(question, {
      topK: 3,
      similarityThreshold: 0.1
    });
    
    console.log(`💭 ${answer.answer}`);
    console.log(`📊 Confidence: ${(answer.confidence * 100).toFixed(0)}%`);
    console.log(`📚 Avg similarity: ${answer.avgSimilarity.toFixed(3)}\n`);
  }
  
  // Show RAG system statistics
  console.log('📊 RAG System Statistics:');
  console.log(ragSystem.getRAGStats());
  
  // Cleanup
  await fs.rm(tempDir, { recursive: true });
}

demonstrateVectorRAG().catch(console.error);
```

## PDF Processing

### PDF Document QA System

```javascript
import { readFileSync } from 'fs';
import pdf from 'pdf-parse';

class PDFDocumentQA extends VectorRAGSystem {
  constructor() {
    super();
    this.pdfMetadata = new Map();
  }
  
  async loadPDFDocument(pdfPath, documentId = null) {
    try {
      const dataBuffer = readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      
      const id = documentId || this.generateDocumentId(pdfPath);
      
      const document = {
        id,
        filePath: pdfPath,
        content: pdfData.text,
        loadedAt: new Date(),
        wordCount: pdfData.text.split(/\s+/).length,
        characterCount: pdfData.text.length,
        type: 'pdf'
      };
      
      // Store PDF-specific metadata
      this.pdfMetadata.set(id, {
        totalPages: pdfData.numpages,
        title: pdfData.info?.Title || '',
        author: pdfData.info?.Author || '',
        subject: pdfData.info?.Subject || '',
        creator: pdfData.info?.Creator || '',
        creationDate: pdfData.info?.CreationDate || null,
        modificationDate: pdfData.info?.ModDate || null
      });
      
      this.documents.set(id, document);
      
      // Create chunks and embeddings
      const chunks = this.createChunks(document);
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.text);
        this.embeddings.set(chunk.id, embedding);
        this.chunks.set(chunk.id, chunk);
      }
      
      console.log(`📄 Loaded PDF: ${id} (${pdfData.numpages} pages, ${document.wordCount} words)`);
      return document;
      
    } catch (error) {
      console.error(`❌ Failed to load PDF ${pdfPath}:`, error);
      throw error;
    }
  }
  
  async extractPDFSections(documentId) {
    const document = this.documents.get(documentId);
    if (!document || document.type !== 'pdf') {
      throw new Error('Document is not a PDF or not found');
    }
    
    const content = document.content;
    
    // Simple section extraction based on common patterns
    const sections = [];
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    let currentSection = null;
    let currentContent = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Detect potential section headers (all caps, numbered, etc.)
      if (this.isSectionHeader(trimmedLine)) {
        // Save previous section
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.join('\n'),
            wordCount: currentContent.join('\n').split(/\s+/).length
          });
        }
        
        // Start new section
        currentSection = trimmedLine;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    
    // Add final section
    if (currentSection) {
      sections.push({
        title: currentSection,
        content: currentContent.join('\n'),
        wordCount: currentContent.join('\n').split(/\s+/).length
      });
    }
    
    return {
      documentId,
      sections,
      totalSections: sections.length,
      timestamp: new Date()
    };
  }
  
  isSectionHeader(line) {
    // Simple heuristics for section headers
    if (line.length > 100) return false; // Too long
    if (line.length < 3) return false; // Too short
    
    // Check for patterns like "1. Introduction", "CHAPTER 1", etc.
    const patterns = [
      /^\d+\.\s+[A-Z]/,           // "1. Title"
      /^[A-Z][A-Z\s]{5,}$/,       // "ALL CAPS TITLE"
      /^CHAPTER\s+\d+/i,          // "Chapter 1"
      /^SECTION\s+\d+/i,          // "Section 1"
      /^[A-Z][a-z]+\s+\d+/,       // "Introduction 1"
    ];
    
    return patterns.some(pattern => pattern.test(line));
  }
  
  async searchPDFByPage(query, documentId, options = {}) {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error('Document not found');
    }
    
    const pdfMetadata = this.pdfMetadata.get(documentId);
    if (!pdfMetadata) {
      throw new Error('PDF metadata not found');
    }
    
    // Estimate pages based on content length and chunks
    const chunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.documentId === documentId);
    
    const avgChunkLength = document.content.length / chunks.length;
    const estimatedCharsPerPage = document.content.length / pdfMetadata.totalPages;
    
    // Search similar chunks and estimate pages
    const similarChunks = await this.searchSimilarChunks(query, 10);
    const relevantChunks = similarChunks.filter(item => 
      item.chunk.documentId === documentId && item.similarity >= 0.1
    );
    
    const pageResults = relevantChunks.map(item => {
      const estimatedPage = Math.ceil(item.chunk.startIndex / estimatedCharsPerPage);
      return {
        chunkId: item.chunkId,
        similarity: item.similarity,
        estimatedPage: Math.min(estimatedPage, pdfMetadata.totalPages),
        preview: item.chunk.text.substring(0, 200) + '...'
      };
    });
    
    return {
      query,
      documentId,
      totalPages: pdfMetadata.totalPages,
      results: pageResults.slice(0, options.maxResults || 5),
      timestamp: new Date()
    };
  }
  
  getPDFMetadata(documentId) {
    const document = this.documents.get(documentId);
    const pdfMeta = this.pdfMetadata.get(documentId);
    
    if (!document || !pdfMeta) {
      return null;
    }
    
    return {
      documentId,
      filePath: document.filePath,
      ...pdfMeta,
      wordCount: document.wordCount,
      characterCount: document.characterCount,
      loadedAt: document.loadedAt
    };
  }
  
  async generatePDFReport(documentId) {
    const document = this.documents.get(documentId);
    const pdfMeta = this.pdfMetadata.get(documentId);
    
    if (!document || !pdfMeta) {
      throw new Error('PDF document not found');
    }
    
    // Generate summary
    const summary = await this.summarizeDocument(documentId, { 
      maxLength: 300,
      style: 'detailed'
    });
    
    // Extract sections
    const sections = await this.extractPDFSections(documentId);
    
    // Extract key information
    const keyInfo = await this.extractKeyInformation(documentId, 'all');
    
    // Get chunk statistics
    const documentChunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.documentId === documentId);
    
    return {
      documentInfo: {
        id: documentId,
        title: pdfMeta.title || 'Untitled',
        author: pdfMeta.author || 'Unknown',
        pages: pdfMeta.totalPages,
        wordCount: document.wordCount
      },
      summary: summary.summary,
      sections: sections.sections.map(section => ({
        title: section.title,
        wordCount: section.wordCount
      })),
      keyInformation: keyInfo.extractions,
      processing: {
        chunksCreated: documentChunks.length,
        avgChunkSize: documentChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0) / documentChunks.length,
        processedAt: new Date()
      }
    };
  }
}

// Usage example
async function demonstratePDFQA() {
  console.log('📄 PDF Document QA System Demo');
  console.log('Note: This demo uses simulated PDF content since we need actual PDF files');
  
  const pdfQA = new PDFDocumentQA();
  await pdfQA.initialize();
  
  // Simulate loading a PDF by creating a document with PDF-like content
  const simulatedPDFContent = `
RESEARCH PAPER: ARTIFICIAL INTELLIGENCE IN HEALTHCARE

ABSTRACT
This paper examines the current applications of artificial intelligence in healthcare, 
including diagnostic imaging, drug discovery, and personalized treatment recommendations.

1. INTRODUCTION
Artificial intelligence (AI) has emerged as a transformative technology in healthcare.
Machine learning algorithms can analyze medical data with unprecedented accuracy and speed.

2. DIAGNOSTIC IMAGING
AI-powered imaging systems can detect tumors, fractures, and other abnormalities.
Deep learning models trained on thousands of medical images achieve diagnostic accuracy
comparable to expert radiologists in many cases.

3. DRUG DISCOVERY
AI accelerates the drug discovery process by predicting molecular behavior and 
identifying potential therapeutic compounds. This can reduce development time
from years to months in some cases.

4. PERSONALIZED MEDICINE
Machine learning analyzes genetic data, medical history, and lifestyle factors
to recommend personalized treatment plans for individual patients.

5. CHALLENGES AND LIMITATIONS
Data privacy, algorithmic bias, and regulatory approval remain significant challenges.
The integration of AI systems into existing healthcare workflows requires careful planning.

6. FUTURE DIRECTIONS
Emerging technologies like quantum computing and federated learning may further
advance AI capabilities in healthcare while addressing current limitations.

CONCLUSION
AI represents a paradigm shift in healthcare delivery, offering unprecedented 
opportunities to improve patient outcomes and reduce costs.
  `;
  
  // Create a simulated PDF document
  const document = {
    id: 'ai_healthcare_paper',
    filePath: 'ai_healthcare.pdf',
    content: simulatedPDFContent,
    loadedAt: new Date(),
    wordCount: simulatedPDFContent.split(/\s+/).length,
    characterCount: simulatedPDFContent.length,
    type: 'pdf'
  };
  
  // Store document and metadata
  pdfQA.documents.set(document.id, document);
  pdfQA.pdfMetadata.set(document.id, {
    totalPages: 8,
    title: 'Artificial Intelligence in Healthcare',
    author: 'Dr. Research Paper',
    subject: 'Medical AI Applications',
    creator: 'Academic Publisher',
    creationDate: new Date('2024-01-01'),
    modificationDate: new Date('2024-01-15')
  });
  
  // Create chunks and embeddings
  const chunks = pdfQA.createChunks(document);
  for (const chunk of chunks) {
    const embedding = await pdfQA.generateEmbedding(chunk.text);
    pdfQA.embeddings.set(chunk.id, embedding);
    pdfQA.chunks.set(chunk.id, chunk);
  }
  
  console.log(`\n📄 Loaded simulated PDF: ${document.id}`);
  
  // Demonstrate PDF-specific features
  console.log('\n📋 PDF Metadata:');
  const metadata = pdfQA.getPDFMetadata(document.id);
  console.log(JSON.stringify(metadata, null, 2));
  
  console.log('\n📑 Extracted Sections:');
  const sections = await pdfQA.extractPDFSections(document.id);
  sections.sections.forEach((section, index) => {
    console.log(`${index + 1}. ${section.title} (${section.wordCount} words)`);
  });
  
  console.log('\n🔍 PDF Question Answering:');
  const questions = [
    "What are the main applications of AI in healthcare?",
    "How does AI help with drug discovery?",
    "What challenges does AI face in healthcare?",
    "What is mentioned about personalized medicine?"
  ];
  
  for (const question of questions) {
    console.log(`\n❓ ${question}`);
    
    const answer = await pdfQA.askRAGQuestion(question, {
      topK: 3,
      similarityThreshold: 0.1
    });
    
    console.log(`💭 ${answer.answer}`);
    console.log(`📊 Confidence: ${(answer.confidence * 100).toFixed(0)}%`);
  }
  
  console.log('\n🔍 Page-based Search:');
  const pageSearch = await pdfQA.searchPDFByPage(
    'diagnostic imaging', 
    document.id, 
    { maxResults: 3 }
  );
  console.log('Search results:', pageSearch.results);
  
  console.log('\n📊 PDF Analysis Report:');
  const report = await pdfQA.generatePDFReport(document.id);
  console.log(JSON.stringify(report, null, 2));
}

demonstratePDFQA().catch(console.error);
```

## Real-Time Document Chat

### Interactive Document Chat System

```javascript
import { WebSocketServer } from 'ws';
import http from 'http';

class DocumentChatServer {
  constructor(port = 8080) {
    this.port = port;
    this.ragSystem = new VectorRAGSystem();
    this.clients = new Map();
    this.activeSessions = new Map();
    
    this.server = http.createServer();
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupWebSocketServer();
  }
  
  async initialize() {
    await this.ragSystem.initialize();
    console.log('📚 Document Chat Server initialized');
  }
  
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      
      this.clients.set(clientId, {
        ws,
        id: clientId,
        connectedAt: new Date(),
        currentDocument: null,
        chatHistory: []
      });
      
      console.log(`👤 Client ${clientId} connected`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        message: 'Connected to Document Chat Server'
      }));
      
      ws.on('message', async (data) => {
        await this.handleMessage(clientId, data);
      });
      
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`👤 Client ${clientId} disconnected`);
      });
      
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error);
      });
    });
  }
  
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'upload_document':
          await this.handleDocumentUpload(clientId, message);
          break;
          
        case 'chat_message':
          await this.handleChatMessage(clientId, message);
          break;
          
        case 'get_document_info':
          await this.handleGetDocumentInfo(clientId, message);
          break;
          
        case 'search_document':
          await this.handleDocumentSearch(clientId, message);
          break;
          
        case 'clear_chat':
          this.handleClearChat(clientId);
          break;
          
        default:
          client.ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }));
      }
      
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  }
  
  async handleDocumentUpload(clientId, message) {
    const client = this.clients.get(clientId);
    const { documentContent, documentName, documentType = 'text' } = message;
    
    try {
      // Create temporary file for the document
      const documentId = `${clientId}_${Date.now()}`;
      const tempFilePath = `temp_${documentId}.txt`;
      
      await fs.writeFile(tempFilePath, documentContent);
      
      // Load document into RAG system
      const document = await this.ragSystem.loadDocument(tempFilePath, documentId);
      
      // Set as current document for this client
      client.currentDocument = documentId;
      
      // Clean up temp file
      await fs.unlink(tempFilePath);
      
      client.ws.send(JSON.stringify({
        type: 'document_uploaded',
        documentId,
        documentName,
        wordCount: document.wordCount,
        chunksCreated: Array.from(this.ragSystem.chunks.values())
          .filter(chunk => chunk.documentId === documentId).length
      }));
      
      console.log(`📄 Client ${clientId} uploaded document: ${documentName}`);
      
    } catch (error) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to upload document: ${error.message}`
      }));
    }
  }
  
  async handleChatMessage(clientId, message) {
    const client = this.clients.get(clientId);
    const { content } = message;
    
    if (!client.currentDocument) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Please upload a document first'
      }));
      return;
    }
    
    // Add user message to history
    client.chatHistory.push({
      role: 'user',
      content,
      timestamp: new Date()
    });
    
    try {
      // Signal that AI is thinking
      client.ws.send(JSON.stringify({
        type: 'ai_thinking'
      }));
      
      // Get answer using RAG system
      const answer = await this.ragSystem.askRAGQuestion(content, {
        topK: 3,
        similarityThreshold: 0.1,
        includeMetadata: true
      });
      
      // Add AI response to history
      client.chatHistory.push({
        role: 'assistant',
        content: answer.answer,
        timestamp: new Date(),
        metadata: {
          confidence: answer.confidence,
          chunksUsed: answer.chunksUsed,
          sources: answer.sources
        }
      });
      
      // Send response to client
      client.ws.send(JSON.stringify({
        type: 'chat_response',
        content: answer.answer,
        confidence: answer.confidence,
        sources: answer.sources,
        timestamp: new Date()
      }));
      
    } catch (error) {
      console.error(`❌ Chat error for client ${clientId}:`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to generate response'
      }));
    }
  }
  
  async handleGetDocumentInfo(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!client.currentDocument) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'No document loaded'
      }));
      return;
    }
    
    try {
      const document = this.ragSystem.documents.get(client.currentDocument);
      const chunks = Array.from(this.ragSystem.chunks.values())
        .filter(chunk => chunk.documentId === client.currentDocument);
      
      const info = {
        documentId: client.currentDocument,
        wordCount: document.wordCount,
        characterCount: document.characterCount,
        chunksCount: chunks.length,
        loadedAt: document.loadedAt
      };
      
      client.ws.send(JSON.stringify({
        type: 'document_info',
        info
      }));
      
    } catch (error) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to get document info'
      }));
    }
  }
  
  async handleDocumentSearch(clientId, message) {
    const client = this.clients.get(clientId);
    const { query, maxResults = 5 } = message;
    
    if (!client.currentDocument) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'No document loaded'
      }));
      return;
    }
    
    try {
      const similarChunks = await this.ragSystem.searchSimilarChunks(query, maxResults);
      const documentChunks = similarChunks.filter(
        item => item.chunk.documentId === client.currentDocument
      );
      
      const results = documentChunks.map(item => ({
        chunkId: item.chunkId,
        similarity: item.similarity,
        preview: item.chunk.text.substring(0, 200) + '...',
        startIndex: item.chunk.startIndex,
        endIndex: item.chunk.endIndex
      }));
      
      client.ws.send(JSON.stringify({
        type: 'search_results',
        query,
        results,
        totalFound: results.length
      }));
      
    } catch (error) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Search failed'
      }));
    }
  }
  
  handleClearChat(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.chatHistory = [];
      client.ws.send(JSON.stringify({
        type: 'chat_cleared'
      }));
    }
  }
  
  generateClientId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Document Chat Server running on ws://localhost:${this.port}`);
    });
  }
  
  async stop() {
    console.log('🛑 Shutting down Document Chat Server...');
    
    // Close all client connections
    this.clients.forEach(client => {
      client.ws.close();
    });
    
    // Close server
    this.server.close();
    
    // Cleanup RAG system
    await this.ragSystem.router.cleanup();
    
    console.log('✅ Server shutdown complete');
  }
}

// HTML Client for Document Chat
const documentChatClient = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Chat</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
        .panel { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; border-radius: 8px; }
        .upload-area.dragover { border-color: #007bff; background: #f8f9fa; }
        .chat-container { height: 400px; overflow-y: auto; border: 1px solid #eee; padding: 15px; margin: 10px 0; }
        .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .user-message { background: #007bff; color: white; margin-left: 20%; }
        .ai-message { background: #f8f9fa; margin-right: 20%; }
        .input-area { display: flex; gap: 10px; }
        .input-area input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .input-area button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .document-info { background: #e9ecef; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .confidence-bar { width: 100%; height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
        .confidence-fill { height: 100%; background: linear-gradient(to right, #dc3545, #ffc107, #28a745); }
        .thinking { font-style: italic; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="panel">
            <h2>📄 Document Upload</h2>
            <div class="upload-area" id="uploadArea">
                <p>Drag and drop a text file here or</p>
                <input type="file" id="fileInput" accept=".txt,.md" style="display: none;">
                <button onclick="document.getElementById('fileInput').click()">Select File</button>
            </div>
            
            <div id="documentInfo" class="document-info" style="display: none;">
                <h3>Document Loaded</h3>
                <div id="docDetails"></div>
                <button onclick="searchDocument()">🔍 Search Document</button>
                <button onclick="clearChat()">🗑️ Clear Chat</button>
            </div>
            
            <div id="searchResults" style="display: none;">
                <h3>Search Results</h3>
                <div id="searchList"></div>
            </div>
        </div>
        
        <div class="panel">
            <h2>💬 Document Chat</h2>
            <div id="chatContainer" class="chat-container"></div>
            <div class="input-area">
                <input type="text" id="messageInput" placeholder="Ask a question about your document..." disabled>
                <button id="sendButton" onclick="sendMessage()" disabled>Send</button>
            </div>
        </div>
    </div>
    
    <script>
        let ws = null;
        let documentLoaded = false;
        
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:8080');
            
            ws.onopen = () => {
                console.log('Connected to Document Chat Server');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            };
            
            ws.onclose = () => {
                console.log('Disconnected from server');
                setTimeout(connectWebSocket, 3000);
            };
        }
        
        function handleServerMessage(data) {
            switch (data.type) {
                case 'welcome':
                    addSystemMessage(data.message);
                    break;
                    
                case 'document_uploaded':
                    documentLoaded = true;
                    document.getElementById('messageInput').disabled = false;
                    document.getElementById('sendButton').disabled = false;
                    
                    document.getElementById('documentInfo').style.display = 'block';
                    document.getElementById('docDetails').innerHTML = \`
                        <p><strong>Document ID:</strong> \${data.documentId}</p>
                        <p><strong>Word Count:</strong> \${data.wordCount}</p>
                        <p><strong>Chunks Created:</strong> \${data.chunksCreated}</p>
                    \`;
                    
                    addSystemMessage(\`Document uploaded successfully: \${data.documentName}\`);
                    break;
                    
                case 'ai_thinking':
                    addMessage('AI is analyzing your question...', 'thinking');
                    break;
                    
                case 'chat_response':
                    removeThinkingMessages();
                    addAIMessage(data.content, data.confidence);
                    break;
                    
                case 'search_results':
                    showSearchResults(data.results);
                    break;
                    
                case 'chat_cleared':
                    document.getElementById('chatContainer').innerHTML = '';
                    addSystemMessage('Chat history cleared');
                    break;
                    
                case 'error':
                    addSystemMessage(\`Error: \${data.message}\`);
                    break;
            }
        }
        
        function addMessage(content, className = '') {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${className}\`;
            messageDiv.textContent = content;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function addUserMessage(content) {
            addMessage(content, 'user-message');
        }
        
        function addAIMessage(content, confidence) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai-message';
            
            const confidenceBar = document.createElement('div');
            confidenceBar.className = 'confidence-bar';
            const confidenceFill = document.createElement('div');
            confidenceFill.className = 'confidence-fill';
            confidenceFill.style.width = \`\${confidence * 100}%\`;
            confidenceBar.appendChild(confidenceFill);
            
            messageDiv.innerHTML = \`
                <div>\${content}</div>
                <div style="margin-top: 5px; font-size: 12px; color: #666;">
                    Confidence: \${(confidence * 100).toFixed(0)}%
                </div>
            \`;
            messageDiv.appendChild(confidenceBar);
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function addSystemMessage(content) {
            addMessage(\`System: \${content}\`, 'system-message');
        }
        
        function removeThinkingMessages() {
            const thinkingMessages = document.querySelectorAll('.thinking');
            thinkingMessages.forEach(msg => msg.remove());
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message || !documentLoaded) return;
            
            addUserMessage(message);
            
            ws.send(JSON.stringify({
                type: 'chat_message',
                content: message
            }));
            
            input.value = '';
        }
        
        function uploadDocument(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                ws.send(JSON.stringify({
                    type: 'upload_document',
                    documentContent: e.target.result,
                    documentName: file.name,
                    documentType: 'text'
                }));
            };
            reader.readAsText(file);
        }
        
        function searchDocument() {
            const query = prompt('Enter search query:');
            if (query) {
                ws.send(JSON.stringify({
                    type: 'search_document',
                    query,
                    maxResults: 5
                }));
            }
        }
        
        function clearChat() {
            ws.send(JSON.stringify({
                type: 'clear_chat'
            }));
        }
        
        function showSearchResults(results) {
            const searchResults = document.getElementById('searchResults');
            const searchList = document.getElementById('searchList');
            
            searchList.innerHTML = results.map(result => \`
                <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 4px;">
                    <div style="font-weight: bold;">Similarity: \${result.similarity.toFixed(3)}</div>
                    <div style="font-size: 12px; color: #666;">Chunk: \${result.chunkId}</div>
                    <div style="margin-top: 5px;">\${result.preview}</div>
                </div>
            \`).join('');
            
            searchResults.style.display = 'block';
        }
        
        // Setup file upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadDocument(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadDocument(e.target.files[0]);
            }
        });
        
        // Setup message input
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Connect to server
        connectWebSocket();
    </script>
</body>
</html>
`;

// Usage
async function startDocumentChatServer() {
  // Save the HTML client
  await fs.writeFile('document_chat_client.html', documentChatClient);
  
  // Start the server
  const server = new DocumentChatServer(8080);
  await server.initialize();
  server.start();
  
  console.log('📄 Document Chat Server started');
  console.log('🌐 Open document_chat_client.html in your browser to use the chat interface');
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

startDocumentChatServer().catch(console.error);
```

This comprehensive Document QA examples guide covers everything from basic text analysis to sophisticated RAG implementations with real-time chat interfaces, perfect for building any kind of document-based question-answering application.