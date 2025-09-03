/**
 * 🛡️ Secure PM2 Configuration for LLM Router SaaS
 * Localhost binding with enhanced security
 */

module.exports = {
  apps: [
    {
      name: 'llm-router-saas',
      script: 'server.js',
      cwd: '/home/mikecerqua/projects/LLM-Runner-Router',
      
      // Bind to localhost only (behind Nginx proxy)
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart Configuration
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      
      // Resource Management
      max_memory_restart: '1G',
      
      // Environment Variables (secure)
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',  // Localhost only
        PORT: 3000,
        AUTO_INIT: 'true',
        ROUTING_STRATEGY: 'balanced',
        ADMIN_API_KEY: '85dea3a443471c55a735551898159d7eb2f29fdc5fbdddd1b38eb513e7b887a6',
        LOG_LEVEL: 'warn'
      },
      
      // Logging Configuration
      log_file: './logs/llm-router-combined.log',
      out_file: './logs/llm-router-out.log',
      error_file: './logs/llm-router-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Security Settings
      kill_timeout: 3000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Node.js Options
      node_args: '--max-old-space-size=1024'
    }
  ]
};
