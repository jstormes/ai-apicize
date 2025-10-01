# Apicize Troubleshooting Guide

This guide helps you resolve common issues when using Apicize tools.

## Table of Contents

- [Installation Issues](#installation-issues)
- [CLI Command Errors](#cli-command-errors)
- [Export/Import Problems](#exportimport-problems)
- [Validation Errors](#validation-errors)
- [Runtime Issues](#runtime-issues)
- [Performance Problems](#performance-problems)
- [Environment-Specific Issues](#environment-specific-issues)
- [Getting Help](#getting-help)

## Installation Issues

### Command Not Found

**Problem**: `apicize: command not found`

**Solutions**:

1. **Global installation missing**:
   ```bash
   npm install -g @apicize/tools
   ```

2. **PATH issues**:
   ```bash
   # Check npm global path
   npm config get prefix

   # Add to your PATH if missing
   export PATH=$PATH:$(npm config get prefix)/bin
   ```

3. **Use npx instead**:
   ```bash
   npx @apicize/tools --help
   ```

4. **Permission issues on macOS/Linux**:
   ```bash
   sudo npm install -g @apicize/tools
   # or configure npm to use different directory
   npm config set prefix ~/.npm-global
   export PATH=$PATH:~/.npm-global/bin
   ```

### Version Mismatch

**Problem**: Unexpected behavior or missing features

**Solution**:
```bash
# Check current version
apicize --version

# Update to latest
npm update -g @apicize/tools

# Force reinstall if needed
npm uninstall -g @apicize/tools
npm install -g @apicize/tools
```

### Node.js Compatibility

**Problem**: Installation fails or runtime errors

**Requirements**:
- Node.js 16.0.0 or higher
- npm 8.0.0 or higher

**Solution**:
```bash
# Check versions
node --version
npm --version

# Update Node.js using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

## CLI Command Errors

### Invalid Command Syntax

**Problem**: `error: unknown option` or `Unknown command`

**Common mistakes**:
```bash
# Wrong
apicize --export demo.apicize

# Correct
apicize export demo.apicize

# Wrong
apicize export demo.apicize -output ./tests

# Correct
apicize export demo.apicize --output ./tests
```

**Solution**: Use `apicize --help` or `apicize <command> --help`

### File Not Found Errors

**Problem**: `Input file does not exist`

**Debug steps**:
```bash
# Check file exists
ls -la *.apicize

# Use absolute path
apicize export /full/path/to/demo.apicize

# Check current directory
pwd
```

### Permission Denied

**Problem**: `EACCES` or `Permission denied`

**Solutions**:
```bash
# Check file permissions
ls -la demo.apicize

# Fix permissions
chmod 644 demo.apicize

# Check directory permissions
chmod 755 ./output-directory

# Run with elevated permissions (last resort)
sudo apicize export demo.apicize
```

## Export/Import Problems

### Export Fails with JSON Errors

**Problem**: `Parse error` or `Invalid JSON`

**Debug steps**:
```bash
# Validate JSON syntax
cat demo.apicize | jq .

# Check file encoding
file demo.apicize

# Validate against schema
apicize validate demo.apicize --strict
```

**Common JSON issues**:
- Missing commas
- Trailing commas
- Unescaped quotes in strings
- Wrong quote types (smart quotes)

### Export Creates Empty Directory

**Problem**: Export succeeds but no test files generated

**Causes & Solutions**:

1. **Empty requests array**:
   ```bash
   # Check file content
   apicize validate demo.apicize --format json
   ```

2. **Missing required fields**:
   ```json
   {
     "version": 1.0,
     "requests": [],  // Must have at least one request
     "scenarios": []  // Must have at least one scenario
   }
   ```

3. **Use verbose mode for debugging**:
   ```bash
   apicize export demo.apicize --verbose
   ```

### Import Accuracy is Low

**Problem**: Round-trip accuracy below 90%

**Investigation steps**:
```bash
# Export with verbose output
apicize export demo.apicize --verbose

# Check metadata preservation
grep -r "@apicize-metadata" ./tests/

# Compare structures
apicize export demo.apicize
apicize import ./tests --output imported.apicize
diff <(jq --sort-keys . demo.apicize) <(jq --sort-keys . imported.apicize)
```

**Common causes**:
- Modified test files after export
- Missing metadata comments
- Unsupported request types
- Complex nested structures

### TypeScript Compilation Errors

**Problem**: Generated TypeScript doesn't compile

**Debug steps**:
```bash
# Check generated project
cd tests
npm run build

# Check TypeScript config
cat tsconfig.json

# Install missing dependencies
npm install

# Check for syntax errors
npx tsc --noEmit
```

**Common fixes**:
```bash
# Update dependencies
npm update

# Install missing types
npm install @types/mocha @types/chai

# Fix import paths
npm install @apicize/lib
```

## Validation Errors

### Schema Validation Failures

**Problem**: `Validation failed` with schema errors

**Understanding error messages**:
```
❌ demo.apicize - 3 errors
• Missing required property: version
• Invalid value for requests[0].method: should be one of GET,POST,PUT,DELETE,PATCH,HEAD,OPTIONS
• Property 'invalid_field' is not allowed
```

**Common validation errors**:

1. **Missing required properties**:
   ```json
   {
     "version": 1.0,     // Required
     "requests": [],     // Required
     "scenarios": [],    // Required
     "authorizations": [], // Required
     "certificates": [], // Required
     "proxies": [],      // Required
     "data": []          // Required
   }
   ```

2. **Invalid enum values**:
   ```json
   {
     "method": "GET",    // Must be uppercase
     "execution": "SEQUENTIAL", // Not "sequential"
     "type": "JSON"      // Case sensitive
   }
   ```

3. **Wrong data types**:
   ```json
   {
     "timeout": 30000,   // Number, not string
     "runs": 1,          // Number, not string
     "disabled": false   // Boolean, not string
   }
   ```

### UUID Format Errors

**Problem**: `Invalid UUID format`

**Solution**:
```bash
# Generate valid UUIDs
node -e "console.log(require('crypto').randomUUID())"

# Or use online UUID generator
# https://www.uuidgenerator.net/

# Check UUID format (must be lowercase)
"id": "550e8400-e29b-41d4-a716-446655440000"
```

## Runtime Issues

### Request Execution Failures

**Problem**: Tests fail with network errors

**Debug steps**:
```bash
# Test endpoint manually
curl -v https://api.example.com/users

# Check network connectivity
ping api.example.com

# Use verbose mode
apicize run demo.apicize --verbose

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

**Common network issues**:
- Firewall blocking requests
- Proxy configuration
- SSL certificate errors
- DNS resolution problems

### Authentication Failures

**Problem**: `401 Unauthorized` or `403 Forbidden`

**Debug steps**:
```bash
# Check credentials
echo $API_KEY

# Test authentication manually
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/users

# Verify scenario variables
apicize run demo.apicize --scenario Development --verbose
```

**Common auth issues**:
- Expired tokens
- Wrong credential format
- Missing environment variables
- Incorrect auth type configuration

### Variable Substitution Problems

**Problem**: Variables not replaced in requests

**Debug examples**:
```json
// Wrong - variables not defined
"url": "{{baseUrl}}/users"  // If baseUrl is undefined

// Check scenario has variables
"scenarios": [{
  "variables": [
    {"name": "baseUrl", "value": "https://api.example.com"}
  ]
}]
```

**Debug steps**:
```bash
# Check variable definitions
apicize validate demo.apicize --format json | jq '.scenarios[].variables'

# Use verbose mode to see substitution
apicize run demo.apicize --verbose
```

### Test Code Execution Errors

**Problem**: Mocha/Chai test failures

**Common test issues**:
```javascript
// Wrong - missing imports
expect(response.status).to.equal(200);

// Correct - check imports
describe('Test', () => {
  it('should work', () => {
    expect(response.status).to.equal(200);
  });
});

// Wrong - accessing undefined response
const data = response.body.data;

// Correct - check response type
const data = (response.body.type === BodyType.JSON)
  ? response.body.data
  : expect.fail('Response is not JSON');
```

## Performance Problems

### Slow Export/Import Operations

**Problem**: Operations take too long

**Optimization strategies**:
```bash
# Use specific scenarios
apicize export demo.apicize --scenario Production

# Split large files
apicize export large-api.apicize --split

# Skip validation during import
apicize import ./tests --no-validate

# Use appropriate timeouts
apicize run demo.apicize --timeout 10000
```

### Memory Issues

**Problem**: `Out of memory` or slow performance with large files

**Solutions**:
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 $(which apicize) export large-file.apicize

# Process files in chunks
split -l 100 large-file.apicize chunk_

# Optimize file structure
# - Reduce nested groups
# - Split into multiple .apicize files
# - Remove unused scenarios/data
```

### Network Timeouts

**Problem**: Requests timeout frequently

**Configuration**:
```json
{
  "timeout": 60000,          // Increase timeout
  "numberOfRedirects": 3,    // Reduce redirects
  "keepAlive": false         // Disable keep-alive
}
```

**CLI options**:
```bash
# Increase timeout for run command
apicize run demo.apicize --timeout 60000

# Use different reporter
apicize run demo.apicize --reporter tap
```

## Environment-Specific Issues

### Windows Path Issues

**Problem**: Path separators or long paths

**Solutions**:
```bash
# Use forward slashes
apicize export demo.apicize --output ./tests

# Use short paths
apicize export demo.apicize -o tests

# Escape paths with spaces
apicize export "demo api.apicize" --output "test results"
```

### macOS Security Issues

**Problem**: `Operation not permitted`

**Solutions**:
```bash
# Grant Terminal full disk access in Security & Privacy
# Or use specific permissions
chmod +x /usr/local/bin/apicize

# Check quarantine attribute
xattr -l demo.apicize
xattr -d com.apple.quarantine demo.apicize
```

### Linux Permission Issues

**Problem**: Cannot execute or write files

**Solutions**:
```bash
# Check file permissions
ls -la demo.apicize

# Fix ownership
sudo chown $USER:$USER demo.apicize

# Fix directory permissions
chmod 755 output-directory
```

## Environment Variables

### Missing Environment Variables

**Problem**: Variables not found in scenarios

**Debug steps**:
```bash
# Check environment variables
env | grep API

# Set temporarily
export API_KEY="your-key-here"
apicize run demo.apicize

# Use .env file
echo "API_KEY=your-key-here" > .env
```

### Variable Loading Issues

**Problem**: Environment variables not loaded

**Solutions**:
```bash
# Check shell profile
echo $SHELL
source ~/.bashrc  # or ~/.zshrc

# Use explicit environment
env API_KEY="test" apicize run demo.apicize

# Use cross-env for consistency
npm install -g cross-env
cross-env API_KEY="test" apicize run demo.apicize
```

## Getting Help

### Enable Debug Output

**Always use verbose mode when troubleshooting**:
```bash
apicize export demo.apicize --verbose
apicize run demo.apicize --verbose
apicize import ./tests --verbose
```

### Collect Information

**When reporting issues, include**:
1. Apicize version: `apicize --version`
2. Node.js version: `node --version`
3. Operating system
4. Complete error message
5. Minimal .apicize file that reproduces the issue
6. Command used

### Useful Commands

```bash
# Full diagnostics
apicize --version
node --version
npm --version
echo $PATH
ls -la *.apicize

# Test basic functionality
apicize create test-api
apicize validate test-api.apicize
apicize run test-api.apicize

# Check installation
which apicize
npm list -g @apicize/tools
```

### Community Resources

- GitHub Issues: Report bugs and feature requests
- Documentation: Latest guides and examples
- Stack Overflow: Tag questions with `apicize`

### Log Files

**Enable detailed logging**:
```bash
# Set debug environment
export DEBUG=apicize:*
apicize export demo.apicize

# Save output to file
apicize export demo.apicize --verbose > debug.log 2>&1
```

### Creating Minimal Reproduction

**When reporting bugs, create minimal .apicize file**:
```json
{
  "version": 1.0,
  "requests": [{
    "id": "test",
    "name": "Test Request",
    "children": [{
      "id": "simple",
      "name": "Simple Test",
      "url": "https://httpbin.org/get",
      "method": "GET",
      "test": "describe('Test', () => { it('works', () => { expect(1).to.equal(1); }); });",
      "headers": [],
      "queryStringParams": [],
      "timeout": 30000,
      "runs": 1
    }],
    "execution": "SEQUENTIAL",
    "runs": 1
  }],
  "scenarios": [{
    "id": "default",
    "name": "Default",
    "variables": []
  }],
  "authorizations": [],
  "certificates": [],
  "proxies": [],
  "data": [],
  "defaults": {}
}
```

---

If you can't find a solution here, please check the [API Reference](./API-Reference.md) or create an issue on GitHub with detailed information about your problem.