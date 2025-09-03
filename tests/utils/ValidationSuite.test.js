/**
 * Tests for Validation Suite
 */

import { jest } from '@jest/globals';
import ValidationSuite, {
  ValidationConfig,
  ValidationTestResult,
  ValidationSuiteResult,
  ValidationTestType,
  ValidationSeverity
} from '../../src/utils/ValidationSuite.js';

// Mock fs/promises
const mockFs = {
  access: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
  mkdir: jest.fn()
};

jest.mock('fs/promises', () => mockFs);

// Mock worker_threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn(() => ({
    on: jest.fn(),
    terminate: jest.fn()
  }))
}));

// Mock os
jest.mock('os', () => ({
  cpus: jest.fn(() => Array(4).fill({}))
}));

describe('ValidationConfig', () => {
  test('should create config with default values', () => {
    const config = new ValidationConfig();
    
    expect(config.testTypes).toEqual(Object.values(ValidationTestType));
    expect(config.maxExecutionTime).toBe(300000);
    expect(config.memoryLimit).toBe(8);
    expect(config.accuracyThreshold).toBe(0.95);
    expect(config.parallelTests).toBe(true);
  });

  test('should create config with custom values', () => {
    const options = {
      testTypes: [ValidationTestType.ACCURACY, ValidationTestType.PERFORMANCE],
      maxExecutionTime: 600000,
      accuracyThreshold: 0.9,
      parallelTests: false,
      includeSecurityScan: true
    };
    
    const config = new ValidationConfig(options);
    
    expect(config.testTypes).toEqual([ValidationTestType.ACCURACY, ValidationTestType.PERFORMANCE]);
    expect(config.maxExecutionTime).toBe(600000);
    expect(config.accuracyThreshold).toBe(0.9);
    expect(config.parallelTests).toBe(false);
    expect(config.includeSecurityScan).toBe(true);
  });

  test('should include benchmark and security configurations', () => {
    const config = new ValidationConfig({
      benchmarkConfig: { iterations: 200 },
      securityConfig: { checkMaliciousCode: false }
    });
    
    expect(config.benchmarkConfig.iterations).toBe(200);
    expect(config.securityConfig.checkMaliciousCode).toBe(false);
  });
});

