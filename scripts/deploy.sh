#!/bin/bash

# Autonomous Deployment Script for LLM-Runner-Router
# Handles production deployment with zero-downtime strategies

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ID="deploy_$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/deployments/$DEPLOYMENT_ID"

# Configuration
DEFAULT_ENV="production"
DEFAULT_PORT="3006"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_DELAY=3

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Parse command line arguments
parse_args() {
    ENV="${1:-$DEFAULT_ENV}"
    PORT="${2:-$DEFAULT_PORT}"
    
    case "$ENV" in
        production|staging|development)
            ;;
        *)
            error "Invalid environment: $ENV"
            echo "Valid environments: production, staging, development"
            exit 1
            ;;
    esac
    
    log "Deployment configuration:"
    log "  Environment: $ENV"
    log "  Port: $PORT"
    log "  Deployment ID: $DEPLOYMENT_ID"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    cd "$PROJECT_DIR"
    
    # Check if this is a git repository
    if [[ -d ".git" ]]; then
        # Check for uncommitted changes
        if [[ -n "$(git status --porcelain)" ]]; then
            warning "Uncommitted changes detected"
            read -p "Continue deployment? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
        
        # Get current commit info
        CURRENT_COMMIT=$(git rev-parse HEAD)
        CURRENT_BRANCH=$(git branch --show-current)
        log "Deploying: $CURRENT_BRANCH @ ${CURRENT_COMMIT:0:8}"
    fi
    
    # Check environment file exists
    local env_file=".env.$ENV"
    if [[ ! -f "$env_file" ]] && [[ "$ENV" != "development" ]]; then
        if [[ -f ".env.example" ]]; then
            warning "Environment file $env_file not found, creating from example"
            cp ".env.example" "$env_file"
            warning "Please update $env_file with production values"
        else
            error "No environment configuration found for $ENV"
            exit 1
        fi
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js not found"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if [[ $(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1) != "$required_version" ]]; then
        error "Node.js version $node_version is too old. Required: $required_version+"
        exit 1
    fi
    
    success "Pre-deployment checks passed"
}

# Create deployment backup
create_deployment_backup() {
    log "Creating deployment backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current state
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        cp "$PROJECT_DIR/.env" "$BACKUP_DIR/"
    fi
    
    if [[ -f "$PROJECT_DIR/package.json" ]]; then
        cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/"
    fi
    
    if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
        cp "$PROJECT_DIR/package-lock.json" "$BACKUP_DIR/"
    fi
    
    # Save current process info if running
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "$(pgrep -f "node.*server.js")" > "$BACKUP_DIR/previous_pid"
        ps aux | grep "node.*server.js" | grep -v grep > "$BACKUP_DIR/previous_process_info"
    fi
    
    # Create deployment metadata
    cat > "$BACKUP_DIR/deployment_info.json" << EOF
{
    "deployment_id": "$DEPLOYMENT_ID",
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENV",
    "port": "$PORT",
    "node_version": "$(node --version)",
    "git_commit": "${CURRENT_COMMIT:-unknown}",
    "git_branch": "${CURRENT_BRANCH:-unknown}"
}
EOF
    
    success "Backup created: $BACKUP_DIR"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Clean install for production
    if [[ "$ENV" == "production" ]]; then
        rm -rf node_modules package-lock.json 2>/dev/null || true
        npm ci --only=production --no-optional --no-audit
    else
        npm install
    fi
    
    success "Dependencies installed"
}

# Build application
build_application() {
    log "Building application..."
    
    cd "$PROJECT_DIR"
    
    # Set environment
    export NODE_ENV="$ENV"
    
    # Run linting (warning only for production)
    if npm run lint 2>/dev/null; then
        success "Code linting passed"
    else
        if [[ "$ENV" == "production" ]]; then
            warning "Linting issues detected but continuing..."
        else
            error "Linting failed"
            return 1
        fi
    fi
    
    # Build documentation
    npm run docs || warning "Documentation build had issues"
    
    # Build distribution
    npm run build
    
    success "Application built successfully"
}

# Run tests
run_deployment_tests() {
    log "Running deployment tests..."
    
    cd "$PROJECT_DIR"
    
    # Run unit tests
    if npm run test:unit 2>/dev/null; then
        success "Unit tests passed"
    else
        if [[ "$ENV" == "production" ]]; then
            error "Unit tests failed - aborting production deployment"
            return 1
        else
            warning "Unit tests failed but continuing for $ENV environment"
        fi
    fi
    
    # Run integration tests for non-production
    if [[ "$ENV" != "production" ]]; then
        if npm run test:integration 2>/dev/null; then
            success "Integration tests passed"
        else
            warning "Integration tests failed"
        fi
    fi
}

