# LLM Runner Router Helm Chart

This directory contains the Helm chart for deploying LLM Runner Router to Kubernetes clusters.

## Overview

LLM Runner Router is a universal LLM model loader and inference router that provides intelligent model orchestration, format-agnostic loading, and high-performance inference capabilities. This Helm chart simplifies deployment and management of the application in Kubernetes environments.

## Chart Details

- **Chart Version**: 1.2.1
- **App Version**: 1.2.1
- **Kubernetes Version**: >=1.20.0
- **Type**: Application

## Features

### Core Components
- **Deployment**: Configurable replica sets with rolling update strategy
- **Service**: Load balancer and internal service exposure
- **Ingress**: HTTPS/TLS termination with WebSocket support
- **HPA**: Automatic scaling based on CPU/memory metrics
- **PVC**: Persistent storage for model files
- **ConfigMap**: Application configuration management
- **Secrets**: Secure credential storage

### Advanced Features
- **Multi-environment support**: Development, staging, and production configurations
- **Security**: RBAC, NetworkPolicies, Pod Security Policies
- **Monitoring**: Prometheus metrics and health checks
- **High Availability**: Pod Disruption Budgets and anti-affinity rules
- **Resource Management**: CPU/memory limits and GPU support

## Prerequisites

- Kubernetes cluster 1.20+
- Helm 3.0+
- kubectl configured to access your cluster
- (Optional) NVIDIA GPU operator for GPU support
- (Optional) Prometheus operator for monitoring

## Installation

### Basic Installation

```bash
# Add the repository (if published)
helm repo add llm-router https://your-helm-repo.com
helm repo update

# Install the chart
helm install llm-router ./helm/llm-runner-router
```

### Install with custom values

```bash
# Development environment
helm install llm-router ./helm/llm-runner-router -f helm/llm-runner-router/values-development.yaml

# Production environment
helm install llm-router ./helm/llm-runner-router -f helm/llm-runner-router/values-production.yaml
```

### Install with specific parameters

```bash
helm install llm-router ./helm/llm-runner-router \
  --set deployment.replicaCount=5 \
  --set image.tag=latest \
  --set persistence.size=100Gi
```

## Configuration

### Key Configuration Options

| Parameter | Description | Default |
|-----------|-------------|---------|
| `deployment.replicaCount` | Number of pod replicas | `3` |
| `image.repository` | Docker image repository | `llm-runner-router` |
| `image.tag` | Docker image tag | `1.2.1` |
| `service.type` | Kubernetes service type | `LoadBalancer` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable ingress controller | `true` |
| `ingress.hosts` | Ingress hostnames | `["llm-router.local"]` |
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size` | PVC size for model storage | `50Gi` |
| `resources.limits.memory` | Memory limit | `8Gi` |
| `resources.limits.cpu` | CPU limit | `4` |
| `autoscaling.enabled` | Enable HPA | `true` |
| `autoscaling.minReplicas` | Minimum pod replicas | `3` |
| `autoscaling.maxReplicas` | Maximum pod replicas | `10` |

### Environment-Specific Values

#### Development (`values-development.yaml`)
- Lower resource requirements
- Single replica
- Debug logging enabled
- Relaxed security policies

#### Production (`values-production.yaml`)
- High availability configuration
- Enhanced security policies
- Production-grade monitoring
- Optimized resource allocation

## Usage Examples

### Expose service locally
```bash
kubectl port-forward service/llm-router 3000:80
```

### Check deployment status
```bash
kubectl get pods -l app.kubernetes.io/name=llm-runner-router
kubectl describe deployment llm-router
```

### View logs
```bash
kubectl logs -l app.kubernetes.io/name=llm-runner-router --tail=100 -f
```

### Scale deployment
```bash
kubectl scale deployment llm-router --replicas=5
```

## Architecture

### Directory Structure
```
helm/llm-runner-router/
├── Chart.yaml                 # Chart metadata
├── values.yaml                # Default configuration
├── values-development.yaml    # Development overrides
├── values-production.yaml     # Production overrides
└── templates/
    ├── deployment.yaml        # Main application deployment
    ├── service.yaml          # Service definitions
    ├── ingress.yaml          # Ingress rules
    ├── hpa.yaml              # Horizontal Pod Autoscaler
    ├── pvc.yaml              # Persistent Volume Claims
    ├── configmap.yaml        # Application configuration
    ├── secret.yaml           # Sensitive data
    ├── serviceaccount.yaml   # Service account
    ├── rbac.yaml             # Role-based access control
    ├── networkpolicy.yaml    # Network policies
    └── pdb.yaml              # Pod disruption budget
```

### Model Storage
The chart provisions persistent storage for LLM models:
- Models are stored in `/app/models` within containers
- PVC ensures models persist across pod restarts
- Support for ReadWriteMany access mode for shared model access

### Networking
- HTTP service on port 80 (configurable)
- WebSocket support on port 8080
- Ingress with TLS/SSL termination
- Network policies for pod-to-pod communication

## Monitoring & Observability

### Health Checks
- Liveness probe: `/health`
- Readiness probe: `/ready`
- Startup probe: `/startup`

### Metrics
- Prometheus metrics exposed on `/metrics`
- Custom metrics for model performance
- Request latency and throughput tracking

## Security

### Built-in Security Features
- Non-root user execution
- Read-only root filesystem
- Security contexts and pod security policies
- Network policies for traffic isolation
- RBAC for fine-grained access control
- Secrets management for sensitive data

## Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod <pod-name>
   kubectl logs <pod-name> --previous
   ```

2. **Model loading failures**
   - Check PVC is mounted correctly
   - Verify sufficient storage space
   - Review model file permissions

3. **Performance issues**
   - Check resource limits and requests
   - Review HPA metrics
   - Monitor node resource utilization

4. **Networking problems**
   - Verify service endpoints
   - Check ingress configuration
   - Review network policies

## Upgrade Guide

### Upgrading the chart
```bash
# Check current version
helm list

# Upgrade to new version
helm upgrade llm-router ./helm/llm-runner-router

# Rollback if needed
helm rollback llm-router
```

### Migration Notes
- Version 1.2.0 → 1.2.1: No breaking changes
- Always backup persistent data before major upgrades

## Contributing

When modifying the Helm chart:
1. Update version in `Chart.yaml`
2. Document changes in this README
3. Test in development environment first
4. Validate with `helm lint`

## Support

For issues related to:
- **Application**: See main project repository
- **Helm Chart**: Create issue with `helm-chart` label
- **Deployment**: Check troubleshooting section first

## License

This Helm chart is released under the same license as the LLM Runner Router project (MIT).