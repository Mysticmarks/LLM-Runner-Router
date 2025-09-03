# AGENTS.md - AI Assistant Guidelines

This file provides guidance for ANY AI assistant (Claude, GPT, Gemini, etc.) working with the LLM Runner Router project.

## Project Context

**LLM Runner Router** is a LIVE PRODUCTION PROJECT hosted on a VPS at https://llmrouter.dev:3006

- **Environment**: Virtual Private Server (VPS) with 4 vCPUs and 16GB RAM
- **Port**: 3006 ONLY (ports 3000-3001 are reserved for other projects)
- **Primary Model**: SmolLM3-3B loaded from `/models/smollm3-3b/`

## Core Guidelines for All AI Assistants

### 1. Production Environment Rules
- This is a LIVE production server, NOT a local development machine
- Always use `llmrouter.dev:3006`, NEVER localhost
- Changes affect real users immediately
- Test carefully before making modifications

### 2. Code Quality Standards
- NO mock data, fake implementations, or placeholders
- Everything must be 100% complete and production-ready
- Follow existing code patterns and conventions
- Use the existing libraries already in the project

### 3. File Management
- ALWAYS prefer editing existing files over creating new ones
- NEVER create documentation files unless explicitly requested
- Check if functionality already exists before adding new files
- Consolidate related code to reduce file sprawl

### 4. Development Workflow

#### Before Starting Work:
1. Review existing code structure
2. Check `package.json` for available dependencies
3. Look at neighboring files for coding patterns
4. Verify model files exist in `/models/smollm3-3b/`

#### During Development:
1. Use existing loaders and utilities
2. Follow the modular architecture pattern
3. Test changes incrementally
4. Monitor server resources (VPS has limited capacity)

#### After Changes:
1. Run linting: `npm run lint`
2. Run tests: `npm test`
3. Verify the server still starts: `npm start`
4. Commit and push to GitHub

## Architecture Overview

### Core Components
- **Router** (`src/core/Router.js`): Intelligent model selection
- **Registry** (`src/core/Registry.js`): Model lifecycle management
- **Pipeline** (`src/core/Pipeline.js`): Processing pipelines
- **Loaders** (`src/loaders/`): Format-specific model loaders

### Model Loading
- Primary loader: `SimpleSmolLM3Loader` for local safetensors
- Supports: GGUF, ONNX, Safetensors, HuggingFace formats
- Models stored in: `/models/` directory

### API Endpoints
- Chat: `POST /api/chat`
- Models: `GET /api/models`
- Health: `GET /health`

## Common Tasks

### Adding a New Model
1. Download model files to `/models/[model-name]/`
2. Create or use existing loader in `src/loaders/`
3. Register in `models/registry.json`
4. Test with `npm run test:model`

### Modifying Chat Interface
- Frontend: `public/chat/`
- Backend routes: `server.js`
- Templates: `src/templates/`

### Performance Optimization
- Use streaming for large responses
- Implement caching where appropriate
- Monitor memory usage (16GB limit)
- Consider model quantization for larger models

## Environment Variables

Key variables (see ENV_VARIABLES.md for complete list):
- `PORT=3006` - Server port
- `NODE_ENV=production` - Environment mode
- `AUTO_INIT=true` - Auto-initialize models
- `MODEL_CACHE_DIR=./models` - Model storage location

## Testing

```bash
npm test                 # Run all tests
npm run test:model       # Test model loading
npm run benchmark        # Performance benchmarking
```

## Deployment

The project uses PM2 for process management:
```bash
pm2 start ecosystem.config.cjs
pm2 logs llm-router
pm2 restart llm-router
```

## Security Considerations

- Never expose model files directly
- Validate all inputs before processing
- Monitor rate limits and resource usage
- Keep dependencies updated
- Never commit sensitive keys or tokens

## Getting Help

- Check existing implementations in `src/loaders/`
- Review test files in `tests/` for usage examples
- Look at `examples/` for integration patterns
- Consult architecture docs in `docs/`

## Important Reminders

- This is a VPS, not a local machine
- Port 3006 ONLY
- Production code only - no mocks or placeholders
- Test before deploying
- Push changes to GitHub
- Prefer editing over creating new files