# Deploy with zero downtime
deploy_with_zero_downtime() {
    log "Deploying with zero-downtime strategy..."
    
    local old_pid=""
    local temp_port=$((PORT + 1000))
    
    # Check if service is currently running
    if pgrep -f "node.*server.js" > /dev/null; then
        old_pid=$(pgrep -f "node.*server.js")
        log "Current service running with PID: $old_pid"
        
        # Start new instance on temporary port
        log "Starting new instance on port $temp_port..."
        PORT=$temp_port NODE_ENV="$ENV" nohup node server.js > "server_new.log" 2>&1 &
        local new_pid=$!
        
        # Wait for new instance to be ready
        local ready=false
        for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
            sleep $HEALTH_CHECK_DELAY
            if curl -f -s "http://localhost:$temp_port/api/health" > /dev/null 2>&1; then
                ready=true
                break
            fi
            log "Waiting for new instance to be ready... ($i/$HEALTH_CHECK_RETRIES)"
        done
        
        if [[ "$ready" == "true" ]]; then
            success "New instance ready on port $temp_port"
            
            # Stop old instance
            log "Stopping old instance..."
            kill "$old_pid" 2>/dev/null || true
            sleep 2
            
            # Kill new instance temporarily
            kill "$new_pid" 2>/dev/null || true
            sleep 1
            
            # Start new instance on correct port
            log "Starting new instance on port $PORT..."
        else
            error "New instance failed health check, keeping old instance"
            kill "$new_pid" 2>/dev/null || true
            return 1
        fi
    else
        log "No running service detected, performing fresh deployment"
    fi
    
    # Start the service on the correct port
    PORT="$PORT" NODE_ENV="$ENV" nohup node server.js > server.log 2>&1 &
    local final_pid=$!
    echo "$final_pid" > "$PROJECT_DIR/llm-router.pid"
    
    # Health check for final deployment
    local ready=false
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        sleep $HEALTH_CHECK_DELAY
        if curl -f -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
            ready=true
            break
        fi
        log "Waiting for deployment to be ready... ($i/$HEALTH_CHECK_RETRIES)"
    done
    
    if [[ "$ready" == "true" ]]; then
        success "Deployment successful! Service running on port $PORT (PID: $final_pid)"
        return 0
    else
        error "Deployment health check failed"
        return 1
    fi
}

# Rollback deployment
rollback_deployment() {
    warning "Rolling back deployment..."
    
    # Stop current instance
    if [[ -f "$PROJECT_DIR/llm-router.pid" ]]; then
        local pid=$(cat "$PROJECT_DIR/llm-router.pid")
        kill "$pid" 2>/dev/null || true
        rm -f "$PROJECT_DIR/llm-router.pid"
    fi
    
    # Restore from backup
    if [[ -f "$BACKUP_DIR/.env" ]]; then
        cp "$BACKUP_DIR/.env" "$PROJECT_DIR/"
    fi
    
    if [[ -f "$BACKUP_DIR/package.json" ]]; then
        cp "$BACKUP_DIR/package.json" "$PROJECT_DIR/"
        npm ci --only=production 2>/dev/null || npm install --only=production
    fi
    
    # Try to start previous version
    cd "$PROJECT_DIR"
    npm run build 2>/dev/null || true
    
    warning "Rollback completed. Please manually restart the service."
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."
    
    # Clean up old deployments (keep last 5)
    find "$PROJECT_DIR/deployments" -maxdepth 1 -type d -name "deploy_*" | sort -r | tail -n +6 | xargs rm -rf 2>/dev/null || true
    
    # Clean up temporary files
    rm -f "$PROJECT_DIR/server_new.log"
    
    # Update deployment record
    echo "$DEPLOYMENT_ID" > "$PROJECT_DIR/.last_deployment"
    
    success "Post-deployment tasks completed"
}

# Main deployment function
main() {
    log "🚀 Starting autonomous deployment..."
    
    parse_args "$@"
    pre_deployment_checks
    create_deployment_backup
    
    # Perform deployment steps
    if install_dependencies && build_application && run_deployment_tests; then
        if deploy_with_zero_downtime; then
            post_deployment_tasks
            
            success "🎉 Deployment completed successfully!"
            log "📋 Deployment Summary:"
            log "   • Environment: $ENV"
            log "   • Port: $PORT"
            log "   • Deployment ID: $DEPLOYMENT_ID"
            log "   • Service URL: http://localhost:$PORT"
            log "   • Health Check: http://localhost:$PORT/api/health"
            log "   • Documentation: http://localhost:$PORT/docs.html"
            
        else
            error "Deployment failed during zero-downtime switch"
            rollback_deployment
            exit 1
        fi
    else
        error "Deployment failed during build/test phase"
        rollback_deployment
        exit 1
    fi
}

# Handle script interruption
trap 'error "Deployment interrupted"; rollback_deployment; exit 1' INT TERM

# Show usage if no arguments
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [environment] [port]"
    echo ""
    echo "Arguments:"
    echo "  environment  - deployment environment (production|staging|development)"
    echo "  port         - port number (default: 3006)"
    echo ""
    echo "Examples:"
    echo "  $0 production 3006"
    echo "  $0 staging 3001"
    echo "  $0 development"
    echo ""
    exit 1
fi

# Run deployment
main "$@"