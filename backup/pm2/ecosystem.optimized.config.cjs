/**
 * PM2 Optimized Configuration for LLM Router
 * Resource-constrained settings for VPS with 4 CPUs and 16GB RAM
 */

module.exports = {
  apps: [{
    // Application Configuration
    name: 'llm-router',
    script: './server-http.js',
    
    // Single Instance Mode (prevent cluster issues)
    instances: 1,  // Single instance to prevent memory multiplication
    exec_mode: 'fork',  // Fork mode instead of cluster
    
    // Memory Management
    max_memory_restart: '3G',  // Restart if exceeds 3GB (leaves room for system)
    node_args: '--max-old-space-size=2560',  // 2.5GB heap limit
    
    // Restart Management
    autorestart: true,
    watch: false,
    min_uptime: '60s',  // Minimum 60s uptime before considering started
    max_restarts: 5,  // Limit restarts to prevent loops
    restart_delay: 4000,  // 4 second delay between restarts
    
    // Exponential Backoff for Crashes
    exp_backoff_restart_delay: 100,  // Start at 100ms
    
    // Environment Variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0',
      // Model Loading Configuration
      MAX_MODEL_SIZE: '2GB',  // Limit individual model size
      ENABLE_GPU: 'false',  // Disable GPU on VPS
      USE_CPU_ONLY: 'true',  // Force CPU mode
      MODEL_CACHE_SIZE: '1GB',  // Limit model cache
      CONCURRENT_MODELS: '1',  // Load only 1 model at a time
      AUTO_UNLOAD: 'true',  // Auto-unload unused models
      UNLOAD_TIMEOUT: '300000',  // Unload after 5 minutes inactive
    },
    
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000,
      HOST: 'localhost',
      DEBUG: 'true'
    },
    
    // Logging Configuration
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    log_type: 'json',
    
    // Advanced Options
    kill_timeout: 10000,  // 10 seconds to graceful shutdown
    listen_timeout: 5000,  // 5 seconds to start listening
    shutdown_with_message: true,
    
    // Health Monitoring
    instance_var: 'INSTANCE_ID',
    
    // Graceful Start/Stop
    wait_ready: true,
    stop_exit_codes: [0],
    
    // Cron-like restart (optional - restart daily at 3 AM)
    // cron_restart: '0 3 * * *',
    
    // Process priority
    // nice: 10,  // Lower priority for background processing
  }],
  
  // PM2 Monitoring Dashboard (optional)
  monitoring: {
    http: true,
    port: 9615,  // PM2 monitoring port
  }
};