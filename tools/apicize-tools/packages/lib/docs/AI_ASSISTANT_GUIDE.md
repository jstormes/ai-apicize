# AI Assistant Guide for Apicize Tools

## Overview

This guide explains how AI assistants like Claude Code can effectively use Apicize tools to help users create, manage, and execute API tests.

## What is Apicize?

Apicize tools enable **bidirectional conversion** between:
- **`.apicize` files**: JSON-based API test specifications with embedded Mocha/Chai tests
- **TypeScript test files**: Executable test suites using Mocha/Chai framework

### Key Capability: 100% Round-Trip Accuracy
Export → Modify → Import maintains complete data fidelity with zero data loss.

## Installation

Users install globally:
```bash
npm install -g @jstormes/apicize-tools
```

## Available Commands

```bash
apicize-tools export <file.apicize>      # Export to TypeScript
apicize-tools import <test-folder>       # Import TypeScript back to .apicize
apicize-tools create <name>              # Create new .apicize file
apicize-tools validate <file.apicize>    # Validate file structure
apicize-tools run <file.apicize>         # Execute tests directly
```

## Common AI Assistant Use Cases

### 1. Creating New API Tests

**Scenario**: User asks "Create an API test for my REST API"

**AI Assistant Actions**:
1. Understand API requirements (endpoints, methods, expected responses)
2. Create .apicize file structure using Write tool
3. Validate with `apicize-tools validate`
4. Explain the structure to user

**Example .apicize Structure**:
```json
{
  "version": 1.0,
  "requests": [
    {
      "id": "req-001",
      "name": "Get Users",
      "url": "https://api.example.com/users",
      "method": "GET",
      "test": "describe('status', () => {\n  it('should return 200', () => {\n    expect(response.status).to.equal(200)\n  })\n})",
      "headers": [
        {"name": "Accept", "value": "application/json"}
      ],
      "timeout": 5000
    }
  ],
  "scenarios": [
    {
      "id": "scenario-dev",
      "name": "Development",
      "variables": [
        {
          "name": "baseUrl",
          "value": "https://api.example.com",
          "type": "TEXT"
        }
      ]
    }
  ]
}
```

### 2. Converting to TypeScript

**Scenario**: User wants to run tests with Mocha/Chai

**AI Assistant Actions**:
```bash
# Use Bash tool with 10-minute timeout
apicize-tools export mytest.apicize --output ./tests
```

**Result**: Creates complete TypeScript test project with:
- `tests/` - Generated test files
- `lib/` - Helper libraries
- `config/` - Configuration files
- `package.json` - With @jstormes/apicize-lib dependency

### 3. Modifying Existing Tests

**Scenario**: User wants to update an API test

**AI Assistant Actions**:
1. Read existing .apicize file using Read tool
2. Parse JSON structure
3. Modify using Edit tool or recreate with Write tool
4. Validate changes

**Example Edit**:
```xml
<!-- Read the file first -->
<invoke name="Read">
  <parameter name="file_path">/path/to/test.apicize</parameter>
</invoke>

<!-- Then edit specific parts -->
<invoke name="Edit">
  <parameter name="file_path">/path/to/test.apicize</parameter>
  <parameter name="old_string">"timeout": 5000</parameter>
  <parameter name="new_string">"timeout": 10000</parameter>
</invoke>
```

### 4. Validating Tests

**Scenario**: Check if .apicize file is valid

**AI Assistant Actions**:
```bash
# Always use 10-minute timeout for apicize-tools commands
apicize-tools validate mytest.apicize
```

### 5. Running Tests

**Scenario**: Execute tests without conversion

**AI Assistant Actions**:
```bash
apicize-tools run mytest.apicize --scenario production
```

## Practical Workflows for AI Assistants

### Workflow A: Create From Scratch

```
1. User provides API requirements
   ↓
2. AI creates .apicize JSON structure
   ↓
3. AI validates: apicize-tools validate test.apicize
   ↓
4. User can run or export to TypeScript
```

**Code Example**:
```json
{
  "version": 1.0,
  "requests": [
    {
      "id": "{{generate-uuid}}",
      "name": "{{request-name}}",
      "url": "{{api-url}}",
      "method": "{{HTTP-method}}",
      "test": "{{mocha-chai-test-code}}",
      "headers": [],
      "timeout": 30000
    }
  ]
}
```

### Workflow B: Export → Modify → Import

```
1. User has .apicize file
   ↓
2. AI: apicize-tools export test.apicize --output ./tests
   ↓
3. User modifies TypeScript tests
   ↓
4. AI: apicize-tools import ./tests --output updated.apicize
   ↓
5. Result: 100% round-trip accuracy
```

