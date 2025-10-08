# TypeScript Test Fix Plan

**Created**: October 7, 2025
**Issue**: Exported TypeScript tests fail to compile
**Root Cause**: Version mismatch between source types and published npm package

---

## 🔍 Problem Analysis

### Compilation Errors Summary

From `npm run build` in `projectsearch-tests/`:
- **119 TypeScript errors** across 17 test files
- Errors repeat across all test suite files

### Error Categories

1. **Missing API Methods** (16 occurrences)
   ```
   error TS2339: Property 'setupRequest' does not exist on type 'TestHelperImpl'
   error TS2339: Property 'setupWorkbook' does not exist on type 'TestHelperImpl'
   error TS2339: Property 'cleanup' does not exist on type 'ApicizeContext'
   ```

2. **Type Assignment Errors** (16 occurrences)
   ```
   error TS2322: Type 'null' is not assignable to type
   'string | Record<string, unknown> | RequestBody | Buffer<ArrayBufferLike> | undefined'
   ```

3. **Type Inference Errors** (87 occurrences)
   ```
   error TS18046: 'JSON_body' is of type 'unknown'
   ```

---

## 🎯 Root Cause

### Version Mismatch Discovered

**Published Package** (`@jstormes/apicize-lib@1.0.5` in node_modules):
```typescript
export interface ITestHelper {
    setupTest(testName: string): Promise<ApicizeContext>;
    // ❌ MISSING: setupWorkbook()
    // ❌ MISSING: setupRequest()
    loadScenario(scenarioId: string): Promise<Scenario>;
    loadData(dataId: string): Promise<unknown>;
}

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
    // ❌ MISSING: cleanup?: () => Promise<void>;
}
```

**Current Source Code** (`packages/lib/src/types.ts`):
```typescript
export interface ITestHelper {
    setupTest(testName: string): Promise<ApicizeContext>;
    setupWorkbook(workbookName: string): Promise<ApicizeContext>;  // ✅ Added
    setupRequest(requestId: string): Promise<ApicizeContext>;      // ✅ Added
    loadScenario(scenarioId: string): Promise<Scenario>;
    loadData(dataId: string): Promise<unknown>;
}

export interface ApicizeContext {
    // ... all previous fields ...
    cleanup?: () => Promise<void>;  // ✅ Added
}
```

**Implementation** (`packages/lib/src/client/test-helper.ts`):
- ✅ `setupWorkbook()` implemented (line 39-67)
- ✅ `setupTest()` implemented (line 73-75)
- ✅ `setupRequest()` implemented (line 81-107)
- ✅ `cleanup()` implemented (line 318-329)

### Diagnosis

The source code has been updated with new methods, but:
1. The types were not rebuilt after changes
2. The npm package in node_modules has the old types (v1.0.5)
3. Generated tests use the new API methods
4. TypeScript compiler uses installed types from node_modules
5. **Result**: Compilation fails due to missing method declarations

---

## 📋 Fix Plan

### Phase 1: Rebuild Library Package ✅
**Status**: Already done, but needs verification

```bash
cd tools/apicize-tools
docker-compose exec ai-dev npm run build
```

**Verify**: Check that `packages/lib/dist/types.d.ts` has latest changes

### Phase 2: Update Node Modules in Test Project

**Option A: Link Local Package** (Recommended for development)
```bash
# In library package
cd tools/apicize-tools/packages/lib
docker-compose exec ai-dev npm link

# In test project
cd tools/apicize-tools/projectsearch-tests
docker-compose exec ai-dev npm link @jstormes/apicize-lib
```

**Option B: Reinstall from dist**
```bash
cd tools/apicize-tools/projectsearch-tests
docker-compose exec ai-dev rm -rf node_modules/@jstormes/apicize-lib
docker-compose exec ai-dev npm install
```

### Phase 3: Fix RequestConfig Body Type Issue

The `RequestConfig.body` type in the published version may not accept `null`.

**Current Definition** (line 315 of types.ts):
```typescript
body?: RequestBody | string | Buffer | Record<string, unknown>;
```

**Issue**: `null` is not in the union type

**Fix**: Update type definition to:
```typescript
body?: RequestBody | string | Buffer | Record<string, unknown> | null;
```

