/**
 * Advanced Utilities Demo - Complete showcase of utility tools
 * Demonstrates Universal Tokenizer, Model Quantizer, Format Converter, and Validation Suite
 * Echo AI Systems - Advanced model processing pipeline
 */

import UniversalTokenizer, { TokenizerType } from '../src/utils/UniversalTokenizer.js';
import ModelQuantizer, { QuantizationMethod, QuantizationPrecision } from '../src/utils/ModelQuantizer.js';
import FormatConverter, { ModelFormat } from '../src/utils/FormatConverter.js';
import ValidationSuite, { ValidationTestType } from '../src/utils/ValidationSuite.js';
import Logger from '../src/utils/Logger.js';

const logger = new Logger('AdvancedUtilsDemo');

/**
 * Demo: Universal Tokenizer with multiple formats
 */
async function demoUniversalTokenizer() {
  logger.info('🌍 Universal Tokenizer Demo');
  
  try {
    // Create tokenizer with auto-detection
    const tokenizer = new UniversalTokenizer({
      model: 'gpt2',
      maxLength: 512,
      cacheSize: 5000
    });
    
    await tokenizer.initialize();
    logger.success('Tokenizer initialized successfully');
    
    // Single text encoding
    const text = "Hello, this is a test of the universal tokenizer system!";
    const result = await tokenizer.encode(text);
    
    logger.info('Encoding Results:');
    console.log(`  Text: "${text}"`);
    console.log(`  Token IDs: [${result.ids.slice(0, 10).join(', ')}...]`);
    console.log(`  Tokens: [${result.tokens.slice(0, 5).map(t => `"${t}"`).join(', ')}...]`);
    console.log(`  Length: ${result.length} tokens`);
    
    // Batch encoding
    const batchTexts = [
      "Machine learning is fascinating",
      "AI models require careful tokenization", 
      "Universal tokenizers handle multiple formats"
    ];
    
    const batchResults = await tokenizer.encodeBatch(batchTexts);
    logger.info(`Batch encoded ${batchResults.length} texts`);
    
    // Decoding
    const decoded = await tokenizer.decode(result.ids);
    logger.info(`Decoded text: "${decoded}"`);
    
    // Vocabulary operations
    const vocabSize = await tokenizer.getVocabSize();
    const tokenId = await tokenizer.tokenToId('hello');
    const tokenStr = await tokenizer.idToToken(123);
    
    logger.info('Vocabulary Info:');
    console.log(`  Vocab size: ${vocabSize}`);
    console.log(`  'hello' token ID: ${tokenId}`);
    console.log(`  Token 123: "${tokenStr}"`);
    
    // Statistics
    const stats = tokenizer.getStats();
    logger.info('Tokenizer Statistics:');
    console.log(`  Cache hits: ${stats.cacheHits}`);
    console.log(`  Cache misses: ${stats.cacheMisses}`);
    console.log(`  Hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`  Total tokenizations: ${stats.totalTokenizations}`);
    
    return { tokenizer, stats };
    
  } catch (error) {
    logger.error('Tokenizer demo failed:', error);
    throw error;
  }
}

/**
 * Demo: Model Quantizer with different methods
 */
async function demoModelQuantizer() {
  logger.info('🔧 Model Quantizer Demo');
  
  try {
    // Create quantizer with GPTQ configuration
    const quantizer = new ModelQuantizer({
      method: QuantizationMethod.GPTQ,
      targetPrecision: QuantizationPrecision.INT4,
      preserveAccuracy: true,
      accuracyThreshold: 0.95,
      calibrationSamples: 128
    });
    
    await quantizer.initialize();
    logger.success('Quantizer initialized successfully');
    
    // Simulate model quantization
    const modelPath = './models/test/config.json'; // Use existing test model
    const outputPath = './temp/quantized-model.gguf';
    
    logger.info('Starting quantization process...');
    quantizer.on('quantization:start', (data) => {
      logger.info(`Quantization job ${data.jobId} started`);
    });
    
    quantizer.on('quantization:analyzed', (data) => {
      logger.info(`Model analyzed: ${JSON.stringify(data.modelInfo, null, 2)}`);
    });
    
    quantizer.on('quantization:complete', (data) => {
      logger.success(`Quantization completed with ${data.result.success ? 'success' : 'failure'}`);
    });
    
    const result = await quantizer.quantize(modelPath, outputPath);
    
    logger.info('Quantization Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Original size: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Quantized size: ${(result.quantizedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Compression: ${result.compressionPercentage.toFixed(1)}%`);
    console.log(`  Accuracy: ${result.accuracy?.toFixed(3) || 'N/A'}`);
    console.log(`  Time: ${result.quantizationTime.toFixed(0)}ms`);
    
    if (result.warnings.length > 0) {
      logger.warn('Warnings:', result.warnings);
    }
    
    // Statistics
    const stats = quantizer.getStats();
    logger.info('Quantizer Statistics:');
    console.log(`  Active jobs: ${stats.activeJobs}`);
    console.log(`  Workers: ${stats.workerCount}`);
    console.log(`  Completed jobs: ${stats.totalJobsCompleted}`);
    
    return { quantizer, result };
    
  } catch (error) {
    logger.error('Quantizer demo failed:', error);
    throw error;
  }
}

