# Apicize Tools Integration Fix Plan
**Date**: October 7, 2025
**Status**: Ready for Implementation
**Priority**: Critical - Blocks Production Use

## Executive Summary

During integration testing with the `digitalroom.gang` project, we discovered critical issues preventing exported Apicize tests from building and running. The root cause is a mismatch between:
1. What the template generator produces (test code expectations)
2. What the library provides (actual implementation)
3. What the scaffolder creates (stub implementations)

**Impact**: Exported test projects cannot build or run, making the export functionality unusable.

**Solution**: Implement a library-centric architecture where `@jstormes/apicize-lib` is the single source of truth. Remove scaffolded lib/ directory and implement complete, working TestHelper in the library.

---

## Issues Discovered

### Issue #1: TestHelper API Mismatch
**Severity**: Critical
**Status**: Blocks execution

**Problem**:
- Template generates: `helper.setupWorkbook('api-tests')`
- Library implements: `setupTest(testName: string)`
- Scaffolded helper has: `setupTest(testName: string)`

**Location**:
- Template: `packages/lib/src/templates/template-engine.ts` line 378
- Library: `packages/lib/src/client/test-helper.ts` line 34
- Interface: `packages/lib/src/types.ts` line 324

**Impact**: TypeScript compilation fails with "Property 'setupWorkbook' does not exist"

---

### Issue #2: Missing cleanup() Method
**Severity**: Critical
**Status**: Blocks execution

**Problem**:
- Template generates: `await context?.cleanup()`
- ApicizeContext interface doesn't define cleanup()
- TestContext class doesn't implement cleanup()

**Location**:
- Template: `packages/lib/src/templates/template-engine.ts` line 383
- Interface: `packages/lib/src/types.ts` line 297-308
- Implementation: `packages/lib/src/client/test-helper.ts` line 68-232

**Impact**: TypeScript compilation fails with "Property 'cleanup' does not exist"

---

### Issue #3: Dual Implementation Confusion
**Severity**: High
**Status**: Architectural Issue

**Problem**:
The exported project has two sources of runtime code:
1. **`@jstormes/apicize-lib`** npm package (imported by tests)
2. **`lib/` directory** (scaffolded stubs for customization)

Generated tests import from `@jstormes/apicize-lib`, but the scaffolded `lib/` contains incomplete stubs.

**Files Involved**:
- Generated tests: `tests/index.spec.ts` imports from `@jstormes/apicize-lib`
- Scaffolded lib: `lib/testing/helpers.ts` contains `TestHelper` stub
- Confusion: Which implementation should be used?

**Current Behavior**:
```typescript
// tests/index.spec.ts imports from library
import { TestHelper } from '@jstormes/apicize-lib';

// But lib/testing/helpers.ts also defines TestHelper
export class TestHelper {
    async setupTest(testName: string) { ... }
}
```

**Impact**: Unclear which implementation is canonical, scaffolded code is incomplete

---

### Issue #4: Incomplete TestHelper Implementation
**Severity**: High
**Status**: Functional Gap

**Problem**:
The library's `TestHelper` is incomplete:
- Doesn't load workbook metadata
- Doesn't load scenarios from config files
- Doesn't properly initialize variables
- Uses placeholder implementations

**Current Implementation** (`packages/lib/src/client/test-helper.ts`):
```typescript
async setupTest(testName: string): Promise<ApicizeContext> {
    // Create a basic context for the test
    const context = new TestContext(testName, this.variableEngine, this.client, this.outputData);
    return context;
}
```

**What's Missing**:
- Load workbook.json from metadata/
- Load scenario configuration
- Initialize variables from scenario
- Load authentication config
- Set up proper request execution

**Impact**: Even if API mismatch is fixed, tests won't have proper context to execute

---

### Issue #5: Type Mismatches in Exported Projects
**Severity**: Medium
**Status**: Type Safety Issue

**Problem**:
```
lib/runtime/client.ts(38,13): error TS2322: Type '{ name: string; value: string; }[]'
is not assignable to type 'ApicizeResponseHeaders'.
```

**Location**: Scaffolded `lib/runtime/client.ts`

**Impact**: TypeScript compilation fails in scaffolded files

---

## Root Cause Analysis

### Why This Happened

1. **Template Evolution**: Templates were updated to use `setupWorkbook()` but the library wasn't updated to match

2. **Scaffolding Purpose Unclear**: The scaffolded `lib/` directory was meant for user customization, but tests import from the npm package, creating confusion

