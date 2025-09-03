/**
 * 🚀 PM2 Production Configuration for LLM-Runner-Router
 * Optimized for VPS production deployment
 */

module.exports = {
  apps: [{
    name: 'llm-router',
    script: 'server.js',
    cwd: '/home/mikecerqua/projects/LLM-Runner-Router',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      API_PORT: 3000,
      DEFAULT_STRATEGY: 'balanced',
      MAX_MODELS: 10,
      MODEL_CACHE_DIR: './models/cache',
      AUTO_INIT: 'true'
    },
    
    // Process Management
    instances: 1, // Single instance for VPS
    exec_mode: 'fork',
    
    // Performance & Memory
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048',
    
    // Restart Strategy
    autorestart: true,
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Logging
    log_type: 'json',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    merge_logs: true,
    
    // Monitoring
    monitor: true,
    
    // Advanced Settings
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Health Monitoring
    health_check_http: {
      path: '/api/health',
      port: 3000,
      interval: 30000,
      timeout: 5000
    },
    
    // Source Map Support
    source_map_support: true,
    
    // Watch (disabled in production)
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'temp', 'models']
  }]
};