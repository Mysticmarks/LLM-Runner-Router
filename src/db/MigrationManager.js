/**
 * Migration Manager
 * Handles data migrations for persistent storage
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('MigrationManager');

export class MigrationManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.migrationsDir = path.join(dataDir, 'migrations');
    this.versionFile = path.join(dataDir, '.version');
    this.currentVersion = null;
  }

  /**
   * Initialize migration system
   */
  async initialize() {
    try {
      // Ensure directories exist
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.migrationsDir, { recursive: true });
      
      // Load current version
      this.currentVersion = await this.getCurrentVersion();
      logger.info(`Current data version: ${this.currentVersion}`);
      
      // Run any pending migrations
      await this.runMigrations();
    } catch (error) {
      logger.error(`Migration initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current data version
   */
  async getCurrentVersion() {
    try {
      const version = await fs.readFile(this.versionFile, 'utf8');
      return version.trim();
    } catch (error) {
      if (error.code === 'ENOENT') {
        // No version file, assume v1
        return '1.0.0';
      }
      throw error;
    }
  }

  /**
   * Set current data version
   */
  async setVersion(version) {
    await fs.writeFile(this.versionFile, version);
    this.currentVersion = version;
    logger.info(`Data version updated to: ${version}`);
  }

  /**
   * Get available migrations
   */
  getMigrations() {
    return [
      {
        version: '1.0.0',
        description: 'Initial data structure',
        up: async () => {
          // Initial structure, no migration needed
        },
        down: async () => {
          // Cannot rollback initial structure
        }
      },
      {
        version: '1.1.0',
        description: 'Add metadata to auth data',
        up: async () => {
          await this.addAuthMetadata();
        },
        down: async () => {
          await this.removeAuthMetadata();
        }
      },
      {
        version: '1.2.0',
        description: 'Add indexes for performance',
        up: async () => {
          await this.createIndexes();
        },
        down: async () => {
          await this.dropIndexes();
        }
      }
    ];
  }

  /**
   * Run pending migrations
   */
  async runMigrations() {
    const migrations = this.getMigrations();
    const currentVersionIndex = migrations.findIndex(m => m.version === this.currentVersion);
    
    if (currentVersionIndex === -1) {
      logger.warn(`Unknown version: ${this.currentVersion}, starting from beginning`);
    }
    
    // Run all migrations after current version
    for (let i = currentVersionIndex + 1; i < migrations.length; i++) {
      const migration = migrations[i];
      
      try {
        logger.info(`Running migration ${migration.version}: ${migration.description}`);
        await migration.up();
        await this.setVersion(migration.version);
        logger.success(`Migration ${migration.version} completed`);
      } catch (error) {
        logger.error(`Migration ${migration.version} failed: ${error.message}`);
        throw new Error(`Migration failed at version ${migration.version}: ${error.message}`);
      }
    }
    
    if (currentVersionIndex === migrations.length - 1) {
      logger.info('All migrations up to date');
    }
  }

  /**
   * Rollback to specific version
   */
  async rollback(targetVersion) {
    const migrations = this.getMigrations();
    const currentIndex = migrations.findIndex(m => m.version === this.currentVersion);
    const targetIndex = migrations.findIndex(m => m.version === targetVersion);
    
    if (targetIndex === -1) {
      throw new Error(`Unknown target version: ${targetVersion}`);
    }
    
    if (targetIndex >= currentIndex) {
      throw new Error(`Cannot rollback to future version: ${targetVersion}`);
    }
    
    // Run down migrations in reverse order
    for (let i = currentIndex; i > targetIndex; i--) {
      const migration = migrations[i];
      
      try {
        logger.info(`Rolling back migration ${migration.version}`);
        await migration.down();
        await this.setVersion(migrations[i - 1].version);
        logger.success(`Rolled back migration ${migration.version}`);
      } catch (error) {
        logger.error(`Rollback failed for ${migration.version}: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Migration: Add metadata to auth data
   */
  async addAuthMetadata() {
    const usersFile = path.join(this.dataDir, 'users.json');
    
    try {
      const data = await fs.readFile(usersFile, 'utf8');
      const users = JSON.parse(data);
      
      // Add metadata to each user
      for (const [id, user] of Object.entries(users)) {
        if (!user.metadata) {
          users[id] = {
            ...user,
            metadata: {
              createdAt: user.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              loginCount: 0,
              lastLogin: null
            }
          };
        }
      }
      
      await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
      logger.info('Added metadata to user records');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Migration: Remove metadata from auth data
   */
  async removeAuthMetadata() {
    const usersFile = path.join(this.dataDir, 'users.json');
    
    try {
      const data = await fs.readFile(usersFile, 'utf8');
      const users = JSON.parse(data);
      
      // Remove metadata from each user
      for (const [id, user] of Object.entries(users)) {
        delete users[id].metadata;
      }
      
      await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
      logger.info('Removed metadata from user records');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Migration: Create indexes for performance
   */
  async createIndexes() {
    const indexFile = path.join(this.dataDir, 'indexes.json');
    
    const indexes = {
      users: {
        byUsername: {},
        byEmail: {},
        byRole: {}
      },
      tokens: {
        byUserId: {},
        byExpiration: {}
      }
    };
    
    // Build indexes from existing data
    try {
      const usersData = await fs.readFile(path.join(this.dataDir, 'users.json'), 'utf8');
      const users = JSON.parse(usersData);
      
      for (const [id, user] of Object.entries(users)) {
        indexes.users.byUsername[user.username] = id;
        indexes.users.byEmail[user.email] = id;
        
        if (!indexes.users.byRole[user.role]) {
          indexes.users.byRole[user.role] = [];
        }
        indexes.users.byRole[user.role].push(id);
      }
    } catch (error) {
      // No users yet
    }
    
    await fs.writeFile(indexFile, JSON.stringify(indexes, null, 2));
    logger.info('Created performance indexes');
  }

  /**
   * Migration: Drop indexes
   */
  async dropIndexes() {
    const indexFile = path.join(this.dataDir, 'indexes.json');
    
    try {
      await fs.unlink(indexFile);
      logger.info('Dropped performance indexes');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Backup data before migration
   */
  async backup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.dataDir, 'backups', timestamp);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    // Copy all JSON files to backup
    const files = await fs.readdir(this.dataDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const src = path.join(this.dataDir, file);
        const dest = path.join(backupDir, file);
        
        try {
          await fs.copyFile(src, dest);
          logger.debug(`Backed up ${file}`);
        } catch (error) {
          logger.warn(`Could not backup ${file}: ${error.message}`);
        }
      }
    }
    
    logger.info(`Data backed up to ${backupDir}`);
    return backupDir;
  }

  /**
   * Restore from backup
   */
  async restore(backupDir) {
    const files = await fs.readdir(backupDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const src = path.join(backupDir, file);
        const dest = path.join(this.dataDir, file);
        
        await fs.copyFile(src, dest);
        logger.debug(`Restored ${file}`);
      }
    }
    
    logger.info(`Data restored from ${backupDir}`);
  }

  /**
   * Get migration status
   */
  async getStatus() {
    const migrations = this.getMigrations();
    const currentIndex = migrations.findIndex(m => m.version === this.currentVersion);
    const pending = migrations.slice(currentIndex + 1);
    
    return {
      currentVersion: this.currentVersion,
      latestVersion: migrations[migrations.length - 1].version,
      isUpToDate: currentIndex === migrations.length - 1,
      pendingMigrations: pending.map(m => ({
        version: m.version,
        description: m.description
      }))
    };
  }
}

export default MigrationManager;