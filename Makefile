# LLM Runner Router - Build Automation Makefile

.PHONY: help install build test clean docs package dev-setup prerequisites

# Default target
help: ## Show this help message
	@echo "LLM Runner Router - Build Automation"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Prerequisites and setup
prerequisites: ## Check and install prerequisites
	@echo "Checking prerequisites..."
	@command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Visit https://nodejs.org"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }
	@command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Visit https://python.org"; exit 1; }
	@command -v cargo >/dev/null 2>&1 || { echo "Rust/Cargo is required. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"; exit 1; }
	@command -v wasm-pack >/dev/null 2>&1 || { echo "wasm-pack is required. Install via: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"; exit 1; }
	@echo "✅ All prerequisites satisfied"

dev-setup: prerequisites ## Set up development environment
	@echo "Setting up development environment..."
	npm install
	rustup target add wasm32-unknown-unknown
	./scripts/build-all-bindings.sh --debug --target all
	@echo "✅ Development environment ready"

# Installation targets
install: ## Install main dependencies
	npm install

install-python: ## Install Python bindings
	cd bindings/python && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && pip install -e .

install-rust: ## Install Rust bindings
	cd bindings/rust && cargo build --release

install-wasm: ## Install WASM bindings
	cd bindings/wasm && wasm-pack build --target web --out-dir pkg

install-native: ## Install native core
	cd src/native && npm install && npm run build

install-all: install install-python install-rust install-wasm install-native ## Install all bindings

# Build targets
build: ## Build main project
	npm run build

build-python: ## Build Python bindings
	./scripts/build-all-bindings.sh --target python --release

build-rust: ## Build Rust bindings
	./scripts/build-all-bindings.sh --target rust --release

build-wasm: ## Build WASM bindings
	./scripts/build-all-bindings.sh --target wasm --release

build-native: ## Build native core
	./scripts/build-all-bindings.sh --target native --release

build-bindings: ## Build all language bindings
	./scripts/build-all-bindings.sh --release

build-bindings-debug: ## Build all language bindings in debug mode
	./scripts/build-all-bindings.sh --debug

build-all: build build-bindings ## Build everything

# Test targets
test: ## Run main project tests
	npm test

test-python: ## Run Python binding tests
	cd bindings/python && source venv/bin/activate && python -m pytest tests/ -v

test-rust: ## Run Rust binding tests
	cd bindings/rust && cargo test

test-wasm: ## Run WASM binding tests
	cd bindings/wasm && wasm-pack test --chrome --headless

test-native: ## Run native core tests
	cd src/native && cargo test && npm test

test-bindings: test-python test-rust test-wasm test-native ## Run all binding tests

test-all: test test-bindings ## Run all tests

# Lint and format targets
lint: ## Lint JavaScript code
	npm run lint

lint-rust: ## Lint Rust code
	cd bindings/rust && cargo clippy -- -D warnings
	cd bindings/wasm && cargo clippy -- -D warnings
	cd src/native && cargo clippy -- -D warnings

format: ## Format JavaScript code
	npm run format

format-rust: ## Format Rust code
	cd bindings/rust && cargo fmt
	cd bindings/wasm && cargo fmt
	cd src/native && cargo fmt

format-python: ## Format Python code
	cd bindings/python && source venv/bin/activate && black . && isort .

format-all: format format-rust format-python ## Format all code

# Documentation targets
docs: ## Generate main documentation
	npm run docs

docs-rust: ## Generate Rust documentation
	cd bindings/rust && cargo doc --no-deps --open
	cd bindings/wasm && cargo doc --no-deps
	cd src/native && cargo doc --no-deps

docs-python: ## Generate Python documentation
	cd bindings/python && source venv/bin/activate && sphinx-build -b html docs docs/_build

docs-all: docs docs-rust docs-python ## Generate all documentation

# Package targets
package: ## Package main project
	npm pack

package-python: ## Package Python bindings
	cd bindings/python && source venv/bin/activate && python -m build

package-rust: ## Package Rust bindings
	cd bindings/rust && cargo package --no-verify

package-wasm: ## Package WASM bindings
	cd bindings/wasm && wasm-pack pack pkg

package-native: ## Package native core
	cd src/native && npm pack

package-all: package package-python package-rust package-wasm package-native ## Package everything

# Clean targets
clean: ## Clean main project
	rm -rf node_modules dist *.tgz

clean-python: ## Clean Python bindings
	cd bindings/python && rm -rf venv build dist *.egg-info __pycache__ .pytest_cache

clean-rust: ## Clean Rust bindings
	cd bindings/rust && cargo clean
	cd bindings/wasm && cargo clean
	cd src/native && cargo clean

clean-all: clean clean-python clean-rust ## Clean everything
	rm -rf dist/

# Development targets
dev: ## Start development server
	npm run dev

server: ## Start production server
	npm start

benchmark: ## Run performance benchmarks
	npm run benchmark

# Publishing targets
publish-check: ## Check if ready to publish
	npm run prepublishOnly

publish-python: ## Publish Python bindings to PyPI
	cd bindings/python && source venv/bin/activate && python -m twine upload dist/*

publish-rust: ## Publish Rust bindings to crates.io
	cd bindings/rust && cargo publish

publish-wasm: ## Publish WASM bindings to npm
	cd bindings/wasm && wasm-pack publish

publish-native: ## Publish native bindings to npm
	cd src/native && npm publish

# CI/CD targets
ci-test: ## Run CI test suite
	make prerequisites
	make install-all
	make test-all
	make lint
	make format-all

ci-build: ## Run CI build
	make prerequisites
	make build-all
	make package-all

# Docker targets (if needed)
docker-build: ## Build Docker image
	docker build -t llm-runner-router .

docker-run: ## Run Docker container
	docker run -p 3000:3000 llm-runner-router

# Maintenance targets
update-deps: ## Update all dependencies
	npm update
	cd bindings/python && source venv/bin/activate && pip install --upgrade -r requirements.txt
	cd bindings/rust && cargo update
	cd bindings/wasm && cargo update
	cd src/native && cargo update && npm update

security-audit: ## Run security audit
	npm audit
	cd bindings/rust && cargo audit
	cd bindings/wasm && cargo audit
	cd src/native && cargo audit