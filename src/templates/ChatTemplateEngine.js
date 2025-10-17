/**
 * 🎭 Chat Template Engine - Jinja2-Compatible Template System
 * 
 * Provides Jinja2-style template rendering for model-specific chat formats
 * Supports automatic model template detection and system instruction integration
 */

import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('ChatTemplateEngine');

class ChatTemplateEngine {
  constructor() {
    this.templates = new Map();
    this.modelConfigs = new Map();
    
    // Default system instructions by model family
    this.defaultSystemInstructions = {
      smollm3: "You are SmolLM3, a helpful AI assistant running locally on the LLM Router system.",
      llama: "You are Llama, a helpful AI assistant created by Meta.",
      mistral: "You are Mistral AI, a helpful assistant.",
      qwen: "You are Qwen, developed by Alibaba Cloud.",
      phi: "You are Phi, a helpful AI assistant developed by Microsoft.",
      gemma: "You are Gemma, a family of lightweight, state-of-the-art open models from Google.",
      default: "You are a helpful AI assistant."
    };
    
    // Pre-defined chat templates for popular models
    this.initializeBuiltInTemplates();
  }

  /**
   * Initialize built-in chat templates for popular models
   */
  initializeBuiltInTemplates() {
    // SmolLM3 template
    this.templates.set('smollm3', {
      name: 'SmolLM3',
      template: `{%- if messages[0]['role'] == 'system' -%}
<|system|>
{{ messages[0]['content'] }}<|end|>
{%- endif -%}
{%- for message in messages -%}
{%- if message['role'] == 'user' -%}
<|user|>
{{ message['content'] }}<|end|>
{%- elif message['role'] == 'assistant' -%}
<|assistant|>
{{ message['content'] }}<|end|>
{%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
<|assistant|>
{%- endif -%}`,
      stopTokens: ['<|end|>', '<|system|>', '<|user|>'],
      systemSupport: true
    });

    // Llama 3.1/3.2 template
    this.templates.set('llama', {
      name: 'Llama 3.1/3.2',
      template: `{%- if messages[0]['role'] == 'system' -%}
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{ messages[0]['content'] }}<|eot_id|>
{%- for message in messages[1:] -%}
{%- if message['role'] == 'user' -%}
<|start_header_id|>user<|end_header_id|>

{{ message['content'] }}<|eot_id|>
{%- elif message['role'] == 'assistant' -%}
<|start_header_id|>assistant<|end_header_id|>

{{ message['content'] }}<|eot_id|>
{%- endif -%}
{%- endfor -%}
{%- else -%}
<|begin_of_text|>
{%- for message in messages -%}
{%- if message['role'] == 'user' -%}
<|start_header_id|>user<|end_header_id|>

{{ message['content'] }}<|eot_id|>
{%- elif message['role'] == 'assistant' -%}
<|start_header_id|>assistant<|end_header_id|>

{{ message['content'] }}<|eot_id|>
{%- endif -%}
{%- endfor -%}
{%- endif -%}
{%- if add_generation_prompt -%}
<|start_header_id|>assistant<|end_header_id|>

{%- endif -%}`,
      stopTokens: ['<|eot_id|>', '<|end_of_text|>'],
      systemSupport: true
    });

    // Mistral/Mixtral template
    this.templates.set('mistral', {
      name: 'Mistral',
      template: `{%- if messages[0]['role'] == 'system' -%}
{%- set system_message = messages[0]['content'] -%}
{%- set messages = messages[1:] -%}
{%- endif -%}
{%- for message in messages -%}
{%- if message['role'] == 'user' -%}
[INST] {%- if system_message -%}{{ system_message }}

{%- endif -%}{{ message['content'] }} [/INST]
{%- elif message['role'] == 'assistant' -%}
{{ message['content'] }}</s>
{%- endif -%}
{%- endfor -%}`,
      stopTokens: ['</s>', '[INST]'],
      systemSupport: true
    });

    // Qwen template
    this.templates.set('qwen', {
      name: 'Qwen',
      template: `{%- if messages[0]['role'] == 'system' -%}
<|im_start|>system
{{ messages[0]['content'] }}<|im_end|>
{%- endif -%}
{%- for message in messages -%}
{%- if message['role'] == 'user' -%}
<|im_start|>user
{{ message['content'] }}<|im_end|>
{%- elif message['role'] == 'assistant' -%}
<|im_start|>assistant
{{ message['content'] }}<|im_end|>
{%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
<|im_start|>assistant
{%- endif -%}`,
      stopTokens: ['<|im_end|>', '<|endoftext|>'],
      systemSupport: true
    });

    // Phi-3 template
    this.templates.set('phi', {
      name: 'Phi-3',
      template: `{%- if messages[0]['role'] == 'system' -%}
<|system|>
{{ messages[0]['content'] }}<|end|>
{%- endif -%}
{%- for message in messages -%}
{%- if message['role'] == 'user' -%}
<|user|>
{{ message['content'] }}<|end|>
{%- elif message['role'] == 'assistant' -%}
<|assistant|>
{{ message['content'] }}<|end|>
{%- endif -%}
{%- endfor -%}
{%- if add_generation_prompt -%}
<|assistant|>
{%- endif -%}`,
      stopTokens: ['<|end|>', '<|endoftext|>'],
      systemSupport: true
    });

    // Gemma template
    this.templates.set('gemma', {
      name: 'Gemma',
      template: `{%- if messages[0]['role'] == 'system' -%}
<start_of_turn>user
{{ messages[0]['content'] }}
{%- for message in messages[1:] -%}
{%- if message['role'] == 'user' -%}

{{ message['content'] }}<end_of_turn>
<start_of_turn>model
{%- elif message['role'] == 'assistant' -%}
{{ message['content'] }}<end_of_turn>
<start_of_turn>user
{%- endif -%}
{%- endfor -%}
{%- else -%}
{%- for message in messages -%}
{%- if message['role'] == 'user' -%}
<start_of_turn>user
{{ message['content'] }}<end_of_turn>
<start_of_turn>model
{%- elif message['role'] == 'assistant' -%}
{{ message['content'] }}<end_of_turn>
<start_of_turn>user
{%- endif -%}
{%- endfor -%}
{%- endif -%}`,
      stopTokens: ['<end_of_turn>', '<eos>'],
      systemSupport: false
    });

    logger.success(`✅ Initialized ${this.templates.size} built-in chat templates`);
  }

