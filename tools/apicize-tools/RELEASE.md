# Release Guide

This document describes the release process for Apicize Tools.

## Prerequisites

Before creating a release, ensure you have:

1. **Permissions**:
   - Write access to the repository
   - npm publishing rights for @apicize organization
   - GitHub token with release permissions

2. **Environment Setup**:
   - Node.js 16+ installed
   - npm 8+ installed
   - Clean git working directory
   - All tests passing

3. **npm Configuration**:
   ```bash
   npm login
   # Verify you're logged in to npm
   npm whoami
   ```

## Release Types

### Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

## Release Process

### 1. Automated Release (Recommended)

#### Step 1: Pre-release Validation

```bash
npm run pre-release
```

This script validates:
- ✅ Git working directory is clean
- ✅ On correct branch (main/master)
- ✅ Latest changes pulled
- ✅ Dependencies installed
- ✅ Linting passes
- ✅ Build succeeds
- ✅ All tests pass
- ✅ Package creation works

#### Step 2: Create Release

For automatic version bump based on commits:
```bash
npm run release
```

For specific version bump:
```bash
# Patch release (1.0.0 → 1.0.1)
npm run release:patch

# Minor release (1.0.0 → 1.1.0)
npm run release:minor

# Major release (1.0.0 → 2.0.0)
npm run release:major
```

This automatically:
- ✅ Bumps version in all package.json files
- ✅ Updates CHANGELOG.md
- ✅ Creates git commit
- ✅ Creates git tag
- ✅ Runs build

#### Step 3: Post-release Tasks

```bash
npm run post-release
```

This script:
- ✅ Builds final packages
- ✅ Creates distribution tarballs
- ✅ Pushes tags to remote
- ✅ Displays package information

#### Step 4: Publish to npm

```bash
# Dry run first (recommended)
npm run publish:dry

# Publish packages
npm run publish:packages
```

#### Step 5: Verify Publication

```bash
npm run verify-publish
```

This verifies:
- ✅ Packages are available on npm registry
- ✅ Correct version is published
- ✅ Installation works
- ✅ CLI commands work

### 2. Manual Release

If you need more control:

```bash
# 1. Validate everything
npm run verify:full

# 2. Create release
npm run release

# 3. Push changes
git push --follow-tags origin main

# 4. Build packages
npm run build

# 5. Publish to npm
npm run publish:packages
```

### 3. GitHub Actions Release (CI/CD)

Trigger a release via GitHub Actions:

1. Go to repository on GitHub
2. Navigate to "Actions" tab
3. Select "Release" workflow
4. Click "Run workflow"
5. Select release type (patch/minor/major)
6. Optional: Enable dry-run mode
7. Click "Run workflow"

The workflow will:
- ✅ Run all validations
- ✅ Create release commit and tag
- ✅ Publish to npm
- ✅ Create GitHub release
- ✅ Upload artifacts

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

### Examples

```bash
feat(export): add support for nested request groups
fix(parser): handle malformed JSON gracefully
docs(readme): update installation instructions
```

## CHANGELOG

The CHANGELOG.md is automatically generated from commit messages using [standard-version](https://github.com/conventional-changelog/standard-version).

To manually edit the changelog before release:

1. Run dry-run: `npm run release:dry`
2. Review proposed changes
3. Edit CHANGELOG.md if needed
4. Run actual release: `npm run release`

## Version Synchronization

All packages in the monorepo use synchronized versioning:

- `package.json` (root)
- `packages/lib/package.json`
- `packages/tools/package.json`

The release process automatically updates all versions together.

## Rollback Process

If a release has issues:

### Before Publishing to npm

```bash
# Delete the tag
git tag -d v1.0.1

# Reset to previous commit
git reset --hard HEAD~1

# Force push (if already pushed)
git push origin main --force
git push origin :refs/tags/v1.0.1
```

### After Publishing to npm

```bash
# Deprecate the bad version
npm deprecate @apicize/tools@1.0.1 "This version has issues, please upgrade"
npm deprecate @apicize/lib@1.0.1 "This version has issues, please upgrade"

# Create a new patch release with fixes
npm run release:patch
npm run publish:packages
```

## Troubleshooting

### "Working directory not clean"

```bash
# Stash changes
git stash

# Or commit changes
git add .
git commit -m "chore: prepare for release"
```

### "npm publish failed - authentication required"

```bash
# Login to npm
npm login

# Verify authentication
npm whoami
```

### "Version already exists"

```bash
# This means the version was already published
# Bump to next version
npm run release:patch
```

### "Tests failing"

```bash
# Run individual test suites to identify issues
npm run test:unit
npm run test:integration
npm run lint

# Fix issues and try again
```

## Release Checklist

Use this checklist for manual releases:

- [ ] All changes committed and pushed
- [ ] All tests passing locally
- [ ] CHANGELOG reviewed and updated if needed
- [ ] Version number is correct
- [ ] Breaking changes documented
- [ ] Migration guide written (for major versions)
- [ ] Examples updated
- [ ] Documentation updated
- [ ] Pre-release validation passed
- [ ] Release created and tagged
- [ ] Packages published to npm
- [ ] GitHub release created
- [ ] Publication verified
- [ ] Announcement prepared (if needed)

## Support

For questions or issues with the release process:

1. Check this guide
2. Review existing releases on GitHub
3. Check CI/CD workflow logs
4. Create an issue on GitHub

## References

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [standard-version](https://github.com/conventional-changelog/standard-version)
- [npm Publishing](https://docs.npmjs.com/cli/v9/commands/npm-publish)
