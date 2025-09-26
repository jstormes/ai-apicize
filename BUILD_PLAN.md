# Apicize Tools Development Plan

## Overview
This plan outlines the step-by-step development of the Apicize toolset for converting .apicize files to/from TypeScript Mocha/Chai tests. Each step is designed to be small, testable, and have clear success criteria.

## Project Structure
```
apicize-tools/
├── packages/
│   ├── lib/                 # @apicize/lib - Core library
│   ├── tools/              # @apicize/tools - CLI tools
│   └── examples/           # Example .apicize files for testing
├── docs/                   # Documentation
└── tests/                  # Integration tests
```

---

## Phase 1: Core Foundation

### Step 1.1: Project Setup and Monorepo Structure
**Goal**: Create the basic project structure with TypeScript and build tools.

**Tasks**:
1. Initialize monorepo with Lerna/Rush or npm workspaces
2. Create package.json for root project
3. Set up TypeScript configuration
4. Configure ESLint and Prettier
5. Set up Jest for testing
6. Create initial folder structure

**Success Criteria**:
- [ ] `npm install` runs without errors
- [ ] `npm run build` compiles TypeScript successfully
- [ ] `npm run test` runs (even with no tests yet)
- [ ] `npm run lint` passes
- [ ] All packages properly reference each other

**Test Command**: `npm run verify` (runs build, test, lint)

---

### Step 1.2: Core Type Definitions
**Goal**: Define TypeScript interfaces matching the .apicize file format.

**Tasks**:
1. Create interfaces for all .apicize structures:
   - `ApicizeWorkbook`
   - `Request` and `RequestGroup`
   - `Scenario`, `Authorization`, `ExternalData`
   - `BodyType` enum and body interfaces
2. Create response and execution context types
3. Export all types from `@apicize/lib`

**Success Criteria**:
- [ ] All interfaces match the documented .apicize format
- [ ] TypeScript compilation passes with strict mode
- [ ] Types can be imported: `import { ApicizeWorkbook } from '@apicize/lib'`
- [ ] No `any` types used

**Test Command**: `npm run test:types` (type-only tests)

---

### Step 1.3: JSON Schema Validation
**Goal**: Create JSON schema for .apicize files and validation functions.

**Tasks**:
1. Create JSON schema files for .apicize format
2. Implement validation functions using AJV
3. Create detailed error reporting for invalid files
4. Add schema validation tests

**Success Criteria**:
- [ ] Valid .apicize files pass validation
- [ ] Invalid files fail with specific error messages
- [ ] Schema covers all required and optional fields
- [ ] Validation function exports: `validateApicizeFile(data)`

**Test Command**: `npm run test:validation`
**Test Data**: Use `app/app/src-tauri/help/demo/demo.apicize`

---

## Phase 2: Core Library Components

### Step 2.1: Configuration Manager
**Goal**: Implement configuration loading and management system.

**Tasks**:
1. Create `ConfigManager` class
2. Implement environment-specific config loading
3. Add variable substitution engine (${env.VAR} syntax)
4. Create config validation and merging logic

**Success Criteria**:
- [ ] Can load config from `apicize.config.json`
- [ ] Environment-specific configs override defaults
- [ ] Variable substitution works: `${env.NODE_ENV}` → `development`
- [ ] Invalid configs throw descriptive errors

**Test Command**: `npm run test:config`
**Test Data**: Create sample config files

---

### Step 2.2: Variable Engine
**Goal**: Implement variable substitution system for {{variable}} syntax.

**Tasks**:
1. Create `VariableEngine` class
2. Implement {{variable}} replacement in strings
3. Support nested objects and arrays
4. Handle missing variables gracefully
5. Support scenario variables and outputs

**Success Criteria**:
- [ ] Simple substitution: `"Hello {{name}}"` → `"Hello World"`
- [ ] URL substitution: `"https://api.com/{{endpoint}}"` works
- [ ] Missing variables handled: `{{missing}}` → warning + original text
- [ ] Object/array traversal works

**Test Command**: `npm run test:variables`

---

### Step 2.3: HTTP Client
**Goal**: Create HTTP client for executing API requests.

**Tasks**:
1. Create `ApicizeClient` class using axios/fetch
2. Implement all HTTP methods (GET, POST, PUT, DELETE, etc.)
3. Add timeout, retry, and redirect handling
4. Support all body types (JSON, XML, Form, Raw)
5. Handle authentication integration

**Success Criteria**:
- [ ] Can make HTTP requests to real endpoints
- [ ] All body types serialize correctly
- [ ] Timeouts and redirects work as configured
- [ ] Response includes status, headers, body, timing
- [ ] Network errors handled gracefully

