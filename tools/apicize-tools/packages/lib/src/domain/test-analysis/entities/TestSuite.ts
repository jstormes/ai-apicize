import { ValidationError, BusinessRuleError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';
import { TestBlock, TestBlockType } from './TestBlock';
import { TestName } from '../value-objects/TestName';
import { SourceCode } from '../value-objects/SourceCode';
import { RequestPattern } from '../value-objects/RequestPattern';

/**
 * Aggregate root representing a complete test suite
 * Manages the collection of test blocks and enforces business rules
 */
export class TestSuite {
  private _rootBlocks: TestBlock[] = [];
  private _imports: ImportStatement[] = [];
  private _globalVariables: VariableDeclaration[] = [];
  private _helperFunctions: HelperFunction[] = [];
  private _metadata: Map<string, unknown> = new Map();

  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _sourceCode: SourceCode
  ) {}

  /**
   * Creates a new TestSuite with validation
   */
  static create(props: {
    id: string;
    name: string;
    sourceCode: SourceCode;
  }): Result<TestSuite, ValidationError> {
    // Validate ID
    if (!props.id || typeof props.id !== 'string' || props.id.trim().length === 0) {
      return Result.fail(
        new ValidationError('INVALID_TEST_SUITE_ID', 'Test suite ID must be a non-empty string', {
          id: props.id,
        })
      );
    }

    // Validate name
    if (!props.name || typeof props.name !== 'string' || props.name.trim().length === 0) {
      return Result.fail(
        new ValidationError('INVALID_TEST_SUITE_NAME', 'Test suite name must be a non-empty string', {
          name: props.name,
        })
      );
    }

    return Result.ok(new TestSuite(props.id.trim(), props.name.trim(), props.sourceCode));
  }

  /**
   * Gets the suite ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the suite name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the source code
   */
  get sourceCode(): SourceCode {
    return this._sourceCode;
  }

  /**
   * Gets all root-level test blocks
   */
  get rootBlocks(): readonly TestBlock[] {
    return [...this._rootBlocks];
  }

  /**
   * Gets all imports
   */
  get imports(): readonly ImportStatement[] {
    return [...this._imports];
  }

  /**
   * Gets all global variables
   */
  get globalVariables(): readonly VariableDeclaration[] {
    return [...this._globalVariables];
  }

  /**
   * Gets all helper functions
   */
  get helperFunctions(): readonly HelperFunction[] {
    return [...this._helperFunctions];
  }

  /**
   * Gets metadata value by key
   */
  getMetadata<T>(key: string): T | undefined {
    return this._metadata.get(key) as T | undefined;
  }

  /**
   * Gets all metadata as a record
   */
  getAllMetadata(): Record<string, unknown> {
    return Object.fromEntries(this._metadata.entries());
  }

  /**
   * Adds a root-level test block
   */
  addRootBlock(block: TestBlock): Result<void, BusinessRuleError> {
    // Validate that it's a root block
    if (block.depth !== 0) {
      return Result.fail(
        new BusinessRuleError('INVALID_ROOT_BLOCK_DEPTH', 'Root blocks must have depth 0', {
          blockId: block.id,
          depth: block.depth,
        })
      );
    }

    if (block.parent !== undefined) {
      return Result.fail(
        new BusinessRuleError('INVALID_ROOT_BLOCK_PARENT', 'Root blocks cannot have a parent', {
          blockId: block.id,
        })
      );
    }

    // Check for duplicate IDs
    if (this.findBlockById(block.id)) {
      return Result.fail(
        new BusinessRuleError('DUPLICATE_BLOCK_ID', 'A block with this ID already exists', {
          blockId: block.id,
        })
      );
    }

    this._rootBlocks.push(block);
    return Result.ok(undefined);
  }

  /**
   * Removes a root block
   */
  removeRootBlock(blockId: string): boolean {
    const index = this._rootBlocks.findIndex(block => block.id === blockId);
    if (index === -1) {
      return false;
    }

    this._rootBlocks.splice(index, 1);
    return true;
  }

  /**
   * Finds a block by ID anywhere in the tree
   */
  findBlockById(blockId: string): TestBlock | undefined {
    for (const rootBlock of this._rootBlocks) {
      if (rootBlock.id === blockId) {
        return rootBlock;
      }

      const found = rootBlock.findChild(blockId) || rootBlock.findAllDescendants().find(block => block.id === blockId);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  /**
   * Finds all blocks that match a predicate
   */
  findBlocks(predicate: (block: TestBlock) => boolean): TestBlock[] {
    const matches: TestBlock[] = [];

    for (const rootBlock of this._rootBlocks) {
      if (predicate(rootBlock)) {
        matches.push(rootBlock);
      }
      matches.push(...rootBlock.findDescendants(predicate));
    }

    return matches;
  }

  /**
   * Gets all test blocks (flattened)
   */
  getAllBlocks(): TestBlock[] {
    const allBlocks: TestBlock[] = [];

    for (const rootBlock of this._rootBlocks) {
      allBlocks.push(rootBlock);
      allBlocks.push(...rootBlock.findAllDescendants());
    }

    return allBlocks;
  }

  /**
   * Gets all describe blocks
   */
  getAllDescribeBlocks(): TestBlock[] {
    return this.findBlocks(block => block.isDescribe);
  }

  /**
   * Gets all it blocks
   */
  getAllItBlocks(): TestBlock[] {
    return this.findBlocks(block => block.isIt);
  }

  /**
   * Gets all request-specific blocks
   */
  getRequestSpecificBlocks(): TestBlock[] {
    return this.findBlocks(block => block.isRequestSpecific);
  }

  /**
   * Gets all shared (non-request-specific) blocks
   */
  getSharedBlocks(): TestBlock[] {
    return this.findBlocks(block => !block.isRequestSpecific);
  }

  /**
   * Classifies all test blocks using the provided patterns
   */
  classifyTestBlocks(patterns: RequestPattern[]): Result<ClassificationResult, BusinessRuleError> {
    if (patterns.length === 0) {
      return Result.fail(
        new BusinessRuleError('NO_CLASSIFICATION_PATTERNS', 'At least one pattern must be provided')
      );
    }

    const allBlocks = this.getAllBlocks();
    const results: { block: TestBlock; wasRequestSpecific: boolean }[] = [];

    for (const block of allBlocks) {
      const wasRequestSpecific = block.isRequestSpecific;
      const classifyResult = block.classifyAsRequestSpecific(patterns);

      if (Result.isFail(classifyResult)) {
        return Result.fail(classifyResult.error);
      }

      results.push({ block, wasRequestSpecific });
    }

    const changedBlocks = results.filter(
      ({ block, wasRequestSpecific }) => block.isRequestSpecific !== wasRequestSpecific
    );

    return Result.ok({
      totalBlocks: allBlocks.length,
      changedBlocks: changedBlocks.length,
      requestSpecificBlocks: this.getRequestSpecificBlocks().length,
      sharedBlocks: this.getSharedBlocks().length,
      changes: changedBlocks.map(({ block }) => ({
        blockId: block.id,
        blockName: block.name.value,
        isRequestSpecific: block.isRequestSpecific,
      })),
    });
  }

  /**
   * Adds an import statement
   */
  addImport(importStatement: ImportStatement): Result<void, ValidationError> {
    // Check for duplicate imports
    const isDuplicate = this._imports.some(
      existing => existing.module === importStatement.module &&
      JSON.stringify(existing.namedImports) === JSON.stringify(importStatement.namedImports)
    );

    if (isDuplicate) {
      return Result.fail(
        new ValidationError('DUPLICATE_IMPORT', 'This import already exists', {
          module: importStatement.module,
        })
      );
    }

    this._imports.push(importStatement);
    return Result.ok(undefined);
  }

  /**
   * Adds a global variable
   */
  addGlobalVariable(variable: VariableDeclaration): Result<void, ValidationError> {
    // Check for duplicate variable names
    const isDuplicate = this._globalVariables.some(existing => existing.name === variable.name);

    if (isDuplicate) {
      return Result.fail(
        new ValidationError('DUPLICATE_VARIABLE', 'A variable with this name already exists', {
          name: variable.name,
        })
      );
    }

    this._globalVariables.push(variable);
    return Result.ok(undefined);
  }

  /**
   * Adds a helper function
   */
  addHelperFunction(helperFunction: HelperFunction): Result<void, ValidationError> {
    // Check for duplicate function names
    const isDuplicate = this._helperFunctions.some(existing => existing.name === helperFunction.name);

    if (isDuplicate) {
      return Result.fail(
        new ValidationError('DUPLICATE_FUNCTION', 'A function with this name already exists', {
          name: helperFunction.name,
        })
      );
    }

    this._helperFunctions.push(helperFunction);
    return Result.ok(undefined);
  }

  /**
   * Sets metadata
   */
  setMetadata(key: string, value: unknown): Result<void, ValidationError> {
    if (!key || typeof key !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_METADATA_KEY', 'Metadata key must be a non-empty string', { key })
      );
    }

    this._metadata.set(key, value);
    return Result.ok(undefined);
  }

  /**
   * Gets comprehensive statistics about the test suite
   */
  getStatistics(): TestSuiteStatistics {
    const allBlocks = this.getAllBlocks();
    const itBlocks = allBlocks.filter(block => block.isIt);
    const describeBlocks = allBlocks.filter(block => block.isDescribe);
    const requestSpecificBlocks = allBlocks.filter(block => block.isRequestSpecific);

    const maxDepth = allBlocks.reduce((max, block) => Math.max(max, block.depth), 0);
    const hasAsyncTests = allBlocks.some(block => block.hasAsyncTests());

    return {
      totalBlocks: allBlocks.length,
      rootBlocks: this._rootBlocks.length,
      itBlocks: itBlocks.length,
      describeBlocks: describeBlocks.length,
      requestSpecificBlocks: requestSpecificBlocks.length,
      sharedBlocks: allBlocks.length - requestSpecificBlocks.length,
      maxDepth,
      hasAsyncTests,
      importsCount: this._imports.length,
      globalVariablesCount: this._globalVariables.length,
      helperFunctionsCount: this._helperFunctions.length,
      sourceCodeLines: this._sourceCode.lineCount,
      sourceCodeCharacters: this._sourceCode.characterCount,
    };
  }

  /**
   * Validates the entire test suite for business rule compliance
   */
  validate(): Result<ValidationSummary, BusinessRuleError> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty test suite
    if (this._rootBlocks.length === 0) {
      warnings.push('Test suite has no test blocks');
    }

    // Check for executable tests
    const hasExecutableTests = this._rootBlocks.some(block => block.hasExecutableTests());
    if (!hasExecutableTests) {
      warnings.push('Test suite has no executable tests (it blocks)');
    }

    // Check for orphaned variables (variables not used in any test)
    for (const variable of this._globalVariables) {
      const isUsed = this._sourceCode.contains(variable.name);
      if (!isUsed) {
        warnings.push(`Global variable '${variable.name}' is declared but not used`);
      }
    }

    // Check for missing required imports for test frameworks
    const hasTestFrameworkImports = this._imports.some(imp =>
      imp.module === 'mocha' || imp.module === 'jest' || imp.module === '@jest/globals'
    );
    if (hasExecutableTests && !hasTestFrameworkImports) {
      warnings.push('Test suite appears to have executable tests but no test framework imports');
    }

    return Result.ok({
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: this.getStatistics(),
    });
  }

  /**
   * Creates a deep clone of the test suite
   */
  clone(): Result<TestSuite, ValidationError> {
    const cloneResult = TestSuite.create({
      id: this._id + '-clone',
      name: this._name + ' (Clone)',
      sourceCode: this._sourceCode,
    });

    if (Result.isFail(cloneResult)) {
      return cloneResult;
    }

    const clone = cloneResult.data;

    // Copy metadata
    for (const [key, value] of this._metadata.entries()) {
      clone.setMetadata(key, value);
    }

    // Copy imports, variables, and functions
    this._imports.forEach(imp => clone.addImport(imp));
    this._globalVariables.forEach(variable => clone.addGlobalVariable(variable));
    this._helperFunctions.forEach(func => clone.addHelperFunction(func));

    // Note: Cloning test blocks would require deep cloning logic
    // This is a simplified version

    return Result.ok(clone);
  }

  /**
   * String representation
   */
  toString(): string {
    return `TestSuite(${this._name})`;
  }

  /**
   * JSON serialization
   */
  toJSON(): object {
    return {
      id: this._id,
      name: this._name,
      sourceCode: this._sourceCode.toJSON(),
      rootBlocks: this._rootBlocks.map(block => block.toJSON()),
      imports: this._imports,
      globalVariables: this._globalVariables,
      helperFunctions: this._helperFunctions,
      metadata: this.getAllMetadata(),
      statistics: this.getStatistics(),
    };
  }
}

