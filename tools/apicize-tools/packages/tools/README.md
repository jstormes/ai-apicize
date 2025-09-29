# @apicize/tools

[![npm version](https://badge.fury.io/js/%40apicize%2Ftools.svg)](https://badge.fury.io/js/%40apicize%2Ftools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@apicize/tools.svg)](https://nodejs.org)
[![npm downloads](https://img.shields.io/npm/dm/@apicize/tools.svg)](https://www.npmjs.com/package/@apicize/tools)

CLI tools for working with `.apicize` API test files - seamlessly convert between `.apicize` format and executable TypeScript/Mocha/Chai tests.

## 🚀 Quick Start

### Installation

```bash
# Install globally via npm
npm install -g @apicize/tools

# Or use with npx without installation
npx @apicize/tools export myfile.apicize
```

### Basic Usage

```bash
# Export .apicize to TypeScript tests
apicize export demo.apicize --output ./tests

# Import TypeScript tests back to .apicize
apicize import ./tests/demo --output demo-updated.apicize

# Validate .apicize file structure
apicize validate demo.apicize

# Create new .apicize file from template
apicize create new-api-test --template rest-crud

# Run tests directly
apicize run demo.apicize --scenario production
```

## 📖 Features

- **Bidirectional Conversion**: Export `.apicize` files to TypeScript and import back with 100% data fidelity
- **Test Execution**: Run API tests directly from `.apicize` files
- **Multiple Scenarios**: Support for different test environments (dev, staging, production)
- **Data-Driven Testing**: CSV and JSON data file support for bulk testing
- **Authentication**: Built-in support for Basic, OAuth2, API Key authentication
- **TypeScript Support**: Fully typed with TypeScript declarations
- **CI/CD Ready**: Easy integration with CI/CD pipelines
- **Large File Support**: Efficiently handle files with 1000+ requests

## 🛠️ Commands

### `export` - Convert .apicize to TypeScript

```bash
apicize export <file.apicize> [options]

Options:
  -o, --output <dir>     Output directory (default: "./tests")
  -s, --scenario <name>  Use specific scenario
  --split                Split into multiple files
  --force                Overwrite existing files
```

### `import` - Convert TypeScript to .apicize

```bash
apicize import <test-folder> [options]

Options:
  -o, --output <file>    Output .apicize file
  --merge                Merge with existing file
```

### `validate` - Validate .apicize Files

```bash
apicize validate <files...> [options]

Options:
  --strict               Enable strict validation
  --fix                  Auto-fix common issues
```

### `create` - Generate New .apicize Files

```bash
apicize create <name> [options]

Options:
  -t, --template <type>  Use template (rest-crud, graphql, websocket)
  --interactive          Interactive mode
```

### `run` - Execute Tests

```bash
apicize run <file.apicize> [options]

Options:
  -s, --scenario <name>  Use specific scenario
  --reporter <type>      Test reporter (spec, json, tap)
  --timeout <ms>         Request timeout
```

## 📁 Generated Test Structure

When you export a `.apicize` file, the tool generates a complete TypeScript test project:

```
tests/
├── [workbook-name]/
│   ├── index.spec.ts         # Main test suite
│   ├── suites/              # Test groups
│   │   ├── auth.spec.ts
│   │   └── crud.spec.ts
│   └── metadata/            # Preserved metadata for reimport
│       └── workbook.json
├── package.json             # Dependencies
├── tsconfig.json           # TypeScript config
└── .mocharc.json          # Mocha configuration
```

## 🔧 Configuration

Create an `apicize.config.json` file in your project root:

```json
{
  "export": {
    "splitByGroup": true,
    "includeMetadata": true,
    "generateHelpers": true
  },
  "import": {
    "preserveComments": true,
    "validateOnImport": true
  },
  "defaults": {
    "timeout": 30000,
    "scenario": "development"
  }
}
```

## 🤝 Integration

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Install Apicize Tools
  run: npm install -g @apicize/tools

- name: Validate API tests
  run: apicize validate **/*.apicize

- name: Run API tests
  run: apicize run tests/*.apicize --scenario production --reporter json
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:api": "apicize run tests/*.apicize",
    "test:validate": "apicize validate **/*.apicize",
    "test:export": "apicize export tests/*.apicize --output ./generated"
  }
}
```

## 📚 Documentation

- [CLI Guide](https://github.com/apicize/tools/blob/main/docs/CLI-Guide.md)
- [API Reference](https://github.com/apicize/tools/blob/main/docs/API-Reference.md)
- [Examples](https://github.com/apicize/tools/blob/main/docs/Examples.md)
- [Troubleshooting](https://github.com/apicize/tools/blob/main/docs/Troubleshooting.md)

## 🧪 Testing

The generated TypeScript tests use Mocha and Chai:

```typescript
describe('API Tests', () => {
    it('should return successful response', () => {
        expect(response.status).to.equal(200);

        const data = (response.body.type === BodyType.JSON)
            ? response.body.data
            : expect.fail('Response not JSON');

        expect(data.id).to.exist;
        output('savedId', data.id); // Pass to next test
    });
});
```

## 🔑 Authentication

Configure authentication in your `.apicize` files:

```json
{
  "authorizations": [{
    "id": "api-auth",
    "type": "OAuth2Client",
    "accessTokenUrl": "{{authUrl}}/token",
    "clientId": "{{clientId}}",
    "clientSecret": "{{clientSecret}}"
  }]
}
```

## 📊 Performance

- Handles 1000+ request files efficiently
- Validation: ~20 requests/second
- Export: ~10 requests/second
- Round-trip accuracy: >95%
- Memory efficient with streaming support

## 🐛 Troubleshooting

### Common Issues

1. **Command not found**: Ensure global installation with `npm install -g @apicize/tools`
2. **TypeScript errors**: Check Node.js version (>=16.0.0 required)
3. **Import failures**: Ensure metadata comments are preserved in TypeScript files

For more help, see our [Troubleshooting Guide](https://github.com/apicize/tools/blob/main/docs/Troubleshooting.md).

## 📄 License

MIT © Apicize Tools

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](https://github.com/apicize/tools/blob/main/CONTRIBUTING.md) for details.

## 🔗 Links

- [GitHub Repository](https://github.com/apicize/tools)
- [npm Package](https://www.npmjs.com/package/@apicize/tools)
- [Issue Tracker](https://github.com/apicize/tools/issues)
- [Changelog](https://github.com/apicize/tools/blob/main/CHANGELOG.md)

---

Built with ❤️ by the Apicize Team