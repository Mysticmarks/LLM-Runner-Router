#!/bin/bash

# Environment Configuration Manager for LLM-Runner-Router
# Manages environment configurations and security

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

# Available environments
ENVIRONMENTS=("development" "staging" "production" "vps")

# Show current environment
show_current() {
    log "Current environment configuration:"
    
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        local node_env=$(grep "^NODE_ENV=" "$PROJECT_DIR/.env" | cut -d'=' -f2 || echo "undefined")
        local port=$(grep "^PORT=" "$PROJECT_DIR/.env" | cut -d'=' -f2 || echo "undefined")
        
        echo "  Environment: $node_env"
        echo "  Port: $port"
        echo "  Config file: .env"
        
        # Check for security issues
        check_security_issues "$PROJECT_DIR/.env"
    else
        warning "No .env file found"
    fi
}

# Switch environment
switch_environment() {
    local target_env="$1"
    local env_file=".env.$target_env"
    
    if [[ ! -f "$PROJECT_DIR/$env_file" ]]; then
        error "Environment file $env_file not found"
        return 1
    fi
    
    log "Switching to $target_env environment..."
    
    # Backup current environment
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.backup"
        log "Current environment backed up to .env.backup"
    fi
    
    # Copy target environment
    cp "$PROJECT_DIR/$env_file" "$PROJECT_DIR/.env"
    
    success "Switched to $target_env environment"
    
    # Show new configuration
    show_current
}

# Initialize new environment
init_environment() {
    local env_name="$1"
    local env_file=".env.$env_name"
    
    if [[ -f "$PROJECT_DIR/$env_file" ]]; then
        warning "Environment $env_name already exists"
        read -p "Overwrite? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    log "Creating new environment: $env_name"
    
    # Use example as template
    if [[ -f "$PROJECT_DIR/.env.example" ]]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/$env_file"
        
        # Update NODE_ENV
        sed -i "s/NODE_ENV=.*/NODE_ENV=$env_name/" "$PROJECT_DIR/$env_file"
        
        # Generate secure secrets
        if command -v openssl &> /dev/null; then
            local session_secret=$(openssl rand -hex 32)
            local api_key=$(openssl rand -hex 32)
            
            sed -i "s/your-session-secret-here/$session_secret/" "$PROJECT_DIR/$env_file"
            sed -i "s/dev-key-123456789/$api_key/" "$PROJECT_DIR/$env_file"
            
            log "Generated secure secrets"
        else
            warning "OpenSSL not available - please manually update secrets in $env_file"
        fi
        
        success "Environment $env_name created: $env_file"
        
    else
        error ".env.example not found - cannot create new environment"
        return 1
    fi
}

# Validate environment configuration
validate_environment() {
    local env_file="${1:-$PROJECT_DIR/.env}"
    
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
        return 1
    fi
    
    log "Validating environment configuration: $(basename "$env_file")"
    
    local issues=0
    
    # Check required variables
    local required_vars=("NODE_ENV" "PORT" "HOST")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file"; then
            error "Required variable missing: $var"
            ((issues++))
        fi
    done
    
    # Check for security issues
    check_security_issues "$env_file"
    local security_issues=$?
    ((issues += security_issues))
    
    # Check for syntax issues
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue
        
        # Check for proper format
        if [[ ! "$line" =~ ^[A-Z_][A-Z0-9_]*=.*$ ]]; then
            warning "Potential syntax issue: $line"
        fi
    done < "$env_file"
    
    if [[ $issues -eq 0 ]]; then
        success "Environment validation passed"
        return 0
    else
        error "Environment validation failed with $issues issues"
        return 1
    fi
}

