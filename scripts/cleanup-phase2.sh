#!/bin/bash
# 📁 Phase 2: Repository Organization
# Organizes files into logical directory structure

set -e  # Exit on any error

echo "📁 LLM Runner Router - Phase 2 Organization"
echo "============================================"
echo ""

# Function to safely create directories
create_dir() {
    if [ ! -d "$1" ]; then
        echo "📁 Creating directory: $1"
        mkdir -p "$1"
    else
        echo "✅ Directory exists: $1"
    fi
}

# Function to safely move files
move_files() {
    local pattern="$1"
    local destination="$2"
    local description="$3"
    
    # Count files matching pattern
    local count=$(ls $pattern 2>/dev/null | wc -l)
    
    if [ $count -gt 0 ]; then
        echo "📦 Moving $count $description to $destination"
        mv $pattern "$destination/" 2>/dev/null || echo "⚠️  Some files may have already been moved"
    else
        echo "⏭️  No $description found to move"
    fi
}

echo "🏗️  Creating organization directories..."

# Create directory structure
create_dir "tests/development"
create_dir "scripts/development"
create_dir "scripts/deployment"
create_dir "scripts/maintenance"
create_dir "docs/reports"

echo ""
echo "📦 Organizing development test files..."

# Move test files from root to tests/development
move_files "test-*.js" "tests/development" "JavaScript test files"
move_files "test-*.mjs" "tests/development" "ES module test files"
move_files "test-*.sh" "tests/development" "shell test scripts"

echo ""
echo "🔧 Organizing scripts by purpose..."

# Development scripts
move_files "benchmark-summary.js" "scripts/development" "benchmark scripts"
move_files "check-rate-limiter.js" "scripts/development" "rate limiter scripts"
move_files "init-loaders.js" "scripts/development" "loader initialization scripts"

# Deployment scripts (check if they exist)
if [ -f "deploy.sh" ]; then
    echo "📦 Moving deploy.sh to scripts/deployment"
    mv deploy.sh scripts/deployment/
fi

if [ -f "configure-firewall.sh" ]; then
    echo "📦 Moving configure-firewall.sh to scripts/deployment"
    mv configure-firewall.sh scripts/deployment/
fi

if [ -f "setup-hetzner-firewall.sh" ]; then
    echo "📦 Moving setup-hetzner-firewall.sh to scripts/deployment"
    mv setup-hetzner-firewall.sh scripts/deployment/
fi

# Maintenance scripts
move_files "clean-exports.sh" "scripts/maintenance" "export cleanup scripts"
move_files "fix-*.sh" "scripts/maintenance" "fix scripts"

echo ""
echo "📄 Organizing documentation reports..."

# Move reports to docs/reports
move_files "*-REPORT.md" "docs/reports" "report documents"
move_files "*-STATUS.md" "docs/reports" "status documents"

if [ -f "IMPLEMENTATION_SUMMARY.md" ]; then
    echo "📦 Moving IMPLEMENTATION_SUMMARY.md to docs/reports"
    mv IMPLEMENTATION_SUMMARY.md docs/reports/
fi

if [ -f "COMPLETION-REPORT.md" ]; then
    echo "📦 Moving COMPLETION-REPORT.md to docs/reports"
    mv COMPLETION-REPORT.md docs/reports/
fi

echo ""
echo "📊 Final directory structure:"
echo "├── scripts/"
echo "│   ├── development/     $(ls scripts/development/ 2>/dev/null | wc -l) files"
echo "│   ├── deployment/      $(ls scripts/deployment/ 2>/dev/null | wc -l) files"
echo "│   └── maintenance/     $(ls scripts/maintenance/ 2>/dev/null | wc -l) files"
echo "├── tests/"
echo "│   └── development/     $(ls tests/development/ 2>/dev/null | wc -l) files"
echo "└── docs/"
echo "    └── reports/         $(ls docs/reports/ 2>/dev/null | wc -l) files"

echo ""
echo "✅ Phase 2 Organization Complete!"
echo ""
echo "🎯 Summary:"
echo "• Organized test files into tests/development/"
echo "• Categorized scripts by purpose"
echo "• Moved reports to docs/reports/"
echo "• Created logical directory structure"
echo ""
echo "📋 Next Steps:"
echo "1. Run 'npm run build' to verify build still works"
echo "2. Check documentation site: npm run docs:serve"
echo "3. Verify all internal links work"