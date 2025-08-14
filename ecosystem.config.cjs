/**
 * PM2 Process Management Configuration
 * For production deployment on VPS/dedicated servers
 */

module.exports = {
  apps: [{
    // Application Configuration
    name: 'llm-router-http',
    script: './server-http.js',
    
    // Cluster Mode Configuration
    instances: process.env.PM2_INSTANCES || 'max',  // Use all available CPUs
    exec_mode: 'cluster',
    
    // Process Management
    autorestart: true,
    watch: false,  // Set to true in development
    max_memory_restart: '2G',
    min_uptime: '30s',
    max_restarts: 10,
    
    // Environment Variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    
    // Logging Configuration
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Advanced Options
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: true,
    
    // Monitoring
    instance_var: 'INSTANCE_ID',
    
    // Graceful Reload
    wait_ready: true,
    
    // Error Handling
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    combine_logs: true,
    
    // Performance
    node_args: '--max-old-space-size=2048'
  }],
  
  // Deployment Configuration
  deploy: {
    production: {
      user: 'mikecerqua',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'https://github.com/MCERQUA/LLM-Runner-Router.git',
      path: '/home/mikecerqua/projects/LLM-Runner-Router',
      'pre-deploy-local': 'echo "Deploying to production server"',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p logs',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'mikecerqua',
      host: 'your-staging-server-ip',
      ref: 'origin/develop',
      repo: 'https://github.com/MCERQUA/LLM-Runner-Router.git',
      path: '/home/mikecerqua/projects/LLM-Runner-Router-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};