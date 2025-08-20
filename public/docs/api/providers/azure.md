# Azure OpenAI Provider Guide

Comprehensive guide for integrating and using Azure OpenAI Service through the LLM Router system.

## Overview

Azure OpenAI Service provides access to OpenAI's powerful models through Microsoft's Azure cloud platform, offering enterprise-grade security, compliance, and integration with Azure services. This guide covers setup, configuration, and best practices for Azure OpenAI integration.

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: '2024-02-15-preview',
    deployments: {
      'gpt-4': 'my-gpt4-deployment',
      'gpt-35-turbo': 'my-gpt35-deployment'
    }
  }
});

// Generate with Azure OpenAI
const response = await router.generate({
  model: 'gpt-4',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 200
});

console.log(response.text);
```

### Environment Variables

```bash
# Required
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com

# Optional
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_CLIENT_ID=your_client_id  # For managed identity
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
```

## Configuration

### Complete Configuration Options

```javascript
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    // Authentication - API Key
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    
    // Or Managed Identity
    useManagedIdentity: false,
    clientId: process.env.AZURE_CLIENT_ID,
    
    // API Configuration
    apiVersion: '2024-02-15-preview',
    timeout: 60000,
    maxRetries: 3,
    
    // Deployment Mapping
    deployments: {
      'gpt-4': 'my-gpt4-deployment',
      'gpt-4-32k': 'my-gpt4-32k-deployment',
      'gpt-35-turbo': 'my-gpt35-deployment',
      'gpt-35-turbo-16k': 'my-gpt35-16k-deployment',
      'text-embedding-ada-002': 'my-embedding-deployment'
    },
    
    // Content Filtering
    contentFilter: {
      enabled: true,
      categories: {
        hate: 'medium',
        selfHarm: 'medium',
        sexual: 'medium',
        violence: 'medium'
      }
    },
    
    // Rate Limiting
    rateLimit: {
      requestsPerMinute: 240,
      tokensPerMinute: 240000,
      requestsPerDay: 10000,
      tokensPerDay: 10000000
    },
    
    // Azure Integration
    azureIntegration: {
      logAnalytics: {
        enabled: true,
        workspaceId: process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID,
        sharedKey: process.env.AZURE_LOG_ANALYTICS_SHARED_KEY
      },
      applicationInsights: {
        enabled: true,
        instrumentationKey: process.env.AZURE_APP_INSIGHTS_KEY
      },
      keyVault: {
        enabled: false,
        vaultUrl: process.env.AZURE_KEY_VAULT_URL
      }
    }
  }
});
```

### Multi-Region Configuration

```javascript
// Multi-region setup for high availability
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    regions: [
      {
        name: 'primary',
        endpoint: 'https://eastus-openai.openai.azure.com',
        apiKey: process.env.AZURE_OPENAI_EASTUS_KEY,
        deployments: {
          'gpt-4': 'eastus-gpt4-deployment'
        }
      },
      {
        name: 'secondary',
        endpoint: 'https://westus-openai.openai.azure.com',
        apiKey: process.env.AZURE_OPENAI_WESTUS_KEY,
        deployments: {
          'gpt-4': 'westus-gpt4-deployment'
        }
      }
    ],
    
    // Failover configuration
    failover: {
      enabled: true,
      retryCount: 3,
      timeout: 30000,
      strategy: 'round-robin' // or 'priority'
    }
  }
});
```

## Azure-Specific Features

### 1. Managed Identity Authentication

```javascript
// Using Azure Managed Identity
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    useManagedIdentity: true,
    
    // Optional: Specify client ID for user-assigned identity
    clientId: process.env.AZURE_CLIENT_ID,
    
    deployments: {
      'gpt-4': 'my-deployment'
    }
  }
});

// The router will automatically obtain tokens using Azure Identity
const response = await router.generate({
  model: 'gpt-4',
  prompt: 'Hello from Azure!',
  maxTokens: 100
});
```

### 2. Content Filtering Integration

```javascript
class AzureContentFilterManager {
  constructor(router) {
    this.router = router;
    this.filterStats = {
      total: 0,
      filtered: 0,
      categories: {}
    };
  }

