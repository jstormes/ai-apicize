#!/bin/bash

# Pre-release validation script
# This script runs all validation steps before creating a release

set -e  # Exit on any error

echo "🔍 Starting pre-release validation..."
echo ""

# Check if we're on a clean branch
echo "📋 Checking git status..."
if [[ -n $(git status -s) ]]; then
    echo "❌ Error: Working directory is not clean"
    echo "Please commit or stash your changes before releasing"
    exit 1
fi
echo "✅ Working directory is clean"
echo ""

# Check current branch
echo "📋 Checking current branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]] && [[ "$CURRENT_BRANCH" != "master" ]]; then
    echo "⚠️  Warning: You are not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo "✅ Branch check passed"
echo ""

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin $CURRENT_BRANCH
echo "✅ Up to date with remote"
echo ""

# Clean install dependencies
echo "📦 Installing dependencies..."
npm ci
echo "✅ Dependencies installed"
echo ""

# Run linter
echo "🔍 Running linter..."
npm run lint
echo "✅ Linting passed"
echo ""

# Build packages
echo "🔨 Building packages..."
npm run build
echo "✅ Build successful"
echo ""

# Run unit tests
echo "🧪 Running unit tests..."
npm run test:unit
echo "✅ Unit tests passed"
echo ""

# Run integration tests
echo "🧪 Running integration tests..."
npm run test:integration
echo "✅ Integration tests passed"
echo ""

# Validate workbooks
echo "📚 Validating example workbooks..."
npm run validate-workbooks
echo "✅ Workbook validation passed"
echo ""

# Test package creation
echo "📦 Testing package creation..."
npm run pack:test
echo "✅ Package creation successful"
echo ""

# Check package sizes
echo "📊 Package sizes:"
ls -lh apicize-*.tgz 2>/dev/null | awk '{print $9, $5}'
echo ""

echo "✅ All pre-release validation checks passed!"
echo ""
echo "You can now run: npm run release"