# Check for security issues
check_security_issues() {
    local env_file="$1"
    local issues=0
    
    # Get environment type
    local node_env=$(grep "^NODE_ENV=" "$env_file" | cut -d'=' -f2 || echo "unknown")
    
    # Check for default/weak secrets
    local weak_patterns=(
        "your-session-secret-here"
        "your-.*-here"
        "dev-key-123456789"
        "test-key-987654321"
        "replace-.*"
        "changeme"
        "password123"
        "secret123"
    )
    
    for pattern in "${weak_patterns[@]}"; do
        if grep -qi "$pattern" "$env_file"; then
            if [[ "$node_env" == "production" ]]; then
                error "SECURITY: Weak/default secret found in production: $pattern"
                ((issues++))
            else
                warning "Weak/default secret found: $pattern"
            fi
        fi
    done
    
    # Check for production-specific issues
    if [[ "$node_env" == "production" ]]; then
        # Check CORS origins
        if grep -q "localhost" "$env_file" | grep -q "ALLOWED_ORIGINS"; then
            warning "SECURITY: localhost found in production CORS origins"
        fi
        
        # Check API keys length
        local api_keys=$(grep "^API_KEYS=" "$env_file" | cut -d'=' -f2)
        if [[ ${#api_keys} -lt 32 ]]; then
            error "SECURITY: API keys too short for production (minimum 32 characters)"
            ((issues++))
        fi
        
        # Check log level
        if grep -q "LOG_LEVEL=debug" "$env_file"; then
            warning "SECURITY: Debug logging enabled in production"
        fi
    fi
    
    return $issues
}

# Generate secure secrets
generate_secrets() {
    if ! command -v openssl &> /dev/null; then
        error "OpenSSL not available for secret generation"
        return 1
    fi
    
    log "Generating secure secrets..."
    
    echo "Session Secret (32 bytes): $(openssl rand -hex 32)"
    echo "API Key (32 bytes): $(openssl rand -hex 32)"
    echo "Webhook Secret (16 bytes): $(openssl rand -hex 16)"
    echo "JWT Secret (32 bytes): $(openssl rand -hex 32)"
    
    success "Secrets generated"
}

# List all environments
list_environments() {
    log "Available environments:"
    
    for env in "${ENVIRONMENTS[@]}"; do
        local env_file="$PROJECT_DIR/.env.$env"
        if [[ -f "$env_file" ]]; then
            local node_env=$(grep "^NODE_ENV=" "$env_file" | cut -d'=' -f2 || echo "undefined")
            local port=$(grep "^PORT=" "$env_file" | cut -d'=' -f2 || echo "undefined")
            echo "  ✅ $env (NODE_ENV=$node_env, PORT=$port)"
        else
            echo "  ❌ $env (not configured)"
        fi
    done
    
    echo ""
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        echo "Current: .env"
    else
        echo "Current: none"
    fi
}

# Backup environments
backup_environments() {
    local backup_dir="$PROJECT_DIR/env-backups/$(date +%Y%m%d_%H%M%S)"
    
    log "Creating environment backup..."
    mkdir -p "$backup_dir"
    
    # Backup all environment files
    for file in "$PROJECT_DIR"/.env*; do
        [[ -f "$file" ]] && cp "$file" "$backup_dir/"
    done
    
    success "Environment backup created: $backup_dir"
}

# Usage information
usage() {
    echo "Environment Configuration Manager"
    echo "Usage: $0 {command} [arguments]"
    echo ""
    echo "Commands:"
    echo "  show                    - Show current environment"
    echo "  switch <env>           - Switch to environment (development|staging|production|vps)"
    echo "  init <name>            - Initialize new environment"
    echo "  validate [file]        - Validate environment configuration"
    echo "  security [file]        - Check for security issues"
    echo "  generate-secrets       - Generate secure random secrets"
    echo "  list                   - List all available environments"
    echo "  backup                 - Backup all environment configurations"
    echo ""
    echo "Examples:"
    echo "  $0 switch production"
    echo "  $0 init testing"
    echo "  $0 validate .env.production"
    echo "  $0 security .env"
    echo ""
}

# Main script
case "${1:-}" in
    show)
        show_current
        ;;
    switch)
        if [[ -z "${2:-}" ]]; then
            error "Environment name required"
            usage
            exit 1
        fi
        switch_environment "$2"
        ;;
    init)
        if [[ -z "${2:-}" ]]; then
            error "Environment name required"
            usage
            exit 1
        fi
        init_environment "$2"
        ;;
    validate)
        validate_environment "${2:-}"
        ;;
    security)
        check_security_issues "${2:-$PROJECT_DIR/.env}"
        ;;
    generate-secrets)
        generate_secrets
        ;;
    list)
        list_environments
        ;;
    backup)
        backup_environments
        ;;
    *)
        usage
        exit 1
        ;;
esac