  async safeGenerate(request) {
    try {
      const response = await this.router.generate({
        ...request,
        contentFilter: {
          enabled: true,
          categories: {
            hate: 'low',
            selfHarm: 'low',
            sexual: 'medium',
            violence: 'medium'
          }
        }
      });

      this.filterStats.total++;
      
      // Check if content was filtered
      if (response.contentFilterResults) {
        this.handleContentFilterResults(response.contentFilterResults);
      }

      return response;
    } catch (error) {
      if (error.code === 'content_filter') {
        this.filterStats.filtered++;
        return this.handleFilteredContent(error, request);
      }
      throw error;
    }
  }

  handleContentFilterResults(results) {
    for (const [category, result] of Object.entries(results)) {
      if (result.filtered) {
        this.filterStats.filtered++;
        
        if (!this.filterStats.categories[category]) {
          this.filterStats.categories[category] = 0;
        }
        this.filterStats.categories[category]++;
        
        console.log(`Content filtered for ${category}: ${result.severity}`);
      }
    }
  }

  async handleFilteredContent(error, originalRequest) {
    console.log('Content was filtered:', error.message);
    
    // Try with more restrictive prompt
    const sanitizedRequest = this.sanitizeRequest(originalRequest);
    
    try {
      return await this.router.generate(sanitizedRequest);
    } catch (retryError) {
      return {
        text: "I'm sorry, but I can't provide a response to that request due to content policy restrictions.",
        filtered: true,
        originalError: error.message
      };
    }
  }

  sanitizeRequest(request) {
    // Implement prompt sanitization logic
    const sanitizedPrompt = request.prompt
      .replace(/harmful|violent|explicit/gi, 'inappropriate')
      .replace(/\b(hate|attack|violence)\b/gi, 'negative');
    
    return {
      ...request,
      prompt: sanitizedPrompt,
      temperature: Math.min(request.temperature || 0.7, 0.5) // Lower creativity
    };
  }

  getFilterStats() {
    return {
      ...this.filterStats,
      filterRate: (this.filterStats.filtered / this.filterStats.total) * 100
    };
  }
}
```

### 3. Azure Integration Services

```javascript
class AzureIntegrationManager {
  constructor(config) {
    this.config = config;
    this.logAnalytics = this.initLogAnalytics();
    this.appInsights = this.initApplicationInsights();
  }

  initLogAnalytics() {
    if (!this.config.logAnalytics?.enabled) return null;
    
    return {
      workspaceId: this.config.logAnalytics.workspaceId,
      sharedKey: this.config.logAnalytics.sharedKey,
      
      async sendLog(data) {
        const logData = {
          TimeGenerated: new Date().toISOString(),
          ...data
        };
        
        // Send to Azure Log Analytics
        await this.postToLogAnalytics('OpenAIUsage', logData);
      },
      
      async postToLogAnalytics(logType, data) {
        const body = JSON.stringify([data]);
        const signature = this.buildSignature(body);
        
        const response = await fetch(
          `https://${this.workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`,
          {
            method: 'POST',
            headers: {
              'Authorization': signature,
              'Content-Type': 'application/json',
              'Log-Type': logType,
              'x-ms-date': new Date().toUTCString()
            },
            body
          }
        );
        
        if (!response.ok) {
          throw new Error(`Log Analytics error: ${response.statusText}`);
        }
      },
      
      buildSignature(body) {
        const stringToHash = `POST\n${body.length}\napplication/json\nx-ms-date:${new Date().toUTCString()}\n/api/logs`;
        const hashedString = crypto.createHmac('sha256', Buffer.from(this.sharedKey, 'base64'))
          .update(stringToHash, 'utf-8')
          .digest('base64');
        
        return `SharedKey ${this.workspaceId}:${hashedString}`;
      }
    };
  }

