#!/usr/bin/env node

/**
 * Automated Prebuilt Distribution System
 * Automatically builds and packages the LLM Router for distribution
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class PreBuildAutomation {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || 'dist',
      includeTests: options.includeTests || false,
      includeDocs: options.includeDocs || true,
      minify: options.minify || true,
      generateMaps: options.generateMaps || false,
      verbose: options.verbose || false,
      ...options
    };

    this.buildInfo = {
      version: null,
      buildTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      gitCommit: null,
      gitBranch: null
    };
  }

  /**
   * Main build process
   */
  async build() {
    try {
      console.log('🚀 Starting automated prebuild process...');
      
      await this.validateEnvironment();
      await this.collectBuildInfo();
      await this.cleanOutputDirectory();
      await this.createOutputDirectories();
      await this.copySourceFiles();
      await this.processFiles();
      await this.generateBuildManifest();
      await this.runQualityChecks();
      await this.packageDistribution();
      
      console.log('✅ Prebuild automation completed successfully!');
      console.log(`📦 Output: ${path.resolve(rootDir, this.options.outputDir)}`);
      
    } catch (error) {
      console.error('❌ Prebuild failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate build environment
   */
  async validateEnvironment() {
    console.log('🔍 Validating build environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }

    // Check for required dependencies
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    this.buildInfo.version = packageJson.version;

    // Verify source directory exists
    const srcPath = path.join(rootDir, 'src');
    try {
      await fs.access(srcPath);
    } catch (error) {
      throw new Error('Source directory not found');
    }

    if (this.options.verbose) {
      console.log('✅ Environment validation passed');
    }
  }

  /**
   * Collect build information from git and environment
   */
  async collectBuildInfo() {
    try {
      // Get git information
      this.buildInfo.gitCommit = execSync('git rev-parse HEAD', { 
        encoding: 'utf8', 
        cwd: rootDir 
      }).trim();
      
      this.buildInfo.gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { 
        encoding: 'utf8', 
        cwd: rootDir 
      }).trim();
      
    } catch (error) {
      console.warn('⚠️ Could not collect git information:', error.message);
    }

    if (this.options.verbose) {
      console.log('📋 Build info collected:', this.buildInfo);
    }
  }

  /**
   * Clean and prepare output directory
   */
  async cleanOutputDirectory() {
    const outputPath = path.join(rootDir, this.options.outputDir);
    
    try {
      await fs.rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
    
    if (this.options.verbose) {
      console.log(`🧹 Cleaned output directory: ${outputPath}`);
    }
  }

  /**
   * Create output directories
   */
  async createOutputDirectories() {
    const outputPath = path.join(rootDir, this.options.outputDir);
    const dirs = [
      outputPath,
      path.join(outputPath, 'src'),
      path.join(outputPath, 'bin'),
      path.join(outputPath, 'migrations'),
      path.join(outputPath, 'logs')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    if (this.options.verbose) {
      console.log(`📁 Created output directories`);
    }
  }

  /**
   * Copy source files to output directory
   */
  async copySourceFiles() {
    console.log('📁 Copying source files...');
    
    const filesToCopy = [
      'src',
      'package.json',
      'README.md',
      'LICENSE',
      '.env.example',
      'migrations'
    ];

    for (const file of filesToCopy) {
      const sourcePath = path.join(rootDir, file);
      const destPath = path.join(rootDir, this.options.outputDir, file);

      try {
        const stat = await fs.stat(sourcePath);
        
        if (stat.isDirectory()) {
          await this.copyDirectory(sourcePath, destPath);
        } else {
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
        }
        
        if (this.options.verbose) {
          console.log(`✅ Copied: ${file}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not copy ${file}:`, error.message);
      }
    }
  }

  /**
   * Recursively copy directory
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Process files for distribution
   */
  async processFiles() {
    console.log('⚙️ Processing files for distribution...');
    
    // Update package.json for distribution
    await this.updatePackageJson();
    
    // Create environment file
    await this.createDistributionEnv();
    
    // Generate entry point file
    await this.generateEntryPoint();
  }

  /**
   * Update package.json for distribution
   */
  async updatePackageJson() {
    const packageJsonPath = path.join(rootDir, this.options.outputDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    // Remove dev dependencies for production distribution
    delete packageJson.devDependencies;
    
    // Add build information
    packageJson.buildInfo = this.buildInfo;
    packageJson.distribution = {
      type: 'prebuilt',
      buildDate: this.buildInfo.buildTime,
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.version
    };
    
    // Ensure proper main entry point
    packageJson.main = 'src/index.js';
    packageJson.bin = {
      'llm-router': './bin/llm-router.js'
    };
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    if (this.options.verbose) {
      console.log('✅ Updated package.json for distribution');
    }
  }

  /**
   * Create distribution environment file
   */
  async createDistributionEnv() {
    const envContent = `# LLM Router Production Environment
# Generated: ${this.buildInfo.buildTime}

# Database Configuration
DB_TYPE=memory
DB_HOST=localhost
DB_PORT=5432
DB_NAME=llm_router
DB_USER=postgres
# DB_PASS=your_password_here

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Application Settings
NODE_ENV=production
PORT=3006
LOG_LEVEL=info

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
API_RATE_LIMIT=100
SESSION_SECRET=your-session-secret-change-this

# Model Configuration
DEFAULT_STRATEGY=balanced
ENABLE_CACHE=true
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000

# Enterprise Features (Optional)
ENABLE_ENTERPRISE=false
ENABLE_MULTI_TENANCY=false
ENABLE_AB_TESTING=false
ENABLE_SLA_MONITORING=false
`;

    const envPath = path.join(rootDir, this.options.outputDir, '.env.example');
    await fs.writeFile(envPath, envContent);
    
    if (this.options.verbose) {
      console.log('✅ Created distribution environment file');
    }
  }

  /**
   * Generate CLI entry point
   */
  async generateEntryPoint() {
    const binDir = path.join(rootDir, this.options.outputDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    
    const cliContent = `#!/usr/bin/env node

/**
 * LLM Router CLI Entry Point
 * Built: ${this.buildInfo.buildTime}
 * Version: ${this.buildInfo.version}
 */

import { LLMRouter } from '../src/index.js';
import { Logger } from '../src/utils/Logger.js';

const logger = new Logger('CLI');

async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'start':
        await startServer();
        break;
      case 'health':
        await checkHealth();
        break;
      case 'version':
        console.log('${this.buildInfo.version}');
        break;
      case 'info':
        await showInfo();
        break;
      default:
        showHelp();
    }
  } catch (error) {
    logger.error('CLI Error:', error.message);
    process.exit(1);
  }
}

async function startServer() {
  logger.info('🚀 Starting LLM Router...');
  
  const router = new LLMRouter();
  await router.initialize();
  
  logger.info('✅ LLM Router is ready');
  
  // Keep process alive
  process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down...');
    await router.cleanup();
    process.exit(0);
  });
}

async function checkHealth() {
  const router = new LLMRouter();
  await router.initialize();
  
  const health = await router.healthCheck();
  console.log(JSON.stringify(health, null, 2));
  
  await router.cleanup();
  process.exit(health.status === 'healthy' ? 0 : 1);
}

async function showInfo() {
  console.log('LLM Router Distribution Info:');
  console.log('Version:', '${this.buildInfo.version}');
  console.log('Built:', '${this.buildInfo.buildTime}');
  console.log('Node Version:', '${this.buildInfo.nodeVersion}');
  console.log('Platform:', '${this.buildInfo.platform}-${this.buildInfo.arch}');
  
  if ('${this.buildInfo.gitCommit}') {
    console.log('Git Commit:', '${this.buildInfo.gitCommit}');
    console.log('Git Branch:', '${this.buildInfo.gitBranch}');
  }
}

function showHelp() {
  console.log(\`
LLM Router CLI v${this.buildInfo.version}

Usage: llm-router <command>

Commands:
  start     Start the LLM Router server
  health    Check system health
  version   Show version information
  info      Show build information
  help      Show this help message

Examples:
  llm-router start
  llm-router health
  llm-router info
\`);
}

main().catch(console.error);
`;

    const cliPath = path.join(binDir, 'llm-router.js');
    await fs.writeFile(cliPath, cliContent);
    
    // Make it executable
    try {
      await fs.chmod(cliPath, 0o755);
    } catch (error) {
      console.warn('⚠️ Could not make CLI executable:', error.message);
    }
    
    if (this.options.verbose) {
      console.log('✅ Generated CLI entry point');
    }
  }

  /**
   * Generate build manifest
   */
  async generateBuildManifest() {
    const manifestPath = path.join(rootDir, this.options.outputDir, 'BUILD_MANIFEST.json');
    
    // Collect file list
    const files = await this.collectFileList(path.join(rootDir, this.options.outputDir));
    
    const manifest = {
      ...this.buildInfo,
      files,
      fileCount: files.length,
      buildOptions: this.options,
      checksums: await this.generateChecksums(files)
    };
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log('📋 Generated build manifest');
  }

  /**
   * Collect list of all files in distribution
   */
  async collectFileList(dir, baseDir = dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        const subFiles = await this.collectFileList(fullPath, baseDir);
        files.push(...subFiles);
      } else {
        const stat = await fs.stat(fullPath);
        files.push({
          path: relativePath,
          size: stat.size,
          modified: stat.mtime.toISOString()
        });
      }
    }
    
    return files;
  }

  /**
   * Generate checksums for important files
   */
  async generateChecksums(files) {
    const crypto = await import('crypto');
    const checksums = {};
    
    const importantFiles = files.filter(f => 
      f.path.endsWith('.js') || 
      f.path.endsWith('.json') || 
      f.path === 'README.md'
    );
    
    for (const file of importantFiles.slice(0, 10)) { // Limit to avoid performance issues
      try {
        const filePath = path.join(rootDir, this.options.outputDir, file.path);
        const content = await fs.readFile(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        checksums[file.path] = hash;
      } catch (error) {
        console.warn(`⚠️ Could not generate checksum for ${file.path}:`, error.message);
      }
    }
    
    return checksums;
  }

  /**
   * Run quality checks on built distribution
   */
  async runQualityChecks() {
    console.log('🔍 Running quality checks...');
    
    const outputPath = path.join(rootDir, this.options.outputDir);
    
    // Check main entry point exists
    const mainEntryPoint = path.join(outputPath, 'src', 'index.js');
    try {
      await fs.access(mainEntryPoint);
    } catch (error) {
      throw new Error('Main entry point not found in distribution');
    }
    
    // Check package.json is valid
    const packageJsonPath = path.join(outputPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (!packageJson.name || !packageJson.version) {
        throw new Error('Invalid package.json in distribution');
      }
    } catch (error) {
      throw new Error('Cannot parse package.json in distribution');
    }
    
    // Check for required directories
    const requiredDirs = ['src', 'migrations'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(outputPath, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error(`${dir} is not a directory`);
        }
      } catch (error) {
        throw new Error(`Required directory ${dir} not found`);
      }
    }
    
    console.log('✅ Quality checks passed');
  }

  /**
   * Package distribution (create tarball)
   */
  async packageDistribution() {
    console.log('📦 Packaging distribution...');
    
    const outputPath = path.join(rootDir, this.options.outputDir);
    const packageName = `llm-router-v${this.buildInfo.version}-${process.platform}-${process.arch}.tar.gz`;
    const packagePath = path.join(rootDir, packageName);
    
    try {
      // Create tarball
      execSync(`cd "${outputPath}" && tar -czf "${packagePath}" .`, { 
        stdio: this.options.verbose ? 'inherit' : 'pipe' 
      });
      
      const stat = await fs.stat(packagePath);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ Package created: ${packageName} (${sizeMB} MB)`);
      
    } catch (error) {
      console.warn('⚠️ Could not create package tarball:', error.message);
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const options = {};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--output':
    case '-o':
      options.outputDir = args[++i];
      break;
    case '--include-tests':
      options.includeTests = true;
      break;
    case '--no-docs':
      options.includeDocs = false;
      break;
    case '--no-minify':
      options.minify = false;
      break;
    case '--generate-maps':
      options.generateMaps = true;
      break;
    case '--help':
    case '-h':
      console.log(`
LLM Router Prebuild Automation

Usage: node scripts/prebuild-automation.js [options]

Options:
  --verbose, -v          Enable verbose output
  --output, -o <dir>     Output directory (default: dist)
  --include-tests        Include test files in distribution
  --no-docs              Skip documentation generation
  --no-minify            Skip minification
  --generate-maps        Generate source maps
  --help, -h             Show this help message

Examples:
  node scripts/prebuild-automation.js
  node scripts/prebuild-automation.js --verbose --output build
`);
      process.exit(0);
  }
}

// Run the build
const automation = new PreBuildAutomation(options);
automation.build().catch(console.error);