/**
 * Interface for import statements
 */
export interface ImportStatement {
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
  module: string;
  fullStatement: string;
  isTypeImport?: boolean;
}

/**
 * Interface for variable declarations
 */
export interface VariableDeclaration {
  name: string;
  type?: string;
  value?: string;
  isConst: boolean;
  lineNumber: number;
}

/**
 * Interface for helper functions
 */
export interface HelperFunction {
  name: string;
  parameters: string[];
  returnType: string;
  code: string;
  lineNumber: number;
  isAsync: boolean;
}

/**
 * Interface for classification results
 */
export interface ClassificationResult {
  totalBlocks: number;
  changedBlocks: number;
  requestSpecificBlocks: number;
  sharedBlocks: number;
  changes: Array<{
    blockId: string;
    blockName: string;
    isRequestSpecific: boolean;
  }>;
}

/**
 * Interface for test suite statistics
 */
export interface TestSuiteStatistics {
  totalBlocks: number;
  rootBlocks: number;
  itBlocks: number;
  describeBlocks: number;
  requestSpecificBlocks: number;
  sharedBlocks: number;
  maxDepth: number;
  hasAsyncTests: boolean;
  importsCount: number;
  globalVariablesCount: number;
  helperFunctionsCount: number;
  sourceCodeLines: number;
  sourceCodeCharacters: number;
}

/**
 * Interface for validation summary
 */
export interface ValidationSummary {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: TestSuiteStatistics;
}