  initApplicationInsights() {
    if (!this.config.applicationInsights?.enabled) return null;
    
    const appInsights = require('applicationinsights');
    appInsights.setup(this.config.applicationInsights.instrumentationKey);
    appInsights.start();
    
    return appInsights.defaultClient;
  }

  async trackRequest(request, response, latency) {
    const logData = {
      Model: request.model,
      PromptTokens: response.usage?.promptTokens || 0,
      CompletionTokens: response.usage?.completionTokens || 0,
      TotalTokens: response.usage?.totalTokens || 0,
      Latency: latency,
      Success: !response.error,
      Timestamp: new Date().toISOString()
    };

    // Log to Azure Log Analytics
    if (this.logAnalytics) {
      await this.logAnalytics.sendLog(logData);
    }

    // Track in Application Insights
    if (this.appInsights) {
      this.appInsights.trackRequest({
        name: 'OpenAI-Generation',
        url: request.model,
        duration: latency,
        success: !response.error,
        properties: logData
      });
    }
  }

  async trackError(error, context) {
    const errorData = {
      Error: error.message,
      Model: context.model,
      Timestamp: new Date().toISOString(),
      Context: JSON.stringify(context)
    };

    if (this.logAnalytics) {
      await this.logAnalytics.sendLog(errorData);
    }

    if (this.appInsights) {
      this.appInsights.trackException({
        exception: error,
        properties: errorData
      });
    }
  }
}
```

### 4. Private Endpoint Configuration

```javascript
// Configure for Azure Private Endpoints
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: 'https://my-private-openai.privatelink.openai.azure.com',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    
    // Private endpoint specific settings
    networkAccess: {
      type: 'private',
      allowedNetworks: ['10.0.0.0/8'],
      dnsConfiguration: {
        customDns: true,
        dnsServers: ['10.0.0.4', '10.0.0.5']
      }
    },
    
    // Enhanced security settings
    security: {
      tlsVersion: '1.2',
      certificateValidation: true,
      customCertificates: ['path/to/custom/cert.pem']
    }
  }
});
```

## Deployment Management

### 1. Deployment Orchestrator

```javascript
class AzureDeploymentManager {
  constructor(config) {
    this.config = config;
    this.deployments = new Map();
    this.healthStatus = new Map();
  }

  async discoverDeployments() {
    try {
      const response = await fetch(
        `${this.config.endpoint}/openai/deployments?api-version=${this.config.apiVersion}`,
        {
          headers: {
            'api-key': this.config.apiKey
          }
        }
      );

      const data = await response.json();
      
      for (const deployment of data.data) {
        this.deployments.set(deployment.id, {
          id: deployment.id,
          model: deployment.model,
          status: deployment.status,
          scaleSettings: deployment.scale_settings,
          capacity: deployment.capacity
        });
      }

      console.log(`Discovered ${this.deployments.size} deployments`);
      return Array.from(this.deployments.values());
    } catch (error) {
      console.error('Failed to discover deployments:', error);
      return [];
    }
  }

  async checkDeploymentHealth() {
    const healthChecks = [];

    for (const [deploymentId, deployment] of this.deployments) {
      healthChecks.push(this.checkSingleDeployment(deploymentId, deployment));
    }

    const results = await Promise.allSettled(healthChecks);
    
    results.forEach((result, index) => {
      const deploymentId = Array.from(this.deployments.keys())[index];
      
      if (result.status === 'fulfilled') {
        this.healthStatus.set(deploymentId, {
          healthy: true,
          latency: result.value.latency,
          lastCheck: new Date()
        });
      } else {
        this.healthStatus.set(deploymentId, {
          healthy: false,
          error: result.reason.message,
          lastCheck: new Date()
        });
      }
    });

    return this.getHealthSummary();
  }