**Location**: `packages/lib/src/types.ts` line 315

### Phase 4: Fix Type Inference for JSON Body

The generated test code has:
```typescript
const JSON_body = (response.body.type == BodyType.JSON)
    ? response.body.data
    : expect.fail('Response body is not JSON')
```

TypeScript infers `JSON_body` as `unknown` because `response.body.data` is typed as `unknown`.

**Current Definition** (line 269 of types.ts):
```typescript
export interface ApicizeResponseBody {
  type: BodyType;
  data?: unknown;  // ❌ Too generic
  text?: string;
  size?: number;
}
```

**Option 1: Type Guard Function** (Add to exports)
```typescript
export function isJSONResponse(body: ApicizeResponseBody): body is ApicizeResponseBody & { data: Record<string, unknown> } {
    return body.type === BodyType.JSON && typeof body.data === 'object';
}
```

**Option 2: Generic Response Type**
```typescript
export interface ApicizeResponseBody<T = unknown> {
  type: BodyType;
  data?: T;
  text?: string;
  size?: number;
}

export interface ApicizeResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: ApicizeResponseHeaders;
  body: ApicizeResponseBody<T>;
  // ...
}
```

**Recommended**: Option 1 (simpler, less breaking)

### Phase 5: Update Export Templates (If Needed)

Check if templates need updates for type casting:

**File**: `packages/lib/src/templates/template-engine.ts`

**Current generated code**:
```typescript
const JSON_body = (response.body.type == BodyType.JSON)
    ? response.body.data
    : expect.fail('Response body is not JSON')
```

**Potential fix** (add type assertion):
```typescript
const JSON_body = (response.body.type == BodyType.JSON)
    ? response.body.data as Record<string, any>
    : expect.fail('Response body is not JSON')
```

### Phase 6: Rebuild and Test

```bash
# 1. Rebuild library
cd tools/apicize-tools
docker-compose exec ai-dev npm run build

# 2. Link to test project
cd projectsearch-tests
docker-compose exec ai-dev npm link @jstormes/apicize-lib

# 3. Rebuild tests
docker-compose exec ai-dev npm run build

# 4. Run tests (optional)
docker-compose exec ai-dev npm test
```

---

## 🔧 Implementation Steps

### Step 1: Verify Current Build
```bash
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c "cd tools/apicize-tools && npm run build"
```

### Step 2: Check Built Types
```bash
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/packages/lib && grep -A 10 'interface ITestHelper' dist/types.d.ts"
```

**Expected Output**:
```typescript
export interface ITestHelper {
    setupTest(testName: string): Promise<ApicizeContext>;
    setupWorkbook(workbookName: string): Promise<ApicizeContext>;
    setupRequest(requestId: string): Promise<ApicizeContext>;
    loadScenario(scenarioId: string): Promise<Scenario>;
    loadData(dataId: string): Promise<unknown>;
}
```

### Step 3: Fix Body Type Definition
**File**: `packages/lib/src/types.ts`
**Line**: 315

**Change**:
```typescript
// Before
body?: RequestBody | string | Buffer | Record<string, unknown>;

// After
body?: RequestBody | string | Buffer | Record<string, unknown> | null;
```

### Step 4: Add Type Guard Function
**File**: `packages/lib/src/types.ts`
**Location**: After ApicizeResponse definition (around line 293)

**Add**:
```typescript
/**
 * Type guard to check if response body is JSON
 */
export function isJSONBody(body: ApicizeResponseBody): body is ApicizeResponseBody & { data: Record<string, unknown> } {
    return body.type === BodyType.JSON && body.data !== null && body.data !== undefined;
}
```

### Step 5: Export Type Guard
**File**: `packages/lib/src/index.ts`

**Add to exports**:
```typescript
export { isJSONBody } from './types';
```

### Step 6: Update Templates for Type Safety
**File**: `packages/lib/src/templates/request-test.template.ts` (if exists)

**Look for pattern**:
```typescript
const JSON_body = (response.body.type == BodyType.JSON)
    ? response.body.data
    : expect.fail('Response body is not JSON')
```

