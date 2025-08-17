#!/bin/bash

# LLM Router Health Monitor Script
# Monitors PM2 processes and system resources

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MAX_MEMORY_GB=14  # Alert if total memory usage exceeds 14GB (leaving 2GB for system)
MAX_CPU_PERCENT=80  # Alert if CPU usage exceeds 80%
MAX_RESTARTS=10  # Alert if restarts exceed this number
LOG_DIR="/home/mikecerqua/projects/LLM-Runner-Router/logs"
ALERT_LOG="$LOG_DIR/health-alerts.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log alerts
log_alert() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$ALERT_LOG"
    echo -e "${RED}[ALERT]${NC} $1"
}

# Function to log info
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_alert "PM2 is not installed or not in PATH"
    exit 1
fi

# Monitor system resources
echo "======================================"
echo "   LLM Router Health Monitor"
echo "======================================"
echo ""

# Check system memory
MEMORY_INFO=$(free -g | grep "^Mem:")
TOTAL_MEM=$(echo $MEMORY_INFO | awk '{print $2}')
USED_MEM=$(echo $MEMORY_INFO | awk '{print $3}')
FREE_MEM=$(echo $MEMORY_INFO | awk '{print $4}')
AVAILABLE_MEM=$(echo $MEMORY_INFO | awk '{print $7}')

log_info "System Memory: ${USED_MEM}GB used / ${TOTAL_MEM}GB total (${AVAILABLE_MEM}GB available)"

if [ "$USED_MEM" -gt "$MAX_MEMORY_GB" ]; then
    log_alert "High memory usage detected: ${USED_MEM}GB / ${TOTAL_MEM}GB"
fi

# Check CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
CPU_USAGE_INT=${CPU_USAGE%.*}

log_info "CPU Usage: ${CPU_USAGE}%"

if [ "$CPU_USAGE_INT" -gt "$MAX_CPU_PERCENT" ]; then
    log_alert "High CPU usage detected: ${CPU_USAGE}%"
fi

# Check PM2 processes
echo ""
echo "PM2 Process Status:"
echo "-------------------"

# Get PM2 process list in JSON format
PM2_JSON=$(pm2 jlist 2>/dev/null)

if [ -z "$PM2_JSON" ] || [ "$PM2_JSON" = "[]" ]; then
    log_info "No PM2 processes running"
else
    # Parse PM2 processes
    echo "$PM2_JSON" | python3 -c "
import json
import sys

data = json.load(sys.stdin)
for process in data:
    name = process.get('name', 'Unknown')
    status = process.get('pm2_env', {}).get('status', 'Unknown')
    restarts = process.get('pm2_env', {}).get('restart_time', 0)
    memory = process.get('monit', {}).get('memory', 0) / 1024 / 1024  # Convert to MB
    cpu = process.get('monit', {}).get('cpu', 0)
    
    # Color coding based on status
    if status == 'online':
        status_color = '\033[0;32m'  # Green
    elif status == 'stopped':
        status_color = '\033[0;31m'  # Red
    else:
        status_color = '\033[1;33m'  # Yellow
    
    print(f'{status_color}• {name}: {status}\033[0m')
    print(f'  Memory: {memory:.1f}MB | CPU: {cpu}% | Restarts: {restarts}')
    
    # Alert on high restarts
    if restarts > $MAX_RESTARTS:
        print(f'  \033[0;31m[ALERT] High restart count: {restarts}\033[0m')
"
fi

# Check for error logs
echo ""
echo "Recent Errors (last 10 lines):"
echo "------------------------------"

if [ -f "$LOG_DIR/pm2-error.log" ]; then
    tail -n 10 "$LOG_DIR/pm2-error.log" | while read line; do
        if [[ ! -z "$line" ]]; then
            echo "  $line"
        fi
    done
else
    log_info "No error log found"
fi

# Check port availability
echo ""
echo "Port Status:"
echo "------------"
PORT_CHECK=$(netstat -tln | grep ":3000 " 2>/dev/null)
if [ ! -z "$PORT_CHECK" ]; then
    log_info "Port 3000 is listening"
else
    log_warning "Port 3000 is not listening"
fi

# Disk usage check
echo ""
echo "Disk Usage:"
echo "-----------"
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
log_info "Root partition usage: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -gt 80 ]; then
    log_alert "High disk usage: ${DISK_USAGE}%"
fi

# Summary
echo ""
echo "======================================"
echo "Health Check Complete"
echo "Alerts logged to: $ALERT_LOG"
echo "======================================"