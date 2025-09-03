# Scripts Directory

This directory contains utility scripts for building, deploying, and maintaining the LLM Runner Router.

## Active Scripts

### Build & Development
- `build.js` - Main build script for compiling the project
- `prebuild-automation.js` - Pre-build preparation and validation
- `build-all-bindings.sh` - Build native bindings for all platforms
- `test-all-bindings.sh` - Test native bindings across platforms

### Deployment
- `deploy.js` - JavaScript deployment orchestrator
- `deploy-saas.sh` - SaaS deployment script for production
- `deploy.sh` - General deployment script

### Monitoring & Recovery
- `monitor-health.sh` - Health monitoring script
- `monitor.sh` - General system monitoring
- `recovery.sh` - Full recovery procedures
- `simple-recovery.sh` - Quick recovery script
- `autonomous-update.sh` - Automated update system

### Security & Setup
- `security-setup.sh` - Configure security settings
- `setup-self-healing.sh` - Configure self-healing features
- `setup-startup.sh` - Setup startup procedures
- `setup-bitnet.js` - BitNet model configuration

### Code Quality
- `safe-eslint-autofix.js` - Safe ESLint auto-fixing
- `fix-safe-eslint.js` - Fix ESLint issues safely
- `tier1-eslint-fixes.js` - Priority ESLint fixes

### Utilities
- `env-manager.sh` - Environment variable management

## Usage Examples

### Building the Project
```bash
node scripts/build.js
```

### Deploying to Production
```bash
./scripts/deploy-saas.sh
```

### Setting Up Monitoring
```bash
./scripts/monitor-health.sh &
```

### Recovery Procedures
```bash
# Quick recovery
./scripts/simple-recovery.sh

# Full recovery
./scripts/recovery.sh
```

## Script Conventions

1. **Shell Scripts (.sh)**
   - Must be executable: `chmod +x script.sh`
   - Include shebang: `#!/bin/bash`
   - Use error handling: `set -e`

2. **Node Scripts (.js)**
   - Use ES modules
   - Include proper error handling
   - Log actions clearly

3. **Naming**
   - Use descriptive names
   - Separate words with hyphens
   - Group related scripts by prefix

## Adding New Scripts

When adding a new script:
1. Document its purpose in this README
2. Include usage examples
3. Add error handling
4. Make shell scripts executable
5. Test thoroughly before committing

## Deprecated Scripts

Scripts that are no longer actively used have been moved to `backup/scripts/`. Do not use these unless specifically needed for legacy support.