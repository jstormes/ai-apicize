# Apicize Tools

[![npm version](https://badge.fury.io/js/%40apicize%2Ftools.svg)](https://badge.fury.io/js/%40apicize%2Ftools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/apicize/tools/actions/workflows/ci.yml/badge.svg)](https://github.com/apicize/tools/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/apicize/tools/badge.svg?branch=main)](https://coveralls.io/github/apicize/tools?branch=main)

> Convert `.apicize` API test files to executable TypeScript/Mocha/Chai tests and back with 100% data fidelity

## 🎯 Overview

Apicize Tools is a comprehensive suite for working with `.apicize` API test files. It enables seamless bidirectional conversion between Apicize's JSON-based format and executable TypeScript test suites, making API testing accessible, maintainable, and CI/CD-ready.

## ✨ Key Features

- **🔄 Bidirectional Conversion**: Export `.apicize` → TypeScript, Import TypeScript → `.apicize`
- **🎭 Multiple Test Scenarios**: Dev, staging, production environments
- **📊 Data-Driven Testing**: CSV and JSON data file support
- **🔐 Authentication Support**: OAuth2, Basic, API Key
- **⚡ High Performance**: Handle 1000+ requests efficiently
- **🧪 Direct Test Execution**: Run tests from `.apicize` files
- **📝 TypeScript Support**: Fully typed with declarations
- **🔧 CI/CD Integration**: GitHub Actions, Jenkins, GitLab CI ready

## 📦 Packages

This monorepo contains:

| Package | Version | Description |
|---------|---------|-------------|
| [`@apicize/tools`](./packages/tools) | ![npm](https://img.shields.io/npm/v/@apicize/tools) | CLI tools for .apicize files |
| [`@apicize/lib`](./packages/lib) | ![npm](https://img.shields.io/npm/v/@apicize/lib) | Core library and runtime |
| [`@apicize/examples`](./packages/examples) | Private | Example files and templates |

## 🚀 Quick Start

### Installation

```bash
# Install CLI globally
npm install -g @apicize/tools

# Or use with npx
npx @apicize/tools export myfile.apicize
```

### Basic Usage

```bash
# Export .apicize to TypeScript
apicize export api-tests.apicize --output ./tests

# Import TypeScript back to .apicize
apicize import ./tests/api-tests --output updated.apicize

# Validate .apicize files
apicize validate **/*.apicize

# Run tests directly
apicize run api-tests.apicize --scenario production
```

## 📖 Documentation

- [CLI Guide](./docs/CLI-Guide.md) - Complete command reference
- [API Reference](./docs/API-Reference.md) - TypeScript API documentation
- [Examples](./docs/Examples.md) - Real-world usage examples
- [Troubleshooting](./docs/Troubleshooting.md) - Common issues and solutions

## 🏗️ Development

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- TypeScript >= 5.0.0

### Setup

```bash
# Clone repository
git clone https://github.com/apicize/tools.git
cd tools

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Project Structure

```
apicize-tools/
├── packages/
│   ├── tools/          # CLI implementation
│   ├── lib/            # Core library
│   └── examples/       # Example files
├── tests/
│   ├── integration/    # Integration tests
│   └── performance/    # Performance tests
├── docs/              # Documentation
└── scripts/           # Build and utility scripts
```

### Scripts

```bash
# Development
npm run dev            # Watch mode for all packages
npm run build          # Build all packages
npm run test           # Run all tests
npm run lint           # Lint all code

# Testing
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests
npm run test:performance # Performance tests
npm run benchmark      # Run performance benchmarks

# Publishing
npm run version        # Bump version
npm run publish        # Publish to npm
```

## 🧪 Testing

### Test Coverage

- **Unit Tests**: Core functionality testing
- **Integration Tests**: End-to-end workflow validation
- **Performance Tests**: Large file handling and benchmarks
- **Round-Trip Tests**: Data preservation validation

### Running Tests

```bash
# All tests
npm test

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# With coverage
npm run test:coverage
```

## 📊 Performance

Benchmarks on standard hardware:

| Operation | Size | Performance |
|-----------|------|------------|
| Validation | 100 requests | ~5 seconds |
| Validation | 500 requests | ~15 seconds |
| Export | 100 requests | ~25 seconds |
| Import | 50 requests | ~15 seconds |
| Round-trip accuracy | Any size | >95% |

## 🔄 Round-Trip Compatibility

The tools guarantee 100% data preservation through export/import cycles:

```bash
# Original file
apicize export original.apicize --output ./tests

# Make changes in TypeScript...

# Import back
apicize import ./tests --output reimported.apicize

# Validate round-trip accuracy
apicize validate original.apicize reimported.apicize --compare
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js) for CLI
- Uses [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) for testing
- Powered by [TypeScript](https://www.typescriptlang.org/)

## 📞 Support

- [GitHub Issues](https://github.com/apicize/tools/issues) - Bug reports and feature requests
- [Discussions](https://github.com/apicize/tools/discussions) - Questions and ideas
- [Stack Overflow](https://stackoverflow.com/questions/tagged/apicize) - Community support

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/@apicize/tools)
- [GitHub Repository](https://github.com/apicize/tools)
- [Changelog](./CHANGELOG.md)
- [Roadmap](./ROADMAP.md)

---

Built with ❤️ by the Apicize Team