# LLM Runner Router Examples

This directory contains comprehensive examples demonstrating all features of the LLM Runner Router, including the advanced utility tools.

## Quick Start Examples

### Basic Usage
- `BASIC.md` - Simple model loading and inference
- `ROUTING.md` - Router strategies and configuration
- `STREAMING.md` - Real-time token streaming
- `CACHING.md` - Performance optimization with caching

### Advanced Features  
- `ENSEMBLE.md` - Multi-model ensemble inference
- `BATCH.md` - Batch processing for high throughput
- `DOCUMENT_QA.md` - Document question-answering workflows

## Advanced Utilities

### Complete Demo
- `advanced-utils-demo.js` - **Complete showcase of all utility tools**
  - Universal Tokenizer with multi-format support
  - Model Quantizer with GPTQ/AWQ methods
  - Format Converter for model transformations
  - Validation Suite for comprehensive testing
  - Complete processing pipeline demonstration

### Individual Examples

#### Universal Tokenizer
```bash
# Run tokenization examples
node examples/tokenization-examples.js

# Features demonstrated:
# - Multi-format tokenization (BPE, WordPiece, SentencePiece, Tiktoken)
# - Auto-detection of tokenizer types
# - Batch processing and caching
# - Performance optimization
```

#### Model Quantizer
```bash
# Run quantization examples  
node examples/quantization-examples.js

# Features demonstrated:
# - Dynamic and static quantization
# - GPTQ and AWQ advanced methods
# - Quality validation and metrics
# - Calibration dataset usage
```

#### Format Converter
```bash
# Run conversion examples
node examples/conversion-examples.js

# Features demonstrated:
# - Multi-format conversion (GGUF, ONNX, Safetensors, PyTorch)
# - Automatic format detection
# - Metadata preservation
# - Post-conversion validation
```

#### Validation Suite
```bash
# Run validation examples
node examples/validation-examples.js

# Features demonstrated:
# - Comprehensive model testing
# - Performance benchmarking
# - Security scanning
# - HTML report generation
```

## Running Examples

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure models directory exists
mkdir -p models/test
```

### Complete Demo
```bash
# Run the complete advanced utilities demo
node examples/advanced-utils-demo.js
```

This will demonstrate:
1. **Text Processing** with Universal Tokenizer
2. **Model Quantization** with quality validation
3. **Format Conversion** between model formats
4. **Comprehensive Validation** with detailed reports
5. **Complete Pipeline** integration
6. **Performance Comparison** and optimization

### Individual Utility Examples

```bash
# Tokenization features
node -e "
import { demoUniversalTokenizer } from './examples/advanced-utils-demo.js';
await demoUniversalTokenizer();
"

# Quantization features  
node -e "
import { demoModelQuantizer } from './examples/advanced-utils-demo.js';
await demoModelQuantizer();
"

# Conversion features
node -e "
import { demoFormatConverter } from './examples/advanced-utils-demo.js';
await demoFormatConverter();
"

# Validation features
node -e "
import { demoValidationSuite } from './examples/advanced-utils-demo.js';
await demoValidationSuite();
"
```

## API Integration Examples

### Enterprise Integration
```javascript
// Enterprise-grade model processing pipeline
import { EnterpriseManager } from '../src/enterprise/index.js';
import UniversalTokenizer from '../src/utils/UniversalTokenizer.js';
import ModelQuantizer from '../src/utils/ModelQuantizer.js';

const enterprise = new EnterpriseManager({
  features: ['ab-testing', 'audit-logging', 'sla-monitoring']
});

const tokenizer = new UniversalTokenizer();
const quantizer = new ModelQuantizer();

// Process models with enterprise features
await enterprise.processModel(modelPath, {
  tokenizer,
  quantizer,
  abTestConfig: { variants: ['original', 'quantized'] }
});
```

### Custom Workflow
```javascript
// Custom processing workflow
import LLMRouter from '../src/index.js';
import ValidationSuite from '../src/utils/ValidationSuite.js';

const router = new LLMRouter();
const validator = new ValidationSuite();

// Load and validate model before routing
const modelPath = '/path/to/model.gguf';
const validation = await validator.validate(modelPath);

if (validation.passed) {
  await router.loadModel(modelPath);
  const response = await router.generateText('Hello, world!');
  console.log(response);
} else {
  console.error('Model failed validation:', validation.recommendations);
}
```

## Performance Examples

### Benchmarking
```bash
# Run performance benchmarks
node examples/benchmarks/performance.js

# Includes:
# - Tokenization speed tests
# - Quantization compression ratios
# - Conversion time measurements
# - Validation performance metrics
```

### Memory Optimization
```javascript
// Memory-efficient processing
const tokenizer = new UniversalTokenizer({
  cacheSize: 1000,        // Smaller cache
  enableNative: true      // Use native implementation
});

