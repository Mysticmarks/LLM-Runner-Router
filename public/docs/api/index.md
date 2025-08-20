# 📚 API Provider Documentation

Welcome to the comprehensive documentation for API providers in LLM-Runner-Router. This documentation covers everything you need to integrate and use AI models from OpenAI, Anthropic, OpenRouter, Groq, and more.

## 🚀 Quick Navigation

### Getting Started
- **[Introduction](./introduction.md)** - Overview of API providers and benefits
- **[Quick Start Guide](./quickstart.md)** - Get running in 5 minutes
- **[API Reference](./reference/apiloader.md)** - Complete APILoader class reference

### Provider Documentation
- **[OpenAI](./providers/openai.md)** - GPT-4, GPT-3.5, embeddings, and more
- **[Anthropic](./providers/anthropic.md)** - Claude 3 family with 200K context
- **[OpenRouter](./providers/openrouter.md)** - Access 100+ models through one API
- **[Groq](./providers/groq.md)** - Ultra-fast inference with LPU technology

### Feature Documentation
- **[Streaming Responses](./features/streaming.md)** - Real-time token generation
- **[Cost Tracking](./features/cost-optimization.md)** - Monitor and optimize costs
- **[Rate Limiting](./features/rate-limiting.md)** - Handle API limits gracefully
- **[Response Caching](./features/caching.md)** - Improve performance with caching

### Advanced Topics
- **[Multi-Provider Routing](./advanced/routing.md)** - Intelligent model selection
- **[Enterprise Integration](./advanced/enterprise.md)** - Scale to production
- **[Custom Adapters](./advanced/custom-adapters.md)** - Build your own providers

### Tutorials & Guides
- **[Best Practices](./tutorials/best-practices.md)** - Production-ready patterns
- **[Migration Guides](./tutorials/migrating-from-openai.md)** - Migrate from other libraries
- **[Use Case Examples](./tutorials/chatbot-with-fallback.md)** - Real-world implementations

## 📖 What's New

### Version 2.0 Features
- ✅ Complete API provider support for OpenAI, Anthropic, OpenRouter, and Groq
- ✅ Unified interface across all providers
- ✅ Automatic fallback chains
- ✅ Real-time cost tracking
- ✅ Advanced streaming capabilities
- ✅ Built-in rate limiting and retry logic
- ✅ Response caching system
- ✅ 100+ models accessible through OpenRouter

## 🎯 Quick Examples

### Simple Completion
```javascript
import { APILoader } from 'llm-runner-router';

const ai = new APILoader({ provider: 'openai' });
const response = await ai.complete({
  prompt: "Explain quantum computing",
  maxTokens: 200
});
```

### Multi-Provider with Fallback
```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'groq'],
  strategy: 'fallback'
});

const response = await router.complete({
  prompt: "Write a haiku",
  fallbackOnError: true
});
```

### Streaming with Progress
```javascript
const stream = await ai.streamCompletion({
  prompt: "Write a story",
  maxTokens: 1000
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
  console.log(`Progress: ${chunk.progress}%`);
}
```

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Your Application│
└────────┬────────┘
         │
┌────────▼────────┐
│  LLM-Runner-Router│
├─────────────────┤
│  • Unified API  │
│  • Routing Logic│
│  • Cost Tracking│
│  • Rate Limiting│
│  • Caching      │
└────────┬────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    ▼         ▼         ▼          ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│ OpenAI ││Anthropic││OpenRouter││  Groq  │
└────────┘└────────┘└────────┘└────────┘
```

## 💰 Provider Comparison

| Provider | Models | Context | Speed | Cost | Best For |
|----------|--------|---------|-------|------|----------|
| **OpenAI** | GPT-4, GPT-3.5 | 128K | Fast | $$ | General purpose, functions |
| **Anthropic** | Claude 3 family | 200K | Fast | $$ | Long context, analysis |
| **OpenRouter** | 100+ models | Varies | Varies | $ | Model variety, cost optimization |
| **Groq** | Llama, Mixtral | 32K | Ultra-fast | $ | Speed-critical applications |

## 🛠️ Installation

```bash
# npm
npm install llm-runner-router

# yarn
yarn add llm-runner-router

