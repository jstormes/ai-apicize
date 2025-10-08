# LLM-Friendly Apicize Tools - Improvement Plan

## Executive Summary

This document outlines improvements to make Apicize Tools significantly easier for LLMs to use, addressing the current ~70% failure rate when LLMs attempt to generate `.apicize` files.

---

## Problems Identified

### Current LLM Pain Points

1. **Complex JSON Schema** (532 lines)
   - Too many optional fields to track
   - Nested discriminated unions (body types, auth types)
   - Hard for LLMs to maintain context

2. **String Escaping Issues**
   - Test code requires JSON string escaping
   - Nested quotes and newlines cause frequent errors
   - Example failure: `"test": "it('fails', () => { /* unterminated string */ }"`

3. **All-or-Nothing Validation**
   - Must provide complete valid structure upfront
   - One error invalidates entire file
   - No incremental building support

4. **Poor Error Messages**
   - Technical AJV errors: `instancePath: /requests/0/body`
   - Don't suggest fixes
   - Don't show what LLMs should generate

5. **No Alternative Formats**
   - Only JSON supported
   - YAML would be easier (no escaping, multiline strings)
   - No simplified DSL

---

## Solution 1: LLM-Optimized Builder API

### New CLI Command: `apicize build`

**Purpose**: Allow LLMs to build tests incrementally with validation at each step

```bash
# Initialize minimal workbook
apicize build init --name "API Tests" > workbook.apicize

# Add requests one at a time
apicize build add-request \
  --workbook workbook.apicize \
  --name "Get Users" \
  --url "{{baseUrl}}/users" \
  --method GET \
  --test-file test-code.js \
  --output workbook.apicize

# Add scenario
apicize build add-scenario \
  --workbook workbook.apicize \
  --name "Development" \
  --var baseUrl=http://localhost:3000 \
  --var apiKey=test-key \
  --output workbook.apicize

# Validate at any point
apicize build validate workbook.apicize
```

### Benefits for LLMs

✅ Build incrementally (reduce context requirements)
✅ Validate each step (catch errors early)
✅ Simpler commands (one concept at a time)
✅ Test code in separate files (no escaping)

### Implementation

```typescript
// packages/tools/src/commands/build.ts
export class BuildCommand {

  async init(name: string): Promise<ApicizeWorkbook> {
    return {
      version: 1.0,
      requests: [],
      scenarios: [],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: []
    };
  }

  async addRequest(
    workbook: ApicizeWorkbook,
    options: {
      name: string;
      url: string;
      method: HttpMethod;
      testFile?: string;  // Read from file - no escaping!
      parentId?: string;  // Add to group
    }
  ): Promise<ApicizeWorkbook> {
    const testCode = options.testFile
      ? await fs.readFile(options.testFile, 'utf-8')
      : generateDefaultTest(options.method);

    const request: Request = {
      id: generateId(),
      name: options.name,
      url: options.url,
      method: options.method,
      test: testCode,
      timeout: 30000,
      headers: [],
      queryStringParams: []
    };

    if (options.parentId) {
      // Add to existing group
      const group = findGroupById(workbook, options.parentId);
      group.children.push(request);
    } else {
      workbook.requests.push(request);
    }

    return workbook;
  }
}
```

---

## Solution 2: YAML Support

### Why YAML is Better for LLMs

```yaml
# YAML - Easy for LLMs
version: 1.0
requests:
  - id: req-001
    name: Get Users
    url: "{{baseUrl}}/users"
    method: GET
    test: |
      describe('Get Users', () => {
        it('should return 200', () => {
          expect(response.status).to.equal(200);
        });
      });
```

vs

```json
// JSON - Error-prone for LLMs
{
  "version": 1.0,
  "requests": [{
    "id": "req-001",
    "name": "Get Users",
    "url": "{{baseUrl}}/users",
    "method": "GET",
    "test": "describe('Get Users', () => {\n  it('should return 200', () => {\n    expect(response.status).to.equal(200);\n  });\n});"
  }]
}
```