**Test Command**: `npm run test:client`
**Test Target**: Use httpbin.org for testing

---

### Step 2.4: Authentication Manager
**Goal**: Implement authentication system for different auth types.

**Tasks**:
1. Create `AuthManager` base class
2. Implement Basic authentication
3. Implement API Key authentication
4. Implement OAuth2 Client Credentials flow
5. Implement OAuth2 PKCE flow (stub for now)

**Success Criteria**:
- [ ] Basic auth adds correct Authorization header
- [ ] API Key auth adds custom headers
- [ ] OAuth2 client gets and caches tokens
- [ ] Auth configs load from provider files
- [ ] Invalid auth configs fail gracefully

**Test Command**: `npm run test:auth`
**Test Target**: Use httpbin.org/basic-auth endpoints

---

## Phase 3: Parser and Metadata

### Step 3.1: .apicize File Parser
**Goal**: Parse .apicize JSON files into TypeScript objects.

**Tasks**:
1. Create `ApicizeParser` class
2. Implement JSON parsing with validation
3. Handle malformed files gracefully
4. Extract and validate all sections (requests, scenarios, etc.)
5. Create helper methods for accessing nested data

**Success Criteria**:
- [ ] Can parse demo.apicize file successfully
- [ ] Invalid JSON files throw clear errors
- [ ] All sections are properly typed
- [ ] Helper methods work: `parser.getRequests()`, `parser.getScenarios()`

**Test Command**: `npm run test:parser`
**Test Data**: `demo.apicize` and manually created invalid files

---

### Step 3.2: Metadata Extractor
**Goal**: Extract metadata from TypeScript test files.

**Tasks**:
1. Create `MetadataExtractor` class
2. Parse `/* @apicize-metadata */` comments
3. Extract file-level and request-level metadata
4. Validate metadata completeness
5. Handle malformed or missing metadata

**Success Criteria**:
- [ ] Can extract metadata from comment blocks
- [ ] Handles nested metadata structures
- [ ] Missing metadata detected and reported
- [ ] Invalid JSON in metadata throws errors

**Test Command**: `npm run test:metadata`
**Test Data**: Create sample TypeScript files with metadata

---

### Step 3.3: Test Code Extractor
**Goal**: Extract Mocha/Chai test code from TypeScript files.

**Tasks**:
1. Create `TestExtractor` class using TypeScript AST
2. Find describe/it blocks and extract test code
3. Identify request-specific tests vs shared code
4. Handle imports and dependencies
5. Preserve code formatting and comments

**Success Criteria**:
- [ ] Can extract test code from describe/it blocks
- [ ] Preserves original formatting
- [ ] Handles nested describe blocks
- [ ] Identifies which tests belong to which requests

**Test Command**: `npm run test:extractor`
**Test Data**: Create sample TypeScript test files

---

## Phase 4: Export Functionality

### Step 4.1: Test Template Engine
**Goal**: Create template system for generating TypeScript test files.

**Tasks**:
1. Create `TemplateEngine` class
2. Design templates for different file types:
   - Main index.spec.ts template
   - Request group template
   - Individual request template
3. Support template variables and conditionals
4. Handle imports and dependencies

**Success Criteria**:
- [ ] Can generate test files from templates
- [ ] Variables are properly substituted
- [ ] Generated code is valid TypeScript
- [ ] Different templates produce different structures

**Test Command**: `npm run test:templates`

---

### Step 4.2: TypeScript Test Generator
**Goal**: Convert .apicize requests to TypeScript test files.

**Tasks**:
1. Create `TestGenerator` class
2. Convert request groups to describe blocks
3. Convert individual requests to test cases
4. Generate beforeEach hooks for request execution
5. Embed original test code with proper context

**Success Criteria**:
- [ ] demo.apicize converts to valid TypeScript
- [ ] Generated tests import required libraries
- [ ] Metadata comments are properly embedded
- [ ] Test hierarchy matches request structure

**Test Command**: `npm run test:generator`
**Test Data**: Use demo.apicize for conversion

---

### Step 4.3: Project Scaffolder
**Goal**: Generate complete test project structure.

**Tasks**:
1. Create `ProjectScaffolder` class
2. Generate folder structure (lib/, config/, tests/, etc.)
3. Create package.json with correct dependencies
4. Generate configuration files
5. Set up TypeScript and Mocha configurations

**Success Criteria**:
- [ ] Generated project has correct folder structure
- [ ] package.json includes all required dependencies
- [ ] TypeScript compiles without errors
- [ ] `npm test` runs successfully (even if tests fail)

