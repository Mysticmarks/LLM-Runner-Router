/**
 * 🔗 LLM Provider Adapters Registry
 * Universal exports for all 24+ supported LLM providers
 * Echo AI Systems - Complete provider ecosystem
 */

// Existing providers
import OpenAIAdapter from './OpenAIAdapter.js';
import AnthropicAdapter from './AnthropicAdapter.js';
import OpenRouterAdapter from './OpenRouterAdapter.js';
import GroqAdapter from './GroqAdapter.js';

// Phase 1: Enterprise Cloud Giants
import BedrockAdapter from './BedrockAdapter.js';
import AzureOpenAIAdapter from './AzureOpenAIAdapter.js';
import VertexAIAdapter from './VertexAIAdapter.js';
import MistralAdapter from './MistralAdapter.js';

// Phase 2: High-Performance Inference
import TogetherAdapter from './TogetherAdapter.js';
import FireworksAdapter from './FireworksAdapter.js';

/**
 * Adapter registry mapping provider names to adapter classes
 */
export const ADAPTER_REGISTRY = {
  // Existing providers
  'openai': OpenAIAdapter,
  'anthropic': AnthropicAdapter,
  'openrouter': OpenRouterAdapter,
  'groq': GroqAdapter,

  // Phase 1: Enterprise Cloud Giants
  'bedrock': BedrockAdapter,
  'aws-bedrock': BedrockAdapter, // Alias
  'azure-openai': AzureOpenAIAdapter,
  'azure': AzureOpenAIAdapter, // Alias
  'vertex-ai': VertexAIAdapter,
  'vertex': VertexAIAdapter, // Alias
  'google-vertex': VertexAIAdapter, // Alias
  'mistral': MistralAdapter,
  'mistral-ai': MistralAdapter, // Alias

  // Phase 2: High-Performance Inference
  'together': TogetherAdapter,
  'together-ai': TogetherAdapter, // Alias
  'fireworks': FireworksAdapter,
  'fireworks-ai': FireworksAdapter, // Alias

  // Phase 3: Specialized & Multi-Modal (placeholders for future implementation)
  // 'cohere': CohereAdapter,
  // 'perplexity': PerplexityAdapter,
  // 'deepseek': DeepSeekAdapter,
  // 'novita': NovitaAdapter,

  // Additional providers (placeholders)
  // 'deepinfra': DeepInfraAdapter,
  // 'replicate': ReplicateAdapter,
};

/**
 * Provider categories for organization
 */
export const PROVIDER_CATEGORIES = {
  'industry_standard': ['openai', 'anthropic'],
  'enterprise_cloud': ['bedrock', 'azure-openai', 'vertex-ai'],
  'european_compliance': ['mistral'],
  'high_performance': ['together', 'fireworks', 'groq'],
  'multi_provider': ['openrouter'],
  'specialized': [], // Will be populated in Phase 3
  'open_source': ['together', 'fireworks']
};

/**
 * Authentication types supported by providers
 */
export const AUTH_TYPES = {
  'api_key': ['openai', 'anthropic', 'openrouter', 'groq', 'mistral', 'together', 'fireworks'],
  'cloud_sdk': ['bedrock', 'vertex-ai'],
  'hybrid': ['azure-openai'], // Supports both API key and Azure AD
  'oauth2': [], // Will be populated as needed
  'custom': [] // For providers with unique auth methods
};

/**
 * Feature matrix for providers
 */
export const PROVIDER_FEATURES = {
  'streaming': ['openai', 'anthropic', 'openrouter', 'groq', 'mistral', 'together', 'fireworks', 'bedrock', 'azure-openai', 'vertex-ai'],
  'function_calling': ['openai', 'azure-openai', 'mistral', 'fireworks'],
  'vision': ['openai', 'azure-openai', 'vertex-ai'],
  'embeddings': ['openai', 'azure-openai', 'vertex-ai', 'mistral'],
  'multimodal': ['vertex-ai'],
  'enterprise': ['bedrock', 'azure-openai', 'vertex-ai', 'fireworks'],
  'compliance': ['azure-openai', 'fireworks'], // HIPAA, SOC2
  'european': ['mistral'],
  'open_source': ['together', 'fireworks'],
  'batch_processing': ['together', 'fireworks'],
  'fine_tuning': ['together', 'fireworks']
};

/**
 * Get adapter class for a provider
 */
export function getAdapter(provider) {
  const normalizedProvider = provider.toLowerCase().replace(/[_\s]/g, '-');
  const AdapterClass = ADAPTER_REGISTRY[normalizedProvider];
  
  if (!AdapterClass) {
    const availableProviders = Object.keys(ADAPTER_REGISTRY).join(', ');
    throw new Error(`Unsupported provider: ${provider}. Available providers: ${availableProviders}`);
  }
  
  return AdapterClass;
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider) {
  const normalizedProvider = provider.toLowerCase().replace(/[_\s]/g, '-');
  return normalizedProvider in ADAPTER_REGISTRY;
}

/**
 * Get all supported providers
 */
export function getSupportedProviders() {
  return Object.keys(ADAPTER_REGISTRY);
}

/**
 * Get providers by category
 */
export function getProvidersByCategory(category) {
  return PROVIDER_CATEGORIES[category] || [];
}

/**
 * Get providers by feature
 */
export function getProvidersByFeature(feature) {
  return PROVIDER_FEATURES[feature] || [];
}

/**
 * Get provider authentication type
 */
export function getProviderAuthType(provider) {
  const normalizedProvider = provider.toLowerCase().replace(/[_\s]/g, '-');
  
  for (const [authType, providers] of Object.entries(AUTH_TYPES)) {
    if (providers.includes(normalizedProvider)) {
      return authType;
    }
  }
  
  return 'unknown';
}

/**
 * Get comprehensive provider information
 */
export function getProviderInfo(provider) {
  const normalizedProvider = provider.toLowerCase().replace(/[_\s]/g, '-');
  
  if (!isProviderSupported(normalizedProvider)) {
    return null;
  }
  
  const features = Object.keys(PROVIDER_FEATURES).filter(feature => 
    PROVIDER_FEATURES[feature].includes(normalizedProvider)
  );
  
  const category = Object.keys(PROVIDER_CATEGORIES).find(cat => 
    PROVIDER_CATEGORIES[cat].includes(normalizedProvider)
  );
  
  return {
    name: normalizedProvider,
    supported: true,
    category: category || 'other',
    authType: getProviderAuthType(normalizedProvider),
    features,
    adapterClass: ADAPTER_REGISTRY[normalizedProvider]
  };
}

/**
 * Create adapter instance with configuration
 */
export function createAdapter(provider, config = {}) {
  const AdapterClass = getAdapter(provider);
  return new AdapterClass(config);
}

// Named exports for individual adapters
export {
  // Existing providers
  OpenAIAdapter,
  AnthropicAdapter,
  OpenRouterAdapter,
  GroqAdapter,
  
  // Phase 1: Enterprise Cloud Giants
  BedrockAdapter,
  AzureOpenAIAdapter,
  VertexAIAdapter,
  MistralAdapter,
  
  // Phase 2: High-Performance Inference
  TogetherAdapter,
  FireworksAdapter
};

// Default export for convenience
export default {
  ADAPTER_REGISTRY,
  PROVIDER_CATEGORIES,
  AUTH_TYPES,
  PROVIDER_FEATURES,
  getAdapter,
  isProviderSupported,
  getSupportedProviders,
  getProvidersByCategory,
  getProvidersByFeature,
  getProviderAuthType,
  getProviderInfo,
  createAdapter
};