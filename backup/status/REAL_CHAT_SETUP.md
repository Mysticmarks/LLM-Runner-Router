# 🤖 Real AI Chat Demo Setup Guide

## Overview

The chat demo now connects to **real AI models** through secure Netlify Functions, providing authentic LLM Router capabilities with live API integrations.

## Supported Providers

- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-3.5-turbo
- **Anthropic**: Claude-3.5-Sonnet, Claude-3-Haiku  
- **Cohere**: Command-R+, Command-R, Command

## Environment Variables Setup

### Required API Keys

Add these environment variables to your Netlify site configuration:

1. Go to Netlify Dashboard → Your Site → Site settings → Environment variables
2. Add the following variables:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Anthropic API Key  
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Cohere API Key
COHERE_API_KEY=your-cohere-api-key-here
```

### Getting API Keys

#### OpenAI
1. Visit [platform.openai.com](https://platform.openai.com)
2. Create account and add billing
3. Go to API Keys section
4. Create new API key

#### Anthropic
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create account and add credits
3. Go to API Keys section  
4. Generate new key

#### Cohere
1. Visit [dashboard.cohere.ai](https://dashboard.cohere.ai)
2. Sign up for free account
3. Navigate to API Keys
4. Copy your API key

## Routing Strategies

### Quality First
- **Priority**: OpenAI → Anthropic → Cohere
- **Use Case**: Best possible responses, cost secondary

### Cost Optimized  
- **Priority**: Cohere → OpenAI → Anthropic
- **Use Case**: Budget-conscious deployments

### Speed Priority
- **Priority**: OpenAI → Cohere → Anthropic  
- **Use Case**: Fastest response times

### Balanced
- **Priority**: Random selection among all providers
- **Use Case**: Even distribution and load balancing

### Round Robin
- **Priority**: Cycles through providers sequentially
- **Use Case**: Fair usage distribution

## Features

### Intelligent Failover
- If primary provider fails, automatically tries next in priority order
- Real-time error handling with user notifications
- Graceful fallback to demo mode if all APIs unavailable

### Real-Time Analytics
- **Response Times**: Actual API call latency
- **Token Usage**: Accurate consumption tracking
- **Provider Selection**: Shows which API handled each request
- **Strategy Performance**: Compare routing effectiveness

### Security
- API keys stored securely in Netlify environment
- No client-side key exposure
- CORS-enabled API endpoints
- Request validation and sanitization

## Local Development

For local testing with Netlify Dev:

```bash
# Install Netlify CLI
npm install -g @netlify/cli

# Create .env file (never commit this!)
echo 'OPENAI_API_KEY=your-key' > .env
echo 'ANTHROPIC_API_KEY=your-key' >> .env  
echo 'COHERE_API_KEY=your-key' >> .env

# Start local development
netlify dev

# Chat demo available at:
# http://localhost:8888/chat/
```

## Deployment

### Automatic Deployment
1. Push code to GitHub main branch
2. Netlify automatically builds and deploys
3. Environment variables applied from dashboard
4. Chat demo live at: `https://your-site.netlify.app/chat/`

### Manual Build Test
```bash
npm run build
# Check dist/chat/ contains updated files
```

## Cost Considerations

### Free Tiers
- **OpenAI**: $5 free credits for new accounts
- **Anthropic**: $5 free credits for new accounts  
- **Cohere**: Generous free tier with rate limits

### Estimated Costs (per 1000 messages)
- **GPT-4o-mini**: ~$0.15
- **Claude-3-Haiku**: ~$0.25
- **Command-R**: ~$0.50

### Cost Control
- Set max tokens limits (default: 150)
- Use cost-optimized routing strategy
- Monitor usage through provider dashboards

## Troubleshooting

### "All providers unavailable" Error
- Check API keys are correctly set in Netlify environment
- Verify API keys have sufficient credits
- Check provider status pages for outages

### Slow Response Times
- Some models may take 2-5 seconds for complex queries
- Check your internet connection
- Try speed-priority routing strategy

### Demo Mode Fallback
- System automatically falls back to simulated responses if APIs fail
- Notification will indicate when using demo mode
- No charges incurred during demo mode

## Monitoring

### Provider Dashboards
- Monitor API usage and costs
- Track rate limit usage
- Set up billing alerts

### Chat Analytics
- Response time trends
- Provider success rates
- Token consumption patterns
- Strategy effectiveness

## Production Considerations

### Rate Limiting
- Implement user session limits
- Add request throttling
- Monitor abuse patterns

### Error Handling
- Enhanced error messages
- Retry logic with exponential backoff
- Circuit breaker patterns

### Performance
- Response caching for repeated queries
- Streaming responses for long content
- Load balancing across regions

Your real AI chat demo is now ready for production use with live model integrations! 🚀