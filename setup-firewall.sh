#!/bin/bash
# UFW Firewall Setup for LLM Router SaaS
# Run with: sudo bash setup-firewall.sh

echo "🔥 Configuring UFW Firewall..."

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# SSH access (adjust port if needed)
ufw allow 22/tcp comment 'SSH access'

# HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP (redirect to HTTPS)'
ufw allow 443/tcp comment 'HTTPS (LLM Router SaaS)'

# Optional: Allow specific admin IPs only
# ufw allow from YOUR_ADMIN_IP to any port 443

# Enable firewall
ufw --force enable

# Show status
ufw status numbered

echo "✅ Firewall configured successfully"
echo "⚠️ Important: Test SSH access before disconnecting!"
