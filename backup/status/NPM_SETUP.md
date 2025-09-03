# NPM Package Setup Guide

## ✅ Package Successfully Published!

Your NPM package `llm-runner-router` is now live at:
**https://www.npmjs.com/package/llm-runner-router**

## 📦 Installation

```bash
npm install llm-runner-router
```

## 🚀 Current Package Status

- **Package Name**: `llm-runner-router`
- **Version**: `1.0.0`  
- **Size**: 24.7 kB (packed), 85.7 kB (unpacked)
- **Access**: Public
- **License**: MIT

## 🔧 NPM Configuration

### Local NPM Authentication
Your NPM authentication is configured with your personal NPM token.

**Authenticated as**: `mikecerqua`

### Package.json Configuration
- ✅ Repository URLs corrected
- ✅ Publishing configuration set to public
- ✅ Build scripts configured
- ✅ Pre-publish hooks enabled (lint, test, build)

## 🤖 Automated Publishing Setup

### GitHub Actions Integration
Your repository has automated publishing configured:

1. **Release Workflow**: Publishes to NPM when you create a version tag
2. **CI/CD Pipeline**: Runs tests and builds on every push

### Setting up GitHub Secrets

**IMPORTANT**: You need to add your NPM token as a GitHub secret for automated publishing:

1. Go to your GitHub repository: https://github.com/MCERQUA/LLM-Runner-Router
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: `[Your NPM Token Here]`
6. Click **Add secret**

## 📋 Publishing Workflow

### Manual Publishing
```bash
# Current version
npm publish

# Specific version
npm version patch  # 1.0.1
npm version minor  # 1.1.0  
npm version major  # 2.0.0
npm publish
```

### Automated Publishing via GitHub
1. Create a version tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
2. GitHub Actions will automatically:
   - Run tests
   - Build the package  
   - Create GitHub release
   - Publish to NPM

## 🛡️ Pre-Publish Checks

Before each publish, the following checks run automatically:
- ✅ ESLint code quality checks
- ✅ Jest test suite  
- ✅ Build process verification

## 📊 Package Contents

The published package includes:
- `src/` - Complete source code
- `README.md` - Documentation
- `LICENSE` - MIT license
- `package.json` - Package configuration

## 🔗 Quick Links

- **NPM Package**: https://www.npmjs.com/package/llm-runner-router
- **GitHub Repository**: https://github.com/MCERQUA/LLM-Runner-Router
- **Live Demo**: Your Netlify deployment URL

## 📈 Next Steps

1. **Add NPM token to GitHub secrets** (see above)
2. **Test installation**: `npm install llm-runner-router`
3. **Create first update**: Make changes and version bump
4. **Monitor downloads**: Check NPM analytics

## 🎯 Usage Examples

```javascript
// Install the package
// npm install llm-runner-router

// Simple usage
import { quick } from 'llm-runner-router';
const response = await quick("Hello world");

// Advanced usage  
import LLMRouter from 'llm-runner-router';
const router = new LLMRouter({
  strategy: 'quality-first'
});
```

## 📝 Notes

- Package is set to **public access**
- Compatible with **Node.js 18+**
- Uses **ES modules** (type: "module")
- Includes **TypeScript definitions** support