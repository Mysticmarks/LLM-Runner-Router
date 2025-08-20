# 🌩️ Amazon Bedrock Provider Documentation

*Complete guide to using Amazon Bedrock with LLM-Runner-Router*

## What is Amazon Bedrock?

Amazon Bedrock is a fully managed service that offers high-performing foundation models from leading AI companies through a single API. It provides access to models from Anthropic, Cohere, Meta, Mistral AI, Stability AI, and Amazon's own Titan models.

**Key Strengths:**
- Managed foundation models with enterprise security
- Fine-tuning capabilities and RAG support
- HIPAA eligible and SOC compliance
- Built-in content filtering and safety controls
- Seamless AWS ecosystem integration

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['bedrock'],
  bedrock: {
    region: 'us-east-1',
    // Uses default AWS credential chain
  }
});

const response = await router.generate({
  model: 'anthropic.claude-3-sonnet-20240229-v1:0',
  prompt: 'Explain quantum computing',
  maxTokens: 500
});

console.log(response.text);
```

### With Explicit Credentials

```javascript
const router = new LLMRouter({
  providers: ['bedrock'],
  bedrock: {
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN // Optional
    }
  }
});
```

## Configuration

### Environment Variables

```bash
# AWS Credentials (if not using IAM roles)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SESSION_TOKEN=your-session-token  # Optional for temporary credentials
AWS_REGION=us-east-1                  # Default region

# Or use AWS Profile
AWS_PROFILE=bedrock-profile
```

### Configuration Options

```javascript
const bedrockConfig = {
  region: 'us-east-1',                    // AWS region
  
  // Option 1: Use default credential chain (recommended)
  useDefaultCredentials: true,
  
  // Option 2: Explicit credentials
  credentials: {
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
    sessionToken: 'optional-session-token'
  },
  
  // Option 3: IAM role assumption
  roleArn: 'arn:aws:iam::123456789012:role/BedrockRole',
  
  // Request configuration
  timeout: 30000,                         // Request timeout in ms
  maxRetries: 3,                          // Retry attempts
  
  // Bedrock-specific options
  inferenceConfig: {
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9
  }
};
```

## Available Models

### Anthropic Claude Models

```javascript
// Claude 3 Opus (Most capable)
model: 'anthropic.claude-3-opus-20240229-v1:0'

// Claude 3 Sonnet (Balanced performance)
model: 'anthropic.claude-3-sonnet-20240229-v1:0'

// Claude 3 Haiku (Fastest)
model: 'anthropic.claude-3-haiku-20240307-v1:0'

// Claude v2.1
model: 'anthropic.claude-v2:1'

// Claude v2
model: 'anthropic.claude-v2'

// Claude Instant
model: 'anthropic.claude-instant-v1'
```

### Meta Llama Models

```javascript
// Llama 2 70B Chat
model: 'meta.llama2-70b-chat-v1'

// Llama 2 13B Chat
model: 'meta.llama2-13b-chat-v1'

// Code Llama 34B Instruct
model: 'meta.llama2-34b-code-instruct-v1'
```

### Mistral AI Models

```javascript
// Mistral 7B Instruct
model: 'mistral.mistral-7b-instruct-v0:2'

// Mixtral 8x7B Instruct
model: 'mistral.mixtral-8x7b-instruct-v0:1'

// Mistral Large
model: 'mistral.mistral-large-2402-v1:0'
```

### Amazon Titan Models

```javascript
// Titan Text Express
model: 'amazon.titan-text-express-v1'

// Titan Text Lite
model: 'amazon.titan-text-lite-v1'

// Titan Embeddings
model: 'amazon.titan-embed-text-v1'
```

### Cohere Models

```javascript
// Command Text
model: 'cohere.command-text-v14'

// Command Light Text
model: 'cohere.command-light-text-v14'

// Embed English
model: 'cohere.embed-english-v3'

