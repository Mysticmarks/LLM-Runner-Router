/**
 * 🚀 PM2 Unified Configuration for LLM Router
 * 
 * Supports multiple deployment modes via SERVER_MODE environment:
 * - production (default): Standard production deployment
 * - secure: Enhanced security with strict rate limiting
 * - resilient: Self-healing with aggressive auto-recovery
 * - development: Local development with file watching
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs                    # Production mode
 *   SERVER_MODE=secure pm2 start ecosystem.config.cjs # Secure mode
 *   pm2 start ecosystem.config.cjs --env development  # Dev mode
 */

const SERVER_MODE = process.env.SERVER_MODE || 'production';

// Mode-specific configurations
const modeConfigs = {
  production: {
    instances: 1,
    max_memory_restart: '2G',
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: 3006,
      SERVER_MODE: 'production',
      AUTO_INIT: 'true'
    }
  },
  secure: {
    instances: 1,
    max_memory_restart: '1.5G',
    max_restarts: 5,
    env: {
      NODE_ENV: 'production',
      PORT: 3006,
      SERVER_MODE: 'secure',
      AUTO_INIT: 'true',
      ENABLE_RATE_LIMIT: 'true',
      ENABLE_HELMET: 'true'
    }
  },
  resilient: {
    instances: 1,
    max_memory_restart: '2G',
    max_restarts: 100,
    min_uptime: '5s',
    env: {
      NODE_ENV: 'production',
      PORT: 3006,
      SERVER_MODE: 'resilient',
      AUTO_INIT: 'true',
      AUTO_RECOVERY: 'true'
    }
  },
  development: {
    instances: 1,
    watch: true,
    max_memory_restart: '4G',
    env: {
      NODE_ENV: 'development',
      PORT: 3006,
      SERVER_MODE: 'development',
      AUTO_INIT: 'false'
    }
  }
};

const config = modeConfigs[SERVER_MODE] || modeConfigs.production;

module.exports = {
  apps: [
    {
      // Application Configuration
      name: `llm-router-${SERVER_MODE}`,
      script: 'server.js',
      cwd: '/home/mikecerqua/projects/LLM-Runner-Router',
      
      // Process Management
      instances: config.instances,
      exec_mode: 'fork',
      
      // Auto-restart Configuration
      watch: config.watch || false,
      autorestart: true,
      max_restarts: config.max_restarts || 10,
      min_uptime: config.min_uptime || '10s',
      
      // Resource Management
      max_memory_restart: config.max_memory_restart,
      
      // Environment Variables
      env_file: `.env.${SERVER_MODE}`,
      env: config.env,
      
      // Logging Configuration
      log_file: './logs/llm-router-combined.log',
      out_file: './logs/llm-router-out.log',
      error_file: './logs/llm-router-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Health Monitoring
      health_check_url: 'http://localhost:3000/api/health',
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
        PORT: 3000,
        LOG_LEVEL: 'warn'
      }
    }
  ]
};
