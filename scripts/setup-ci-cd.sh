#!/bin/bash
# BestBlogs.dev CI/CD Setup Script
# Run this script to set up local development environment with pre-commit hooks

set -e

echo "================================================"
echo "BestBlogs.dev CI/CD Setup"
echo "================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20+ is required (current: $(node -v))"
    exit 1
fi

echo -e "${GREEN}Node.js $(node -v) - OK${NC}"

if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

echo -e "${GREEN}npm $(npm -v) - OK${NC}"

# Change to web directory
cd "$(dirname "$0")/../web" || exit 1

# Install dependencies
echo ""
echo "Installing dependencies..."
npm ci

# Setup Husky
echo ""
echo "Setting up git hooks..."
npx husky install || npx husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
cd "web" && npx lint-staged
EOF

# Create commit-msg hook
cat > .husky/commit-msg << 'EOF'
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"
npx --no -- commitlint --edit $1
EOF

# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg

echo -e "${GREEN}Git hooks installed${NC}"

# Setup lint-staged config (if not exists)
if [ ! -f .lintstagedrc.json ]; then
    echo "Creating lint-staged config..."
    cat > .lintstagedrc.json << 'EOF'
{
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
EOF
fi

# Setup commitlint config (if not exists)
if [ ! -f commitlint.config.js ]; then
    echo "Creating commitlint config..."
    cat > commitlint.config.js << 'EOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
  },
};
EOF
fi

# Create .prettierrc if not exists
if [ ! -f .prettierrc.json ]; then
    echo "Creating Prettier config..."
    cat > .prettierrc.json << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
EOF
fi

echo ""
echo "================================================"
echo -e "${GREEN}Setup complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env.local and configure"
echo "  2. Run 'npm run dev' to start development server"
echo "  3. Run 'npm run test' to run tests"
echo ""
echo "Available commands:"
echo "  npm run lint          - Run ESLint"
echo "  npm run lint:fix      - Fix ESLint issues"
echo "  npm run format        - Format code"
echo "  npm run typecheck     - Check TypeScript types"
echo "  npm run test          - Run tests"
echo "  npm run test:coverage - Run tests with coverage"
echo "  npm run build         - Build for production"
echo ""
echo "Pre-commit hooks are now active."
echo "They will run linting and formatting before each commit."
echo ""
