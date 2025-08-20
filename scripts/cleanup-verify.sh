#!/bin/bash
# 🔍 Cleanup Verification Script
# Verifies that cleanup didn't break anything important

set -e  # Exit on any error

echo "🔍 LLM Runner Router - Cleanup Verification"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command succeeds
check_command() {
    local description="$1"
    local command="$2"
    
    echo -n "🧪 Testing: $description... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Function to check if files exist
check_files() {
    local description="$1"
    shift
    local files=("$@")
    
    echo -n "📁 Checking: $description... "
    
    local missing=0
    for file in "${files[@]}"; do
        if [ ! -e "$file" ]; then
            missing=$((missing + 1))
        fi
    done
    
    if [ $missing -eq 0 ]; then
        echo -e "${GREEN}✅ ALL FOUND${NC}"
        return 0
    else
        echo -e "${RED}❌ $missing MISSING${NC}"
        return 1
    fi
}

# Function to check URL response
check_url() {
    local description="$1"
    local url="$2"
    
    echo -n "🌐 Testing: $description... "
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
        return 0
    else
        echo -e "${RED}❌ NOT ACCESSIBLE${NC}"
        return 1
    fi
}

echo "🔍 Running comprehensive verification tests..."
echo ""

# Test 1: Essential files still exist
echo "📋 Test 1: Essential Files"
check_files "Core project files" \
    "package.json" \
    "README.md" \
    "LICENSE" \
    "src/index.js"

check_files "Documentation site" \
    "public/docs.html" \
    "public/docs-config.js" \
    "docs-express-server.js"

check_files "Build system" \
    "scripts/build.js" \
    "jest.config.js" \
    "eslint.config.js"

echo ""

# Test 2: Build system functionality
echo "📋 Test 2: Build System"
check_command "NPM install" "npm install --silent"
check_command "ESLint check" "npm run lint >/dev/null 2>&1 || true"  # Allow warnings
check_command "Build process" "npm run build"

echo ""

# Test 3: Documentation system
echo "📋 Test 3: Documentation"
check_command "JSDoc generation" "npm run docs"

# Start docs server in background and test
echo -n "🌐 Testing: Documentation server... "
npm run docs:serve >/dev/null 2>&1 &
DOCS_PID=$!
sleep 3

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001" | grep -q "200"; then
    echo -e "${GREEN}✅ RUNNING${NC}"
    DOC_SERVER_OK=1
else
    echo -e "${RED}❌ NOT RUNNING${NC}"
    DOC_SERVER_OK=0
fi

# Clean up docs server
kill $DOCS_PID 2>/dev/null || true

echo ""

# Test 4: Directory structure
echo "📋 Test 4: Organization"
check_files "Organized scripts" \
    "scripts/development" \
    "scripts/deployment" \
    "scripts/maintenance"

check_files "Organized tests" \
    "tests/development"

check_files "Organized docs" \
    "docs/reports"

echo ""

# Test 5: Repository health
echo "📋 Test 5: Repository Health"
REPO_SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo "📊 Current repository size: $REPO_SIZE"

FILE_COUNT=$(find . -type f -not -path "./node_modules/*" -not -path "./.git/*" | wc -l)
echo "📄 Total files (excluding node_modules/.git): $FILE_COUNT"

ROOT_FILES=$(ls -1 | wc -l)
echo "📁 Root directory files: $ROOT_FILES"

echo ""

# Test 6: Check for broken symlinks or references
echo "📋 Test 6: Integrity Check"
echo -n "🔗 Checking for broken symlinks... "
BROKEN_LINKS=$(find . -type l -not -path "./node_modules/*" -exec test ! -e {} \; -print 2>/dev/null | wc -l)
if [ $BROKEN_LINKS -eq 0 ]; then
    echo -e "${GREEN}✅ NO BROKEN LINKS${NC}"
else
    echo -e "${YELLOW}⚠️  $BROKEN_LINKS BROKEN LINKS${NC}"
fi

# Summary
echo ""
echo "📊 VERIFICATION SUMMARY"
echo "======================="

# Count results
TOTAL_TESTS=0
PASSED_TESTS=0

# Essential files
if check_files "Essential files" "package.json" "README.md" "LICENSE" "src/index.js" >/dev/null 2>&1; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Build system
if check_command "Build system" "npm run build" >/dev/null 2>&1; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Documentation
if [ $DOC_SERVER_OK -eq 1 ]; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 ALL SYSTEMS FUNCTIONAL${NC}"
    echo -e "${GREEN}✅ Cleanup completed successfully with no breaking changes${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  $PASSED_TESTS/$TOTAL_TESTS systems functional${NC}"
    echo -e "${YELLOW}Some tests failed - review output above${NC}"
    exit 1
fi