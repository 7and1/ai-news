#!/bin/bash
# BestBlogs.dev Deployment Script
# Deploy to Cloudflare Workers with health checks

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default environment
ENVIRONMENT=${1:-staging}

echo "================================================"
echo "BestBlogs.dev Deployment Script"
echo "================================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Change to web directory
cd "$(dirname "$0")/../web" || exit 1

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run tests
echo "Running tests..."
npm run test || {
    echo -e "${RED}Tests failed${NC}"
    exit 1
}
echo -e "${GREEN}Tests passed${NC}"

# Run type check
echo ""
echo "Running type check..."
npm run typecheck || {
    echo -e "${RED}Type check failed${NC}"
    exit 1
}
echo -e "${GREEN}Type check passed${NC}"

# Build
echo ""
echo "Building..."
npm run build || {
    echo -e "${RED}Build failed${NC}"
    exit 1
}
echo -e "${GREEN}Build complete${NC}"

# Deploy
echo ""
echo "Deploying to $ENVIRONMENT..."

# Get site URL based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    SITE_URL="https://bestblogs.dev"
    wrangler deploy
else
    SITE_URL="https://staging.bestblogs.dev"
    wrangler deploy --env staging
fi

echo -e "${GREEN}Deployment complete${NC}"

# Health check
echo ""
echo "Running health checks..."

MAX_ATTEMPTS=10
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$SITE_URL/api/health" || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}Health check passed${NC}"
        echo ""
        echo "Deployment successful!"
        echo "URL: $SITE_URL"
        exit 0
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS failed (HTTP $HTTP_CODE)"
    sleep 10
done

echo -e "${RED}Health check failed after $MAX_ATTEMPTS attempts${NC}"
echo "Please check the logs: wrangler tail"
exit 1
