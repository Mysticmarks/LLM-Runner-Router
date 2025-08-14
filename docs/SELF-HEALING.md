# 🛡️ Self-Healing and Error Recovery System

## Overview

The LLM-Runner-Router now includes a comprehensive self-healing and error recovery system that ensures high availability and automatic recovery from common failures.

## Features

### 🔄 Automatic Error Recovery
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Connection Recovery**: Automatic reconnection for network failures
- **Resource Management**: Memory leak detection and automatic cleanup
- **Process Recovery**: Automatic restart on critical failures

### 🏥 Health Monitoring
- **Continuous Health Checks**: Every 30 seconds
- **Memory Monitoring**: Automatic cache clearing when memory usage exceeds 90%
- **Error Tracking**: Monitors error rates and triggers recovery
- **Performance Metrics**: Tracks latency, throughput, and resource usage

### 🛡️ Self-Healing Capabilities
- **Model Reloading**: Automatic model reload on corruption
- **Cache Management**: Intelligent cache clearing on memory pressure
- **Timeout Adjustment**: Dynamic timeout adjustment based on system load
- **Graceful Degradation**: Falls back to simpler models under stress

### 📊 Monitoring Endpoints
- `/health` - Basic health check
- `/api/diagnostics` - Comprehensive system diagnostics
- `/api/heal` - Manual healing trigger
- `/api/status` - Detailed system status

## Architecture

```
┌─────────────────────────────────────────────┐
│              PM2 Process Manager            │
│         (Cluster Mode - 4 instances)        │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           HTTP Server (Express)             │
│         server-http.js (Enhanced)           │
└─────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────┐           ┌──────────────────┐
│ ErrorHandler │           │ SelfHealingMonitor│
│   Class      │◄──────────│      Class       │
└──────────────┘           └──────────────────┘
        │                           │
        ▼                           ▼
┌─────────────────────────────────────────────┐
│              LLM Router Core                │
│    (Model Loading, Routing, Inference)      │
└─────────────────────────────────────────────┘
```

## Recovery Strategies

### 1. Memory Issues (ENOMEM)
- Clear all caches
- Force garbage collection
- Restart if memory usage remains high

### 2. Connection Issues (ECONNREFUSED)
- Retry with exponential backoff
- Check network connectivity
- Reload models if needed

### 3. Missing Resources (ENOENT)
- Create missing directories
- Download missing models
- Restore from backup

### 4. Timeout Issues
- Increase timeout values
- Reduce concurrent operations
- Switch to lighter models

### 5. Critical Failures
- Graceful shutdown
- PM2 automatic restart
- Cluster failover

## Usage

### Starting the System
```bash
# Start with PM2 (recommended)
pm2 start ecosystem.config.cjs

# Or start directly
npm start
```

### Monitoring
```bash
# Check status
pm2 status

# View logs
pm2 logs llm-router-http

# Real-time monitoring
pm2 monit

# Use recovery script
./scripts/simple-recovery.sh status
./scripts/simple-recovery.sh monitor
```

### Manual Recovery
```bash
# Trigger full recovery
./scripts/simple-recovery.sh recover

# Restart service
./scripts/simple-recovery.sh restart

# Clear cache
./scripts/simple-recovery.sh clean
```

### Health Checks
```bash
# Basic health check
curl http://localhost:3000/health

# Diagnostics (requires API key)
curl -H "x-api-key: YOUR_KEY" http://localhost:3000/api/diagnostics

# Manual healing trigger
curl -X POST -H "x-api-key: YOUR_KEY" http://localhost:3000/api/heal
```

## Configuration

### Environment Variables
```bash
# Error handling
MAX_RETRIES=5              # Maximum retry attempts
RETRY_DELAY=1000           # Initial retry delay (ms)
HEALTH_CHECK_INTERVAL=30000 # Health check interval (ms)
MEMORY_THRESHOLD=0.9       # Memory usage threshold (90%)

# PM2 Configuration
PM2_INSTANCES=4            # Number of cluster instances
MAX_MEMORY_RESTART=2G      # Restart on memory limit
```

### PM2 Ecosystem Config
The `ecosystem.config.cjs` file includes:
- Cluster mode with 4 instances
- Auto-restart on failure
- Memory limit monitoring
- Graceful reload support
- Log rotation

## Recovery Scripts

### simple-recovery.sh
A comprehensive recovery script that:
- Checks system resources
- Monitors PM2 processes
- Tests API health
- Performs automatic recovery
- Clears cache and logs

Commands:
- `status` - Show system status
- `check` - Run health checks
- `recover` - Full recovery
- `restart` - Restart service
- `clean` - Clear cache
- `monitor` - Continuous monitoring

### setup-startup.sh
Configures automatic startup on system boot:
- Saves PM2 process list
- Generates startup script
- Creates systemd service

## Error Handling Flow

1. **Error Detection**
   - Uncaught exceptions captured
   - Unhandled rejections monitored
   - Process warnings tracked

2. **Error Analysis**
   - Error type identification
   - Frequency tracking
   - Severity assessment

3. **Recovery Strategy Selection**
   - Based on error type
   - Previous recovery attempts
   - System resources

4. **Recovery Execution**
   - Apply recovery strategy
   - Monitor results
   - Escalate if needed

5. **Health Verification**
   - Check system health
   - Verify functionality
   - Log recovery results

## Best Practices

1. **Always use PM2** for production deployments
2. **Monitor logs** regularly for early warning signs
3. **Set up alerts** for critical errors
4. **Test recovery** procedures periodically
5. **Keep backups** of models and configuration
6. **Document issues** for pattern recognition

## Troubleshooting

### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Clear cache manually
./scripts/simple-recovery.sh clean

# Restart with lower memory limit
pm2 restart llm-router-http --max-memory-restart 1G
```

### Process Won't Start
```bash
# Check logs
pm2 logs llm-router-http --err

# Delete and restart
pm2 delete llm-router-http
pm2 start ecosystem.config.cjs

# Check port conflicts
lsof -i :3000
```

### Recovery Loop
```bash
# Stop all processes
pm2 stop all

# Clear all data
rm -rf logs/*
pm2 flush

# Start fresh
pm2 start ecosystem.config.cjs
```

## Metrics and Monitoring

The system tracks:
- **Error counts** by type
- **Recovery attempts** and success rate
- **Memory usage** over time
- **Response times** and latency
- **Model performance** metrics
- **System uptime** and availability

Access metrics via:
- `/api/status` - Current metrics
- `/api/diagnostics` - Detailed diagnostics
- PM2 monitoring dashboard
- Log analysis

## Security Considerations

- API endpoints require authentication
- Logs are rotated to prevent disk filling
- Sensitive data is not logged
- Graceful shutdown prevents data corruption
- Cluster mode provides isolation

## Future Enhancements

- [ ] External monitoring integration (Prometheus/Grafana)
- [ ] Predictive failure detection
- [ ] Automated model optimization
- [ ] Distributed recovery coordination
- [ ] Machine learning for recovery strategies

## Support

For issues or questions:
1. Check the logs: `pm2 logs`
2. Run diagnostics: `./scripts/simple-recovery.sh status`
3. Review this documentation
4. Check the main README.md

---

*The self-healing system ensures your LLM Router stays operational with minimal manual intervention.*