3. **Incomplete Library**: The library's TestHelper is a minimal placeholder, expecting the scaffolded code to be filled in

4. **Module System**: Library exports CommonJS, tests use ESM imports, causing some export/import issues

5. **Missing Context Loading**: The library doesn't know how to load the metadata, config, and scenario files that the scaffolder creates

### Architectural Approach

**Current State**: Hybrid approach where both library and scaffolded code exist
- Tests import from `@jstormes/apicize-lib`
- Scaffolder creates `lib/` stubs
- Neither is complete
- Result: Confusion and compilation failures

**Solution: Library-Centric Architecture**

We will implement a library-centric approach where:
- ✅ Library contains all runtime code
- ✅ Tests import only from `@jstormes/apicize-lib`
- ✅ No scaffolded lib/ directory
- ✅ Config/metadata loading built into library
- ✅ Works out of the box after `npm install`

This approach provides:
- **Simplicity**: Single source of truth
- **Maintainability**: One codebase to maintain
- **Usability**: Tests work immediately without customization
- **Upgradability**: Users get fixes via `npm update`
- **Extensibility**: Users can extend classes if needed

---

## Solution: Library-Centric Implementation

### Implementation Overview

1. **Make `@jstormes/apicize-lib` Complete**
   - Implement full TestHelper with setupWorkbook()
   - Add cleanup() to ApicizeContext
   - Load metadata, config, and scenarios from exported project structure
   - Handle all test execution lifecycle

2. **Remove Scaffolded lib/ Directory**
   - Don't generate `lib/` stubs
   - Remove from templates
   - Remove from project scaffolder

3. **Update Generated Tests**
   - Import everything from `@jstormes/apicize-lib`
   - No local implementations needed
   - Tests work immediately after npm install

4. **Simplify Package.json**
   - Only dependency: `@jstormes/apicize-lib`
   - No need for local lib/ code

### Key Benefits

- ✅ **Works Out of Box**: `npm install && npm test` just works
- ✅ **Maintainable**: Single source of truth in library
- ✅ **Clear**: No confusion about which implementation to use
- ✅ **Testable**: Library can be tested independently
- ✅ **Upgradeable**: Users get fixes via `npm update`

### Extensibility for Advanced Users

Users who need customization can:
1. Extend TestHelper class from the library
2. Override specific methods
3. Pass custom implementation to tests

Example:
```typescript
import { TestHelper } from '@jstormes/apicize-lib';

class CustomTestHelper extends TestHelper {
    async setupWorkbook(name: string) {
        const context = await super.setupWorkbook(name);
        // Add custom initialization
        return context;
    }
}
```

---

## Implementation Plan

### Phase 1: Fix Library (Critical Path)

#### Step 1.1: Add setupWorkbook() Method to TestHelper
**File**: `packages/lib/src/client/test-helper.ts`

**Changes**:
```typescript
export class TestHelperImpl implements ITestHelper {
  private workbookCache: Map<string, ApicizeWorkbook> = new Map();

  /**
   * Setup test context for an entire workbook
   * This is the main method called by generated tests
   */
  async setupWorkbook(workbookName: string): Promise<ApicizeContext> {
    // 1. Load workbook metadata from metadata/workbook.json
    const workbook = await this.loadWorkbookMetadata(workbookName);

    // 2. Load default scenario (if exists)
    const scenario = workbook.defaults?.selectedScenario
      ? await this.loadScenario(workbook.defaults.selectedScenario.id)
      : undefined;

    // 3. Initialize variables from scenario
    const variables = scenario?.variables
      ? this.initializeVariables(scenario.variables)
      : {};

    // 4. Create context with workbook and scenario
    const context = new TestContext(
      workbookName,
      this.variableEngine,
      this.client,
      this.outputData,
      workbook,
      scenario
    );

    // 5. Initialize $ with scenario variables
    context.$ = { ...variables };

    return context;
  }

  /**
   * Load workbook metadata from exported project
   */
  private async loadWorkbookMetadata(workbookName: string): Promise<ApicizeWorkbook> {
    // Check cache first
    if (this.workbookCache.has(workbookName)) {
      return this.workbookCache.get(workbookName)!;
    }

    // Load from metadata/workbook.json
    const metadataPath = path.join(process.cwd(), 'metadata', 'workbook.json');

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const workbook: ApicizeWorkbook = JSON.parse(content);
      this.workbookCache.set(workbookName, workbook);
      return workbook;
    } catch (error) {
      // Fallback: create minimal workbook
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        scenarios: [],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
        defaults: {},
      };
      return workbook;
    }
  }

  /**
   * Initialize variables from scenario
   */
  private initializeVariables(variables: ScenarioVariable[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const variable of variables) {
      if (!variable.disabled) {
        result[variable.name] = this.parseVariableValue(variable);
      }
    }

    return result;
  }

  /**
   * Parse variable value based on type
   */
  private parseVariableValue(variable: ScenarioVariable): unknown {
    switch (variable.type) {
      case 'TEXT':
        return variable.value;
      case 'JSON':
        try {
          return JSON.parse(variable.value);
        } catch {
          return variable.value;
        }
      case 'FILE-JSON':
      case 'FILE-CSV':
        // Load from file (to be implemented)
        return variable.value;
      default:
        return variable.value;
    }
  }

  // Keep existing setupTest for backward compatibility
  async setupTest(testName: string): Promise<ApicizeContext> {
    // Delegate to setupWorkbook
    return this.setupWorkbook(testName);
  }
}
```

