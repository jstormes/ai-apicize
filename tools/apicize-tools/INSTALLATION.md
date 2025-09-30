# Installation Guide

## For End Users

### Global Installation (Recommended)

Install the Apicize CLI tools globally to use the `apicize` command from anywhere:

```bash
npm install -g @jstormes/apicize-tools
```

After installation, verify it works:

```bash
apicize --version
apicize --help
```

### Using npx (No Installation Required)

You can run Apicize tools without installing them globally:

```bash
npx @jstormes/apicize-tools export myfile.apicize
npx @jstormes/apicize-tools import ./tests
npx @jstormes/apicize-tools validate *.apicize
```

This is useful for:
- Trying out the tools before installing
- CI/CD pipelines
- One-off usage scenarios

### Project-Specific Installation

To use the library in your project:

```bash
npm install @jstormes/apicize-lib
```

Then import in your TypeScript/JavaScript code:

```typescript
import { ApicizeWorkbook, BodyType } from '@jstormes/apicize-lib';
```

## Available Commands

Once installed globally, you can use these commands:

```bash
# Export .apicize to TypeScript
apicize export myfile.apicize --output ./tests

# Import TypeScript back to .apicize
apicize import ./tests --output updated.apicize

# Validate .apicize files
apicize validate myfile.apicize
apicize validate **/*.apicize

# Create new .apicize file
apicize create new-test --template rest-crud

# Run tests directly
apicize run myfile.apicize --scenario production
```

## System Requirements

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0

Check your versions:

```bash
node --version
npm --version
```

## Updating

To update to the latest version:

```bash
npm update -g @jstormes/apicize-tools
```

## Uninstalling

To remove the global installation:

```bash
npm uninstall -g @jstormes/apicize-tools
```

## Troubleshooting

### Command not found

If you get `apicize: command not found` after installation:

1. Check if npm global bin directory is in your PATH:
   ```bash
   npm config get prefix
   ```

2. Add npm global bin to your PATH:
   - **Linux/Mac**: Add to `~/.bashrc` or `~/.zshrc`:
     ```bash
     export PATH="$(npm config get prefix)/bin:$PATH"
     ```
   - **Windows**: npm usually handles this automatically

### Permission Errors

If you get permission errors during global installation:

**Option 1 - Use a version manager (Recommended)**:
- Use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager)
- Use [fnm](https://github.com/Schniz/fnm) (Fast Node Manager)

**Option 2 - Fix npm permissions**:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
source ~/.profile
```

**Option 3 - Use npx instead**:
```bash
npx @jstormes/apicize-tools [command]
```

### Version Conflicts

If you have an older version installed:

```bash
npm uninstall -g @apicize/tools  # Remove old namespace
npm install -g @jstormes/apicize-tools  # Install new namespace
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install Apicize Tools
  run: npm install -g @jstormes/apicize-tools

- name: Validate API tests
  run: apicize validate **/*.apicize

- name: Run API tests
  run: apicize run tests/*.apicize --scenario production
```

### GitLab CI

```yaml
test:
  image: node:16
  script:
    - npm install -g @jstormes/apicize-tools
    - apicize validate **/*.apicize
    - apicize run tests/*.apicize
```

### Jenkins

```groovy
stage('API Tests') {
    steps {
        sh 'npm install -g @jstormes/apicize-tools'
        sh 'apicize validate **/*.apicize'
        sh 'apicize run tests/*.apicize --scenario staging'
    }
}
```

### Docker

```dockerfile
FROM node:16-alpine

# Install Apicize Tools globally
RUN npm install -g @jstormes/apicize-tools

# Your application code
COPY . /app
WORKDIR /app

# Run tests
CMD ["apicize", "run", "tests/api-tests.apicize"]
```

## Getting Help

```bash
# General help
apicize --help

# Command-specific help
apicize export --help
apicize import --help
apicize validate --help
apicize create --help
apicize run --help
```

## Links

- [npm Package](https://www.npmjs.com/package/@jstormes/apicize-tools)
- [CLI Guide](./docs/CLI-Guide.md)
- [API Reference](./docs/API-Reference.md)
- [Examples](./docs/Examples.md)
- [GitHub Repository](https://github.com/apicize/tools)

---

**Note**: The package is published under the `@jstormes` namespace. The previous `@apicize` namespace is no longer maintained.
