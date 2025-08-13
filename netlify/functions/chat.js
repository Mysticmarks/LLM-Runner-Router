/**
 * Netlify Functions - Real LLM Chat API
 * Handles routing to multiple LLM providers with intelligent model selection
 */

const PROVIDERS = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    })
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    })
  },
  cohere: {
    endpoint: 'https://api.cohere.ai/v1/chat',
    models: ['command-r-plus', 'command-r', 'command'],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    })
  }
};

const ROUTING_STRATEGIES = {
  'quality-first': () => ['openai', 'anthropic', 'cohere'],
  'cost-optimized': () => ['cohere', 'openai', 'anthropic'],
  'speed-priority': () => ['openai', 'cohere', 'anthropic'],
  'balanced': () => shuffle(['openai', 'anthropic', 'cohere']),
  'random': () => shuffle(['openai', 'anthropic', 'cohere']),
  'round-robin': (() => {
    let index = 0;
    return () => {
      const providers = ['openai', 'anthropic', 'cohere'];
      const result = providers.slice(index).concat(providers.slice(0, index));
      index = (index + 1) % providers.length;
      return result;
    };
  })()
};

function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatOpenAIRequest(message, options) {
  return {
    model: options.model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: message }],
    max_tokens: options.maxTokens || 150,
    temperature: options.temperature || 0.7,
    stream: false
  };
}

function formatAnthropicRequest(message, options) {
  return {
    model: options.model || 'claude-3-haiku-20240307',
    max_tokens: options.maxTokens || 150,
    temperature: options.temperature || 0.7,
    messages: [{ role: 'user', content: message }]
  };
}

function formatCohereRequest(message, options) {
  return {
    model: options.model || 'command',
    message: message,
    max_tokens: options.maxTokens || 150,
    temperature: options.temperature || 0.7
  };
}

async function makeRequest(provider, message, options) {
  const config = PROVIDERS[provider];
  let apiKey;
  
  // Get API key from environment variables
  switch (provider) {
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY;
      break;
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY;
      break;
    case 'cohere':
      apiKey = process.env.COHERE_API_KEY;
      break;
  }

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY not configured`);
  }

  // Format request based on provider
  let requestBody;
  switch (provider) {
    case 'openai':
      requestBody = formatOpenAIRequest(message, options);
      break;
    case 'anthropic':
      requestBody = formatAnthropicRequest(message, options);
      break;
    case 'cohere':
      requestBody = formatCohereRequest(message, options);
      break;
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: config.headers(apiKey),
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${provider} API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Extract response text based on provider format
  let responseText;
  let tokensUsed = 0;
  
  switch (provider) {
    case 'openai':
      responseText = data.choices[0]?.message?.content || '';
      tokensUsed = data.usage?.total_tokens || 0;
      break;
    case 'anthropic':
      responseText = data.content[0]?.text || '';
      tokensUsed = data.usage?.input_tokens + data.usage?.output_tokens || 0;
      break;
    case 'cohere':
      responseText = data.text || '';
      tokensUsed = data.meta?.tokens?.input_tokens + data.meta?.tokens?.output_tokens || 0;
      break;
  }

  return {
    text: responseText,
    provider,
    model: requestBody.model,
    tokensUsed,
    success: true
  };
}

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, strategy = 'balanced', options = {} } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Get provider priority based on strategy
    const getProviderOrder = ROUTING_STRATEGIES[strategy] || ROUTING_STRATEGIES['balanced'];
    const providerOrder = typeof getProviderOrder === 'function' ? getProviderOrder() : getProviderOrder;

    let lastError;
    const startTime = Date.now();

    // Try providers in order until one succeeds
    for (const provider of providerOrder) {
      try {
        console.log(`Attempting ${provider} for strategy: ${strategy}`);
        
        const result = await makeRequest(provider, message, options);
        const responseTime = Date.now() - startTime;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...result,
            strategy,
            responseTime,
            timestamp: new Date().toISOString()
          })
        };
      } catch (error) {
        console.log(`${provider} failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    // If all providers failed
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'All LLM providers unavailable',
        details: lastError?.message,
        strategy,
        responseTime: Date.now() - startTime
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};