**New Dependencies**:
- Add `fs/promises` import
- Add `path` import

---

#### Step 1.2: Add cleanup() Method to ApicizeContext
**File**: `packages/lib/src/types.ts`

**Changes**:
```typescript
export interface ApicizeContext {
  workbook: ApicizeWorkbook;
  scenario?: Scenario;
  variables: Record<string, unknown>;
  $: Record<string, unknown>;
  output: (key: string, value: unknown) => void;
  execute: (request: RequestConfig) => Promise<ApicizeResponse>;
  substituteVariables: (text: string) => string;
  headers?: NameValuePair[];
  body?: RequestBody;
  cleanup?: () => Promise<void>;  // Add this
}
```

**File**: `packages/lib/src/client/test-helper.ts`

**Changes to TestContext class**:
```typescript
class TestContext implements ApicizeContext {
  // ... existing properties ...

  /**
   * Cleanup resources after test execution
   */
  async cleanup(): Promise<void> {
    // Close any open connections
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
    }

    // Clear output data
    this.outputData = {};
    this.$ = {};

    // Clear variable cache
    // Add any other cleanup needed
  }
}
```

---

#### Step 1.3: Update ITestHelper Interface
**File**: `packages/lib/src/types.ts`

**Changes**:
```typescript
export interface ITestHelper {
  setupTest(testName: string): Promise<ApicizeContext>;
  setupWorkbook(workbookName: string): Promise<ApicizeContext>;  // Add this
  loadScenario(scenarioId: string): Promise<Scenario>;
  loadData(dataId: string): Promise<unknown>;
}
```

---

### Phase 2: Update Templates

#### Step 2.1: Update Main Index Template
**File**: `packages/lib/src/templates/template-engine.ts`

**No changes needed** - Template already uses `setupWorkbook()`, which is correct.

**Verify** that cleanup() call exists (it does at line 383).

---

### Phase 3: Remove Scaffolded lib/

#### Step 3.1: Remove lib/ Generation from ProjectScaffolder
**File**: `packages/lib/src/generators/project-scaffolder.ts`

**Changes** in `scaffoldProject()` method:
```typescript
public scaffoldProject(
  workbook: ApicizeWorkbook,
  sourceFileName: string = 'workbook.apicize',
  options: ProjectScaffolderOptions = {}
): ScaffoldedProject {
  const opts = this.mergeOptions(options);
  const files: GeneratedFile[] = [];
  const folders: string[] = [];
  const scripts: string[] = [];

  // Generate test files using TestGenerator
  const testResult = this.testGenerator.generateTestProject(workbook, sourceFileName, {
    outputDir: 'tests',
    includeMetadata: true,
    splitByGroup: true,
    generateHelpers: false,
    indent: '    ',
  });

  // Add test files
  files.push(...testResult.files);

  // Generate main project structure
  this.generateProjectStructure(files, folders, opts);

  // ❌ REMOVE THIS: Don't generate library files
  // this.generateLibraryFiles(files, folders, opts);

  // Generate configuration files
  this.generateConfigurationFiles(files, folders, workbook, opts);

  // Generate package management files
  this.generatePackageFiles(files, opts);

  // Generate utility scripts
  this.generateScripts(files, scripts, opts);

  // Generate example data if requested
  if (opts.includeExampleData) {
    this.generateExampleData(files, folders);
  }

  return {
    files,
    metadata: {
      projectName: opts.projectName,
      outputDir: opts.outputDir,
      totalFiles: files.length,
      folders,
      scripts,
    },
  };
}
```

