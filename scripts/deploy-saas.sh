#!/bin/bash

# 🚀 LLM Router SaaS Deployment Script
# Automated deployment for production VPS

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 LLM Router SaaS Deployment Starting...${NC}\n"

# Configuration
PROJECT_DIR="/home/mikecerqua/projects/LLM-Runner-Router"
SERVICE_NAME="llm-router-saas"
PORT=3000

# Check if we're in the right directory
if [ "$PWD" != "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}📂 Changing to project directory...${NC}"
    cd "$PROJECT_DIR"
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating necessary directories...${NC}"
mkdir -p logs
mkdir -p data
mkdir -p backups

# Check PM2 installation
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}🔧 Creating environment configuration...${NC}"
    cat > .env << EOF
NODE_ENV=production
PORT=${PORT}
ROUTING_STRATEGY=balanced
API_SECRET_KEY=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -hex 16)
LOG_LEVEL=info
EOF
    echo -e "${GREEN}✅ Environment file created${NC}"
fi

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build

# Stop existing PM2 process if running
echo -e "${YELLOW}🛑 Stopping existing service...${NC}"
pm2 stop $SERVICE_NAME 2>/dev/null || echo "Service not running"
pm2 delete $SERVICE_NAME 2>/dev/null || echo "Service not found"

# Start the service with PM2
echo -e "${BLUE}🚀 Starting LLM Router SaaS with PM2...${NC}"
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo -e "${BLUE}⚙️ Configuring PM2 startup...${NC}"
pm2 startup systemd -u mikecerqua --hp /home/mikecerqua

# Wait for service to be ready
echo -e "${BLUE}⏳ Waiting for service to initialize...${NC}"
sleep 10

# Health check
echo -e "${BLUE}🔍 Performing health check...${NC}"
if curl -s http://localhost:${PORT}/api/health > /dev/null; then
    echo -e "${GREEN}✅ Service is healthy and responding${NC}"
else
    echo -e "${RED}❌ Service health check failed${NC}"
    pm2 logs $SERVICE_NAME --lines 20
    exit 1
fi

# Display service status
echo -e "\n${BLUE}📊 Service Status:${NC}"
pm2 status

# Display service information
echo -e "\n${BLUE}📡 Service Information:${NC}"
echo -e "  🌐 URL: http://localhost:${PORT}"
echo -e "  📊 Health: http://localhost:${PORT}/api/health"
echo -e "  🔧 Admin: http://localhost:${PORT}/api/admin/health"
echo -e "  📁 Logs: ${PROJECT_DIR}/logs/"

# Display admin setup instructions
echo -e "\n${YELLOW}🔑 Admin Setup Required:${NC}"
echo -e "  1. Create admin API key:"
echo -e "     export ADMIN_API_KEY=\$(grep ADMIN_API_KEY .env | cut -d'=' -f2)"
echo -e "  2. Create first customer API key:"
echo -e "     curl -X POST http://localhost:${PORT}/api/admin/keys \\"
echo -e "          -H \"X-Admin-Key: \$ADMIN_API_KEY\" \\"
echo -e "          -H \"Content-Type: application/json\" \\"
echo -e "          -d '{\"name\": \"test-customer\", \"tier\": \"basic\"}'"

# Display monitoring commands
echo -e "\n${BLUE}📋 Monitoring Commands:${NC}"
echo -e "  📊 Status:     pm2 status"
echo -e "  📝 Logs:       pm2 logs $SERVICE_NAME"
echo -e "  🔄 Restart:    pm2 restart $SERVICE_NAME"
echo -e "  🛑 Stop:       pm2 stop $SERVICE_NAME"
echo -e "  💾 Save:       pm2 save"

# Final success message
echo -e "\n${GREEN}🎉 LLM Router SaaS deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Service is running at http://localhost:${PORT}${NC}"
echo -e "${GREEN}🔧 Admin panel available with proper authentication${NC}\n"