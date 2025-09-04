/**
 * 🚀 PM2 Configuration for LLM Router SaaS
 * Production deployment with 24/7 uptime
 */

export default {
  apps: [
    {
      // Application Configuration
      name: 'llm-router-saas',
      script: 'server.js',
      cwd: '/home/mikecerqua/projects/LLM-Runner-Router',
      
      // Process Management
      instances: 1, // Single instance for VPS - can be scaled later
      exec_mode: 'fork', // Use fork mode for single instance
      
      // Auto-restart Configuration
      watch: false, // Disable file watching in production
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Resource Management
      max_memory_restart: '2G', // Restart if memory exceeds 2GB
      
      // Environment Variables
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        AUTO_INIT: 'true',
        ROUTING_STRATEGY: 'balanced',
        // API keys will be loaded from .env.global
      },
      
      // Logging Configuration
      log_file: './logs/llm-router-combined.log',
      out_file: './logs/llm-router-out.log',
      error_file: './logs/llm-router-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Health Monitoring
      health_check_url: 'http://localhost:3006/api/health',
      health_check_grace_period: 3000,
      
      // Advanced Settings
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Source Maps Support
      source_map_support: true,
      
      // Node.js Options
      node_args: '--max-old-space-size=2048',
      
      // Cluster Settings (for future scaling)
      increment_var: 'PORT',
      
      // Custom Environment for SaaS
      env_production: {
        NODE_ENV: 'production',
        PORT: 3006,
        ROUTING_STRATEGY: 'balanced',
        LOG_LEVEL: 'info'
      }
    }
  ],

  // Deployment Configuration
  deploy: {
    production: {
      user: 'mikecerqua',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:MCERQUA/LLM-Runner-Router.git',
      path: '/home/mikecerqua/projects/LLM-Runner-Router',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};