describe('ValidationTestResult', () => {
  test('should create test result with default values', () => {
    const result = new ValidationTestResult();
    
    expect(result.success).toBe(false);
    expect(result.severity).toBe(ValidationSeverity.INFO);
    expect(result.passed).toBe(false);
    expect(result.executionTime).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('should create test result with provided data', () => {
    const data = {
      testType: ValidationTestType.ACCURACY,
      testName: 'inference_accuracy',
      success: true,
      score: 0.96,
      threshold: 0.95,
      passed: true,
      executionTime: 5000,
      severity: ValidationSeverity.HIGH
    };
    
    const result = new ValidationTestResult(data);
    
    expect(result.testType).toBe(ValidationTestType.ACCURACY);
    expect(result.testName).toBe('inference_accuracy');
    expect(result.success).toBe(true);
    expect(result.score).toBe(0.96);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe(ValidationSeverity.HIGH);
  });
});

describe('ValidationSuiteResult', () => {
  test('should create suite result with default values', () => {
    const result = new ValidationSuiteResult();
    
    expect(result.overallScore).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.testResults).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.timestamp).toBeDefined();
  });

  test('should create suite result with provided data', () => {
    const testResults = [
      new ValidationTestResult({
        testType: ValidationTestType.ACCURACY,
        passed: true,
        score: 0.96
      }),
      new ValidationTestResult({
        testType: ValidationTestType.PERFORMANCE,
        passed: false,
        score: 0.8
      })
    ];
    
    const data = {
      modelPath: '/model.gguf',
      overallScore: 88,
      passed: true,
      testResults,
      executionTime: 15000
    };
    
    const result = new ValidationSuiteResult(data);
    
    expect(result.modelPath).toBe('/model.gguf');
    expect(result.overallScore).toBe(88);
    expect(result.passed).toBe(true);
    expect(result.testResults).toHaveLength(2);
  });

  test('should filter results by test type', () => {
    const testResults = [
      new ValidationTestResult({ testType: ValidationTestType.ACCURACY }),
      new ValidationTestResult({ testType: ValidationTestType.PERFORMANCE }),
      new ValidationTestResult({ testType: ValidationTestType.ACCURACY })
    ];
    
    const result = new ValidationSuiteResult({ testResults });
    const accuracyResults = result.getResultsByType(ValidationTestType.ACCURACY);
    
    expect(accuracyResults).toHaveLength(2);
  });

  test('should get failed tests', () => {
    const testResults = [
      new ValidationTestResult({ passed: true }),
      new ValidationTestResult({ passed: false }),
      new ValidationTestResult({ passed: false })
    ];
    
    const result = new ValidationSuiteResult({ testResults });
    const failedTests = result.getFailedTests();
    
    expect(failedTests).toHaveLength(2);
  });

  test('should get critical issues', () => {
    const testResults = [
      new ValidationTestResult({ severity: ValidationSeverity.CRITICAL, passed: false }),
      new ValidationTestResult({ severity: ValidationSeverity.HIGH, passed: false }),
      new ValidationTestResult({ severity: ValidationSeverity.CRITICAL, passed: true })
    ];
    
    const result = new ValidationSuiteResult({ testResults });
    const criticalIssues = result.getCriticalIssues();
    
    expect(criticalIssues).toHaveLength(1);
  });

  test('should calculate pass rate correctly', () => {
    const testResults = [
      new ValidationTestResult({ passed: true }),
      new ValidationTestResult({ passed: true }),
      new ValidationTestResult({ passed: false }),
      new ValidationTestResult({ passed: true })
    ];
    
    const result = new ValidationSuiteResult({ testResults });
    
    expect(result.passRate).toBe(0.75);
  });
});