### Workflow C: Using Scenarios

Different test environments (dev, staging, production):

```json
{
  "version": 1.0,
  "requests": [
    {
      "id": "req-001",
      "name": "API Call",
      "url": "{{baseUrl}}/endpoint",
      "method": "GET"
    }
  ],
  "scenarios": [
    {
      "id": "dev",
      "name": "Development",
      "variables": [
        {"name": "baseUrl", "value": "http://localhost:3000", "type": "TEXT"}
      ]
    },
    {
      "id": "prod",
      "name": "Production",
      "variables": [
        {"name": "baseUrl", "value": "https://api.example.com", "type": "TEXT"}
      ]
    }
  ]
}
```

Run with specific scenario:
```bash
apicize-tools run test.apicize --scenario prod
```

## Test Code Patterns

### Pattern 1: Status Check
```javascript
describe('status', () => {
  it('equals 200', () => {
    expect(response.status).to.equal(200)
  })
})
```

### Pattern 2: JSON Response Validation
```javascript
describe('response', () => {
  it('contains expected data', () => {
    const data = (response.body.type == BodyType.JSON)
      ? response.body.data
      : expect.fail('Response body is not JSON')
    
    expect(data.id).to.exist
    expect(data.name).to.be.a('string')
  })
})
```

### Pattern 3: Variable Access
```javascript
describe('variables', () => {
  it('uses scenario variable', () => {
    const data = (response.body.type == BodyType.JSON)
      ? response.body.data
      : expect.fail('Response body is not JSON')
    
    // Access scenario variables via $
    expect(data.field).to.equal($.expectedValue)
  })
})
```

### Pattern 4: Output for Next Test
```javascript
describe('capture', () => {
  it('saves data for next request', () => {
    const data = (response.body.type == BodyType.JSON)
      ? response.body.data
      : expect.fail('Response body is not JSON')
    
    // Pass data to subsequent tests
    output('userId', data.id)
    console.info(`Saved user ID: ${data.id}`)
  })
})
```

## AI Assistant Best Practices

### 1. Always Use 10-Minute Timeout
```xml
<invoke name="Bash">
  <parameter name="command">apicize-tools export test.apicize</parameter>
  <parameter name="description">Export .apicize to TypeScript</parameter>
  <parameter name="timeout">600000</parameter>
</invoke>
```

### 2. Validate After Creation
Always validate .apicize files after creating/modifying them:
```bash
apicize-tools validate mytest.apicize
```

### 3. Use Example Files as Templates
Reference examples in `/packages/examples/workbooks/`:
- `minimal.apicize` - Bare minimum structure
- `simple-rest-api.apicize` - Basic REST API tests
- `rest-crud-complete.apicize` - Full CRUD operations
- `with-authentication.apicize` - Auth examples
- `request-groups.apicize` - Hierarchical test organization
- `graphql-api.apicize` - GraphQL example

### 4. Explain Structure to Users
When creating .apicize files, explain:
- Top-level structure (requests, scenarios, authorizations)
- How variables work ({{variableName}})
- How test code is embedded as strings
- How to use scenarios for different environments

### 5. Leverage Round-Trip Capability
For complex modifications:
1. Export to TypeScript (familiar tools)
2. User/AI modifies TypeScript
3. Import back (maintains structure)

## .apicize File Structure Reference

### Required Fields
```json
{
  "version": 1.0,
  "requests": [],      // Can be empty
  "scenarios": [],     // Can be empty
  "authorizations": [], // Can be empty
  "certificates": [],  // Can be empty
  "proxies": [],      // Can be empty
  "data": []          // Can be empty
}
```

### Request Object
```json
{
  "id": "unique-id",           // Required
  "name": "Request Name",      // Required
  "url": "https://api.url",    // Required
  "method": "GET",             // Required: GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS
  "test": "mocha test code",   // Optional: String containing Mocha/Chai test
  "headers": [],               // Optional: Array of {name, value}
  "body": {                    // Optional
    "type": "JSON",            // None|Text|JSON|XML|Form|Raw
    "data": {}                 // Type depends on body.type
  },
  "queryStringParams": [],     // Optional: Array of {name, value}
  "timeout": 30000,            // Optional: Milliseconds
  "numberOfRedirects": 10,     // Optional
  "runs": 1,                   // Optional: Number of times to run
  "multiRunExecution": "SEQUENTIAL" // Optional: SEQUENTIAL|CONCURRENT
}
```