**Update to**:
```typescript
const JSON_body = (response.body.type == BodyType.JSON)
    ? response.body.data as Record<string, any>
    : expect.fail('Response body is not JSON')
```

**Note**: Templates might be embedded in template-engine.ts, not separate files

### Step 7: Rebuild Everything
```bash
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools && npm run build"
```

### Step 8: Link Library to Test Project
```bash
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/packages/lib && npm link"

cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/projectsearch-tests && npm link @jstormes/apicize-lib"
```

### Step 9: Verify Types in Test Project
```bash
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/projectsearch-tests/node_modules/@jstormes/apicize-lib && \
   grep -A 10 'interface ITestHelper' dist/types.d.ts"
```

### Step 10: Rebuild Tests
```bash
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/projectsearch-tests && npm run build"
```

**Expected**: ✅ 0 errors

---

## 🎯 Success Criteria

### Build Success
- [ ] Library builds without errors
- [ ] Types include `setupWorkbook`, `setupRequest`, `cleanup`
- [ ] `RequestConfig.body` accepts `null`
- [ ] Type guard function exported

### Test Compilation Success
- [ ] `npm run build` in projectsearch-tests produces 0 errors
- [ ] All 16 test suite files compile
- [ ] Generated JavaScript in dist/ folder

### Type Checking Success
- [ ] No "Property does not exist" errors
- [ ] No "Type 'null' is not assignable" errors
- [ ] No "'JSON_body' is of type 'unknown'" errors

---

## 📊 Error Reduction Expected

| Error Type | Before | After | Fix |
|------------|--------|-------|-----|
| Missing methods | 32 | 0 | Updated types |
| Body type errors | 16 | 0 | Allow null in union |
| Unknown type errors | 71 | 0 | Type assertion/guard |
| **Total** | **119** | **0** | ✅ |

---

## 🔄 Alternative Approach

If linking doesn't work or causes issues:

### Re-export Fresh Project
```bash
# 1. Fix types and rebuild
cd tools/apicize-tools
docker-compose exec ai-dev npm run build

# 2. Delete old export
rm -rf projectsearch-tests

# 3. Re-export with fixed library
docker-compose exec ai-dev node packages/tools/dist/cli.js export \
  projectsearch-integration-tests.apicize \
  --output ./projectsearch-tests \
  --overwrite

# 4. Install dependencies (will get latest built version)
cd projectsearch-tests
docker-compose exec ai-dev npm install

# 5. Build
docker-compose exec ai-dev npm run build
```

---

## 📝 Files to Modify

1. **packages/lib/src/types.ts**
   - Line 315: Add `| null` to body type
   - After line 293: Add `isJSONBody()` type guard

2. **packages/lib/src/index.ts**
   - Export `isJSONBody` function

3. **packages/lib/src/templates/** (if template files exist)
   - Add type assertion for JSON_body

---

## ⚠️ Important Notes

1. **Don't modify generated tests directly** - they will be overwritten on re-export
2. **Fix the source** - templates and types in packages/lib
3. **Rebuild before re-export** - ensures generated tests use latest types
4. **Use npm link for development** - avoids re-export cycle

---

## 🚀 Quick Fix (Fastest Path)

```bash
# 1. Fix body type
# Edit: packages/lib/src/types.ts line 315
# Add: | null

# 2. Rebuild
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools && npm run build"

# 3. Link
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/packages/lib && npm link && \
   cd ../../projectsearch-tests && npm link @jstormes/apicize-lib"

# 4. Build tests
cd /d/ai-apicize && docker-compose exec -T ai-dev bash -c \
  "cd tools/apicize-tools/projectsearch-tests && npm run build"
```

---

## 📅 Timeline

- **Phase 1-2**: 5 minutes (verify build, link packages)
- **Phase 3-4**: 10 minutes (fix types, add guards)
- **Phase 5**: 15 minutes (update templates if needed)
- **Phase 6**: 5 minutes (rebuild and test)

**Total Estimated Time**: 35 minutes

---

## ✅ Next Steps

1. Verify current build state
2. Fix type definitions
3. Rebuild library
4. Link to test project
5. Compile tests
6. Validate success

---

*Created: October 7, 2025*
*Issue Tracking: TypeScript Compilation Failures*
*Target: 0 compilation errors*