const quantizer = new ModelQuantizer({
  memoryBudget: 4,        // 4GB limit
  numWorkers: 2           // Fewer workers
});
```

## Docker Examples

### Containerized Processing
```dockerfile
# Use the LLM Runner Router with utilities
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Run advanced utilities demo
CMD ["node", "examples/advanced-utils-demo.js"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  llm-processor:
    build: .
    volumes:
      - ./models:/app/models
      - ./output:/app/output
    environment:
      - LOG_LEVEL=info
      - NODE_ENV=production
    command: node examples/advanced-utils-demo.js
```

## Cloud Integration Examples

### AWS Lambda
```javascript
// Serverless model processing
export const handler = async (event) => {
  const { UniversalTokenizer } = await import('./src/utils/UniversalTokenizer.js');
  
  const tokenizer = new UniversalTokenizer({
    model: event.model || 'gpt2',
    cacheSize: 100  // Small cache for Lambda
  });
  
  await tokenizer.initialize();
  const result = await tokenizer.encode(event.text);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      tokens: result.tokens,
      ids: result.ids,
      length: result.length
    })
  };
};
```

### Google Cloud Functions
```javascript
// Cloud function for model validation
import { ValidationSuite } from './src/utils/ValidationSuite.js';

export const validateModel = async (req, res) => {
  const validator = new ValidationSuite({
    testTypes: ['functional', 'performance'],
    generateReport: false  // Skip report in cloud
  });
  
  await validator.initialize();
  const result = await validator.validate(req.body.modelPath);
  
  res.json({
    passed: result.passed,
    score: result.overallScore,
    summary: result.summary
  });
};
```

## Testing Examples

### Unit Testing
```javascript
// Test advanced utilities
import { jest } from '@jest/globals';
import UniversalTokenizer from '../src/utils/UniversalTokenizer.js';

describe('UniversalTokenizer', () => {
  test('should encode text correctly', async () => {
    const tokenizer = new UniversalTokenizer();
    await tokenizer.initialize();
    
    const result = await tokenizer.encode('Hello, world!');
    
    expect(result.ids).toHaveLength(4);
    expect(result.tokens).toHaveLength(4);
  });
});
```

### Integration Testing
```javascript
// Test complete pipeline
import { demoCompleteModelPipeline } from './advanced-utils-demo.js';

describe('Complete Pipeline', () => {
  test('should process model end-to-end', async () => {
    const pipeline = await demoCompleteModelPipeline();
    
    expect(pipeline.results.quantization.success).toBe(true);
    expect(pipeline.results.conversion.success).toBe(true);
    expect(pipeline.results.validation.passed).toBe(true);
  }, 60000); // 60 second timeout
});
```

## Example Output

When running the complete demo, you'll see output like:

```
🌍 Universal Tokenizer Demo
✅ Tokenizer initialized successfully
Encoding Results:
  Text: "Hello, this is a test of the universal tokenizer system!"
  Token IDs: [15496, 11, 428, 318, 257, 1332, 286, 262, 10112, 11241, 7509...]
  Tokens: ["Hello", ",", " this", " is", " a"...]
  Length: 12 tokens

🔧 Model Quantizer Demo  
✅ Quantizer initialized successfully
Quantization Results:
  Success: true
  Original size: 0.95 MB
  Quantized size: 0.24 MB
  Compression: 75.0%
  Accuracy: 0.970

🔄 Format Converter Demo
✅ Format converter initialized
Conversion Results:
  Success: true
  Source format: huggingface
  Target format: onnx
  Size change: 15.2%

🔍 Validation Suite Demo
✅ Validation suite initialized
Validation Results:
  Overall Score: 87.50/100
  Status: PASSED
  Pass Rate: 85.7%

🚀 Complete Model Processing Pipeline Demo
📊 Pipeline Summary:
  Tokenizer: ✅ Initialized (4 tokenizations)
  Quantizer: ✅ 75.0% compression
  Converter: ✅ onnx format
  Validator: ✅ 87.5/100 score

🎉 Complete pipeline demo finished successfully!
```

## Additional Resources

- [Advanced Utilities Guide](../docs/ADVANCED-UTILITIES.md) - Comprehensive documentation
- [API Reference](../docs/API_REFERENCE.md) - Complete API documentation
- [Performance Guide](../docs/PERFORMANCE.md) - Optimization strategies
- [Troubleshooting](../docs/TROUBLESHOOTING.md) - Common issues and solutions

## Contributing Examples

To contribute new examples:

1. Create a new file in `examples/`
2. Follow the existing pattern with imports and error handling
3. Include comprehensive documentation
4. Add tests in `tests/examples/`
5. Update this README with the new example

Example template:
```javascript
/**
 * Example: [Description]
 * Demonstrates: [Features]
 */

import Logger from '../src/utils/Logger.js';

const logger = new Logger('ExampleName');

async function exampleFunction() {
  try {
    // Implementation
    logger.success('Example completed');
  } catch (error) {
    logger.error('Example failed:', error);
    throw error;
  }
}

export { exampleFunction };

if (import.meta.url === `file://${process.argv[1]}`) {
  exampleFunction().catch(console.error);
}
```