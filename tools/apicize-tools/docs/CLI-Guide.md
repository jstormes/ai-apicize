# Apicize CLI Guide

The Apicize CLI provides powerful tools for working with .apicize API test files, enabling seamless conversion between .apicize format and executable TypeScript Mocha/Chai tests.

## Table of Contents

- [Installation](#installation)
- [Global Options](#global-options)
- [Commands](#commands)
  - [export](#export)
  - [import](#import)
  - [validate](#validate)
  - [create](#create)
  - [run](#run)
- [Workflows](#workflows)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

### Global Installation (Recommended)

```bash
npm install -g @apicize/tools
```

After global installation, the `apicize` command will be available anywhere:

```bash
apicize --help
apicize --version
```

### Using npx (No Installation)

```bash
npx @apicize/tools export myfile.apicize
npx @apicize/tools --help
```

### Local Development

```bash
git clone https://github.com/apicize/tools.git
cd tools/apicize-tools
npm install
npm run build
npm run dev export demo.apicize
```

## Global Options

These options work with all commands:

- `--verbose, -v`: Enable detailed output for debugging
- `--no-color`: Disable colored output
- `--help, -h`: Show help information
- `--version`: Show version number

```bash
# Enable verbose output
apicize export demo.apicize --verbose

# Disable colors for CI/scripts
apicize validate *.apicize --no-color
```

## Commands

### export

Convert .apicize files to executable TypeScript Mocha/Chai test projects.

```bash
apicize export <file> [options]
```

**Arguments:**
- `file`: Path to .apicize file to export

**Options:**
- `-o, --output <directory>`: Output directory (default: ./tests)
- `-s, --scenario <name>`: Specific scenario to use for export
- `--split`: Split large request groups into separate files
- `--overwrite`: Overwrite existing output directory

**Examples:**

```bash
# Basic export
apicize export demo.apicize

# Export to specific directory
apicize export demo.apicize --output ./my-tests

# Export with specific scenario
apicize export demo.apicize --scenario Production

# Export with file splitting for large projects
apicize export large-api.apicize --split --overwrite
```

**Generated Structure:**

```
tests/
├── package.json          # Node.js project configuration
├── tsconfig.json         # TypeScript configuration
├── .mocharc.json         # Mocha test configuration
├── lib/                  # Apicize runtime library
│   ├── runtime/
│   ├── testing/
│   └── index.ts
├── tests/
│   └── [workbook-name]/
│       ├── index.spec.ts
│       └── suites/
└── metadata/             # Original .apicize data for reimport
```

### import

Convert TypeScript test projects back to .apicize format.

```bash
apicize import <directory> [options]
```

**Arguments:**
- `directory`: Path to TypeScript test project

**Options:**
- `-o, --output <file>`: Output .apicize file (default: imported.apicize)
- `--no-validate`: Skip validation of imported data

**Examples:**

```bash
# Basic import
apicize import ./tests

# Import to specific file
apicize import ./tests --output updated-api.apicize

# Import without validation (faster)
apicize import ./tests --no-validate
```

**Round-Trip Accuracy:**

The import process provides statistics on how accurately the original data was preserved:

```
✓ Import completed successfully
ℹ Round-trip accuracy: 98.5%
ℹ Preserved: 234/238 properties
⚠ Minor differences in formatting detected
```

### validate

Validate .apicize files against the JSON schema.

```bash
apicize validate <files...> [options]
```

**Arguments:**
- `files`: One or more .apicize files (supports glob patterns)

**Options:**
- `--format <type>`: Output format (text|json) (default: text)
- `--strict`: Enable strict validation mode

**Examples:**

```bash
# Validate single file
apicize validate demo.apicize

# Validate multiple files
apicize validate *.apicize

# Validate with JSON output
apicize validate demo.apicize --format json

# Strict validation
apicize validate demo.apicize --strict
```

**Output:**

```
✓ demo.apicize - Valid
✓ simple-rest-api.apicize - Valid
✗ broken.apicize - 3 errors
  • Missing required property: version
  • Invalid value for requests[0].method
  • Malformed JSON syntax

📊 Validation Summary:
Valid files: 2/3 (67%)
Invalid files: 1/3 (33%)
```

### create

Generate new .apicize files from templates.

```bash
apicize create <name> [options]
```

**Arguments:**
- `name`: Name for the new API test collection

**Options:**
- `-t, --template <type>`: Template type (basic|rest-crud|graphql) (default: basic)
- `-o, --output <file>`: Output file (default: <name>.apicize)
- `--overwrite`: Overwrite existing file
- `-i, --interactive`: Interactive mode with prompts

**Templates:**

1. **basic**: Simple GET/POST requests with basic tests
2. **rest-crud**: Complete CRUD operations (Create, Read, Update, Delete)
3. **graphql**: GraphQL query and mutation examples

**Examples:**

```bash
# Create basic API test
apicize create my-api

# Create CRUD API test suite
apicize create user-api --template rest-crud

# Interactive creation
apicize create complex-api --interactive

# Overwrite existing file
apicize create my-api --overwrite
```

**Interactive Mode:**

```bash
$ apicize create my-api --interactive

ℹ Interactive mode - please answer the following questions:

? Description of this API test collection: › User Management API
? Base URL for API endpoints: › https://api.mycompany.com
? Add authentication configuration? › Yes
? Authentication type: › API Key
? Add environment scenarios (dev, staging, production)? › Yes

✓ Created "my-api.apicize" using basic template
```

### run

Execute .apicize file tests directly without exporting first.

```bash
apicize run <file> [options]
```

**Arguments:**
- `file`: Path to .apicize file to execute

**Options:**
- `-s, --scenario <name>`: Scenario to use for execution
- `-r, --reporter <type>`: Test reporter (spec|json|tap) (default: spec)
- `-t, --timeout <ms>`: Test timeout in milliseconds (default: 30000)
- `-o, --output <file>`: Save test results to file
- `--no-cleanup`: Keep generated test files after execution

**Examples:**

```bash
# Run tests with default settings
apicize run demo.apicize

# Run with specific scenario
apicize run demo.apicize --scenario Production

# Run with JSON reporter and save results
apicize run demo.apicize --reporter json --output results.json

# Run with longer timeout
apicize run slow-api.apicize --timeout 60000

# Debug mode - keep generated files
apicize run demo.apicize --no-cleanup --verbose
```

**Output:**

```
✓ Test execution completed

Tests run: 5
Passed: 4
Failed: 1
Duration: 2.3s
Scenario: Development

Test Output:
  User API Tests
    ✓ Get Users - should return 200 status
    ✓ Get Users - should return JSON response
    ✓ Create User - should return 201 status
    ✗ Create User - should return created user
    ✓ Delete User - should return 204 status

Results saved to: results.json
```

## Workflows

### Complete Export-Test-Import Workflow

```bash
# 1. Start with .apicize file
apicize validate demo.apicize

# 2. Export to TypeScript
apicize export demo.apicize --output ./my-tests

# 3. Run the exported tests
cd my-tests
npm test

# 4. Modify tests as needed
# Edit test files in tests/ directory

# 5. Import back to .apicize
cd ..
apicize import ./my-tests --output updated-demo.apicize

# 6. Validate the result
apicize validate updated-demo.apicize
```

### CI/CD Integration

```yaml
# .github/workflows/api-tests.yml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Apicize CLI
        run: npm install -g @apicize/tools

      - name: Validate API specs
        run: apicize validate *.apicize --no-color

      - name: Export and run tests
        run: |
          apicize export api-tests.apicize --scenario Production
          cd tests
          npm test
```

### Development Workflow

```bash
# Create new API test collection
apicize create user-management --template rest-crud --interactive

# Develop and test
apicize run user-management.apicize --scenario Development

# Export for advanced testing
apicize export user-management.apicize

# Import changes back
apicize import ./tests --output user-management-updated.apicize
```

## Examples

### Basic Usage

```bash
# Get help
apicize --help
apicize export --help

# Validate files
apicize validate *.apicize

# Quick test execution
apicize run api-test.apicize --scenario staging
```

### Advanced Scenarios

```bash
# Export with custom scenario and splitting
apicize export complex-api.apicize \
  --scenario Production \
  --split \
  --output ./production-tests

# Run tests with custom timeout and reporter
apicize run integration-tests.apicize \
  --timeout 120000 \
  --reporter json \
  --output integration-results.json

# Create and validate new API test
apicize create payments-api --template rest-crud
apicize validate payments-api.apicize --strict
```

### Batch Operations

```bash
# Validate all .apicize files in directory
find . -name "*.apicize" -exec apicize validate {} \;

# Export multiple files
for file in *.apicize; do
  apicize export "$file" --output "./tests/$(basename "$file" .apicize)"
done
```

## Troubleshooting

### Common Issues

**1. Command not found**
```bash
# Solution: Install globally or use npx
npm install -g @apicize/tools
# or
npx @apicize/tools --help
```

**2. Export fails with validation errors**
```bash
# Solution: Validate first to see specific errors
apicize validate myfile.apicize --strict
```

**3. Import accuracy is low**
```bash
# Solution: Check that metadata is preserved in exported files
apicize export myfile.apicize --verbose
# Look for metadata comments in generated .spec.ts files
```

**4. Run command fails**
```bash
# Solution: Check test file structure and dependencies
apicize run myfile.apicize --no-cleanup --verbose
# Check generated files in temporary directory
```

### Debugging

Enable verbose output for detailed information:

```bash
apicize export demo.apicize --verbose
```

This will show:
- File parsing details
- Template generation steps
- Metadata preservation info
- Performance timings

### Getting Help

- Use `--help` with any command for detailed options
- Check the API documentation for library usage
- Review example files in the examples directory
- Enable `--verbose` for debugging information

### Performance Tips

1. **Use specific scenarios** instead of exporting all scenarios
2. **Use `--split` option** for large .apicize files
3. **Skip validation** during import if you trust the data
4. **Use appropriate timeouts** for slow APIs

```bash
# Optimized for performance
apicize export large-api.apicize --scenario Production --split
apicize import ./tests --no-validate
```

## Version Information

Check your Apicize CLI version:

```bash
apicize --version
```

For the latest features and bug fixes, keep your installation updated:

```bash
npm update -g @apicize/tools
```

---

For more information, see the [API Reference](./API-Reference.md) and [Examples](./Examples.md) documentation.