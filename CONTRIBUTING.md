# Contributing to LLM-Runner-Router

Thank you for your interest in contributing to LLM-Runner-Router! This document provides guidelines and instructions for contributing to the project.

## Quick References

- **AI Assistants**: See [AGENTS.md](AGENTS.md) for AI-specific guidelines
- **Claude Users**: See [CLAUDE.md](CLAUDE.md) for Claude-specific instructions  
- **Environment Setup**: See [ENV_VARIABLES.md](ENV_VARIABLES.md) for configuration
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment guidance

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inspiring community for all. Contributors are expected to:
- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Git
- Basic understanding of LLM model formats and inference
- Familiarity with TypeScript/JavaScript

### First Time Contributors
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/LLM-Runner-Router.git`
3. Add upstream remote: `git remote add upstream https://github.com/ORIGINAL-OWNER/LLM-Runner-Router.git`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Quick Setup
```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/LLM-Runner-Router.git
cd LLM-Runner-Router

# Install dependencies
npm install

# Run development mode
npm run dev

# Run tests
npm test

# Build the project
npm run build
```

### Claude Code Integration
If using Claude Code, use the provided commands:
```bash
./.claude/commands/dev-setup        # Complete development environment setup
./.claude/commands/test-model       # Test model loading and inference
./.claude/commands/run-benchmarks   # Run performance benchmarks
./.claude/commands/analyze-models   # Analyze model registry
```

## How to Contribute

### Types of Contributions

#### 1. Bug Reports
- Use the GitHub Issues template
- Include reproduction steps
- Provide system information (OS, Node version, etc.)
- Include error messages and stack traces
- Add labels: `bug`, `needs-triage`

#### 2. Feature Requests
- Check existing issues first
- Describe the use case clearly
- Explain why existing features don't solve the problem
- Add label: `enhancement`

#### 3. Code Contributions

##### New Model Loaders
1. Create loader in `src/loaders/`
2. Extend `BaseLoader` class
3. Implement required methods: `canHandle()`, `load()`, `unload()`
4. Add tests in `tests/loaders/`
5. Update `MODEL_FORMATS.md` documentation

##### New Engines
1. Create engine in `src/engines/`
2. Extend `BaseEngine` class
3. Implement inference methods
4. Add performance benchmarks
5. Update `ARCHITECTURE.md`

##### Bug Fixes
1. Write a failing test first
2. Fix the bug
3. Ensure all tests pass
4. Update relevant documentation

##### Performance Improvements
1. Benchmark current performance
2. Implement optimization
3. Benchmark improved performance
4. Document results in PR

## Coding Standards

### JavaScript/TypeScript Style Guide

#### General Rules
- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable names
- Keep functions small and focused
- Add JSDoc comments for all public APIs

#### Code Style
```javascript
// Good
class ModelLoader {
  /**
   * Load a model from the specified source
   * @param {string} source - Model source path or URL
   * @returns {Promise<Model>} Loaded model instance
   * @example
   * const loader = new ModelLoader();
   * const model = await loader.load('models/llama.gguf');
   */
  async load(source) {
    // Implementation
  }
}

// Bad
class ml {
  async l(s) {
    // No documentation, unclear naming
  }
}
```

#### File Organization
```
src/
├── core/           # Core system components
├── loaders/        # Model format loaders
├── engines/        # Compute engines
├── api/           # API layer
├── utils/         # Utility functions
└── index.js       # Main entry point
```

### Commit Message Convention

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

Examples:
```bash
feat(loader): add support for ONNX models
fix(router): correct model selection logic for cost strategy
docs(api): update REST API documentation
perf(engine): optimize WebGPU memory allocation
```

## Testing Requirements

### Test Coverage
- Minimum 80% code coverage for new features
- 100% coverage for critical path code
- All bug fixes must include regression tests

### Test Structure
```javascript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.value).toBe('expected');
    });

    it('should handle error case', async () => {
      // Test error handling
    });
  });
});
```

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm test -- --testNamePattern="Router"  # Run specific tests
```

## Documentation

### Documentation Requirements
- All public APIs must have JSDoc comments
- Include at least one @example for complex methods
- Update relevant .md files when changing functionality
- Add entries to CHANGELOG.md for notable changes

### JSDoc Template
```javascript
/**
 * Brief description of the function
 * 
 * Detailed description if needed, explaining complex behavior,
 * edge cases, or important notes.
 * 
 * @param {Type} paramName - Description of parameter
 * @param {Object} options - Configuration options
 * @param {boolean} [options.flag=false] - Optional flag description
 * @returns {Promise<ReturnType>} Description of return value
 * @throws {ErrorType} Description of when this error is thrown
 * 
 * @example
 * // Basic usage
 * const result = await function(param, { flag: true });
 * console.log(result);
 * 
 * @example
 * // Advanced usage with error handling
 * try {
 *   const result = await function(param);
 *   process(result);
 * } catch (error) {
 *   handleError(error);
 * }
 */
```

## Pull Request Process

### Before Submitting
1. **Update your fork**: `git pull upstream main`
2. **Run tests**: `npm test`
3. **Run linter**: `npm run lint`
4. **Build project**: `npm run build`
5. **Update documentation** if needed
6. **Add tests** for new functionality
7. **Update CHANGELOG.md** with your changes

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] All tests pass locally
- [ ] Added new tests for changes
- [ ] Coverage remains above 80%

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] CHANGELOG.md updated
```

### Review Process
1. Automated checks must pass (tests, linting, build)
2. At least one maintainer review required
3. All review comments must be addressed
4. Branch must be up to date with main
5. Squash and merge preferred for clean history

## Release Process

### Version Numbering
We follow Semantic Versioning (SemVer):
- MAJOR: Breaking API changes
- MINOR: New features, backwards compatible
- PATCH: Bug fixes, backwards compatible

### Release Steps
1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create git tag: `git tag -a v1.2.3 -m "Release version 1.2.3"`
4. Push tag: `git push upstream v1.2.3`
5. GitHub Actions will handle npm publishing

## Getting Help

### Resources
- [Documentation](./docs/README.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Architecture Guide](./docs/ARCHITECTURE.md)
- [GitHub Issues](https://github.com/OWNER/LLM-Runner-Router/issues)

### Contact
- Open an issue for bugs or features
- Join discussions in GitHub Discussions
- Tag maintainers for urgent issues: @maintainer-username

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for their specific contributions
- GitHub contributors page
- Special thanks section in releases for significant contributions

Thank you for contributing to LLM-Runner-Router! Your efforts help make AI model orchestration accessible to everyone.