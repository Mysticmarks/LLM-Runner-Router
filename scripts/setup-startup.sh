#!/bin/bash

# 🚀 Setup Automatic Startup for LLM-Runner-Router with Self-Healing
# Configures PM2 to start on system boot

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/home/mikecerqua/projects/LLM-Runner-Router"

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 LLM-Router Startup Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    error "PM2 is not installed. Please install it first:"
    echo "npm install -g pm2"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Save PM2 configuration
info "Saving PM2 process list..."
pm2 save

# Generate startup script
info "Generating PM2 startup script..."
pm2 startup systemd -u $USER --hp $HOME

log "✅ PM2 startup configuration complete!"

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: To complete the setup, you need to run the command shown above with sudo${NC}"
echo -e "${YELLOW}    It will look something like:${NC}"
echo -e "${YELLOW}    sudo env PATH=\$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME${NC}"
echo ""

# Create systemd service file (optional, requires sudo)
cat << EOF > /tmp/llm-router.service
[Unit]
Description=LLM Router with Self-Healing
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$(which pm2) start ecosystem.config.cjs
ExecReload=$(which pm2) reload llm-router-http
ExecStop=$(which pm2) stop llm-router-http
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

log "Systemd service file created at /tmp/llm-router.service"
echo ""
echo "To install as a systemd service (alternative to PM2 startup), run:"
echo "  sudo cp /tmp/llm-router.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable llm-router"
echo "  sudo systemctl start llm-router"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "The LLM Router is now configured with:"
echo "  ✅ Error handling and recovery"
echo "  ✅ Self-healing capabilities"
echo "  ✅ Process monitoring"
echo "  ✅ Automatic restart on failure"
echo "  ✅ Health monitoring"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check process status"
echo "  pm2 logs                - View logs"
echo "  pm2 monit               - Real-time monitoring"
echo "  ./scripts/simple-recovery.sh status   - Check system health"
echo "  ./scripts/simple-recovery.sh monitor  - Continuous monitoring"
echo ""