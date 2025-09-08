/**
 * Comprehensive tests for production improvements
 * Testing PersistentMap, EnvValidator, BaseEngine, and MigrationManager
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { PersistentMap } from '../src/db/PersistentMap.js';
import { EnvValidator } from '../src/utils/EnvValidator.js';
import { BaseEngine } from '../src/engines/BaseEngine.js';
import { MigrationManager } from '../src/db/MigrationManager.js';

describe('Production Improvements Test Suite', () => {
  
  describe('PersistentMap', () => {
    let tempDir;
    let mapPath;
    let persistentMap;

    beforeEach(async () => {
      // Create temp directory for testing
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'persistentmap-test-'));
      mapPath = path.join(tempDir, 'test-map.json');
      persistentMap = new PersistentMap(mapPath);
    });

    afterEach(async () => {
      // Cleanup
      if (persistentMap.saveQueue) {
        await persistentMap.close();
      }
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should create new persistent map file if not exists', async () => {
      await persistentMap.load();
      
      const fileExists = await fs.access(mapPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      expect(persistentMap.size).toBe(0);
    });

    test('should save and load data correctly', async () => {
      await persistentMap.load();
      
      persistentMap.set('key1', 'value1');
      persistentMap.set('key2', { nested: 'object' });
      
      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Create new instance and load
      const newMap = new PersistentMap(mapPath);
      await newMap.load();
      
      expect(newMap.get('key1')).toBe('value1');
      expect(newMap.get('key2')).toEqual({ nested: 'object' });
      expect(newMap.size).toBe(2);
    });

    test('should handle atomic file operations', async () => {
      await persistentMap.load();
      
      // Perform multiple rapid operations
      for (let i = 0; i < 10; i++) {
        persistentMap.set(`key${i}`, `value${i}`);
      }
      
      // Force save
      await persistentMap.close();
      
      // Verify no temp files left
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
      
      // Verify data integrity
      const newMap = new PersistentMap(mapPath);
      await newMap.load();
      expect(newMap.size).toBe(10);
    });

    test('should recover from corrupted JSON', async () => {
      // Write corrupted JSON
      await fs.writeFile(mapPath, '{ corrupted json }');
      
      // Should reset and continue
      await persistentMap.load();
      expect(persistentMap.size).toBe(0);
      
      // Should be able to add data
      persistentMap.set('test', 'value');
      await persistentMap.close();
      
      // Verify recovery
      const newMap = new PersistentMap(mapPath);
      await newMap.load();
      expect(newMap.get('test')).toBe('value');
    });

    test('should support all Map methods', async () => {
      await persistentMap.load();
      
      persistentMap.set('key1', 'value1');
      persistentMap.set('key2', 'value2');
      
      expect(persistentMap.has('key1')).toBe(true);
      expect(persistentMap.has('key3')).toBe(false);
      
      const deleted = persistentMap.delete('key1');
      expect(deleted).toBe(true);
      expect(persistentMap.has('key1')).toBe(false);
      
      const keys = Array.from(persistentMap.keys());
      expect(keys).toEqual(['key2']);
      
      const values = Array.from(persistentMap.values());
      expect(values).toEqual(['value2']);
      
      const entries = Array.from(persistentMap.entries());
      expect(entries).toEqual([['key2', 'value2']]);
      
      persistentMap.clear();
      expect(persistentMap.size).toBe(0);
    });

    test('should support JSON export/import', async () => {
      await persistentMap.load();
      
      persistentMap.set('key1', 'value1');
      persistentMap.set('key2', { nested: true });
      
      const json = persistentMap.toJSON();
      expect(json).toEqual({
        key1: 'value1',
        key2: { nested: true }
      });
      
      const newMap = new PersistentMap(path.join(tempDir, 'new-map.json'));
      await newMap.load();
      await newMap.fromJSON(json);
      
      expect(newMap.get('key1')).toBe('value1');
      expect(newMap.get('key2')).toEqual({ nested: true });
    });
  });

  describe('EnvValidator', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should validate required environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-very-long-secret-key-that-is-at-least-32-characters';
      process.env.SESSION_SECRET = 'another-very-long-secret-key-that-is-32-chars-long';
      
      const validator = EnvValidator.validate('production');
      expect(validator.errors).toHaveLength(0);
    });

    test('should report missing required variables', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      delete process.env.SESSION_SECRET;
      
      expect(() => {
        EnvValidator.validate('production');
      }).toThrow('Environment validation failed');
    });

    test('should validate secret length', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short';
      process.env.SESSION_SECRET = 'short';
      
      expect(() => {
        EnvValidator.validate('production');
      }).toThrow();
    });

    test('should validate PORT format', () => {
      process.env.PORT = 'invalid';
      
      const validator = EnvValidator.validate('development');
      expect(validator.errors).toContain('PORT must be a valid port number (1-65535)');
      
      process.env.PORT = '3006';
      const validator2 = EnvValidator.validate('development');
      expect(validator2.errors).not.toContain('PORT must be a valid port number (1-65535)');
    });

    test('should validate URL formats', () => {
      process.env.BASE_URL = 'not-a-url';
      process.env.REDIS_URL = 'https://valid-url.com';
      
      const validator = EnvValidator.validate('development');
      expect(validator.errors).toContain('BASE_URL must be a valid URL');
      expect(validator.errors).not.toContain('REDIS_URL must be a valid URL');
    });

    test('should validate NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid-env';
      
      const validator = EnvValidator.validate('development');
      expect(validator.warnings).toContain('NODE_ENV should be one of: development, test, staging, production');
    });

    test('should validate boolean flags', () => {
      process.env.METRICS_ENABLED = 'maybe';
      
      const validator = EnvValidator.validate('development');
      expect(validator.warnings).toContain('METRICS_ENABLED should be a boolean value (true/false)');
      
      process.env.METRICS_ENABLED = 'true';
      const validator2 = EnvValidator.validate('development');
      expect(validator2.warnings).not.toContain('METRICS_ENABLED should be a boolean value (true/false)');
    });

    test('should generate correct .env.example', () => {
      const example = EnvValidator.generateEnvExample();
      
      expect(example).toContain('JWT_SECRET=');
      expect(example).toContain('SESSION_SECRET=');
      expect(example).toContain('NODE_ENV=');
      expect(example).toContain('# PORT=3006');
      expect(example).toContain('# HOST=llmrouter.dev');
      expect(example).toContain('# BASE_URL=https://llmrouter.dev:3006');
    });

    test('should provide correct default values', () => {
      expect(EnvValidator.getDefaultValue('PORT')).toBe('3006');
      expect(EnvValidator.getDefaultValue('HOST')).toBe('llmrouter.dev');
      expect(EnvValidator.getDefaultValue('BASE_URL')).toBe('https://llmrouter.dev:3006');
      expect(EnvValidator.getDefaultValue('LOG_LEVEL')).toBe('info');
      expect(EnvValidator.getDefaultValue('METRICS_ENABLED')).toBe('true');
    });
  });

  describe('BaseEngine', () => {
    class TestEngine extends BaseEngine {
      async isSupported() {
        return true;
      }
      
      async _initialize(options) {
        this.testOptions = options;
        return true;
      }
      
      async _loadModel(model) {
        return { loaded: true, model };
      }
      
      async _execute(model, input, options) {
        return { result: input.toUpperCase() };
      }
      
      async *_stream(model, input, options) {
        for (const char of input) {
          yield char.toUpperCase();
        }
      }
    }

    let engine;

    beforeEach(() => {
      engine = new TestEngine('TestEngine');
    });

    test('should initialize correctly', async () => {
      expect(engine.initialized).toBe(false);
      
      const result = await engine.initialize({ test: true });
      
      expect(result).toBe(true);
      expect(engine.initialized).toBe(true);
      expect(engine.testOptions).toEqual({ test: true });
    });

    test('should prevent double initialization', async () => {
      await engine.initialize();
      await engine.initialize(); // Should not throw
      
      expect(engine.initialized).toBe(true);
    });

    test('should load models', async () => {
      const model = { name: 'test-model', id: 'model-1' };
      const result = await engine.loadModel(model);
      
      expect(result).toEqual({ loaded: true, model });
    });

    test('should execute inference with metrics', async () => {
      const model = { name: 'test-model' };
      const input = 'hello';
      
      const result = await engine.execute(model, input);
      
      expect(result).toEqual({ result: 'HELLO' });
      expect(engine.metrics.totalInferences).toBe(1);
      expect(engine.metrics.totalErrors).toBe(0);
      expect(engine.metrics.avgLatency).toBeGreaterThanOrEqual(0);
    });

    test('should handle streaming', async () => {
      engine.capabilities.streaming = true;
      
      const model = { name: 'test-model' };
      const input = 'hello';
      
      const chunks = [];
      for await (const chunk of engine.stream(model, input)) {
        chunks.push(chunk);
      }
      
      expect(chunks).toEqual(['H', 'E', 'L', 'L', 'O']);
    });

    test('should throw error for unsupported streaming', async () => {
      engine.capabilities.streaming = false;
      
      const model = { name: 'test-model' };
      const input = 'hello';
      
      await expect(async () => {
        for await (const chunk of engine.stream(model, input)) {
          // Should not reach here
        }
      }).rejects.toThrow('TestEngine does not support streaming');
    });

    test('should track error metrics', async () => {
      engine._execute = async () => {
        throw new Error('Test error');
      };
      
      const model = { name: 'test-model' };
      
      await expect(engine.execute(model, 'test')).rejects.toThrow('Test error');
      
      expect(engine.metrics.totalErrors).toBe(1);
      expect(engine.metrics.totalInferences).toBe(1);
    });

    test('should provide correct status', () => {
      expect(engine.getStatus()).toBe('uninitialized');
      
      engine.initialized = true;
      expect(engine.getStatus()).toBe('healthy');
      
      engine.metrics.totalInferences = 10;
      engine.metrics.totalErrors = 2;
      expect(engine.getStatus()).toBe('degraded');
    });

    test('should validate models', () => {
      expect(() => engine.validateModel(null)).toThrow('Model configuration is required');
      expect(() => engine.validateModel({})).toThrow('Model must have a name or id');
      expect(engine.validateModel({ name: 'test' })).toBe(true);
      expect(engine.validateModel({ id: 'test' })).toBe(true);
    });

    test('should cleanup properly', async () => {
      await engine.initialize();
      
      // Add an event listener to test cleanup
      const handler = () => {};
      engine.on('test-event', handler);
      
      const eventCount = engine.listenerCount('test-event');
      expect(eventCount).toBeGreaterThan(0);
      
      await engine.cleanup();
      
      expect(engine.initialized).toBe(false);
      expect(engine.listenerCount('test-event')).toBe(0);
    });

    test('should generate performance report', () => {
      engine.initialized = true; // Mark as initialized
      engine.metrics = {
        totalInferences: 100,
        totalErrors: 5,
        avgLatency: 250,
        lastInference: '2024-01-01T00:00:00Z'
      };
      
      const report = engine.getPerformanceReport();
      
      expect(report).toMatchObject({
        engine: 'TestEngine',
        status: 'healthy',
        successRate: '95.00%',
        metrics: engine.metrics
      });
    });
  });

  describe('MigrationManager', () => {
    let tempDir;
    let migrationManager;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-'));
      migrationManager = new MigrationManager(tempDir);
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should initialize and run all migrations if no version file', async () => {
      await migrationManager.initialize();
      
      // Should be at latest version after initialization
      const migrations = migrationManager.getMigrations();
      const latestVersion = migrations[migrations.length - 1].version;
      expect(migrationManager.currentVersion).toBe(latestVersion);
      
      const versionFile = path.join(tempDir, '.version');
      const version = await fs.readFile(versionFile, 'utf8');
      expect(version).toBe(latestVersion);
    });

    test('should run pending migrations', async () => {
      // Set initial version
      await migrationManager.setVersion('1.0.0');
      
      // Initialize should run migrations
      await migrationManager.initialize();
      
      // Should be at latest version
      const migrations = migrationManager.getMigrations();
      const latestVersion = migrations[migrations.length - 1].version;
      expect(migrationManager.currentVersion).toBe(latestVersion);
    });

    test('should handle migration failures gracefully', async () => {
      // Override a migration to fail
      const originalMigrations = migrationManager.getMigrations;
      migrationManager.getMigrations = function() {
        const migrations = originalMigrations.call(this);
        migrations[1].up = async () => {
          throw new Error('Migration failed');
        };
        return migrations;
      };
      
      await migrationManager.setVersion('1.0.0');
      
      await expect(migrationManager.runMigrations()).rejects.toThrow('Migration failed at version 1.1.0');
      
      // Version should not have changed
      expect(migrationManager.currentVersion).toBe('1.0.0');
    });

    test('should create backups', async () => {
      // Create some test data
      const testFile = path.join(tempDir, 'test.json');
      await fs.writeFile(testFile, JSON.stringify({ test: 'data' }));
      
      const backupDir = await migrationManager.backup();
      
      // Verify backup was created
      const backupFile = path.join(backupDir, 'test.json');
      const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
      expect(backupData).toEqual({ test: 'data' });
    });

    test('should restore from backup', async () => {
      // Create test data
      const testFile = path.join(tempDir, 'test.json');
      await fs.writeFile(testFile, JSON.stringify({ original: 'data' }));
      
      // Backup
      const backupDir = await migrationManager.backup();
      
      // Modify original
      await fs.writeFile(testFile, JSON.stringify({ modified: 'data' }));
      
      // Restore
      await migrationManager.restore(backupDir);
      
      // Verify restoration
      const restoredData = JSON.parse(await fs.readFile(testFile, 'utf8'));
      expect(restoredData).toEqual({ original: 'data' });
    });

    test('should rollback migrations', async () => {
      // Set to latest version
      const migrations = migrationManager.getMigrations();
      const latestVersion = migrations[migrations.length - 1].version;
      await migrationManager.setVersion(latestVersion);
      
      // Rollback to 1.0.0
      await migrationManager.rollback('1.0.0');
      
      expect(migrationManager.currentVersion).toBe('1.0.0');
    });

    test('should provide migration status', async () => {
      await migrationManager.setVersion('1.0.0');
      
      const status = await migrationManager.getStatus();
      
      expect(status.currentVersion).toBe('1.0.0');
      expect(status.isUpToDate).toBe(false);
      expect(status.pendingMigrations).toHaveLength(2);
      expect(status.pendingMigrations[0]).toMatchObject({
        version: '1.1.0',
        description: 'Add metadata to auth data'
      });
    });

    test('should handle auth metadata migration', async () => {
      const usersFile = path.join(tempDir, 'users.json');
      const userData = {
        'user1': {
          username: 'test',
          email: 'test@example.com',
          role: 'user'
        }
      };
      
      await fs.writeFile(usersFile, JSON.stringify(userData));
      
      await migrationManager.addAuthMetadata();
      
      const updatedData = JSON.parse(await fs.readFile(usersFile, 'utf8'));
      expect(updatedData.user1).toHaveProperty('metadata');
      expect(updatedData.user1.metadata).toMatchObject({
        loginCount: 0,
        lastLogin: null
      });
    });

    test('should create and drop indexes', async () => {
      const usersFile = path.join(tempDir, 'users.json');
      const userData = {
        'user1': {
          username: 'john',
          email: 'john@example.com',
          role: 'admin'
        },
        'user2': {
          username: 'jane',
          email: 'jane@example.com',
          role: 'user'
        }
      };
      
      await fs.writeFile(usersFile, JSON.stringify(userData));
      
      await migrationManager.createIndexes();
      
      const indexFile = path.join(tempDir, 'indexes.json');
      const indexes = JSON.parse(await fs.readFile(indexFile, 'utf8'));
      
      expect(indexes.users.byUsername).toEqual({
        john: 'user1',
        jane: 'user2'
      });
      expect(indexes.users.byEmail).toEqual({
        'john@example.com': 'user1',
        'jane@example.com': 'user2'
      });
      expect(indexes.users.byRole).toEqual({
        admin: ['user1'],
        user: ['user2']
      });
      
      await migrationManager.dropIndexes();
      
      const fileExists = await fs.access(indexFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
  });
});