**Test Command**: `npm run test:scaffold`

---

### Step 4.4: Complete Export Pipeline
**Goal**: Integrate all export components into working pipeline.

**Tasks**:
1. Create `ExportPipeline` class
2. Orchestrate: parse → generate → scaffold → write files
3. Add progress reporting and error handling
4. Support export options (scenarios, splitting, etc.)
5. Generate import mappings for later reimport

**Success Criteria**:
- [ ] demo.apicize exports to complete working project
- [ ] Generated tests can be executed with `npm test`
- [ ] Export process provides clear progress feedback
- [ ] All metadata preserved for round-trip

**Test Command**: `npm run test:export-full`
**Test Data**: Export demo.apicize and run generated tests

---

## Phase 5: Import Functionality

### Step 5.1: TypeScript File Scanner
**Goal**: Scan TypeScript project and identify test files.

**Tasks**:
1. Create `FileScanner` class
2. Find all .spec.ts files in project
3. Identify main vs suite files
4. Load and parse TypeScript files
5. Build dependency graph

**Success Criteria**:
- [ ] Finds all test files in exported project
- [ ] Correctly identifies file relationships
- [ ] Handles missing or malformed files
- [ ] Creates accurate project map

**Test Command**: `npm run test:scanner`
**Test Data**: Use output from Step 4.4

---

### Step 5.2: Request Reconstructor
**Goal**: Rebuild .apicize request structures from TypeScript tests.

**Tasks**:
1. Create `RequestReconstructor` class
2. Extract metadata to rebuild request objects
3. Reconstruct request hierarchy from describe nesting
4. Rebuild body data from metadata
5. Validate reconstructed requests

**Success Criteria**:
- [ ] Can rebuild requests from exported TypeScript
- [ ] Request hierarchy matches original
- [ ] All request properties preserved
- [ ] Generated requests pass validation

**Test Command**: `npm run test:reconstructor`

---

### Step 5.3: Complete Import Pipeline
**Goal**: Convert TypeScript project back to .apicize file.

**Tasks**:
1. Create `ImportPipeline` class
2. Orchestrate: scan → extract → reconstruct → validate
3. Rebuild complete .apicize structure
4. Validate round-trip accuracy
5. Handle import errors gracefully

**Success Criteria**:
- [ ] Can import previously exported demo.apicize
- [ ] Round-trip preserves all data (export → import → compare)
- [ ] Import process provides clear feedback
- [ ] Handles modified test files reasonably

**Test Command**: `npm run test:import-full`
**Test Data**: Round-trip test with demo.apicize

---

## Phase 6: CLI Interface

### Step 6.1: CLI Framework
**Goal**: Create command-line interface foundation.

**Tasks**:
1. Set up Commander.js CLI framework
2. Create main CLI entry point
3. Add global options (--verbose, --help, etc.)
4. Set up command structure and help system
5. Add progress indicators with Ora

**Success Criteria**:
- [ ] `apicize --help` shows available commands
- [ ] `apicize --version` shows version number
- [ ] Global options work across all commands
- [ ] Progress indicators display correctly

**Test Command**: Manual CLI testing

---

### Step 6.2: Export Command
**Goal**: Implement `apicize export` command.

**Tasks**:
1. Create export command with options
2. Add input file validation
3. Add output directory handling
4. Support scenario and splitting options
5. Provide detailed success/error reporting

**Success Criteria**:
- [ ] `apicize export demo.apicize` works
- [ ] `apicize export demo.apicize --output ./tests` works
- [ ] Invalid files show clear error messages
- [ ] Export options function correctly

**Test Command**: `npm run test:cli-export`

---

### Step 6.3: Import Command
**Goal**: Implement `apicize import` command.

**Tasks**:
1. Create import command with options
2. Add input directory validation
3. Add output file handling
4. Support merge and validation options
5. Show round-trip accuracy statistics

**Success Criteria**:
- [ ] `apicize import ./tests` works
- [ ] `apicize import ./tests --output new.apicize` works
- [ ] Shows statistics on import accuracy
- [ ] Handles missing metadata gracefully

**Test Command**: `npm run test:cli-import`

---

### Step 6.4: Additional Commands
**Goal**: Implement validate, create, and run commands.

**Tasks**:
1. Create `apicize validate` command
2. Create `apicize create` command with templates
3. Create `apicize run` command (basic execution)
4. Add command-specific help and options
5. Ensure all commands follow consistent patterns

**Success Criteria**:
- [ ] `apicize validate` checks file validity
- [ ] `apicize create` generates new .apicize files
- [ ] `apicize run` executes tests and shows results
- [ ] All commands have consistent UX

