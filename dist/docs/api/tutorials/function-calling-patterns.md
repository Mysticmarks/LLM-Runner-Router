# 🔧 Function Calling Patterns and Tool Integration

Complete guide for implementing function calling with LLMs, including tool registration, execution patterns, error handling, and advanced workflows.

## Table of Contents

1. [Overview](#overview)
2. [Basic Function Calling](#basic-function-calling)
3. [Tool Registration and Management](#tool-registration-and-management)
4. [Advanced Execution Patterns](#advanced-execution-patterns)
5. [Parallel and Chained Execution](#parallel-and-chained-execution)
6. [Error Handling and Retry Logic](#error-handling-and-retry-logic)
7. [Security and Validation](#security-and-validation)
8. [Real-World Examples](#real-world-examples)

## Overview

Function calling enables LLMs to interact with external systems, APIs, and tools. This guide covers implementation patterns for building robust, secure, and efficient function calling systems.

### Key Concepts

- **Tools**: External functions that LLMs can call
- **Function Schemas**: JSON schemas defining function signatures
- **Tool Selection**: LLM choosing appropriate tools for tasks
- **Execution Context**: Environment and state for function execution
- **Result Processing**: Handling and interpreting function outputs

## Basic Function Calling

### 1. Simple Function Call

```javascript
import { LLMRouter } from 'llm-runner-router';

// Define a simple tool
const weatherTool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or coordinates'
      },
      units: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius'
      }
    },
    required: ['location']
  },
  
  async execute(args) {
    const { location, units = 'celsius' } = args;
    
    // Mock weather API call
    const response = await fetch(`https://api.weather.com/v1/current?q=${location}&units=${units}`);
    const data = await response.json();
    
    return {
      location,
      temperature: data.main.temp,
      description: data.weather[0].description,
      units
    };
  }
};

// Use with LLM Router
const router = new LLMRouter({
  providers: ['openai', 'anthropic'],
  tools: [weatherTool]
});

async function askWeather() {
  const response = await router.generate({
    prompt: "What's the weather like in Tokyo?",
    tools: [weatherTool],
    toolChoice: 'auto'
  });
  
  if (response.toolCalls) {
    console.log('Tool calls:', response.toolCalls);
    
    // Execute tool calls
    for (const call of response.toolCalls) {
      const result = await weatherTool.execute(call.arguments);
      console.log('Weather result:', result);
    }
  }
  
  return response.text;
}
```

### 2. Multiple Tool Support

```javascript
class ToolManager {
  constructor() {
    this.tools = new Map();
    this.executionHistory = [];
  }
  
  registerTool(tool) {
    // Validate tool schema
    this.validateTool(tool);
    
    this.tools.set(tool.name, tool);
  }
  
  validateTool(tool) {
    const required = ['name', 'description', 'parameters', 'execute'];
    
    for (const field of required) {
      if (!tool[field]) {
        throw new Error(`Tool missing required field: ${field}`);
      }
    }
    
    if (typeof tool.execute !== 'function') {
      throw new Error('Tool execute must be a function');
    }
  }
  
  getToolSchemas() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }
  
  async executeTool(name, args) {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    // Validate arguments
    this.validateArguments(tool, args);
    
    // Execute with error handling
    const startTime = Date.now();
    
    try {
      const result = await tool.execute(args);
      
      // Log execution
      this.executionHistory.push({
        tool: name,
        args,
        result,
        duration: Date.now() - startTime,
        success: true,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      this.executionHistory.push({
        tool: name,
        args,
        error: error.message,
        duration: Date.now() - startTime,
        success: false,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  validateArguments(tool, args) {
    const { parameters } = tool;
    
    // Check required parameters
    if (parameters.required) {
      for (const required of parameters.required) {
        if (!(required in args)) {
          throw new Error(`Missing required parameter: ${required}`);
        }
      }
    }
    
    // Validate types
    if (parameters.properties) {
      for (const [key, value] of Object.entries(args)) {
        const schema = parameters.properties[key];
        if (schema && !this.validateType(value, schema)) {
          throw new Error(`Invalid type for parameter ${key}`);
        }
      }
    }
  }
  
  validateType(value, schema) {
    switch (schema.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        return true;
    }
  }
  
  getExecutionStats() {
    const stats = {
      totalExecutions: this.executionHistory.length,
      successRate: 0,
      avgDuration: 0,
      toolUsage: {}
    };
    
    if (this.executionHistory.length === 0) return stats;
    
    let successCount = 0;
    let totalDuration = 0;
    
    for (const execution of this.executionHistory) {
      if (execution.success) successCount++;
      totalDuration += execution.duration;
      
      if (!stats.toolUsage[execution.tool]) {
        stats.toolUsage[execution.tool] = 0;
      }
      stats.toolUsage[execution.tool]++;
    }
    
    stats.successRate = successCount / this.executionHistory.length;
    stats.avgDuration = totalDuration / this.executionHistory.length;
    
    return stats;
  }
}

// Example usage
const toolManager = new ToolManager();

// Register multiple tools
toolManager.registerTool(weatherTool);
toolManager.registerTool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate'
      }
    },
    required: ['expression']
  },
  async execute(args) {
    // Safe math evaluation
    const result = eval(args.expression.replace(/[^0-9+\-*/.() ]/g, ''));
    return { expression: args.expression, result };
  }
});

// Use with router
const router = new LLMRouter({
  providers: ['openai'],
  tools: toolManager.getToolSchemas()
});
```

## Tool Registration and Management

### 1. Dynamic Tool Loading

```javascript
class DynamicToolLoader {
  constructor() {
    this.tools = new Map();
    this.categories = new Map();
    this.permissions = new Map();
  }
  
  async loadTool(toolConfig) {
    const { name, path, category, permissions } = toolConfig;
    
    try {
      // Dynamic import
      const toolModule = await import(path);
      const tool = toolModule.default || toolModule[name];
      
      if (!tool) {
        throw new Error(`Tool ${name} not found in module ${path}`);
      }
      
      // Initialize tool if needed
      if (typeof tool === 'function') {
        const instance = new tool();
        this.registerTool(instance, category, permissions);
      } else {
        this.registerTool(tool, category, permissions);
      }
      
      console.log(`Loaded tool: ${name}`);
    } catch (error) {
      console.error(`Failed to load tool ${name}:`, error);
      throw error;
    }
  }
  
  registerTool(tool, category = 'general', permissions = []) {
    this.tools.set(tool.name, tool);
    
    // Categorize
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(tool.name);
    
    // Set permissions
    this.permissions.set(tool.name, new Set(permissions));
  }
  
  getToolsByCategory(category) {
    const toolNames = this.categories.get(category) || new Set();
    return Array.from(toolNames).map(name => this.tools.get(name));
  }
  
  getAuthorizedTools(userPermissions) {
    const authorized = [];
    
    for (const [toolName, tool] of this.tools) {
      const requiredPerms = this.permissions.get(toolName);
      
      if (this.hasPermissions(userPermissions, requiredPerms)) {
        authorized.push(tool);
      }
    }
    
    return authorized;
  }
  
  hasPermissions(userPerms, requiredPerms) {
    if (requiredPerms.size === 0) return true;
    
    for (const perm of requiredPerms) {
      if (!userPerms.includes(perm)) {
        return false;
      }
    }
    
    return true;
  }
  
  async loadToolsFromConfig(configPath) {
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      for (const toolConfig of config.tools) {
        await this.loadTool(toolConfig);
      }
    } catch (error) {
      console.error('Failed to load tools from config:', error);
    }
  }
}

// Example tool configuration
const toolConfig = {
  tools: [
    {
      name: 'file_operations',
      path: './tools/file-tools.js',
      category: 'filesystem',
      permissions: ['read_files', 'write_files']
    },
    {
      name: 'database_query',
      path: './tools/db-tools.js',
      category: 'database',
      permissions: ['db_read', 'db_write']
    },
    {
      name: 'web_scraper',
      path: './tools/web-tools.js',
      category: 'web',
      permissions: ['web_access']
    }
  ]
};
```

### 2. Tool Validation and Sandboxing

```javascript
class SecureToolExecutor {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB
    this.allowedModules = new Set(options.allowedModules || []);
    this.executionContext = this.createSandbox();
  }
  
  createSandbox() {
    // Create isolated execution context
    const vm = require('vm');
    
    const context = {
      console: {
        log: (...args) => console.log('[TOOL]', ...args),
        error: (...args) => console.error('[TOOL]', ...args)
      },
      setTimeout,
      clearTimeout,
      Promise,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      // Add safe globals only
    };
    
    return vm.createContext(context);
  }
  
  async executeTool(tool, args) {
    // Validate arguments
    this.validateArgs(tool, args);
    
    // Create execution wrapper
    const wrappedExecution = this.wrapExecution(tool, args);
    
    // Execute with timeout and resource limits
    return this.executeWithLimits(wrappedExecution);
  }
  
  validateArgs(tool, args) {
    // JSON schema validation
    const Ajv = require('ajv');
    const ajv = new Ajv();
    
    const validate = ajv.compile(tool.parameters);
    const valid = validate(args);
    
    if (!valid) {
      throw new Error(`Invalid arguments: ${ajv.errorsText(validate.errors)}`);
    }
    
    // Additional security checks
    this.checkForDangerousPatterns(args);
  }
  
  checkForDangerousPatterns(args) {
    const dangerous = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(/,
      /import\s*\(/,
      /process\./,
      /__proto__/,
      /constructor/
    ];
    
    const argsString = JSON.stringify(args);
    
    for (const pattern of dangerous) {
      if (pattern.test(argsString)) {
        throw new Error('Potentially dangerous content detected in arguments');
      }
    }
  }
  
  wrapExecution(tool, args) {
    return async () => {
      // Resource monitoring
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      try {
        const result = await tool.execute(args);
        
        // Validate result
        this.validateResult(result);
        
        return {
          success: true,
          result,
          metrics: {
            duration: Date.now() - startTime,
            memoryUsed: process.memoryUsage().heapUsed - startMemory
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          metrics: {
            duration: Date.now() - startTime,
            memoryUsed: process.memoryUsage().heapUsed - startMemory
          }
        };
      }
    };
  }
  
  async executeWithLimits(wrappedExecution) {
    // Timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timeout')), this.timeout);
    });
    
    // Memory monitoring
    const memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage().heapUsed;
      if (usage > this.maxMemory) {
        clearInterval(memoryMonitor);
        throw new Error('Tool execution exceeded memory limit');
      }
    }, 1000);
    
    try {
      const result = await Promise.race([
        wrappedExecution(),
        timeoutPromise
      ]);
      
      clearInterval(memoryMonitor);
      return result;
    } catch (error) {
      clearInterval(memoryMonitor);
      throw error;
    }
  }
  
  validateResult(result) {
    // Ensure result is serializable
    try {
      JSON.stringify(result);
    } catch (error) {
      throw new Error('Tool result is not serializable');
    }
    
    // Size check
    const resultSize = JSON.stringify(result).length;
    if (resultSize > 1024 * 1024) { // 1MB limit
      throw new Error('Tool result too large');
    }
  }
}
```

## Advanced Execution Patterns

### 1. Streaming Tool Execution

```javascript
class StreamingToolExecutor {
  constructor() {
    this.activeStreams = new Map();
  }
  
  async *executeToolStream(tool, args) {
    const streamId = this.generateStreamId();
    
    try {
      // Check if tool supports streaming
      if (!tool.supportsStreaming) {
        // Execute normally and yield result
        const result = await tool.execute(args);
        yield { type: 'result', data: result, final: true };
        return;
      }
      
      // Start streaming execution
      this.activeStreams.set(streamId, true);
      
      const stream = tool.executeStream(args);
      
      for await (const chunk of stream) {
        // Check if stream was cancelled
        if (!this.activeStreams.get(streamId)) {
          break;
        }
        
        yield {
          type: 'chunk',
          data: chunk,
          streamId,
          final: false
        };
      }
      
      yield {
        type: 'complete',
        streamId,
        final: true
      };
      
    } catch (error) {
      yield {
        type: 'error',
        error: error.message,
        streamId,
        final: true
      };
    } finally {
      this.activeStreams.delete(streamId);
    }
  }
  
  cancelStream(streamId) {
    this.activeStreams.set(streamId, false);
  }
  
  generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Example streaming tool
const streamingSearchTool = {
  name: 'search_documents',
  description: 'Search through documents with streaming results',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  },
  
  supportsStreaming: true,
  
  async *executeStream(args) {
    const { query, limit = 10 } = args;
    let found = 0;
    
    // Simulate document search
    for (let i = 0; i < 1000 && found < limit; i++) {
      // Simulate search delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (Math.random() > 0.8) { // 20% match rate
        yield {
          document: `Document ${i}`,
          relevance: Math.random(),
          snippet: `Relevant content for: ${query}`
        };
        found++;
      }
    }
  }
};

// Usage
const executor = new StreamingToolExecutor();

async function streamingSearch() {
  const stream = executor.executeToolStream(streamingSearchTool, {
    query: 'machine learning',
    limit: 5
  });
  
  for await (const chunk of stream) {
    console.log('Received:', chunk);
    
    if (chunk.type === 'chunk') {
      // Process streaming result
      console.log('Found document:', chunk.data.document);
    } else if (chunk.type === 'complete') {
      console.log('Search complete');
    }
  }
}
```

### 2. Conditional Tool Execution

```javascript
class ConditionalToolExecutor {
  constructor() {
    this.conditions = new Map();
    this.dependencies = new Map();
  }
  
  registerCondition(name, condition) {
    this.conditions.set(name, condition);
  }
  
  registerDependency(toolName, dependencies) {
    this.dependencies.set(toolName, dependencies);
  }
  
  async canExecute(toolName, args, context) {
    // Check dependencies
    const deps = this.dependencies.get(toolName) || [];
    
    for (const dep of deps) {
      if (typeof dep === 'string') {
        // Simple tool dependency
        if (!context.completedTools?.includes(dep)) {
          return {
            canExecute: false,
            reason: `Requires ${dep} to be executed first`
          };
        }
      } else if (typeof dep === 'object') {
        // Conditional dependency
        const condition = this.conditions.get(dep.condition);
        if (condition && !condition(context, args)) {
          return {
            canExecute: false,
            reason: dep.reason || `Condition ${dep.condition} not met`
          };
        }
      }
    }
    
    return { canExecute: true };
  }
  
  async executeWithConditions(toolName, tool, args, context = {}) {
    // Check if execution is allowed
    const check = await this.canExecute(toolName, args, context);
    
    if (!check.canExecute) {
      throw new Error(`Cannot execute ${toolName}: ${check.reason}`);
    }
    
    // Execute tool
    const result = await tool.execute(args);
    
    // Update context
    context.completedTools = context.completedTools || [];
    context.completedTools.push(toolName);
    context.results = context.results || {};
    context.results[toolName] = result;
    
    return result;
  }
}

// Example with dependencies
const executor = new ConditionalToolExecutor();

// Register conditions
executor.registerCondition('user_authenticated', (context) => {
  return context.user && context.user.authenticated;
});

executor.registerCondition('has_permission', (context, args) => {
  return context.user?.permissions?.includes(args.permission);
});

// Register dependencies
executor.registerDependency('write_file', [
  'authenticate_user',
  { condition: 'has_permission', reason: 'Requires write permission' }
]);

executor.registerDependency('delete_file', [
  'authenticate_user',
  'backup_file',
  { condition: 'has_permission', reason: 'Requires delete permission' }
]);
```

## Parallel and Chained Execution

### 1. Parallel Tool Execution

```javascript
class ParallelToolExecutor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 5;
    this.timeout = options.timeout || 30000;
  }
  
  async executeParallel(toolCalls) {
    // Group by dependencies
    const groups = this.groupByDependencies(toolCalls);
    const results = new Map();
    
    for (const group of groups) {
      // Execute group in parallel
      const groupResults = await this.executeGroup(group, results);
      
      // Merge results
      for (const [key, value] of groupResults) {
        results.set(key, value);
      }
    }
    
    return results;
  }
  
  groupByDependencies(toolCalls) {
    const groups = [];
    const processed = new Set();
    
    while (processed.size < toolCalls.length) {
      const currentGroup = [];
      
      for (const call of toolCalls) {
        if (processed.has(call.id)) continue;
        
        // Check if dependencies are satisfied
        const canExecute = this.canExecuteNow(call, processed);
        
        if (canExecute) {
          currentGroup.push(call);
          processed.add(call.id);
        }
      }
      
      if (currentGroup.length === 0) {
        throw new Error('Circular dependency detected in tool calls');
      }
      
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  canExecuteNow(toolCall, completed) {
    if (!toolCall.dependencies) return true;
    
    for (const dep of toolCall.dependencies) {
      if (!completed.has(dep)) {
        return false;
      }
    }
    
    return true;
  }
  
  async executeGroup(group, previousResults) {
    // Limit concurrency
    const batches = this.createBatches(group, this.maxConcurrency);
    const results = new Map();
    
    for (const batch of batches) {
      const promises = batch.map(call => 
        this.executeToolCall(call, previousResults, results)
      );
      
      const batchResults = await Promise.allSettled(promises);
      
      // Process results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const call = batch[i];
        
        if (result.status === 'fulfilled') {
          results.set(call.id, result.value);
        } else {
          results.set(call.id, {
            error: result.reason.message,
            success: false
          });
        }
      }
    }
    
    return results;
  }
  
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  async executeToolCall(call, previousResults, currentResults) {
    const { tool, args } = call;
    
    // Resolve argument references
    const resolvedArgs = this.resolveArguments(args, previousResults, currentResults);
    
    // Execute with timeout
    return Promise.race([
      tool.execute(resolvedArgs),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tool execution timeout')), this.timeout)
      )
    ]);
  }
  
  resolveArguments(args, previousResults, currentResults) {
    const resolved = { ...args };
    
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string' && value.startsWith('$ref:')) {
        // Reference to previous result
        const refId = value.substring(5);
        const result = previousResults.get(refId) || currentResults.get(refId);
        
        if (result) {
          resolved[key] = result;
        }
      }
    }
    
    return resolved;
  }
}

