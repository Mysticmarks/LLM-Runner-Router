# 🔑 BYOK (Bring Your Own Key) System Documentation

## Overview

The BYOK system enables users to use their own API keys from various LLM providers instead of relying on system-provided keys. This gives users more control over costs, rate limits, and provider relationships while still benefiting from the unified LLM-Runner-Router interface.

## Features

### 1. **Individual User Keys**
- Users can add their own API keys for any supported provider
- Keys are encrypted and securely stored
- Each user can have multiple keys for different providers
- Keys can be managed through REST API or web interface

### 2. **Group/Organization Keys**
- Organizations can share API keys with team members
- Administrators can manage group keys and access control
- Support for user-specific permissions within groups
- Centralized key management for teams

### 3. **Security & Encryption**
- All API keys are encrypted using AES-256-CBC encryption
- Keys are never exposed in logs or responses
- Secure validation with provider APIs
- Automatic key rotation support

### 4. **Provider Support**
The system supports 27+ providers including:

**Major AI Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google AI (Gemini)
- Azure OpenAI
- AWS Bedrock
- xAI (Grok)

**Specialized Providers:**
- Cohere
- Mistral AI
- Perplexity
- Inflection AI
- AI21 Labs
- DeepSeek

**Infrastructure Providers:**
- Together AI
- Fireworks AI
- Groq
- Replicate
- Anyscale
- Hyperbolic
- SambaNova
- Lepton AI
- OctoAI

**Cloud & Edge:**
- Databricks
- Cloudflare AI
- Novita AI

