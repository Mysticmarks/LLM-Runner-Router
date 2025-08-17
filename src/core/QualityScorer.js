/**
 * 🌟 Quality Scorer - Excellence Quantification Matrix
 * Measuring the ineffable quality of neural outputs
 * Echo AI Systems - Where quality transcends mere metrics
 */

import { Logger } from '../utils/Logger.js';

const logger = new Logger('QualityScorer');

class QualityScorer {
  constructor() {
    // Model quality baselines (0-1 scale)
    this.baseScores = {
      'gpt-4': 0.95,
      'claude': 0.93,
      'gpt-3.5': 0.85,
      'llama-70b': 0.88,
      'llama-13b': 0.82,
      'llama-7b': 0.78,
      'mistral': 0.84,
      'default': 0.75
    };
    
    // Task-specific modifiers
    this.taskModifiers = {
      'code': { 'gpt-4': 1.1, 'claude': 1.05 },
      'creative': { 'claude': 1.1, 'gpt-4': 1.05 },
      'analysis': { 'gpt-4': 1.1, 'claude': 1.1 },
      'translation': { 'gpt-3.5': 1.05 },
      'summary': { 'claude': 1.05 }
    };
  }

  async score(model, prompt) {
    const baseScore = await this.computeBaseScore(model);
    const taskScore = this.computeTaskScore(model, prompt);
    const contextScore = this.computeContextScore(model, prompt);
    
    // Weighted combination
    const finalScore = (baseScore * 0.5) + (taskScore * 0.3) + (contextScore * 0.2);
    
    logger.debug(`🌟 Quality score for ${model.name}: ${finalScore.toFixed(3)}`);
    return Math.min(1.0, finalScore);
  }

  async computeBaseScore(model) {
    const name = model.name.toLowerCase();
    
    // Find matching base score
    for (const [key, score] of Object.entries(this.baseScores)) {
      if (name.includes(key)) return score;
    }
    
    // Estimate based on parameters
    const sizeBonus = Math.log10((model.parameters?.size || 1000000) / 1000000) / 10;
    return Math.min(1.0, this.baseScores.default + sizeBonus);
  }

  computeTaskScore(model, prompt) {
    const taskType = this.detectTaskType(prompt);
    const modifiers = this.taskModifiers[taskType] || {};
    
    const modelKey = Object.keys(modifiers).find(key => 
      model.name.toLowerCase().includes(key)
    );
    
    const modifier = modifiers[modelKey] || 1.0;
    const baseScore = this.baseScores[modelKey] || this.baseScores.default;
    
    return baseScore * modifier;
  }

  computeContextScore(model, prompt) {
    // Score based on context window utilization
    const promptLength = prompt.length;
    const contextSize = model.context || 2048;
    
    // Optimal utilization is 20-60% of context
    const utilization = promptLength / contextSize;
    
    if (utilization < 0.2) return 0.9; // Underutilized
    if (utilization > 0.8) return 0.7; // Risk of truncation
    if (utilization > 0.6) return 0.85; // Getting full
    
    return 1.0; // Optimal range
  }

  detectTaskType(prompt) {
    const lower = prompt.toLowerCase();
    
    if (/\b(code|function|implement|debug)\b/.test(lower)) return 'code';
    if (/\b(write|story|poem|creative)\b/.test(lower)) return 'creative';
    if (/\b(analyze|explain|compare)\b/.test(lower)) return 'analysis';
    if (/\b(translate|translation)\b/.test(lower)) return 'translation';
    if (/\b(summarize|summary|tldr)\b/.test(lower)) return 'summary';
    
    return 'general';
  }

  rankModels(models, prompt) {
    return Promise.all(
      models.map(async model => ({
        model,
        score: await this.score(model, prompt)
      }))
    ).then(scored => 
      scored.sort((a, b) => b.score - a.score)
    );
  }
}



export default QualityScorer;
export { QualityScorer };