# pnpm
pnpm add llm-runner-router
```

## 🔑 API Keys Setup

```bash
# .env file
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
```

## 📊 Performance Metrics

### Typical Response Times
- **First Token**: 100-500ms
- **Streaming Rate**: 20-500 tokens/second
- **Total Latency**: 1-5 seconds for typical requests

### Cost Efficiency
- **Automatic model selection** based on task complexity
- **Cost tracking** per request, model, and provider
- **Budget constraints** to prevent overruns
- **Caching** to eliminate redundant API calls

## 🚦 Getting Help

### Documentation
- **[Complete API Reference](./reference/apiloader.md)** - Every method documented
- **[Provider Guides](./providers/)** - Provider-specific features
- **[Code Examples](../../examples/)** - Working demonstrations

### Community
- **[GitHub Issues](https://github.com/MCERQUA/LLM-Runner-Router/issues)** - Report bugs
- **[Discussions](https://github.com/MCERQUA/LLM-Runner-Router/discussions)** - Ask questions
- **[Discord](https://discord.gg/llm-runner-router)** - Real-time chat

### Support
- **Email**: support@llm-runner-router.dev
- **Twitter**: [@LLMRunnerRouter](https://twitter.com/LLMRunnerRouter)
- **Stack Overflow**: Tag `llm-runner-router`

## 📋 API Quick Reference

### Core Methods
```javascript
// Initialize
const ai = new APILoader({ provider: 'openai' });

// Load model
await ai.load('gpt-4-turbo-preview');

// Generate completion
const response = await ai.complete({
  prompt: "...",
  maxTokens: 200
});

// Stream response
const stream = await ai.streamCompletion({ prompt: "..." });
for await (const chunk of stream) { }

// List models
const models = await ai.listModels();

// Get costs
const costs = ai.getCosts();
```

### Provider-Specific Features
```javascript
// OpenAI: Function calling
await ai.complete({
  functions: [{ name: 'get_weather', ... }]
});

// Anthropic: System prompts
await ai.complete({
  systemPrompt: "You are a helpful assistant",
  prompt: "..."
});

// OpenRouter: Auto model selection
await ai.complete({
  model: 'openrouter/auto',
  requirements: { maxCost: 0.01 }
});

// Groq: Ultra-fast streaming
const stream = await ai.streamCompletion({
  model: 'llama3-8b-8192',
  speedPriority: true
});
```

## 🎓 Learning Path

1. **Start Here**
   - [Introduction](./introduction.md) - Understand the concepts
   - [Quick Start](./quickstart.md) - First API call

2. **Choose Your Provider**
   - Pick a provider from [Providers](./providers/)
   - Follow provider-specific setup

3. **Implement Features**
   - Add [Streaming](./features/streaming.md) for better UX
   - Implement [Cost Tracking](./features/cost-optimization.md)
   - Set up [Rate Limiting](./features/rate-limiting.md)

4. **Optimize**
   - Read [Best Practices](./tutorials/best-practices.md)
   - Implement [Caching](./features/caching.md)
   - Configure [Routing](./advanced/routing.md)

5. **Scale**
   - Review [Enterprise Guide](./advanced/enterprise.md)
   - Monitor performance
   - Optimize costs

## 🔄 Migration Resources

Coming from another library? We have migration guides:

- **[From OpenAI SDK](./tutorials/migrating-from-openai.md)**
- **[From LangChain](./tutorials/migrating-from-langchain.md)**
- **[From LlamaIndex](./tutorials/migrating-from-llamaindex.md)**

## 📈 Roadmap

### Coming Soon
- 🔜 Azure OpenAI support
- 🔜 Google Vertex AI integration
- 🔜 AWS Bedrock support
- 🔜 Cohere integration
- 🔜 Local model support alongside API models
- 🔜 Advanced prompt templates
- 🔜 Automatic prompt optimization
- 🔜 Multi-modal support (images, audio)

## 📄 License

LLM-Runner-Router is MIT licensed. See [LICENSE](../../../LICENSE) for details.

## 🙏 Contributors

Special thanks to all contributors who have helped make LLM-Runner-Router better!

---

<div align="center">
  
**[Get Started →](./quickstart.md)**

Built with ❤️ by the LLM-Runner-Router Team

</div>