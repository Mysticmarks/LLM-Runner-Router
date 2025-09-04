# 🔥 HETZNER FIREWALL CONFIGURATION REQUIRED

## ⚠️ THE PROBLEM
Your services ARE running correctly but are **BLOCKED BY HETZNER'S CLOUD FIREWALL**.

- **Server**: Hetzner Cloud (178.156.181.117)
- **Services Running**: ✅ Both ports 3006 and 3001 are listening
- **Issue**: 🚫 Hetzner firewall is blocking external access

## 🛠️ SOLUTION: Configure Hetzner Cloud Firewall

### Option 1: Automated Script (NEW - Recommended)
We've created automated scripts to configure the firewall:

#### For Hetzner Cloud Firewall (Recommended):
```bash
cd /home/mikecerqua/projects/LLM-Runner-Router/
./setup-hetzner-firewall.sh
```
This script will:
- Install hcloud CLI if needed
- Guide you through API token setup
- Automatically configure all necessary firewall rules
- Test connectivity after setup

#### For Local UFW Firewall (if you have sudo):
```bash
cd /home/mikecerqua/projects/LLM-Runner-Router/
sudo ./configure-firewall.sh
```

### Option 2: Hetzner Cloud Console (Manual)
1. **Login to Hetzner Cloud Console**
   - Go to: https://console.hetzner.cloud/
   - Login with your credentials

2. **Navigate to Your Server**
   - Click on your project
   - Select your server (178.156.181.117)

3. **Go to Firewalls/Security Groups**
   - Click on "Firewalls" in the left menu
   - OR look for "Security" or "Firewall" tab on your server

4. **Add Inbound Rules**
   ```
   Rule 1:
   - Direction: Inbound
   - Protocol: TCP
   - Port: 3006
   - Source: 0.0.0.0/0 (or specific IPs if you want to restrict)
   - Description: LLM Router API
   
   Rule 2:
   - Direction: Inbound
   - Protocol: TCP  
   - Port: 3001
   - Source: 0.0.0.0/0 (or specific IPs if you want to restrict)
   - Description: LLM Router Chat UI
   ```

5. **Apply the Firewall Rules**
   - Click "Add Rule" or "Apply"
   - Changes should take effect immediately

### Option 2: Hetzner CLI (if you have hcloud installed)
```bash
# Install hcloud CLI if not already installed
curl -sL https://github.com/hetznercloud/cli/releases/latest/download/hcloud-linux-amd64.tar.gz | tar xz
sudo mv hcloud /usr/local/bin/

# Configure with your API token
hcloud context create my-project

# Create firewall rules
hcloud firewall create llm-router-firewall
hcloud firewall add-rule llm-router-firewall --direction in --source-ips 0.0.0.0/0 --protocol tcp --port 3006
hcloud firewall add-rule llm-router-firewall --direction in --source-ips 0.0.0.0/0 --protocol tcp --port 3001

# Apply firewall to your server
hcloud firewall apply-to-resource llm-router-firewall --type server --server YOUR_SERVER_NAME
```

### Option 3: Local UFW Configuration (if you have sudo)
If you have sudo access, you can also configure the local firewall:

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important - do this first!)
sudo ufw allow 22/tcp

# Allow the LLM Router ports
sudo ufw allow 3006/tcp
sudo ufw allow 3001/tcp

# Check status
sudo ufw status verbose

# Reload firewall
sudo ufw reload
```

## 🔍 VERIFICATION STEPS

After configuring the firewall:

1. **Test from external network** (not from the server itself):
   ```bash
   curl http://178.156.181.117:3006/api/health
   curl http://178.156.181.117:3001/
   ```

2. **Access in browser**:
   - API Health: http://178.156.181.117:3006/api/health
   - Chat Interface: http://178.156.181.117:3001/standalone.html

## 📋 CURRENT STATUS

✅ **What's Working:**
- Node.js API server running on port 3006
- Python web server running on port 3001
- Both services listening on 0.0.0.0 (all interfaces)
- Server can access its own services locally

❌ **What's Blocked:**
- External access to port 3006
- External access to port 3001
- All traffic blocked by Hetzner cloud firewall

## 🚨 IMPORTANT NOTES

1. **Default Hetzner Behavior**: Hetzner blocks all ports except 22 (SSH) by default
2. **No Local Firewall Issue**: The problem is at the cloud provider level
3. **Immediate Effect**: Once you add the rules in Hetzner console, access should work immediately
4. **Security**: Consider restricting source IPs if this is not meant to be fully public

## 📞 HETZNER SUPPORT

If you need help:
- **Hetzner Cloud Docs**: https://docs.hetzner.com/cloud/firewalls/
- **Support**: Available through your Hetzner Cloud console
- **Community**: https://community.hetzner.com/

## ✅ AFTER FIREWALL IS CONFIGURED

Your chat application will be accessible at:
- **Standalone Chat**: http://178.156.181.117:3001/standalone.html
- **Simple Chat**: http://178.156.181.117:3001/chat/simple.html
- **API Endpoint**: http://178.156.181.117:3006/api/health

The firewall is the ONLY thing preventing access. Once configured, everything will work!