**Meta & Routing:**
- OpenRouter (400+ models)
- Ollama (Local)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Frontend UI                        │
│         (Web Interface for Key Management)           │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│                 REST API Layer                       │
│    (/api/byok/* endpoints for key management)       │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│              BYOK Middleware                         │
│  (injectBYOKKeys, loadWithBYOK middleware)          │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│              BYOK Manager                            │
│  (Core key management and encryption logic)          │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│           BYOK-Aware Loaders                         │
│  (Model loaders that can use BYOK keys)             │
└──────────────────────────────────────────────────────┘
```

### Data Flow

1. **Key Addition**:
   - User provides API key through UI/API
   - Key is validated with provider
   - Key is encrypted and stored
   - Metadata is saved for management

2. **Key Usage**:
   - Request includes provider preference
   - Middleware checks for BYOK keys
   - Key is decrypted and injected
   - Model loader uses BYOK key
   - Key is cleared after request

3. **Group Management**:
   - Admin adds key to group
   - Users are added to group
   - Group keys become available to members
   - Access control enforced per request

## API Reference

### Endpoints

#### `GET /api/byok/providers`
List all supported providers and their configuration requirements.

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "requiresConfig": false,
      "configFields": []
    },
    {
      "id": "azure",
      "name": "Azure OpenAI",
      "requiresConfig": true,
      "configFields": ["endpoint_url", "api_key", "deployment_id"]
    }
  ]
}
```

#### `GET /api/byok/keys`
Get user's available providers and keys.

**Headers:**
- `Authorization: Bearer <api-key>`

**Response:**
```json
{
  "success": true,
  "userId": "user-id",
  "groupId": "group-id",
  "providers": [
    {
      "provider": "openai",
      "name": "OpenAI",
      "hasUserKey": true,
      "hasGroupKey": false
    }
  ]
}
```

#### `POST /api/byok/keys/:provider`
Add or update a user's API key for a provider.

**Headers:**
- `Authorization: Bearer <api-key>`

**Body:**
```json
{
  "apiKey": "sk-...",
  "name": "Production Key",
  "description": "Main OpenAI key for production"
}
```

**Response:**
```json
{
  "success": true,
  "keyId": "byok_user_openai_1234567890",
  "provider": "openai"
}
```

#### `DELETE /api/byok/keys/:provider`
Remove a user's API key for a provider.

**Headers:**
- `Authorization: Bearer <api-key>`

**Response:**
```json
{
  "success": true,
  "message": "Removed openai key"
}
```

#### `POST /api/byok/groups/:groupId/keys/:provider`
Add a group API key (admin only).

**Headers:**
- `Authorization: Bearer <api-key>`

**Body:**
```json
{
  "apiKey": "sk-...",
  "name": "Team OpenAI Key",
  "description": "Shared key for development team",
  "allowedUsers": "all"
}
```

#### `POST /api/byok/groups/:groupId/users/:userId`
Add a user to a group (admin only).

**Headers:**
- `Authorization: Bearer <api-key>`

#### `GET /api/byok/stats`
Get usage statistics for BYOK keys.

**Headers:**
- `Authorization: Bearer <api-key>`

**Response:**
```json
{
  "success": true,
  "stats": {
    "userKeys": 3,
    "groupKeys": 2,
    "providers": ["openai", "anthropic"],
    "totalUsage": 1523
  }
}
```

## Web Interface

The BYOK management interface is available at `/byok-interface.html` and provides:

1. **Dashboard View**:
   - Personal API keys overview
   - Available providers list
   - Usage statistics
   - Group keys (if applicable)

2. **Key Management**:
   - Add new API keys
   - Test key validity
   - Remove existing keys
   - View key metadata

3. **Provider Support**:
   - Visual provider identification
   - Configuration helpers
   - Format validation
   - Connection status

## Security Considerations

### Encryption
- Keys are encrypted using AES-256-CBC
- Unique IV for each encryption operation
- Encryption key derived from environment or generated
- Keys never stored in plain text

### Validation
- All keys validated with provider before storage
- Format validation based on provider patterns
- Regular revalidation of stored keys
- Invalid keys automatically flagged

### Access Control
- User keys accessible only by owner
- Group keys require group membership
- Admin privileges for group management
- Rate limiting per key/user

### Best Practices
1. **Never share API keys** in logs or error messages
2. **Rotate keys regularly** for security
3. **Use group keys** for team resources
4. **Monitor usage** to detect anomalies
5. **Validate keys** before critical operations

## Configuration

### Environment Variables
```bash
# BYOK encryption key (generate with openssl rand -hex 32)
BYOK_ENCRYPTION_KEY=your-256-bit-hex-key

# Storage location for BYOK keys
BYOK_STORAGE_PATH=/path/to/byok-keys.json

# Enable BYOK feature
ENABLE_BYOK=true
```

### Provider-Specific Configuration

#### OpenAI
```json
{
  "apiKey": "sk-..."
}
```

#### Azure OpenAI
```json
{
  "endpoint_url": "https://your-resource.openai.azure.com/",
  "api_key": "your-api-key",
  "deployment_id": "your-deployment",
  "api_version": "2024-02-15-preview"
}
```

#### AWS Bedrock
```json
{
  "access_key_id": "AKIA...",
  "secret_access_key": "...",
  "region": "us-east-1"
}
```

Or using Bedrock API key:
```json
"BEDROCK-..."
```

#### Ollama (Local)
```json
{
  "base_url": "http://localhost:11434"
}
```

#### Databricks
```json
{
  "workspace_url": "https://your-workspace.databricks.com",
  "api_token": "dapi..."
}
```

#### Cloudflare AI
```json
{
  "account_id": "your-account-id",
  "api_token": "your-api-token"
}
```

#### xAI (Grok)
```json
"xai-your-api-key-here"
```

#### Replicate
```json
"r8_your-api-key-here"
```

## Integration with Model Loaders

### Using BYOK in Requests

When making inference requests, BYOK keys are automatically used if available:

```javascript
// Request with provider preference
POST /api/inference
{
  "prompt": "Hello world",
  "provider": "openai",  // Will use user's OpenAI BYOK key if available
  "model": "gpt-4"
}
```

### BYOK-Aware Loader Pattern

Model loaders become BYOK-aware through middleware injection:

```javascript
// Middleware automatically injects BYOK keys
app.post('/api/inference', 
  requireAPIKey,       // Authenticate user
  injectBYOKKeys,      // Inject BYOK context
  loadWithBYOK,        // Load appropriate key
  async (req, res) => {
    // req.providerKey contains decrypted BYOK key
    // req.isBYOK indicates BYOK usage
  }
);
```

## Testing

### Unit Tests
```bash
npm test tests/test-byok.js
```

### API Tests
```bash
TEST_API=true npm test tests/test-byok.js
```

### Manual Testing
1. Start the server: `npm start`
2. Navigate to: `http://localhost:3000/byok-interface.html`
3. Add test keys and verify functionality

## Migration Guide

### For Existing Users
1. No changes required - system keys continue to work
2. Optionally add BYOK keys for better control
3. BYOK keys take precedence when available

### For New Users
1. Create an account/API key
2. Add BYOK keys for desired providers
3. Make requests as normal - BYOK automatically applied

## Troubleshooting

### Common Issues

1. **Invalid API Key Error**
   - Verify key format matches provider requirements
   - Check key hasn't expired or been revoked
   - Ensure proper escaping in JSON configs

2. **Key Not Being Used**
   - Confirm key is added for correct provider
   - Check user has group access (for group keys)
   - Verify provider parameter in request

3. **Encryption Errors**
   - Ensure BYOK_ENCRYPTION_KEY is set
   - Check file permissions on storage
   - Verify Node.js crypto support

4. **Provider Validation Fails**
   - Test key directly with provider
   - Check network connectivity
   - Verify configuration format

## Future Enhancements

- [ ] Key rotation scheduling
- [ ] Usage analytics dashboard
- [ ] Provider-specific quotas
- [ ] Key sharing workflows
- [ ] OAuth provider integration
- [ ] Audit logging
- [ ] Cost tracking per key
- [ ] Automatic failover between keys
- [ ] Key expiration warnings
- [ ] Multi-region key support

## Support

For issues or questions about the BYOK system:
1. Check this documentation
2. Review test files for examples
3. Open an issue on GitHub
4. Contact support with details

---

*BYOK System v1.0.0 - Echo AI Systems*