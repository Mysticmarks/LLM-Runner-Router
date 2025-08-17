# Streaming Tutorial

Learn how to implement real-time streaming responses with LLM Runner Router for better user experience and perceived performance.

## Table of Contents

1. [Understanding Streaming](#understanding-streaming)
2. [Basic Streaming](#basic-streaming)
3. [Web Streaming](#web-streaming)
4. [Advanced Streaming Patterns](#advanced-streaming-patterns)
5. [Error Handling in Streams](#error-handling-in-streams)
6. [Performance Optimization](#performance-optimization)
7. [Real-World Examples](#real-world-examples)
8. [Best Practices](#best-practices)

## Understanding Streaming

### What is Streaming?

Streaming allows you to receive model responses in real-time as they're generated, rather than waiting for the complete response. This provides:

- **Better User Experience** - Users see responses appearing progressively
- **Perceived Performance** - Reduces waiting time perception
- **Real-time Interaction** - Enables interactive applications
- **Memory Efficiency** - Processes data without loading entire responses

### When to Use Streaming

✅ **Good for:**
- Chat applications
- Long-form content generation
- Interactive assistants
- Real-time translation
- Code generation

❌ **Not ideal for:**
- Short responses (< 50 tokens)
- Batch processing
- When you need the complete response for processing
- High-latency environments

## Basic Streaming

### Simple Console Streaming

Create `01-basic-streaming.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function basicStreaming() {
    const router = new LLMRouter({
        performance: {
            enableStreaming: true
        }
    });

    console.log('🚀 Starting streaming example...\n');
    console.log('Bot: ');

    try {
        // Create a streaming request
        const stream = await router.processStream({
            prompt: 'Write a short story about a robot learning to paint. Make it creative and engaging.',
            maxTokens: 200,
            temperature: 0.8
        });

        // Process the stream
        for await (const chunk of stream) {
            // Print each token as it arrives
            process.stdout.write(chunk.token);
            
            // Optional: Add typing delay for realism
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log('\n\n✅ Streaming completed!');

    } catch (error) {
        console.error('❌ Streaming failed:', error.message);
    }
}

basicStreaming();
```

### Stream with Metadata

Create `02-stream-metadata.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function streamWithMetadata() {
    const router = new LLMRouter();

    try {
        const stream = await router.processStream({
            prompt: 'Explain quantum computing in simple terms.',
            maxTokens: 150,
            includeMetadata: true  // Include additional metadata
        });

        let tokenCount = 0;
        let startTime = Date.now();

        console.log('🔄 Streaming with metadata...\n');

        for await (const chunk of stream) {
            // Handle different chunk types
            switch (chunk.type) {
                case 'start':
                    console.log('📝 Stream started');
                    console.log('Model:', chunk.metadata.model);
                    console.log('Request ID:', chunk.metadata.requestId);
                    console.log('\nResponse:\n');
                    break;

                case 'token':
                    process.stdout.write(chunk.token);
                    tokenCount++;
                    break;

                case 'metadata':
                    // Handle intermediate metadata (usage stats, etc.)
                    if (chunk.data.usage) {
                        console.log(`\n[Tokens: ${chunk.data.usage.totalTokens}]`);
                    }
                    break;

                case 'end':
                    const duration = Date.now() - startTime;
                    console.log('\n\n📊 Stream Statistics:');
                    console.log(`Tokens generated: ${tokenCount}`);
                    console.log(`Duration: ${duration}ms`);
                    console.log(`Tokens/second: ${Math.round(tokenCount / (duration / 1000))}`);
                    console.log(`Final usage:`, chunk.metadata.usage);
                    break;

                case 'error':
                    console.error('\n❌ Stream error:', chunk.error);
                    break;
            }
        }

    } catch (error) {
        console.error('❌ Streaming failed:', error.message);
    }
}

streamWithMetadata();
```

### Stream Control

```javascript
import { LLMRouter } from 'llm-runner-router';

async function streamControl() {
    const router = new LLMRouter();

    try {
        console.log('🎮 Stream control example...\n');

        const stream = await router.processStream({
            prompt: 'Write a long article about artificial intelligence, covering history, current applications, and future prospects.',
            maxTokens: 500,
            temperature: 0.7
        });

        let tokenCount = 0;
        let shouldStop = false;

        // Stop streaming after 100 tokens for demonstration
        setTimeout(() => {
            console.log('\n\n⏹️ Stopping stream early...');
            shouldStop = true;
        }, 5000);

        for await (const chunk of stream) {
            if (shouldStop) {
                // Cancel the stream
                await stream.cancel();
                break;
            }

            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
                tokenCount++;

                // Pause streaming every 20 tokens
                if (tokenCount % 20 === 0) {
                    console.log(`\n[Pausing... ${tokenCount} tokens]`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        console.log(`\n\n✅ Stream ended. Total tokens: ${tokenCount}`);

    } catch (error) {
        console.error('❌ Streaming failed:', error.message);
    }
}

streamControl();
```

## Web Streaming

### Express.js Server-Sent Events

Create `03-web-streaming.js`:

```javascript
import express from 'express';
import { LLMRouter } from 'llm-runner-router';

const app = express();
const router = new LLMRouter();

app.use(express.json());
app.use(express.static('public'));

// Server-Sent Events endpoint
app.post('/stream', async (req, res) => {
    const { prompt, maxTokens = 200 } = req.body;

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
        console.log('🔄 Starting stream for prompt:', prompt);

        const stream = await router.processStream({
            prompt,
            maxTokens,
            temperature: 0.7
        });

        // Send stream start event
        res.write(`data: ${JSON.stringify({
            type: 'start',
            message: 'Stream started'
        })}\n\n`);

        // Process the stream
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                // Send token data
                res.write(`data: ${JSON.stringify({
                    type: 'token',
                    token: chunk.token
                })}\n\n`);
            } else if (chunk.type === 'end') {
                // Send completion data
                res.write(`data: ${JSON.stringify({
                    type: 'end',
                    metadata: chunk.metadata
                })}\n\n`);
                break;
            }
        }

    } catch (error) {
        // Send error data
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
        })}\n\n`);
    } finally {
        res.end();
    }
});

// Regular (non-streaming) endpoint for comparison
app.post('/generate', async (req, res) => {
    try {
        const { prompt, maxTokens = 200 } = req.body;
        
        const result = await router.process({
            prompt,
            maxTokens,
            temperature: 0.7
        });

        res.json({
            success: true,
            response: result.response,
            metadata: result.metadata
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log('🌐 Server running on http://localhost:3000');
    console.log('Try the streaming endpoint at /stream');
});
```

### Frontend HTML Client

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Streaming Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .chat-container {
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            min-height: 300px;
            background-color: #f9f9f9;
        }
        .response {
            background-color: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #007bff;
        }
        .input-container {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        input[type="text"] {
            flex: 1;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #0056b3;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .typing-indicator {
            color: #666;
            font-style: italic;
        }
        .metadata {
            font-size: 0.8em;
            color: #666;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>🚀 LLM Streaming Demo</h1>
    
    <div class="input-container">
        <input type="text" id="promptInput" placeholder="Enter your prompt here..." 
               value="Write a short poem about technology">
        <button id="streamBtn" onclick="startStreaming()">Stream Response</button>
        <button id="normalBtn" onclick="normalGenerate()">Normal Response</button>
    </div>

    <div class="chat-container" id="chatContainer">
        <p>Enter a prompt above and click "Stream Response" to see real-time generation!</p>
    </div>

    <script>
        let isStreaming = false;

        async function startStreaming() {
            const prompt = document.getElementById('promptInput').value;
            if (!prompt.trim()) return;

            const chatContainer = document.getElementById('chatContainer');
            const streamBtn = document.getElementById('streamBtn');
            const normalBtn = document.getElementById('normalBtn');

            // Disable buttons during streaming
            streamBtn.disabled = true;
            normalBtn.disabled = true;
            isStreaming = true;

            // Create response container
            const responseDiv = document.createElement('div');
            responseDiv.className = 'response';
            responseDiv.innerHTML = `
                <strong>Prompt:</strong> ${prompt}<br><br>
                <strong>Streaming Response:</strong><br>
                <div id="streamingText" class="typing-indicator">Connecting...</div>
                <div class="metadata" id="streamingMetadata"></div>
            `;
            chatContainer.appendChild(responseDiv);

            const streamingText = document.getElementById('streamingText');
            const streamingMetadata = document.getElementById('streamingMetadata');

            try {
                const response = await fetch('/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt, maxTokens: 200 })
                });

                const reader = response.body.getReader();
                let responseText = '';
                let startTime = Date.now();

                streamingText.textContent = '';
                streamingText.className = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                
                                switch (data.type) {
                                    case 'start':
                                        streamingText.textContent = '';
                                        break;
                                    
                                    case 'token':
                                        responseText += data.token;
                                        streamingText.textContent = responseText;
                                        break;
                                    
                                    case 'end':
                                        const duration = Date.now() - startTime;
                                        streamingMetadata.innerHTML = `
                                            Duration: ${duration}ms | 
                                            Tokens: ${data.metadata?.usage?.totalTokens || 'N/A'} |
                                            Model: ${data.metadata?.model || 'N/A'}
                                        `;
                                        break;
                                    
                                    case 'error':
                                        streamingText.textContent = `Error: ${data.error}`;
                                        streamingText.style.color = 'red';
                                        break;
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE data:', e);
                            }
                        }
                    }
                }

            } catch (error) {
                streamingText.textContent = `Error: ${error.message}`;
                streamingText.style.color = 'red';
            } finally {
                // Re-enable buttons
                streamBtn.disabled = false;
                normalBtn.disabled = false;
                isStreaming = false;
            }
        }

        async function normalGenerate() {
            const prompt = document.getElementById('promptInput').value;
            if (!prompt.trim()) return;

            const chatContainer = document.getElementById('chatContainer');
            const streamBtn = document.getElementById('streamBtn');
            const normalBtn = document.getElementById('normalBtn');

            streamBtn.disabled = true;
            normalBtn.disabled = true;

            // Create response container
            const responseDiv = document.createElement('div');
            responseDiv.className = 'response';
            responseDiv.innerHTML = `
                <strong>Prompt:</strong> ${prompt}<br><br>
                <strong>Normal Response:</strong><br>
                <div class="typing-indicator">Generating...</div>
            `;
            chatContainer.appendChild(responseDiv);

            const startTime = Date.now();

            try {
                const response = await fetch('/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt, maxTokens: 200 })
                });

                const result = await response.json();
                const duration = Date.now() - startTime;

                if (result.success) {
                    responseDiv.innerHTML = `
                        <strong>Prompt:</strong> ${prompt}<br><br>
                        <strong>Normal Response:</strong><br>
                        ${result.response}
                        <div class="metadata">
                            Duration: ${duration}ms | 
                            Tokens: ${result.metadata?.usage?.totalTokens || 'N/A'} |
                            Model: ${result.metadata?.model || 'N/A'}
                        </div>
                    `;
                } else {
                    responseDiv.innerHTML = `
                        <strong>Prompt:</strong> ${prompt}<br><br>
                        <strong>Error:</strong> ${result.error}
                    `;
                }

            } catch (error) {
                responseDiv.innerHTML = `
                    <strong>Prompt:</strong> ${prompt}<br><br>
                    <strong>Error:</strong> ${error.message}
                `;
            } finally {
                streamBtn.disabled = false;
                normalBtn.disabled = false;
            }
        }

        // Allow Enter key to trigger streaming
        document.getElementById('promptInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !isStreaming) {
                startStreaming();
            }
        });
    </script>
</body>
</html>
```

### WebSocket Streaming

Create `04-websocket-streaming.js`:

```javascript
import { WebSocketServer } from 'ws';
import { LLMRouter } from 'llm-runner-router';
import http from 'http';

const router = new LLMRouter();
const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('👋 Client connected');

    ws.on('message', async (data) => {
        try {
            const request = JSON.parse(data.toString());
            
            if (request.type === 'generate') {
                console.log('🔄 Processing request:', request.prompt);

                // Send acknowledgment
                ws.send(JSON.stringify({
                    type: 'start',
                    requestId: request.requestId,
                    message: 'Starting generation...'
                }));

                const stream = await router.processStream({
                    prompt: request.prompt,
                    maxTokens: request.maxTokens || 200,
                    temperature: request.temperature || 0.7
                });

                let tokenCount = 0;
                const startTime = Date.now();

                for await (const chunk of stream) {
                    if (ws.readyState !== ws.OPEN) {
                        break; // Client disconnected
                    }

                    switch (chunk.type) {
                        case 'token':
                            tokenCount++;
                            ws.send(JSON.stringify({
                                type: 'token',
                                requestId: request.requestId,
                                token: chunk.token,
                                tokenIndex: tokenCount
                            }));
                            break;

                        case 'end':
                            const duration = Date.now() - startTime;
                            ws.send(JSON.stringify({
                                type: 'complete',
                                requestId: request.requestId,
                                metadata: {
                                    ...chunk.metadata,
                                    duration,
                                    tokenCount
                                }
                            }));
                            break;

                        case 'error':
                            ws.send(JSON.stringify({
                                type: 'error',
                                requestId: request.requestId,
                                error: chunk.error.message
                            }));
                            break;
                    }
                }
            }

        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                error: error.message
            }));
        }
    });

    ws.on('close', () => {
        console.log('👋 Client disconnected');
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established'
    }));
});

server.listen(3001, () => {
    console.log('🌐 WebSocket server running on ws://localhost:3001');
});
```

## Advanced Streaming Patterns

### Multi-Model Streaming

Create `05-multi-model-streaming.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

async function multiModelStreaming() {
    const router = new LLMRouter();

    const prompt = 'Explain the concept of machine learning in simple terms.';
    const models = ['model1', 'model2', 'model3']; // Available models

    console.log('🤖 Multi-model streaming comparison\n');
    console.log(`Prompt: ${prompt}\n`);

    try {
        // Start streaming from multiple models simultaneously
        const streams = await Promise.all(
            models.map(async (modelId, index) => {
                try {
                    const stream = await router.processStream({
                        prompt,
                        model: modelId,
                        maxTokens: 150
                    });
                    return { modelId, stream, index };
                } catch (error) {
                    console.log(`❌ Model ${modelId} failed to start:`, error.message);
                    return null;
                }
            })
        );

        // Filter out failed streams
        const activeStreams = streams.filter(s => s !== null);

        if (activeStreams.length === 0) {
            console.log('❌ No models available for streaming');
            return;
        }

        // Process streams in parallel
        const promises = activeStreams.map(async ({ modelId, stream, index }) => {
            let response = '';
            const startTime = Date.now();

            console.log(`🔄 Model ${index + 1} (${modelId}):`);

            try {
                for await (const chunk of stream) {
                    if (chunk.type === 'token') {
                        response += chunk.token;
                        // Show progress every 20 tokens
                        if (response.length % 60 === 0) {
                            console.log(`Model ${index + 1}: ${response.length} chars so far...`);
                        }
                    }
                }

                const duration = Date.now() - startTime;
                console.log(`\n✅ Model ${index + 1} (${modelId}) completed in ${duration}ms:`);
                console.log(response.substring(0, 200) + (response.length > 200 ? '...' : ''));
                console.log('-'.repeat(50));

                return { modelId, response, duration };

            } catch (error) {
                console.log(`❌ Model ${index + 1} (${modelId}) failed:`, error.message);
                return { modelId, error: error.message, duration: Date.now() - startTime };
            }
        });

        // Wait for all streams to complete
        const results = await Promise.all(promises);

        // Show summary
        console.log('\n📊 Summary:');
        results.forEach((result, index) => {
            if (result.error) {
                console.log(`Model ${index + 1}: Error - ${result.error}`);
            } else {
                console.log(`Model ${index + 1}: ${result.response.length} chars in ${result.duration}ms`);
            }
        });

    } catch (error) {
        console.error('❌ Multi-model streaming failed:', error.message);
    }
}

multiModelStreaming();
```

### Streaming with Processing Pipeline

```javascript
import { LLMRouter } from 'llm-runner-router';

class StreamProcessor {
    constructor() {
        this.router = new LLMRouter();
        this.processors = [
            this.sentimentAnalyzer,
            this.keywordExtractor,
            this.lengthTracker
        ];
    }

    async processWithPipeline(prompt, maxTokens = 200) {
        console.log('🔄 Starting streaming with processing pipeline...\n');

        const stream = await this.router.processStream({
            prompt,
            maxTokens,
            temperature: 0.7
        });

        let fullResponse = '';
        let tokenCount = 0;
        const analytics = {
            sentiment: { positive: 0, negative: 0, neutral: 0 },
            keywords: new Map(),
            length: 0,
            readingTime: 0
        };

        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
                fullResponse += chunk.token;
                tokenCount++;

                // Process every 10 tokens
                if (tokenCount % 10 === 0) {
                    await this.runProcessors(fullResponse, analytics);
                    this.showAnalytics(analytics, tokenCount);
                }
            }
        }

        // Final processing
        await this.runProcessors(fullResponse, analytics);
        
        console.log('\n\n📊 Final Analytics:');
        this.showDetailedAnalytics(analytics, fullResponse);

        return { response: fullResponse, analytics };
    }

    async runProcessors(text, analytics) {
        for (const processor of this.processors) {
            await processor.call(this, text, analytics);
        }
    }

    async sentimentAnalyzer(text, analytics) {
        // Simple sentiment analysis based on word patterns
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];

        const words = text.toLowerCase().split(/\W+/);
        
        analytics.sentiment.positive = words.filter(word => 
            positiveWords.some(pos => word.includes(pos))
        ).length;
        
        analytics.sentiment.negative = words.filter(word => 
            negativeWords.some(neg => word.includes(neg))
        ).length;
        
        analytics.sentiment.neutral = words.length - 
            analytics.sentiment.positive - analytics.sentiment.negative;
    }

    async keywordExtractor(text, analytics) {
        // Extract keywords (words longer than 4 characters, not common words)
        const commonWords = ['that', 'this', 'with', 'have', 'will', 'from', 'they', 'know', 'want', 'been'];
        const words = text.toLowerCase().match(/\b\w{5,}\b/g) || [];
        
        analytics.keywords.clear();
        words.forEach(word => {
            if (!commonWords.includes(word)) {
                analytics.keywords.set(word, (analytics.keywords.get(word) || 0) + 1);
            }
        });
    }

    async lengthTracker(text, analytics) {
        analytics.length = text.length;
        // Rough reading time: average 200 words per minute
        const wordCount = text.split(/\s+/).length;
        analytics.readingTime = Math.round(wordCount / 200 * 60); // seconds
    }

    showAnalytics(analytics, tokenCount) {
        process.stdout.write(`\n[${tokenCount} tokens | Sentiment: +${analytics.sentiment.positive}/-${analytics.sentiment.negative} | Length: ${analytics.length}]\n`);
    }

    showDetailedAnalytics(analytics, text) {
        console.log(`Length: ${analytics.length} characters`);
        console.log(`Reading time: ~${analytics.readingTime} seconds`);
        console.log('Sentiment breakdown:', analytics.sentiment);
        
        const topKeywords = Array.from(analytics.keywords.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        if (topKeywords.length > 0) {
            console.log('Top keywords:', topKeywords.map(([word, count]) => `${word}(${count})`).join(', '));
        }
    }
}

// Usage
async function pipelineDemo() {
    const processor = new StreamProcessor();
    
    const result = await processor.processWithPipeline(
        'Write a comprehensive guide about the benefits and challenges of artificial intelligence in modern healthcare, including specific examples and future prospects.',
        300
    );
    
    console.log('\n✅ Processing pipeline completed!');
}

pipelineDemo();
```

## Error Handling in Streams

### Robust Stream Error Handling

Create `06-stream-error-handling.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

class RobustStreamer {
    constructor() {
        this.router = new LLMRouter();
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async streamWithRetry(options) {
        let attempt = 0;
        let lastError;

        while (attempt < this.retryAttempts) {
            try {
                console.log(`🔄 Attempt ${attempt + 1}/${this.retryAttempts}`);
                
                const result = await this.safeStream(options);
                console.log('✅ Stream completed successfully');
                return result;

            } catch (error) {
                lastError = error;
                attempt++;
                
                console.log(`❌ Attempt ${attempt} failed:`, error.message);

                if (attempt < this.retryAttempts) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(`All ${this.retryAttempts} attempts failed. Last error: ${lastError.message}`);
    }

    async safeStream(options) {
        return new Promise(async (resolve, reject) => {
            let stream;
            let response = '';
            let cleanup = false;

            // Set up timeout
            const timeout = setTimeout(() => {
                cleanup = true;
                if (stream?.cancel) {
                    stream.cancel();
                }
                reject(new Error('Stream timeout'));
            }, options.timeout || 30000);

            // Set up error handler
            const errorHandler = (error) => {
                cleanup = true;
                clearTimeout(timeout);
                reject(error);
            };

            try {
                stream = await this.router.processStream({
                    prompt: options.prompt,
                    maxTokens: options.maxTokens || 200,
                    temperature: options.temperature || 0.7
                });

                let tokenCount = 0;
                const startTime = Date.now();

                for await (const chunk of stream) {
                    if (cleanup) break;

                    switch (chunk.type) {
                        case 'token':
                            if (options.onToken) {
                                options.onToken(chunk.token, tokenCount);
                            }
                            response += chunk.token;
                            tokenCount++;
                            break;

                        case 'error':
                            errorHandler(new Error(chunk.error.message));
                            return;

                        case 'end':
                            clearTimeout(timeout);
                            resolve({
                                response,
                                tokenCount,
                                duration: Date.now() - startTime,
                                metadata: chunk.metadata
                            });
                            return;
                    }

                    // Check for minimum progress to detect stalled streams
                    if (tokenCount === 0 && Date.now() - startTime > 10000) {
                        errorHandler(new Error('Stream stalled - no tokens received'));
                        return;
                    }
                }

                // If we get here, stream ended without explicit end chunk
                clearTimeout(timeout);
                resolve({
                    response,
                    tokenCount,
                    duration: Date.now() - startTime
                });

            } catch (error) {
                errorHandler(error);
            }
        });
    }
}

// Usage examples
async function errorHandlingDemo() {
    const streamer = new RobustStreamer();

    // Example 1: Normal streaming with error handling
    try {
        console.log('📝 Example 1: Normal streaming with robust error handling\n');
        
        const result = await streamer.streamWithRetry({
            prompt: 'Explain the concept of recursion in programming.',
            maxTokens: 150,
            timeout: 15000,
            onToken: (token, count) => {
                process.stdout.write(token);
                if (count % 20 === 0) {
                    console.log(`\n[${count} tokens]`);
                }
            }
        });

        console.log(`\n\n✅ Completed: ${result.tokenCount} tokens in ${result.duration}ms`);

    } catch (error) {
        console.error('\n❌ Failed after all retries:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Example 2: Handling model-specific errors
    try {
        console.log('📝 Example 2: Handling model-specific errors\n');
        
        const result = await streamer.streamWithRetry({
            prompt: 'This might fail with certain models...',
            maxTokens: 100,
            model: 'potentially-unavailable-model',
            onToken: (token) => process.stdout.write(token)
        });

    } catch (error) {
        console.error('\n❌ Model-specific error handled:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Example 3: Graceful degradation
    console.log('📝 Example 3: Graceful degradation\n');
    
    const fallbackStrategies = ['quality-first', 'balanced', 'speed-priority'];
    
    for (const strategy of fallbackStrategies) {
        try {
            console.log(`Trying strategy: ${strategy}`);
            
            const result = await streamer.streamWithRetry({
                prompt: 'What is artificial intelligence?',
                maxTokens: 100,
                strategy: strategy,
                onToken: (token) => process.stdout.write(token)
            });

            console.log(`\n✅ Success with ${strategy} strategy!`);
            break;

        } catch (error) {
            console.log(`\n❌ ${strategy} strategy failed:`, error.message);
        }
    }
}

errorHandlingDemo();
```

## Performance Optimization

### Stream Buffering and Batching

Create `07-stream-optimization.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

class OptimizedStreamer {
    constructor() {
        this.router = new LLMRouter({
            performance: {
                enableStreaming: true,
                streamingBufferSize: 8192,
                streamingBatchSize: 4
            }
        });
    }

    async bufferedStream(options) {
        const { prompt, maxTokens = 200, bufferSize = 5 } = options;
        
        console.log('🚀 Starting buffered streaming...\n');

        const stream = await this.router.processStream({
            prompt,
            maxTokens,
            temperature: 0.7
        });

        let buffer = '';
        let totalTokens = 0;
        const startTime = Date.now();

        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                buffer += chunk.token;
                totalTokens++;

                // Flush buffer when it reaches the desired size
                if (buffer.length >= bufferSize || chunk.token.includes(' ')) {
                    process.stdout.write(buffer);
                    buffer = '';
                    
                    // Add small delay for visual effect
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else if (chunk.type === 'end') {
                // Flush remaining buffer
                if (buffer) {
                    process.stdout.write(buffer);
                }
                
                const duration = Date.now() - startTime;
                console.log(`\n\n📊 Buffered streaming stats:`);
                console.log(`Total tokens: ${totalTokens}`);
                console.log(`Duration: ${duration}ms`);
                console.log(`Tokens/second: ${Math.round(totalTokens / (duration / 1000))}`);
            }
        }
    }

    async parallelStreaming(prompts) {
        console.log('🔄 Starting parallel streaming for multiple prompts...\n');

        const streams = await Promise.all(
            prompts.map(async (prompt, index) => ({
                id: index,
                prompt,
                stream: await this.router.processStream({
                    prompt,
                    maxTokens: 100,
                    temperature: 0.7
                })
            }))
        );

        // Process all streams in parallel
        const results = await Promise.all(
            streams.map(async ({ id, prompt, stream }) => {
                let response = '';
                const startTime = Date.now();

                console.log(`Stream ${id + 1}: Starting...`);

                for await (const chunk of stream) {
                    if (chunk.type === 'token') {
                        response += chunk.token;
                    } else if (chunk.type === 'end') {
                        const duration = Date.now() - startTime;
                        console.log(`Stream ${id + 1}: Completed in ${duration}ms`);
                        return { id, prompt, response, duration };
                    }
                }
            })
        );

        console.log('\n📊 Parallel streaming results:');
        results.forEach(result => {
            console.log(`\nStream ${result.id + 1}:`);
            console.log(`Prompt: ${result.prompt}`);
            console.log(`Response: ${result.response.substring(0, 100)}...`);
            console.log(`Duration: ${result.duration}ms`);
        });

        return results;
    }

    async adaptiveStreaming(prompt) {
        console.log('🧠 Starting adaptive streaming...\n');

        // Start with fast, lower-quality model for immediate response
        const quickStream = await this.router.processStream({
            prompt,
            maxTokens: 50,
            strategy: 'speed-priority',
            temperature: 0.5
        });

        let quickResponse = '';
        console.log('Quick response: ');

        // Get quick response
        for await (const chunk of quickStream) {
            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
                quickResponse += chunk.token;
            } else if (chunk.type === 'end') {
                break;
            }
        }

        console.log('\n\n🔄 Now getting detailed response...\n');

        // Then get detailed response with better model
        const detailedStream = await this.router.processStream({
            prompt: prompt + '\n\nProvide a more detailed and comprehensive response:',
            maxTokens: 200,
            strategy: 'quality-first',
            temperature: 0.7
        });

        let detailedResponse = '';
        console.log('Detailed response: ');

        for await (const chunk of detailedStream) {
            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
                detailedResponse += chunk.token;
            }
        }

        console.log('\n\n✅ Adaptive streaming completed!');
        return { quickResponse, detailedResponse };
    }
}

// Demonstration
async function optimizationDemo() {
    const streamer = new OptimizedStreamer();

    // Example 1: Buffered streaming
    console.log('='.repeat(60));
    console.log('DEMO 1: Buffered Streaming');
    console.log('='.repeat(60));

    await streamer.bufferedStream({
        prompt: 'Explain how neural networks work in artificial intelligence.',
        maxTokens: 150,
        bufferSize: 8
    });

    console.log('\n' + '='.repeat(60));
    console.log('DEMO 2: Parallel Streaming');
    console.log('='.repeat(60));

    const prompts = [
        'What is machine learning?',
        'Explain deep learning.',
        'What is natural language processing?'
    ];

    await streamer.parallelStreaming(prompts);

    console.log('\n' + '='.repeat(60));
    console.log('DEMO 3: Adaptive Streaming');
    console.log('='.repeat(60));

    await streamer.adaptiveStreaming('Explain quantum computing and its applications');
}

optimizationDemo();
```

## Real-World Examples

### Chat Application with Memory

Create `08-chat-with-memory.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';
import readline from 'readline';

class MemoryChat {
    constructor() {
        this.router = new LLMRouter();
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log('🤖 Memory-enabled Chat Bot with Streaming');
        console.log('Commands: /clear (clear history), /history (show history), /exit (quit)');
        console.log('='.repeat(60) + '\n');

        await this.chatLoop();
    }

    async chatLoop() {
        this.rl.question('You: ', async (input) => {
            const command = input.trim().toLowerCase();

            switch (command) {
                case '/exit':
                    console.log('👋 Goodbye!');
                    this.rl.close();
                    return;

                case '/clear':
                    this.conversationHistory = [];
                    console.log('🧹 Conversation history cleared!\n');
                    break;

                case '/history':
                    this.showHistory();
                    break;

                default:
                    await this.processMessage(input);
            }

            await this.chatLoop();
        });
    }

    async processMessage(userInput) {
        try {
            // Build context with conversation history
            const context = this.buildContext(userInput);

            console.log('\nBot: ');
            const stream = await this.router.processStream({
                prompt: context,
                maxTokens: 200,
                temperature: 0.7
            });

            let botResponse = '';
            const startTime = Date.now();

            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    process.stdout.write(chunk.token);
                    botResponse += chunk.token;

                    // Add natural typing delay
                    await new Promise(resolve => setTimeout(resolve, 30));
                } else if (chunk.type === 'end') {
                    const duration = Date.now() - startTime;
                    console.log(`\n[Response time: ${duration}ms]\n`);
                }
            }

            // Store in conversation history
            this.addToHistory(userInput, botResponse.trim());

        } catch (error) {
            console.log(`\nBot: Sorry, I encountered an error: ${error.message}\n`);
        }
    }

    buildContext(currentInput) {
        let context = `You are a helpful AI assistant. Maintain context from the conversation history and provide thoughtful responses.

Conversation History:
`;

        // Add recent conversation history
        this.conversationHistory.slice(-5).forEach(exchange => {
            context += `Human: ${exchange.user}\n`;
            context += `Assistant: ${exchange.bot}\n\n`;
        });

        context += `Human: ${currentInput}\n`;
        context += `Assistant:`;

        return context;
    }

    addToHistory(userInput, botResponse) {
        this.conversationHistory.push({
            user: userInput,
            bot: botResponse,
            timestamp: new Date().toISOString()
        });

        // Keep history size manageable
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory.shift();
        }
    }

    showHistory() {
        if (this.conversationHistory.length === 0) {
            console.log('📝 No conversation history yet.\n');
            return;
        }

        console.log('📝 Conversation History:');
        console.log('='.repeat(40));

        this.conversationHistory.forEach((exchange, index) => {
            const timestamp = new Date(exchange.timestamp).toLocaleTimeString();
            console.log(`${index + 1}. [${timestamp}]`);
            console.log(`   You: ${exchange.user}`);
            console.log(`   Bot: ${exchange.bot.substring(0, 100)}${exchange.bot.length > 100 ? '...' : ''}`);
            console.log();
        });
    }
}

// Start the chat
const chat = new MemoryChat();
chat.start().catch(console.error);
```

## Best Practices

### Streaming Best Practices Summary

```javascript
// streaming-best-practices.js

/**
 * STREAMING BEST PRACTICES FOR LLM RUNNER ROUTER
 */

class StreamingBestPractices {
    
    // ✅ DO: Handle errors gracefully
    async goodErrorHandling() {
        const router = new LLMRouter();
        
        try {
            const stream = await router.processStream({
                prompt: 'Your prompt',
                maxTokens: 200
            });

            for await (const chunk of stream) {
                if (chunk.type === 'error') {
                    console.error('Stream error:', chunk.error);
                    // Handle error appropriately
                    break;
                }
                // Process chunk...
            }
        } catch (error) {
            // Handle stream initialization errors
            console.error('Failed to start stream:', error.message);
        }
    }

    // ✅ DO: Implement timeouts
    async goodTimeoutHandling() {
        const router = new LLMRouter();
        
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Stream timeout')), 30000)
        );

        const streamPromise = router.processStream({
            prompt: 'Your prompt',
            maxTokens: 200
        });

        try {
            const stream = await Promise.race([streamPromise, timeoutPromise]);
            // Process stream...
        } catch (error) {
            console.error('Stream timed out or failed:', error.message);
        }
    }

    // ✅ DO: Buffer output for better performance
    async goodBuffering() {
        const router = new LLMRouter();
        const stream = await router.processStream({ /* options */ });
        
        let buffer = '';
        const bufferSize = 10; // Adjust based on needs

        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                buffer += chunk.token;
                
                if (buffer.length >= bufferSize) {
                    this.displayText(buffer);
                    buffer = '';
                }
            }
        }
        
        // Don't forget remaining buffer
        if (buffer) {
            this.displayText(buffer);
        }
    }

    // ✅ DO: Provide user feedback
    async goodUserFeedback() {
        const router = new LLMRouter();
        
        console.log('🤔 Thinking...');
        
        const stream = await router.processStream({ /* options */ });
        let tokenCount = 0;

        console.log('💭 Response:');
        
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                process.stdout.write(chunk.token);
                tokenCount++;
                
                // Show progress periodically
                if (tokenCount % 50 === 0) {
                    process.stdout.write(`\n[${tokenCount} tokens so far...]\n`);
                }
            }
        }
        
        console.log(`\n✅ Complete! (${tokenCount} tokens)`);
    }

    // ❌ DON'T: Block the event loop
    async badBlocking() {
        const router = new LLMRouter();
        const stream = await router.processStream({ /* options */ });
        
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                // ❌ This blocks the event loop
                const start = Date.now();
                while (Date.now() - start < 100) {
                    // Busy wait - BAD!
                }
                process.stdout.write(chunk.token);
            }
        }
    }

    // ❌ DON'T: Ignore stream cleanup
    async badCleanup() {
        const router = new LLMRouter();
        const stream = await router.processStream({ /* options */ });
        
        // ❌ No cleanup on interruption
        for await (const chunk of stream) {
            // Process chunks...
            // What if user cancels or error occurs?
        }
        // Stream might not be properly closed
    }

    // ✅ DO: Proper cleanup
    async goodCleanup() {
        const router = new LLMRouter();
        let stream;
        
        try {
            stream = await router.processStream({ /* options */ });
            
            for await (const chunk of stream) {
                // Process chunks...
            }
        } catch (error) {
            console.error('Stream error:', error.message);
        } finally {
            // Ensure cleanup
            if (stream && stream.cancel) {
                await stream.cancel();
            }
        }
    }

    displayText(text) {
        process.stdout.write(text);
    }
}

// Configuration recommendations
const streamingConfig = {
    // ✅ Optimize for your use case
    performance: {
        enableStreaming: true,
        streamingBufferSize: 8192,    // Adjust based on network
        streamingBatchSize: 4,        // Batch tokens for efficiency
        maxConcurrentStreams: 3       // Limit concurrent streams
    },
    
    // ✅ Set appropriate timeouts
    timeouts: {
        streamTimeout: 30000,         // 30 seconds max
        tokenTimeout: 5000,           // 5 seconds between tokens
        connectionTimeout: 10000      // 10 seconds to establish
    },
    
    // ✅ Handle errors properly
    errorHandling: {
        retryAttempts: 3,
        retryDelay: 1000,
        exponentialBackoff: true
    }
};

export { StreamingBestPractices, streamingConfig };
```

## Next Steps

🎉 **Congratulations!** You've completed the streaming tutorial. You now know how to:

- Implement basic streaming responses
- Handle web streaming with SSE and WebSockets
- Build advanced streaming patterns
- Handle errors and optimize performance
- Create real-world streaming applications

### 🚀 Continue Learning

1. **[Custom Loaders Tutorial](./custom-loaders.md)** - Create custom model loaders
2. **[Enterprise Setup Tutorial](./enterprise-setup.md)** - Multi-tenancy and A/B testing
3. **[Monitoring Setup Tutorial](./monitoring-setup.md)** - Observability and metrics

### 💡 Project Ideas

Try building these streaming applications:

1. **Real-time Translation Service** - Stream translations as user types
2. **Interactive Story Generator** - Let users influence story direction mid-stream
3. **Code Assistant** - Stream code completions with syntax highlighting
4. **Live Document Analyzer** - Stream analysis results as documents are processed

### 📚 Additional Resources

- **[Performance Guide](../guides/performance.md)** - Optimize streaming performance
- **[API Reference](../API_REFERENCE.md)** - Complete streaming API documentation
- **[Examples](../examples/)** - More streaming examples

Ready for the next challenge? Try the [Custom Loaders Tutorial](./custom-loaders.md)!