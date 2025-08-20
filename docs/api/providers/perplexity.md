# 🔍 Perplexity AI Provider Documentation

*Complete guide to using Perplexity AI with LLM-Runner-Router*

## What is Perplexity AI?

Perplexity AI is a search-augmented AI platform that provides real-time web-aware responses with citations. Their models combine powerful language understanding with live web search capabilities, making them ideal for applications requiring up-to-date information and factual accuracy.

**Key Strengths:**
- Real-time web search integration with citations
- Access to current information and recent events
- Factual accuracy with source attribution
- Multiple model options including GPT-4 and Claude access
- Simple OpenAI-compatible API

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['perplexity'],
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY
  }
});

const response = await router.generate({
  model: 'llama-3.1-sonar-large-128k-online',
  prompt: 'What are the latest developments in AI technology this week?',
  maxTokens: 500
});

console.log(response.text);
console.log('Sources:', response.citations);
```

### Environment Setup

```bash
# Set your Perplexity API key
export PERPLEXITY_API_KEY=your-perplexity-api-key-here
```

## Configuration

### Environment Variables

```bash
# Required
PERPLEXITY_API_KEY=your-perplexity-api-key

# Optional
PERPLEXITY_BASE_URL=https://api.perplexity.ai  # Default
PERPLEXITY_DEFAULT_MODEL=llama-3.1-sonar-large-128k-online
```

### Configuration Options

```javascript
const perplexityConfig = {
  // Required
  apiKey: process.env.PERPLEXITY_API_KEY,
  
  // Optional
  baseURL: 'https://api.perplexity.ai',                // Default endpoint
  
  // Request configuration
  timeout: 30000,                                      // Request timeout
  maxRetries: 3,                                       // Retry attempts
  
  // Default parameters
  defaultParams: {
    temperature: 0.2,                                  // Lower for factual accuracy
    maxTokens: 1000,
    topP: 0.9,
    topK: 0,
    frequencyPenalty: 1,
    presencePenalty: 1,
    returnCitations: true,                             // Include source citations
    returnImages: false,                               // Include relevant images
    searchRecency: 'auto'                              // 'auto', 'month', 'week', 'day', 'hour'
  },
  
  // Rate limiting
  rateLimiting: {
    requestsPerMinute: 60,                             // Standard limit
    requestsPerSecond: 1                               // Burst limit
  },
  
  // Search configuration
  search: {
    enableWebSearch: true,                             // Enable real-time search
    maxSources: 10,                                    // Maximum sources to cite
    preferredDomains: [],                              // Preferred source domains
    excludedDomains: [],                               // Domains to exclude
    searchLanguage: 'en',                              // Search language
    safeSearch: 'moderate'                             // 'strict', 'moderate', 'off'
  }
};
```

## Available Models

### Sonar Models (Web-Aware)

```javascript
// Sonar Large 128k Online (Best web-aware capabilities)
model: 'llama-3.1-sonar-large-128k-online'

// Sonar Small 128k Online (Faster web-aware responses)
model: 'llama-3.1-sonar-small-128k-online'

// Sonar Large 128k Chat (No web search)
model: 'llama-3.1-sonar-large-128k-chat'

// Sonar Small 128k Chat (No web search)
model: 'llama-3.1-sonar-small-128k-chat'
```

### Llama Models (Standard)

```javascript
// Llama 3.1 70B Instruct
model: 'llama-3.1-70b-instruct'

// Llama 3.1 8B Instruct
model: 'llama-3.1-8b-instruct'
```

### Third-Party Models (Access to GPT-4, Claude)

```javascript
// GPT-4 Omni (via Perplexity)
model: 'gpt-4o'

// Claude 3.5 Sonnet (via Perplexity)
model: 'claude-3.5-sonnet'

