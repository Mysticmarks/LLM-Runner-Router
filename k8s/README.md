# LLM Runner Router - Kubernetes Deployment

This directory contains comprehensive Kubernetes manifests for deploying the LLM Runner Router in production environments with proper scaling, security, and observability.

## 📁 Directory Structure

```
k8s/
├── README.md                    # This file
├── deployment.yaml             # Main application deployment
├── service.yaml                # LoadBalancer and internal services
├── ingress.yaml                # NGINX ingress with WebSocket support
├── configmap.yaml              # Application configuration
├── secret.yaml                 # Sensitive configuration template
├── hpa.yaml                    # Horizontal Pod Autoscaler + KEDA
├── pvc.yaml                    # Persistent Volume Claims for model cache
├── networkpolicy.yaml          # Network isolation rules
├── base/                       # Kustomize base configuration
│   ├── kustomization.yaml      # Base Kustomize manifest
│   ├── namespace.yaml          # Namespace definition
│   ├── serviceaccount.yaml     # Service account
│   └── rbac.yaml               # RBAC permissions
└── overlays/                   # Environment-specific overrides
    ├── development/            # Dev environment (1 replica, reduced resources)
    ├── staging/                # Staging environment (2 replicas, medium resources)
    └── production/             # Production environment (5+ replicas, high resources)
```

## 🚀 Quick Start

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- NGINX Ingress Controller
- cert-manager (optional, for TLS)
- Prometheus (optional, for monitoring)

### 1. Deploy with kubectl

```bash
# Create namespace
kubectl create namespace llm-systems

# Apply base manifests
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n llm-systems
kubectl get services -n llm-systems
```

### 2. Deploy with Kustomize

```bash
# Development environment
kubectl apply -k k8s/overlays/development/

# Staging environment
kubectl apply -k k8s/overlays/staging/

# Production environment
kubectl apply -k k8s/overlays/production/
```

### 3. Deploy with Helm

```bash
# Add repository (if published)
helm repo add llm-runner-router https://charts.yourdomain.com

# Install with default values
helm install llm-router helm/llm-runner-router/ \
  --namespace llm-systems \
  --create-namespace

# Install with custom values
helm install llm-router helm/llm-runner-router/ \
  --namespace llm-systems \
  --create-namespace \
  --values custom-values.yaml
```

## 🔧 Configuration

### Environment Variables

Key configuration options available via ConfigMap:

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTING_STRATEGY` | `balanced` | Model routing strategy |
| `MAX_MEMORY` | `4096` | Maximum memory per container (MB) |
| `CACHE_ENABLED` | `true` | Enable model caching |
| `LOG_LEVEL` | `info` | Logging level |
| `MAX_CONCURRENT_REQUESTS` | `100` | Request concurrency limit |
| `WS_MAX_CONNECTIONS` | `1000` | WebSocket connection limit |

### Secrets Management

**⚠️ Important**: Replace placeholder values in `secret.yaml` before deploying:

```bash
# Create secrets manually (recommended)
kubectl create secret generic llm-runner-secrets \
  --from-literal=huggingface-token=your-token \
  --from-literal=api-key=your-api-key \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --namespace=llm-systems
```

## 📊 Scaling and Performance

### Horizontal Pod Autoscaler (HPA)

The deployment includes HPA configuration that scales based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Custom metrics (requests/second, WebSocket connections)

```yaml
# HPA configuration
minReplicas: 2
maxReplicas: 10
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80
```

### KEDA Scaling (Optional)

For advanced scaling based on Prometheus metrics:

```bash
# Install KEDA
kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.10.0/keda-2.10.0.yaml

# KEDA ScaledObject is included in hpa.yaml
```

### Resource Allocation

| Environment | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|-------------|-------------|-----------|----------------|--------------|----------|
| Development | 100m | 500m | 512Mi | 2Gi | 1 |
| Staging | 250m | 1000m | 1Gi | 4Gi | 2 |
| Production | 1000m | 4000m | 4Gi | 16Gi | 5-20 |

## 💾 Storage

### Persistent Volumes

The deployment uses three types of storage:

1. **Model Cache** (50Gi default)
   - Stores downloaded ML models
   - ReadWriteMany access mode
   - High-performance SSD recommended

2. **Logs** (10Gi default)
   - Application logs
   - ReadWriteMany for log aggregation

3. **Shared Cache** (20Gi default)
   - Runtime caching between pods
   - ReadWriteMany access mode

### Storage Classes

Adjust `storageClassName` in PVC manifests:

```yaml
# High-performance for model cache
storageClassName: fast-ssd  # GP3, Premium SSD, etc.