  async checkSingleDeployment(deploymentId, deployment) {
    const startTime = Date.now();

    try {
      const response = await fetch(
        `${this.config.endpoint}/openai/deployments/${deploymentId}/completions?api-version=${this.config.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'api-key': this.config.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'Health check',
            max_tokens: 1,
            temperature: 0
          })
        }
      );

      if (response.ok) {
        return {
          latency: Date.now() - startTime,
          healthy: true
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  selectOptimalDeployment(model, requirements = {}) {
    const candidateDeployments = Array.from(this.deployments.values())
      .filter(d => d.model === model)
      .filter(d => {
        const health = this.healthStatus.get(d.id);
        return health && health.healthy;
      });

    if (candidateDeployments.length === 0) {
      throw new Error(`No healthy deployments found for model: ${model}`);
    }

    // Sort by performance and capacity
    candidateDeployments.sort((a, b) => {
      const healthA = this.healthStatus.get(a.id);
      const healthB = this.healthStatus.get(b.id);
      
      // Prefer lower latency
      return healthA.latency - healthB.latency;
    });

    return candidateDeployments[0];
  }

  getHealthSummary() {
    const summary = {
      total: this.deployments.size,
      healthy: 0,
      unhealthy: 0,
      deployments: {}
    };

    for (const [deploymentId, health] of this.healthStatus) {
      if (health.healthy) {
        summary.healthy++;
      } else {
        summary.unhealthy++;
      }

      summary.deployments[deploymentId] = health;
    }

    return summary;
  }
}
```

### 2. Cost Management

```javascript
class AzureCostManager {
  constructor(config) {
    this.config = config;
    this.costs = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-32k': { input: 0.06, output: 0.12 },
      'gpt-35-turbo': { input: 0.0015, output: 0.002 },
      'gpt-35-turbo-16k': { input: 0.003, output: 0.004 }
    };
    
    this.usage = {
      daily: new Map(),
      monthly: new Map(),
      total: 0
    };
  }

  async trackUsage(request, response) {
    const cost = this.calculateCost(request.model, response.usage);
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    // Track daily usage
    const dailyUsage = this.usage.daily.get(today) || {
      requests: 0,
      tokens: 0,
      cost: 0
    };
    
    dailyUsage.requests++;
    dailyUsage.tokens += response.usage?.totalTokens || 0;
    dailyUsage.cost += cost;
    
    this.usage.daily.set(today, dailyUsage);

    // Track monthly usage
    const monthlyUsage = this.usage.monthly.get(month) || {
      requests: 0,
      tokens: 0,
      cost: 0
    };
    
    monthlyUsage.requests++;
    monthlyUsage.tokens += response.usage?.totalTokens || 0;
    monthlyUsage.cost += cost;
    
    this.usage.monthly.set(month, monthlyUsage);

    this.usage.total += cost;

    // Send to Azure Cost Management API
    await this.reportToAzureCostManagement({
      date: today,
      resource: request.model,
      cost,
      usage: response.usage
    });

    return cost;
  }

  calculateCost(model, usage) {
    const pricing = this.costs[model];
    if (!pricing || !usage) return 0;

    const inputCost = (usage.promptTokens / 1000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  async reportToAzureCostManagement(data) {
    try {
      // Report to Azure Cost Management API
      const response = await fetch(
        `https://management.azure.com/subscriptions/${this.config.subscriptionId}/providers/Microsoft.CostManagement/exports`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await this.getAzureToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              schedule: {
                status: 'Active',
                recurrence: 'Daily'
              },
              definition: {
                type: 'Usage',
                timeframe: 'Custom',
                customPeriod: {
                  from: data.date,
                  to: data.date
                }
              },
              deliveryInfo: {
                destination: {
                  resourceId: this.config.storageAccountResourceId,
                  container: 'cost-reports',
                  rootFolderPath: 'openai-usage'
                }
              }
            }
          })
        }
      );

      if (!response.ok) {
        console.warn('Failed to report to Azure Cost Management:', response.statusText);
      }
    } catch (error) {
      console.warn('Error reporting to Azure Cost Management:', error.message);
    }
  }

  async getAzureToken() {
    // Use Azure Identity to get access token
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken('https://management.azure.com/.default');
    return tokenResponse.token;
  }

  getCostSummary(period = 'daily') {
    const usageMap = this.usage[period];
    const summary = {
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      breakdown: {}
    };

    for (const [key, usage] of usageMap) {
      summary.totalCost += usage.cost;
      summary.totalTokens += usage.tokens;
      summary.totalRequests += usage.requests;
      summary.breakdown[key] = usage;
    }

    return summary;
  }

  async setBudgetAlert(monthlyBudget) {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyUsage = this.usage.monthly.get(currentMonth);
    
    if (monthlyUsage && monthlyUsage.cost > monthlyBudget * 0.8) {
      await this.sendBudgetAlert({
        budget: monthlyBudget,
        current: monthlyUsage.cost,
        percentage: (monthlyUsage.cost / monthlyBudget) * 100
      });
    }
  }

  async sendBudgetAlert(budgetInfo) {
    // Send alert via Azure Monitor, email, or webhook
    console.warn(`Budget Alert: ${budgetInfo.percentage.toFixed(1)}% of monthly budget used`);
    console.warn(`Current: $${budgetInfo.current.toFixed(2)} / Budget: $${budgetInfo.budget.toFixed(2)}`);
  }
}
```

## Error Handling and Monitoring

### Azure-Specific Error Handling

```javascript
class AzureErrorHandler {
  constructor() {
    this.errorPatterns = {
      'DeploymentNotFound': /deployment.*not found/i,
      'QuotaExceeded': /quota.*exceeded/i,
      'ContentFiltered': /content.*filter/i,
      'AuthenticationFailed': /authentication.*failed/i,
      'NetworkError': /network.*error|timeout/i
    };
  }

