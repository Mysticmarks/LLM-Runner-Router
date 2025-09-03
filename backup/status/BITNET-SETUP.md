# 🔋 BitNet Setup Instructions

## Quick Setup Guide

BitNet support is integrated into LLM Runner Router but requires CMake to be installed for compilation.

### Prerequisites

**CMake** is required to build BitNet.cpp:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install cmake

# macOS
brew install cmake

# Fedora/RHEL
sudo dnf install cmake

# Check installation
cmake --version  # Should be 3.22 or higher
```

### Installation Steps

Once CMake is installed:

```bash
# 1. Run the automated setup
npm run setup:bitnet

# 2. Download a model (from temp/bitnet-repo directory)
cd temp/bitnet-repo
python3 setup_env.py --hf-repo microsoft/BitNet-b1.58-2B-4T --quant-type i2_s

# 3. Test the integration
npm run test:bitnet
```

### Usage Example

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

// Load BitNet model
const model = await router.load({
  source: 'microsoft/BitNet-b1.58-2B-4T',
  type: 'bitnet',
  quantType: 'i2_s',
  threads: 4
});

// Generate text with 1-bit efficiency
const response = await router.generate('Explain AI', {
  modelId: model.id,
  maxTokens: 100
});
```

### Benefits
- **55-82% less energy** than traditional models
- **1.37x-6.17x faster** CPU inference
- **Run 100B models** on consumer hardware
- **Lossless quality** despite 1.58-bit quantization

### Troubleshooting

If you see "BitNet loader not available" warning:
1. Install CMake using the commands above
2. Run `npm run setup:bitnet`
3. Restart your application

For detailed documentation, see [docs/BITNET-INTEGRATION.md](docs/BITNET-INTEGRATION.md)