// Claude 3 Haiku (via Perplexity)
model: 'claude-3-haiku'
```

## Code Examples

### Current Events and News

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['perplexity'],
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY
  }
});

async function getCurrentNews() {
  const response = await router.generate({
    model: 'llama-3.1-sonar-large-128k-online',
    prompt: 'What are the major technology news stories today? Focus on AI, software development, and startups.',
    maxTokens: 600,
    temperature: 0.1,  // Low temperature for factual accuracy
    searchRecency: 'day'  // Focus on today's news
  });

  console.log('Current tech news:', response.text);
  
  if (response.citations) {
    console.log('\nSources:');
    response.citations.forEach((citation, index) => {
      console.log(`${index + 1}. ${citation.title} - ${citation.url}`);
    });
  }
}

getCurrentNews();
```

### Real-Time Information Lookup

```javascript
async function realTimeQuery() {
  const response = await router.chat({
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      { role: 'user', content: 'What is the current stock price of NVIDIA and what factors are influencing it today?' }
    ],
    maxTokens: 400,
    temperature: 0.2,
    returnCitations: true
  });

  console.log('Real-time response:', response.text);
  
  if (response.citations) {
    console.log('\nData sources:');
    response.citations.forEach(citation => {
      console.log(`- ${citation.title} (${citation.domain})`);
    });
  }
}

realTimeQuery();
```

### Research with Citations

```javascript
async function researchQuery() {
  const response = await router.generate({
    model: 'llama-3.1-sonar-large-128k-online',
    prompt: `
    Research the latest advances in quantum computing. Include information about:
    1. Recent breakthroughs in quantum hardware
    2. New quantum algorithms or applications
    3. Major quantum computing companies and their progress
    4. Timeline for practical quantum computing applications
    
    Provide specific examples and cite your sources.
    `,
    maxTokens: 1000,
    temperature: 0.3,
    searchRecency: 'month'  // Focus on recent developments
  });

  console.log('Research findings:', response.text);
  
  if (response.citations) {
    console.log('\n📚 Sources cited:');
    response.citations.forEach((citation, index) => {
      console.log(`[${index + 1}] ${citation.title}`);
      console.log(`    ${citation.url}`);
      console.log(`    Published: ${citation.publishedDate || 'Unknown'}\n`);
    });
  }
}

researchQuery();
```

### Fact-Checking and Verification

```javascript
async function factCheck() {
  const claims = [
    'Artificial intelligence will replace 50% of jobs by 2030',
    'OpenAI released GPT-5 last month',
    'Quantum computers can break all current encryption'
  ];

  console.log('Fact-checking claims with Perplexity...\n');

  for (const claim of claims) {
    const response = await router.generate({
      model: 'llama-3.1-sonar-large-128k-online',
      prompt: `Fact-check this claim with current evidence: "${claim}". Provide a detailed analysis with sources.`,
      maxTokens: 300,
      temperature: 0.1,
      returnCitations: true
    });

    console.log(`Claim: "${claim}"`);
    console.log(`Analysis: ${response.text}`);
    
    if (response.citations) {
      console.log(`Sources: ${response.citations.length} references found`);
    }
    console.log('---\n');
  }
}

factCheck();
```

### Market and Financial Data

```javascript
async function getMarketData() {
  const response = await router.generate({
    model: 'llama-3.1-sonar-large-128k-online',
    prompt: `
    Provide a current market analysis including:
    1. Today's performance of major tech stocks (AAPL, MSFT, GOOGL, NVDA)
    2. Recent market trends and what's driving them
    3. Any significant economic news affecting the markets today
    
    Include specific numbers and cite financial sources.
    `,
    maxTokens: 600,
    temperature: 0.1,
    searchRecency: 'day'
  });

  console.log('Market analysis:', response.text);
  
  // Extract any numerical data
  const numbers = response.text.match(/\$[\d,]+\.?\d*/g);
  if (numbers) {
    console.log('\nKey figures mentioned:', numbers.join(', '));
  }
}

getMarketData();
```

### Streaming Web-Aware Response

