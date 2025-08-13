# 🔐 Security Guide - Fortifying the Neural Frontier

*Security is not a feature, it's a foundation. Trust, but verify. Code, but audit.*

## Table of Contents
- [Security Philosophy](#security-philosophy)
- [Threat Model](#threat-model)
- [Model Security](#model-security)
- [Network Security](#network-security)
- [Runtime Security](#runtime-security)
- [Data Protection](#data-protection)
- [Authentication & Authorization](#authentication--authorization)
- [Security Best Practices](#security-best-practices)
- [Vulnerability Management](#vulnerability-management)
- [Compliance](#compliance)

## Security Philosophy

### Zero Trust Architecture

The LLM-Runner-Router follows a zero-trust security model:

```javascript
const secureRouter = new LLMRouter({
  security: {
    trustLevel: 'zero',
    verification: 'always',
    isolation: 'maximum',
    auditLevel: 'comprehensive'
  }
});
```

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal required permissions
3. **Fail Secure**: Secure defaults, fail closed
4. **Transparency**: Comprehensive audit trails
5. **Encryption Everywhere**: Data always encrypted

## Threat Model

### Attack Vectors

| Vector | Risk Level | Mitigation |
|--------|------------|------------|
| Malicious Models | 🔴 High | Model signing, sandboxing |
| Code Injection | 🔴 High | Input sanitization, CSP |
| Memory Attacks | 🟡 Medium | Memory isolation, bounds checking |
| Network MITM | 🟡 Medium | TLS, certificate pinning |
| Side Channel | 🟢 Low | Timing attack prevention |
| Social Engineering | 🟡 Medium | Access controls, training |

### Threat Scenarios

#### Scenario 1: Malicious Model Injection

**Attack**: Adversary replaces legitimate model with malicious one
**Impact**: Code execution, data theft, backdoor access
**Mitigation**:

```javascript
// Model integrity verification
const router = new LLMRouter({
  security: {
    modelVerification: {
      enabled: true,
      checksumValidation: true,
      signatureValidation: true,
      trustedSources: [
        'https://huggingface.co',
        'https://models.example.com'
      ]
    }
  }
});

// Verify model before loading
const model = await router.load({
  source: 'model.gguf',
  expectedChecksum: 'sha256:abc123...',
  signature: 'model.gguf.sig'
});
```

#### Scenario 2: Prompt Injection

**Attack**: Malicious prompts that hijack model behavior
**Impact**: Data exfiltration, unauthorized actions
**Mitigation**:

```javascript
// Input sanitization and validation
class SecurePromptProcessor {
  sanitize(prompt) {
    // Remove dangerous patterns
    const dangerous = [
      /ignore previous instructions/i,
      /system:\s*you are now/i,
      /\/etc\/passwd/,
      /<script>/i
    ];
    
    for (const pattern of dangerous) {
      if (pattern.test(prompt)) {
        throw new SecurityError('Suspicious prompt detected');
      }
    }
    
    return prompt.slice(0, 4096); // Limit length
  }
  
  validate(prompt) {
    return this.sanitize(prompt);
  }
}

router.use(new SecurePromptProcessor());
```

## Model Security

### Model Integrity

```javascript
// Cryptographic model verification
import crypto from 'crypto';
import { readFile } from 'fs/promises';

class ModelVerifier {
  async verifyIntegrity(modelPath, expectedHash) {
    const data = await readFile(modelPath);
    const hash = crypto.createHash('sha256');
    hash.update(data);
    
    const actualHash = hash.digest('hex');
    if (actualHash !== expectedHash) {
      throw new SecurityError('Model integrity check failed');
    }
  }
  
  async verifySignature(modelPath, signaturePath, publicKey) {
    const data = await readFile(modelPath);
    const signature = await readFile(signaturePath);
    
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    
    const isValid = verify.verify(publicKey, signature);
    if (!isValid) {
      throw new SecurityError('Model signature verification failed');
    }
  }
}
```

### Model Sandboxing

```javascript
// Isolate model execution
const router = new LLMRouter({
  security: {
    sandboxing: {
      enabled: true,
      memoryLimit: '2GB',
      cpuLimit: '4 cores',
      networkAccess: false,
      fileSystemAccess: 'readonly'
    }
  }
});

// WebWorker isolation in browser
class SandboxedEngine {
  constructor() {
    this.worker = new Worker('./model-worker.js');
    this.worker.postMessage({ type: 'initialize' });
  }
  
  async execute(prompt) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SecurityError('Execution timeout'));
      }, 30000);
      
      this.worker.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };
      
      this.worker.postMessage({
        type: 'execute',
        prompt: this.sanitize(prompt)
      });
    });
  }
}
```

### Secure Model Storage

```javascript
// Encrypted model storage
import { createCipher, createDecipher } from 'crypto';

class EncryptedModelStore {
  constructor(encryptionKey) {
    this.key = encryptionKey;
  }
  
  async storeModel(modelData, path) {
    const cipher = createCipher('aes-256-gcm', this.key);
    let encrypted = cipher.update(modelData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    await writeFile(path, encrypted);
  }
  
  async loadModel(path) {
    const encrypted = await readFile(path, 'utf8');
    const decipher = createDecipher('aes-256-gcm', this.key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## Network Security

### TLS Configuration

```javascript
// Secure HTTPS server
import https from 'https';
import { readFileSync } from 'fs';

const options = {
  key: readFileSync('private-key.pem'),
  cert: readFileSync('certificate.pem'),
  
  // Security headers
  secureProtocol: 'TLSv1_2_method',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384'
  ].join(':'),
  honorCipherOrder: true
};

const server = https.createServer(options, app);
```

### API Security

```javascript
// Secure API middleware
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

const securityMiddleware = [
  // Basic security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  }),
  
  // Rate limiting
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  // CORS configuration
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  })
];

app.use(securityMiddleware);
```

### Request Validation

```javascript
// Input validation and sanitization
import Joi from 'joi';
import DOMPurify from 'dompurify';

const requestSchema = Joi.object({
  prompt: Joi.string().max(4096).required(),
  maxTokens: Joi.number().min(1).max(2048).default(100),
  temperature: Joi.number().min(0).max(2).default(0.7),
  model: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/)
});

function validateRequest(req, res, next) {
  const { error, value } = requestSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details
    });
  }
  
  // Sanitize string inputs
  if (value.prompt) {
    value.prompt = DOMPurify.sanitize(value.prompt, { ALLOWED_TAGS: [] });
  }
  
  req.body = value;
  next();
}
```

## Runtime Security

### Memory Protection

```javascript
// Secure memory management
class SecureMemoryManager {
  constructor() {
    this.allocations = new Map();
    this.maxMemory = 4 * 1024 * 1024 * 1024; // 4GB
    this.currentUsage = 0;
  }
  
  allocate(size, purpose) {
    if (this.currentUsage + size > this.maxMemory) {
      throw new SecurityError('Memory limit exceeded');
    }
    
    const buffer = Buffer.allocUnsafe(size);
    const id = crypto.randomUUID();
    
    this.allocations.set(id, {
      buffer,
      size,
      purpose,
      timestamp: Date.now()
    });
    
    this.currentUsage += size;
    return { id, buffer };
  }
  
  deallocate(id) {
    const allocation = this.allocations.get(id);
    if (allocation) {
      // Clear memory before deallocation
      allocation.buffer.fill(0);
      this.allocations.delete(id);
      this.currentUsage -= allocation.size;
    }
  }
  
  // Automatic cleanup of old allocations
  cleanup() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    for (const [id, allocation] of this.allocations) {
      if (now - allocation.timestamp > maxAge) {
        this.deallocate(id);
      }
    }
  }
}
```

### Process Isolation

```javascript
// Container-based isolation
import { spawn } from 'child_process';

class IsolatedExecution {
  async executeInContainer(script, options = {}) {
    const containerArgs = [
      'run', '--rm',
      '--memory=1g',
      '--cpus=1',
      '--network=none',
      '--read-only',
      '--tmpfs=/tmp',
      '--security-opt=no-new-privileges',
      '--user=1000:1000',
      'llm-runner-sandbox',
      'node', '-e', script
    ];
    
    return new Promise((resolve, reject) => {
      const process = spawn('docker', containerArgs);
      let output = '';
      let error = '';
      
      process.stdout.on('data', data => output += data);
      process.stderr.on('data', data => error += data);
      
      process.on('close', code => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}: ${error}`));
        }
      });
      
      // Timeout protection
      setTimeout(() => {
        process.kill('SIGKILL');
        reject(new Error('Execution timeout'));
      }, options.timeout || 30000);
    });
  }
}
```

## Data Protection

### Encryption at Rest

```javascript
// Encrypt sensitive data
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class DataEncryption {
  constructor(masterKey) {
    this.algorithm = 'aes-256-gcm';
    this.masterKey = masterKey;
  }
  
  encrypt(data) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.masterKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const { encrypted, iv, authTag } = encryptedData;
    const decipher = createDecipheriv(
      this.algorithm, 
      this.masterKey, 
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}
```

### Data Anonymization

```javascript
// Anonymize sensitive data
class DataAnonymizer {
  constructor() {
    this.patterns = [
      { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: 'XXX-XX-XXXX' }, // SSN
      { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' }, // Email
      { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: 'XXXX-XXXX-XXXX-XXXX' }, // Credit card
      { regex: /\b\d{3}-\d{3}-\d{4}\b/g, replacement: 'XXX-XXX-XXXX' } // Phone
    ];
  }
  
  anonymize(text) {
    let result = text;
    for (const pattern of this.patterns) {
      result = result.replace(pattern.regex, pattern.replacement);
    }
    return result;
  }
  
  // Hash-based anonymization for consistent replacement
  hashAnonymize(text, salt) {
    const hash = crypto.createHash('sha256');
    hash.update(text + salt);
    return hash.digest('hex').substring(0, 8);
  }
}
```

## Authentication & Authorization

### API Key Management

```javascript
// Secure API key system
import { randomBytes, timingSafeEqual } from 'crypto';

class APIKeyManager {
  constructor() {
    this.keys = new Map(); // In production, use secure database
    this.rateLimits = new Map();
  }
  
  generateKey(userId, permissions = []) {
    const keyBytes = randomBytes(32);
    const key = `llmr_${keyBytes.toString('hex')}`;
    
    this.keys.set(key, {
      userId,
      permissions,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0
    });
    
    return key;
  }
  
  validateKey(providedKey) {
    const keyData = this.keys.get(providedKey);
    if (!keyData) {
      return null;
    }
    
    // Update usage tracking
    keyData.lastUsed = new Date();
    keyData.usageCount++;
    
    return keyData;
  }
  
  hasPermission(key, requiredPermission) {
    const keyData = this.keys.get(key);
    if (!keyData) return false;
    
    return keyData.permissions.includes(requiredPermission) || 
           keyData.permissions.includes('admin');
  }
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const key = authHeader.substring(7);
  const keyData = keyManager.validateKey(key);
  
  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.auth = keyData;
  next();
}
```

### Role-Based Access Control

```javascript
// RBAC implementation
class RBACSystem {
  constructor() {
    this.roles = {
      'admin': ['model:load', 'model:unload', 'system:config', 'inference:all'],
      'developer': ['model:load', 'inference:all', 'debug:access'],
      'user': ['inference:basic'],
      'readonly': ['system:status', 'model:list']
    };
  }
  
  hasPermission(userRoles, requiredPermission) {
    for (const role of userRoles) {
      const permissions = this.roles[role] || [];
      if (permissions.includes(requiredPermission) || permissions.includes('*')) {
        return true;
      }
    }
    return false;
  }
  
  authorize(requiredPermission) {
    return (req, res, next) => {
      if (!req.auth?.roles) {
        return res.status(403).json({ error: 'No roles assigned' });
      }
      
      if (!this.hasPermission(req.auth.roles, requiredPermission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    };
  }
}

// Usage
const rbac = new RBACSystem();
app.post('/models/:id/load', authenticate, rbac.authorize('model:load'), loadModel);
```

## Security Best Practices

### Secure Configuration

```javascript
// Security-first configuration
const secureDefaults = {
  // Network security
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0', // Bind to all interfaces
    timeout: 30000,
    keepAliveTimeout: 5000
  },
  
  // TLS/SSL
  tls: {
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_2_method',
    minVersion: 'TLSv1.2'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    skipSuccessfulRequests: false
  },
  
  // Security headers
  security: {
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true
  },
  
  // Model security
  models: {
    verifyChecksums: true,
    allowedSources: ['huggingface.co', 'localhost'],
    maxModelSize: '10GB',
    sandboxed: true
  }
};
```

### Secure Deployment

```dockerfile
# Secure Docker container
FROM node:18-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S llmrunner -u 1001

# Set working directory
WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=llmrunner:nodejs . .

# Remove unnecessary packages
RUN apk del --purge curl wget

# Run as non-root user
USER llmrunner

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "index.js"]
```

### Environment Security

```bash
# Secure environment variables
export NODE_ENV=production
export DEBUG=0

# Security settings
export FORCE_HTTPS=true
export TRUST_PROXY=true
export SESSION_SECRET=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 32)

# Model verification
export VERIFY_MODEL_SIGNATURES=true
export TRUSTED_MODEL_SOURCES="huggingface.co,models.example.com"

# Resource limits
export MAX_MEMORY_USAGE=4GB
export MAX_CPU_USAGE=80%
export MAX_CONCURRENT_REQUESTS=100
```

## Vulnerability Management

### Security Scanning

```javascript
// Automated vulnerability scanning
import { exec } from 'child_process';

class SecurityScanner {
  async scanDependencies() {
    return new Promise((resolve, reject) => {
      exec('npm audit --audit-level high --json', (error, stdout, stderr) => {
        if (error && error.code > 0) {
          const audit = JSON.parse(stdout);
          resolve(audit);
        } else {
          resolve({ vulnerabilities: {} });
        }
      });
    });
  }
  
  async scanCode() {
    // Use tools like ESLint security rules, Semgrep, etc.
    return new Promise((resolve, reject) => {
      exec('semgrep --config=auto .', (error, stdout, stderr) => {
        resolve({
          issues: this.parseSecurityIssues(stdout)
        });
      });
    });
  }
  
  async generateReport() {
    const [dependencies, code] = await Promise.all([
      this.scanDependencies(),
      this.scanCode()
    ]);
    
    return {
      timestamp: new Date(),
      dependencies,
      code,
      summary: {
        critical: dependencies.vulnerabilities?.critical || 0,
        high: dependencies.vulnerabilities?.high || 0,
        moderate: dependencies.vulnerabilities?.moderate || 0,
        low: dependencies.vulnerabilities?.low || 0
      }
    };
  }
}
```

### Incident Response

```javascript
// Security incident handling
class IncidentHandler {
  constructor() {
    this.incidents = new Map();
  }
  
  reportIncident(type, details) {
    const incident = {
      id: crypto.randomUUID(),
      type,
      details,
      timestamp: new Date(),
      severity: this.assessSeverity(type),
      status: 'open'
    };
    
    this.incidents.set(incident.id, incident);
    this.notifySecurityTeam(incident);
    
    return incident.id;
  }
  
  assessSeverity(type) {
    const severityMap = {
      'unauthorized_access': 'critical',
      'malicious_model': 'critical',
      'data_breach': 'critical',
      'prompt_injection': 'high',
      'dos_attack': 'high',
      'suspicious_behavior': 'medium'
    };
    
    return severityMap[type] || 'low';
  }
  
  async notifySecurityTeam(incident) {
    if (incident.severity === 'critical') {
      // Immediate notification
      await this.sendAlert({
        channel: 'emergency',
        incident: incident.id,
        message: `Critical security incident: ${incident.type}`
      });
    }
  }
}
```

## Compliance

### Data Protection Compliance

```javascript
// GDPR/CCPA compliance helpers
class ComplianceManager {
  constructor() {
    this.dataRetentionPolicies = {
      'user_prompts': 30 * 24 * 60 * 60 * 1000, // 30 days
      'model_outputs': 7 * 24 * 60 * 60 * 1000,  // 7 days
      'system_logs': 90 * 24 * 60 * 60 * 1000    // 90 days
    };
  }
  
  async handleDataDeletionRequest(userId) {
    // Delete all user data
    const deletedData = {
      prompts: await this.deleteUserPrompts(userId),
      outputs: await this.deleteUserOutputs(userId),
      logs: await this.anonymizeUserLogs(userId)
    };
    
    // Create deletion audit trail
    await this.auditDataDeletion(userId, deletedData);
    
    return deletedData;
  }
  
  async handleDataExportRequest(userId) {
    const userData = {
      prompts: await this.getUserPrompts(userId),
      outputs: await this.getUserOutputs(userId),
      metadata: await this.getUserMetadata(userId)
    };
    
    return {
      format: 'json',
      data: userData,
      exportDate: new Date()
    };
  }
}
```

### Security Audit Trail

```javascript
// Comprehensive audit logging
class AuditLogger {
  constructor() {
    this.auditLog = [];
  }
  
  logEvent(event, userId, details) {
    const auditEntry = {
      timestamp: new Date(),
      event,
      userId,
      details,
      sessionId: details.sessionId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      checksum: this.generateChecksum(event, userId, details)
    };
    
    this.auditLog.push(auditEntry);
    this.persistAuditEntry(auditEntry);
  }
  
  generateChecksum(event, userId, details) {
    const data = JSON.stringify({ event, userId, details });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  async generateComplianceReport(startDate, endDate) {
    const entries = this.auditLog.filter(entry => 
      entry.timestamp >= startDate && entry.timestamp <= endDate
    );
    
    return {
      period: { start: startDate, end: endDate },
      totalEvents: entries.length,
      eventTypes: this.groupBy(entries, 'event'),
      users: new Set(entries.map(e => e.userId)).size,
      integrityVerified: entries.every(e => this.verifyChecksum(e))
    };
  }
}
```

---

*"Security is not about making systems impenetrable, but about making the cost of attack higher than the value of the target"*

*Stay vigilant, stay secure, stay innovative* 🛡️

Built with 💙 by Echo AI Systems