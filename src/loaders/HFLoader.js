/**
 * HuggingFace Model Loader
 * Supports loading models directly from HuggingFace Hub
 * Integrates with @huggingface/hub and transformers.js
 */

import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';
import { ModelDownloader } from '../services/ModelDownloader.js';
import path from 'path';
import fs from 'fs/promises';

class HFLoader extends BaseLoader {
  constructor() {
    super();
    this.logger = new Logger('HFLoader');
    this.models = new Map();
    this.hubClient = null;
    this.transformers = null;
    this.downloader = new ModelDownloader();
  }

  /**
   * Initialize HuggingFace dependencies
   */
  async initialize() {
    try {
      // Try to import HuggingFace libraries
      const imports = await Promise.allSettled([
        import('@huggingface/hub'),
        import('@xenova/transformers')
      ]);
      
      if (imports[0].status === 'fulfilled') {
        this.hubClient = imports[0].value;
        this.logger.info('HuggingFace Hub client initialized');
      }
      
      if (imports[1].status === 'fulfilled') {
        this.transformers = imports[1].value;
        this.logger.info('Transformers.js initialized');
      }
      
      return true;
    } catch (error) {
      this.logger.warn('Some HuggingFace dependencies not available', error);
      return false;
    }
  }

  /**
   * Check if this loader supports the given source
   */
  supports(source) {
    if (typeof source !== 'string') return false;
    
    // Check for HuggingFace patterns
    if (source.startsWith('hf:')) return true;
    if (source.startsWith('huggingface:')) return true;
    if (source.includes('huggingface.co')) return true;
    if (source.match(/^[\w-]+\/[\w.-]+$/)) return true; // org/model format
    
    return false;
  }