// Example parallel execution
const parallelExecutor = new ParallelToolExecutor({ maxConcurrency: 3 });

const toolCalls = [
  {
    id: 'call1',
    tool: weatherTool,
    args: { location: 'Tokyo' }
  },
  {
    id: 'call2',
    tool: weatherTool,
    args: { location: 'London' }
  },
  {
    id: 'call3',
    tool: calculateTool,
    args: { expression: '2 + 2' }
  },
  {
    id: 'call4',
    tool: formatTool,
    args: { 
      template: 'Weather in {location}: {temp}°C',
      data: '$ref:call1'  // Reference to call1 result
    },
    dependencies: ['call1']
  }
];

const results = await parallelExecutor.executeParallel(toolCalls);
```

### 2. Chained Tool Workflows

```javascript
class ToolWorkflow {
  constructor() {
    this.steps = [];
    this.context = {};
  }
  
  addStep(stepConfig) {
    this.steps.push({
      id: stepConfig.id || `step_${this.steps.length}`,
      tool: stepConfig.tool,
      args: stepConfig.args,
      condition: stepConfig.condition,
      onSuccess: stepConfig.onSuccess,
      onError: stepConfig.onError,
      retry: stepConfig.retry || { maxAttempts: 1 }
    });
    
    return this;
  }
  
