# Performance Benchmarks

Run comprehensive performance benchmarks for the LLM Router system.

```bash
#!/bin/bash
# Run comprehensive performance benchmarks

echo "⚡ Running LLM Router Performance Benchmarks..."

# Ensure dependencies are installed
npm install --silent

# Run the benchmark suite
echo "📊 Starting benchmark suite..."
npm run benchmark

# Run memory profiling if available
if command -v clinic &> /dev/null; then
    echo "🧠 Running memory profile..."
    clinic doctor -- node src/index.js &
    CLINIC_PID=$!
    sleep 10
    kill $CLINIC_PID
    echo "Memory profile saved to .clinic/"
fi

# Run load testing if available
if command -v loadtest &> /dev/null; then
    echo "🚀 Running load test..."
    npm start &
    APP_PID=$!
    sleep 3
    
    loadtest -c 10 -t 30 http://localhost:3000/api/health 2>/dev/null || echo "Load test not available"
    
    kill $APP_PID 2>/dev/null
fi

echo "✅ Benchmark suite completed"
```