**Remove** these methods entirely:
- `generateLibraryFiles()`
- `generateRuntimeIndex()`
- `generateRuntimeTypes()`
- `generateRuntimeClient()`
- `generateRuntimeContext()`
- `generateTestingIndex()`
- `generateTestingHelpers()`
- `generateTestingAssertions()`
- `generateDataIndex()`
- `generateDataLoader()`
- `generateAuthIndex()`
- `generateAuthManager()`
- `generateOutputIndex()`
- `generateOutputCollector()`

---

#### Step 3.2: Update Folder Structure
**File**: `packages/lib/src/generators/project-scaffolder.ts`

**Changes** in `generateProjectStructure()`:
```typescript
private generateProjectStructure(
  files: GeneratedFile[],
  folders: string[],
  options: ProjectScaffolderOptions
): void {
  // Main project folders - REMOVE lib/ folders
  const mainFolders = [
    // ❌ Remove all lib/ folders
    // 'lib',
    // 'lib/runtime',
    // 'lib/testing',
    // 'lib/data',
    // 'lib/auth',
    // 'lib/output',
    // 'lib/import-export',

    'config',
    'config/environments',
    'config/auth',
    'config/endpoints',
    'config/scenarios',
    'config/data-sources',
    'tests',
    'data',
    'data/csv',
    'data/json',
    'data/schemas',
    'reports',
    'reports/results',
    'reports/coverage',
    'reports/apicize',
    'scripts',
    'metadata',  // Add this for workbook.json
  ];

  folders.push(...mainFolders);

  // ... rest of method unchanged ...
}
```

---

### Phase 4: Update Package Dependencies

#### Step 4.1: Simplify Generated package.json
**File**: `packages/lib/src/generators/project-scaffolder.ts`

**Changes** in `generatePackageJson()`:
```typescript
private generatePackageJson(options: ProjectScaffolderOptions): string {
  return JSON.stringify(
    {
      name: options.projectName || 'apicize-tests',
      version: '1.0.0',
      private: true,
      description: 'API tests generated from .apicize workbook',
      scripts: {
        test: 'mocha',
        'test:watch': 'mocha --watch',
        'test:debug': 'mocha --inspect-brk',
        'test:scenario': 'cross-env SCENARIO=$npm_config_scenario mocha',
        'test:env': 'cross-env ENV=$npm_config_env mocha',
        'test:single': 'mocha --grep',
        'test:report': 'mocha --reporter mochawesome',
        'test:coverage': 'nyc mocha',
        build: 'tsc',
        'build:watch': 'tsc --watch',
        clean: 'rimraf dist reports/results reports/coverage',
      },
      dependencies: {
        '@jstormes/apicize-lib': '^1.0.5',  // Only dependency needed!
      },
      devDependencies: {
        '@types/mocha': '^10.0.0',
        '@types/chai': '^4.3.0',
        '@types/node': '^20.0.0',
        'mocha': '^10.0.0',
        'chai': '^4.3.0',
        'typescript': '^5.0.0',
        'ts-node': '^10.0.0',
        'cross-env': '^7.0.3',
        'mochawesome': '^7.1.0',
        'nyc': '^15.1.0',
        'rimraf': '^5.0.0',
      },
      engines: {
        node: '>=16.0.0',
      },
    },
    null,
    2
  );
}
```

---

### Phase 5: Update tsconfig.json

#### Step 5.1: Remove lib/ from includes
**File**: `packages/lib/src/generators/project-scaffolder.ts`

**Changes** in `generateTsConfig()`:
```typescript
private generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        typeRoots: ['./node_modules/@types'],
        types: ['mocha', 'chai', 'node'],
      },
      include: [
        // ❌ Remove 'lib/**/*'
        'tests/**/*',
        'scripts/**/*',
      ],
      exclude: ['node_modules', 'dist', 'reports'],
      'ts-node': {
        files: true,
      },
    },
    null,
    2
  );
}
```

---

### Phase 6: Add Library Dependencies

#### Step 6.1: Add Missing Imports to TestHelper
**File**: `packages/lib/src/client/test-helper.ts`

**Add at top**:
```typescript
import { promises as fs } from 'fs';
import * as path from 'path';
```

---

### Phase 7: Testing & Validation

#### Step 7.1: Create Integration Test
**File**: `packages/lib/src/client/test-helper.integration.test.ts` (new file)