  /**
   * Auto-detect model template from model path or config
   */
  async detectModelTemplate(modelPath, modelConfig = null) {
    try {
      logger.info(`🔍 Auto-detecting chat template for: ${modelPath}`);
      
      // First, try to read template from model config
      if (modelConfig?.chat_template) {
        logger.info('📋 Found chat_template in model config');
        return this.parseJinjaTemplate(modelConfig.chat_template, modelPath);
      }
      
      // Try to read tokenizer config
      const tokenizerConfigPath = path.join(modelPath, 'tokenizer_config.json');
      if (fs.existsSync(tokenizerConfigPath)) {
        const tokenizerConfig = JSON.parse(fs.readFileSync(tokenizerConfigPath, 'utf8'));
        if (tokenizerConfig.chat_template) {
          logger.success('✅ Found chat template in tokenizer_config.json');
          return this.parseJinjaTemplate(tokenizerConfig.chat_template, modelPath);
        }
      }
      
      // Fallback: detect based on model name/path
      const modelName = path.basename(modelPath).toLowerCase();
      const detectedFamily = this.detectModelFamily(modelName);
      
      if (this.templates.has(detectedFamily)) {
        logger.success(`✅ Auto-detected template family: ${detectedFamily}`);
        return {
          family: detectedFamily,
          template: this.templates.get(detectedFamily),
          source: 'auto-detection'
        };
      }
      
      // Use default template
      logger.warn(`⚠️ No specific template found, using SmolLM3 default`);
      return {
        family: 'smollm3',
        template: this.templates.get('smollm3'),
        source: 'fallback'
      };
      
    } catch (error) {
      logger.error(`❌ Template detection failed: ${error.message}`);
      return {
        family: 'smollm3',
        template: this.templates.get('smollm3'),
        source: 'error-fallback'
      };
    }
  }

  /**
   * Detect model family from name patterns
   */
  detectModelFamily(modelName) {
    const patterns = {
      smollm3: /smollm3|smol.*lm.*3/i,
      llama: /llama|meta.*llama/i,
      mistral: /mistral|mixtral/i,
      qwen: /qwen|qwen2/i,
      phi: /phi.*3|microsoft.*phi/i,
      gemma: /gemma|google.*gemma/i
    };
    
    for (const [family, pattern] of Object.entries(patterns)) {
      if (pattern.test(modelName)) {
        return family;
      }
    }
    
    return 'default';
  }