### Implementation

```bash
# New CLI commands
apicize convert --from yaml --to json tests.yaml tests.apicize
apicize convert --from json --to yaml tests.apicize tests.yaml

# Direct YAML support
apicize validate tests.yaml
apicize run tests.yaml
apicize export tests.yaml
```

### Code

```typescript
// packages/lib/src/formats/yaml-converter.ts
import yaml from 'js-yaml';

export class YamlConverter {

  toYaml(workbook: ApicizeWorkbook): string {
    return yaml.dump(workbook, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });
  }

  fromYaml(yamlContent: string): ApicizeWorkbook {
    const data = yaml.load(yamlContent);
    // Validate and return
    return data as ApicizeWorkbook;
  }
}
```

---

## Solution 3: Simplified Schema for LLMs

### Create `apicize-minimal.schema.json`

**Purpose**: Subset schema with only commonly-used fields

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Apicize Minimal (LLM-friendly)",
  "type": "object",
  "required": ["version", "requests"],
  "properties": {
    "version": { "const": 1.0 },
    "requests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "url", "method"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "url": { "type": "string" },
          "method": {
            "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]
          },
          "test": { "type": "string" },
          "headers": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "value"],
              "properties": {
                "name": { "type": "string" },
                "value": { "type": "string" }
              }
            }
          },
          "body": {
            "oneOf": [
              { "type": "null" },
              {
                "type": "object",
                "required": ["type"],
                "properties": {
                  "type": { "enum": ["JSON", "Text", "None"] },
                  "data": {}
                }
              }
            ]
          }
        }
      }
    },
    "scenarios": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "variables"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "variables": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "value"],
              "properties": {
                "name": { "type": "string" },
                "value": { "type": "string" },
                "type": { "const": "TEXT" }
              }
            }
          }
        }
      }
    }
  }
}
```

### Usage

```bash
apicize validate --schema minimal workbook.apicize
apicize build init --minimal  # Uses minimal schema
```

---

## Solution 4: Better Error Messages

### Current Error (Bad for LLMs)

```
Invalid .apicize file:
- Missing required property 'type' at /requests/0/body
- Value at /requests/0/method must be one of: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
```

### Improved Error (Good for LLMs)

```
Invalid .apicize file at: /requests/0/body

❌ Error: Missing required field 'type'

Expected structure:
{
  "type": "JSON" | "Text" | "XML" | "Form" | "Raw" | "None",
  "data": <object|string|array>
}

Example (JSON body):
{
  "type": "JSON",
  "data": {
    "username": "admin",
    "password": "pass123"
  }
}

Example (No body):
{
  "type": "None"
}

---

❌ Error: Invalid method at /requests/0/method

Current value: "get" (lowercase)
Allowed values: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS

Fix: Change "get" to "GET"
```

### Implementation

```typescript
// packages/lib/src/validation/llm-friendly-validator.ts
export class LLMFriendlyValidator extends ApicizeValidator {

  formatLLMError(error: ValidationError): string {
    const { path, keyword, params } = error;

    let message = `\n❌ Error at: ${path}\n\n`;

    switch (keyword) {
      case 'required':
        message += this.formatRequiredError(path, params);
        break;
      case 'enum':
        message += this.formatEnumError(path, params);
        break;
      case 'type':
        message += this.formatTypeError(path, params);
        break;
    }

    message += this.getExampleForPath(path);

    return message;
  }

  private formatRequiredError(path: string, params: any): string {
    const field = params.missingProperty;
    return `Missing required field: '${field}'\n\n` +
           `Add this to your JSON:\n` +
           `"${field}": <value>\n`;
  }

  private getExampleForPath(path: string): string {
    if (path.includes('/body')) {
      return `\nExample:\n${JSON.stringify({
        type: "JSON",
        data: { key: "value" }
      }, null, 2)}\n`;
    }
    return '';
  }
}
```

### CLI Usage

```bash
apicize validate --llm-friendly workbook.apicize
```

---

## Solution 5: Template Library

### Pre-built Templates for Common Patterns

```bash
# List available templates
apicize templates list