# Standard for logs
storageClassName: standard-ssd  # GP2, Standard SSD, etc.
```

## 🌐 Networking

### Ingress Configuration

The deployment includes two ingress resources:

1. **Main API Ingress**
   - HTTP/HTTPS API endpoints
   - TLS termination
   - Rate limiting
   - CORS support

2. **WebSocket Ingress**
   - Dedicated WebSocket handling
   - Sticky sessions
   - Connection upgrade headers

### Network Policies

Network isolation is enforced with policies that:
- Allow ingress from NGINX controllers
- Allow egress to external APIs (HuggingFace, etc.)
- Block unauthorized inter-pod communication
- Allow monitoring scraping

### Service Types

Three service types are provided:

1. **LoadBalancer** - External access
2. **ClusterIP Internal** - Internal cluster communication
3. **Headless** - Direct pod access for StatefulSet-like behavior

## 🔒 Security

### Pod Security

- Non-root user (UID 1001)
- Read-only root filesystem (where possible)
- Dropped capabilities
- Security context enforcement

### RBAC Permissions

Minimal required permissions:
- Read ConfigMaps and Secrets
- Read Services and Endpoints
- Read Pods for health checks
- Read PVCs for storage info

### Network Security

- Network policies restrict traffic flow
- TLS termination at ingress
- Internal communication encryption
- Rate limiting protection

## 📈 Monitoring

### Prometheus Integration

The deployment exposes metrics on `/metrics` endpoint:

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: llm-runner-router
spec:
  selector:
    matchLabels:
      app: llm-runner-router
  endpoints:
  - port: http
    path: /metrics
```

### Health Checks

Three types of probes are configured:

1. **Liveness Probe** - `/api/health` (restart if failing)
2. **Readiness Probe** - `/api/ready` (remove from service if failing)
3. **Startup Probe** - `/api/health` (initial startup check)

### Logging

Structured JSON logging with configurable levels:
- Development: `debug`
- Staging: `info`
- Production: `warn`

## 🔄 Deployment Strategies

### Rolling Updates

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

### Blue-Green Deployment

Use Kustomize overlays or Helm values for blue-green:

```bash
# Deploy green version
helm upgrade llm-router helm/llm-runner-router/ \
  --set image.tag=v1.2.2 \
  --set namePrefix=green-

# Switch traffic
kubectl patch service llm-runner-router \
  -p '{"spec":{"selector":{"version":"green"}}}'
```

### Canary Deployment

Use ingress traffic splitting:

```yaml
# NGINX ingress canary annotations
nginx.ingress.kubernetes.io/canary: "true"
nginx.ingress.kubernetes.io/canary-weight: "10"
```

## 🛠️ Troubleshooting

### Common Issues

1. **Pod not starting**
   ```bash
   kubectl describe pod <pod-name> -n llm-systems
   kubectl logs <pod-name> -n llm-systems
   ```

2. **Storage issues**
   ```bash
   kubectl get pvc -n llm-systems
   kubectl describe pvc llm-model-cache -n llm-systems
   ```

3. **Network connectivity**
   ```bash
   kubectl get networkpolicy -n llm-systems
   kubectl describe networkpolicy llm-runner-router-netpol -n llm-systems
   ```

4. **Scaling issues**
   ```bash
   kubectl get hpa -n llm-systems
   kubectl describe hpa llm-runner-router-hpa -n llm-systems
   ```

### Debug Commands

```bash
# Check all resources
kubectl get all -n llm-systems

# Check events
kubectl get events -n llm-systems --sort-by=.metadata.creationTimestamp

# Port forward for testing
kubectl port-forward service/llm-runner-router 8080:3006 -n llm-systems

# Exec into pod
kubectl exec -it <pod-name> -n llm-systems -- /bin/sh
```

## 🔄 Updates and Maintenance

### Rolling Updates

```bash
# Update image tag
kubectl set image deployment/llm-runner-router \
  llm-runner-router=llm-runner-router:v1.2.2 \
  -n llm-systems

# Monitor rollout
kubectl rollout status deployment/llm-runner-router -n llm-systems

# Rollback if needed
kubectl rollout undo deployment/llm-runner-router -n llm-systems
```

### Configuration Updates

```bash
# Update ConfigMap
kubectl patch configmap llm-runner-config \
  --patch '{"data":{"log-level":"debug"}}' \
  -n llm-systems

# Restart deployment to pick up changes
kubectl rollout restart deployment/llm-runner-router -n llm-systems
```

## 📋 Production Checklist

Before deploying to production:

- [ ] Replace all placeholder secrets
- [ ] Configure proper storage classes
- [ ] Set up monitoring and alerting
- [ ] Configure backup for persistent volumes
- [ ] Set resource quotas for namespace
- [ ] Configure network policies
- [ ] Set up log aggregation
- [ ] Configure TLS certificates
- [ ] Test scaling behavior
- [ ] Validate health checks
- [ ] Test disaster recovery

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Kustomize](https://kustomize.io/)
- [Helm](https://helm.sh/)
- [KEDA](https://keda.sh/)
- [Prometheus Operator](https://prometheus-operator.dev/)

## 🤝 Contributing

To contribute to the Kubernetes manifests:

1. Test changes in development overlay
2. Validate with `kubectl --dry-run=client`
3. Check with `kustomize build`
4. Update documentation
5. Submit pull request

## 📄 License

This deployment configuration is part of the LLM Runner Router project and follows the same MIT license.