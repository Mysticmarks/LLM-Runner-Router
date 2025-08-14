/**
 * BitNet Model Loader for 1-bit LLMs
 * Supports Microsoft BitNet models with GGUF format
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import BaseLoader from './BaseLoader.js';
import ModelError from '../utils/ModelError.js';
import Logger from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('BitNetLoader');

/**
 * Loader for BitNet 1-bit quantized models
 * Requires BitNet.cpp to be installed and built
 */
class BitNetLoader extends BaseLoader {
    constructor(config = {}) {
        super(config);
        this.bitnetPath = config.bitnetPath || path.join(__dirname, '../../temp/bitnet-repo');
        this.buildDir = path.join(this.bitnetPath, 'build');
        this.modelDir = path.join(this.bitnetPath, 'models');
        this.supportedFormats = ['.gguf'];
        this.supportedQuantTypes = ['i2_s', 'tl1', 'tl2'];
        this.process = null;
        this.isReady = false;
    }

    /**
     * Check if BitNet.cpp is installed and built
     */
    async checkBitNetInstallation() {
        try {
            // Check if build directory exists
            await fs.access(this.buildDir);
            
            // Check for llama-cli executable
            const cliPath = this.getCliPath();
            await fs.access(cliPath);
            
            return true;
        } catch (error) {
            logger.warn('BitNet.cpp not found or not built');
            return false;
        }
    }

    /**
     * Get the path to llama-cli executable
     */
    getCliPath() {
        const platform = process.platform;
        if (platform === 'win32') {
            const releasePath = path.join(this.buildDir, 'bin', 'Release', 'llama-cli.exe');
            const debugPath = path.join(this.buildDir, 'bin', 'llama-cli.exe');
            
            try {
                fs.accessSync(releasePath);
                return releasePath;
            } catch {
                return debugPath;
            }
        } else {
            return path.join(this.buildDir, 'bin', 'llama-cli');
        }
    }

    /**
     * Build BitNet.cpp if not already built
     */
    async buildBitNet() {
        logger.info('Building BitNet.cpp...');
        
        return new Promise((resolve, reject) => {
            const setupScript = path.join(this.bitnetPath, 'setup_env.py');
            const buildProcess = spawn('python3', [
                setupScript,
                '--build'
            ], {
                cwd: this.bitnetPath,
                stdio: 'inherit'
            });

            buildProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info('BitNet.cpp built successfully');
                    resolve();
                } else {
                    reject(new Error(`BitNet build failed with code ${code}`));
                }
            });