/**
 * Demo: Format Converter with various transformations
 */
async function demoFormatConverter() {
  logger.info('🔄 Format Converter Demo');
  
  try {
    // Create format converter
    const converter = new FormatConverter({
      preserveMetadata: true,
      validateAfterConversion: true,
      optimizeForInference: true
    });
    
    logger.success('Format converter initialized');
    
    // Detect format
    const testModelPath = './models/test/config.json';
    const detectedFormat = await converter.detectFormat(testModelPath);
    logger.info(`Detected format: ${detectedFormat}`);
    
    // Check supported conversions
    const supportedConversions = converter.getSupportedConversions();
    logger.info('Supported conversion paths:');
    Object.entries(supportedConversions).forEach(([source, targets]) => {
      console.log(`  ${source} → [${targets.join(', ')}]`);
    });
    
    // Simulate conversion (PyTorch to ONNX)
    const sourcePath = './models/test/config.json';
    const outputPath = './temp/converted-model.onnx';
    
    logger.info('Starting conversion process...');
    converter.on('conversion:start', (data) => {
      logger.info(`Conversion job ${data.jobId} started`);
    });
    
    converter.on('conversion:analyzed', (data) => {
      logger.info(`Source analyzed: ${JSON.stringify(data.sourceInfo, null, 2)}`);
    });
    
    converter.on('conversion:complete', (data) => {
      logger.success(`Conversion completed: ${data.result.success ? 'success' : 'failure'}`);
    });
    
    // Mock conversion since we don't have actual PyTorch models
    const result = await converter.convert(sourcePath, outputPath, {
      sourceFormat: ModelFormat.HUGGINGFACE,
      targetFormat: ModelFormat.ONNX
    });
    
    logger.info('Conversion Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Source format: ${result.sourceFormat}`);
    console.log(`  Target format: ${result.targetFormat}`);
    console.log(`  Original size: ${(result.sourceSize / 1024).toFixed(1)} KB`);
    console.log(`  Output size: ${(result.outputSize / 1024).toFixed(1)} KB`);
    console.log(`  Size change: ${result.sizeReduction.toFixed(1)}%`);
    console.log(`  Time: ${result.conversionTime.toFixed(0)}ms`);
    console.log(`  Valid: ${result.isValid}`);
    
    if (result.validationResult) {
      logger.info('Validation Results:');
      console.log(`  Format valid: ${result.validationResult.formatValid}`);
      console.log(`  Size reasonable: ${result.validationResult.sizeReasonable}`);
    }
    
    // Statistics
    const stats = converter.getStats();
    logger.info('Converter Statistics:');
    console.log(`  Total conversions: ${stats.totalConversions}`);
    console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Average time: ${stats.averageConversionTime.toFixed(0)}ms`);
    
    return { converter, result };
    
  } catch (error) {
    logger.error('Converter demo failed:', error);
    throw error;
  }
}

/**
 * Demo: Validation Suite comprehensive testing
 */
async function demoValidationSuite() {
  logger.info('🔍 Validation Suite Demo');
  
  try {
    // Create validation suite
    const validator = new ValidationSuite({
      testTypes: [
        ValidationTestType.ACCURACY,
        ValidationTestType.PERFORMANCE,
        ValidationTestType.MEMORY,
        ValidationTestType.COMPATIBILITY,
        ValidationTestType.FUNCTIONAL
      ],
      accuracyThreshold: 0.95,
      performanceThreshold: 1000,
      memoryLimit: 8,
      generateReport: true,
      parallelTests: true
    });
    
    await validator.initialize();
    logger.success('Validation suite initialized');
    
    // Run validation
    const modelPath = './models/test/config.json';
    
    logger.info('Starting comprehensive validation...');
    validator.on('validation:start', (data) => {
      logger.info(`Validation ${data.validationId} started for ${data.modelPath}`);
    });
    
    validator.on('validation:analyzed', (data) => {
      logger.info(`Model analyzed: ${JSON.stringify(data.modelInfo)}`);
    });
    
    validator.on('validation:complete', (data) => {
      logger.success(`Validation completed: ${data.result.passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const result = await validator.validate(modelPath);
    
    logger.info('Validation Results:');
    console.log(`  Overall Score: ${result.overallScore.toFixed(2)}/100`);
    console.log(`  Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`  Execution Time: ${result.executionTime.toFixed(0)}ms`);
    console.log(`  Total Tests: ${result.testResults.length}`);
    console.log(`  Pass Rate: ${(result.passRate * 100).toFixed(1)}%`);
    
    // Test breakdown by type
    logger.info('Test Results by Type:');
    Object.values(ValidationTestType).forEach(type => {
      const typeResults = result.getResultsByType(type);
      if (typeResults.length > 0) {
        const passed = typeResults.filter(r => r.passed).length;
        console.log(`  ${type}: ${passed}/${typeResults.length} passed`);
      }
    });
    
    // Critical issues
    const criticalIssues = result.getCriticalIssues();
    if (criticalIssues.length > 0) {
      logger.warn(`Critical Issues Found: ${criticalIssues.length}`);
      criticalIssues.forEach(issue => {
        console.log(`    - ${issue.testName}: ${issue.errors.join(', ')}`);
      });
    }
    
    // Recommendations
    if (result.recommendations.length > 0) {
      logger.info('Recommendations:');
      result.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
    
    // Report generation
    if (result.reportPath) {
      logger.info(`Detailed report generated: ${result.reportPath}`);
    }
    
    // Statistics
    const stats = validator.getStats();
    logger.info('Validator Statistics:');
    console.log(`  Total validations: ${stats.totalValidations}`);
    console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Average time: ${stats.averageExecutionTime.toFixed(0)}ms`);
    
    return { validator, result };
    
  } catch (error) {
    logger.error('Validation demo failed:', error);
    throw error;
  }
}

/**
 * Demo: Complete pipeline with all utilities
 */
async function demoCompleteModelPipeline() {
  logger.info('🚀 Complete Model Processing Pipeline Demo');
  
  try {
    const pipeline = {
      tokenizer: null,
      quantizer: null,
      converter: null,
      validator: null,
      results: {}
    };
    
    // Step 1: Text processing with Universal Tokenizer
    logger.info('Step 1: Text Processing');
    const { tokenizer } = await demoUniversalTokenizer();
    pipeline.tokenizer = tokenizer;
    
    // Step 2: Model quantization
    logger.info('\nStep 2: Model Quantization');
    const { quantizer, result: quantResult } = await demoModelQuantizer();
    pipeline.quantizer = quantizer;
    pipeline.results.quantization = quantResult;
    
    // Step 3: Format conversion
    logger.info('\nStep 3: Format Conversion');
    const { converter, result: convResult } = await demoFormatConverter();
    pipeline.converter = converter;
    pipeline.results.conversion = convResult;
    
    // Step 4: Comprehensive validation
    logger.info('\nStep 4: Model Validation');
    const { validator, result: valResult } = await demoValidationSuite();
    pipeline.validator = validator;
    pipeline.results.validation = valResult;
    
    // Pipeline summary
    logger.info('\n📊 Pipeline Summary:');
    console.log(`  Tokenizer: ✅ Initialized (${pipeline.tokenizer.getStats().totalTokenizations} tokenizations)`);
    console.log(`  Quantizer: ${pipeline.results.quantization.success ? '✅' : '❌'} ${pipeline.results.quantization.compressionPercentage.toFixed(1)}% compression`);
    console.log(`  Converter: ${pipeline.results.conversion.success ? '✅' : '❌'} ${pipeline.results.conversion.targetFormat} format`);
    console.log(`  Validator: ${pipeline.results.validation.passed ? '✅' : '❌'} ${pipeline.results.validation.overallScore.toFixed(1)}/100 score`);
    
    // Cleanup
    await Promise.all([
      pipeline.quantizer.cleanup(),
      pipeline.validator.cleanup()
    ]);
    
    logger.success('🎉 Complete pipeline demo finished successfully!');
    return pipeline;
    
  } catch (error) {
    logger.error('Pipeline demo failed:', error);
    throw error;
  }
}

/**
 * Performance comparison demo
 */
async function demoPerformanceComparison() {
  logger.info('⚡ Performance Comparison Demo');
  
  try {
    const tokenizer = new UniversalTokenizer({ model: 'gpt2' });
    await tokenizer.initialize();
    
    // Test with different text sizes
    const testTexts = [
      'Short text',
      'Medium length text that contains more words and should demonstrate tokenization performance with moderate input size',
      'Very long text that contains many words and sentences to thoroughly test the tokenization performance with larger input sizes. This text should demonstrate how the tokenizer handles substantial content and measures the processing time for extended inputs that might be encountered in real-world applications where users submit lengthy documents or articles for processing.'
    ];
    
    logger.info('Text Size Performance:');
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      const startTime = Date.now();
      const result = await tokenizer.encode(text);
      const endTime = Date.now();
      
      console.log(`  Text ${i + 1}: ${text.length} chars → ${result.length} tokens (${endTime - startTime}ms)`);
    }
    
    // Batch vs individual processing
    const batchTexts = Array(10).fill().map((_, i) => `Test sentence number ${i + 1} for batch processing`);
    
    // Individual processing
    const individualStart = Date.now();
    for (const text of batchTexts) {
      await tokenizer.encode(text);
    }
    const individualTime = Date.now() - individualStart;
    
    // Batch processing
    const batchStart = Date.now();
    await tokenizer.encodeBatch(batchTexts);
    const batchTime = Date.now() - batchStart;
    
    logger.info('Processing Method Performance:');
    console.log(`  Individual: ${individualTime}ms for ${batchTexts.length} texts`);
    console.log(`  Batch: ${batchTime}ms for ${batchTexts.length} texts`);
    console.log(`  Speedup: ${(individualTime / batchTime).toFixed(2)}x faster`);
    
    // Cache performance
    const cacheText = 'Repeated text for cache testing';
    
    // First encoding (cache miss)
    tokenizer.clearCache();
    const cacheMissStart = Date.now();
    await tokenizer.encode(cacheText);
    const cacheMissTime = Date.now() - cacheMissStart;
    
    // Second encoding (cache hit)
    const cacheHitStart = Date.now();
    await tokenizer.encode(cacheText);
    const cacheHitTime = Date.now() - cacheHitStart;
    
    logger.info('Cache Performance:');
    console.log(`  Cache miss: ${cacheMissTime}ms`);
    console.log(`  Cache hit: ${cacheHitTime}ms`);
    console.log(`  Cache speedup: ${(cacheMissTime / Math.max(cacheHitTime, 1)).toFixed(2)}x faster`);
    
    return { individualTime, batchTime, cacheMissTime, cacheHitTime };
    
  } catch (error) {
    logger.error('Performance demo failed:', error);
    throw error;
  }
}

/**
 * Main demo function
 */
async function main() {
  logger.info('🌟 Advanced Utilities Demo Suite Starting...');
  
  try {
    // Individual component demos
    await demoUniversalTokenizer();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await demoModelQuantizer();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await demoFormatConverter();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await demoValidationSuite();
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Complete pipeline demo
    await demoCompleteModelPipeline();
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Performance comparison
    await demoPerformanceComparison();
    
    logger.success('🎊 All demos completed successfully!');
    
  } catch (error) {
    logger.error('Demo suite failed:', error);
    process.exit(1);
  }
}

// Export for use in other files
export {
  demoUniversalTokenizer,
  demoModelQuantizer,
  demoFormatConverter,
  demoValidationSuite,
  demoCompleteModelPipeline,
  demoPerformanceComparison
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}