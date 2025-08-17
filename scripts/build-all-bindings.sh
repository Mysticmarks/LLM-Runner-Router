#!/bin/bash

# Build script for all LLM Runner Router language bindings
# Usage: ./scripts/build-all-bindings.sh [--debug|--release] [--target python|rust|wasm|native|all]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BUILD_MODE="release"
BUILD_TARGET="all"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINDINGS_DIR="$PROJECT_ROOT/bindings"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --debug)
            BUILD_MODE="debug"
            shift
            ;;
        --release)
            BUILD_MODE="release"
            shift
            ;;
        --target)
            BUILD_TARGET="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--debug|--release] [--target python|rust|wasm|native|all]"
            echo "  --debug:    Build in debug mode (default: release)"
            echo "  --release:  Build in release mode"
            echo "  --target:   Build specific target (default: all)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Building LLM Runner Router Bindings${NC}"
echo -e "   Mode: ${YELLOW}$BUILD_MODE${NC}"
echo -e "   Target: ${YELLOW}$BUILD_TARGET${NC}"
echo -e "   Project: ${YELLOW}$PROJECT_ROOT${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "python" ]]; then
        if ! command_exists python3; then
            missing_tools+=("python3")
        fi
        if ! command_exists pip; then
            missing_tools+=("pip")
        fi
    fi
    
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "rust" || "$BUILD_TARGET" == "wasm" || "$BUILD_TARGET" == "native" ]]; then
        if ! command_exists cargo; then
            missing_tools+=("cargo")
        fi
        if ! command_exists rustc; then
            missing_tools+=("rustc")
        fi
    fi
    
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "wasm" ]]; then
        if ! command_exists wasm-pack; then
            missing_tools+=("wasm-pack")
        fi
    fi
    
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "native" ]]; then
        if ! command_exists node; then
            missing_tools+=("node")
        fi
        if ! command_exists npm; then
            missing_tools+=("npm")
        fi
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        echo ""
        echo "Installation instructions:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                python3|pip)
                    echo "  - Install Python 3: https://python.org/downloads/"
                    ;;
                cargo|rustc)
                    echo "  - Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
                    ;;
                wasm-pack)
                    echo "  - Install wasm-pack: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
                    ;;
                node|npm)
                    echo "  - Install Node.js: https://nodejs.org/downloads/"
                    ;;
            esac
        done
        exit 1
    fi
    
    print_status "All prerequisites satisfied"
}

# Build Python bindings
build_python() {
    print_info "Building Python bindings..."
    cd "$BINDINGS_DIR/python"
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d "venv" ]]; then
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip and install build tools
    pip install --upgrade pip setuptools wheel build
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Build the package
    if [[ "$BUILD_MODE" == "debug" ]]; then
        python -m build --wheel
    else
        python -m build --wheel
    fi
    
    # Install in development mode for testing
    pip install -e .
    
    # Run tests
    if [[ -f "pytest.ini" || -d "tests" ]]; then
        pip install pytest pytest-asyncio pytest-cov
        python -m pytest tests/ -v
    fi
    
    deactivate
    cd "$PROJECT_ROOT"
    print_status "Python bindings built successfully"
}

# Build Rust bindings
build_rust() {
    print_info "Building Rust bindings..."
    cd "$BINDINGS_DIR/rust"
    
    # Build flags
    local build_flags=()
    if [[ "$BUILD_MODE" == "release" ]]; then
        build_flags+=("--release")
    fi
    
    # Build the crate
    cargo build "${build_flags[@]}"
    
    # Run tests
    cargo test "${build_flags[@]}"
    
    # Run clippy for linting
    cargo clippy -- -D warnings
    
    # Check formatting
    cargo fmt -- --check
    
    # Generate documentation
    cargo doc --no-deps
    
    cd "$PROJECT_ROOT"
    print_status "Rust bindings built successfully"
}