**Content**:
```typescript
import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { TestHelper } from './test-helper';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TestHelper Integration Tests', () => {
  let testDir: string;
  let testHelper: TestHelper;

  before(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apicize-test-'));

    // Create metadata directory
    await fs.mkdir(path.join(testDir, 'metadata'), { recursive: true });

    // Create sample workbook.json
    const workbook = {
      version: 1.0,
      requests: [],
      scenarios: [
        {
          id: 'test-scenario',
          name: 'Test Scenario',
          variables: [
            { name: 'baseUrl', value: 'https://api.test.com', type: 'TEXT' },
            { name: 'apiKey', value: 'test-key-123', type: 'TEXT' },
          ],
        },
      ],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
      defaults: {
        selectedScenario: {
          id: 'test-scenario',
          name: 'Test Scenario',
        },
      },
    };

    await fs.writeFile(
      path.join(testDir, 'metadata', 'workbook.json'),
      JSON.stringify(workbook, null, 2)
    );

    // Change to test directory
    process.chdir(testDir);

    testHelper = new TestHelper();
  });

  after(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('setupWorkbook()', () => {
    it('should load workbook metadata', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      expect(context).to.exist;
      expect(context.workbook).to.exist;
      expect(context.workbook.version).to.equal(1.0);
    });

    it('should load scenario variables', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      expect(context.scenario).to.exist;
      expect(context.scenario!.name).to.equal('Test Scenario');
      expect(context.$.baseUrl).to.equal('https://api.test.com');
      expect(context.$.apiKey).to.equal('test-key-123');
    });

    it('should provide output function', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      context.output('testKey', 'testValue');
      expect(context.$.testKey).to.equal('testValue');
    });
  });

  describe('cleanup()', () => {
    it('should cleanup context resources', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      context.output('testKey', 'testValue');
      await context.cleanup?.();

      // After cleanup, output should be cleared
      expect(Object.keys(context.$).length).to.be.lessThan(5);
    });
  });
});
```

---

#### Step 7.2: Test Export with Real .apicize File
**Process**:
```bash
# In Docker environment
cd /project/tools/apicize-tools

# Rebuild library with changes
npm run build

# Export test file
node packages/tools/dist/cli.js export \
  digitalroom-test.apicize \
  --output ./test-integration \
  --overwrite

# Install and link
cd test-integration
npm install
npm link @jstormes/apicize-lib

# Build
npm run build

# Should succeed with no errors!

# Run tests (may fail if API not available, but should execute)
npm test
```

---

#### Step 7.3: Verify Against digitalroom.gang
**Process**:
```bash
# Export real digitalroom.gang test
cd /project/tools/apicize-tools
node packages/tools/dist/cli.js export \
  /project/../RiderProjects/digitalroom.gang/apicize/localhost_test.apicize \
  --output ./digitalroom-integration \
  --overwrite

cd digitalroom-integration
npm install
npm link @jstormes/apicize-lib

# Should build successfully
npm run build

# Run against live API (requires API to be running)
# In digitalroom.gang project: docker-compose up
# Then: npm test
```

---

## Success Criteria

### Must Pass (Critical)
- [ ] ✅ Library builds without errors
- [ ] ✅ Exported tests build without TypeScript errors
- [ ] ✅ `TestHelper.setupWorkbook()` method exists and works
- [ ] ✅ `ApicizeContext.cleanup()` method exists and works
- [ ] ✅ No scaffolded `lib/` directory in exports
- [ ] ✅ Tests run with minimal .apicize file
- [ ] ✅ Tests import only from `@jstormes/apicize-lib`

### Should Pass (Important)
- [ ] ✅ Tests run against live API (digitalroom.gang)
- [ ] ✅ Variable substitution works from scenarios
- [ ] ✅ Workbook metadata loads correctly
- [ ] ✅ Output function passes data between tests
- [ ] ✅ Integration tests pass

### Nice to Have (Future)
- [ ] ⭕ Config file loading (scenarios from config/scenarios/)
- [ ] ⭕ Authentication integration
- [ ] ⭕ Data file loading (CSV/JSON)
- [ ] ⭕ Round-trip import/export validation

---

## Risk Mitigation

### Risk: Breaking Changes for Existing Users
**Mitigation**:
- This is early enough that few users exist
- Document migration path in release notes
- Bump major version (1.x → 2.0)

### Risk: Missing Functionality
**Mitigation**:
- Start with minimal working implementation
- Add features incrementally
- Test with real projects (digitalroom.gang)