  async handleError(error, context = {}) {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'DeploymentNotFound':
        return this.handleDeploymentError(error, context);
      case 'QuotaExceeded':
        return this.handleQuotaError(error, context);
      case 'ContentFiltered':
        return this.handleContentFilterError(error, context);
      case 'AuthenticationFailed':
        return this.handleAuthError(error, context);
      default:
        return this.handleGenericError(error, context);
    }
  }

  classifyError(error) {
    for (const [type, pattern] of Object.entries(this.errorPatterns)) {
      if (pattern.test(error.message)) {
        return type;
      }
    }
    return 'Unknown';
  }

  async handleDeploymentError(error, context) {
    console.error(`Deployment error for model ${context.model}:`, error.message);
    
    // Try to find alternative deployment
    const deploymentManager = new AzureDeploymentManager(context.config);
    const deployments = await deploymentManager.discoverDeployments();
    
    const alternative = deployments.find(d => d.model === context.model && d.status === 'succeeded');
    
    if (alternative) {
      return {
        retry: true,
        alternativeDeployment: alternative.id,
        message: `Switching to deployment: ${alternative.id}`
      };
    }
    
    return {
      retry: false,
      message: 'No alternative deployments available'
    };
  }

  async handleQuotaError(error, context) {
    console.error('Quota exceeded:', error.message);
    
    return {
      retry: true,
      delay: 60000, // Wait 1 minute
      suggestion: 'Consider upgrading quota or using different model',
      message: 'Rate limit exceeded, implementing backoff'
    };
  }
}
```

## Best Practices

### 1. Security and Compliance
- Use Managed Identity for authentication when possible
- Enable private endpoints for enhanced security
- Implement content filtering for compliance
- Log all interactions for audit purposes

### 2. Performance Optimization
- Use deployment health checks for optimal routing
- Implement proper retry logic with exponential backoff
- Monitor latency and switch deployments when needed
- Cache responses when appropriate

### 3. Cost Management
- Track usage and costs in real-time
- Set up budget alerts and limits
- Use appropriate models for different use cases
- Implement request throttling if needed

### 4. Enterprise Integration
- Integrate with Azure Log Analytics for monitoring
- Use Application Insights for performance tracking
- Implement proper error handling and alerting
- Plan for disaster recovery across regions

---

**Related:** [Azure OpenAI Service Documentation](https://docs.microsoft.com/azure/cognitive-services/openai/) | **Next:** [Enterprise Features](../advanced/enterprise.md)