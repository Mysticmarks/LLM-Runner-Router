#!/bin/bash
# 🧹 Phase 1: Safe Repository Cleanup
# Removes temporary files, logs, and development artifacts safely

set -e  # Exit on any error

echo "🧹 LLM Runner Router - Phase 1 Cleanup"
echo "======================================="
echo ""

# Function to safely remove files/directories
safe_remove() {
    if [ -e "$1" ]; then
        echo "🗑️  Removing: $1"
        rm -rf "$1"
    else
        echo "⏭️  Skipping: $1 (not found)"
    fi
}

# Function to get directory size
get_size() {
    if [ -e "$1" ]; then
        du -sh "$1" 2>/dev/null | cut -f1
    else
        echo "0B"
    fi
}

echo "📊 Analyzing current repository size..."
REPO_SIZE_BEFORE=$(du -sh . 2>/dev/null | cut -f1)
echo "Repository size before cleanup: $REPO_SIZE_BEFORE"
echo ""

echo "🧹 Phase 1: Removing temporary files and logs..."

# Remove log files
echo "📝 Cleaning log files..."
safe_remove "server.log"
safe_remove "logs/"

# Remove temporary directories
echo "📂 Cleaning temporary directories..."
TEMP_SIZE=$(get_size "temp/bitnet-repo/")
echo "BitNet repo size: $TEMP_SIZE"
safe_remove "temp/bitnet-repo/"
safe_remove "cache/"
safe_remove "uploads/"

# Remove development artifacts
echo "🔧 Cleaning development artifacts..."
safe_remove "eslint-review-required.md"
safe_remove "ESLINT-STRATEGY.md"

# Remove any .tmp files
echo "🗃️  Cleaning temporary files..."
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.log" -not -path "./node_modules/*" -delete 2>/dev/null || true

echo ""
echo "📊 Analyzing repository size after cleanup..."
REPO_SIZE_AFTER=$(du -sh . 2>/dev/null | cut -f1)
echo "Repository size after cleanup: $REPO_SIZE_AFTER"
echo ""

echo "✅ Phase 1 Cleanup Complete!"
echo ""
echo "🎯 Summary:"
echo "• Removed log files and temporary directories"
echo "• Cleaned development artifacts"
echo "• Repository size: $REPO_SIZE_BEFORE → $REPO_SIZE_AFTER"
echo ""
echo "📋 Next Steps:"
echo "1. Run 'npm run build' to verify build still works"
echo "2. Run 'npm test' to verify tests still pass"
echo "3. Run scripts/cleanup-phase2.sh for organization"