  conditional(condition, trueBranch, falseBranch) {
    this.addStep({
      tool: {
        name: 'conditional',
        execute: async () => {
          if (condition(this.context)) {
            return trueBranch;
          } else {
            return falseBranch || null;
          }
        }
      }
    });
    
    return this;
  }
  
  loop(condition, steps) {
    this.addStep({
      tool: {
        name: 'loop',
        execute: async () => {
          while (condition(this.context)) {
            for (const step of steps) {
              await this.executeStep(step);
            }
          }
        }
      }
    });
    
    return this;
  }
  
  async execute() {
    const results = [];
    
    for (const step of this.steps) {
      try {
        // Check condition
        if (step.condition && !step.condition(this.context)) {
          continue;
        }
        
        const result = await this.executeStepWithRetry(step);
        
        // Update context
        this.context[step.id] = result;
        results.push({ step: step.id, result, success: true });
        
        // Execute success callback
        if (step.onSuccess) {
          await step.onSuccess(result, this.context);
        }
        
      } catch (error) {
        results.push({ step: step.id, error: error.message, success: false });
        
        // Execute error callback
        if (step.onError) {
          const shouldContinue = await step.onError(error, this.context);
          if (!shouldContinue) {
            break;
          }
        } else {
          throw error;
        }
      }
    }
    
    return {
      results,
      context: this.context,
      success: results.every(r => r.success)
    };
  }
  
