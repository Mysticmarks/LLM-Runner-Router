#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, cpSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

console.log(`Building ${packageJson.name} v${packageJson.version}...`);

try {
  console.log('🏗️ Starting production build process...');
  const start = Date.now();

  // Run tests first (critical for production)
  console.log('🧪 Running test suite...');
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ All tests passed');

  // Run linting
  console.log('🔍 Running ESLint...');
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ ESLint passed');
  
  // Format code
  console.log('✨ Formatting code...');
  try {
    execSync('npm run format', { stdio: 'inherit' });
    console.log('✅ Code formatted');
  } catch (formatError) {
    console.warn('⚠️ Code formatting failed, continuing...');
  }
  
  // Create dist directory structure
  console.log('📦 Creating distribution files...');
  mkdirSync('dist', { recursive: true });
  mkdirSync('dist/src', { recursive: true });
  mkdirSync('dist/data', { recursive: true });
  mkdirSync('dist/migrations', { recursive: true });
  
  // Copy source code
  cpSync('src', 'dist/src', { recursive: true });
  console.log('✅ Source code copied');
  
  // Copy public files (web interface)
  if (existsSync('public')) {
    cpSync('public', 'dist/public', { recursive: true });
    console.log('✅ Public web files copied');
  }
  
  // Copy migrations
  if (existsSync('migrations')) {
    cpSync('migrations', 'dist/migrations', { recursive: true });
    console.log('✅ Database migrations copied');
  }
  
  // Copy configuration and docs
  const filesToCopy = [
    'README.md', 'package.json', 'package-lock.json',
    'server.js', '.env.example'
  ];
  
  for (const file of filesToCopy) {
    if (existsSync(file)) {
      cpSync(file, `dist/${file}`);
    }
  }
  
  // Create production package.json
  const prodPackageJson = {
    ...packageJson,
    scripts: {
      start: 'node server.js',
      test: 'node --experimental-vm-modules node_modules/.bin/jest',
      'migrate:up': 'node -e "import(\'./src/db/DatabaseManager.js\').then(({getDatabase})=>getDatabase().runMigrations())"',
      'db:health': 'node -e "import(\'./src/db/DatabaseManager.js\').then(({getDatabase})=>getDatabase().healthCheck().then(console.log))"'
    },
    devDependencies: undefined // Remove dev dependencies for production
  };
  
  writeFileSync('dist/package.json', JSON.stringify(prodPackageJson, null, 2));
  console.log('✅ Production package.json created');
  
  // Create production README
  const prodReadme = `# ${packageJson.name} - Production Build

🚀 **Production-ready deployment of the Universal LLM Router**

## Quick Start
\`\`\`bash
npm install --production
npm start
\`\`\`

## Environment Setup
Copy .env.example to .env and configure:
- Database settings (DB_TYPE, DB_HOST, etc.)
- JWT_SECRET and SESSION_SECRET
- API keys for external providers

## Health Check
\`\`\`bash
npm run db:health
\`\`\`

Built on: ${new Date().toISOString()}
Version: ${packageJson.version}
`;
  
  writeFileSync('dist/README-PRODUCTION.md', prodReadme);
  console.log('✅ Production README created');
  
  // Generate build manifest
  const buildManifest = {
    name: packageJson.name,
    version: packageJson.version,
    buildTime: new Date().toISOString(),
    nodeVersion: process.version,
    environment: 'production',
    features: {
      database: true,
      errorHandling: true,
      gracefulFallbacks: true,
      multipleLoaders: true,
      secureAuth: true
    }
  };
  
  writeFileSync('dist/build-manifest.json', JSON.stringify(buildManifest, null, 2));
  
  console.log('✅ Build completed successfully!');
  console.log('🎯 Project is ready for production deployment!');
  console.log('📁 Distribution files created in ./dist directory');
  console.log('🔧 Run "cd dist && npm install --production && npm start"');
  console.log(`📊 Build completed in ${Date.now() - start} ms`);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}