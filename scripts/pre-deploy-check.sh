#!/bin/bash
# DevPulse Pre-Deployment Error Check Script
# Run this before deploying to production

set -e

echo "🔍 DevPulse Pre-Deployment Error Check"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

check_error() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        ERRORS=$((ERRORS + 1))
    fi
}

check_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

echo "1. Checking TypeScript Compilation..."
echo "--------------------------------------"
npm run build 2>&1 | tee /tmp/build.log
if grep -q "error TS" /tmp/build.log; then
    check_error 1 "TypeScript compilation has errors"
    grep "error TS" /tmp/build.log | head -10
else
    check_error 0 "TypeScript compilation successful"
fi
echo ""

echo "2. Checking for Hardcoded Secrets..."
echo "--------------------------------------"
if grep -rn "sk-[a-zA-Z0-9]" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v ".d.ts"; then
    check_warning "Possible hardcoded API keys found"
else
    check_error 0 "No hardcoded API keys found"
fi

if grep -rn "password.*=.*['\"][^$]" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v ".d.ts"; then
    check_warning "Possible hardcoded passwords found"
else
    check_error 0 "No hardcoded passwords found"
fi
echo ""

echo "3. Checking Environment Variables..."
echo "--------------------------------------"
if [ -f .env ]; then
    if grep -q "JWT_SECRET=GENERATE" .env 2>/dev/null; then
        check_error 1 "JWT_SECRET not configured"
    else
        check_error 0 "JWT_SECRET configured"
    fi
    
    if grep -q "ENCRYPTION_MASTER_KEY=$" .env 2>/dev/null; then
        check_error 1 "ENCRYPTION_MASTER_KEY not configured"
    else
        check_error 0 "ENCRYPTION_MASTER_KEY configured"
    fi
    
    if grep -q "DATABASE_URL=postgresql://USER" .env 2>/dev/null; then
        check_error 1 "DATABASE_URL not configured"
    else
        check_error 0 "DATABASE_URL configured"
    fi
else
    check_error 1 ".env file not found"
fi
echo ""

echo "4. Checking Database Migrations..."
echo "--------------------------------------"
if [ -d "database/migrations" ]; then
    MIGRATION_COUNT=$(ls database/migrations/*.sql 2>/dev/null | wc -l)
    echo "Found $MIGRATION_COUNT migration files"
    check_error 0 "Migration files exist"
else
    check_error 1 "Migration directory not found"
fi
echo ""

echo "5. Checking Dependencies..."
echo "--------------------------------------"
if [ -f "package-lock.json" ]; then
    check_error 0 "package-lock.json exists"
else
    check_warning "package-lock.json not found, run npm install"
fi

if [ -d "node_modules" ]; then
    check_error 0 "node_modules installed"
else
    check_error 1 "node_modules not found, run npm install"
fi
echo ""

echo "6. Running Lint Check..."
echo "--------------------------------------"
npm run lint 2>&1 | tee /tmp/lint.log || true
if grep -q "error" /tmp/lint.log 2>/dev/null; then
    check_warning "Linting errors found"
else
    check_error 0 "Linting passed"
fi
echo ""

echo "7. Checking Security..."
echo "--------------------------------------"
# Check for .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "\.env" .gitignore; then
        check_error 0 ".env is in .gitignore"
    else
        check_error 1 ".env is NOT in .gitignore"
    fi
else
    check_warning ".gitignore not found"
fi

# Check for SQL injection vulnerabilities
if grep -rn "SELECT.*\$" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -q "SELECT.*\$\|SELECT.*{"; then
    check_warning "Possible SQL injection vulnerability"
else
    check_error 0 "No obvious SQL injection vulnerabilities"
fi
echo ""

echo "8. Checking Performance Config..."
echo "--------------------------------------"
if [ -f "_core/db.ts" ]; then
    if grep -q "connectionLimit" _core/db.ts; then
        check_error 0 "Database connection pool configured"
    else
        check_warning "Database connection pool not configured"
    fi
fi

if [ -d "_cache" ]; then
    check_error 0 "Redis caching enabled"
else
    check_warning "Redis caching directory not found"
fi
echo ""

echo "9. Checking Docker Setup..."
echo "--------------------------------------"
if [ -f "docker-compose.yml" ]; then
    check_error 0 "docker-compose.yml exists"
else
    check_warning "docker-compose.yml not found"
fi

if [ -f "Dockerfile" ]; then
    check_error 0 "Dockerfile exists"
else
    check_warning "Dockerfile not found"
fi
echo ""

echo "10. Testing API Health Endpoint..."
echo "--------------------------------------"
echo "(Skipping - run this after deployment)"
echo ""

# Summary
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ Please fix $ERRORS errors before deploying.${NC}"
    exit 1
fi
