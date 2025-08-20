#!/usr/bin/env node

/**
 * Documentation Test Script
 * Verifies all documentation files are accessible and properly linked
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Documentation structure
const API_DOCS = {
    // Main API documentation
    'api/index.md': 'API Provider Documentation Index',
    'api/introduction.md': 'API Providers Introduction',
    'api/quickstart.md': 'API Providers Quick Start Guide',
    
    // Provider documentation
    'api/providers/openai.md': 'OpenAI Provider Documentation',
    'api/providers/anthropic.md': 'Anthropic Provider Documentation',
    'api/providers/openrouter.md': 'OpenRouter Provider Documentation',
    'api/providers/groq.md': 'Groq Provider Documentation',
    
    // Feature documentation
    'api/features/streaming.md': 'Streaming Responses',
    'api/features/cost-optimization.md': 'Cost Tracking & Optimization',
    'api/features/rate-limiting.md': 'Rate Limiting & Retries',
    'api/features/caching.md': 'Response Caching',
    
    // Reference documentation
    'api/reference/apiloader.md': 'APILoader Class Reference',
    'api/reference/openai-adapter.md': 'OpenAI Adapter Reference',
    'api/reference/anthropic-adapter.md': 'Anthropic Adapter Reference',
    'api/reference/openrouter-adapter.md': 'OpenRouter Adapter Reference',
    'api/reference/groq-adapter.md': 'Groq Adapter Reference',
    
    // Advanced topics
    'api/advanced/routing.md': 'Multi-Provider Routing',
    'api/advanced/enterprise.md': 'Enterprise Integration',
    'api/advanced/custom-adapters.md': 'Custom Adapters',
    
    // Tutorials
    'api/tutorials/best-practices.md': 'Best Practices',
    'api/tutorials/migrating-from-openai.md': 'Migrating from OpenAI SDK',
    'api/tutorials/migrating-from-langchain.md': 'Migrating from LangChain',
    'api/tutorials/migrating-from-llamaindex.md': 'Migrating from LlamaIndex',
    'api/tutorials/chatbot-with-fallback.md': 'Building a Chatbot with Fallback',
    'api/tutorials/cost-effective-rag.md': 'Cost-Effective RAG Implementation',
    'api/tutorials/streaming-ui-integration.md': 'Streaming UI Integration',
    'api/tutorials/function-calling-patterns.md': 'Function Calling Patterns'
};

let totalFiles = 0;
let foundFiles = 0;
let missingFiles = [];
let errors = [];

console.log('🔍 Testing LLM-Runner-Router Documentation System\n');
console.log('=' + '='.repeat(60));

// Test 1: Check if all documentation files exist
console.log('\n📁 Checking documentation files...\n');

const docsDir = path.join(__dirname, 'docs');

for (const [filePath, description] of Object.entries(API_DOCS)) {
    totalFiles++;
    const fullPath = path.join(docsDir, filePath);
    
    try {
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            console.log(`✅ ${filePath} (${sizeKB} KB)`);
            foundFiles++;
        } else {
            console.log(`❌ ${filePath} - NOT FOUND`);
            missingFiles.push(filePath);
        }
    } catch (error) {
        console.log(`⚠️  ${filePath} - ERROR: ${error.message}`);
        errors.push({ file: filePath, error: error.message });
    }
}

// Test 2: Check public directory files
console.log('\n📄 Checking public documentation files...\n');

const publicFiles = [
    'public/enhanced-docs.html',
    'public/enhanced-docs-api.js',
    'public/index.html'
];

for (const file of publicFiles) {
    const fullPath = path.join(__dirname, file);
    
    if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`✅ ${file} (${sizeKB} KB)`);
    } else {
        console.log(`❌ ${file} - NOT FOUND`);
    }
}

// Test 3: Verify enhanced-docs-api.js has all routes
console.log('\n🔗 Checking route mappings...\n');

const apiFilePath = path.join(__dirname, 'public', 'enhanced-docs-api.js');
if (fs.existsSync(apiFilePath)) {
    const apiContent = fs.readFileSync(apiFilePath, 'utf8');
    
    // Check if all API documentation routes are mapped
    const routesToCheck = [
        'api-providers',
        'api-introduction',
        'api-quickstart',
        'api-openai',
        'api-anthropic',
        'api-openrouter',
        'api-groq',
        'api-streaming',
        'api-loader-reference'
    ];
    
    let mappedRoutes = 0;
    for (const route of routesToCheck) {
        if (apiContent.includes(`'${route}':`)) {
            console.log(`✅ Route mapped: ${route}`);
            mappedRoutes++;
        } else {
            console.log(`❌ Route NOT mapped: ${route}`);
        }
    }
    
    console.log(`\n📊 Routes mapped: ${mappedRoutes}/${routesToCheck.length}`);
}

// Test 4: Check for cross-references in documentation
console.log('\n🔄 Checking documentation cross-references...\n');

const mainDocsToCheck = [
    'api/index.md',
    'api/introduction.md',
    'api/quickstart.md'
];

for (const docPath of mainDocsToCheck) {
    const fullPath = path.join(docsDir, docPath);
    
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Check for links to other docs
        const linkPattern = /\[.*?\]\((\.\/[^)]+)\)/g;
        const links = content.match(linkPattern) || [];
        
        console.log(`📄 ${docPath}: Found ${links.length} internal links`);
        
        // Verify linked files exist
        let validLinks = 0;
        for (const link of links) {
            const linkedFile = link.match(/\]\(([^)]+)\)/)?.[1];
            if (linkedFile && linkedFile.startsWith('./')) {
                const linkedPath = path.join(path.dirname(fullPath), linkedFile);
                if (fs.existsSync(linkedPath)) {
                    validLinks++;
                }
            }
        }
        
        if (links.length > 0) {
            console.log(`  └─ Valid links: ${validLinks}/${links.length}`);
        }
    }
}

// Summary Report
console.log('\n' + '='.repeat(61));
console.log('📊 DOCUMENTATION TEST SUMMARY\n');

const successRate = ((foundFiles / totalFiles) * 100).toFixed(1);

console.log(`Total documentation files: ${totalFiles}`);
console.log(`Files found: ${foundFiles}`);
console.log(`Files missing: ${missingFiles.length}`);
console.log(`Errors encountered: ${errors.length}`);
console.log(`Success rate: ${successRate}%`);

if (missingFiles.length > 0) {
    console.log('\n⚠️  Missing files need to be created:');
    missingFiles.forEach(file => console.log(`  - ${file}`));
}

if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(err => console.log(`  - ${err.file}: ${err.error}`));
}

// Recommendations
console.log('\n💡 RECOMMENDATIONS:\n');

if (missingFiles.length === 0) {
    console.log('✅ All documentation files are present!');
} else {
    console.log(`⚠️  Create ${missingFiles.length} missing documentation files`);
}

if (successRate === '100.0') {
    console.log('✅ Documentation system is fully functional!');
} else {
    console.log('⚠️  Some documentation files need attention');
}

console.log('\n🎉 Documentation test complete!\n');

// Exit with appropriate code
process.exit(missingFiles.length > 0 ? 1 : 0);