  async executeStepWithRetry(step) {
    let lastError;
    
    for (let attempt = 0; attempt < step.retry.maxAttempts; attempt++) {
      try {
        // Resolve arguments with context
        const resolvedArgs = this.resolveArguments(step.args);
        
        return await step.tool.execute(resolvedArgs);
      } catch (error) {
        lastError = error;
        
        if (attempt < step.retry.maxAttempts - 1) {
          // Wait before retry
          const delay = step.retry.delay || 1000 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  resolveArguments(args) {
    if (typeof args === 'function') {
      return args(this.context);
    }
    
    if (typeof args === 'object') {
      const resolved = {};
      
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          // Template string
          const expr = value.slice(2, -1);
          resolved[key] = this.evaluateExpression(expr);
        } else {
          resolved[key] = value;
        }
      }
      
      return resolved;
    }
    
    return args;
  }
  
  evaluateExpression(expr) {
    // Safe evaluation of context expressions
    try {
      const func = new Function('context', `return ${expr}`);
      return func(this.context);
    } catch (error) {
      console.warn(`Failed to evaluate expression: ${expr}`);
      return expr;
    }
  }
}

// Example workflow
const workflow = new ToolWorkflow()
  .addStep({
    id: 'fetch_user',
    tool: userTool,
    args: { userId: '123' }
  })
  .conditional(
    (ctx) => ctx.fetch_user.role === 'admin',
    new ToolWorkflow()
      .addStep({
        tool: adminTool,
        args: (ctx) => ({ user: ctx.fetch_user })
      }),
    null
  )
  .addStep({
    id: 'log_action',
    tool: logTool,
    args: {
      message: 'User ${fetch_user.name} completed workflow'
    }
  });

const result = await workflow.execute();
```

## Error Handling and Retry Logic

### 1. Robust Error Recovery

```javascript
class RobustToolExecutor {
  constructor() {
    this.errorHandlers = new Map();
    this.retryStrategies = new Map();
    this.fallbackTools = new Map();
  }
  
  registerErrorHandler(toolName, handler) {
    this.errorHandlers.set(toolName, handler);
  }
  
  registerRetryStrategy(toolName, strategy) {
    this.retryStrategies.set(toolName, strategy);
  }
  
  registerFallback(toolName, fallbackTool) {
    this.fallbackTools.set(toolName, fallbackTool);
  }
  
  async executeWithRecovery(tool, args) {
    const strategy = this.retryStrategies.get(tool.name) || {
      maxAttempts: 3,
      delay: 1000,
      backoff: 2
    };
    
    let lastError;
    
    for (let attempt = 0; attempt < strategy.maxAttempts; attempt++) {
      try {
        return await tool.execute(args);
      } catch (error) {
        lastError = error;
        
        // Custom error handling
        const handler = this.errorHandlers.get(tool.name);
        if (handler) {
          const action = await handler(error, attempt, args);
          
          switch (action.type) {
            case 'retry':
              args = action.modifiedArgs || args;
              break;
            case 'fallback':
              return this.executeFallback(tool.name, args);
            case 'abort':
              throw error;
          }
        }
        
        // Wait before retry
        if (attempt < strategy.maxAttempts - 1) {
          const delay = strategy.delay * Math.pow(strategy.backoff, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed, try fallback
    const fallback = this.fallbackTools.get(tool.name);
    if (fallback) {
      try {
        return await this.executeFallback(tool.name, args);
      } catch (fallbackError) {
        // Both primary and fallback failed
        throw new Error(`Tool execution failed: ${lastError.message}. Fallback also failed: ${fallbackError.message}`);
      }
    }
    
    throw lastError;
  }
  
  async executeFallback(toolName, args) {
    const fallback = this.fallbackTools.get(toolName);
    if (!fallback) {
      throw new Error(`No fallback available for ${toolName}`);
    }
    
    console.log(`Executing fallback for ${toolName}`);
    return fallback.execute(args);
  }
}

// Example error handling setup
const executor = new RobustToolExecutor();

// Register error handler for weather tool
executor.registerErrorHandler('get_weather', async (error, attempt, args) => {
  if (error.message.includes('rate limit')) {
    return {
      type: 'retry',
      modifiedArgs: args // Wait and retry
    };
  }
  
  if (error.message.includes('invalid location')) {
    return {
      type: 'fallback' // Use fallback service
    };
  }
  
  if (attempt >= 2) {
    return {
      type: 'abort' // Give up after 3 attempts
    };
  }
  
  return {
    type: 'retry'
  };
});

// Register fallback tool
executor.registerFallback('get_weather', {
  name: 'get_weather_fallback',
  execute: async (args) => {
    // Use alternative weather service
    return {
      location: args.location,
      temperature: 20,
      description: 'Data from fallback service'
    };
  }
});
```

## Security and Validation

### 1. Input Sanitization

```javascript
class SecureToolValidator {
  constructor() {
    this.sanitizers = new Map();
    this.validators = new Map();
    this.rateLimits = new Map();
  }
  
  registerSanitizer(toolName, sanitizer) {
    this.sanitizers.set(toolName, sanitizer);
  }
  
  registerValidator(toolName, validator) {
    this.validators.set(toolName, validator);
  }
  
  async validateAndSanitize(toolName, args, context) {
    // Rate limiting
    if (!this.checkRateLimit(toolName, context.userId)) {
      throw new Error('Rate limit exceeded for tool');
    }
    
    // Input sanitization
    const sanitizer = this.sanitizers.get(toolName);
    if (sanitizer) {
      args = await sanitizer(args);
    }
    
    // Validation
    const validator = this.validators.get(toolName);
    if (validator) {
      const isValid = await validator(args, context);
      if (!isValid) {
        throw new Error('Tool arguments validation failed');
      }
    }
    
    // Security checks
    this.performSecurityChecks(args);
    
    return args;
  }
  
  performSecurityChecks(args) {
    const argsString = JSON.stringify(args);
    
    // SQL injection patterns
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i
    ];
    
    // Command injection patterns
    const cmdPatterns = [
      /\|\s*\w+/,
      /;\s*\w+/,
      /`\w+`/,
      /\$\(\w+\)/
    ];
    
    // Path traversal patterns
    const pathPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /~\//
    ];
    
    const allPatterns = [...sqlPatterns, ...cmdPatterns, ...pathPatterns];
    
    for (const pattern of allPatterns) {
      if (pattern.test(argsString)) {
        throw new Error('Potentially malicious input detected');
      }
    }
  }
  
  checkRateLimit(toolName, userId) {
    const key = `${toolName}:${userId}`;
    const now = Date.now();
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 1, resetTime: now + 60000 });
      return true;
    }
    
    const limit = this.rateLimits.get(key);
    
    if (now > limit.resetTime) {
      // Reset window
      limit.count = 1;
      limit.resetTime = now + 60000;
      return true;
    }
    
    if (limit.count >= 10) { // 10 calls per minute
      return false;
    }
    
    limit.count++;
    return true;
  }
}

// Example sanitizers and validators
const validator = new SecureToolValidator();

// File operations sanitizer
validator.registerSanitizer('file_operations', async (args) => {
  return {
    ...args,
    path: path.normalize(args.path), // Normalize path
    content: args.content?.substring(0, 10000) // Limit content size
  };
});

// Database query validator
validator.registerValidator('database_query', async (args, context) => {
  // Only allow SELECT queries for non-admin users
  if (!context.user.isAdmin && !args.query.toLowerCase().startsWith('select')) {
    return false;
  }
  
  // Check for allowed tables
  const allowedTables = context.user.allowedTables || [];
  for (const table of allowedTables) {
    if (args.query.toLowerCase().includes(table)) {
      return true;
    }
  }
  
  return false;
});
```

## Real-World Examples

### 1. Customer Support Agent

```javascript
const supportAgent = {
  tools: [
    {
      name: 'lookup_customer',
      description: 'Look up customer information',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          email: { type: 'string' }
        }
      },
      async execute(args) {
        // Database lookup
        const customer = await db.customers.findOne({
          $or: [
            { id: args.customerId },
            { email: args.email }
          ]
        });
        
        return customer ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          tier: customer.tier,
          joinDate: customer.joinDate
        } : null;
      }
    },
    
    {
      name: 'lookup_orders',
      description: 'Look up customer orders',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['customerId']
      },
      async execute(args) {
        const orders = await db.orders.find({
          customerId: args.customerId
        }).limit(args.limit).sort({ createdAt: -1 });
        
        return orders.map(order => ({
          id: order.id,
          status: order.status,
          total: order.total,
          items: order.items.length,
          date: order.createdAt
        }));
      }
    },
    
    {
      name: 'create_refund',
      description: 'Create a refund for an order',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
          reason: { type: 'string' }
        },
        required: ['orderId', 'amount', 'reason']
      },
      async execute(args) {
        // Validate order exists and refund amount
        const order = await db.orders.findById(args.orderId);
        if (!order) {
          throw new Error('Order not found');
        }
        
        if (args.amount > order.total) {
          throw new Error('Refund amount exceeds order total');
        }
        
        // Process refund
        const refund = await payments.createRefund({
          orderId: args.orderId,
          amount: args.amount,
          reason: args.reason
        });
        
        // Update order status
        await db.orders.updateOne(
          { _id: args.orderId },
          { $set: { status: 'refunded', refundId: refund.id } }
        );
        
        return {
          refundId: refund.id,
          status: refund.status,
          amount: args.amount,
          estimatedProcessingTime: '3-5 business days'
        };
      }
    }
  ],
  
  async handleCustomerQuery(query, context) {
    const response = await router.generate({
      prompt: `Customer query: ${query}
      
You are a helpful customer support agent. Use the available tools to assist the customer.
Available tools: lookup_customer, lookup_orders, create_refund

Always look up customer information first if needed.`,
      tools: this.tools,
      toolChoice: 'auto'
    });
    
    if (response.toolCalls) {
      // Execute tool calls
      const results = [];
      
      for (const call of response.toolCalls) {
        const tool = this.tools.find(t => t.name === call.function.name);
        if (tool) {
          try {
            const result = await tool.execute(call.function.arguments);
            results.push({ tool: call.function.name, result });
          } catch (error) {
            results.push({ tool: call.function.name, error: error.message });
          }
        }
      }
      
      // Generate final response with tool results
      const finalResponse = await router.generate({
        prompt: `Customer query: ${query}
        
Tool results: ${JSON.stringify(results, null, 2)}

Provide a helpful response to the customer based on the tool results.`,
        model: 'gpt-3.5-turbo'
      });
      
      return finalResponse.text;
    }
    
    return response.text;
  }
};

