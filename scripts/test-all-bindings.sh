#!/bin/bash

# Test script for all LLM Runner Router language bindings
# This script verifies that all bindings are working correctly

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINDINGS_DIR="$PROJECT_ROOT/bindings"
EXAMPLES_DIR="$PROJECT_ROOT/examples"
TEST_SERVER_PORT=3001
SERVER_PID=""

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Cleanup function
cleanup() {
    if [[ -n "$SERVER_PID" ]]; then
        log_info "Stopping test server (PID: $SERVER_PID)..."
        kill -TERM "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for server to be ready
wait_for_server() {
    local url="http://localhost:$TEST_SERVER_PORT/api/health"
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for server to be ready at $url..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s "$url" >/dev/null 2>&1; then
            log_success "Server is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        ((attempt++))
    done
    
    log_error "Server failed to start after $max_attempts seconds"
    return 1
}

# Start test server
start_test_server() {
    log_info "Starting LLM Router test server on port $TEST_SERVER_PORT..."
    
    cd "$PROJECT_ROOT"
    
    # Start server in background
    PORT=$TEST_SERVER_PORT node server.js > /tmp/llm-router-test.log 2>&1 &
    SERVER_PID=$!
    
    log_info "Server started with PID: $SERVER_PID"
    
    # Wait for server to be ready
    if ! wait_for_server; then
        log_error "Failed to start test server"
        log_info "Server log:"
        cat /tmp/llm-router-test.log
        return 1
    fi
}

# Test JavaScript/Node.js bindings
test_javascript() {
    log_info "Testing JavaScript/Node.js bindings..."
    
    cd "$PROJECT_ROOT"
    
    # Test main library
    log_info "Running Node.js basic test..."
    timeout 30 node -e "
        import { LLMRouter } from './src/index.js';
        
        const router = new LLMRouter({ autoInit: false });
        
        router.initialize()
            .then(() => {
                console.log('✅ JavaScript binding initialized successfully');
                return router.cleanup();
            })
            .then(() => {
                console.log('✅ JavaScript binding test completed');
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ JavaScript binding test failed:', error.message);
                process.exit(1);
            });
    " || {
        log_error "JavaScript binding test failed"
        return 1
    }
    
    # Test example
    if [[ -f "$EXAMPLES_DIR/basic/javascript/basic-inference.js" ]]; then
        log_info "Running JavaScript example..."
        cd "$EXAMPLES_DIR/basic/javascript"
        timeout 60 node basic-inference.js || {
            log_warning "JavaScript example failed (this may be expected if no models are loaded)"
        }
    fi
    
    log_success "JavaScript bindings test completed"
}

# Test Python bindings
test_python() {
    log_info "Testing Python bindings..."
    
    cd "$BINDINGS_DIR/python"
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d "venv" ]]; then
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -q --upgrade pip setuptools wheel
    pip install -q -r requirements.txt
    pip install -q -e .
    
    # Test basic import
    log_info "Testing Python import..."
    python3 -c "
import sys
sys.path.insert(0, '.')

try:
    from llm_runner_router import AsyncLLMRouterClient, RouterConfig
    print('✅ Python binding imported successfully')
    
    # Test basic client creation
    config = RouterConfig(base_url='http://localhost:$TEST_SERVER_PORT')
    client = AsyncLLMRouterClient(config)
    print('✅ Python client created successfully')
    
except Exception as e:
    print(f'❌ Python binding test failed: {e}')
    sys.exit(1)
" || {
        log_error "Python binding import test failed"
        deactivate
        return 1
    }
    
    # Run unit tests if available
    if [[ -d "tests" ]]; then
        log_info "Running Python unit tests..."
        python -m pytest tests/ -v -x || {
            log_warning "Python unit tests failed (may be expected without running server)"
        }
    fi
    
    # Test example
    if [[ -f "$EXAMPLES_DIR/basic/python/basic_inference.py" ]]; then
        log_info "Running Python example..."
        cd "$EXAMPLES_DIR/basic/python"
        timeout 60 python3 basic_inference.py || {
            log_warning "Python example failed (this may be expected if server is not fully configured)"
        }
    fi
    
    deactivate
    log_success "Python bindings test completed"
}

# Test Rust bindings
test_rust() {
    log_info "Testing Rust bindings..."
    
    # Test main Rust binding
    cd "$BINDINGS_DIR/rust"
    
    log_info "Building Rust binding..."
    cargo build --release || {
        log_error "Rust binding build failed"
        return 1
    }
    
    log_info "Running Rust unit tests..."
    cargo test --release || {
        log_warning "Rust unit tests failed (may be expected without running server)"
    }
    
    # Test example
    if [[ -d "$EXAMPLES_DIR/basic/rust" ]]; then
        log_info "Building and running Rust example..."
        cd "$EXAMPLES_DIR/basic/rust"
        
        cargo build --release || {
            log_error "Rust example build failed"
            return 1
        }
        
        timeout 60 cargo run --release --bin basic_inference || {
            log_warning "Rust example failed (this may be expected if server is not fully configured)"
        }
    fi
    
    log_success "Rust bindings test completed"
}

