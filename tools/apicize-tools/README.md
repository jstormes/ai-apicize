# Apicize Tools

Tools for converting .apicize files to/from TypeScript Mocha/Chai tests.

## Overview

This monorepo contains tools to work with `.apicize` files - JSON-based API testing files that contain embedded Mocha/Chai TypeScript tests. The tools enable:

- **Export**: Convert .apicize files to executable TypeScript/Mocha/Chai test files
- **Import**: Convert TypeScript test files back to .apicize format
- **Create**: Generate new .apicize files from scratch
- **Execute**: Run the exported TypeScript tests directly with Mocha

## Packages

- **@apicize/lib**: Core library with types, validation, and utilities
- **@apicize/tools**: CLI tools for export/import operations
- **@apicize/examples**: Example .apicize files for testing

## Development Status

This project is currently in Phase 1 Step 1.1 - Project Setup and Monorepo Structure.

## Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Verify everything works
npm run verify
```

## Development

This is a monorepo using npm workspaces. Each package can be developed independently:

```bash
# Work on the lib package
cd packages/lib
npm run dev

# Work on the tools package
cd packages/tools
npm run dev
```

## License

MIT