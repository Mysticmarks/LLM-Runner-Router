#!/bin/bash

# 🔥 Hetzner Cloud Firewall Setup for LLM-Runner-Router
# This script installs hcloud CLI and configures cloud firewall

echo "🔥 Hetzner Cloud Firewall Configuration"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# Check if hcloud is installed
if ! command -v hcloud &> /dev/null; then
    echo "📦 Installing Hetzner Cloud CLI..."
    
    # Download and install hcloud
    HCLOUD_VERSION=$(curl -s https://api.github.com/repos/hetznercloud/cli/releases/latest | grep tag_name | cut -d '"' -f 4)
    
    if [ -z "$HCLOUD_VERSION" ]; then
        HCLOUD_VERSION="v1.42.0"  # Fallback version
    fi
    
    curl -sL "https://github.com/hetznercloud/cli/releases/download/${HCLOUD_VERSION}/hcloud-linux-amd64.tar.gz" -o /tmp/hcloud.tar.gz
    tar -xzf /tmp/hcloud.tar.gz -C /tmp/
    
    # Check if we have sudo access
    if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
        sudo mv /tmp/hcloud /usr/local/bin/
        print_status "hcloud CLI installed to /usr/local/bin/"
    else
        mkdir -p ~/.local/bin
        mv /tmp/hcloud ~/.local/bin/
        export PATH="$HOME/.local/bin:$PATH"
        print_status "hcloud CLI installed to ~/.local/bin/"
        print_warning "Add ~/.local/bin to your PATH if not already added"
    fi
    
    rm -f /tmp/hcloud.tar.gz
else
    print_status "hcloud CLI already installed"
fi

echo ""
echo "🔑 Hetzner Cloud API Token Required"
echo "===================================="
echo ""
echo "To configure the cloud firewall, you need a Hetzner Cloud API token."
echo ""
echo "📝 How to get your API token:"
echo "   1. Go to https://console.hetzner.cloud/"
echo "   2. Select your project"
echo "   3. Go to 'Security' → 'API Tokens'"
echo "   4. Click 'Generate API Token'"
echo "   5. Give it a name (e.g., 'LLM-Router-Firewall')"
echo "   6. Select 'Read & Write' permissions"
echo "   7. Copy the token (you won't see it again!)"
echo ""

read -p "Enter your Hetzner Cloud API token: " API_TOKEN

if [ -z "$API_TOKEN" ]; then
    print_error "No API token provided. Exiting."
    exit 1
fi

# Configure hcloud context
echo ""
echo "🔧 Configuring hcloud..."
hcloud context create llm-router 2>/dev/null || true
export HCLOUD_TOKEN="$API_TOKEN"

# Test API token
if ! hcloud server list &>/dev/null; then
    print_error "Invalid API token or no access to servers"
    exit 1
fi

print_status "API token validated"

# Get server information
echo ""
echo "🖥️ Finding your server..."
SERVER_ID=$(hcloud server list -o json | jq -r '.[] | select(.public_net.ipv4.ip == "178.156.181.117") | .id')

if [ -z "$SERVER_ID" ]; then
    print_error "Could not find server with IP 178.156.181.117"
    echo "Available servers:"
    hcloud server list
    exit 1
fi

SERVER_NAME=$(hcloud server describe $SERVER_ID -o json | jq -r '.name')
print_status "Found server: $SERVER_NAME (ID: $SERVER_ID)"

# Check existing firewalls
echo ""
echo "🔍 Checking existing firewalls..."
EXISTING_FIREWALL=$(hcloud firewall list -o json | jq -r '.[] | select(.name == "llm-router-firewall") | .id')

if [ -n "$EXISTING_FIREWALL" ]; then
    print_warning "Firewall 'llm-router-firewall' already exists (ID: $EXISTING_FIREWALL)"
    read -p "Do you want to update it? (y/n): " UPDATE_FW
    
    if [ "$UPDATE_FW" != "y" ]; then
        echo "Exiting without changes."
        exit 0
    fi
    
    FIREWALL_ID=$EXISTING_FIREWALL
else
    echo "📝 Creating new firewall..."
    FIREWALL_ID=$(hcloud firewall create --name llm-router-firewall -o json | jq -r '.id')
    print_status "Created firewall with ID: $FIREWALL_ID"
fi

# Add firewall rules
echo ""
echo "🛡️ Configuring firewall rules..."

# Clear existing rules (if updating)
if [ -n "$EXISTING_FIREWALL" ]; then
    echo "Clearing existing rules..."
    hcloud firewall delete-rule $FIREWALL_ID --direction in --source-ips 0.0.0.0/0 --protocol tcp --port 3000 2>/dev/null || true
    hcloud firewall delete-rule $FIREWALL_ID --direction in --source-ips 0.0.0.0/0 --protocol tcp --port 3001 2>/dev/null || true
fi

# Add new rules
echo "Adding rule: Allow TCP 3000 (API)..."
hcloud firewall add-rule $FIREWALL_ID \
    --direction in \
    --source-ips 0.0.0.0/0 \
    --protocol tcp \
    --port 3000 \
    --description "LLM Router API"

print_status "Added rule for port 3000"

echo "Adding rule: Allow TCP 3001 (Chat UI)..."
hcloud firewall add-rule $FIREWALL_ID \
    --direction in \
    --source-ips 0.0.0.0/0 \
    --protocol tcp \
    --port 3001 \
    --description "LLM Router Chat Interface"

print_status "Added rule for port 3001"

# SSH rule (always needed)
echo "Adding rule: Allow TCP 22 (SSH)..."
hcloud firewall add-rule $FIREWALL_ID \
    --direction in \
    --source-ips 0.0.0.0/0 \
    --protocol tcp \
    --port 22 \
    --description "SSH Access" 2>/dev/null || true

print_status "SSH access ensured"

# Apply firewall to server
echo ""
echo "🔗 Applying firewall to server..."
hcloud firewall apply-to-resource $FIREWALL_ID \
    --type server \
    --server $SERVER_NAME

print_status "Firewall applied to server $SERVER_NAME"

# Show final status
echo ""
echo "📊 Firewall Status:"
echo "==================="
hcloud firewall describe $FIREWALL_ID

echo ""
echo "✨ Configuration Complete!"
echo "=========================="
echo ""
echo "Your LLM Router services should now be accessible at:"
echo ""
echo "  🔗 API Health Check:"
echo "     http://178.156.181.117:3000/api/health"
echo ""
echo "  💬 Chat Interfaces:"
echo "     http://178.156.181.117:3001/standalone.html"
echo "     http://178.156.181.117:3001/chat-test.html"
echo "     http://178.156.181.117:3001/chat/simple.html"
echo ""
echo "  📱 Main Chat App:"
echo "     http://178.156.181.117:3001/chat/"
echo ""

# Test connectivity
echo "🔍 Testing external connectivity..."
echo ""

test_url() {
    local url=$1
    local name=$2
    echo -n "  Testing $name: "
    
    if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" | grep -q "200\|304"; then
        print_status "Accessible ✨"
    else
        print_error "Not accessible (might take a moment for rules to apply)"
    fi
}

test_url "http://178.156.181.117:3000/api/health" "API endpoint"
test_url "http://178.156.181.117:3001/standalone.html" "Chat interface"

echo ""
echo "📝 Notes:"
echo "  • Firewall rules may take 30-60 seconds to fully apply"
echo "  • If services are not accessible, ensure they are running:"
echo "    - API: npm start (in project directory)"
echo "    - Chat: python3 -m http.server 3001 --bind 0.0.0.0 --directory public"
echo ""
echo "🎉 Setup complete! Your chat application should be publicly accessible!"