  /**
   * Parse raw Jinja2 template from model config
   */
  parseJinjaTemplate(rawTemplate, modelPath) {
    try {
      // Basic Jinja2 template parsing (simplified)
      const template = {
        name: `Custom (${path.basename(modelPath)})`,
        template: rawTemplate,
        stopTokens: this.extractStopTokens(rawTemplate),
        systemSupport: rawTemplate.includes('system')
      };
      
      logger.success('✅ Parsed custom Jinja2 template from model');
      return {
        family: 'custom',
        template: template,
        source: 'model-config'
      };
      
    } catch (error) {
      logger.error(`❌ Failed to parse Jinja2 template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract stop tokens from template
   */
  extractStopTokens(template) {
    const tokens = [];
    const patterns = [
      /<\|[^|]+\|>/g,  // <|token|>
      /<[^>]+>/g,      // <token>
      /\[[^\]]+\]/g,   // [token]
    ];
    
    patterns.forEach(pattern => {
      const matches = template.match(pattern);
      if (matches) {
        tokens.push(...matches);
      }
    });
    
    return [...new Set(tokens)]; // Remove duplicates
  }

  /**
   * Format messages using the appropriate chat template
   */
  async formatMessages(messages, modelPath, options = {}) {
    try {
      // Auto-detect or use provided template
      const templateInfo = await this.detectModelTemplate(modelPath, options.modelConfig);
      const template = templateInfo.template;
      
      // Add default system message if none provided
      const formattedMessages = this.ensureSystemMessage(messages, templateInfo.family, options);
      
      // Render the template
      const formatted = this.renderTemplate(template.template, {
        messages: formattedMessages,
        add_generation_prompt: options.addGenerationPrompt !== false
      });
      
      logger.success(`✅ Formatted ${formattedMessages.length} messages using ${template.name} template`);
      
      return {
        formatted,
        template: template.name,
        stopTokens: template.stopTokens,
        systemSupport: template.systemSupport,
        family: templateInfo.family
      };
      
    } catch (error) {
      logger.error(`❌ Message formatting failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure system message exists with appropriate content
   */
  ensureSystemMessage(messages, modelFamily, options) {
    // If system message already exists, keep it
    if (messages.length > 0 && messages[0].role === 'system') {
      return messages;
    }
    
    // Skip system message if disabled
    if (options.useSystemPrompt === false) {
      return messages;
    }
    
    // Add default system message
    const systemContent = options.systemPrompt || 
                         this.defaultSystemInstructions[modelFamily] || 
                         this.defaultSystemInstructions.default;
    
    return [
      { role: 'system', content: systemContent },
      ...messages
    ];
  }

  /**
   * Simple Jinja2-like template renderer
   */
  renderTemplate(template, context) {
    let result = template;
    
    // Handle conditional blocks {%- if ... -%}
    result = this.processConditionals(result, context);
    
    // Handle for loops {%- for ... -%}
    result = this.processLoops(result, context);
    
    // Handle variable substitution {{ variable }}
    result = this.processVariables(result, context);
    
    // Clean up whitespace from Jinja2 control characters
    result = result.replace(/{%-?\s*endif\s*-?%}/g, '');
    result = result.replace(/{%-?\s*endfor\s*-?%}/g, '');
    result = result.replace(/\n\s*\n/g, '\n'); // Remove empty lines
    
    return result.trim();
  }

  /**
   * Process Jinja2 conditional statements
   */
  processConditionals(template, context) {
    // Handle if-elif-else-endif blocks with proper parsing
    const ifPattern = /{%-?\s*if\s+([^%]+?)\s*-?%}(.*?){%-?\s*endif\s*-?%}/gs;
    
    return template.replace(ifPattern, (match, condition, content) => {
      // Parse the conditional block structure
      const blocks = this.parseConditionalBlocks(content);
      
      // Check main if condition
      if (this.evaluateCondition(condition, context)) {
        return blocks.if || '';
      }
      
      // Check elif conditions
      for (const elifBlock of blocks.elif) {
        if (this.evaluateCondition(elifBlock.condition, context)) {
          return elifBlock.content || '';
        }
      }
      
      // Return else content if available
      return blocks.else || '';
    });
  }
  
  /**
   * Parse conditional block structure (if/elif/else/endif)
   */
  parseConditionalBlocks(content) {
    const result = {
      if: '',
      elif: [],
      else: ''
    };
    
    let remaining = content;
    let currentPos = 0;
    
    // Find first elif or else
    const elifMatch = remaining.match(/{%-?\s*elif\s+([^%]+?)\s*-?%}/);
    const elseMatch = remaining.match(/{%-?\s*else\s*-?%}/);
    
    let firstSpecialPos = remaining.length;
    if (elifMatch && (!elseMatch || elifMatch.index < elseMatch.index)) {
      firstSpecialPos = elifMatch.index;
    } else if (elseMatch) {
      firstSpecialPos = elseMatch.index;
    }
    
    // Extract if content
    result.if = remaining.substring(0, firstSpecialPos).trim();
    remaining = remaining.substring(firstSpecialPos);
    
    // Process elif blocks
      while (remaining.length > 0) {
      const elifMatch = remaining.match(/{%-?\s*elif\s+([^%]+?)\s*-?%}/);
      if (!elifMatch) break;
      
      const condition = elifMatch[1];
      remaining = remaining.substring(elifMatch.index + elifMatch[0].length);
      
      // Find next elif, else, or end
      const nextElifMatch = remaining.match(/{%-?\s*elif\s+([^%]+?)\s*-?%}/);
      const nextElseMatch = remaining.match(/{%-?\s*else\s*-?%}/);
      
      let nextPos = remaining.length;
      if (nextElifMatch && (!nextElseMatch || nextElifMatch.index < nextElseMatch.index)) {
        nextPos = nextElifMatch.index;
      } else if (nextElseMatch) {
        nextPos = nextElseMatch.index;
      }
      
      const elifContent = remaining.substring(0, nextPos).trim();
      result.elif.push({ condition, content: elifContent });
      remaining = remaining.substring(nextPos);
    }
    
    // Process else block
    const elseMatch2 = remaining.match(/{%-?\s*else\s*-?%}/);
    if (elseMatch2) {
      remaining = remaining.substring(elseMatch2.index + elseMatch2[0].length);
      result.else = remaining.trim();
    }
    
    return result;
  }

  /**
   * Process Jinja2 for loops
   */
  processLoops(template, context) {
    const forPattern = /{%-?\s*for\s+(\w+)\s+in\s+([^%]+?)\s*-?%}(.*?){%-?\s*endfor\s*-?%}/gs;
    
    return template.replace(forPattern, (match, variable, collection, content) => {
      const items = this.evaluateExpression(collection, context);
      if (!Array.isArray(items)) return '';
      
      return items.map((item, index) => {
        const loopContext = { ...context, [variable]: item, loop: { index, index0: index } };
        return this.processVariables(content, loopContext);
      }).join('');
    });
  }

  /**
   * Process Jinja2 variable substitution
   */
  processVariables(template, context) {
    const varPattern = /\{\{\s*([^}]+?)\s*\}\}/g;
    
    return template.replace(varPattern, (match, expression) => {
      const value = this.evaluateExpression(expression, context);
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * Evaluate Jinja2 conditions
   */
  evaluateCondition(condition, context) {
    try {
      // Handle array access and property access
      condition = condition.trim();
      
      // Handle messages[0]['role'] == 'system'
      if (condition.includes('==')) {
        const [left, right] = condition.split('==').map(s => s.trim());
        const leftValue = this.evaluateExpression(left, context);
        const rightValue = this.evaluateExpression(right.replace(/'/g, ''), context);
        return leftValue === rightValue;
      }
      
      // Handle simple existence checks
      const value = this.evaluateExpression(condition, context);
      return Boolean(value);
      
    } catch (error) {
      logger.warn(`⚠️ Failed to evaluate condition: ${condition}`);
      return false;
    }
  }

  /**
   * Evaluate Jinja2 expressions
   */
  evaluateExpression(expression, context) {
    try {
      expression = expression.trim();
      
      // Remove quotes for string literals
      if ((expression.startsWith("'") && expression.endsWith("'")) ||
          (expression.startsWith('"') && expression.endsWith('"'))) {
        return expression.slice(1, -1);
      }
      
      // Handle array slicing messages[1:]
      if (expression.includes('[') && expression.includes(':')) {
        const [arrayName, slice] = expression.split('[');
        const array = context[arrayName];
        if (Array.isArray(array)) {
          const sliceMatch = slice.match(/(\d*):(\d*)/);
          if (sliceMatch) {
            const start = sliceMatch[1] ? parseInt(sliceMatch[1]) : 0;
            const end = sliceMatch[2] ? parseInt(sliceMatch[2]) : array.length;
            return array.slice(start, end);
          }
        }
      }
      
      // Handle array access messages[0]
      if (expression.includes('[') && expression.includes(']')) {
        const [objName, ...rest] = expression.split('[');
        let obj = context[objName];
        
        // Process each bracket access
        const accessors = rest.join('[').replace(/]/g, '').split('[');
        for (const accessor of accessors) {
          if (accessor.includes("'")) {
            // Property access ['role']
            const prop = accessor.replace(/'/g, '');
            obj = obj?.[prop];
          } else {
            // Index access [0]
            const index = parseInt(accessor);
            obj = obj?.[index];
          }
        }
        return obj;
      }
      
      // Simple property access
      if (expression.includes('.')) {
        const parts = expression.split('.');
        let value = context;
        for (const part of parts) {
          value = value?.[part];
        }
        return value;
      }
      
      // Direct context access
      return context[expression];
      
    } catch (error) {
      logger.warn(`⚠️ Failed to evaluate expression: ${expression}`);
      return undefined;
    }
  }

  /**
   * Add a custom chat template
   */
  addCustomTemplate(name, template) {
    this.templates.set(name, template);
    logger.success(`✅ Added custom template: ${name}`);
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template details
   */
  getTemplate(name) {
    return this.templates.get(name);
  }
}

export default ChatTemplateEngine;