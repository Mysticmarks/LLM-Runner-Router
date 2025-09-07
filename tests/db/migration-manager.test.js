import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../src/db/MigrationManager.js';

describe('MigrationManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-'));
    manager = new MigrationManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('creates necessary directories', async () => {
      await manager.initialize();
      
      const dataDir = await fs.stat(tempDir);
      expect(dataDir.isDirectory()).toBe(true);
      
      const migrationsDir = await fs.stat(path.join(tempDir, 'migrations'));
      expect(migrationsDir.isDirectory()).toBe(true);
    });

    test('sets initial version and runs migrations', async () => {
      await manager.initialize();
      
      // After initialization, migrations should have run to latest version
      expect(manager.currentVersion).toBe('1.2.0');
      
      const versionFile = await fs.readFile(path.join(tempDir, '.version'), 'utf8');
      expect(versionFile.trim()).toBe('1.2.0');
    });

    test('loads existing version and runs remaining migrations', async () => {
      await fs.writeFile(path.join(tempDir, '.version'), '1.1.0');
      
      await manager.initialize();
      
      // Should have run migration from 1.1.0 to 1.2.0
      expect(manager.currentVersion).toBe('1.2.0');
    });
  });

  describe('Migrations', () => {
    test('runs pending migrations', async () => {
      await manager.initialize();
      
      // Should run migrations from 1.0.0 to latest
      const status = await manager.getStatus();
      
      expect(status.currentVersion).toBe('1.2.0'); // Latest version
      expect(status.isUpToDate).toBe(true);
      expect(status.pendingMigrations.length).toBe(0);
    });

    test('skips already applied migrations', async () => {
      await fs.writeFile(path.join(tempDir, '.version'), '1.1.0');
      await manager.initialize();
      
      const status = await manager.getStatus();
      
      expect(status.currentVersion).toBe('1.2.0');
      expect(status.isUpToDate).toBe(true);
    });

    test('handles migration failures gracefully', async () => {
      // Mock a failing migration
      const originalMigrations = manager.getMigrations;
      manager.getMigrations = () => [
        {
          version: '1.0.0',
          description: 'Initial',
          up: async () => {},
          down: async () => {}
        },
        {
          version: '1.1.0',
          description: 'Failing migration',
          up: async () => {
            throw new Error('Migration failed');
          },
          down: async () => {}
        }
      ];
      
      await expect(manager.initialize()).rejects.toThrow('Migration failed at version 1.1.0');
      
      // Version should not be updated
      expect(manager.currentVersion).toBe('1.0.0');
    });
  });

  describe('Rollback', () => {
    test('rolls back to specific version', async () => {
      await manager.initialize();
      expect(manager.currentVersion).toBe('1.2.0');
      
      await manager.rollback('1.0.0');
      
      expect(manager.currentVersion).toBe('1.0.0');
      
      const versionFile = await fs.readFile(path.join(tempDir, '.version'), 'utf8');
      expect(versionFile.trim()).toBe('1.0.0');
    });

    test('prevents rollback to future version', async () => {
      await fs.writeFile(path.join(tempDir, '.version'), '1.0.0');
      await manager.initialize();
      
      await expect(manager.rollback('1.2.0')).rejects.toThrow('Cannot rollback to future version');
    });

    test('handles unknown target version', async () => {
      await manager.initialize();
      
      await expect(manager.rollback('9.9.9')).rejects.toThrow('Unknown target version');
    });
  });

  describe('Backup and Restore', () => {
    test('creates backup before migration', async () => {
      // Create some test data
      await fs.writeFile(path.join(tempDir, 'users.json'), '{"test": "data"}');
      await fs.writeFile(path.join(tempDir, 'tokens.json'), '{"token": "value"}');
      
      const backupDir = await manager.backup();
      
      expect(backupDir).toContain('backups');
      
      const backedUpUsers = await fs.readFile(path.join(backupDir, 'users.json'), 'utf8');
      expect(JSON.parse(backedUpUsers)).toEqual({ test: 'data' });
      
      const backedUpTokens = await fs.readFile(path.join(backupDir, 'tokens.json'), 'utf8');
      expect(JSON.parse(backedUpTokens)).toEqual({ token: 'value' });
    });

    test('restores from backup', async () => {
      // Create backup directory with data
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(tempDir, 'backups', timestamp);
      await fs.mkdir(backupDir, { recursive: true });
      
      await fs.writeFile(path.join(backupDir, 'users.json'), '{"restored": "data"}');
      
      await manager.restore(backupDir);
      
      const restoredData = await fs.readFile(path.join(tempDir, 'users.json'), 'utf8');
      expect(JSON.parse(restoredData)).toEqual({ restored: 'data' });
    });
  });

  describe('Status', () => {
    test('provides accurate migration status', async () => {
      await fs.writeFile(path.join(tempDir, '.version'), '1.0.0');
      manager.currentVersion = '1.0.0';
      
      const status = await manager.getStatus();
      
      expect(status.currentVersion).toBe('1.0.0');
      expect(status.latestVersion).toBe('1.2.0');
      expect(status.isUpToDate).toBe(false);
      expect(status.pendingMigrations).toHaveLength(2);
      expect(status.pendingMigrations[0].version).toBe('1.1.0');
      expect(status.pendingMigrations[1].version).toBe('1.2.0');
    });

    test('shows up-to-date status', async () => {
      await manager.initialize();
      
      const status = await manager.getStatus();
      
      expect(status.currentVersion).toBe('1.2.0');
      expect(status.latestVersion).toBe('1.2.0');
      expect(status.isUpToDate).toBe(true);
      expect(status.pendingMigrations).toHaveLength(0);
    });
  });

  describe('Specific Migrations', () => {
    test('adds metadata to auth data', async () => {
      // Create test users file
      const usersData = {
        'user1': {
          username: 'test1',
          email: 'test1@example.com'
        },
        'user2': {
          username: 'test2',
          email: 'test2@example.com',
          createdAt: '2024-01-01T00:00:00Z'
        }
      };
      
      await fs.writeFile(
        path.join(tempDir, 'users.json'),
        JSON.stringify(usersData, null, 2)
      );
      
      await manager.addAuthMetadata();
      
      const updatedData = JSON.parse(
        await fs.readFile(path.join(tempDir, 'users.json'), 'utf8')
      );
      
      expect(updatedData.user1.metadata).toBeDefined();
      expect(updatedData.user1.metadata.loginCount).toBe(0);
      expect(updatedData.user1.metadata.lastLogin).toBeNull();
      
      expect(updatedData.user2.metadata).toBeDefined();
      expect(updatedData.user2.metadata.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    test('creates performance indexes', async () => {
      const usersData = {
        'user1': {
          username: 'alice',
          email: 'alice@example.com',
          role: 'admin'
        },
        'user2': {
          username: 'bob',
          email: 'bob@example.com',
          role: 'user'
        },
        'user3': {
          username: 'charlie',
          email: 'charlie@example.com',
          role: 'user'
        }
      };
      
      await fs.writeFile(
        path.join(tempDir, 'users.json'),
        JSON.stringify(usersData, null, 2)
      );
      
      await manager.createIndexes();
      
      const indexes = JSON.parse(
        await fs.readFile(path.join(tempDir, 'indexes.json'), 'utf8')
      );
      
      expect(indexes.users.byUsername.alice).toBe('user1');
      expect(indexes.users.byUsername.bob).toBe('user2');
      expect(indexes.users.byEmail['alice@example.com']).toBe('user1');
      expect(indexes.users.byRole.admin).toContain('user1');
      expect(indexes.users.byRole.user).toContain('user2');
      expect(indexes.users.byRole.user).toContain('user3');
    });
  });
});