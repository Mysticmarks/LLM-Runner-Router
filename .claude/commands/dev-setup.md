# Development Environment Setup

Complete development environment setup for the LLM Router project.

```bash
#!/bin/bash
# Complete development environment setup

echo "🔧 Setting up LLM Router development environment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
mkdir -p models/cache
mkdir -p logs
mkdir -p temp

# Set up pre-commit hooks if available
if [ -f ".git/hooks" ]; then
    echo "🎣 Setting up git hooks..."
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run linting and tests before commit
npm run lint
npm run test
EOF
    chmod +x .git/hooks/pre-commit
fi

# Create local environment file if not exists
if [ ! -f ".env" ]; then
    echo "📄 Creating .env file..."
    cat > .env << 'EOF'
# LLM Router Configuration
NODE_ENV=development
LOG_LEVEL=debug
AUTO_INIT=false
MODEL_CACHE_DIR=./models/cache
MAX_MODELS=10
DEFAULT_STRATEGY=balanced
API_PORT=3000
EOF
fi

# Download a small test model for development
echo "⬇️ Setting up test model..."
mkdir -p models/test
curl -L "https://huggingface.co/microsoft/DialoGPT-small/resolve/main/config.json" \
    -o models/test/config.json 2>/dev/null || echo "Test model download skipped"

# Run initial build
echo "🏗️ Running initial build..."
npm run build

# Run tests to verify setup
echo "🧪 Running tests to verify setup..."
npm test

echo "✅ Development environment setup complete!"
echo "💡 Run 'npm run dev' to start development server"
```