# Create from template
apicize templates create crud-api \
  --name "User CRUD" \
  --base-url "{{baseUrl}}" \
  --resource users \
  --output user-tests.apicize

# Templates available:
# - crud-api: Full CRUD operations
# - rest-api: GET/POST/PUT/DELETE
# - auth-flow: Login + authenticated requests
# - health-check: Simple health checks
# - error-handling: 404, 401, 500 tests
```

### Template Definition

```yaml
# templates/crud-api.yaml
name: CRUD API Template
description: Complete Create, Read, Update, Delete test suite
parameters:
  - name: resource
    type: string
    description: Resource name (e.g., users, products)
  - name: baseUrl
    type: string
    default: "{{baseUrl}}"

template:
  version: 1.0
  requests:
    - id: "{{resource}}-crud"
      name: "{{resource | capitalize}} CRUD Tests"
      execution: SEQUENTIAL
      children:
        - id: "{{resource}}-create"
          name: "Create {{resource | singular}}"
          url: "{{baseUrl}}/{{resource}}"
          method: POST
          body:
            type: JSON
            data:
              name: "Test {{resource | singular}}"
          test: |
            describe('Create {{resource | singular}}', () => {
              it('should return 201', () => {
                expect(response.status).to.equal(201);
                const JSON_body = (response.body.type == BodyType.JSON)
                  ? response.body.data
                  : expect.fail('Not JSON');
                output('{{resource}}Id', JSON_body.id);
              });
            });
```

---

## Solution 6: LLM-Specific CLI Mode

### Interactive Mode for LLMs

```bash
# Start interactive session
apicize llm-mode

# LLM sends commands via stdin/stdout
> init "API Tests"
✓ Created workbook with ID: wb-001

> add-request --name "Get Users" --url "{{baseUrl}}/users" --method GET
✓ Added request with ID: req-001

> add-test req-001 <<EOF
describe('Get Users', () => {
  it('should return 200', () => {
    expect(response.status).to.equal(200);
  });
});
EOF
✓ Test code added

> validate
✓ All checks passed

> save workbook.apicize
✓ Saved to workbook.apicize
```

### JSON-RPC Interface

```bash
# LLM sends JSON-RPC requests
echo '{"jsonrpc":"2.0","method":"init","params":{"name":"API Tests"},"id":1}' | apicize llm-rpc

# Response:
{
  "jsonrpc": "2.0",
  "result": {
    "workbookId": "wb-001",
    "version": 1.0
  },
  "id": 1
}
```

---

## Solution 7: Auto-Fix Common Errors

### Smart Validation with Fixes

```bash
apicize validate --auto-fix workbook.apicize
```

**Fixes applied**:
- ✓ Fixed lowercase HTTP methods (get → GET)
- ✓ Added missing IDs (generated UUIDs)
- ✓ Fixed body type (null → {type: "None"})
- ✓ Added default timeout (30000ms)
- ⚠ Warning: Test code is empty in 2 requests

**Saved to**: workbook-fixed.apicize

### Implementation

```typescript
export class AutoFixer {

  fix(workbook: ApicizeWorkbook): {
    fixed: ApicizeWorkbook;
    changes: string[];
  } {
    const changes: string[] = [];
    const fixed = deepClone(workbook);

    // Fix 1: HTTP methods to uppercase
    this.visitRequests(fixed, (req) => {
      if (req.method && req.method !== req.method.toUpperCase()) {
        changes.push(`Fixed method: ${req.method} → ${req.method.toUpperCase()}`);
        req.method = req.method.toUpperCase() as HttpMethod;
      }
    });

    // Fix 2: Add missing IDs
    this.visitRequests(fixed, (req) => {
      if (!req.id) {
        req.id = this.generateId();
        changes.push(`Added missing ID for: ${req.name}`);
      }
    });

    // Fix 3: Normalize body
    this.visitRequests(fixed, (req) => {
      if (req.body === null || req.body === undefined) {
        req.body = { type: BodyType.None };
        changes.push(`Fixed null body for: ${req.name}`);
      }
    });

    return { fixed, changes };
  }
}
```

---

## Solution 8: Examples Generator

### Generate Examples from Schema

```bash
# Generate minimal example
apicize examples minimal > minimal.apicize

