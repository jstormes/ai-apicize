#!/bin/bash

# Verify published packages
# This script verifies that packages were published successfully to npm

set -e

echo "🔍 Verifying published packages..."
echo ""

# Get the current version
VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F'"' '{print $4}')
echo "📌 Expected version: $VERSION"
echo ""

# Wait for npm registry to sync
echo "⏳ Waiting for npm registry to sync (30 seconds)..."
sleep 30
echo ""

# Check @apicize/lib
echo "📦 Checking @apicize/lib..."
if npm view @apicize/lib@$VERSION version &>/dev/null; then
    PUBLISHED_VERSION=$(npm view @apicize/lib@$VERSION version)
    echo "✅ @apicize/lib@$PUBLISHED_VERSION is published"
else
    echo "❌ @apicize/lib@$VERSION not found on npm"
    exit 1
fi
echo ""

# Check @apicize/tools
echo "📦 Checking @apicize/tools..."
if npm view @apicize/tools@$VERSION version &>/dev/null; then
    PUBLISHED_VERSION=$(npm view @apicize/tools@$VERSION version)
    echo "✅ @apicize/tools@$PUBLISHED_VERSION is published"
else
    echo "❌ @apicize/tools@$VERSION not found on npm"
    exit 1
fi
echo ""

# Test installation in temp directory
echo "🧪 Testing installation from npm..."
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

npm init -y > /dev/null 2>&1
npm install -g @apicize/tools@$VERSION

if apicize --version | grep -q "$VERSION"; then
    echo "✅ Installation successful"
    echo "✅ CLI is working"
else
    echo "❌ Installation failed or version mismatch"
    exit 1
fi

# Test CLI commands
echo ""
echo "🧪 Testing CLI commands..."
apicize --help > /dev/null 2>&1 && echo "✅ apicize --help works"
apicize export --help > /dev/null 2>&1 && echo "✅ apicize export --help works"
apicize import --help > /dev/null 2>&1 && echo "✅ apicize import --help works"
apicize validate --help > /dev/null 2>&1 && echo "✅ apicize validate --help works"

# Cleanup
cd - > /dev/null
rm -rf $TEMP_DIR

echo ""
echo "✅ All verification checks passed!"
echo "📦 Packages are successfully published and working"