describe('ValidationSuite', () => {
  let validationSuite;
  let fs;

  beforeEach(async () => {
    validationSuite = new ValidationSuite();
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockFs.access.mockResolvedValue();
    mockFs.stat.mockResolvedValue({ 
      size: 1000000,
      lastModified: new Date()
    });
    mockFs.mkdir.mockResolvedValue();
    mockFs.writeFile.mockResolvedValue();
    mockFs.readFile.mockResolvedValue('test data');
  });

  afterEach(async () => {
    await validationSuite.cleanup?.();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(validationSuite.config.testTypes).toContain(ValidationTestType.ACCURACY);
      expect(validationSuite.config.testTypes).toContain(ValidationTestType.PERFORMANCE);
      expect(validationSuite.workers).toEqual([]);
      expect(validationSuite.syntheticDatasets).toBeInstanceOf(Map);
    });

    test('should initialize worker pool and datasets', async () => {
      await validationSuite.initialize();
      
      expect(validationSuite.syntheticDatasets.size).toBeGreaterThan(0);
      expect(validationSuite.syntheticDatasets.has('accuracy')).toBe(true);
      expect(validationSuite.syntheticDatasets.has('performance')).toBe(true);
    });
  });

  describe('Model Analysis', () => {
    test('should analyze model properties', async () => {
      const modelInfo = await validationSuite.analyzeModel('/model.gguf');
      
      expect(modelInfo).toHaveProperty('path', '/model.gguf');
      expect(modelInfo).toHaveProperty('size', 1000000);
      expect(modelInfo).toHaveProperty('format', '.gguf');
    });

    test('should handle analysis errors gracefully', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      
      await expect(validationSuite.analyzeModel('/nonexistent.model'))
        .rejects.toThrow('File not found');
    });
  });

  describe('Test Suite Execution', () => {
    beforeEach(async () => {
      await validationSuite.initialize();
    });

    test('should run complete validation suite', async () => {
      const result = await validationSuite.validate('/model.gguf');
      
      expect(result).toBeInstanceOf(ValidationSuiteResult);
      expect(result.modelPath).toBe('/model.gguf');
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should run tests in parallel when configured', async () => {
      validationSuite.config.parallelTests = true;
      
      const startTime = Date.now();
      const result = await validationSuite.validate('/model.gguf');
      const endTime = Date.now();
      
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(60000); // Should be faster in parallel
    });

    test('should run tests sequentially when configured', async () => {
      validationSuite.config.parallelTests = false;
      
      const result = await validationSuite.validate('/model.gguf');
      
      expect(result.testResults.length).toBeGreaterThan(0);
    });

    test('should generate report when requested', async () => {
      validationSuite.config.generateReport = true;
      
      const result = await validationSuite.validate('/model.gguf');
      
      expect(result.reportPath).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Individual Test Types', () => {
    beforeEach(async () => {
      await validationSuite.initialize();
    });

    test('should run accuracy tests', async () => {
      const results = await validationSuite.runAccuracyTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.ACCURACY);
      expect(results[0]).toHaveProperty('score');
    });

    test('should run performance tests', async () => {
      const results = await validationSuite.runPerformanceTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.PERFORMANCE);
    });

    test('should run memory tests', async () => {
      const results = await validationSuite.runMemoryTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.MEMORY);
    });

    test('should run compatibility tests', async () => {
      const results = await validationSuite.runCompatibilityTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.COMPATIBILITY);
    });

    test('should run security tests when enabled', async () => {
      validationSuite.config.includeSecurityScan = true;
      
      const results = await validationSuite.runSecurityTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.SECURITY);
    });

    test('should skip security tests when disabled', async () => {
      validationSuite.config.includeSecurityScan = false;
      
      const results = await validationSuite.runSecurityTests('/model.gguf', {}, {});
      
      expect(results).toEqual([]);
    });

    test('should run functional tests', async () => {
      const results = await validationSuite.runFunctionalTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.FUNCTIONAL);
    });

    test('should run stress tests', async () => {
      const results = await validationSuite.runStressTests('/model.gguf', {}, {});
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.STRESS);
    });

    test('should run regression tests with baseline', async () => {
      const results = await validationSuite.runRegressionTests('/model.gguf', {}, {
        baselineModel: '/baseline.gguf'
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].testType).toBe(ValidationTestType.REGRESSION);
    });
  });

  describe('Test Data Management', () => {
    beforeEach(async () => {
      await validationSuite.initialize();
    });

    test('should create synthetic datasets', () => {
      const accuracyDataset = validationSuite.createAccuracyDataset();
      const performanceDataset = validationSuite.createPerformanceDataset();
      const stressDataset = validationSuite.createStressDataset();
      
      expect(accuracyDataset.length).toBe(100);
      expect(performanceDataset.length).toBe(50);
      expect(stressDataset.length).toBe(200);
    });

    test('should load synthetic datasets by default', async () => {
      const dataset = await validationSuite.loadTestDataset('accuracy');
      
      expect(Array.isArray(dataset)).toBe(true);
      expect(dataset.length).toBeGreaterThan(0);
    });

    test('should load custom datasets when specified', async () => {
      validationSuite.config.testDatasets.accuracy = '/custom/dataset.json';
      fs.readFile.mockResolvedValue('[{"input": "test", "expected": "result"}]');
      
      const dataset = await validationSuite.loadTestDataset('accuracy');
      
      expect(dataset).toEqual([{ input: 'test', expected: 'result' }]);
    });

    test('should fallback to empty dataset on errors', async () => {
      validationSuite.config.testDatasets.accuracy = '/nonexistent.json';
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const dataset = await validationSuite.loadTestDataset('accuracy');
      
      expect(dataset).toEqual([]);
    });
  });

  describe('Scoring and Pass/Fail Logic', () => {
    test('should calculate overall score correctly', () => {
      const testResults = [
        new ValidationTestResult({ testType: ValidationTestType.ACCURACY, score: 0.9 }),
        new ValidationTestResult({ testType: ValidationTestType.PERFORMANCE, score: 0.8 }),
        new ValidationTestResult({ testType: ValidationTestType.MEMORY, score: 0.85 }),
        new ValidationTestResult({ testType: ValidationTestType.SECURITY, score: 0.95 })
      ];
      
      const overallScore = validationSuite.calculateOverallScore(testResults);
      
      expect(overallScore).toBeGreaterThan(0);
      expect(overallScore).toBeLessThanOrEqual(1);
    });

    test('should determine overall pass with no critical failures', () => {
      const testResults = [
        new ValidationTestResult({ passed: true, severity: ValidationSeverity.INFO }),
        new ValidationTestResult({ passed: false, severity: ValidationSeverity.MEDIUM }),
        new ValidationTestResult({ passed: true, severity: ValidationSeverity.HIGH })
      ];
      
      const passed = validationSuite.determineOverallPass(testResults);
      
      expect(passed).toBe(true);
    });

    test('should determine overall fail with critical failures', () => {
      const testResults = [
        new ValidationTestResult({ passed: true, severity: ValidationSeverity.INFO }),
        new ValidationTestResult({ passed: false, severity: ValidationSeverity.CRITICAL })
      ];
      
      const passed = validationSuite.determineOverallPass(testResults);
      
      expect(passed).toBe(false);
    });

    test('should get correct test weights', () => {
      expect(validationSuite.getTestWeight(ValidationTestType.ACCURACY)).toBe(0.3);
      expect(validationSuite.getTestWeight(ValidationTestType.PERFORMANCE)).toBe(0.2);
      expect(validationSuite.getTestWeight(ValidationTestType.SECURITY)).toBe(0.15);
      expect(validationSuite.getTestWeight('unknown')).toBe(0.1);
    });
  });

  describe('Summary and Recommendations', () => {
    test('should generate test summary', () => {
      const testResults = [
        new ValidationTestResult({ testType: ValidationTestType.ACCURACY, passed: true }),
        new ValidationTestResult({ testType: ValidationTestType.ACCURACY, passed: false }),
        new ValidationTestResult({ testType: ValidationTestType.PERFORMANCE, passed: true }),
        new ValidationTestResult({ severity: ValidationSeverity.CRITICAL, passed: false })
      ];
      
      const summary = validationSuite.generateSummary(testResults);
      
      expect(summary.totalTests).toBe(4);
      expect(summary.passedTests).toBe(2);
      expect(summary.failedTests).toBe(2);
      expect(summary.criticalIssues).toBe(1);
      expect(summary.testsByType).toHaveProperty(ValidationTestType.ACCURACY);
      expect(summary.testsByType[ValidationTestType.ACCURACY].total).toBe(2);
    });

    test('should generate recommendations based on failures', () => {
      const testResults = [
        new ValidationTestResult({ 
          testType: ValidationTestType.PERFORMANCE,
          testName: 'latency_test',
          passed: false
        }),
        new ValidationTestResult({ 
          testType: ValidationTestType.MEMORY,
          testName: 'memory_usage',
          passed: false
        }),
        new ValidationTestResult({ 
          testType: ValidationTestType.ACCURACY,
          testName: 'inference_accuracy',
          passed: false
        })
      ];
      
      const recommendations = validationSuite.generateRecommendations(testResults);
      
      expect(recommendations.length).toBe(3);
      expect(recommendations[0]).toContain('Optimize');
      expect(recommendations[1]).toContain('memory');
      expect(recommendations[2]).toContain('accuracy');
    });
  });

  describe('Report Generation', () => {
    test('should generate HTML report', async () => {
      const result = new ValidationSuiteResult({
        modelPath: '/model.gguf',
        overallScore: 85,
        passed: true,
        testResults: [
          new ValidationTestResult({
            testName: 'test1',
            testType: ValidationTestType.ACCURACY,
            passed: true,
            score: 0.9
          })
        ],
        recommendations: ['Improve performance']
      });
      
      const reportPath = await validationSuite.generateReport(result);
      
      expect(reportPath).toContain('validation_report_');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('should generate valid HTML content', () => {
      const result = new ValidationSuiteResult({
        modelPath: '/model.gguf',
        overallScore: 85,
        passed: true,
        passRate: 0.8,
        testResults: [],
        recommendations: []
      });
      
      const html = validationSuite.generateHTMLReport(result);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Model Validation Report</title>');
      expect(html).toContain('/model.gguf');
      expect(html).toContain('85.00');
      expect(html).toContain('PASSED');
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await validationSuite.initialize();
    });

    test('should provide validation statistics', () => {
      validationSuite.stats.totalValidations = 5;
      validationSuite.stats.passedValidations = 4;
      validationSuite.stats.failedValidations = 1;
      
      const stats = validationSuite.getStats();
      
      expect(stats.totalValidations).toBe(5);
      expect(stats.successRate).toBe(0.8);
      expect(stats.activeTests).toBe(0);
    });

    test('should update statistics after validation', async () => {
      const initialTotal = validationSuite.stats.totalValidations;
      
      await validationSuite.validate('/model.gguf');
      
      expect(validationSuite.stats.totalValidations).toBe(initialTotal + 1);
      expect(validationSuite.stats.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should emit validation events', async () => {
      const eventSpy = jest.fn();
      validationSuite.on('validation:start', eventSpy);
      validationSuite.on('validation:complete', eventSpy);
      
      await validationSuite.validate('/model.gguf');
      
      expect(eventSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors gracefully', async () => {
      jest.spyOn(validationSuite, 'analyzeModel').mockRejectedValue(new Error('Analysis failed'));
      
      await expect(validationSuite.validate('/model.gguf'))
        .rejects.toThrow('Analysis failed');
    });

    test('should handle test execution errors', async () => {
      await validationSuite.initialize();
      
      jest.spyOn(validationSuite, 'runAccuracyTests').mockRejectedValue(new Error('Test failed'));
      
      // Should not throw, should return error results
      const results = await validationSuite.runTestType(ValidationTestType.ACCURACY, '/model.gguf', {}, {});
      
      expect(results[0].success).toBe(false);
      expect(results[0].errors).toContain('Test failed');
    });

    test('should handle unknown test types', async () => {
      await validationSuite.initialize();
      
      const results = await validationSuite.runTestType('unknown_test', '/model.gguf', {}, {});
      
      expect(results).toEqual([]);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await validationSuite.initialize();
    });

    test('should complete validation within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await validationSuite.validate('/model.gguf');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(120000); // Should complete in under 2 minutes for mock
    });

    test('should handle concurrent validations', async () => {
      const promises = [
        validationSuite.validate('/model1.gguf'),
        validationSuite.validate('/model2.gguf'),
        validationSuite.validate('/model3.gguf')
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeInstanceOf(ValidationSuiteResult);
        expect(result.testResults.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await validationSuite.initialize();
      
      // Mock workers
      const mockWorker = { terminate: jest.fn() };
      validationSuite.workers = [mockWorker];
      validationSuite.activeTests.set('test1', {});
      validationSuite.syntheticDatasets.set('key', 'value');
      
      await validationSuite.cleanup();
      
      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(validationSuite.workers).toEqual([]);
      expect(validationSuite.activeTests.size).toBe(0);
      expect(validationSuite.syntheticDatasets.size).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    test('should check file existence', async () => {
      fs.access.mockResolvedValue();
      expect(await validationSuite.fileExists('/existing.file')).toBe(true);
      
      fs.access.mockRejectedValue(new Error('Not found'));
      expect(await validationSuite.fileExists('/missing.file')).toBe(false);
    });

    test('should handle delays correctly', async () => {
      const startTime = Date.now();
      await validationSuite.delay(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });
});