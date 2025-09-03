#!/usr/bin/env node

/**
 * LLM Router CLI Entry Point
 * Built: 2025-09-03T21:13:26.996Z
 * Version: 2.0.0
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
        console.log('2.0.0');
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
  console.log('Version:', '2.0.0');
  console.log('Built:', '2025-09-03T21:13:26.996Z');
  console.log('Node Version:', 'v20.19.4');
  console.log('Platform:', 'linux-x64');
  
  if ('a23bb61a053b715cce908c247b3f0fc33a232f74') {
    console.log('Git Commit:', 'a23bb61a053b715cce908c247b3f0fc33a232f74');
    console.log('Git Branch:', 'main');
  }
}

function showHelp() {
  console.log(`
LLM Router CLI v2.0.0

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
`);
}

main().catch(console.error);
