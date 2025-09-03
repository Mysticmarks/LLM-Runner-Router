# 🚀 Final Deployment Commands

**Status**: 🔥 Firewall configured! Now deploying Nginx + SSL for full production.

## Step 1: Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Step 2: Deploy LLM Router Nginx Configuration
```bash
# Copy our configuration files
sudo cp nginx-llm-router.conf /etc/nginx/sites-available/llm-router
sudo cp proxy_params /etc/nginx/proxy_params

# Enable the site
sudo ln -sf /etc/nginx/sites-available/llm-router /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 3: Test HTTPS Access
```bash
# Test the service
curl -k https://178.156.181.117/api/health
curl -k https://llm-api.local/api/health
```

## Step 4: Test Admin Access with New Key
```bash
# Test admin panel via HTTPS
curl -k -H "X-Admin-Key: 85dea3a443471c55a735551898159d7eb2f29fdc5fbdddd1b38eb513e7b887a6" \
  https://178.156.181.117/api/admin/stats
```

## Step 5: Create Customer API Key via HTTPS
```bash
# Create a new customer API key
curl -k -X POST https://178.156.181.117/api/admin/keys \
  -H "X-Admin-Key: 85dea3a443471c55a735551898159d7eb2f29fdc5fbdddd1b38eb513e7b887a6" \
  -H "Content-Type: application/json" \
  -d '{"name": "production-https-customer", "email": "customer@example.com", "tier": "pro"}'
```

## Step 6: Test Customer API Access
```bash
# Use the API key from step 5 to test customer access
curl -k -X POST https://178.156.181.117/api/chat \
  -H "Authorization: Bearer YOUR_NEW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello from secure HTTPS!"}]}'
```

## Optional: Get Real SSL Certificate (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate for your domain (replace with your actual domain)
sudo certbot --nginx -d yourdomain.com

# Or use IP-based certificate
sudo certbot --nginx -d 178.156.181.117
```

---

## 🎯 Expected Results

After completing these steps:

1. **HTTPS Access**: `https://178.156.181.117/api/health` should work
2. **HTTP Redirect**: `http://178.156.181.117` should redirect to HTTPS
3. **Admin Panel**: Accessible via HTTPS with new admin key
4. **Customer API**: Full SaaS functionality over encrypted HTTPS
5. **Security Headers**: All security headers active
6. **Rate Limiting**: Nginx-level protection active

## 🚨 Important Notes

- Use `-k` flag with curl for self-signed certificates
- Save any new API keys generated in step 5
- Test SSH access periodically to ensure connectivity
- Service runs on localhost:3000, Nginx proxies to HTTPS

Run these commands and let me know the results! 🚀