// Usage
const response = await supportAgent.handleCustomerQuery(
  "I want to return my order from last week",
  { userId: 'customer123' }
);
```

### 2. Data Analysis Assistant

```javascript
const dataAnalysisAgent = {
  tools: [
    {
      name: 'query_database',
      description: 'Execute SQL queries on the database',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 100 }
        },
        required: ['query']
      },
      async execute(args) {
        // Validate query is read-only
        const query = args.query.toLowerCase().trim();
        if (!query.startsWith('select')) {
          throw new Error('Only SELECT queries are allowed');
        }
        
        const results = await db.raw(args.query).limit(args.limit);
        return {
          rows: results.rows,
          rowCount: results.rowCount,
          columns: results.fields?.map(f => f.name) || []
        };
      }
    },
    
    {
      name: 'generate_chart',
      description: 'Generate charts from data',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'array' },
          chartType: { 
            type: 'string', 
            enum: ['line', 'bar', 'pie', 'scatter'] 
          },
          xAxis: { type: 'string' },
          yAxis: { type: 'string' },
          title: { type: 'string' }
        },
        required: ['data', 'chartType']
      },
      async execute(args) {
        // Generate chart using a charting library
        const chart = await chartGenerator.create({
          type: args.chartType,
          data: args.data,
          options: {
            title: args.title,
            axes: {
              x: args.xAxis,
              y: args.yAxis
            }
          }
        });
        
        return {
          chartId: chart.id,
          url: chart.url,
          downloadUrl: chart.downloadUrl
        };
      }
    },
    
    {
      name: 'statistical_analysis',
      description: 'Perform statistical analysis on data',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'array' },
          analysisType: {
            type: 'string',
            enum: ['descriptive', 'correlation', 'regression', 'trend']
          },
          columns: { type: 'array' }
        },
        required: ['data', 'analysisType']
      },
      async execute(args) {
        const stats = new StatisticalAnalyzer(args.data);
        
        switch (args.analysisType) {
          case 'descriptive':
            return stats.descriptiveStats(args.columns);
          case 'correlation':
            return stats.correlationMatrix(args.columns);
          case 'regression':
            return stats.linearRegression(args.columns[0], args.columns[1]);
          case 'trend':
            return stats.trendAnalysis(args.columns[0]);
          default:
            throw new Error('Unknown analysis type');
        }
      }
    }
  ],
  
  async analyzeData(request) {
    const response = await router.generate({
      prompt: `Data analysis request: ${request}
      
You are a data analyst. Use the available tools to analyze data and provide insights.
Tools available: query_database, generate_chart, statistical_analysis

Break down complex requests into multiple tool calls as needed.`,
      tools: this.tools,
      toolChoice: 'auto'
    });
    
    return this.executeToolCallsAndSummarize(response, request);
  }
};
```

## Best Practices

1. **Always validate inputs** - Sanitize and validate all tool arguments
2. **Implement timeouts** - Prevent tools from running indefinitely
3. **Use sandboxing** - Isolate tool execution for security
4. **Log everything** - Track tool usage and performance
5. **Handle errors gracefully** - Provide meaningful error messages
6. **Implement rate limiting** - Prevent abuse of expensive tools
7. **Cache results** - Avoid redundant tool executions
8. **Version your tools** - Support backwards compatibility
9. **Monitor performance** - Track execution times and success rates
10. **Document thoroughly** - Provide clear tool descriptions and examples

## Conclusion

Function calling patterns enable powerful LLM applications that can interact with external systems safely and efficiently. By implementing proper validation, error handling, and security measures, you can build robust tool-enabled AI systems.

---

Next: [Custom Adapters](../advanced/custom-adapters.md) | [Back to Tutorials](../tutorials/)