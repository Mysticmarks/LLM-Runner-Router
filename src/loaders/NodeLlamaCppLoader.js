/**
 * Node-llama-cpp GGUF Loader
 * REAL AI inference using llama.cpp - NO PYTHON REQUIRED
 */

import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import fs from 'fs';
import path from 'path';

const logger = new Logger('NodeLlamaCppLoader');

class NodeLlamaCppLoader extends BaseLoader {
  constructor() {
    super();
    this.name = 'NodeLlamaCppLoader';
    this.format = 'gguf';
    this.loadedModels = new Map();
    this.llama = null;
  }

  /**
   * Check if this loader supports the given source
   */
  supports(source) {
    return typeof source === 'string' && 
           (source.endsWith('.gguf') || 
            source.includes('gguf') ||
            source === 'llama-gguf');
  }

  /**
   * Load a GGUF model using node-llama-cpp
   */
  async load(config = {}) {
    const modelPath = config.source || config.path || './models/Meta-Llama-3-8B.Q2_K.gguf';
    const modelId = config.id || 'llama-gguf';
    
    logger.info(`🦙 Loading GGUF model: ${modelPath}`);
    
    try {
      // Check if model file exists
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }
      
      // Initialize llama.cpp
      if (!this.llama) {
        this.llama = await getLlama();
        logger.success('✅ Llama.cpp initialized');
      }
      
      // Load the model
      logger.info('📦 Loading GGUF model...');
      const model = await this.llama.loadModel({
        modelPath: modelPath,
        gpuLayers: 0, // CPU only for VPS
      });
      logger.success('✅ Model loaded');
      
      // Create context
      const context = await model.createContext({
        contextSize: 2048,
        batchSize: 512,
      });
      logger.success('✅ Context created');
      
      // Create chat session
      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: "You are a helpful AI assistant running via llama.cpp."
      });
      logger.success('✅ Chat session ready');
      
      // Create model interface
      const localModel = {
        id: modelId,
        name: path.basename(modelPath),
        format: 'gguf',
        loader: 'NodeLlamaCppLoader',
        path: modelPath,
        loaded: true,
        isLocal: true,
        model: model,
        context: context,
        session: session,
        
        // Text generation with REAL AI
        predict: async (input, options = {}) => {
          logger.info(`🎯 Generating response for: "${input.substring(0, 50)}..."`);
          
          const startTime = Date.now();
          const response = await session.prompt(input, {
            maxTokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
          });
          
          const inferenceTime = Date.now() - startTime;
          logger.success(`✅ Response generated in ${inferenceTime}ms`);
          
          return {
            text: response,
            response: response,
            inference_time_ms: inferenceTime,
            model: 'llama.cpp',
            isLocal: true,
            method: 'node-llama-cpp'
          };
        },
        
        // Chat method
        chat: async (messages, options = {}) => {
          const lastMessage = messages[messages.length - 1];
          const userInput = lastMessage?.content || '';
          return localModel.predict(userInput, options);
        },
        
        // Streaming support
        stream: async function* (input, options = {}) {
          logger.info('🌊 Streaming response...');
          
          // Stream the response token by token
          const responseStream = await session.promptStream(input, {
            maxTokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
          });
          
          for await (const chunk of responseStream) {
            yield chunk;
          }
        },
        
        // Cleanup
        unload: async () => {
          await context.dispose();
          await model.dispose();
          this.loadedModels.delete(modelId);
          logger.info(`🗑️ Unloaded model: ${modelId}`);
        }
      };
      
      this.loadedModels.set(modelId, localModel);
      logger.success(`🎉 GGUF model ready: ${modelId}`);
      
      return localModel;
      
    } catch (error) {
      logger.error(`❌ Failed to load GGUF model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(modelPath) {
    const stats = fs.statSync(modelPath);
    return {
      name: path.basename(modelPath),
      path: modelPath,
      format: 'gguf',
      size: `${(stats.size / 1024 / 1024 / 1024).toFixed(2)}GB`,
      loader: 'node-llama-cpp',
      isLocal: true,
      method: 'llama.cpp'
    };
  }
}

export default NodeLlamaCppLoader;