# Generate comprehensive example
apicize examples full > full.apicize

# Generate specific pattern
apicize examples auth-oauth2 > oauth-example.apicize
```

### Output (minimal.apicize)

```json
{
  "version": 1.0,
  "requests": [
    {
      "id": "example-req",
      "name": "Example Request",
      "url": "https://api.example.com/endpoint",
      "method": "GET",
      "test": "describe('Example', () => {\n  it('should work', () => {\n    expect(response.status).to.equal(200);\n  });\n});"
    }
  ]
}
```

---

## Solution 9: Diff and Merge Support

### Help LLMs Update Existing Files

```bash
# Show what would change
apicize diff original.apicize modified.apicize

# Merge changes
apicize merge base.apicize updates.apicize --output merged.apicize

# Patch specific changes
apicize patch workbook.apicize <<EOF
{
  "op": "add",
  "path": "/requests/0/headers/-",
  "value": {"name": "X-API-Key", "value": "{{apiKey}}"}
}
EOF
```

---

## Solution 10: LLM Documentation

### Create `LLM-GUIDE.md`

Specifically written for LLM consumption:

**Structure**:
1. Step-by-step instructions
2. Complete minimal examples
3. Common error patterns with fixes
4. JSON templates to copy
5. Validation checklist

**Example Section**:

```markdown
## For LLMs: Creating a Simple GET Request

### Step 1: Minimal Structure
Copy this exact structure and modify:

{
  "version": 1.0,
  "requests": [
    {
      "id": "GENERATE_UNIQUE_ID_HERE",
      "name": "YOUR_REQUEST_NAME",
      "url": "YOUR_URL",
      "method": "GET"
    }
  ]
}

### Step 2: Add Test Code
Add a "test" field with this pattern:

"test": "describe('YOUR_TEST_NAME', () => {\n  it('should return 200', () => {\n    expect(response.status).to.equal(200);\n  });\n});"

### Common Mistakes:
❌ "method": "get" (lowercase) → Use "GET"
❌ Missing "id" field → Always required
❌ Unescaped quotes in test → Use \n for newlines, \" for quotes
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)
1. ✅ Better error messages (`--llm-friendly` flag)
2. ✅ Auto-fix command
3. ✅ Examples generator
4. ✅ LLM documentation

### Phase 2: Medium Effort (2-3 weeks)
5. ✅ Minimal schema
6. ✅ Template library
7. ✅ Build command (incremental)

### Phase 3: Advanced (3-4 weeks)
8. ✅ YAML support
9. ✅ LLM mode (interactive)
10. ✅ JSON-RPC interface

---

## Expected Impact

### Current State
- LLM success rate: ~30%
- Average attempts: 3-5
- Common failures: String escaping, schema errors

### After Phase 1
- LLM success rate: ~70%
- Average attempts: 1-2
- Better error recovery

### After Phase 3
- LLM success rate: ~95%
- Average attempts: 1
- Near-perfect generation

---

## Migration Path

All improvements are **backward compatible**:
- Existing `.apicize` files still work
- New features are opt-in
- Old CLI commands unchanged
- New commands have `--llm-*` flags

---

## Next Steps

1. Gather user feedback on which solutions are most valuable
2. Create detailed implementation specs for Phase 1
3. Set up testing with actual LLMs (GPT-4, Claude, etc.)
4. Build metrics to track improvement

---

**Document Version**: 1.0
**Last Updated**: 2025-10-08
**Status**: Proposal - Ready for Review
