/**
 * Simple Inference Server using child process
 * Provides real LLM inference using a lightweight Python script
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('SimpleInferenceServer');

class SimpleInferenceServer {
  constructor() {
    this.process = null;
    this.ready = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  async start() {
    if (this.process) {
      return; // Already started
    }

    logger.info('🚀 Starting Simple Inference Server...');
    
    // Use a simple Python script with basic generation
    const scriptPath = path.join(__dirname, '..', '..', 'simple_inference.py');
    
    this.process = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            const requestId = response.requestId;
            if (requestId && this.pendingRequests.has(requestId)) {
              const { resolve } = this.pendingRequests.get(requestId);
              this.pendingRequests.delete(requestId);
              resolve(response);
            }
          } catch (e) {
            logger.debug('Server output:', line);
          }
        }
      }
    });

    this.process.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Ready for inference')) {
        this.ready = true;
        logger.success('✅ Inference server ready');
      } else {
        logger.error('Server error:', msg);
      }
    });

    this.process.on('exit', (code) => {
      logger.info(`Inference server exited with code ${code}`);
      this.ready = false;
      this.process = null;
      // Reject all pending requests
      for (const { reject } of this.pendingRequests.values()) {
        reject(new Error('Inference server exited'));
      }
      this.pendingRequests.clear();
    });

    // Wait for ready signal
    let attempts = 0;
    while (!this.ready && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.ready) {
      throw new Error('Inference server failed to start');
    }
  }

  async generate(prompt, options = {}) {
    if (!this.ready) {
      await this.start();
    }

    const requestId = ++this.requestId;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      const request = {
        requestId,
        prompt,
        maxTokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7
      };
      
      this.process.stdin.write(JSON.stringify(request) + '\n');
      
      // Timeout after 120 seconds (increased for VPS performance)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout after 120 seconds'));
        }
      }, 120000);
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}

export default SimpleInferenceServer;
