#!/bin/bash

# Post-release script
# This script runs after a successful release

set -e  # Exit on any error

echo "🎉 Post-release tasks..."
echo ""

# Get the new version from package.json
NEW_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F'"' '{print $4}')
echo "📌 Released version: $NEW_VERSION"
echo ""

# Build packages
echo "🔨 Building final packages..."
npm run build
echo "✅ Build complete"
echo ""

# Create distribution packages
echo "📦 Creating distribution packages..."
npm run pack:test
echo "✅ Packages created"
echo ""

# Display package information
echo "📊 Package information:"
echo ""
for file in apicize-*.tgz; do
    if [ -f "$file" ]; then
        echo "  📦 $file"
        tar -tzf "$file" | wc -l | xargs echo "     Files:"
        ls -lh "$file" | awk '{print "     Size: " $5}'
        echo ""
    fi
done

# Push tags to remote
echo "🏷️  Pushing tags to remote..."
git push --follow-tags origin $(git branch --show-current)
echo "✅ Tags pushed"
echo ""

echo "✅ Post-release tasks complete!"
echo ""
echo "Next steps:"
echo "  1. Verify the release on GitHub"
echo "  2. Publish packages: npm run publish:packages"
echo "  3. Update documentation if needed"
echo ""
echo "Release v$NEW_VERSION is ready! 🚀"
