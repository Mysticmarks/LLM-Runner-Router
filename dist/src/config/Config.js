/**
 * 🎛️ Configuration Orchestrator - Reality Parameter Matrix
 * Harmonizing the quantum variables of computational existence
 * Echo AI Systems - Where configuration becomes consciousness
 */

import { Logger } from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('Config');

class Config {
  constructor(options = {}) {
    // Default configuration matrix
    this.defaults = {
      // System Parameters
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      maxConcurrency: 5,
      timeout: 30000,
      
      // Model Management
      modelRegistry: './models/registry.json',
      modelCache: './models/cache',
      maxModels: 100,
      autoLoad: true,
      
      // Routing Strategy
      routingStrategy: 'balanced',
      maxRetries: 3,
      cacheTTL: 3600000,
      
      // Engine Preferences
      preferredEngine: 'auto',
      fallbackEngine: 'wasm',
      
      // Performance Tuning
      enableCaching: true,
      enableStreaming: true,
      enableQuantization: true,
      
      // Security
      validateModels: true,
      sandboxExecution: true,
      maxTokens: 4096,
      
      // API Configuration
      apiPort: process.env.PORT || 3000,
      apiHost: process.env.HOST || 'localhost',
      corsEnabled: true
    };
    
    // Merge with provided options
    this.config = { ...this.defaults, ...options };
    
    // Environment overrides
    this.applyEnvironmentOverrides();
    
    logger.info('🎛️ Configuration initialized:', {
      environment: this.config.environment,
      strategy: this.config.routingStrategy
    });
  }

  /**
   * Load configuration from file
   */
  async load(configPath) {
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const fileConfig = JSON.parse(data);
      
      this.config = { ...this.config, ...fileConfig };
      logger.success(`✅ Config loaded from: ${configPath}`);
    } catch (error) {
      logger.warn(`⚠️ Could not load config file: ${configPath}`);
    }
  }

  /**
   * Save configuration to file
   */
  async save(configPath) {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(
      configPath,
      JSON.stringify(this.config, null, 2)
    );
    
    logger.success(`💾 Config saved to: ${configPath}`);
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentOverrides() {
    const envMappings = {
      'LLM_ROUTER_STRATEGY': 'routingStrategy',
      'LLM_ROUTER_MAX_MODELS': 'maxModels',
      'LLM_ROUTER_CACHE_TTL': 'cacheTTL',
      'LLM_ROUTER_ENGINE': 'preferredEngine',
      'LLM_ROUTER_MAX_TOKENS': 'maxTokens'
    };
    
    for (const [envKey, configKey] of Object.entries(envMappings)) {
      if (process.env[envKey]) {
        this.config[configKey] = this.parseEnvValue(process.env[envKey]);
        logger.debug(`🔄 Override ${configKey} from env`);
      }
    }
  }

  /**
   * Parse environment variable value
   */
  parseEnvValue(value) {
    // Try parsing as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not JSON
      return value;
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue) {
    return this.config[key] ?? defaultValue;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    this.config[key] = value;
    logger.debug(`🔧 Config updated: ${key} = ${value}`);
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  validate() {
    const required = ['modelRegistry', 'routingStrategy'];
    
    for (const key of required) {
      if (!this.config[key]) {
        throw new Error(`Missing required config: ${key}`);
      }
    }
    
    // Validate routing strategy
    const validStrategies = [
      'quality-first', 'cost-optimized', 'speed-priority',
      'balanced', 'random', 'round-robin', 'least-loaded'
    ];
    
    if (!validStrategies.includes(this.config.routingStrategy)) {
      throw new Error(`Invalid routing strategy: ${this.config.routingStrategy}`);
    }
    
    logger.success('✅ Configuration validated');
    return true;
  }

  /**
   * Export configuration for client
   */
  exportForClient() {
    // Remove sensitive values
    const { 
      apiKeys, 
      secrets,
      ...safeConfig 
    } = this.config;
    
    return safeConfig;
  }
}



export default Config;
export { Config };