### Risk: Performance Issues
**Mitigation**:
- Cache workbook metadata
- Lazy load scenarios and data
- Profile with large workbooks

---

## Implementation Order

### Week 1: Core Fixes (Critical Path)
1. **Day 1-2**: Implement setupWorkbook() and cleanup()
2. **Day 3**: Remove scaffolded lib/ generation
3. **Day 4**: Update package dependencies
4. **Day 5**: Test exports build successfully

### Week 2: Testing & Validation
1. **Day 1-2**: Create integration tests
2. **Day 3**: Test with digitalroom.gang project
3. **Day 4**: Fix any issues discovered
4. **Day 5**: Documentation updates

### Week 3: Polish & Release
1. **Day 1**: Update CLAUDE.md with new architecture
2. **Day 2**: Update README and examples
3. **Day 3**: Release preparation
4. **Day 4**: Testing on clean install
5. **Day 5**: Release and monitor

---

## Testing Checklist

### Unit Tests
- [ ] TestHelper.setupWorkbook() loads workbook
- [ ] TestHelper.setupWorkbook() loads scenarios
- [ ] TestHelper.setupWorkbook() initializes variables
- [ ] TestContext.cleanup() clears resources
- [ ] TestContext.execute() makes HTTP requests
- [ ] TestContext.output() stores values in $

### Integration Tests
- [ ] Export minimal.apicize → builds successfully
- [ ] Export with scenarios → loads variables
- [ ] Export with requests → executes HTTP calls
- [ ] Export digitalroom.gang → runs against API

### End-to-End Tests
- [ ] Fresh npm install → no errors
- [ ] npm run build → compiles successfully
- [ ] npm test → executes tests
- [ ] Tests pass with mock server
- [ ] Tests pass with real API

---

## Documentation Updates Required

### Files to Update
1. **CLAUDE.md** - Remove scaffolded lib/ references
2. **BUILD_PLAN.md** - Update Phase 4 & 5 status
3. **README.md** - Update architecture diagram
4. **packages/lib/README.md** - Document TestHelper API
5. **packages/tools/README.md** - Update export process

### New Documentation
1. **MIGRATION_GUIDE.md** - How to upgrade from v1.x
2. **ARCHITECTURE.md** - Library-centric design
3. **API_REFERENCE.md** - TestHelper and ApicizeContext API

---

## Rollback Plan

If critical issues arise during implementation:

1. **Revert Commits**: Use git to revert changes to last working state
2. **Fallback Branch**: Create `fix/integration-v1` branch before starting
3. **Communication**: Document what didn't work and why
4. **Re-assess**: Review implementation approach and identify blocking issues

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Create feature branch**: `fix/integration-issues`
3. **Implement Phase 1** (critical fixes)
4. **Test iteratively** with real projects
5. **Document lessons learned**

---

## Questions to Resolve

1. **Q**: Should we support both setupWorkbook() and setupTest()?
   **A**: Yes, keep setupTest() for backward compatibility, delegate to setupWorkbook()

2. **Q**: What about users who need custom test helpers?
   **A**: They can extend TestHelper class and override methods

3. **Q**: Should cleanup() be optional or required?
   **A**: Optional (cleanup?()) - some contexts may not need cleanup

4. **Q**: How to handle authentication in tests?
   **A**: Phase 2 work - load from config/auth/ files

5. **Q**: What about data-driven tests with CSV files?
   **A**: Phase 2 work - load from data/ files

---

## References

- **Current Code**: `D:\ai-apicize\tools\apicize-tools\`
- **Test Project**: `D:\RiderProjects\digitalroom.gang\`
- **Docker Setup**: `D:\ai-apicize\docker-compose.yml`
- **Templates**: `packages/lib/src/templates/template-engine.ts`
- **TestHelper**: `packages/lib/src/client/test-helper.ts`
- **Types**: `packages/lib/src/types.ts`

---

## Status Tracking

| Task | Status | Assignee | Notes |
|------|--------|----------|-------|
| Write fix plan | ✅ Complete | AI | This document |
| Review plan | ⏳ Pending | Team | Needs approval |
| Implement Phase 1 | ⏳ Pending | - | Critical path |
| Test with examples | ⏳ Pending | - | Validation |
| Test with digitalroom.gang | ⏳ Pending | - | Real-world test |
| Documentation | ⏳ Pending | - | Updates needed |
| Release | ⏳ Pending | - | v2.0.0 |

---

**End of Plan**

*Last Updated: October 7, 2025*
*Status: Ready for Implementation*
*Priority: Critical*
