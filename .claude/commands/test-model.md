# Test Model Loading

Quick test command for model functionality and API endpoints.

```bash
#!/bin/bash
# Quick test command for model functionality

echo "🧠 Testing LLM Router Model Loading..."

# Start the application in background
npm start &
APP_PID=$!

# Give it time to initialize
sleep 3

# Test model loading endpoint (assuming REST API)
echo "📦 Testing model load endpoint..."
curl -X POST http://localhost:3000/api/models/load \
  -H "Content-Type: application/json" \
  -d '{"source": "huggingface:microsoft/DialoGPT-small", "format": "auto-detect"}' \
  2>/dev/null || echo "❌ API not available or model load failed"

# Test quick inference
echo "🚀 Testing quick inference..."
curl -X POST http://localhost:3000/api/quick \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, how are you?"}' \
  2>/dev/null || echo "❌ Quick inference not available"

# Cleanup
kill $APP_PID 2>/dev/null
echo "✅ Model test completed"
```