**Test Command**: `npm run test:cli-all`

---

## Phase 7: Testing and Quality

### Step 7.1: Integration Testing
**Goal**: Create comprehensive integration tests.

**Tasks**:
1. Set up integration test framework
2. Test complete export/import workflows
3. Test CLI commands end-to-end
4. Test with various .apicize file types
5. Test error conditions and edge cases

**Success Criteria**:
- [ ] All workflows pass integration tests
- [ ] Edge cases handled gracefully
- [ ] Error messages are helpful
- [ ] Performance is acceptable

**Test Command**: `npm run test:integration`

---

### Step 7.2: Example Files and Documentation
**Goal**: Create comprehensive examples and documentation.

**Tasks**:
1. Create diverse example .apicize files
2. Create tutorial documentation
3. Create API reference documentation
4. Add troubleshooting guide
5. Create migration guide from existing tools

**Success Criteria**:
- [ ] Examples cover all major use cases
- [ ] Documentation is clear and comprehensive
- [ ] Tutorials work for new users
- [ ] API docs cover all public interfaces

**Test Command**: Manual review and user testing

---

### Step 7.3: Performance and Optimization
**Goal**: Ensure tools perform well with large files.

**Tasks**:
1. Create large test .apicize files (100+ requests)
2. Profile memory usage and execution time
3. Optimize slow operations
4. Add streaming for large files if needed
5. Set performance benchmarks

**Success Criteria**:
- [ ] Can handle 1000+ request .apicize files
- [ ] Export/import completes within reasonable time
- [ ] Memory usage stays reasonable
- [ ] Performance metrics documented

**Test Command**: `npm run test:performance`

---

## Phase 8: Packaging and Distribution

### Step 8.1: Package Configuration
**Goal**: Configure packages for npm distribution.

**Tasks**:
1. Configure package.json files properly
2. Set up build scripts for distribution
3. Configure TypeScript declaration generation
4. Set up npm ignore files
5. Test local package installation

**Success Criteria**:
- [ ] `npm pack` creates valid packages
- [ ] Local installation works: `npm install -g ./packages/tools`
- [ ] TypeScript declarations are included
- [ ] Only necessary files are packaged

**Test Command**: `npm run test:package`

---

### Step 8.2: Release Pipeline
**Goal**: Set up automated release process.

**Tasks**:
1. Set up semantic versioning
2. Configure automated changelog generation
3. Set up CI/CD pipeline for releases
4. Configure npm publishing workflow
5. Add release validation steps

**Success Criteria**:
- [ ] Releases increment versions correctly
- [ ] Changelog is automatically generated
- [ ] CI tests pass before release
- [ ] Packages publish to npm successfully

**Test Command**: Test publish to npm test registry

---

## Success Metrics

### Overall Success Criteria
- [ ] Can export demo.apicize to working TypeScript project
- [ ] Generated TypeScript tests execute successfully
- [ ] Can import TypeScript project back to .apicize
- [ ] Round-trip preserves 100% of original data
- [ ] CLI tools install and work globally
- [ ] All phases pass their individual tests
- [ ] Documentation is complete and usable
- [ ] Performance meets benchmarks

### Quality Gates
1. **Code Quality**: 90%+ test coverage, all linting passes
2. **Round-trip Accuracy**: 100% data preservation
3. **Performance**: Handle 1000+ requests in <10 seconds
4. **Usability**: New users can complete tutorial successfully
5. **Reliability**: Integration tests pass on multiple platforms

---

## Development Timeline Estimate

- **Phase 1 (Foundation)**: 1-2 weeks
- **Phase 2 (Core Library)**: 2-3 weeks
- **Phase 3 (Parsing)**: 1-2 weeks
- **Phase 4 (Export)**: 2-3 weeks
- **Phase 5 (Import)**: 2-3 weeks
- **Phase 6 (CLI)**: 1-2 weeks
- **Phase 7 (Testing)**: 1-2 weeks
- **Phase 8 (Release)**: 1 week

**Total Estimated Time**: 11-18 weeks

---

## Risk Mitigation

### High-Risk Areas
1. **Round-trip Accuracy**: Test extensively with diverse .apicize files
2. **TypeScript AST Parsing**: May need robust error handling
3. **Authentication Flows**: OAuth2 flows are complex
4. **Performance**: Large files may require streaming

### Mitigation Strategies
1. Start with simple cases and build complexity gradually
2. Create extensive test suites for each component
3. Use existing libraries where possible (avoid reinventing)
4. Get user feedback early and often
5. Maintain clear documentation throughout development