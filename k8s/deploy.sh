#!/bin/bash

# LLM Runner Router Kubernetes Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Environment: development, staging, production, helm
# Action: deploy, update, delete, status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="llm-systems"
APP_NAME="llm-runner-router"
HELM_CHART_PATH="helm/llm-runner-router"

# Default values
ENVIRONMENT="${1:-production}"
ACTION="${2:-deploy}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if namespace exists, create if not
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warning "Namespace $NAMESPACE does not exist, creating..."
        kubectl create namespace $NAMESPACE
    fi
    
    log_success "Prerequisites check passed"
}

deploy_with_kubectl() {
    local env=$1
    log_info "Deploying with kubectl for environment: $env"
    
    if [[ "$env" == "base" ]]; then
        kubectl apply -f .
    else
        kubectl apply -k overlays/$env/
    fi
    
    log_success "Deployment completed"
}

deploy_with_kustomize() {
    local env=$1
    log_info "Deploying with Kustomize for environment: $env"
    
    # Validate kustomization
    if ! kustomize build overlays/$env/ > /dev/null; then
        log_error "Kustomization validation failed"
        exit 1
    fi
    
    # Apply kustomization
    kubectl apply -k overlays/$env/
    
    log_success "Kustomize deployment completed"
}

deploy_with_helm() {
    log_info "Deploying with Helm..."
    
    # Check if Helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "Helm is not installed or not in PATH"
        exit 1
    fi
    
    # Check if chart exists
    if [[ ! -d "$HELM_CHART_PATH" ]]; then
        log_error "Helm chart not found at $HELM_CHART_PATH"
        exit 1
    fi
    
    # Install or upgrade
    if helm list -n $NAMESPACE | grep -q $APP_NAME; then
        log_info "Upgrading existing Helm release..."
        helm upgrade $APP_NAME $HELM_CHART_PATH \
            --namespace $NAMESPACE \
            --timeout 10m
    else
        log_info "Installing new Helm release..."
        helm install $APP_NAME $HELM_CHART_PATH \
            --namespace $NAMESPACE \
            --create-namespace \
            --timeout 10m
    fi
    
    log_success "Helm deployment completed"
}

check_deployment_status() {
    log_info "Checking deployment status..."
    
    # Check pods
    echo "Pods:"
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=$APP_NAME
    
    # Check services
    echo -e "\nServices:"
    kubectl get services -n $NAMESPACE -l app.kubernetes.io/name=$APP_NAME
    
    # Check ingress
    echo -e "\nIngress:"
    kubectl get ingress -n $NAMESPACE -l app.kubernetes.io/name=$APP_NAME
    
    # Check HPA
    echo -e "\nHorizontal Pod Autoscaler:"
    kubectl get hpa -n $NAMESPACE -l app.kubernetes.io/name=$APP_NAME
    
    # Check PVCs
    echo -e "\nPersistent Volume Claims:"
    kubectl get pvc -n $NAMESPACE -l app.kubernetes.io/name=$APP_NAME
}

wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    
    # Wait for deployment to be available
    kubectl wait --for=condition=available \
        --timeout=300s \
        deployment/$APP_NAME \
        -n $NAMESPACE
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready \
        --timeout=300s \
        pods -l app.kubernetes.io/name=$APP_NAME \
        -n $NAMESPACE
    
    log_success "Deployment is ready"
}

delete_deployment() {
    log_warning "Deleting deployment for environment: $ENVIRONMENT"
    
    read -p "Are you sure you want to delete the deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment deletion cancelled"
        exit 0
    fi
    
    case $ENVIRONMENT in
        "helm")
            if helm list -n $NAMESPACE | grep -q $APP_NAME; then
                helm uninstall $APP_NAME -n $NAMESPACE
            else
                log_warning "Helm release not found"
            fi
            ;;
        "development"|"staging"|"production")
            kubectl delete -k overlays/$ENVIRONMENT/ --ignore-not-found=true
            ;;
        *)
            kubectl delete -f . --ignore-not-found=true
            ;;
    esac
    
    log_success "Deployment deleted"
}

update_deployment() {
    local env=$1
    log_info "Updating deployment for environment: $env"
    
    case $env in
        "helm")
            deploy_with_helm
            ;;
        "development"|"staging"|"production")
            deploy_with_kustomize $env
            ;;
        *)
            deploy_with_kubectl "base"
            ;;
    esac
    
    wait_for_deployment
    check_deployment_status
}

validate_environment() {
    case $ENVIRONMENT in
        "development"|"staging"|"production"|"helm"|"base")
            return 0
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: development, staging, production, helm, base"
            exit 1
            ;;
    esac
}

show_usage() {
    echo "Usage: $0 [environment] [action]"
    echo ""
    echo "Environments:"
    echo "  development - Development environment (1 replica, reduced resources)"
    echo "  staging     - Staging environment (2 replicas, medium resources)"
    echo "  production  - Production environment (5+ replicas, high resources)"
    echo "  helm        - Deploy using Helm chart"
    echo "  base        - Deploy base manifests with kubectl"
    echo ""
    echo "Actions:"
    echo "  deploy      - Deploy the application (default)"
    echo "  update      - Update existing deployment"
    echo "  delete      - Delete the deployment"
    echo "  status      - Check deployment status"
    echo "  validate    - Validate manifests without deploying"
    echo ""
    echo "Examples:"
    echo "  $0 production deploy"
    echo "  $0 staging update"
    echo "  $0 helm deploy"
    echo "  $0 development status"
}

validate_manifests() {
    log_info "Validating manifests..."
    
    case $ENVIRONMENT in
        "helm")
            if command -v helm &> /dev/null; then
                helm lint $HELM_CHART_PATH
                helm template $APP_NAME $HELM_CHART_PATH --debug > /dev/null
            else
                log_error "Helm not installed, cannot validate Helm chart"
                exit 1
            fi
            ;;
        "development"|"staging"|"production")
            if command -v kustomize &> /dev/null; then
                kustomize build overlays/$ENVIRONMENT/ > /dev/null
            else
                log_warning "Kustomize not found, using kubectl for validation"
                kubectl apply -k overlays/$ENVIRONMENT/ --dry-run=client > /dev/null
            fi
            ;;
        *)
            kubectl apply -f . --dry-run=client > /dev/null
            ;;
    esac
    
    log_success "Manifest validation passed"
}

# Main execution
main() {
    # Handle help
    if [[ "$1" == "-h" || "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Change to script directory
    cd "$(dirname "$0")"
    
    # Validate inputs
    validate_environment
    
    log_info "LLM Runner Router Kubernetes Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"
    log_info "Namespace: $NAMESPACE"
    echo ""
    
    # Execute action
    case $ACTION in
        "deploy")
            check_prerequisites
            validate_manifests
            case $ENVIRONMENT in
                "helm")
                    deploy_with_helm
                    ;;
                "development"|"staging"|"production")
                    deploy_with_kustomize $ENVIRONMENT
                    ;;
                *)
                    deploy_with_kubectl "base"
                    ;;
            esac
            wait_for_deployment
            check_deployment_status
            ;;
        "update")
            check_prerequisites
            validate_manifests
            update_deployment $ENVIRONMENT
            ;;
        "delete")
            check_prerequisites
            delete_deployment
            ;;
        "status")
            check_prerequisites
            check_deployment_status
            ;;
        "validate")
            validate_manifests
            ;;
        *)
            log_error "Invalid action: $ACTION"
            show_usage
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully!"
}

# Run main function
main "$@"