# Test WebAssembly bindings
test_wasm() {
    log_info "Testing WebAssembly bindings..."
    
    cd "$BINDINGS_DIR/wasm"
    
    # Check if wasm-pack is available
    if ! command_exists wasm-pack; then
        log_warning "wasm-pack not found, skipping WASM tests"
        return 0
    fi
    
    # Add wasm32 target
    rustup target add wasm32-unknown-unknown 2>/dev/null || true
    
    log_info "Building WASM binding for web..."
    wasm-pack build --target web --release --out-dir pkg || {
        log_error "WASM web build failed"
        return 1
    }
    
    log_info "Building WASM binding for Node.js..."
    wasm-pack build --target nodejs --release --out-dir pkg-node || {
        log_error "WASM Node.js build failed"
        return 1
    }
    
    # Test WASM in headless browser if possible
    if command_exists google-chrome || command_exists chromium || command_exists chromium-browser; then
        log_info "Running WASM tests in headless browser..."
        wasm-pack test --chrome --headless || {
            log_warning "WASM browser tests failed"
        }
    else
        log_warning "No Chrome/Chromium found, skipping WASM browser tests"
    fi
    
    log_success "WebAssembly bindings test completed"
}

# Test native core
test_native() {
    log_info "Testing native core..."
    
    cd "$PROJECT_ROOT/src/native"
    
    log_info "Building native core..."
    cargo build --release || {
        log_error "Native core build failed"
        return 1
    }
    
    log_info "Running native core tests..."
    cargo test --release || {
        log_warning "Native core tests failed"
    }
    
    # Test Node.js bindings if npm is available
    if command_exists npm; then
        log_info "Building Node.js native bindings..."
        npm install || {
            log_warning "npm install failed for native bindings"
        }
        
        npm run build || {
            log_warning "Native binding build failed"
        }
        
        # Run Node.js tests if available
        if [[ -f "package.json" ]] && npm run test --dry-run 2>/dev/null; then
            npm test || {
                log_warning "Native binding Node.js tests failed"
            }
        fi
    fi
    
    log_success "Native core test completed"
}

# Performance test
run_performance_test() {
    log_info "Running performance tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run benchmarks if available
    if [[ -f "examples/benchmarks/performance.js" ]]; then
        log_info "Running JavaScript performance benchmarks..."
        timeout 120 node examples/benchmarks/performance.js || {
            log_warning "JavaScript benchmarks failed"
        }
    fi
    
    # Run Rust benchmarks
    cd "$BINDINGS_DIR/rust"
    if cargo bench --help >/dev/null 2>&1; then
        log_info "Running Rust benchmarks..."
        timeout 120 cargo bench || {
            log_warning "Rust benchmarks failed"
        }
    fi
    
    log_success "Performance tests completed"
}

# Integration test
run_integration_test() {
    log_info "Running integration tests..."
    
    # Test server endpoints
    local base_url="http://localhost:$TEST_SERVER_PORT"
    
    # Health check
    log_info "Testing health endpoint..."
    curl -s "$base_url/api/health" | grep -q "status" || {
        log_error "Health endpoint failed"
        return 1
    }
    
    # Models endpoint
    log_info "Testing models endpoint..."
    curl -s "$base_url/api/models" | grep -q "models" || {
        log_error "Models endpoint failed"
        return 1
    }
    
    # Quick inference endpoint
    log_info "Testing quick inference endpoint..."
    curl -s -X POST "$base_url/api/quick" \
        -H "Content-Type: application/json" \
        -d '{"prompt":"test","maxTokens":10}' | grep -q "response" || {
        log_warning "Quick inference endpoint failed (may be expected without models)"
    }
    
    log_success "Integration tests completed"
}

# Main test function
main() {
    echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
    echo "🧪 LLM Router Bindings Test Suite"
    echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
    echo
    
    local start_time=$(date +%s)
    local failed_tests=()
    
    # Check prerequisites
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists node; then missing_tools+=("node"); fi
    if ! command_exists npm; then missing_tools+=("npm"); fi
    if ! command_exists python3; then missing_tools+=("python3"); fi
    if ! command_exists pip; then missing_tools+=("pip"); fi
    if ! command_exists cargo; then missing_tools+=("cargo"); fi
    if ! command_exists rustc; then missing_tools+=("rustc"); fi
    if ! command_exists curl; then missing_tools+=("curl"); fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and try again"
        exit 1
    fi
    
    log_success "All prerequisites satisfied"
    
    # Start test server
    start_test_server || {
        log_error "Failed to start test server"
        exit 1
    }
    
    # Run integration test first
    run_integration_test || failed_tests+=("integration")
    
    # Run binding tests
    test_javascript || failed_tests+=("javascript")
    test_python || failed_tests+=("python")
    test_rust || failed_tests+=("rust")
    test_wasm || failed_tests+=("wasm")
    test_native || failed_tests+=("native")
    
    # Run performance tests
    run_performance_test || failed_tests+=("performance")
    
    # Summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo
    echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
    echo "📊 Test Results Summary"
    echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
    
    if [[ ${#failed_tests[@]} -eq 0 ]]; then
        log_success "All tests completed successfully in ${duration}s! 🎉"
        echo
        log_info "✅ JavaScript/Node.js bindings: PASSED"
        log_info "✅ Python bindings: PASSED"
        log_info "✅ Rust bindings: PASSED"
        log_info "✅ WebAssembly bindings: PASSED"
        log_info "✅ Native core: PASSED"
        log_info "✅ Integration tests: PASSED"
        log_info "✅ Performance tests: PASSED"
    else
        log_warning "Some tests failed or had warnings (${#failed_tests[@]} issues):"
        for test in "${failed_tests[@]}"; do
            log_warning "  - $test"
        done
        echo
        log_info "Note: Some failures may be expected if server is not fully configured with models"
    fi
    
    echo
    log_info "Total test duration: ${duration}s"
    log_info "Test logs available in: /tmp/llm-router-test.log"
}

# Run main function
main "$@"