  /**
   * Load a HuggingFace model
   */
  async load(config) {
    const modelId = config.id || `hf-${Date.now()}`;
    
    try {
      // Initialize if not already done
      if (!this.hubClient && !this.transformers) {
        await this.initialize();
      }

      // Parse model identifier
      const modelName = this.parseModelName(config.source);
      this.logger.info(`Loading HuggingFace model: ${modelName}`);
      
      let model;
      
      // Determine loading strategy based on available libraries and config
      if (config.useTransformers !== false && this.transformers) {
        // Use Transformers.js for in-browser/Node.js inference
        model = await this.loadWithTransformers(modelName, config);
      } else if (this.hubClient) {
        // Use HuggingFace Hub to download model files
        model = await this.loadFromHub(modelName, config);
      } else {
        // Fallback to direct download
        model = await this.loadDirect(modelName, config);
      }
      
      // Store model
      this.models.set(modelId, {
        ...model,
        config,
        modelName
      });

      this.logger.info(`HuggingFace model loaded successfully: ${modelId}`);
      
      return {
        id: modelId,
        name: config.name || modelName,
        format: 'huggingface',
        loaded: true,
        model: model.instance,
        metadata: model.metadata,
        predict: (input) => this.predict(modelId, input),
        stream: (input) => this.stream(modelId, input),
        unload: () => this.unload(modelId),
        tokenize: (text) => this.tokenize(modelId, text),
        generate: (prompt, options) => this.generate(modelId, prompt, options)
      };
    } catch (error) {
      this.logger.error(`Failed to load HuggingFace model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse model name from various formats
   */
  parseModelName(source) {
    // Remove prefixes
    let modelName = source
      .replace('hf:', '')
      .replace('huggingface:', '')
      .replace('https://huggingface.co/', '');
    
    // Extract org/model format
    const match = modelName.match(/([\w-]+\/[\w.-]+)/);
    if (match) {
      return match[1];
    }
    
    return modelName;
  }

  /**
   * Load model using Transformers.js
   */
  async loadWithTransformers(modelName, config) {
    if (!this.transformers) {
      throw new Error('Transformers.js not available');
    }

    const { pipeline, env } = this.transformers;
    
    // Configure environment
    if (config.localFiles) {
      env.localURL = config.localFiles;
    }
    if (config.remoteURL) {
      env.remoteURL = config.remoteURL;
    }
    
    // Determine task type
    const task = config.task || await this.inferTask(modelName);
    
    // Create pipeline
    const pipe = await pipeline(task, modelName, {
      quantized: config.quantized !== false, // Use quantized by default
      progress_callback: (progress) => {
        this.logger.debug(`Loading progress: ${progress.status}`);
      }
    });
    
    // Get model info
    const metadata = {
      task,
      modelId: modelName,
      tokenizer: pipe.tokenizer ? true : false,
      processor: pipe.processor ? true : false
    };
    
    return {
      instance: pipe,
      metadata,
      type: 'transformers'
    };
  }

  /**
   * Load model from HuggingFace Hub
   */
  async loadFromHub(modelName, config) {
    if (!this.hubClient) {
      throw new Error('HuggingFace Hub client not available');
    }

    const { listFiles, downloadFile } = this.hubClient;
    
    try {
      // List model files
      const files = await listFiles({
        repo: modelName,
        repo_type: 'model'
      });
      
      // Identify model files
      const modelFiles = files.filter(f => 
        f.path.endsWith('.bin') || 
        f.path.endsWith('.safetensors') || 
        f.path.endsWith('.onnx') ||
        f.path.endsWith('.json')
      );
      
      // Download model files
      const cacheDir = config.cacheDir || './models/cache';
      const modelDir = path.join(cacheDir, modelName);
      await fs.mkdir(modelDir, { recursive: true });
      
      const downloadedFiles = {};
      for (const file of modelFiles) {
        const localPath = path.join(modelDir, file.path);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        
        // Download file
        const blob = await downloadFile({
          repo: modelName,
          path: file.path
        });
        
        // Save to disk
        const buffer = Buffer.from(await blob.arrayBuffer());
        await fs.writeFile(localPath, buffer);
        downloadedFiles[file.path] = localPath;
      }
      
      // Load config
      const configPath = downloadedFiles['config.json'];
      let modelConfig = {};
      if (configPath) {
        const configText = await fs.readFile(configPath, 'utf8');
        modelConfig = JSON.parse(configText);
      }
      
      return {
        instance: {
          files: downloadedFiles,
          config: modelConfig
        },
        metadata: {
          modelId: modelName,
          files: Object.keys(downloadedFiles),
          ...modelConfig
        },
        type: 'hub'
      };
    } catch (error) {
      this.logger.error(`Failed to load from Hub: ${error.message}`);
      throw error;
    }
  }

  /**
   * Direct download fallback
   */
  async loadDirect(modelName, config) {
    try {
      // Use ModelDownloader service
      const modelPath = await this.downloader.download(
        `https://huggingface.co/${modelName}/resolve/main/model.safetensors`,
        config.cacheDir
      );
      
      return {
        instance: { path: modelPath },
        metadata: { modelId: modelName },
        type: 'direct'
      };
    } catch (error) {
      this.logger.error(`Direct download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Infer task type from model name
   */
  async inferTask(modelName) {
    const nameLower = modelName.toLowerCase();
    
    if (nameLower.includes('bert') && nameLower.includes('uncased')) {
      return 'fill-mask';
    }
    if (nameLower.includes('gpt') || nameLower.includes('llama') || nameLower.includes('mistral')) {
      return 'text-generation';
    }
    if (nameLower.includes('t5') || nameLower.includes('bart')) {
      return 'text2text-generation';
    }
    if (nameLower.includes('vit') || nameLower.includes('resnet')) {
      return 'image-classification';
    }
    if (nameLower.includes('whisper')) {
      return 'automatic-speech-recognition';
    }
    if (nameLower.includes('stable-diffusion')) {
      return 'text-to-image';
    }
    
    // Default to text generation
    return 'text-generation';
  }

  /**
   * Tokenize text
   */
  async tokenize(modelId, text) {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    if (model.type === 'transformers' && model.instance.tokenizer) {
      const tokens = await model.instance.tokenizer(text);
      return tokens;
    }
    
    // Fallback to simple tokenization
    return text.split(' ');
  }

  /**
   * Generate text (for generative models)
   */
  async generate(modelId, prompt, options = {}) {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    if (model.type === 'transformers') {
      const result = await model.instance(prompt, {
        max_new_tokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7,
        do_sample: options.doSample !== false,
        top_p: options.topP || 0.95,
        ...options
      });
      
      return result;
    }
    
    // Fallback
    return { generated_text: prompt + ' [Model output placeholder]' };
  }

  /**
   * Run prediction with the model
   */
  async predict(modelId, input) {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    try {
      if (model.type === 'transformers') {
        // Use transformers pipeline
        const result = await model.instance(input);
        return result;
      } else {
        // For hub or direct downloads, we'd need additional inference logic
        // This would typically involve loading the model with appropriate runtime
        return {
          warning: 'Direct inference not implemented for hub models',
          input,
          modelType: model.type
        };
      }
    } catch (error) {
      this.logger.error(`Prediction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream predictions
   */
  async *stream(modelId, input) {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    try {
      if (model.type === 'transformers') {
        // Check if model supports streaming
        const task = model.metadata.task;
        
        if (task === 'text-generation' || task === 'text2text-generation') {
          // Generate with streaming
          const options = {
            max_new_tokens: 100,
            do_sample: true,
            temperature: 0.7,
            return_full_text: false
          };
          
          // Simulate streaming by generating tokens
          let generated = '';
          const tokens = input.split(' ');
          
          for (let i = 0; i < 20; i++) { // Generate up to 20 tokens
            const partial = await model.instance(input + generated, {
              ...options,
              max_new_tokens: 1
            });
            
            const newToken = this.extractNewToken(partial, generated);
            if (newToken) {
              generated += newToken;
              yield newToken;
            }
            
            // Check for end token
            if (newToken === '</s>' || newToken === '<|endoftext|>') {
              break;
            }
          }
        } else {
          // Non-streaming task
          const result = await this.predict(modelId, input);
          yield result;
        }
      } else {
        // Fallback for non-transformers models
        const result = await this.predict(modelId, input);
        yield result;
      }
    } catch (error) {
      this.logger.error(`Streaming failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract new token from generation
   */
  extractNewToken(result, previousText) {
    if (Array.isArray(result) && result[0]?.generated_text) {
      const fullText = result[0].generated_text;
      return fullText.substring(previousText.length);
    }
    return '';
  }

  /**
   * Unload a model
   */
  async unload(modelId) {
    const model = this.models.get(modelId);
    if (model) {
      // Clean up model resources
      if (model.type === 'transformers' && model.instance.dispose) {
        await model.instance.dispose();
      }
      
      this.models.delete(modelId);
      this.logger.info(`Model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Get model info
   */
  getModelInfo(modelId) {
    const model = this.models.get(modelId);
    if (!model) {
      return null;
    }

    return {
      id: modelId,
      format: 'huggingface',
      loaded: true,
      type: model.type,
      modelName: model.modelName,
      metadata: model.metadata
    };
  }

  /**
   * Validate model availability
   */
  async validate(config) {
    try {
      const modelName = this.parseModelName(config.source);
      
      // Try to check if model exists on HuggingFace
      const response = await fetch(`https://huggingface.co/api/models/${modelName}`);
      
      if (response.ok) {
        const modelInfo = await response.json();
        return {
          valid: true,
          modelInfo: {
            id: modelInfo.modelId,
            downloads: modelInfo.downloads,
            likes: modelInfo.likes,
            tags: modelInfo.tags
          }
        };
      }
      
      return {
        valid: false,
        error: `Model ${modelName} not found on HuggingFace Hub`
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}
export default HFLoader;
export { HFLoader };
