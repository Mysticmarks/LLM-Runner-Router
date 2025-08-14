/**
 * PM2 Ecosystem Configuration for Resilient Server
 * Advanced configuration with self-healing and monitoring
 */

module.exports = {
  apps: [{
    name: 'llm-router-resilient',
    script: './server-resilient.js',
    instances: process.env.PM2_INSTANCES || 2,
    exec_mode: 'cluster',
    
    // Auto-restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '2G',
    
    // Graceful shutdown
    kill_timeout: 30000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      HOST: '0.0.0.0',
      CLUSTER_MODE: 'false', // PM2 handles clustering
      ROUTING_STRATEGY: 'balanced',
      CACHE_ENABLED: 'true',
      CACHE_TTL: '300000',
      MAX_CONCURRENT: '10',
      LOG_LEVEL: 'info'
    },
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0',
      CLUSTER_MODE: 'false',
      ROUTING_STRATEGY: 'balanced',
      CACHE_ENABLED: 'true',
      CACHE_TTL: '600000',
      MAX_CONCURRENT: '20',
      LOG_LEVEL: 'warn',
      API_KEYS: process.env.API_KEYS || '',
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
    },
    
    // Error handling
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
    
    // Monitoring
    instance_var: 'INSTANCE_ID',
    
    // Watch configuration
    watch: false, // Enable in development if needed
    ignore_watch: [
      'node_modules',
      'logs',
      '.git',
      '*.log',
      'models/*.gguf'
    ],
    
    // Advanced features
    post_update: ['npm install'],
    
    // Health check
    health_check: {
      interval: 30,
      timeout: 5,
      max_consecutive_failures: 3,
      http_options: {
        hostname: 'localhost',
        port: 3000,
        path: '/health',
        method: 'GET'
      }
    },
    
    // Monitoring hooks
    events: {
      restart: 'echo "App restarted at $(date)"',
      reload: 'echo "App reloaded at $(date)"',
      stop: 'echo "App stopped at $(date)"',
      exit: 'echo "App exited at $(date)"',
      'restart overlimit': 'echo "Restart limit reached at $(date)" && mail -s "LLM Router Restart Limit" admin@example.com'
    }
  }],
  
  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'mikecerqua',
      host: '178.156.181.117',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/llm-runner-router.git',
      path: '/home/mikecerqua/projects/LLM-Runner-Router',
      'post-deploy': 'npm install && pm2 reload ecosystem.resilient.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production server"'
    }
  }
};