// Embed Multilingual
model: 'cohere.embed-multilingual-v3'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['bedrock'],
  bedrock: {
    region: 'us-east-1'
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'anthropic.claude-3-sonnet-20240229-v1:0',
    prompt: 'Write a product description for eco-friendly water bottles',
    maxTokens: 300,
    temperature: 0.7
  });

  console.log('Generated text:', response.text);
  console.log('Cost:', `$${response.cost.toFixed(4)}`);
  console.log('Tokens used:', response.usage.totalTokens);
}

generateText();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Generating response...\n');

  for await (const chunk of router.stream({
    model: 'anthropic.claude-3-haiku-20240307-v1:0',
    prompt: 'Explain the benefits of renewable energy',
    maxTokens: 500,
    temperature: 0.6
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Multi-Model Comparison

```javascript
async function compareModels() {
  const prompt = 'Explain artificial intelligence in simple terms';
  const models = [
    'anthropic.claude-3-haiku-20240307-v1:0',
    'meta.llama2-13b-chat-v1',
    'mistral.mistral-7b-instruct-v0:2'
  ];

  for (const model of models) {
    console.log(`\n--- ${model} ---`);
    
    const response = await router.generate({
      model,
      prompt,
      maxTokens: 200,
      temperature: 0.7
    });

    console.log(response.text);
    console.log(`Cost: $${response.cost.toFixed(4)}, Tokens: ${response.usage.totalTokens}`);
  }
}

compareModels();
```

### Function Calling with Claude 3

```javascript
async function functionCallingExample() {
  const tools = [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name'
          }
        },
        required: ['location']
      }
    }
  ];

  const response = await router.generate({
    model: 'anthropic.claude-3-sonnet-20240229-v1:0',
    prompt: 'What\'s the weather like in New York?',
    tools,
    maxTokens: 500
  });

  if (response.functionCalls) {
    console.log('Function calls:', response.functionCalls);
  }
  
  console.log('Response:', response.text);
}

functionCallingExample();
```

### Using Embeddings

```javascript
async function generateEmbeddings() {
  const texts = [
    'Machine learning is transforming industries',
    'Artificial intelligence helps automate tasks',
    'Deep learning requires large datasets'
  ];

  for (const text of texts) {
    const response = await router.embed({
      model: 'amazon.titan-embed-text-v1',
      input: text
    });

    console.log(`Text: "${text}"`);
    console.log(`Embedding dimensions: ${response.embedding.length}`);
    console.log(`Cost: $${response.cost.toFixed(6)}\n`);
  }
}

generateEmbeddings();
```

## Best Practices

### 1. IAM Permissions

Ensure your AWS credentials have the necessary Bedrock permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels",
        "bedrock:GetModelInvocationLoggingConfiguration"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Cost Optimization

```javascript
// Use cost-effective models for simple tasks
const router = new LLMRouter({
  providers: ['bedrock'],
  strategy: 'cost-optimized',
  bedrock: {
    region: 'us-east-1',
    preferredModels: [
      'anthropic.claude-3-haiku-20240307-v1:0',  // Fastest & cheapest
      'meta.llama2-13b-chat-v1',                 // Good value
      'mistral.mistral-7b-instruct-v0:2'         // Cost-effective
    ]
  }
});
```

### 3. Model Selection Guidelines

```javascript
// Choose models based on use case
const modelUseCases = {
  // Complex reasoning and analysis
  reasoning: 'anthropic.claude-3-opus-20240229-v1:0',
  
  // Balanced performance for most tasks
  general: 'anthropic.claude-3-sonnet-20240229-v1:0',
  
  // Fast responses for simple tasks
  simple: 'anthropic.claude-3-haiku-20240307-v1:0',
  
  // Code generation and technical tasks
  coding: 'meta.llama2-34b-code-instruct-v1',
  
  // Cost-sensitive applications
  budget: 'mistral.mistral-7b-instruct-v0:2'
};
```

### 4. Error Handling

```javascript
async function robustBedrockCall() {
  try {
    const response = await router.generate({
      model: 'anthropic.claude-3-sonnet-20240229-v1:0',
      prompt: 'Your prompt here',
      maxTokens: 500
    });
    
    return response;
  } catch (error) {
    if (error.type === 'validation_error') {
      console.error('Model access not enabled:', error.message);
      // Try a different model
      return await router.generate({
        model: 'amazon.titan-text-express-v1',
        prompt: 'Your prompt here',
        maxTokens: 500
      });
    } else if (error.type === 'throttling_error') {
      console.warn('Rate limited, waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return robustBedrockCall(); // Retry
    } else {
      console.error('Bedrock error:', error);
      throw error;
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Issue: "Model access not enabled"
```
ValidationException: You don't have access to the model with the specified model ID.
```

**Solution**: Enable model access in the AWS Bedrock console:
1. Go to AWS Bedrock console
2. Navigate to "Model access" in the left sidebar
3. Click "Enable specific models"
4. Select the models you want to use
5. Wait for access to be granted (usually immediate)

#### Issue: "Region not supported"
```
ValidationException: The specified region is not supported for this operation.
```

**Solution**: Use a supported region:
```javascript
const supportedRegions = [
  'us-east-1',    // N. Virginia
  'us-west-2',    // Oregon
  'ap-southeast-1', // Singapore
  'ap-northeast-1', // Tokyo
  'eu-central-1',   // Frankfurt
  'eu-west-1'       // Ireland
];
```

#### Issue: "Insufficient permissions"
```
AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel
```

**Solution**: Add the required IAM permissions shown in the Best Practices section.

#### Issue: "Token limit exceeded"
```
ValidationException: The input text is too long for the model.
```

**Solution**: Check model token limits and truncate input:
```javascript
const modelLimits = {
  'anthropic.claude-3-opus-20240229-v1:0': 200000,
  'anthropic.claude-3-sonnet-20240229-v1:0': 200000,
  'anthropic.claude-3-haiku-20240307-v1:0': 200000,
  'meta.llama2-70b-chat-v1': 4096,
  'mistral.mistral-7b-instruct-v0:2': 32768
};
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['bedrock'],
  debug: true,  // Enable debug logging
  bedrock: {
    region: 'us-east-1',
    logLevel: 'DEBUG'
  }
});
```

## Pricing Information

### Claude 3 Models (per 1K tokens)
- **Opus**: Input $15.00, Output $75.00
- **Sonnet**: Input $3.00, Output $15.00  
- **Haiku**: Input $0.25, Output $1.25

### Llama 2 Models (per 1K tokens)
- **70B Chat**: Input $0.65, Output $0.80
- **13B Chat**: Input $0.75, Output $1.00

### Mistral Models (per 1K tokens)
- **7B Instruct**: Input $0.15, Output $0.20
- **8x7B Instruct**: Input $0.45, Output $0.70
- **Large**: Input $2.00, Output $6.00

### Titan Models (per 1K tokens)
- **Text Express**: Input $0.13, Output $0.17
- **Text Lite**: Input $0.10, Output $0.13
- **Embeddings**: $0.10 per 1K tokens

*Prices subject to change. Check AWS Bedrock pricing page for current rates.*

## Resources

- **AWS Bedrock Console**: [console.aws.amazon.com/bedrock](https://console.aws.amazon.com/bedrock)
- **API Documentation**: [docs.aws.amazon.com/bedrock](https://docs.aws.amazon.com/bedrock)
- **Model Documentation**: [docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html)
- **GitHub Samples**: [github.com/aws-samples/amazon-bedrock-samples](https://github.com/aws-samples/amazon-bedrock-samples)
- **AWS SDK Documentation**: [docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-bedrock-runtime](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-bedrock-runtime)

---

*Built with 💚 by Echo AI Systems*