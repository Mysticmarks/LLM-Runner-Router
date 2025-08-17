# Basic Usage Tutorial

This hands-on tutorial will teach you the fundamentals of using LLM Runner Router through practical examples.

## Table of Contents

1. [Setup and Installation](#setup-and-installation)
2. [Your First Request](#your-first-request)
3. [Model Management](#model-management)
4. [Basic Configuration](#basic-configuration)
5. [Error Handling](#error-handling)
6. [Performance Optimization](#performance-optimization)
7. [Practical Examples](#practical-examples)
8. [Next Steps](#next-steps)

## Setup and Installation

### Prerequisites Check

```bash
# Check Node.js version (18.0.0+ required)
node --version

# Check npm version
npm --version

# Check available memory (4GB+ recommended)
free -h
```

### Installation

```bash
# Create a new project
mkdir llm-tutorial
cd llm-tutorial

# Initialize npm project
npm init -y

# Install LLM Runner Router
npm install llm-runner-router

# Create basic project structure
mkdir config models logs
touch index.js .env
```

### Package.json Setup

```json
{
  "name": "llm-tutorial",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "llm-runner-router": "^1.2.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

## Your First Request

### Basic Hello World

Create `01-hello-world.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function helloWorld() {
    console.log('🚀 Starting LLM Router...');
    
    try {
        // Initialize the router with auto-setup
        const router = new LLMRouter({
            autoSetup: true,  // Downloads a lightweight model automatically
            logging: { level: 'info' }
        });

        console.log('⏳ Processing your first request...');
        
        // Make your first request
        const result = await router.process({
            prompt: 'Hello! Please introduce yourself.',
            maxTokens: 100
        });

        console.log('✅ Success!');
        console.log('Response:', result.response);
        console.log('Model used:', result.modelUsed);
        console.log('Tokens used:', result.metrics.totalTokens);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

helloWorld();
```

Run it:
```bash
node 01-hello-world.js
```

**Expected Output:**
```
🚀 Starting LLM Router...
⏳ Processing your first request...
✅ Success!
Response: Hello! I'm an AI assistant created by Anthropic...
Model used: tinyllama-1.1b
Tokens used: 45
```

### Understanding the Response

```javascript
// Example response object
{
    response: "Hello! I'm an AI assistant...",
    modelUsed: "tinyllama-1.1b",
    metrics: {
        promptTokens: 8,
        completionTokens: 37,
        totalTokens: 45,
        duration: 1234,
        cost: 0.001
    },
    metadata: {
        strategy: "balanced",
        timestamp: "2024-01-15T10:30:00Z",
        requestId: "req_123456"
    }
}
```

## Model Management

### Listing Available Models

Create `02-model-management.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function exploreModels() {
    const router = new LLMRouter();
    
    try {
        // List all registered models
        const models = await router.listModels();
        console.log('📋 Available models:');
        
        models.forEach(model => {
            console.log(`- ${model.id}: ${model.name} (${model.format})`);
            console.log(`  Capabilities: ${model.capabilities.join(', ')}`);
            console.log(`  Status: ${model.status}`);
            console.log();
        });

        // Get detailed model information
        if (models.length > 0) {
            const modelId = models[0].id;
            const details = await router.getModelDetails(modelId);
            
            console.log(`🔍 Details for ${modelId}:`);
            console.log('Config:', details.config);
            console.log('Performance:', details.performance);
            console.log('Requirements:', details.requirements);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

exploreModels();
```

### Registering Custom Models

```javascript
import { LLMRouter } from 'llm-runner-router';

async function registerCustomModel() {
    const router = new LLMRouter();
    
    try {
        // Register a local GGUF model
        await router.registerModel({
            id: 'my-custom-model',
            name: 'My Custom Model',
            format: 'gguf',
            source: './models/my-model.gguf',
            config: {
                contextLength: 2048,
                temperature: 0.7,
                topK: 40,
                topP: 0.95
            },
            capabilities: ['text-generation', 'chat'],
            tags: ['custom', 'local']
        });

        console.log('✅ Model registered successfully!');
        
        // Test the new model
        const result = await router.process({
            prompt: 'Hello from my custom model!',
            model: 'my-custom-model',
            maxTokens: 50
        });
        
        console.log('Response:', result.response);
        
    } catch (error) {
        console.error('❌ Registration failed:', error.message);
    }
}

registerCustomModel();
```

### Downloading Models

```javascript
import { LLMRouter } from 'llm-runner-router';

async function downloadModels() {
    const router = new LLMRouter();
    
    try {
        console.log('📥 Downloading TinyLlama model...');
        
        // Download with progress tracking
        await router.downloadModel('TinyLlama/TinyLlama-1.1B-Chat-v1.0', {
            onProgress: (progress) => {
                console.log(`Progress: ${Math.round(progress.percentage)}% (${progress.downloaded}/${progress.total})`);
            }
        });
        
        console.log('✅ Download completed!');
        
        // The model is now automatically registered
        const models = await router.listModels();
        const newModel = models.find(m => m.id.includes('tinyllama'));
        
        if (newModel) {
            console.log('🎉 Model ready for use:', newModel.id);
            
            // Test the downloaded model
            const result = await router.process({
                prompt: 'What is artificial intelligence?',
                model: newModel.id,
                maxTokens: 100
            });
            
            console.log('Response:', result.response);
        }
        
    } catch (error) {
        console.error('❌ Download failed:', error.message);
    }
}

downloadModels();
```

## Basic Configuration

### Configuration File Setup

Create `config/basic.json`:

```json
{
  "logging": {
    "level": "info",
    "enableRequestLogging": true,
    "file": "./logs/app.log"
  },
  "performance": {
    "maxConcurrent": 5,
    "timeout": 30000,
    "enableStreaming": true
  },
  "cache": {
    "enabled": true,
    "ttl": 1800,
    "maxSize": 1000
  },
  "models": {
    "cacheDir": "./models",
    "autoDownload": true,
    "preferLocal": true
  },
  "routing": {
    "strategy": "balanced",
    "enableFallback": true,
    "healthCheckInterval": 30000
  }
}
```

### Using Configuration

Create `03-configuration.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function useConfiguration() {
    try {
        // Load from configuration file
        const router = new LLMRouter({
            configFile: './config/basic.json'
        });

        console.log('📋 Current configuration:');
        const config = router.getConfig();
        console.log('Performance settings:', config.performance);
        console.log('Cache settings:', config.cache);
        
        // Update configuration at runtime
        await router.updateConfig({
            performance: {
                maxConcurrent: 3  // Reduce concurrent requests
            }
        });
        
        console.log('⚡ Configuration updated!');
        
        // Test with new configuration
        const result = await router.process({
            prompt: 'Explain machine learning in simple terms.',
            maxTokens: 150
        });
        
        console.log('Response:', result.response);
        console.log('Configuration worked!');
        
    } catch (error) {
        console.error('❌ Configuration error:', error.message);
    }
}

useConfiguration();
```

### Environment Variables

Create `.env`:

```env
# Application
NODE_ENV=development
LOG_LEVEL=debug

# Performance
MAX_CONCURRENT_REQUESTS=5
REQUEST_TIMEOUT_MS=30000

# Cache
CACHE_ENABLED=true
CACHE_TTL=1800

# Models
MODEL_CACHE_DIR=./models
AUTO_DOWNLOAD_MODELS=true

# External APIs (optional)
OPENAI_API_KEY=your_key_here
HUGGINGFACE_TOKEN=your_token_here
```

## Error Handling

### Basic Error Handling

Create `04-error-handling.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function handleErrors() {
    const router = new LLMRouter();
    
    // Example 1: Model not found
    try {
        await router.process({
            prompt: 'Hello',
            model: 'non-existent-model'
        });
    } catch (error) {
        console.log('❌ Model not found error:', error.message);
        console.log('Error code:', error.code);
    }
    
    // Example 2: Invalid parameters
    try {
        await router.process({
            prompt: '',  // Empty prompt
            maxTokens: -1  // Invalid max tokens
        });
    } catch (error) {
        console.log('❌ Validation error:', error.message);
        console.log('Error details:', error.details);
    }
    
    // Example 3: Timeout handling
    try {
        await router.process({
            prompt: 'A very long prompt that might timeout...',
            timeout: 100  // Very short timeout
        });
    } catch (error) {
        if (error.code === 'TIMEOUT') {
            console.log('❌ Request timed out');
            console.log('Consider increasing timeout or using a faster model');
        }
    }
    
    // Example 4: Graceful error handling with fallback
    try {
        let result;
        
        try {
            // Try with preferred model
            result = await router.process({
                prompt: 'What is the weather like?',
                model: 'preferred-model'
            });
        } catch (error) {
            console.log('⚠️ Preferred model failed, trying fallback...');
            
            // Fallback to any available model
            result = await router.process({
                prompt: 'What is the weather like?',
                strategy: 'speed-priority'
            });
        }
        
        console.log('✅ Success with fallback:', result.response);
        
    } catch (error) {
        console.error('❌ All attempts failed:', error.message);
    }
}

handleErrors();
```

### Retry Mechanisms

```javascript
import { LLMRouter } from 'llm-runner-router';

async function withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.log(`Attempt ${i + 1} failed:`, error.message);
            
            if (i < maxRetries - 1) {
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    
    throw lastError;
}

async function robustInference() {
    const router = new LLMRouter();
    
    try {
        const result = await withRetry(async () => {
            return await router.process({
                prompt: 'Explain quantum computing',
                maxTokens: 200
            });
        });
        
        console.log('✅ Success after retries:', result.response);
        
    } catch (error) {
        console.error('❌ Failed after all retries:', error.message);
    }
}

robustInference();
```

## Performance Optimization

### Concurrent Requests

Create `05-performance.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function concurrentRequests() {
    const router = new LLMRouter({
        performance: {
            maxConcurrent: 3,
            enableBatching: true
        }
    });
    
    const prompts = [
        'Explain artificial intelligence',
        'What is machine learning?',
        'Describe neural networks',
        'What is deep learning?',
        'Explain natural language processing'
    ];
    
    console.log('🚀 Making concurrent requests...');
    const startTime = Date.now();
    
    try {
        // Process all prompts concurrently
        const promises = prompts.map(prompt => 
            router.process({
                prompt,
                maxTokens: 100
            })
        );
        
        const results = await Promise.all(promises);
        const endTime = Date.now();
        
        console.log(`✅ Processed ${results.length} requests in ${endTime - startTime}ms`);
        
        results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${prompts[index]}`);
            console.log(`   Response: ${result.response.substring(0, 100)}...`);
            console.log(`   Model: ${result.modelUsed}`);
            console.log(`   Duration: ${result.metrics.duration}ms`);
        });
        
    } catch (error) {
        console.error('❌ Concurrent processing failed:', error.message);
    }
}

concurrentRequests();
```

### Batch Processing

```javascript
async function batchProcessing() {
    const router = new LLMRouter();
    
    const prompts = [
        'Translate "hello" to Spanish',
        'What is 2 + 2?',
        'Name a programming language',
        'What color is the sky?',
        'How many days in a week?'
    ];
    
    console.log('📦 Processing batch requests...');
    
    try {
        // Use built-in batch processing
        const results = await router.processBatch(prompts, {
            maxTokens: 50,
            concurrent: 3,  // Process 3 at a time
            strategy: 'speed-priority'
        });
        
        console.log('✅ Batch processing completed!');
        
        results.forEach((result, index) => {
            if (result.success) {
                console.log(`${index + 1}. ${result.response}`);
            } else {
                console.log(`${index + 1}. Error: ${result.error}`);
            }
        });
        
        // Calculate statistics
        const successful = results.filter(r => r.success).length;
        const totalTime = results.reduce((sum, r) => sum + (r.metrics?.duration || 0), 0);
        const avgTime = totalTime / successful;
        
        console.log(`\n📊 Statistics:`);
        console.log(`Successful: ${successful}/${results.length}`);
        console.log(`Average time: ${Math.round(avgTime)}ms`);
        
    } catch (error) {
        console.error('❌ Batch processing failed:', error.message);
    }
}

batchProcessing();
```

### Caching for Performance

```javascript
async function cachingExample() {
    const router = new LLMRouter({
        cache: {
            enabled: true,
            ttl: 300,  // 5 minutes
            strategy: 'lru'
        }
    });
    
    const prompt = 'What is the capital of France?';
    
    console.log('🔄 Testing cache performance...');
    
    // First request (cache miss)
    console.log('First request (cache miss):');
    const start1 = Date.now();
    const result1 = await router.process({ prompt, maxTokens: 50 });
    const time1 = Date.now() - start1;
    
    console.log(`Response: ${result1.response}`);
    console.log(`Time: ${time1}ms`);
    console.log(`Cache hit: ${result1.metadata.cacheHit || false}`);
    
    // Second request (cache hit)
    console.log('\nSecond request (cache hit):');
    const start2 = Date.now();
    const result2 = await router.process({ prompt, maxTokens: 50 });
    const time2 = Date.now() - start2;
    
    console.log(`Response: ${result2.response}`);
    console.log(`Time: ${time2}ms`);
    console.log(`Cache hit: ${result2.metadata.cacheHit || false}`);
    
    console.log(`\n⚡ Speed improvement: ${Math.round((time1 - time2) / time1 * 100)}%`);
}

cachingExample();
```

## Practical Examples

### Chatbot Example

Create `06-chatbot.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';
import readline from 'readline';

class SimpleChatbot {
    constructor() {
        this.router = new LLMRouter({
            performance: { maxConcurrent: 1 },
            logging: { level: 'warn' }
        });
        
        this.conversationHistory = [];
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    
    async start() {
        console.log('🤖 Simple Chatbot Started!');
        console.log('Type "exit" to quit, "clear" to clear history\n');
        
        await this.chat();
    }
    
    async chat() {
        this.rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('👋 Goodbye!');
                this.rl.close();
                return;
            }
            
            if (input.toLowerCase() === 'clear') {
                this.conversationHistory = [];
                console.log('🧹 Conversation history cleared!\n');
                await this.chat();
                return;
            }
            
            try {
                // Build context from conversation history
                const context = this.buildContext(input);
                
                console.log('Bot: Thinking...');
                
                const result = await this.router.process({
                    prompt: context,
                    maxTokens: 150,
                    temperature: 0.7
                });
                
                const response = result.response.trim();
                console.log(`Bot: ${response}\n`);
                
                // Update conversation history
                this.conversationHistory.push({
                    user: input,
                    bot: response,
                    timestamp: new Date().toISOString()
                });
                
                // Keep only last 5 exchanges
                if (this.conversationHistory.length > 5) {
                    this.conversationHistory.shift();
                }
                
            } catch (error) {
                console.log(`Bot: Sorry, I encountered an error: ${error.message}\n`);
            }
            
            await this.chat();
        });
    }
    
    buildContext(currentInput) {
        let context = 'You are a helpful AI assistant. Have a natural conversation.\n\n';
        
        // Add conversation history
        this.conversationHistory.forEach(exchange => {
            context += `Human: ${exchange.user}\n`;
            context += `Assistant: ${exchange.bot}\n\n`;
        });
        
        // Add current input
        context += `Human: ${currentInput}\n`;
        context += `Assistant:`;
        
        return context;
    }
}

// Start the chatbot
const chatbot = new SimpleChatbot();
chatbot.start().catch(console.error);
```

### Text Analysis Service

Create `07-text-analysis.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

class TextAnalyzer {
    constructor() {
        this.router = new LLMRouter();
    }
    
    async analyzeSentiment(text) {
        const result = await this.router.process({
            prompt: `Analyze the sentiment of this text and respond with only "positive", "negative", or "neutral":\n\n"${text}"`,
            maxTokens: 10,
            temperature: 0.1
        });
        
        return result.response.toLowerCase().trim();
    }
    
    async summarizeText(text, maxWords = 50) {
        const result = await this.router.process({
            prompt: `Summarize this text in ${maxWords} words or less:\n\n"${text}"`,
            maxTokens: Math.round(maxWords * 1.5),
            temperature: 0.3
        });
        
        return result.response.trim();
    }
    
    async extractKeywords(text, count = 5) {
        const result = await this.router.process({
            prompt: `Extract the ${count} most important keywords from this text. Return only the keywords separated by commas:\n\n"${text}"`,
            maxTokens: 50,
            temperature: 0.1
        });
        
        return result.response.split(',').map(keyword => keyword.trim());
    }
    
    async classifyText(text, categories) {
        const categoryList = categories.join(', ');
        
        const result = await this.router.process({
            prompt: `Classify this text into one of these categories: ${categoryList}. Respond with only the category name:\n\n"${text}"`,
            maxTokens: 20,
            temperature: 0.1
        });
        
        return result.response.trim();
    }
}

// Example usage
async function textAnalysisDemo() {
    const analyzer = new TextAnalyzer();
    
    const sampleText = `
        I absolutely love this new smartphone! The camera quality is amazing, 
        the battery lasts all day, and the interface is so intuitive. 
        This is definitely the best phone I've ever owned. 
        I would highly recommend it to anyone looking for a reliable device.
    `;
    
    try {
        console.log('📝 Analyzing text...\n');
        console.log('Original text:', sampleText.trim());
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Sentiment analysis
        const sentiment = await analyzer.analyzeSentiment(sampleText);
        console.log('😊 Sentiment:', sentiment);
        
        // Text summarization
        const summary = await analyzer.summarizeText(sampleText, 30);
        console.log('📋 Summary:', summary);
        
        // Keyword extraction
        const keywords = await analyzer.extractKeywords(sampleText);
        console.log('🔑 Keywords:', keywords.join(', '));
        
        // Text classification
        const categories = ['Technology', 'Food', 'Travel', 'Sports', 'Entertainment'];
        const category = await analyzer.classifyText(sampleText, categories);
        console.log('📂 Category:', category);
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

textAnalysisDemo();
```

### Content Generator

Create `08-content-generator.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

class ContentGenerator {
    constructor() {
        this.router = new LLMRouter();
    }
    
    async generateBlogPost(topic, wordCount = 500) {
        const result = await this.router.process({
            prompt: `Write a ${wordCount}-word blog post about "${topic}". Include an engaging title, introduction, main points, and conclusion.`,
            maxTokens: Math.round(wordCount * 1.5),
            temperature: 0.7
        });
        
        return result.response;
    }
    
    async generateEmailTemplate(purpose, tone = 'professional') {
        const result = await this.router.process({
            prompt: `Create an email template for "${purpose}" with a ${tone} tone. Include subject line, greeting, body, and closing.`,
            maxTokens: 300,
            temperature: 0.6
        });
        
        return result.response;
    }
    
    async generateProductDescription(productName, features) {
        const featureList = features.join(', ');
        
        const result = await this.router.process({
            prompt: `Write a compelling product description for "${productName}" with these features: ${featureList}. Make it persuasive and highlight the benefits.`,
            maxTokens: 200,
            temperature: 0.7
        });
        
        return result.response;
    }
    
    async generateSocialMediaPost(content, platform) {
        const characterLimits = {
            twitter: 280,
            linkedin: 3000,
            instagram: 2200,
            facebook: 63206
        };
        
        const limit = characterLimits[platform.toLowerCase()] || 300;
        
        const result = await this.router.process({
            prompt: `Create a ${platform} post about "${content}". Keep it under ${limit} characters and make it engaging for ${platform} audience.`,
            maxTokens: Math.round(limit / 3),
            temperature: 0.8
        });
        
        return result.response;
    }
}

// Example usage
async function contentGenerationDemo() {
    const generator = new ContentGenerator();
    
    try {
        console.log('✍️ Content Generation Demo\n');
        
        // Blog post
        console.log('📝 Generating blog post...');
        const blogPost = await generator.generateBlogPost('The Future of Artificial Intelligence', 300);
        console.log('Blog Post:', blogPost.substring(0, 200) + '...\n');
        
        // Email template
        console.log('📧 Generating email template...');
        const emailTemplate = await generator.generateEmailTemplate('Following up on a job interview');
        console.log('Email Template:', emailTemplate.substring(0, 200) + '...\n');
        
        // Product description
        console.log('🛍️ Generating product description...');
        const productDesc = await generator.generateProductDescription(
            'Smart Wireless Headphones',
            ['noise cancellation', 'wireless connectivity', '20-hour battery life', 'premium sound quality']
        );
        console.log('Product Description:', productDesc.substring(0, 200) + '...\n');
        
        // Social media posts
        const platforms = ['twitter', 'linkedin', 'instagram'];
        const content = 'Launch of our new AI-powered productivity app';
        
        for (const platform of platforms) {
            console.log(`📱 Generating ${platform} post...`);
            const post = await generator.generateSocialMediaPost(content, platform);
            console.log(`${platform} Post:`, post.substring(0, 150) + '...\n');
        }
        
    } catch (error) {
        console.error('❌ Content generation failed:', error.message);
    }
}

contentGenerationDemo();
```

## Next Steps

Congratulations! You've completed the basic usage tutorial. Here's what to explore next:

### 🚀 Advanced Tutorials
1. **[Streaming Tutorial](./streaming-tutorial.md)** - Real-time response streaming
2. **[Custom Loaders](./custom-loaders.md)** - Creating custom model loaders
3. **[Enterprise Setup](./enterprise-setup.md)** - Multi-tenancy and A/B testing
4. **[Monitoring Setup](./monitoring-setup.md)** - Observability and metrics

### 📚 Additional Resources
- **[Configuration Guide](../guides/configuration-guide.md)** - Detailed configuration options
- **[API Reference](../API_REFERENCE.md)** - Complete API documentation
- **[Examples](../examples/)** - More complex usage examples
- **[Troubleshooting](../guides/troubleshooting.md)** - Common issues and solutions

### 🛠️ Practice Projects
Try building these projects to reinforce your learning:

1. **Personal Assistant Bot** - Extend the chatbot example with memory and tasks
2. **Content Management System** - Batch process documents with the text analyzer
3. **API Service** - Create a REST API using Express.js and LLM Router
4. **Monitoring Dashboard** - Build a real-time dashboard for your models

### 💡 Tips for Success
- **Start small** - Begin with simple use cases and gradually add complexity
- **Monitor performance** - Always track response times and resource usage
- **Handle errors gracefully** - Implement proper error handling and fallbacks
- **Cache intelligently** - Use caching to improve performance for repeated requests
- **Test thoroughly** - Test with different models and configurations

Ready to dive deeper? Start with the [Streaming Tutorial](./streaming-tutorial.md) to learn about real-time response generation!