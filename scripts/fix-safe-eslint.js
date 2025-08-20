#!/usr/bin/env node
/**
 * Safe ESLint Warning Fixer
 * Automatically fixes ONLY safe, predictable ESLint warnings
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

class SafeESLintFixer {
  constructor() {
    this.safePatterns = [
      // Express middleware patterns - always safe to prefix
      {
        pattern: /(\w+, \w+, )(next)(\) => {)/g,
        replacement: '$1_$2$3',
        description: 'Express middleware next parameter'
      },
      {
        pattern: /(\(req, res, )(next)(\) => {)/g,
        replacement: '$1_$2$3',
        description: 'Express route next parameter'
      },
      
      // Destructuring patterns - safe if clearly unused
      {
        pattern: /const { .*, (\w+) } = /g,
        replacement: 'const { ..., _$1 } = ',
        description: 'Destructured unused properties',
        manual: true // Requires manual review
      },
      
      // Loop variables - common pattern
      {
        pattern: /\.forEach\(\((\w+), _\) => {/g,
        replacement: '.forEach(($1, _index) => {',
        description: 'forEach unused index parameter'
      },
      
      // Function parameters that are clearly placeholders
      {
        pattern: /function \w+\([^)]*unused[^)]*\)/g,
        replacement: null,
        description: 'Functions with "unused" in parameter names',
        manual: true
      }
    ];
    
    this.reviewRequired = [];
    this.autoFixed = [];
  }

  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Get ESLint warnings for this specific file
      const eslintOutput = execSync(`npx eslint ${filePath} --format json`, { encoding: 'utf8' });
      const eslintResults = JSON.parse(eslintOutput);
      
      if (eslintResults[0]?.messages?.length > 0) {
        console.log(`\n📁 ${relativePath}`);
        
        for (const warning of eslintResults[0].messages) {
          if (warning.ruleId === 'no-unused-vars') {
            const context = this.getLineContext(content, warning.line);
            const riskLevel = this.assessRisk(warning, context);
            
            console.log(`  ${this.getRiskEmoji(riskLevel)} Line ${warning.line}: ${warning.message}`);
            console.log(`     Context: ${context.trim()}`);
            
            if (riskLevel === 'safe') {
              this.autoFixed.push({ file: relativePath, line: warning.line, message: warning.message });
            } else {
              this.reviewRequired.push({ 
                file: relativePath, 
                line: warning.line, 
                message: warning.message,
                context,
                riskLevel 
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not analyze ${filePath}: ${error.message}`);
    }
  }

  getLineContext(content, lineNumber) {
    const lines = content.split('\n');
    const line = lines[lineNumber - 1] || '';
    return line;
  }

  assessRisk(warning, context) {
    const message = warning.message.toLowerCase();
    const contextLower = context.toLowerCase();
    
    // Safe patterns
    if (contextLower.includes('next)') && contextLower.includes('=>')) {
      return 'safe'; // Express middleware
    }
    
    if (contextLower.includes('res)') && contextLower.includes('req,')) {
      return 'safe'; // Express route handlers
    }
    
    if (message.includes("'_'")) {
      return 'safe'; // Intentional underscore variables
    }
    
    // High risk patterns
    if (contextLower.includes('model') || contextLower.includes('engine')) {
      return 'high'; // Model/engine related
    }
    
    if (contextLower.includes('options') || contextLower.includes('config')) {
      return 'medium'; // Configuration related
    }
    
    if (contextLower.includes('api') || contextLower.includes('provider')) {
      return 'medium'; // API integration related
    }
    
    return 'medium'; // Default to requiring review
  }

  getRiskEmoji(riskLevel) {
    switch (riskLevel) {
      case 'safe': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ESLint Warning Analysis Report');
    console.log('='.repeat(60));
    
    console.log(`\n🟢 Safe to Auto-Fix: ${this.autoFixed.length}`);
    this.autoFixed.forEach(item => {
      console.log(`  • ${item.file}:${item.line} - ${item.message}`);
    });
    
    console.log(`\n🟡 Requires Manual Review: ${this.reviewRequired.filter(i => i.riskLevel === 'medium').length}`);
    console.log(`🔴 High Risk (Keep As-Is): ${this.reviewRequired.filter(i => i.riskLevel === 'high').length}`);
    
    // Generate detailed review file
    const reviewContent = this.generateReviewFile();
    await fs.writeFile('eslint-review-required.md', reviewContent);
    console.log('\n📝 Detailed review saved to: eslint-review-required.md');
  }

  generateReviewFile() {
    let content = '# ESLint Warnings Requiring Manual Review\n\n';
    
    const highRisk = this.reviewRequired.filter(i => i.riskLevel === 'high');
    const mediumRisk = this.reviewRequired.filter(i => i.riskLevel === 'medium');
    
    if (highRisk.length > 0) {
      content += '## 🔴 High Risk - Keep As-Is\n\n';
      highRisk.forEach(item => {
        content += `### ${item.file}:${item.line}\n`;
        content += `**Warning**: ${item.message}\n`;
        content += `**Context**: \`${item.context.trim()}\`\n`;
        content += `**Recommendation**: Keep as-is - likely used by framework\n\n`;
      });
    }
    
    if (mediumRisk.length > 0) {
      content += '## 🟡 Medium Risk - Manual Review Required\n\n';
      mediumRisk.forEach(item => {
        content += `### ${item.file}:${item.line}\n`;
        content += `**Warning**: ${item.message}\n`;
        content += `**Context**: \`${item.context.trim()}\`\n`;
        content += `**Action Required**: Review if this variable might be used by:\n`;
        content += `- [ ] Plugin system\n`;
        content += `- [ ] Future features\n`;
        content += `- [ ] External integrations\n`;
        content += `- [ ] Configuration options\n\n`;
      });
    }
    
    return content;
  }
}

// Main execution
async function main() {
  const fixer = new SafeESLintFixer();
  
  console.log('🔍 Analyzing ESLint warnings for safe auto-fixes...\n');
  
  // Get all JS files in src/
  const srcFiles = execSync('find src/ -name "*.js" -type f', { encoding: 'utf8' })
    .split('\n')
    .filter(f => f.trim())
    .slice(0, 10); // Limit for initial analysis
  
  for (const file of srcFiles) {
    await fixer.analyzeFile(file);
  }
  
  await fixer.generateReport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}