            buildProcess.on('error', (err) => {
                reject(new Error(`Failed to start BitNet build: ${err.message}`));
            });
        });
    }

    /**
     * Download a BitNet model from HuggingFace
     */
    async downloadModel(modelId, quantType = 'i2_s') {
        logger.info(`Downloading BitNet model: ${modelId}`);
        
        const modelName = modelId.split('/').pop();
        const modelPath = path.join(this.modelDir, modelName);
        
        return new Promise((resolve, reject) => {
            const setupScript = path.join(this.bitnetPath, 'setup_env.py');
            const downloadProcess = spawn('python3', [
                setupScript,
                '--hf-repo', modelId,
                '--quant-type', quantType
            ], {
                cwd: this.bitnetPath,
                stdio: 'inherit'
            });

            downloadProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info(`Model ${modelId} downloaded successfully`);
                    resolve(path.join(modelPath, `ggml-model-${quantType}.gguf`));
                } else {
                    reject(new Error(`Model download failed with code ${code}`));
                }
            });

            downloadProcess.on('error', (err) => {
                reject(new Error(`Failed to download model: ${err.message}`));
            });
        });
    }

    /**
     * Convert a safetensors model to GGUF format
     */
    async convertModel(modelPath, outputPath, quantType = 'i2_s') {
        logger.info(`Converting model to GGUF format: ${modelPath}`);
        
        return new Promise((resolve, reject) => {
            const convertScript = path.join(this.bitnetPath, 'utils', 'convert-hf-to-gguf-bitnet.py');
            const convertProcess = spawn('python3', [
                convertScript,
                modelPath,
                '--outtype', quantType,
                '--outfile', outputPath
            ], {
                cwd: this.bitnetPath,
                stdio: 'inherit'
            });

            convertProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info('Model converted successfully');
                    resolve(outputPath);
                } else {
                    reject(new Error(`Model conversion failed with code ${code}`));
                }
            });

            convertProcess.on('error', (err) => {
                reject(new Error(`Failed to convert model: ${err.message}`));
            });
        });
    }

    /**
     * Load a BitNet model
     */
    async load(source, options = {}) {
        try {
            logger.info(`Loading BitNet model from: ${source}`);

            // Check if BitNet is installed
            const isInstalled = await this.checkBitNetInstallation();
            if (!isInstalled) {
                if (options.autoBuild !== false) {
                    await this.buildBitNet();
                } else {
                    throw new ModelError('BitNet.cpp not installed. Run build first or set autoBuild: true');
                }
            }

            let modelPath = source;

            // Handle HuggingFace model IDs
            if (source.includes('/') && !source.startsWith('/') && !source.startsWith('.')) {
                const quantType = options.quantType || 'i2_s';
                modelPath = await this.downloadModel(source, quantType);
            }

            // Check if model file exists
            await fs.access(modelPath);

            // Store model configuration
            this.modelConfig = {
                path: modelPath,
                threads: options.threads || 2,
                contextSize: options.contextSize || 2048,
                temperature: options.temperature || 0.8,
                gpuLayers: options.gpuLayers || 0,
                ...options
            };

            this.isReady = true;
            logger.info('BitNet model loaded successfully');

            return {
                type: 'bitnet',
                path: modelPath,
                config: this.modelConfig
            };
        } catch (error) {
            throw new ModelError(`Failed to load BitNet model: ${error.message}`);
        }
    }

    /**
     * Run inference with the loaded model
     */
    async generate(prompt, options = {}) {
        if (!this.isReady) {
            throw new ModelError('Model not loaded. Call load() first.');
        }

        const config = { ...this.modelConfig, ...options };
        const cliPath = this.getCliPath();

        return new Promise((resolve, reject) => {
            const args = [
                '-m', config.path,
                '-p', prompt,
                '-n', String(config.maxTokens || 128),
                '-t', String(config.threads),
                '-c', String(config.contextSize),
                '--temp', String(config.temperature),
                '-ngl', String(config.gpuLayers),
                '-b', '1'
            ];

            if (config.conversation) {
                args.push('-cnv');
            }

            const inferenceProcess = spawn(cliPath, args);
            
            let output = '';
            let error = '';

            inferenceProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            inferenceProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            inferenceProcess.on('close', (code) => {
                if (code === 0) {
                    // Parse the output to extract the generated text
                    const generatedText = this.parseOutput(output);
                    resolve({
                        text: generatedText,
                        raw: output,
                        model: 'bitnet',
                        config
                    });
                } else {
                    reject(new ModelError(`Inference failed: ${error}`));
                }
            });

            inferenceProcess.on('error', (err) => {
                reject(new ModelError(`Failed to run inference: ${err.message}`));
            });
        });
    }

    /**
     * Stream tokens from the model
     */
    async *stream(prompt, options = {}) {
        if (!this.isReady) {
            throw new ModelError('Model not loaded. Call load() first.');
        }

        const config = { ...this.modelConfig, ...options };
        const cliPath = this.getCliPath();

        const args = [
            '-m', config.path,
            '-p', prompt,
            '-n', String(config.maxTokens || 128),
            '-t', String(config.threads),
            '-c', String(config.contextSize),
            '--temp', String(config.temperature),
            '-ngl', String(config.gpuLayers),
            '-b', '1',
            '--stream'  // Enable streaming
        ];

        if (config.conversation) {
            args.push('-cnv');
        }

        const inferenceProcess = spawn(cliPath, args);
        
        for await (const chunk of inferenceProcess.stdout) {
            const text = chunk.toString();
            const tokens = this.parseStreamChunk(text);
            if (tokens) {
                yield tokens;
            }
        }
    }

    /**
     * Parse output from llama-cli
     */
    parseOutput(output) {
        // Remove system messages and extract generated text
        const lines = output.split('\n');
        const startIdx = lines.findIndex(line => line.includes('system_info'));
        const endIdx = lines.findIndex(line => line.includes('timings:'));
        
        if (startIdx !== -1 && endIdx !== -1) {
            return lines.slice(startIdx + 1, endIdx).join('\n').trim();
        }
        
        // Fallback: return cleaned output
        return output
            .replace(/^.*system_info.*$/gm, '')
            .replace(/^.*timings:.*$/gm, '')
            .replace(/^.*llama_.*$/gm, '')
            .trim();
    }

    /**
     * Parse streaming chunk
     */
    parseStreamChunk(chunk) {
        // Extract tokens from streaming output
        const cleaned = chunk
            .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
            .trim();
        
        return cleaned || null;
    }

    /**
     * Unload the model and clean up resources
     */
    async unload() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.isReady = false;
        logger.info('BitNet model unloaded');
    }

    /**
     * Get model information
     */
    async getModelInfo() {
        if (!this.isReady) {
            throw new ModelError('Model not loaded');
        }

        return {
            type: 'bitnet',
            format: 'gguf',
            quantization: '1.58-bit',
            path: this.modelConfig.path,
            config: this.modelConfig
        };
    }

    /**
     * List available BitNet models
     */
    static async listAvailableModels() {
        return {
            official: [
                'microsoft/BitNet-b1.58-2B-4T'
            ],
            community: [
                '1bitLLM/bitnet_b1_58-large',
                '1bitLLM/bitnet_b1_58-3B',
                'HF1BitLLM/Llama3-8B-1.58-100B-tokens',
                'tiiuae/Falcon3-7B-Instruct-1.58bit',
                'tiiuae/Falcon3-10B-Instruct-1.58bit',
                'tiiuae/Falcon3-3B-Instruct-1.58bit',
                'tiiuae/Falcon3-1B-Instruct-1.58bit'
            ]
        };
    }
}

export default BitNetLoader;