```javascript
async function streamWebResponse() {
  console.log('Streaming web-aware response...\n');

  let citations = [];
  
  for await (const chunk of router.stream({
    model: 'llama-3.1-sonar-large-128k-online',
    prompt: 'What are the latest developments in space exploration and Mars missions? Include recent SpaceX, NASA, and other space agency activities.',
    maxTokens: 800,
    temperature: 0.2,
    returnCitations: true
  })) {
    process.stdout.write(chunk.text);
    
    // Collect citations as they come in
    if (chunk.citations) {
      citations = [...citations, ...chunk.citations];
    }
  }
  
  console.log('\n\n🔗 Sources referenced:');
  const uniqueCitations = citations.filter((citation, index, self) => 
    index === self.findIndex(c => c.url === citation.url)
  );
  
  uniqueCitations.forEach((citation, index) => {
    console.log(`${index + 1}. ${citation.title} - ${citation.url}`);
  });
}

streamWebResponse();
```

### Comparative Analysis

```javascript
async function compareInformation() {
  const topics = [
    'Climate change policies in the US vs EU',
    'AI regulation approaches: US vs China vs EU',
    'Electric vehicle adoption rates by country'
  ];

  for (const topic of topics) {
    console.log(`\n📊 Analyzing: ${topic}\n`);
    
    const response = await router.generate({
      model: 'llama-3.1-sonar-large-128k-online',
      prompt: `Compare and analyze: ${topic}. Provide current data, statistics, and recent developments. Include specific examples and cite sources.`,
      maxTokens: 500,
      temperature: 0.2,
      searchRecency: 'week'
    });

    console.log(response.text);
    
    if (response.citations) {
      console.log(`\n📖 Based on ${response.citations.length} sources`);
    }
  }
}

compareInformation();
```

### Academic Research Helper

```javascript
async function academicResearch() {
  const response = await router.generate({
    model: 'llama-3.1-sonar-large-128k-online',
    prompt: `
    I'm writing a research paper on "The Impact of Large Language Models on Education". 
    Help me find recent academic papers, studies, and credible sources on this topic. 
    Include:
    1. Recent peer-reviewed research (2023-2024)
    2. Key findings and statistics
    3. Different perspectives on the topic
    4. Methodological approaches used in studies
    
    Provide specific paper titles, authors, and publication venues where possible.
    `,
    maxTokens: 800,
    temperature: 0.2,
    searchRecency: 'auto'
  });

  console.log('Academic research findings:', response.text);
  
  if (response.citations) {
    console.log('\n📝 Academic sources found:');
    response.citations
      .filter(citation => 
        citation.url.includes('arxiv.org') || 
        citation.url.includes('.edu') || 
        citation.url.includes('scholar.google') ||
        citation.url.includes('pubmed')
      )
      .forEach((citation, index) => {
        console.log(`${index + 1}. ${citation.title}`);
        console.log(`   ${citation.url}\n`);
      });
  }
}

academicResearch();
```

## Best Practices

### 1. Model Selection for Web-Aware Tasks

```javascript
const perplexityModelStrategy = {
  // Real-time information and current events
  realTime: 'llama-3.1-sonar-large-128k-online',
  
  // Fast web-aware responses
  fastWeb: 'llama-3.1-sonar-small-128k-online',
  
  // Offline reasoning (no web search)
  offline: 'llama-3.1-sonar-large-128k-chat',
  
  // Maximum quality for important queries
  premium: 'gpt-4o',  // Access via Perplexity
  
  // Fast third-party model access
  efficient: 'claude-3-haiku'
};
```

### 2. Search Optimization

```javascript
// Configure for optimal search results
const searchOptimizedRouter = new LLMRouter({
  providers: ['perplexity'],
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
    search: {
      enableWebSearch: true,
      maxSources: 15,                    // More sources for better accuracy
      preferredDomains: [                // Trust reliable sources
        'reuters.com',
        'bloomberg.com', 
        'nature.com',
        'arxiv.org',
        'techcrunch.com',
        'wired.com'
      ],
      excludedDomains: [                 // Exclude unreliable sources
        'reddit.com',
        'quora.com',
        'yahoo.com'
      ],
      searchLanguage: 'en',
      safeSearch: 'moderate'
    },
    defaultParams: {
      temperature: 0.1,                  // Low for factual accuracy
      returnCitations: true,             // Always include sources
      searchRecency: 'week'              // Focus on recent information
    }
  }
});
```

