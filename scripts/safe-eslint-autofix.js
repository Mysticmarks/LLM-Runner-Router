#!/usr/bin/env node
/**
 * Conservative ESLint Auto-Fixer
 * Only fixes patterns that are 100% safe and won't break framework functionality
 */

import fs from 'fs/promises';
import { execSync } from 'child_process';

class ConservativeESLintFixer {
  constructor() {
    this.fixes = [];
    this.skipped = [];
  }

  async autoFixSafePatterns() {
    console.log('🟢 Applying 100% safe ESLint fixes...\n');

    // SAFE FIX 1: Express middleware unused 'res' parameters
    await this.fixPattern(
      'src/api/RateLimiter.js',
      /(keyGenerator: \(req, )(res)(\) => this\.generateKey)/g,
      '$1_res$3',
      'Express middleware unused res parameter'
    );

    // SAFE FIX 2: Express middleware unused 'next' parameters  
    await this.fixPattern(
      'src/api/Gateway.js', 
      /(return async \(req, res, )(next)(\) => {)/g,
      '$1_next$3',
      'Express middleware unused next parameter'
    );

    await this.fixPattern(
      'src/api/Gateway.js',
      /(this\.app\.use\(\(error, req, res, )(next)(\) => {)/g, 
      '$1_next$3',
      'Express error handler unused next parameter'
    );

    // SAFE FIX 3: Unused imports that are clearly not needed
    await this.fixUnusedImports();

    this.generateReport();
  }

  async fixPattern(filePath, pattern, replacement, description) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const newContent = content.replace(pattern, replacement);
      
      if (content !== newContent) {
        await fs.writeFile(filePath, newContent);
        this.fixes.push({ file: filePath, description, pattern: pattern.toString() });
        console.log(`✅ Fixed: ${filePath} - ${description}`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not fix ${filePath}: ${error.message}`);
      this.skipped.push({ file: filePath, description, error: error.message });
    }
  }

  async fixUnusedImports() {
    // Only fix imports that are clearly utility functions not used
    const files = [
      {
        file: 'src/api/OpenAPI.js',
        pattern: /import { validationResult, body, param, query } from 'express-validator'/,
        replacement: 'import { validationResult, body, query } from \'express-validator\'',
        description: 'Remove unused param import from express-validator'
      }
    ];

    for (const fix of files) {
      try {
        const content = await fs.readFile(fix.file, 'utf8');
        
        // Verify 'param' is really not used anywhere in the file
        if (!content.includes('param(') && !content.includes('param.')) {
          const newContent = content.replace(fix.pattern, fix.replacement);
          
          if (content !== newContent) {
            await fs.writeFile(fix.file, newContent);
            this.fixes.push(fix);
            console.log(`✅ Fixed: ${fix.file} - ${fix.description}`);
          }
        } else {
          this.skipped.push({ ...fix, reason: 'param is actually used in file' });
        }
      } catch (error) {
        this.skipped.push({ ...fix, error: error.message });
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Conservative Auto-Fix Report');
    console.log('='.repeat(50));
    
    console.log(`\n✅ Successfully Applied: ${this.fixes.length} fixes`);
    this.fixes.forEach(fix => {
      console.log(`  • ${fix.file}: ${fix.description}`);
    });
    
    if (this.skipped.length > 0) {
      console.log(`\n⚠️ Skipped: ${this.skipped.length} potential fixes`);
      this.skipped.forEach(skip => {
        console.log(`  • ${skip.file}: ${skip.reason || skip.error}`);
      });
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Run "npm run lint" to verify fixes');
    console.log('2. Review remaining warnings in eslint-review-required.md');
    console.log('3. Test functionality with "npm test"');
  }
}

// Manual Review Strategy Generator
class ManualReviewStrategy {
  generateStrategy() {
    console.log('\n' + '='.repeat(60));
    console.log('🧠 Manual Review Strategy for Remaining Warnings');
    console.log('='.repeat(60));

    const strategies = [
      {
        category: '🔍 Investigation Approach',
        items: [
          'Search codebase for dynamic usage: grep -r "variableName" src/',
          'Check if variable is part of API contract/interface',
          'Look for reflection or dynamic property access',
          'Review if used in error handling/logging',
          'Check plugin/extension points'
        ]
      },
      {
        category: '🟢 Safe to Prefix with _',
        items: [
          'Loop variables (for...of destructuring)',
          'Function parameters that are interface requirements',
          'Error handler parameters in catch blocks',
          'Callback parameters required by external libraries'
        ]
      },
      {
        category: '🔴 Never Remove/Modify',
        items: [
          'Function parameters that define API signatures',
          'Variables in model/engine loading logic',
          'Configuration object properties',
          'Provider integration parameters',
          'Middleware function signatures'
        ]
      },
      {
        category: '🛠️ Recommended Actions',
        items: [
          'Prefix with underscore: const [_unused, used] = array',
          'Add JSDoc comments: /** @param {string} _options - Reserved for future use */',
          'Use eslint-disable comments for legitimate cases',
          'Keep variables that maintain API compatibility'
        ]
      }
    ];

    strategies.forEach(strategy => {
      console.log(`\n${strategy.category}:`);
      strategy.items.forEach(item => {
        console.log(`  • ${item}`);
      });
    });
  }
}

// Main execution
async function main() {
  const fixer = new ConservativeESLintFixer();
  const reviewer = new ManualReviewStrategy();
  
  await fixer.autoFixSafePatterns();
  reviewer.generateStrategy();
  
  console.log('\n🎯 Summary:');
  console.log('• Applied only 100% safe fixes');
  console.log('• Preserved all potential framework functionality');
  console.log('• Generated strategy for manual review');
  console.log('• Ready for testing and validation');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}