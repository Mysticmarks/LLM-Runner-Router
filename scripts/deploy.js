#!/usr/bin/env node

/**
 * Production Deployment Script
 * Handles deployment to various environments with safety checks
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class DeploymentManager {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || 'staging',
      dryRun: options.dryRun || false,
      skipTests: options.skipTests || false,
      skipBackup: options.skipBackup || false,
      verbose: options.verbose || false,
      timeout: options.timeout || 300000, // 5 minutes
      ...options
    };

    this.deploymentInfo = {
      startTime: new Date().toISOString(),
      environment: this.options.environment,
      version: null,
      previousVersion: null,
      rollbackPoint: null
    };
  }

  /**
   * Main deployment process
   */
  async deploy() {
    try {
      console.log(`🚀 Starting deployment to ${this.options.environment}...`);
      
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
      }
      
      await this.preDeploymentChecks();
      await this.createBackup();
      await this.runTests();
      await this.deployApplication();
      await this.postDeploymentVerification();
      await this.updateLoadBalancer();
      
      console.log('✅ Deployment completed successfully!');
      await this.sendDeploymentNotification('success');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      await this.handleDeploymentFailure(error);
      process.exit(1);
    }
  }

  /**
   * Pre-deployment safety checks
   */
  async preDeploymentChecks() {
    console.log('🔍 Running pre-deployment checks...');
    
    // Check git status
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (gitStatus.trim() && !this.options.allowDirty) {
        throw new Error('Git working directory is not clean. Commit changes or use --allow-dirty');
      }
    } catch (error) {
      if (!this.options.allowDirty) {
        throw new Error('Git status check failed');
      }
    }
    
    // Read current version
    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
    this.deploymentInfo.version = packageJson.version;
    
    // Check environment-specific configuration
    const envFile = `.env.${this.options.environment}`;
    const envPath = path.join(rootDir, envFile);
    
    try {
      await fs.access(envPath);
    } catch (error) {
      console.warn(`⚠️ Environment file ${envFile} not found, using defaults`);
    }
    
    // Validate deployment target
    await this.validateDeploymentTarget();
    
    console.log('✅ Pre-deployment checks passed');
  }

  /**
   * Validate deployment target environment
   */
  async validateDeploymentTarget() {
    const validEnvironments = ['development', 'staging', 'production'];
    
    if (!validEnvironments.includes(this.options.environment)) {
      throw new Error(`Invalid environment: ${this.options.environment}`);
    }
    
    // Environment-specific validations
    switch (this.options.environment) {
      case 'production':
        if (!process.env.PRODUCTION_DEPLOY_KEY && !this.options.force) {
          throw new Error('PRODUCTION_DEPLOY_KEY required for production deployment');
        }
        break;
        
      case 'staging':
        // Staging specific checks
        break;
        
      default:
        // Development environment checks
        break;
    }
  }

  /**
   * Create backup of current deployment
   */
  async createBackup() {
    if (this.options.skipBackup || this.options.dryRun) {
      console.log('⏭️ Skipping backup creation');
      return;
    }
    
    console.log('💾 Creating deployment backup...');
    
    const backupDir = path.join(rootDir, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${this.options.environment}-${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    
    try {
      // Create backup of current deployment
      execSync(`tar -czf "${backupPath}.tar.gz" --exclude=node_modules --exclude=.git --exclude=backups .`, {
        cwd: rootDir,
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.deploymentInfo.rollbackPoint = `${backupPath}.tar.gz`;
      console.log(`✅ Backup created: ${backupName}.tar.gz`);
      
    } catch (error) {
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  /**
   * Run comprehensive test suite
   */
  async runTests() {
    if (this.options.skipTests || this.options.dryRun) {
      console.log('⏭️ Skipping test execution');
      return;
    }
    
    console.log('🧪 Running comprehensive test suite...');
    
    try {
      // Run unit tests
      console.log('Running unit tests...');
      execSync('npm run test:unit', { 
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        timeout: this.options.timeout
      });
      
      // Run integration tests
      console.log('Running integration tests...');
      execSync('npm run test:integration', { 
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        timeout: this.options.timeout
      });
      
      // Run enterprise tests if enabled
      console.log('Running enterprise tests...');
      execSync('npm run test:enterprise', { 
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        timeout: this.options.timeout
      });
      
      console.log('✅ All tests passed');
      
    } catch (error) {
      throw new Error(`Tests failed: ${error.message}`);
    }
  }

  /**
   * Deploy the application
   */
  async deployApplication() {
    console.log(`🚀 Deploying to ${this.options.environment}...`);
    
    if (this.options.dryRun) {
      console.log('🔍 DRY RUN: Would deploy application now');
      return;
    }
    
    // Build the application
    console.log('Building application...');
    execSync('npm run build', { 
      stdio: this.options.verbose ? 'inherit' : 'pipe',
      cwd: rootDir
    });
    
    // Install production dependencies
    console.log('Installing production dependencies...');
    execSync('npm ci --production', { 
      stdio: this.options.verbose ? 'inherit' : 'pipe',
      cwd: rootDir
    });
    
    // Run database migrations
    await this.runMigrations();
    
    // Restart services
    await this.restartServices();
    
    console.log('✅ Application deployed');
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    console.log('🗄️ Running database migrations...');
    
    if (this.options.dryRun) {
      console.log('🔍 DRY RUN: Would run migrations now');
      return;
    }
    
    try {
      // Import and run migrations programmatically
      const { DatabaseManager } = await import('../src/db/DatabaseManager.js');
      
      const dbConfig = this.getEnvironmentDbConfig();
      const database = new DatabaseManager(dbConfig);
      
      await database.initialize();
      await database.runMigrations();
      await database.close();
      
      console.log('✅ Migrations completed');
      
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Get database configuration for environment
   */
  getEnvironmentDbConfig() {
    const envVars = process.env;
    
    return {
      type: envVars.DB_TYPE || 'memory',
      host: envVars.DB_HOST || 'localhost',
      port: parseInt(envVars.DB_PORT) || 5432,
      database: envVars.DB_NAME || 'llm_router',
      username: envVars.DB_USER || 'postgres',
      password: envVars.DB_PASS,
      connectionString: envVars.DATABASE_URL,
      fallbackToMemory: this.options.environment !== 'production'
    };
  }

  /**
   * Restart application services
   */
  async restartServices() {
    console.log('🔄 Restarting services...');
    
    if (this.options.dryRun) {
      console.log('🔍 DRY RUN: Would restart services now');
      return;
    }
    
    try {
      // Try PM2 first
      try {
        execSync('pm2 reload llm-router', { stdio: 'pipe' });
        console.log('✅ PM2 services reloaded');
        return;
      } catch (pm2Error) {
        // PM2 not available, try other methods
      }
      
      // Try systemctl
      try {
        execSync('sudo systemctl restart llm-router', { stdio: 'pipe' });
        console.log('✅ Systemd service restarted');
        return;
      } catch (systemdError) {
        // Systemd not available
      }
      
      console.log('⚠️ No service manager found, manual restart required');
      
    } catch (error) {
      throw new Error(`Service restart failed: ${error.message}`);
    }
  }

  /**
   * Post-deployment verification
   */
  async postDeploymentVerification() {
    console.log('✅ Running post-deployment verification...');
    
    if (this.options.dryRun) {
      console.log('🔍 DRY RUN: Would verify deployment now');
      return;
    }
    
    // Wait for services to start
    await this.waitForServices();
    
    // Health check
    await this.verifyHealth();
    
    // Basic functionality test
    await this.verifyFunctionality();
    
    console.log('✅ Post-deployment verification passed');
  }

  /**
   * Wait for services to be ready
   */
  async waitForServices() {
    const maxWait = 60000; // 1 minute
    const interval = 2000; // 2 seconds
    let waited = 0;
    
    console.log('⏳ Waiting for services to start...');
    
    while (waited < maxWait) {
      try {
        // Simple health check
        const { LLMRouter } = await import('../src/index.js');
        const router = new LLMRouter();
        await router.initialize();
        const health = await router.healthCheck();
        await router.cleanup();
        
        if (health.status === 'healthy') {
          console.log('✅ Services are ready');
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }
    
    throw new Error('Services did not start within timeout period');
  }

  /**
   * Verify application health
   */
  async verifyHealth() {
    console.log('🏥 Verifying application health...');
    
    try {
      const { LLMRouter } = await import('../src/index.js');
      const router = new LLMRouter();
      await router.initialize();
      
      const health = await router.healthCheck();
      
      if (health.status !== 'healthy') {
        throw new Error(`Health check failed: ${health.error || 'Unknown error'}`);
      }
      
      await router.cleanup();
      console.log('✅ Health verification passed');
      
    } catch (error) {
      throw new Error(`Health verification failed: ${error.message}`);
    }
  }

  /**
   * Verify basic functionality
   */
  async verifyFunctionality() {
    console.log('🧪 Verifying basic functionality...');
    
    try {
      const { LLMRouter } = await import('../src/index.js');
      const router = new LLMRouter();
      await router.initialize();
      
      // Test basic inference
      const result = await router.quick('Hello, this is a deployment test', {
        maxTokens: 10
      });
      
      if (!result || !result.text) {
        throw new Error('Basic inference test failed');
      }
      
      await router.cleanup();
      console.log('✅ Functionality verification passed');
      
    } catch (error) {
      throw new Error(`Functionality verification failed: ${error.message}`);
    }
  }

  /**
   * Update load balancer configuration
   */
  async updateLoadBalancer() {
    console.log('⚖️ Updating load balancer...');
    
    if (this.options.dryRun) {
      console.log('🔍 DRY RUN: Would update load balancer now');
      return;
    }
    
    // This would be environment-specific
    // For now, just log that this step would happen
    console.log('ℹ️ Load balancer update depends on your infrastructure setup');
  }

  /**
   * Handle deployment failure
   */
  async handleDeploymentFailure(error) {
    console.error('🚨 Deployment failed, initiating recovery...');
    
    if (this.deploymentInfo.rollbackPoint && !this.options.dryRun) {
      console.log('🔄 Rolling back to previous version...');
      
      try {
        // Extract backup
        execSync(`cd "${rootDir}" && tar -xzf "${this.deploymentInfo.rollbackPoint}"`, {
          stdio: this.options.verbose ? 'inherit' : 'pipe'
        });
        
        // Restart services
        await this.restartServices();
        
        console.log('✅ Rollback completed');
        
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
    }
    
    await this.sendDeploymentNotification('failure', error);
  }

  /**
   * Send deployment notification
   */
  async sendDeploymentNotification(status, error = null) {
    const notification = {
      status,
      environment: this.options.environment,
      version: this.deploymentInfo.version,
      startTime: this.deploymentInfo.startTime,
      endTime: new Date().toISOString(),
      error: error?.message
    };
    
    console.log('📢 Deployment notification:', JSON.stringify(notification, null, 2));
    
    // In a real deployment, this would send to Slack, email, webhook, etc.
  }
}

// CLI interface
const args = process.argv.slice(2);
const options = {};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--environment':
    case '--env':
    case '-e':
      options.environment = args[++i];
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--skip-tests':
      options.skipTests = true;
      break;
    case '--skip-backup':
      options.skipBackup = true;
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--force':
      options.force = true;
      options.allowDirty = true;
      break;
    case '--help':
    case '-h':
      console.log(`
LLM Router Deployment Manager

Usage: node scripts/deploy.js [options]

Options:
  --environment, --env, -e <env>  Target environment (staging, production)
  --dry-run                       Show what would be done without making changes
  --skip-tests                    Skip test execution (not recommended)
  --skip-backup                   Skip backup creation (not recommended)
  --verbose, -v                   Enable verbose output
  --force                         Force deployment even with uncommitted changes
  --help, -h                      Show this help message

Examples:
  node scripts/deploy.js --env staging
  node scripts/deploy.js --env production --verbose
  node scripts/deploy.js --dry-run --env staging
`);
      process.exit(0);
  }
}

// Validate environment argument
if (!options.environment && args.length > 0) {
  options.environment = args[0];
}

if (!options.environment) {
  console.error('❌ Environment is required. Use --env <environment> or --help for usage');
  process.exit(1);
}

// Run deployment
const deploymentManager = new DeploymentManager(options);
deploymentManager.deploy().catch(console.error);