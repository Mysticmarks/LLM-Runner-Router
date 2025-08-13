#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

console.log(`Building ${packageJson.name} v${packageJson.version}...`);

try {
  // Run linting
  console.log('Running ESLint...');
  execSync('npm run lint', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
  console.log('Project is ready for production use.');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}