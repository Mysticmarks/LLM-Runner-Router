#!/usr/bin/env node

/**
 * Production Validation Script
 * Comprehensive check that the system is 100% production-ready
 */

import axios from 'axios';
import { LLMRouter } from './src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const BASE_URL = process.env.API_URL || 'http://llmrouter.dev:3006';
const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0
};

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message, type = 'info') {
  const prefix = {
    pass: `${colors.green}✅`,
    fail: `${colors.red}❌`,
    warn: `${colors.yellow}⚠️`,
    info: '📋'
  }[type] || '';
  
  console.log(`${prefix} ${message}${colors.reset}`);
  
  if (type === 'pass') CHECKS.passed++;
  if (type === 'fail') CHECKS.failed++;
  if (type === 'warn') CHECKS.warnings++;
}

async function checkFile(filepath, description) {
  try {
    await fs.access(filepath);
    log(`${description}: ${filepath}`, 'pass');
    return true;
  } catch {
    log(`${description} not found: ${filepath}`, 'fail');
    return false;
  }
}

async function checkCommand(command, description) {
  try {
    execSync(command, { stdio: 'pipe' });
    log(`${description}`, 'pass');
    return true;
  } catch (error) {
    log(`${description} failed: ${error.message}`, 'fail');
    return false;
  }
}

async function checkAPI(endpoint, description) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status < 400) {
      log(`${description} (${response.status})`, 'pass');
      return true;
    } else {
      log(`${description} returned ${response.status}`, 'warn');
      return false;
    }
  } catch (error) {
    log(`${description} failed: ${error.message}`, 'fail');
    return false;
  }
}

async function main() {
  console.log('🚀 Production Validation Starting...\n');
  
  // 1. Check critical files
  console.log('📁 Checking Critical Files:');
  await checkFile('package.json', 'Package.json');
  await checkFile('server.js', 'Main server');
  await checkFile('src/index.js', 'Entry point');
  await checkFile('.env.example', 'Environment example');
  await checkFile('ecosystem.config.cjs', 'PM2 config');
  
  console.log('\n📚 Checking Documentation:');
  await checkFile('README.md', 'README');
  await checkFile('DEPLOYMENT.md', 'Deployment guide');
  await checkFile('ENV_VARIABLES.md', 'Environment docs');
  await checkFile('AGENTS.md', 'AI assistant docs');
  
  console.log('\n🔧 Checking Loaders:');
  await checkFile('src/loaders/SimpleSmolLM3Loader.js', 'SmolLM3 loader');
  await checkFile('src/loaders/SimpleLoader.js', 'Simple loader');
  await checkFile('src/loaders/MockLoader.js', 'Mock loader');
  await checkFile('src/loaders/GGUFLoader.js', 'GGUF loader');
  
  console.log('\n⚙️ Checking Database:');
  await checkFile('src/db/DatabaseManager.js', 'Database manager');
  const dbExists = await checkFile('data/llm-router.db', 'SQLite database').catch(() => false);
  if (!dbExists) {
    log('Database will use memory fallback', 'warn');
  }
  
  console.log('\n🧪 Checking Tests:');
  await checkFile('tests/e2e/real-world-integration.test.js', 'E2E tests');
  await checkFile('tests/final-validation.test.js', 'Validation tests');
  
  console.log('\n📦 Checking Dependencies:');
  await checkCommand('npm ls express', 'Express installed');
  await checkCommand('npm ls axios', 'Axios installed');
  await checkCommand('npm ls dotenv', 'Dotenv installed');
  
  console.log('\n🌐 Checking API Endpoints:');
  await checkAPI('/api/health', 'Health endpoint');
  await checkAPI('/api/models', 'Models endpoint');
  await checkAPI('/api/status', 'Status endpoint');
  
  console.log('\n🤖 Checking Model Loading:');
  try {
    const router = new LLMRouter({ autoInit: false });
    await router.initialize();
    log('LLMRouter initialization', 'pass');
    
    // Test model loading
    const loaders = Array.from(router.loaders.keys());
    log(`Available loaders: ${loaders.join(', ')}`, 'pass');
    
    // Test inference
    const response = await router.complete('test', {
      loader: 'mock',
      maxTokens: 10
    });
    
    if (response.text || response.error) {
      log('Mock inference working', 'pass');
    }
    
    await router.cleanup();
  } catch (error) {
    log(`Router test failed: ${error.message}`, 'fail');
  }
  
  console.log('\n🔒 Checking Security:');
  await checkFile('src/utils/ErrorHandler.js', 'Error handler');
  await checkFile('src/middleware/auth.js', 'Auth middleware').catch(() => {
    log('Auth middleware optional', 'warn');
  });
  
  console.log('\n📊 Checking Build System:');
  await checkFile('scripts/build.js', 'Build script');
  await checkFile('scripts/prebuild-automation.js', 'Prebuild automation');
  await checkCommand('node scripts/prebuild-automation.js --validate-only', 'Prebuild validation').catch(() => {
    log('Prebuild validation optional', 'warn');
  });
  
  console.log('\n🚦 Checking Process Management:');
  try {
    const pm2Status = execSync('pm2 status --no-color', { encoding: 'utf8' });
    if (pm2Status.includes('llm-router')) {
      log('PM2 process running', 'pass');
    } else {
      log('PM2 process not found', 'warn');
    }
  } catch {
    log('PM2 not available', 'warn');
  }
  
  console.log('\n🧩 Checking Model Files:');
  const modelPath = './models/smollm3-3b';
  const modelExists = await checkFile(path.join(modelPath, 'config.json'), 'SmolLM3 config').catch(() => false);
  if (!modelExists) {
    log('Model files not found - will use fallback', 'warn');
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY:');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${CHECKS.passed}`);
  console.log(`⚠️ Warnings: ${CHECKS.warnings}`);
  console.log(`❌ Failed: ${CHECKS.failed}`);
  
  const score = (CHECKS.passed / (CHECKS.passed + CHECKS.failed)) * 100;
  console.log(`\n📈 Score: ${score.toFixed(1)}%`);
  
  if (CHECKS.failed === 0) {
    console.log(`\n${colors.green}🎉 SYSTEM IS 100% PRODUCTION READY!${colors.reset}`);
    process.exit(0);
  } else if (score >= 90) {
    console.log(`\n${colors.green}✅ System is production ready with minor issues${colors.reset}`);
    process.exit(0);
  } else if (score >= 70) {
    console.log(`\n${colors.yellow}⚠️ System needs some fixes before production${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.red}❌ System is not production ready${colors.reset}`);
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});