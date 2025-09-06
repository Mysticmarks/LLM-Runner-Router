import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('PersistentMap');

export class PersistentMap {
  constructor(filePath) {
    this.filePath = filePath;
    this.map = new Map();
    this.saveQueue = null;
    this.saveDelay = 100; // Debounce saves by 100ms
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const obj = JSON.parse(data);
      this.map = new Map(Object.entries(obj));
      logger.debug(`Loaded ${this.map.size} entries from ${this.filePath}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, create it
        await this.save();
        logger.debug(`Created new persistent map at ${this.filePath}`);
      } else if (err.name === 'SyntaxError') {
        // Corrupted JSON, reset the map
        logger.warn(`Corrupted data in ${this.filePath}, resetting`);
        this.map.clear();
        await this.save();
      } else {
        throw err;
      }
    }
  }

  async save() {
    // Cancel any pending save
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
    }

    // Debounce rapid saves
    return new Promise((resolve, reject) => {
      this.saveQueue = setTimeout(async () => {
        try {
          const dir = path.dirname(this.filePath);
          await fs.mkdir(dir, { recursive: true });
          
          // Write to temp file first for atomicity
          const tempFile = `${this.filePath}.tmp`;
          const obj = Object.fromEntries(this.map);
          await fs.writeFile(tempFile, JSON.stringify(obj, null, 2));
          
          // Atomic rename
          await fs.rename(tempFile, this.filePath);
          
          logger.debug(`Saved ${this.map.size} entries to ${this.filePath}`);
          resolve();
        } catch (err) {
          logger.error(`Failed to save ${this.filePath}: ${err.message}`);
          reject(err);
        }
      }, this.saveDelay);
    });
  }

  get size() {
    return this.map.size;
  }

  get(key) {
    return this.map.get(key);
  }

  set(key, value) {
    this.map.set(key, value);
    this.save().catch(err => {
      logger.error(`Failed to persist set operation: ${err.message}`);
    });
    return this;
  }

  delete(key) {
    const res = this.map.delete(key);
    if (res) {
      this.save().catch(err => {
        logger.error(`Failed to persist delete operation: ${err.message}`);
      });
    }
    return res;
  }

  clear() {
    this.map.clear();
    this.save().catch(err => {
      logger.error(`Failed to persist clear operation: ${err.message}`);
    });
  }

  values() {
    return this.map.values();
  }

  keys() {
    return this.map.keys();
  }

  entries() {
    return this.map.entries();
  }

  has(key) {
    return this.map.has(key);
  }

  forEach(callback, thisArg) {
    return this.map.forEach(callback, thisArg);
  }

  [Symbol.iterator]() {
    return this.map[Symbol.iterator]();
  }

  // Utility method to export as JSON
  toJSON() {
    return Object.fromEntries(this.map);
  }

  // Utility method to import from JSON
  fromJSON(obj) {
    this.map = new Map(Object.entries(obj));
    return this.save();
  }

  // Close and flush any pending saves
  async close() {
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
      await this.save();
    }
  }
}

export default PersistentMap;