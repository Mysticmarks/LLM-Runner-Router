# Contributing to LLM Runner Router

Thank you for your interest in contributing to LLM Runner Router! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit your changes: `git commit -m "feat: add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a Pull Request

## 📋 Development Setup

### Prerequisites
- Node.js 18+ (recommended: Node.js 20+)
- npm or yarn package manager
- Git
- Docker (optional, for container testing)

### Local Development
```bash
# Clone your fork
git clone https://github.com/yourusername/LLM-Runner-Router.git
cd LLM-Runner-Router

# Install dependencies
npm ci

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run linting
npm run lint

# Format code
npm run format

# Build project
npm run build
```

### Custom Commands
The project includes specialized commands for LLM orchestration development:

```bash
# Development environment setup
./.claude/commands/dev-setup

# Test model loading and inference
./.claude/commands/test-model

# Run performance benchmarks
./.claude/commands/run-benchmarks

# Analyze models and cache usage
./.claude/commands/analyze-models
```

## 🔐 Secrets and Environment Configuration

### Required Secrets for CI/CD

The following secrets must be configured in the GitHub repository settings for the CI/CD pipeline to function properly:

#### Core Secrets
| Secret Name | Purpose | Required For | How to Obtain |
|-------------|---------|--------------|---------------|
| `CODECOV_TOKEN` | Upload test coverage reports | CI workflow | [Codecov.io](https://codecov.io) dashboard |
| `NPM_TOKEN` | Publish packages to NPM registry | CD workflow | [NPM Access Tokens](https://www.npmjs.com/settings/tokens) |

#### Optional Secrets
| Secret Name | Purpose | Required For | How to Obtain |
|-------------|---------|--------------|---------------|
| `NETLIFY_AUTH_TOKEN` | Deploy documentation to Netlify | CD workflow (optional) | [Netlify User Settings](https://app.netlify.com/user/applications) |
| `NETLIFY_SITE_ID` | Netlify site identifier | CD workflow (optional) | Netlify site settings |
| `GITLEAKS_LICENSE` | Enhanced GitLeaks scanning | Security workflow (optional) | [GitLeaks Pro](https://gitleaks.io) |

### Setting Up Secrets

#### 1. Codecov Token
1. Visit [Codecov.io](https://codecov.io)
2. Sign in with your GitHub account
3. Add your repository
4. Copy the upload token
5. Add as `CODECOV_TOKEN` in GitHub repository secrets

#### 2. NPM Token
1. Log in to [NPM](https://www.npmjs.com)
2. Go to Access Tokens in your account settings
3. Create a new "Automation" token
4. Copy the token (starts with `npm_`)
5. Add as `NPM_TOKEN` in GitHub repository secrets

#### 3. Netlify Configuration (Optional)
1. Log in to [Netlify](https://netlify.com)
2. Go to User Settings > Applications
3. Create a new Personal Access Token
4. Add as `NETLIFY_AUTH_TOKEN` in GitHub repository secrets
5. Get your site ID from the site settings and add as `NETLIFY_SITE_ID`

### Environment Variables

For local development, create a `.env` file in the root directory:

```bash
# .env (do not commit this file)
NODE_ENV=development
PORT=3000
WS_PORT=8080
MAX_MEMORY=4096
ROUTING_STRATEGY=balanced
CACHE_ENABLED=true
LOG_LEVEL=debug

# Optional: Model configuration
MODEL_CACHE_DIR=./models/cache
DEFAULT_MODEL=tinyllama
```

### Security Best Practices

1. **Never commit secrets**: Always use `.env` files or environment variables
2. **Use least privilege**: Only grant necessary permissions to tokens
3. **Rotate tokens regularly**: Update tokens periodically for security
4. **Monitor access**: Review token usage in respective dashboards
5. **Use environment-specific tokens**: Different tokens for development/staging/production

## 🧪 Testing Guidelines

### Test Structure
```
tests/
├── basic.test.js          # Basic functionality tests
├── integration/           # Integration tests
│   ├── loaders.test.js   # Model loader tests
│   ├── runtime.test.js   # Runtime environment tests
│   └── simple-runtime.test.js
└── e2e/                  # End-to-end tests
    └── api.test.js       # API endpoint tests
