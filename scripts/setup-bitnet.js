#!/usr/bin/env node

/**
 * Setup script for BitNet integration
 * Downloads and builds BitNet.cpp for 1-bit LLM support
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BITNET_REPO = 'https://github.com/microsoft/BitNet.git';
const BITNET_PATH = path.join(__dirname, '../temp/bitnet-repo');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: 'inherit',
            ...options
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

async function checkDependencies() {
    log('\n📋 Checking dependencies...', 'blue');
    
    const deps = {
        python3: 'Python 3.9+',
        cmake: 'CMake 3.22+',
        git: 'Git'
    };
    
    const missing = [];
    
    for (const [cmd, name] of Object.entries(deps)) {
        try {
            await runCommand('which', [cmd], { stdio: 'ignore' });
            log(`  ✅ ${name} found`, 'green');
        } catch {
            missing.push(name);
            log(`  ❌ ${name} not found`, 'red');
        }
    }
    
    if (missing.length > 0) {
        throw new Error(`Missing dependencies: ${missing.join(', ')}\nPlease install them first.`);
    }
}

async function cloneBitNet() {
    log('\n📥 Cloning BitNet repository...', 'blue');
    
    // Check if already exists
    try {
        await fs.access(BITNET_PATH);
        log('  ℹ️  BitNet repository already exists', 'yellow');
        
        // Pull latest changes
        log('  🔄 Pulling latest changes...', 'blue');
        await runCommand('git', ['pull'], { cwd: BITNET_PATH });
        
        // Update submodules
        log('  🔄 Updating submodules...', 'blue');
        await runCommand('git', ['submodule', 'update', '--init', '--recursive'], { cwd: BITNET_PATH });
    } catch {
        // Clone fresh
        await fs.mkdir(path.dirname(BITNET_PATH), { recursive: true });
        await runCommand('git', ['clone', '--recursive', BITNET_REPO, BITNET_PATH]);
        log('  ✅ Repository cloned successfully', 'green');
    }
}

async function installPythonDeps() {
    log('\n📦 Installing Python dependencies...', 'blue');
    
    try {
        await runCommand('pip3', ['install', '-r', 'requirements.txt'], {
            cwd: BITNET_PATH
        });
        log('  ✅ Python dependencies installed', 'green');
    } catch (error) {
        log('  ⚠️  Failed to install some dependencies (non-critical)', 'yellow');
    }
}

async function buildBitNet() {
    log('\n🔨 Building BitNet.cpp...', 'blue');
    
    const buildDir = path.join(BITNET_PATH, 'build');
    
    // Create build directory
    await fs.mkdir(buildDir, { recursive: true });
    
    // Run CMake
    log('  🔧 Running CMake...', 'blue');
    await runCommand('cmake', ['..', '-DBITNET_X86_TL2=ON'], {
        cwd: buildDir
    });
    
    // Build
    log('  🏗️  Building...', 'blue');
    await runCommand('cmake', ['--build', '.', '--config', 'Release', '-j', '4'], {
        cwd: buildDir
    });
    
    log('  ✅ BitNet.cpp built successfully', 'green');
}

async function downloadSampleModel() {
    log('\n📥 Downloading sample BitNet model...', 'blue');
    
    const modelDir = path.join(BITNET_PATH, 'models');
    await fs.mkdir(modelDir, { recursive: true });
    
    log('  ℹ️  To download a model, run:', 'yellow');
    log('     python3 setup_env.py --hf-repo 1bitLLM/bitnet_b1_58-large --quant-type i2_s', 'bright');
    log('     from the temp/bitnet-repo directory', 'bright');
}

async function createTestScript() {
    log('\n📝 Creating test script...', 'blue');
    
    const testScript = `#!/usr/bin/env node

import BitNetLoader from '../src/loaders/BitNetLoader.js';

async function test() {
    console.log('🧪 Testing BitNet integration...');
    
    const loader = new BitNetLoader({
        bitnetPath: './temp/bitnet-repo'
    });
    
    // Check if BitNet is installed
    const isInstalled = await loader.checkBitNetInstallation();
    console.log('✅ BitNet installed:', isInstalled);
    
    // List available models
    const models = await BitNetLoader.listAvailableModels();
    console.log('📦 Available models:', models);
    
    console.log('\\n✨ BitNet integration ready!');
    console.log('\\nTo download a model, run:');
    console.log('  cd temp/bitnet-repo');
    console.log('  python3 setup_env.py --hf-repo 1bitLLM/bitnet_b1_58-large --quant-type i2_s');
}

test().catch(console.error);
`;

    await fs.writeFile(
        path.join(__dirname, 'test-bitnet.js'),
        testScript,
        { mode: 0o755 }
    );
    
    log('  ✅ Test script created: scripts/test-bitnet.js', 'green');
}

async function main() {
    try {
        log('🚀 BitNet Setup Script', 'bright');
        log('=' .repeat(40), 'bright');
        
        await checkDependencies();
        await cloneBitNet();
        await installPythonDeps();
        await buildBitNet();
        await downloadSampleModel();
        await createTestScript();
        
        log('\n' + '=' .repeat(40), 'bright');
        log('✨ BitNet setup complete!', 'green');
        log('\nNext steps:', 'yellow');
        log('1. Download a model (see instructions above)', 'bright');
        log('2. Test the integration: npm run test:bitnet', 'bright');
        log('3. Use BitNet models in your code:', 'bright');
        log('   const model = await router.load("bitnet:1bitLLM/bitnet_b1_58-large");', 'bright');
        
    } catch (error) {
        log(`\n❌ Setup failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

main();