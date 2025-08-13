# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
```bash
npm start                # Run the main application
npm run dev             # Development mode with nodemon
npm run build           # Build the project using scripts/build.js
npm test                # Run Jest test suite
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
npm run lint            # Lint source code with ESLint
npm run format          # Format code with Prettier
npm run benchmark       # Run performance benchmarks
npm run docs            # Generate JSDoc documentation
```

### Recommended Development Workflow

1. **Initial Setup**: Run `.claude/commands/dev-setup` to set up the complete development environment
2. **Development**: Use `npm run dev` for active development with auto-reload
3. **Testing**: Use `.claude/commands/test-model` to verify model functionality during development
4. **Performance**: Use `.claude/commands/run-benchmarks` to validate performance changes
5. **Analysis**: Use `.claude/commands/analyze-models` to monitor model registry and cache

### Single Test Execution
```bash
npm test -- --testNamePattern="test name"
npm test -- path/to/specific/test.js
```

### Custom Claude Code Commands

Project-specific commands available in `.claude/commands/`:

```bash
./.claude/commands/dev-setup        # Complete development environment setup
./.claude/commands/test-model       # Quick test of model loading and inference
./.claude/commands/run-benchmarks   # Comprehensive performance benchmarking
./.claude/commands/analyze-models   # Analyze models, cache usage, and metrics
```

These commands provide specialized workflows for LLM orchestration development including model testing, performance analysis, and environment setup.

## Architecture Overview

This is a **Universal LLM Model Orchestration System** that provides format-agnostic model loading and intelligent routing. The system is designed with a modular architecture for maximum flexibility and performance.

### Core Components

- **Router** (`src/core/Router.js`): Intelligent model selection with strategies (quality-first, cost-optimized, speed-priority, balanced, etc.)
- **Registry** (`src/core/Registry.js`): Model registry and lifecycle management
- **Pipeline** (`src/core/Pipeline.js`): Processing pipelines for inference
- **Loaders** (`src/loaders/`): Format-specific loaders for GGUF, ONNX, Safetensors, HuggingFace, etc.
- **Engines** (`src/engines/`): Runtime engines (WebGPU, WASM, Node.js native)

### Key Patterns

1. **Auto-initialization**: The main LLMRouter class auto-initializes on import unless `AUTO_INIT=false`
2. **Environment Detection**: Automatically detects browser/Node.js/Deno/Worker environments
3. **Strategy-based Routing**: Configurable routing strategies for model selection
4. **Fallback Chains**: Automatic fallback to alternative models on failure
5. **Streaming Support**: Real-time token generation with async generators
6. **Model Ensemble**: Weighted combination of multiple model outputs

### Configuration

The system uses a configuration object pattern throughout:
- `src/config/Config.js` - Main configuration management
- Environment-based engine selection
- Strategy-configurable routing (balanced, quality-first, cost-optimized, etc.)

### Entry Points

- `src/index.js` - Main entry point and LLMRouter class
- Default instance automatically created for convenience methods
- Export both class and convenience functions for flexible usage

### Model Support

- **Formats**: GGUF, ONNX, Safetensors, HuggingFace, TensorFlow.js, PyTorch
- **Sources**: Local files, HuggingFace Hub, custom URLs
- **Auto-detection**: Format detection from file extensions and source patterns

### Performance Features

- Route caching with configurable TTL
- Model score precomputation
- Load balancing strategies
- Memory-mapped model loading
- Streaming token generation

## Claude Code Integration

### Automated Hooks

The project includes specialized hooks in `.claude/hooks/` that automatically run during Claude Code operations:

- **`pre-edit`**: Provides warnings and context when editing critical architecture files (Router.js, Registry.js, etc.)
- **`post-edit`**: Auto-runs ESLint, executes relevant tests, and suggests documentation updates
- **`pre-bash`**: Safety checks for destructive commands and resource monitoring for model downloads
- **`post-bash`**: Intelligent error handling with specific guidance and next-step suggestions

### Development Workflow Integration

1. **Setup**: Use `.claude/commands/dev-setup` for complete environment initialization
2. **Model Testing**: Use `.claude/commands/test-model` to verify model loading and inference
3. **Performance Analysis**: Use `.claude/commands/run-benchmarks` for comprehensive benchmarking
4. **Model Management**: Use `.claude/commands/analyze-models` for cache and performance insights

### Safety Features

- Automatic backup of critical files (package.json, package-lock.json)
- Warnings when editing core architecture components
- Resource monitoring for model downloads (can be several GB)
- Command history logging in `.claude/command-history.log`

### Key Files for Claude Code

When working with this codebase, pay special attention to:
- `src/index.js` - Main entry point with auto-initialization
- `src/core/Router.js` - Core routing logic and strategies
- `src/core/Registry.js` - Model registry management
- `src/core/Pipeline.js` - Processing pipeline
- `package.json` - Dependencies and scripts