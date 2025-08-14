# 🎯 Examples Hub - Quick Navigation

*Bite-sized wisdom, maximum impact*

## Example Categories

### 🚀 Quick Start
- [Basic Examples](./examples/BASIC.md) - Hello world to first app
- [Streaming Examples](./examples/STREAMING.md) - Real-time generation

### 💡 Common Use Cases
- [API Servers](./examples/API.md) - REST/GraphQL/WebSocket

### 🏭 Production
- [Docker Examples](./examples/DOCKER.md) - Containerization
- [Monitoring](./examples/MONITORING.md) - Observability

## Quick Code Snippets

### Minimal Setup (3 lines!)
```javascript
import LLMRouter from 'llm-runner-router';
const router = new LLMRouter();
const response = await router.quick("Hello AI!");
```

### Load Any Model Format
```javascript
await router.load('model.gguf');     // GGUF
await router.load('model.onnx');     // ONNX
await router.load('hf:gpt2');        // HuggingFace
```

### Stream Tokens
```javascript
for await (const token of router.stream(prompt)) {
  process.stdout.write(token);
}
```

### Custom Strategy
```javascript
router.setStrategy('quality-first'); // Or: cost-optimized, speed-priority
```

## Interactive Examples

Try these in your browser console:

```javascript
// Browser-ready example
const router = new LLMRouter({ 
  preferredEngine: 'webgpu' 
});
await router.load('tinyllama.gguf');
console.log(await router.quick("Hi!"));
```

## Learning Path

1. **Start Here**: [Basic Examples](./examples/BASIC.md) (5 min)
2. **Then**: [API Server](./examples/API.md) (10 min)  
3. **Streaming**: [Streaming Examples](./examples/STREAMING.md) (15 min)
4. **Production**: [Docker Deploy](./examples/DOCKER.md) (20 min)

---
*Examples are the bridges between theory and mastery* 🌉
