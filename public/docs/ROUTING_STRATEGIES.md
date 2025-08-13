# 🧭 Routing Strategies - The Art of Model Selection

*Choosing the right model at the right time for the right reason*

## Strategy Overview

```javascript
const strategies = {
  'quality-first': 'Best output regardless of cost/speed',
  'cost-optimized': 'Minimize inference costs',
  'speed-priority': 'Fastest response time',
  'balanced': 'Optimize all factors equally',
  'round-robin': 'Fair distribution',
  'least-loaded': 'Load balancing',
  'capability-match': 'Match model features to task',
  'adaptive': 'Learn from patterns'
};
```

## Quality-First Strategy

**When to use**: Production applications requiring best output

```javascript
router.setStrategy('quality-first');

// How it works internally
function selectByQuality(models, prompt) {
  return models.sort((a, b) => 
    b.qualityScore - a.qualityScore
  )[0];
}
```

**Scoring factors**:
- Model size (bigger = better)
- Architecture type (newer = better)
- Task-specific performance
- User feedback scores

## Cost-Optimized Strategy

**When to use**: High-volume, budget-conscious applications

```javascript
router.setStrategy('cost-optimized');

// Cost calculation
const costs = {
  'gpt-4': 0.03,      // $/1K tokens
  'claude': 0.024,
  'llama': 0,         // Self-hosted
  'mistral': 0.0002
};
```

**Optimization factors**:
- Token pricing
- Compute costs (GPU/CPU time)
- Cache hit probability
- Batch efficiency

## Speed-Priority Strategy

**When to use**: Real-time applications, chatbots

```javascript
router.setStrategy('speed-priority');

// Latency tracking
const latencyProfile = {
  'small-model': { p50: 50, p95: 100, p99: 150 },
  'medium-model': { p50: 200, p95: 400, p99: 600 },
  'large-model': { p50: 500, p95: 1000, p99: 2000 }
};
```

## Custom Strategy Implementation

```javascript
class DomainAwareStrategy {
  route(models, context) {
    const domain = this.detectDomain(context.prompt);
    
    const domainExperts = {
      'code': ['codellama', 'gpt-4'],
      'math': ['mathllm', 'claude'],
      'creative': ['claude', 'gpt-4'],
      'factual': ['llama-70b', 'gpt-3.5']
    };
    
    const preferred = domainExperts[domain] || [];
    return models.find(m => 
      preferred.includes(m.name)
    ) || models[0];
  }
  
  detectDomain(prompt) {
    if (/\b(code|function|debug)\b/i.test(prompt)) return 'code';
    if (/\b(calculate|equation|solve)\b/i.test(prompt)) return 'math';
    if (/\b(story|poem|creative)\b/i.test(prompt)) return 'creative';
    return 'factual';
  }
}

router.addStrategy('domain-aware', new DomainAwareStrategy());
```

## Adaptive Strategy

**Self-learning routing based on outcomes**

```javascript
class AdaptiveRouter {
  constructor() {
    this.history = [];
    this.modelScores = new Map();
  }
  
  async route(models, context) {
    // Learn from history
    const similar = this.findSimilar(context.prompt);
    if (similar) {
      return similar.bestModel;
    }
    
    // Explore new combinations
    return this.explore(models);
  }
  
  recordOutcome(prompt, model, satisfaction) {
    this.history.push({ prompt, model, satisfaction });
    this.updateScores(model, satisfaction);
  }
  
  updateScores(model, satisfaction) {
    const current = this.modelScores.get(model) || 0;
    const updated = current * 0.9 + satisfaction * 0.1;
    this.modelScores.set(model, updated);
  }
}
```

## Strategy Combinations

```javascript
// Time-based strategy switching
class TimeAwareRouter {
  route(models, context) {
    const hour = new Date().getHours();
    
    if (hour >= 9 && hour < 17) {
      // Business hours: optimize for speed
      return this.speedPriority(models);
    } else {
      // Off-hours: optimize for quality
      return this.qualityFirst(models);
    }
  }
}

// User-tier based routing
class TierBasedRouter {
  route(models, context) {
    switch(context.userTier) {
      case 'premium':
        return this.selectBest(models);
      case 'standard':
        return this.selectBalanced(models);
      case 'free':
        return this.selectEfficient(models);
    }
  }
}
```

## Performance Metrics

```javascript
// Track strategy effectiveness
const strategyMetrics = {
  'quality-first': {
    avgSatisfaction: 0.92,
    avgLatency: 850,
    avgCost: 0.05
  },
  'speed-priority': {
    avgSatisfaction: 0.78,
    avgLatency: 120,
    avgCost: 0.02
  },
  'balanced': {
    avgSatisfaction: 0.85,
    avgLatency: 400,
    avgCost: 0.03
  }
};
```

## Configuration Examples

```javascript
// Development
const devConfig = {
  strategy: 'speed-priority',
  fallbacks: ['local-model'],
  cache: true
};

// Production
const prodConfig = {
  strategy: 'balanced',
  fallbacks: ['gpt-3.5', 'claude', 'local'],
  cache: true,
  monitoring: true
};

// Enterprise
const enterpriseConfig = {
  strategy: 'quality-first',
  fallbacks: ['gpt-4', 'claude-2'],
  sla: { maxLatency: 2000, minQuality: 0.9 }
};
```

## Decision Tree

```
Is quality critical?
├─ Yes → quality-first
└─ No → Is budget limited?
    ├─ Yes → cost-optimized
    └─ No → Is speed critical?
        ├─ Yes → speed-priority
        └─ No → balanced
```

---
*The best strategy is the one that adapts to your needs* 🎯