### 3. Citation Management

```javascript
class CitationManager {
  constructor() {
    this.citationHistory = [];
    this.sourceReliability = new Map();
  }
  
  processCitations(citations) {
    const processed = citations.map(citation => {
      // Extract domain for reliability scoring
      const domain = new URL(citation.url).hostname;
      
      // Score source reliability (simple heuristic)
      let reliabilityScore = this.calculateReliability(domain);
      
      return {
        ...citation,
        domain,
        reliabilityScore,
        accessDate: new Date().toISOString()
      };
    });
    
    this.citationHistory.push(...processed);
    return processed;
  }
  
  calculateReliability(domain) {
    const reliableSourcePatterns = [
      /\.edu$/,              // Educational institutions
      /\.gov$/,              // Government sources
      /\.org$/,              // Organizations
      /reuters\.com/,        // Reuters
      /bloomberg\.com/,      // Bloomberg
      /nature\.com/,         // Nature
      /science\.org/,        // Science
      /arxiv\.org/           // ArXiv
    ];
    
    const score = reliableSourcePatterns.reduce((acc, pattern) => {
      return pattern.test(domain) ? acc + 1 : acc;
    }, 0);
    
    return Math.min(score / reliableSourcePatterns.length, 1);
  }
  
  getTopSources(minReliability = 0.3) {
    return this.citationHistory
      .filter(citation => citation.reliabilityScore >= minReliability)
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
      .slice(0, 10);
  }
  
  generateBibliography(citations) {
    return citations.map(citation => {
      const date = citation.publishedDate || 'n.d.';
      return `${citation.title}. (${date}). Retrieved from ${citation.url}`;
    }).join('\n');
  }
}
```

### 4. Error Handling and Reliability

```javascript
async function reliablePerplexityCall() {
  const maxRetries = 3;
  const citationManager = new CitationManager();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await router.generate({
        model: 'llama-3.1-sonar-large-128k-online',
        prompt: 'Your query here',
        maxTokens: 500,
        temperature: 0.1,
        returnCitations: true
      });
      
      // Process and validate citations
      if (response.citations) {
        response.processedCitations = citationManager.processCitations(response.citations);
        response.reliableSources = citationManager.getTopSources();
      }
      
      // Check if we have sufficient reliable sources
      if (response.reliableSources && response.reliableSources.length < 2) {
        console.warn('Limited reliable sources found, consider manual verification');
      }
      
      return response;
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error.message);
      
      switch (error.type) {
        case 'rate_limit_exceeded':
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Rate limited, waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
          
        case 'search_timeout':
          console.log('Search timeout, trying without web search...');
          return await router.generate({
            model: 'llama-3.1-sonar-large-128k-chat',  // Offline model
            prompt: 'Your query here',
            maxTokens: 500
          });
          
        case 'no_results_found':
          console.log('No search results, broadening query...');
          // Implement query broadening logic
          break;
          
        default:
          if (attempt === maxRetries - 1) {
            throw error;
          }
          continue;
      }
    }
  }
}
```

### 5. Query Optimization

```javascript
class QueryOptimizer {
  static optimizeForSearch(query) {
    // Add temporal context for better search results
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    
    // Enhance query with time context
    if (!query.includes(year.toString()) && !query.includes('recent') && !query.includes('latest')) {
      query += ` (${year})`;
    }
    
    // Add specificity keywords
    const specificityKeywords = ['current', 'latest', 'recent', 'today', 'this week'];
    const hasSpecificity = specificityKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
    
    if (!hasSpecificity) {
      query = `Current ${query}`;
    }
    
    return query;
  }
  
  static addFactCheckingContext(query) {
    return `Please fact-check and verify: ${query}. Include specific sources and dates.`;
  }
  
  static addComparisonContext(query, ...entities) {
    return `Compare and contrast ${entities.join(' vs ')} regarding: ${query}. Include current data and sources.`;
  }
  
  static addAnalysisContext(query) {
    return `Provide a detailed analysis of: ${query}. Include trends, statistics, and expert opinions with sources.`;
  }
}

// Usage examples
const optimizedQuery = QueryOptimizer.optimizeForSearch('AI developments');
const factCheckQuery = QueryOptimizer.addFactCheckingContext('GPT-5 was released');
const comparisonQuery = QueryOptimizer.addComparisonContext('market share', 'iPhone', 'Samsung Galaxy');
```

