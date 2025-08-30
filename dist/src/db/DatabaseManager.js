/**
 * Database Abstraction Layer for LLM Router
 * Provides graceful fallback from database to memory storage
 * Supports multiple database backends (PostgreSQL, SQLite, MongoDB)
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('DatabaseManager');

export class DatabaseManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      type: config.type || process.env.DB_TYPE || 'memory', // memory, sqlite, postgresql, mongodb
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'llm_router',
      username: config.username || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASS,
      connectionString: config.connectionString || process.env.DATABASE_URL,
      sqlite: {
        filename: config.sqlite?.filename || process.env.SQLITE_FILE || './data/llm-router.db',
        ...config.sqlite
      },
      mongodb: {
        uri: config.mongodb?.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/llm-router',
        ...config.mongodb
      },
      pool: {
        min: config.pool?.min || 2,
        max: config.pool?.max || 10,
        ...config.pool
      },
      migrations: {
        enabled: config.migrations?.enabled !== false,
        directory: config.migrations?.directory || './migrations',
        ...config.migrations
      },
      fallbackToMemory: config.fallbackToMemory !== false,
      ...config
    };

    this.connection = null;
    this.isConnected = false;
    this.fallbackMode = false;
    this.memoryStore = new Map(); // Fallback storage
    
    this.schemas = {
      users: 'users',
      apiKeys: 'api_keys', 
      refreshTokens: 'refresh_tokens',
      sessions: 'sessions',
      loginAttempts: 'login_attempts',
      auditLog: 'audit_log',
      tenants: 'tenants',
      models: 'models',
      metrics: 'metrics',
      cache: 'cache'
    };
  }

  /**
   * Initialize database connection with graceful fallback
   */
  async initialize() {
    try {
      logger.info(`🗄️  Initializing database connection: ${this.config.type}`);
      
      if (this.config.type === 'memory') {
        logger.info('📝 Using memory storage (development mode)');
        this.fallbackMode = true;
        this.isConnected = true;
        this.emit('ready');
        return;
      }

      // Try to connect to specified database
      await this.connect();
      
      if (this.isConnected) {
        await this.runMigrations();
        logger.info('✅ Database initialized successfully');
        this.emit('ready');
      }
    } catch (error) {
      logger.error('❌ Database initialization failed:', error);
      
      if (this.config.fallbackToMemory) {
        logger.warn('🔄 Falling back to memory storage');
        this.fallbackMode = true;
        this.isConnected = true;
        this.emit('ready');
      } else {
        this.emit('error', error);
        throw error;
      }
    }
  }

  /**
   * Connect to database based on type
   */
  async connect() {
    switch (this.config.type) {
      case 'sqlite':
        await this.connectSQLite();
        break;
      case 'postgresql':
        await this.connectPostgreSQL();
        break;
      case 'mongodb':
        await this.connectMongoDB();
        break;
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }
  }

  /**
   * Connect to SQLite
   */
  async connectSQLite() {
    try {
      const { default: Database } = await import('better-sqlite3');
      
      // Ensure data directory exists
      const dbDir = path.dirname(this.config.sqlite.filename);
      await fs.mkdir(dbDir, { recursive: true });
      
      this.connection = new Database(this.config.sqlite.filename);
      this.connection.pragma('journal_mode = WAL'); // Better performance
      this.isConnected = true;
      
      logger.info(`📦 SQLite connected: ${this.config.sqlite.filename}`);
    } catch (error) {
      logger.error('SQLite connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Connect to PostgreSQL
   */
  async connectPostgreSQL() {
    try {
      const { Pool } = await import('pg');
      
      const connectionConfig = this.config.connectionString 
        ? { connectionString: this.config.connectionString }
        : {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password,
            ...this.config.pool
          };
      
      this.connection = new Pool(connectionConfig);
      
      // Test connection
      const client = await this.connection.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info(`🐘 PostgreSQL connected: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      logger.error('PostgreSQL connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Connect to MongoDB
   */
  async connectMongoDB() {
    try {
      const { MongoClient } = await import('mongodb');
      
      this.connection = new MongoClient(this.config.mongodb.uri);
      await this.connection.connect();
      
      // Test connection
      await this.connection.db().admin().ping();
      
      this.isConnected = true;
      logger.info(`🍃 MongoDB connected: ${this.config.mongodb.uri}`);
    } catch (error) {
      logger.error('MongoDB connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Generic query method with fallback
   */
  async query(table, operation, data = {}, options = {}) {
    if (this.fallbackMode) {
      return this.handleMemoryOperation(table, operation, data, options);
    }

    try {
      switch (this.config.type) {
        case 'sqlite':
          return await this.querySQLite(table, operation, data, options);
        case 'postgresql':
          return await this.queryPostgreSQL(table, operation, data, options);
        case 'mongodb':
          return await this.queryMongoDB(table, operation, data, options);
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }
    } catch (error) {
      logger.error(`Database query failed:`, error);
      
      if (this.config.fallbackToMemory && !this.fallbackMode) {
        logger.warn('🔄 Query failed, falling back to memory');
        this.fallbackMode = true;
        return this.handleMemoryOperation(table, operation, data, options);
      }
      
      throw error;
    }
  }

  /**
   * Memory storage fallback operations
   */
  handleMemoryOperation(table, operation, data, options) {
    const tableKey = `${table}:${JSON.stringify(options.filters || {})}`;
    
    if (!this.memoryStore.has(table)) {
      this.memoryStore.set(table, new Map());
    }
    
    const tableData = this.memoryStore.get(table);

    switch (operation) {
      case 'insert':
        const id = data.id || this.generateId();
        const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        tableData.set(id, record);
        return record;
        
      case 'findOne':
        if (options.filters?.id) {
          return tableData.get(options.filters.id) || null;
        }
        for (const [_id, record] of tableData) {
          if (this.matchesFilters(record, options.filters)) {
            return record;
          }
        }
        return null;
        
      case 'find':
        const results = [];
        for (const [_id, record] of tableData) {
          if (this.matchesFilters(record, options.filters)) {
            results.push(record);
          }
        }
        
        // Apply sorting
        if (options.sort) {
          results.sort((a, b) => {
            for (const [field, direction] of Object.entries(options.sort)) {
              const aVal = a[field];
              const bVal = b[field];
              if (aVal !== bVal) {
                return direction === -1 ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
              }
            }
            return 0;
          });
        }
        
        // Apply pagination
        const { limit, offset } = options;
        const total = results.length;
        const paginatedResults = limit ? results.slice(offset || 0, (offset || 0) + limit) : results;
        
        return { data: paginatedResults, total, count: paginatedResults.length };
        
      case 'update':
        const existing = tableData.get(options.filters?.id);
        if (existing) {
          const updated = { ...existing, ...data, updatedAt: new Date() };
          tableData.set(options.filters.id, updated);
          return updated;
        }
        return null;
        
      case 'delete':
        if (options.filters?.id) {
          const deleted = tableData.get(options.filters.id);
          tableData.delete(options.filters.id);
          return deleted;
        }
        break;
        
      default:
        throw new Error(`Unsupported memory operation: ${operation}`);
    }
  }

  /**
   * Check if record matches filters
   */
  matchesFilters(record, filters) {
    if (!filters) return true;
    
    for (const [key, value] of Object.entries(filters)) {
      if (record[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Run database migrations if enabled
   */
  async runMigrations() {
    if (!this.config.migrations.enabled || this.fallbackMode) {
      return;
    }

    try {
      logger.info('🔄 Running database migrations...');
      
      // Create migrations table
      await this.createMigrationsTable();
      
      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Run pending migrations
      const migrationFiles = await this.getMigrationFiles();
      
      for (const file of migrationFiles) {
        if (!appliedMigrations.includes(file)) {
          await this.runMigration(file);
          await this.recordMigration(file);
          logger.info(`✅ Migration applied: ${file}`);
        }
      }
      
      logger.info('✅ Migrations completed');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    if (this.config.type === 'sqlite') {
      await this.connection.exec(sql.replace('SERIAL', 'INTEGER').replace('CURRENT_TIMESTAMP', "datetime('now')"));
    } else {
      await this.connection.query(sql);
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    try {
      const result = this.config.type === 'sqlite' 
        ? this.connection.prepare('SELECT name FROM migrations').all()
        : await this.connection.query('SELECT name FROM migrations');
      
      return this.config.type === 'sqlite' 
        ? result.map(row => row.name)
        : result.rows.map(row => row.name);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.config.migrations.directory);
      return files.filter(f => f.endsWith('.sql')).sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Run a migration file
   */
  async runMigration(filename) {
    const filePath = path.join(this.config.migrations.directory, filename);
    const sql = await fs.readFile(filePath, 'utf8');
    
    if (this.config.type === 'sqlite') {
      this.connection.exec(sql);
    } else {
      await this.connection.query(sql);
    }
  }

  /**
   * Record migration as applied
   */
  async recordMigration(filename) {
    const sql = 'INSERT INTO migrations (name) VALUES (?)';
    
    if (this.config.type === 'sqlite') {
      this.connection.prepare(sql).run(filename);
    } else {
      await this.connection.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (this.fallbackMode) {
      return {
        status: 'healthy',
        type: 'memory',
        fallback: true,
        records: this.memoryStore.size
      };
    }

    try {
      switch (this.config.type) {
        case 'sqlite':
          this.connection.prepare('SELECT 1').get();
          break;
        case 'postgresql':
          await this.connection.query('SELECT 1');
          break;
        case 'mongodb':
          await this.connection.db().admin().ping();
          break;
      }
      
      return {
        status: 'healthy',
        type: this.config.type,
        fallback: false
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: this.config.type,
        error: error.message,
        fallback: this.fallbackMode
      };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.connection && !this.fallbackMode) {
      try {
        if (this.config.type === 'mongodb') {
          await this.connection.close();
        } else if (this.config.type === 'postgresql') {
          await this.connection.end();
        } else if (this.config.type === 'sqlite') {
          this.connection.close();
        }
        
        this.isConnected = false;
        logger.info('📦 Database connection closed');
      } catch (error) {
        logger.error('Error closing database:', error);
      }
    }
  }
}

// Singleton instance
let dbInstance = null;

export function getDatabase(config) {
  if (!dbInstance) {
    dbInstance = new DatabaseManager(config);
  }
  return dbInstance;
}

export default DatabaseManager;