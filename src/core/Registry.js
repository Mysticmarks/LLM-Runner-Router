/**
 * 📚 Model Registry - Streamlined Edition
 * Echo AI Systems - Efficient model management
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('Registry');

class ModelRegistry extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      registryPath: './models/registry.json',
      maxModels: 100,
      ...config
    };
    
    this.models = new Map();
    this.loaders = new Map();
    this.indexes = {
      format: new Map(),
      capability: new Map()
    };
    
    this.stats = { registered: 0, loaded: 0 };
  }

  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.config.registryPath), { recursive: true });
      const data = await this.loadRegistry();
      
      for (const modelData of data.models || []) {
        await this.registerFromData(modelData);
      }
      
      logger.info(`✅ Registry loaded: ${this.models.size} models`);
    } catch (error) {
      logger.warn('Starting fresh registry');
    }
  }

  async register(model) {
    if (this.models.size >= this.config.maxModels) {
      await this.evictLRU();
    }
    
    this.models.set(model.id, model);
    this.indexModel(model);
    this.stats.registered++;
    
    await this.saveRegistry();
    this.emit('registered', model);
    return model;
  }

  async get(id) {
    const model = this.models.get(id);
    if (model && !model.loaded) {
      await model.load();
      this.stats.loaded++;
    }
    return model;
  }

  getAvailable() {
    return Array.from(this.models.values()).filter(m => m.loaded);
  }

  getAll() {
    return Array.from(this.models.values());
  }

  getByFormat(format) {
    return this.indexes.format.get(format) || [];
  }

  registerLoader(format, loader) {
    this.loaders.set(format, loader);
  }

  getLoader(format) {
    return this.loaders.get(format);
  }

  search(criteria) {
    let results = Array.from(this.models.values());
    
    if (criteria.name) {
      const pattern = new RegExp(criteria.name, 'i');
      results = results.filter(m => pattern.test(m.name));
    }
    
    if (criteria.format) {
      results = results.filter(m => m.format === criteria.format);
    }
    
    return results;
  }

  indexModel(model) {
    // Index by format
    if (!this.indexes.format.has(model.format)) {
      this.indexes.format.set(model.format, []);
    }
    this.indexes.format.get(model.format).push(model);
    
    // Index by capabilities
    Object.entries(model.capabilities)
      .filter(([_, enabled]) => enabled)
      .forEach(([cap]) => {
        if (!this.indexes.capability.has(cap)) {
          this.indexes.capability.set(cap, []);
        }
        this.indexes.capability.get(cap).push(model);
      });
  }

  async evictLRU() {
    let oldest = null;
    let oldestTime = Date.now();
    
    for (const model of this.models.values()) {
      const lastUsed = model.metrics?.lastUsed?.getTime() || 0;
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        oldest = model;
      }
    }
    
    if (oldest) {
      await oldest.cleanup();
      this.models.delete(oldest.id);
      logger.info(`Evicted: ${oldest.name}`);
    }
  }

  async loadRegistry() {
    try {
      const data = await fs.readFile(this.config.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { models: [] };
    }
  }

  async saveRegistry() {
    const data = {
      version: '1.0.0',
      models: Array.from(this.models.values()).map(m => m.toJSON())
    };
    await fs.writeFile(this.config.registryPath, JSON.stringify(data, null, 2));
  }

  async registerFromData(data) {
    const loader = this.loaders.get(data.format);
    if (!loader) return null;
    
    const model = await loader.fromData(data);
    this.models.set(model.id, model);
    this.indexModel(model);
    return model;
  }

  getModelCount() {
    return this.models.size;
  }

  async cleanup() {
    for (const model of this.models.values()) {
      await model.cleanup();
    }
    this.models.clear();
    this.indexes.format.clear();
    this.indexes.capability.clear();
  }
}



export default ModelRegistry;
export { ModelRegistry };
