# exported-minimal

API Test Suite generated from .apicize workbook

## Setup

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run with specific environment
npm run test:env staging

# Run with specific scenario
npm run test:scenario smoke-test

# Watch mode
npm run test:watch

# Debug mode
npm run test:debug
```

## Configuration

- Environment settings: `config/environments/`
- Authentication: `config/auth/`
- Test scenarios: `config/scenarios/`
- Base URLs: `config/endpoints/`

## Project Structure

- `lib/` - Shared library code
- `config/` - Configuration files
- `tests/` - Generated test files
- `data/` - Test data files
- `scripts/` - Utility scripts
- `reports/` - Test reports

## Environment Variables

Copy `.env.example` to `.env` and configure your settings.

## Import/Export

```bash
# Export back to .apicize
npm run import

# Validate structure
npm run validate
```
