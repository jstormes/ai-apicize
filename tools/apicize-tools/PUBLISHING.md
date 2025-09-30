# Publishing Apicize Tools to npm

## Overview

This monorepo contains two publishable packages:
- `@jstormes/apicize-lib` - Core library for Apicize functionality
- `@jstormes/apicize-tools` - CLI tools (depends on apicize-lib)

Both packages must be published under the `@jstormes` npm scope.

## Prerequisites

### 1. npm Account Setup

```bash
# Check if you're logged in
npm whoami

# If not logged in, login
npm login

# Verify you have access to the @jstormes scope
npm org ls jstormes
```

### 2. Version Management

Decide on version numbers for both packages. They should typically have the same version number for consistency.

Current version: `1.0.0`

To update versions:
```bash
# For a patch release (1.0.0 -> 1.0.1)
npm version patch --workspaces

# For a minor release (1.0.0 -> 1.1.0)
npm version minor --workspaces

# For a major release (1.0.0 -> 2.0.0)
npm version major --workspaces
```

Or manually edit `package.json` files in:
- `/packages/lib/package.json`
- `/packages/tools/package.json`

### 3. Pre-Publish Checklist

- [ ] All tests passing
- [ ] Code built successfully
- [ ] Round-trip verification passes (100% accuracy)
- [ ] Documentation up to date
- [ ] CHANGELOG.md updated with release notes
- [ ] Git working directory clean (all changes committed)

## Publishing Process

### Step 1: Clean and Build

```bash
cd /project/tools/apicize-tools

# Clean all build artifacts
npm run clean --workspaces

# Install dependencies
npm install

# Build all packages
npm run build

# Verify build succeeded
ls -la packages/lib/dist/
ls -la packages/tools/dist/
```

### Step 2: Run Tests

```bash
# Run all tests
npm test --workspaces

# Run round-trip verification
node test-workbooks.js
```

### Step 3: Publish Library First

**IMPORTANT**: Always publish `@jstormes/apicize-lib` BEFORE `@jstormes/apicize-tools` because the tools package depends on the library.

```bash
cd packages/lib

# Dry run to see what will be published
npm publish --dry-run

# Review the output - ensure it includes:
# - dist/ directory with all compiled .js and .d.ts files
# - docs/ directory with AI_ASSISTANT_GUIDE.md
# - README.md, LICENSE, package.json

# Publish to npm (public access required for scoped packages)
npm publish --access public

# Verify publication
npm view @jstormes/apicize-lib
```

### Step 4: Publish Tools Package

```bash
cd ../tools

# Dry run
npm publish --dry-run

# Review the output - ensure it includes:
# - dist/ directory with all CLI files
# - README.md, LICENSE, package.json
# - bin configuration pointing to dist/cli.js

# Publish to npm
npm publish --access public

# Verify publication
npm view @jstormes/apicize-tools
```

### Step 5: Test Installation

```bash
# Test global installation in a clean environment
cd /tmp
mkdir test-install
cd test-install

# Install the published package
npm install -g @jstormes/apicize-tools

# Test commands
apicize --version
apicize --help
apicize docs --output .

# Verify docs were exported
ls -la AI_ASSISTANT_GUIDE.md

# Test a real workflow (if you have a test .apicize file)
apicize validate path/to/test.apicize
apicize export path/to/test.apicize
```

### Step 6: Create Git Tag

```bash
cd /project/tools/apicize-tools

# Create a git tag for the release
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push the tag to remote
git push origin v1.0.0

# Push any commits if needed
git push origin main
```

## Publishing Checklist

### Before Publishing
- [ ] Version numbers updated in both packages
- [ ] CHANGELOG.md updated with release notes
- [ ] All changes committed to git
- [ ] Clean build completed successfully
- [ ] All tests passing
- [ ] Round-trip verification: 100%

### Publishing Order
- [ ] Publish `@jstormes/apicize-lib` first
- [ ] Wait for npm to index (check with `npm view`)
- [ ] Publish `@jstormes/apicize-tools` second
- [ ] Verify both packages on npmjs.com

### After Publishing
- [ ] Test global installation: `npm install -g @jstormes/apicize-tools`
- [ ] Verify CLI works: `apicize --version`
- [ ] Test basic commands
- [ ] Create git tag for release
- [ ] Update GitHub releases (if applicable)
- [ ] Announce release (if applicable)

## Troubleshooting

### Error: "403 Forbidden"

You don't have permission to publish to the `@jstormes` scope.

**Solution**:
1. Verify you're logged in as the correct user: `npm whoami`
2. Check scope access: `npm org ls jstormes`
3. If it's your personal scope, you should have access
4. If it's an organization, request access from the owner

### Error: "Version already exists"

The version number already exists on npm.

**Solution**: Increment the version number in `package.json` and try again.

### Error: "Package not found" when installing

npm hasn't indexed the package yet.

**Solution**: Wait 1-2 minutes and try again. Check https://www.npmjs.com/package/@jstormes/apicize-tools

### Tools package can't find library

The library package wasn't published first or npm hasn't indexed it.

**Solution**:
1. Verify library is published: `npm view @jstormes/apicize-lib`
2. Wait a few minutes for npm to index
3. Try publishing tools package again

### "Permission denied" during global install

npm doesn't have permission to install globally.

**Solution**: See INSTALLATION.md troubleshooting section for fixing npm permissions.

## Updating Existing Packages

To publish updates:

```bash
# 1. Make your changes
# 2. Update version numbers
npm version patch --workspaces  # or minor/major

# 3. Update CHANGELOG.md

# 4. Build and test
npm run build
npm test --workspaces

# 5. Publish library, then tools (same process as above)
cd packages/lib && npm publish --access public
cd ../tools && npm publish --access public

# 6. Tag the release
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1
```

## Unpublishing (Emergency Only)

**WARNING**: Unpublishing is strongly discouraged and should only be used in emergencies (security issues, accidentally published secrets, etc.)

```bash
# Unpublish a specific version (within 72 hours of publishing)
npm unpublish @jstormes/apicize-tools@1.0.0

# Unpublish entire package (use with extreme caution)
npm unpublish @jstormes/apicize-tools --force
```

**Better alternative**: Publish a new patch version with the fix instead of unpublishing.

## Deprecating Old Versions

If you want to discourage use of an old version:

```bash
npm deprecate @jstormes/apicize-tools@1.0.0 "Please upgrade to 1.0.1 or later"
```

## CI/CD Integration (Future)

For automated publishing via GitHub Actions:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build --workspaces
      - run: npm test --workspaces

      - run: cd packages/lib && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - run: cd packages/tools && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Links

- [npm Documentation](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [npm Scoped Packages](https://docs.npmjs.com/cli/v9/using-npm/scope)

## Support

If you encounter issues during publishing:
1. Check the [npm status page](https://status.npmjs.org/)
2. Review npm publish logs carefully
3. Test in a clean environment
4. Verify all prerequisites are met
