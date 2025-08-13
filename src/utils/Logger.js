/**
 * 🌈 Universal Logger - Quantum Observation Apparatus
 * Chronicling the digital journey with style and substance
 * Echo AI Systems - Where logs become poetry
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

export class Logger {
  constructor(context = 'System') {
    this.context = context;
    this.level = process.env.LOG_LEVEL || 'info';
    this.colorize = process.env.NO_COLOR !== 'true';
    this.emoji = process.env.NO_EMOJI !== 'true';
    
    this.levels = {
      debug: { priority: 0, color: 'cyan', emoji: '🔍' },
      info: { priority: 1, color: 'blue', emoji: '💡' },
      success: { priority: 2, color: 'green', emoji: '✅' },
      warn: { priority: 3, color: 'yellow', emoji: '⚠️' },
      error: { priority: 4, color: 'red', emoji: '❌' }
    };
  }

  log(level, message, ...args) {
    const config = this.levels[level];
    if (!config || config.priority < this.levels[this.level].priority) return;
    
    const timestamp = new Date().toISOString();
    const emoji = this.emoji ? config.emoji : '';
    const color = this.colorize ? colors[config.color] : '';
    const reset = this.colorize ? colors.reset : '';
    
    const formatted = `${color}[${timestamp}] ${emoji} [${this.context}] ${message}${reset}`;
    
    console.log(formatted, ...args);
    
    // Emit for external monitoring
    if (typeof process !== 'undefined' && process.emit) {
      process.emit('log', { level, context: this.context, message, args, timestamp });
    }
  }

  debug(message, ...args) { this.log('debug', message, ...args); }
  info(message, ...args) { this.log('info', message, ...args); }
  success(message, ...args) { this.log('success', message, ...args); }
  warn(message, ...args) { this.log('warn', message, ...args); }
  error(message, ...args) { this.log('error', message, ...args); }

  child(context) {
    return new Logger(`${this.context}:${context}`);
  }
}

export default Logger;
