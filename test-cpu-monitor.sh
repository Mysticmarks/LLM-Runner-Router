#!/bin/bash

echo "🔍 Starting CPU monitoring test..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start monitoring CPU in background
monitor_cpu() {
    echo "Time     | CPU Usage | Load Average"
    echo "---------|-----------|-------------"
    for i in {1..20}; do
        timestamp=$(date +"%H:%M:%S")
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
        load_avg=$(uptime | awk '{print $(NF-2), $(NF-1), $NF}')
        echo "$timestamp | ${cpu_usage}%     | $load_avg"
        sleep 1
    done
}

# Start CPU monitoring in background
monitor_cpu &
MONITOR_PID=$!

# Run the model test with CPU limits
echo -e "\n🚀 Starting model inference with 2 threads..."
LLM_MAX_THREADS=2 node test-quick.js > /tmp/model-output.txt 2>&1 &
MODEL_PID=$!

# Wait for model to complete
wait $MODEL_PID

# Kill the monitor
kill $MONITOR_PID 2>/dev/null

echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test complete! Model output:"
tail -20 /tmp/model-output.txt | grep -E "(Inference result|tokens|latency|CPU optimization)"

# Clean up
rm -f /tmp/model-output.txt