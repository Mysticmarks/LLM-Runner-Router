#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, cpSync, mkdirSync } from 'fs';
import path from 'path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

console.log(`Building ${packageJson.name} v${packageJson.version}...`);

try {
  // Run linting
  console.log('Running ESLint...');
  execSync('npm run lint', { stdio: 'inherit' });
  
  // Create dist directory and copy public files
  console.log('Creating distribution files...');
  mkdirSync('dist', { recursive: true });
  cpSync('public', 'dist', { recursive: true });
  
  // Copy important files to dist
  cpSync('README.md', 'dist/README.md');
  cpSync('package.json', 'dist/package.json');
  
  console.log('✅ Build completed successfully!');
  console.log('Project is ready for production use.');
  console.log('Distribution files created in ./dist directory');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}