## Troubleshooting

### Common Issues

#### Issue: "No search results found"
```
Error: No relevant search results found for the query.
```

**Solution**: Broaden the query or add context:
```javascript
// Try broader search terms
const fallbackQueries = [
  query,                                    // Original query
  query.replace(/specific terms/, 'general terms'),  // Broaden terms
  `overview of ${query}`,                   // Add context
  `${query} recent developments`,           // Add recency
  `${query} 2024`                          // Add year
];
```

#### Issue: "Rate limit exceeded"
```
Error: API rate limit exceeded. Please try again later.
```

**Solution**: Implement proper rate limiting:
```javascript
// Perplexity rate limits
const rateLimits = {
  free: { rpm: 20, rps: 0.33 },
  pro: { rpm: 60, rps: 1 },
  enterprise: { rpm: 'custom', rps: 'custom' }
};

// Implement backoff strategy
async function withRateLimit(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.type === 'rate_limit_exceeded') {
      const resetTime = error.resetTime || 60000; // 1 minute default
      console.log(`Rate limited, waiting ${resetTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, resetTime));
      return await fn(); // Retry once
    }
    throw error;
  }
}
```

#### Issue: "Citations missing or incomplete"
```
Warning: Response returned with limited or no citations.
```

**Solution**: Verify search functionality and model selection:
```javascript
// Ensure using online models for citations
const onlineModels = [
  'llama-3.1-sonar-large-128k-online',
  'llama-3.1-sonar-small-128k-online'
];

// Check if citations are enabled
const response = await router.generate({
  model: 'llama-3.1-sonar-large-128k-online',
  prompt: query,
  returnCitations: true,  // Explicitly request citations
  maxTokens: 500
});

if (!response.citations || response.citations.length === 0) {
  console.warn('No citations returned - check query specificity');
}
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['perplexity'],
  debug: true,
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false,
    logCitations: true,      // Log citation details
    logSearchQueries: true,  // Log internal search queries
    logSourceScoring: true   // Log source reliability scoring
  }
});
```

## Pricing Information

### Text Generation Models (per 1M tokens)
- **Sonar Small 128k Online**: $0.20 (input), $0.20 (output)
- **Sonar Large 128k Online**: $1.00 (input), $1.00 (output)
- **Sonar Small 128k Chat**: $0.20 (input), $0.20 (output)
- **Sonar Large 128k Chat**: $1.00 (input), $1.00 (output)
- **Llama 3.1 8B Instruct**: $0.20 (input), $0.20 (output)
- **Llama 3.1 70B Instruct**: $1.00 (input), $1.00 (output)

### Third-Party Model Access (per 1M tokens)
- **GPT-4 Omni**: $5.00 (input), $15.00 (output)
- **Claude 3.5 Sonnet**: $3.00 (input), $15.00 (output)
- **Claude 3 Haiku**: $0.25 (input), $1.25 (output)

### Rate Limits by Tier
- **Free**: 20 requests/month
- **Pro ($20/month)**: 600 requests/month
- **Enterprise**: Custom limits and pricing

*Perplexity offers competitive pricing with real-time search capabilities. Check Perplexity AI pricing for current rates.*

## Resources

- **Perplexity AI**: [perplexity.ai](https://perplexity.ai)
- **API Documentation**: [docs.perplexity.ai](https://docs.perplexity.ai)
- **Developer Portal**: [perplexity.ai/hub](https://perplexity.ai/hub)
- **Discord Community**: [discord.gg/perplexity](https://discord.gg/perplexity)
- **Blog**: [blog.perplexity.ai](https://blog.perplexity.ai)
- **Research Papers**: [perplexity.ai/research](https://perplexity.ai/research)

---

*Built with 💚 by Echo AI Systems*