### Request Group (Hierarchical Organization)
```json
{
  "id": "group-id",
  "name": "Group Name",
  "children": [],              // Array of Request or RequestGroup
  "execution": "SEQUENTIAL",   // SEQUENTIAL|CONCURRENT
  "runs": 1,
  "selectedScenario": {        // Optional
    "id": "scenario-id",
    "name": "Scenario Name"
  }
}
```

### Scenario Object
```json
{
  "id": "scenario-id",
  "name": "Scenario Name",
  "variables": [
    {
      "name": "variableName",
      "value": "value",
      "type": "TEXT"           // TEXT|JSON|FILE-JSON|FILE-CSV
    }
  ]
}
```

## Integration with Claude Code Workflows

### Using the Bash Tool
```xml
<invoke name="Bash">
  <parameter name="command">apicize-tools validate test.apicize</parameter>
  <parameter name="description">Validate .apicize file</parameter>
  <parameter name="timeout">600000</parameter>
</invoke>
```

### Using the Read Tool
```xml
<invoke name="Read">
  <parameter name="file_path">/path/to/test.apicize</parameter>
</invoke>
```

### Using the Write Tool
```xml
<invoke name="Write">
  <parameter name="file_path">/path/to/new-test.apicize</parameter>
  <parameter name="content">{
  "version": 1.0,
  "requests": []
}</parameter>
</invoke>
```

### Using the Edit Tool
```xml
<invoke name="Edit">
  <parameter name="file_path">/path/to/test.apicize</parameter>
  <parameter name="old_string">"timeout": 5000</parameter>
  <parameter name="new_string">"timeout": 10000</parameter>
</invoke>
```

## Quick Reference

### Command Cheat Sheet
```bash
# Create
apicize-tools create my-api-test --template rest-crud

# Validate
apicize-tools validate test.apicize
apicize-tools validate **/*.apicize

# Export
apicize-tools export test.apicize --output ./tests
apicize-tools export test.apicize --output ./tests --scenario production

# Import
apicize-tools import ./tests --output updated.apicize

# Run
apicize-tools run test.apicize
apicize-tools run test.apicize --scenario staging
apicize-tools run test.apicize --reporter json
```

### Common Test Assertions
```javascript
// Status checks
expect(response.status).to.equal(200)
expect(response.status).to.be.within(200, 299)

// JSON validation
expect(response.body.type).to.equal(BodyType.JSON)
expect(data).to.be.an('object')
expect(data).to.have.property('id')

// Array checks
expect(Array.isArray(data)).to.be.true
expect(data).to.have.length.greaterThan(0)

// String checks
expect(data.name).to.be.a('string')
expect(data.email).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
```

## Troubleshooting Tips for AI Assistants

### Issue: Command not found
**Solution**: Remind user to install:
```bash
npm install -g @jstormes/apicize-tools
```

### Issue: Invalid JSON in .apicize file
**Solution**: 
1. Validate JSON syntax
2. Ensure `version` is 1.0 (not 1 or "1.0")
3. Check all required fields are present

### Issue: Export fails
**Solution**:
1. Validate .apicize file first
2. Ensure output directory is writable
3. Check for sufficient disk space

### Issue: Round-trip accuracy not 100%
**Solution**:
1. Ensure `metadata/workbook.json` exists in exported project
2. Don't manually delete generated files
3. Use latest version of tools

## Example: Complete AI Assistant Interaction

**User**: "Create an API test for my user management API"

**AI Assistant Response**:

```
I'll create an API test for your user management API. Let me create a .apicize file with common CRUD operations:

[Creates file using Write tool]

The test file includes:
- GET /users - List all users
- POST /users - Create new user
- GET /users/{id} - Get specific user
- PUT /users/{id} - Update user
- DELETE /users/{id} - Delete user

Each request includes:
- Proper HTTP methods and headers
- Mocha/Chai test assertions
- Variable usage for data passing between requests

You can now:
1. Run directly: `apicize-tools run user-api-test.apicize`
2. Export to TypeScript: `apicize-tools export user-api-test.apicize --output ./tests`
3. Customize scenarios for dev/staging/prod environments

Would you like me to add authentication or modify any of the tests?
```

## Resources

- [Installation Guide](./INSTALLATION.md)
- [CLI Guide](./docs/CLI-Guide.md)
- [API Reference](./docs/API-Reference.md)
- [Examples Directory](./packages/examples/workbooks/)
- [Round-Trip Verification](./ROUND_TRIP_VERIFICATION.txt)

---

**Note**: This guide is specifically for AI assistants. For end-user documentation, see INSTALLATION.md and the docs/ directory.
