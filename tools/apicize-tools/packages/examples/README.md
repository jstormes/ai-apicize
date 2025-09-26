# Apicize Examples

This directory contains example .apicize files for testing and development purposes, copied from the main Apicize project and supplemented with additional synthetic examples.

## Directory Structure

### workbooks/
Contains complete .apicize workbook files for testing various scenarios:

- **demo.apicize**: The official demo file from the Apicize application
- **minimal.apicize**: Minimal valid .apicize file (version only)
- **simple-rest-api.apicize**: Basic REST API testing with GET and POST requests
- **with-authentication.apicize**: Examples of different authentication methods
- **request-groups.apicize**: Demonstrates hierarchical request organization

### data/
External data files referenced by .apicize workbooks:

- **demo-test.json**: JSON data file from the original demo
- **demo-test.csv**: CSV data file from the original demo
- **users.json**: Sample user data for testing
- **test-scenarios.csv**: Environment configuration scenarios

### test-cases/
Validation test files including both valid and invalid examples:

- **valid-all-body-types.apicize**: Demonstrates all supported request body types
- **invalid-missing-version.apicize**: Missing required version field (for validation testing)
- **invalid-wrong-method.apicize**: Invalid HTTP method (for validation testing)

## Usage

These files are used throughout development to:

1. **Test validation functionality** - ensuring schemas catch errors correctly
2. **Test export/import operations** - verifying round-trip data integrity
3. **Test CLI tools** - providing realistic data for command testing
4. **Development reference** - examples of different .apicize features

## File Sources

- **Original files**: Copied from `/app/app/src-tauri/help/demo/` in the main Apicize project
- **Synthetic files**: Created specifically for testing edge cases and validation scenarios

These examples provide comprehensive coverage of the .apicize format features for thorough testing of the tools.