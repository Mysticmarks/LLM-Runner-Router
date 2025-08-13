# Model Analysis

Analyze available models, cache usage, and performance metrics.

```bash
#!/bin/bash
# Analyze available models and their performance

echo "🔍 Analyzing LLM Router Models..."

# Check model registry
echo "📚 Checking model registry..."
if [ -f "models/registry.json" ]; then
    echo "Available models:"
    cat models/registry.json | jq '.models[] | {name: .name, format: .format, size: .parameters.size}' 2>/dev/null || cat models/registry.json
else
    echo "❌ No model registry found"
fi

# Check cache usage
echo "💾 Cache analysis..."
if [ -d "models/cache" ]; then
    CACHE_SIZE=$(du -sh models/cache 2>/dev/null | cut -f1)
    CACHE_FILES=$(find models/cache -type f 2>/dev/null | wc -l)
    echo "Cache size: $CACHE_SIZE"
    echo "Cached files: $CACHE_FILES"
else
    echo "No cache directory found"
fi

# Analyze model performance logs
echo "📊 Performance analysis..."
if [ -f "logs/performance.log" ]; then
    echo "Recent model performance metrics:"
    tail -20 logs/performance.log | grep -E "(latency|throughput|memory)" || echo "No performance metrics found"
else
    echo "No performance logs available"
fi

# Check model compatibility
echo "🔧 Checking engine compatibility..."
node -e "
const { EngineSelector } = require('./src/engines/EngineSelector.js');
EngineSelector.checkCompatibility().then(results => {
    console.log('Engine compatibility:', results);
}).catch(() => console.log('Engine check not available'));
" 2>/dev/null || echo "Engine compatibility check not available"

echo "✅ Model analysis complete"
```