# Build WebAssembly bindings
build_wasm() {
    print_info "Building WebAssembly bindings..."
    cd "$BINDINGS_DIR/wasm"
    
    # Add wasm32 target if not installed
    rustup target add wasm32-unknown-unknown
    
    # Build flags
    local build_flags=()
    if [[ "$BUILD_MODE" == "debug" ]]; then
        build_flags+=("--dev")
    else
        build_flags+=("--release")
    fi
    
    # Build for web target
    wasm-pack build --target web --out-dir pkg "${build_flags[@]}"
    
    # Build for Node.js target
    wasm-pack build --target nodejs --out-dir pkg-node "${build_flags[@]}"
    
    # Build for bundler target
    wasm-pack build --target bundler --out-dir pkg-bundler "${build_flags[@]}"
    
    # Run WASM-specific tests
    if command_exists wasm-pack; then
        wasm-pack test --chrome --headless
    fi
    
    cd "$PROJECT_ROOT"
    print_status "WebAssembly bindings built successfully"
}

# Build native core
build_native() {
    print_info "Building native core..."
    cd "$PROJECT_ROOT/src/native"
    
    # Build flags
    local build_flags=()
    if [[ "$BUILD_MODE" == "release" ]]; then
        build_flags+=("--release")
    fi
    
    # Build the native module
    cargo build "${build_flags[@]}"
    
    # Build Node.js bindings
    npm install
    npm run build
    
    # Run tests
    cargo test "${build_flags[@]}"
    npm test
    
    cd "$PROJECT_ROOT"
    print_status "Native core built successfully"
}

# Package all bindings
package_bindings() {
    print_info "Packaging bindings..."
    
    local dist_dir="$PROJECT_ROOT/dist"
    mkdir -p "$dist_dir"
    
    # Package Python bindings
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "python" ]]; then
        if [[ -d "$BINDINGS_DIR/python/dist" ]]; then
            cp -r "$BINDINGS_DIR/python/dist"/* "$dist_dir/"
        fi
    fi
    
    # Package Rust bindings (create tarball)
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "rust" ]]; then
        cd "$BINDINGS_DIR/rust"
        cargo package --no-verify
        if [[ -d "target/package" ]]; then
            cp target/package/*.crate "$dist_dir/" 2>/dev/null || true
        fi
        cd "$PROJECT_ROOT"
    fi
    
    # Package WASM bindings
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "wasm" ]]; then
        if [[ -d "$BINDINGS_DIR/wasm/pkg" ]]; then
            tar -czf "$dist_dir/llm-runner-router-wasm-web.tar.gz" -C "$BINDINGS_DIR/wasm" pkg
        fi
        if [[ -d "$BINDINGS_DIR/wasm/pkg-node" ]]; then
            tar -czf "$dist_dir/llm-runner-router-wasm-node.tar.gz" -C "$BINDINGS_DIR/wasm" pkg-node
        fi
    fi
    
    # Package native bindings
    if [[ "$BUILD_TARGET" == "all" || "$BUILD_TARGET" == "native" ]]; then
        if [[ -d "$PROJECT_ROOT/src/native/target" ]]; then
            tar -czf "$dist_dir/llm-runner-router-native.tar.gz" -C "$PROJECT_ROOT/src/native" target
        fi
    fi
    
    print_status "Bindings packaged in $dist_dir"
}

# Main build function
main() {
    check_prerequisites
    
    local start_time=$(date +%s)
    
    case "$BUILD_TARGET" in
        python)
            build_python
            ;;
        rust)
            build_rust
            ;;
        wasm)
            build_wasm
            ;;
        native)
            build_native
            ;;
        all)
            build_python
            build_rust
            build_wasm
            build_native
            ;;
        *)
            print_error "Unknown build target: $BUILD_TARGET"
            exit 1
            ;;
    esac
    
    package_bindings
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    print_status "Build completed successfully in ${duration}s"
    echo ""
    print_info "Available packages in dist/:"
    if [[ -d "$PROJECT_ROOT/dist" ]]; then
        ls -la "$PROJECT_ROOT/dist"
    fi
}

# Run main function
main "$@"