```

### Writing Tests
- Use Jest testing framework
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test both success and error cases
- Include performance tests for critical paths

Example test:
```javascript
describe('Router', () => {
  test('should select best model for query', async () => {
    // Arrange
    const router = new Router();
    const query = 'Hello world';
    
    // Act
    const result = await router.route(query);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.modelId).toBeTruthy();
  });
});
```

### Performance Testing
```bash
# Run benchmarks
npm run benchmark

# Monitor performance during development
./.claude/commands/run-benchmarks
```

## 📝 Code Style and Standards

### ESLint Configuration
The project uses ESLint with custom rules. Run linting with:
```bash
npm run lint
```

### Coding Standards
- Use ES6+ features and modules
- Follow functional programming principles where possible
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Use async/await over promises where appropriate

### Commit Message Format
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Examples:
- feat(router): add quality-first routing strategy
- fix(loader): handle GGUF loading errors gracefully
- docs(readme): update installation instructions
```

## 🏗️ Architecture Guidelines

### Core Components
- **Router**: Intelligent model selection and routing
- **Registry**: Model registry and lifecycle management
- **Pipeline**: Processing pipelines for inference
- **Loaders**: Format-specific model loaders
- **Engines**: Runtime engines (WebGPU, WASM, Node.js)

### Design Principles
1. **Format Agnostic**: Support multiple model formats
2. **Engine Flexible**: Work across different runtime environments
3. **Strategy Configurable**: Multiple routing strategies
4. **Performance Focused**: Optimize for speed and memory usage
5. **Error Resilient**: Graceful degradation and fallbacks

### Adding New Features

#### 1. Model Loaders
```javascript
// src/loaders/YourLoader.js
import BaseLoader from './BaseLoader.js';

export default class YourLoader extends BaseLoader {
  async load(modelPath, options = {}) {
    // Implement loading logic
  }
  
  async infer(input, options = {}) {
    // Implement inference logic
  }
}
```

#### 2. Routing Strategies
```javascript
// src/core/Router.js - Add to strategies
const strategies = {
  'your-strategy': (models, query, context) => {
    // Implement strategy logic
    return selectedModel;
  }
};
```

#### 3. Runtime Engines
```javascript
// src/engines/YourEngine.js
export default class YourEngine {
  static isSupported() {
    // Check if engine is supported in current environment
  }
  
  async initialize() {
    // Initialize engine
  }
  
  async execute(model, input) {
    // Execute inference
  }
}
```

## 🔄 CI/CD Pipeline

### Workflow Overview
1. **CI (Continuous Integration)**: Triggered on push/PR
   - Multi-platform testing (Ubuntu, Windows, macOS)
   - Node.js matrix testing (18.x, 20.x, 22.x)
   - Linting and code quality checks
   - Security scanning
   - Performance benchmarks

2. **CD (Continuous Deployment)**: Triggered on version tags
   - Full test suite validation
   - Docker image building and publishing
   - NPM package publishing
   - GitHub release creation
   - Documentation deployment

3. **Security**: Daily scheduled scans + PR checks
   - Dependency vulnerability scanning
   - Secret detection
   - CodeQL static analysis
   - Container security scanning
   - License compliance checking

### Release Process
1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create and push version tag: `git tag v1.2.2 && git push origin v1.2.2`
4. GitHub Actions will automatically:
   - Run full test suite
   - Build and push Docker images
   - Publish to NPM
   - Create GitHub release
   - Deploy documentation

## 🐛 Bug Reports

When reporting bugs, please include:
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant error messages
- Minimal code example

Use the issue template when creating bug reports.

## 💡 Feature Requests

For feature requests:
- Describe the use case
- Explain the expected behavior
- Consider implementation complexity
- Check if similar features exist

## 📚 Documentation

### JSDoc Comments
```javascript
/**
 * Routes a query to the best available model
 * @param {string} query - The input query
 * @param {Object} options - Routing options
 * @param {string} [options.strategy='balanced'] - Routing strategy
 * @returns {Promise<Object>} Model and inference result
 * @throws {Error} When no suitable model is found
 */
async route(query, options = {}) {
  // Implementation
}
```

### README Updates
When adding features, update:
- Installation instructions
- Usage examples
- API documentation
- Configuration options

## 🤝 Community

- Join discussions in GitHub Issues
- Follow coding standards
- Be respectful and inclusive
- Help review pull requests
- Share knowledge and best practices

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🆘 Getting Help

- Check existing issues and documentation
- Use GitHub Discussions for questions
- Include relevant details when asking for help
- Be patient and respectful

Thank you for contributing to LLM Runner Router! 🚀