/**
 * 🚀 Model Downloader Service
 * Handles downloading models from HuggingFace with progress tracking
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Logger } from '../utils/Logger.js';

const streamPipeline = promisify(pipeline);
const logger = new Logger('ModelDownloader');

class ModelDownloader {
  constructor() {
    this.downloads = new Map(); // Track active downloads
    this.modelsDir = path.join(process.cwd(), 'models');
  }

  /**
   * Download a model from URL with progress tracking
   */
  async download(modelId, url, options = {}) {
    const downloadId = `${modelId}_${Date.now()}`;
    
    // Create download tracking object
    const download = {
      id: downloadId,
      modelId,
      url,
      progress: 0,
      downloaded: 0,
      total: 0,
      speed: 0,
      status: 'starting',
      startTime: Date.now(),
      abortController: new AbortController()
    };
    
    this.downloads.set(downloadId, download);
    
    try {
      // Ensure models directory exists
      const modelDir = path.join(this.modelsDir, modelId);
      await this.ensureDirectory(modelDir);
      
      // Determine filename from URL
      const filename = url.split('/').pop();
      const filepath = path.join(modelDir, filename);
      
      // Check if file already exists
      if (fs.existsSync(filepath)) {
        download.status = 'completed';
        download.progress = 100;
        download.filepath = filepath;
        logger.info(`Model already exists: ${filepath}`);
        return download;
      }
      
      // Download the file
      logger.info(`Starting download: ${modelId} from ${url}`);
      download.status = 'downloading';
      
      await this.downloadFile(url, filepath, download);
      
      download.status = 'completed';
      download.progress = 100;
      download.filepath = filepath;
      download.endTime = Date.now();
      
      logger.success(`✅ Download completed: ${modelId}`);
      return download;
      
    } catch (error) {
      download.status = 'failed';
      download.error = error.message;
      logger.error(`Download failed: ${error.message}`);
      throw error;
      
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.downloads.delete(downloadId);
      }, 60000); // Keep for 1 minute
    }
  }

  /**
   * Download file with progress tracking
   */
  async downloadFile(url, filepath, download) {
    return new Promise((resolve, reject) => {
      // Handle redirects by following them
      const makeRequest = (requestUrl) => {
        https.get(requestUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            makeRequest(response.headers.location);
            return;
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }
          
          // Get total size
          const totalSize = parseInt(response.headers['content-length'], 10);
          download.total = totalSize;
          
          // Create write stream
          const writeStream = fs.createWriteStream(filepath);
          
          // Track progress
          let downloaded = 0;
          let lastTime = Date.now();
          let lastDownloaded = 0;
          
          response.on('data', (chunk) => {
            downloaded += chunk.length;
            download.downloaded = downloaded;
            download.progress = Math.round((downloaded / totalSize) * 100);
            
            // Calculate speed every second
            const now = Date.now();
            if (now - lastTime > 1000) {
              const bytesPerSecond = (downloaded - lastDownloaded) / ((now - lastTime) / 1000);
              download.speed = bytesPerSecond;
              lastTime = now;
              lastDownloaded = downloaded;
              
              // Log progress
              const mbDownloaded = (downloaded / 1024 / 1024).toFixed(2);
              const mbTotal = (totalSize / 1024 / 1024).toFixed(2);
              const mbSpeed = (bytesPerSecond / 1024 / 1024).toFixed(2);
              logger.info(`Downloading ${download.modelId}: ${download.progress}% (${mbDownloaded}/${mbTotal} MB) @ ${mbSpeed} MB/s`);
            }
          });
          
          // Pipe to file
          pipeline(response, writeStream, (error) => {
            if (error) {
              // Delete partial file on error
              fs.unlinkSync(filepath);
              reject(error);
            } else {
              resolve();
            }
          });
          
          // Handle abort
          download.abortController.signal.addEventListener('abort', () => {
            response.destroy();
            writeStream.destroy();
            fs.unlinkSync(filepath);
            reject(new Error('Download cancelled'));
          });
          
        }).on('error', reject);
      };
      
      makeRequest(url);
    });
  }

  /**
   * Get download progress
   */
  getProgress(downloadId) {
    const download = this.downloads.get(downloadId);
    if (!download) return null;
    
    return {
      modelId: download.modelId,
      progress: download.progress,
      downloaded: download.downloaded,
      total: download.total,
      speed: download.speed,
      status: download.status,
      error: download.error
    };
  }

  /**
   * Cancel a download
   */
  cancel(downloadId) {
    const download = this.downloads.get(downloadId);
    if (download && download.status === 'downloading') {
      download.abortController.abort();
      download.status = 'cancelled';
      return true;
    }
    return false;
  }

  /**
   * Get all active downloads
   */
  getActiveDownloads() {
    const active = [];
    for (const [id, download] of this.downloads) {
      if (download.status === 'downloading') {
        active.push({
          id,
          modelId: download.modelId,
          progress: download.progress,
          speed: download.speed
        });
      }
    }
    return active;
  }

  /**
   * Check if a model is already downloaded
   */
  async isDownloaded(modelId, filename) {
    const filepath = path.join(this.modelsDir, modelId, filename);
    return fs.existsSync(filepath);
  }

  /**
   * Get path to downloaded model
   */
  getModelPath(modelId, filename) {
    return path.join(this.modelsDir, modelId, filename);
  }

  /**
   * List all downloaded models
   */
  async listDownloaded() {
    const models = [];
    
    if (!fs.existsSync(this.modelsDir)) {
      return models;
    }
    
    const dirs = fs.readdirSync(this.modelsDir);
    
    for (const dir of dirs) {
      const modelPath = path.join(this.modelsDir, dir);
      const stat = fs.statSync(modelPath);
      
      if (stat.isDirectory()) {
        const files = fs.readdirSync(modelPath);
        const ggufFiles = files.filter(f => f.endsWith('.gguf'));
        
        for (const file of ggufFiles) {
          const filepath = path.join(modelPath, file);
          const fileStat = fs.statSync(filepath);
          
          models.push({
            id: dir,
            filename: file,
            path: filepath,
            size: fileStat.size,
            modified: fileStat.mtime
          });
        }
      }
    }
    
    return models;
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelId) {
    const modelPath = path.join(this.modelsDir, modelId);
    
    if (fs.existsSync(modelPath)) {
      // Remove directory and all files
      fs.rmSync(modelPath, { recursive: true, force: true });
      logger.info(`Deleted model: ${modelId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Calculate storage used by models
   */
  async getStorageUsed() {
    if (!fs.existsSync(this.modelsDir)) {
      return 0;
    }
    
    let totalSize = 0;
    
    const calculateSize = (dirPath) => {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filepath = path.join(dirPath, file);
        const stat = fs.statSync(filepath);
        
        if (stat.isDirectory()) {
          calculateSize(filepath);
        } else {
          totalSize += stat.size;
        }
      }
    };
    
    calculateSize(this.modelsDir);
    return totalSize;
  }
}

// Export singleton instance
export const modelDownloader = new ModelDownloader();
export default ModelDownloader;
export { ModelDownloader };
