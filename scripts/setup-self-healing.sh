#!/bin/bash

# 🏥 Setup Self-Healing System
# Configures automatic monitoring and recovery

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/home/mikecerqua/projects/LLM-Runner-Router"

echo -e "${BLUE}🏥 Setting up Self-Healing System${NC}"
echo "=================================="

# 1. Create necessary directories
echo -e "${GREEN}Creating directories...${NC}"
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/scripts"

# 2. Setup cron job for monitoring
echo -e "${GREEN}Setting up monitoring cron job...${NC}"

# Add monitoring cron job (every 5 minutes)
CRON_CMD="*/5 * * * * $PROJECT_DIR/scripts/recovery.sh check >> $PROJECT_DIR/logs/recovery.log 2>&1"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "recovery.sh check"; then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✅ Monitoring cron job added"
else
    echo "⚠️  Monitoring cron job already exists"
fi

# 3. Setup PM2 startup script
echo -e "${GREEN}Configuring PM2 startup...${NC}"

# Generate PM2 startup script
pm2 startup systemd -u $USER --hp $HOME || true

# Save current PM2 processes
pm2 save

# 4. Install monitoring dependencies
echo -e "${GREEN}Installing monitoring tools...${NC}"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Installing jq..."
    sudo apt-get update && sudo apt-get install -y jq
fi

# Check if bc is installed
if ! command -v bc &> /dev/null; then
    echo "Installing bc..."
    sudo apt-get install -y bc
fi

# 5. Start the resilient server
echo -e "${GREEN}Starting resilient server...${NC}"

cd "$PROJECT_DIR"

# Stop existing servers
pm2 delete llm-router-http 2>/dev/null || true
pm2 delete llm-router-resilient 2>/dev/null || true

# Start resilient server
pm2 start ecosystem.resilient.config.js

# 6. Setup log rotation
echo -e "${GREEN}Setting up log rotation...${NC}"

# Create logrotate configuration
LOGROTATE_CONF="/etc/logrotate.d/llm-router"
LOGROTATE_CONTENT="$PROJECT_DIR/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}"

# Write logrotate config (requires sudo)
echo "$LOGROTATE_CONTENT" | sudo tee "$LOGROTATE_CONF" > /dev/null
echo "✅ Log rotation configured"

# 7. Test the system
echo -e "${YELLOW}Testing self-healing system...${NC}"

# Run health check
$PROJECT_DIR/scripts/recovery.sh check

# Check PM2 status
pm2 status

echo ""
echo -e "${BLUE}=================================="
echo -e "🎉 Self-Healing System Setup Complete!"
echo -e "==================================${NC}"
echo ""
echo "Available commands:"
echo "  📊 Check health:     $PROJECT_DIR/scripts/recovery.sh check"
echo "  🔧 Run recovery:     $PROJECT_DIR/scripts/recovery.sh recover"
echo "  🔄 Restart service:  $PROJECT_DIR/scripts/recovery.sh restart"
echo "  🧹 Clean cache:      $PROJECT_DIR/scripts/recovery.sh clean"
echo "  📡 Monitor mode:     $PROJECT_DIR/scripts/recovery.sh monitor"
echo ""
echo "Monitoring:"
echo "  - Automatic health checks every 5 minutes via cron"
echo "  - PM2 auto-restart on crash"
echo "  - Self-healing monitor running in server"
echo "  - Logs rotating daily (7 day retention)"
echo ""
echo "View logs:"
echo "  pm2 logs llm-router-resilient"
echo "  tail -f $PROJECT_DIR/logs/recovery.log"
echo ""
echo "Access points:"
echo "  🌐 Health:       http://178.156.181.117:3006/health"
echo "  📊 Diagnostics:  http://178.156.181.117:3006/api/diagnostics"
echo "  🔧 Manual heal:  http://178.156.181.117:3006/api/heal"
echo ""