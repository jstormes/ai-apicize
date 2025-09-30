import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * Represents extracted test code from a TypeScript test file
 */
export interface ExtractedTestCode {
  imports: ExtractedImport[];
  testSuites: ExtractedTestSuite[];
  sharedCode: ExtractedSharedCode[];
  errors: string[];
  warnings: string[];
}

/**
 * Represents an import statement
 */
export interface ExtractedImport {
  moduleSpecifier: string;
  importClause: string | undefined;
  isTypeOnly: boolean;
  lineNumber: number;
  fullText: string;
}

/**
 * Represents a test suite (describe block)
 */
export interface ExtractedTestSuite {
  name: string;
  type: 'describe' | 'suite';
  tests: ExtractedTest[];
  nestedSuites: ExtractedTestSuite[];
  hooks: ExtractedHook[];
  lineNumber: number;
  startPosition: number;
  endPosition: number;
  fullText: string;
}

/**
 * Represents a test case (it/test block)
 */
export interface ExtractedTest {
  name: string;
  type: 'it' | 'test';
  body: string;
  isAsync: boolean;
  lineNumber: number;
  startPosition: number;
  endPosition: number;
  fullText: string;
}

/**
 * Represents test hooks (before, after, beforeEach, afterEach)
 */
export interface ExtractedHook {
  type: 'before' | 'after' | 'beforeEach' | 'afterEach';
  body: string;
  isAsync: boolean;
  lineNumber: number;
  startPosition: number;
  endPosition: number;
  fullText: string;
}

/**
 * Represents shared code (variables, functions, etc.)
 */
export interface ExtractedSharedCode {
  type: 'variable' | 'function' | 'class' | 'type' | 'other';
  name: string | undefined;
  body: string;
  lineNumber: number;
  startPosition: number;
  endPosition: number;
  fullText: string;
}

/**
 * Configuration options for test extraction
 */
export interface TestExtractionOptions {
  preserveComments?: boolean;
  includeSharedCode?: boolean;
  includeTypeDefinitions?: boolean;
  formatCode?: boolean;
  strictMode?: boolean;
}

/**
 * Error class for test extraction issues
 */
export class TestExtractionError extends Error {
  constructor(
    message: string,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'TestExtractionError';
  }
}

/**
 * TestExtractor class for extracting Mocha/Chai test code from TypeScript files using AST
 */
export class TestExtractor {
  private static readonly TEST_FRAMEWORK_FUNCTIONS = new Set([
    'describe',
    'suite',
    'it',
    'test',
    'before',
    'after',
    'beforeEach',
    'afterEach',
  ]);

  /**
   * Extract test code from a TypeScript file
   * @param filePath Path to the TypeScript file
   * @param options Extraction options
   * @returns Extracted test code
   */
  async extractFromFile(
    filePath: string,
    options: TestExtractionOptions = {}
  ): Promise<ExtractedTestCode> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          imports: [],
          testSuites: [],
          sharedCode: [],
          errors: [`File not found: ${filePath}`],
          warnings: [],
        };
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.extractFromContent(content, options);
    } catch (error) {
      return {
        imports: [],
        testSuites: [],
        sharedCode: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract test code from TypeScript content string
   * @param content TypeScript file content
   * @param options Extraction options
   * @returns Extracted test code
   */
  extractFromContent(content: string, options: TestExtractionOptions = {}): ExtractedTestCode {
    const {
      includeSharedCode = true,
      includeTypeDefinitions = false,
      formatCode = false,
      strictMode = false,
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Create TypeScript source file
      const sourceFile = ts.createSourceFile('test.ts', content, ts.ScriptTarget.Latest, true);

      // Check for syntax errors
      const syntaxErrors = this.checkSyntaxErrors(sourceFile);
      if (syntaxErrors.length > 0) {
        errors.push(...syntaxErrors);
        if (strictMode) {
          return {
            imports: [],
            testSuites: [],
            sharedCode: [],
            errors,
            warnings,
          };
        }
      }

      // Extract imports
      const imports = this.extractImports(sourceFile, content);

      // Extract test suites and tests
      const testSuites = this.extractTestSuites(sourceFile, content, formatCode);

      // Extract shared code if requested
      const sharedCode = includeSharedCode
        ? this.extractSharedCode(sourceFile, content, includeTypeDefinitions)
        : [];

      // Validate structure
      if (strictMode && testSuites.length === 0) {
        warnings.push('No test suites found in file');
      }

      return {
        imports,
        testSuites,
        sharedCode,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        imports: [],
        testSuites: [],
        sharedCode: [],
        errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
      };
    }
  }

  /**
   * Extract and validate test code with error throwing
   * @param content TypeScript content or file path
   * @param options Extraction options
   * @returns Validated test code
   * @throws TestExtractionError if extraction fails
   */
  async extractAndValidate(
    content: string,
    options: TestExtractionOptions = {}
  ): Promise<ExtractedTestCode> {
    let result: ExtractedTestCode;

    // Check if content is a file path or actual content
    if (content.includes('\n') || content.includes('describe') || content.includes('import')) {
      // Looks like content
      result = this.extractFromContent(content, { ...options, strictMode: true });
    } else {
      // Looks like a file path
      result = await this.extractFromFile(content, { ...options, strictMode: true });
    }

    if (result.errors.length > 0) {
      throw new TestExtractionError('Failed to extract test code', result.errors);
    }

    return result;
  }

  /**
   * Find test suites by name
   * @param testCode Extracted test code
   * @param suiteName Name of the suite to find
   * @returns Array of matching test suites
   */
  findTestSuitesByName(testCode: ExtractedTestCode, suiteName: string): ExtractedTestSuite[] {
    const results: ExtractedTestSuite[] = [];

    const searchSuites = (suites: ExtractedTestSuite[]) => {
      for (const suite of suites) {
        if (suite.name === suiteName || suite.name.includes(suiteName)) {
          results.push(suite);
        }
        searchSuites(suite.nestedSuites);
      }
    };

    searchSuites(testCode.testSuites);
    return results;
  }

  /**
   * Find tests by name across all suites
   * @param testCode Extracted test code
   * @param testName Name of the test to find
   * @returns Array of matching tests with their parent suite info
   */
  findTestsByName(
    testCode: ExtractedTestCode,
    testName: string
  ): Array<{
    test: ExtractedTest;
    suitePath: string[];
  }> {
    const results: Array<{ test: ExtractedTest; suitePath: string[] }> = [];

    const searchTests = (suites: ExtractedTestSuite[], suitePath: string[] = []) => {
      for (const suite of suites) {
        const currentPath = [...suitePath, suite.name];

        for (const test of suite.tests) {
          if (test.name === testName || test.name.includes(testName)) {
            results.push({ test, suitePath: currentPath });
          }
        }

        searchTests(suite.nestedSuites, currentPath);
      }
    };

    searchTests(testCode.testSuites);
    return results;
  }

  /**
   * Get all tests flattened with their suite hierarchy
   * @param testCode Extracted test code
   * @returns Array of all tests with suite paths
   */
  getAllTests(testCode: ExtractedTestCode): Array<{
    test: ExtractedTest;
    suitePath: string[];
  }> {
    const results: Array<{ test: ExtractedTest; suitePath: string[] }> = [];

    const collectTests = (suites: ExtractedTestSuite[], suitePath: string[] = []) => {
      for (const suite of suites) {
        const currentPath = [...suitePath, suite.name];

        for (const test of suite.tests) {
          results.push({ test, suitePath: currentPath });
        }

        collectTests(suite.nestedSuites, currentPath);
      }
    };

    collectTests(testCode.testSuites);
    return results;
  }

  /**
   * Get statistics about the extracted test code
   * @param testCode Extracted test code
   * @returns Statistics object
   */
  getTestCodeStats(testCode: ExtractedTestCode) {
    const allTests = this.getAllTests(testCode);
    const allSuites = this.getAllSuites(testCode);

    return {
      totalImports: testCode.imports.length,
      totalSuites: allSuites.length,
      totalTests: allTests.length,
      asyncTests: allTests.filter(({ test }) => test.isAsync).length,
      sharedCodeBlocks: testCode.sharedCode.length,
      totalErrors: testCode.errors.length,
      totalWarnings: testCode.warnings.length,
      hasBeforeHooks: allSuites.some(suite => suite.hooks.some(hook => hook.type === 'before')),
      hasAfterHooks: allSuites.some(suite => suite.hooks.some(hook => hook.type === 'after')),
      hasBeforeEachHooks: allSuites.some(suite =>
        suite.hooks.some(hook => hook.type === 'beforeEach')
      ),
      hasAfterEachHooks: allSuites.some(suite =>
        suite.hooks.some(hook => hook.type === 'afterEach')
      ),
    };
  }

  /**
   * Check for syntax errors in the TypeScript source
   */
  private checkSyntaxErrors(sourceFile: ts.SourceFile): string[] {
    const errors: string[] = [];

    function visit(node: ts.Node) {
      // Check for common parsing issues that might indicate syntax errors
      if (ts.isToken(node) && node.kind === ts.SyntaxKind.Unknown) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        errors.push(`Unknown token at line ${line + 1}`);
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return errors;
  }

  /**
   * Extract import statements from the source file
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private extractImports(sourceFile: ts.SourceFile, _content: string): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).slice(1, -1); // Remove quotes
        const importClause = node.importClause?.getText(sourceFile);
        const isTypeOnly = node.importClause?.isTypeOnly || false;
        const fullText = node.getText(sourceFile);

        imports.push({
          moduleSpecifier,
          importClause,
          isTypeOnly,
          lineNumber: line + 1,
          fullText,
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return imports;
  }

  /**
   * Extract test suites from the source file
   */
  private extractTestSuites(
    sourceFile: ts.SourceFile,
    _content: string,
    formatCode: boolean
  ): ExtractedTestSuite[] {
    const suites: ExtractedTestSuite[] = [];

    // Only look at top-level statements to avoid extracting nested describes as top-level
    for (const statement of sourceFile.statements) {
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
        const callExpr = statement.expression;
        const expression = callExpr.expression;

        if (ts.isIdentifier(expression)) {
          const functionName = expression.text;

          if (functionName === 'describe' || functionName === 'suite') {
            const suite = this.extractTestSuite(callExpr, sourceFile, formatCode);
            if (suite) {
              suites.push(suite);
            }
          }
        }
      }
    }

    return suites;
  }

  /**
   * Extract a single test suite from a call expression
   */
  private extractTestSuite(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    formatCode: boolean
  ): ExtractedTestSuite | null {
    const expression = node.expression;
    if (!ts.isIdentifier(expression)) return null;

    const functionName = expression.text;
    if (functionName !== 'describe' && functionName !== 'suite') return null;

    // Get suite name from first argument
    const nameArg = node.arguments[0];
    if (!nameArg || !ts.isStringLiteral(nameArg)) return null;

    const suiteName = nameArg.text;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Get the function body (second argument)
    const bodyArg = node.arguments[1];
    if (!bodyArg || (!ts.isFunctionExpression(bodyArg) && !ts.isArrowFunction(bodyArg)))
      return null;

    const body = bodyArg.body;
    if (!body || !ts.isBlock(body)) return null;

    // Extract tests, nested suites, and hooks from the body
    const tests: ExtractedTest[] = [];
    const nestedSuites: ExtractedTestSuite[] = [];
    const hooks: ExtractedHook[] = [];

    for (const statement of body.statements) {
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
        const callExpr = statement.expression;
        const expr = callExpr.expression;

        if (ts.isIdentifier(expr)) {
          const funcName = expr.text;

          if (funcName === 'it' || funcName === 'test') {
            const test = this.extractTest(callExpr, sourceFile, formatCode);
            if (test) tests.push(test);
          } else if (funcName === 'describe' || funcName === 'suite') {
            const nestedSuite = this.extractTestSuite(callExpr, sourceFile, formatCode);
            if (nestedSuite) nestedSuites.push(nestedSuite);
          } else if (['before', 'after', 'beforeEach', 'afterEach'].includes(funcName)) {
            const hook = this.extractHook(callExpr, sourceFile, formatCode);
            if (hook) hooks.push(hook);
          }
        }
      }
    }

    const fullText = formatCode ? this.formatNode(node, sourceFile) : node.getText(sourceFile);

    return {
      name: suiteName,
      type: functionName as 'describe' | 'suite',
      tests,
      nestedSuites,
      hooks,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Extract a test case from a call expression
   */
  private extractTest(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    formatCode: boolean
  ): ExtractedTest | null {
    const expression = node.expression;
    if (!ts.isIdentifier(expression)) return null;

    const functionName = expression.text;
    if (functionName !== 'it' && functionName !== 'test') return null;

    // Get test name from first argument
    const nameArg = node.arguments[0];
    if (!nameArg || !ts.isStringLiteral(nameArg)) return null;

    const testName = nameArg.text;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Get the function body (second argument)
    const bodyArg = node.arguments[1];
    if (!bodyArg || (!ts.isFunctionExpression(bodyArg) && !ts.isArrowFunction(bodyArg)))
      return null;

    const body = bodyArg.body;
    const isAsync = this.isAsyncFunction(bodyArg);

    let bodyText: string;
    if (ts.isBlock(body)) {
      bodyText = formatCode ? this.formatNode(body, sourceFile) : body.getText(sourceFile);
    } else {
      // Arrow function with expression body
      bodyText = formatCode ? this.formatNode(body, sourceFile) : body.getText(sourceFile);
    }

    const fullText = formatCode ? this.formatNode(node, sourceFile) : node.getText(sourceFile);

    return {
      name: testName,
      type: functionName as 'it' | 'test',
      body: bodyText,
      isAsync,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Extract a hook from a call expression
   */
  private extractHook(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    formatCode: boolean
  ): ExtractedHook | null {
    const expression = node.expression;
    if (!ts.isIdentifier(expression)) return null;

    const functionName = expression.text;
    if (!['before', 'after', 'beforeEach', 'afterEach'].includes(functionName)) return null;

    // Get the function body (first or second argument depending on whether there's a name)
    let bodyArg: ts.Node;
    if (node.arguments.length === 1) {
      bodyArg = node.arguments[0];
    } else if (node.arguments.length === 2) {
      bodyArg = node.arguments[1];
    } else {
      return null;
    }

    if (!ts.isFunctionExpression(bodyArg) && !ts.isArrowFunction(bodyArg)) return null;

    const body = bodyArg.body;
    const isAsync = this.isAsyncFunction(bodyArg);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    let bodyText: string;
    if (ts.isBlock(body)) {
      bodyText = formatCode ? this.formatNode(body, sourceFile) : body.getText(sourceFile);
    } else {
      bodyText = formatCode ? this.formatNode(body, sourceFile) : body.getText(sourceFile);
    }

    const fullText = formatCode ? this.formatNode(node, sourceFile) : node.getText(sourceFile);

    return {
      type: functionName as 'before' | 'after' | 'beforeEach' | 'afterEach',
      body: bodyText,
      isAsync,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Extract shared code (variables, functions, etc.) from the source file
   */
  private extractSharedCode(
    sourceFile: ts.SourceFile,
    _content: string,
    includeTypeDefinitions: boolean
  ): ExtractedSharedCode[] {
    const sharedCode: ExtractedSharedCode[] = [];

    const visit = (node: ts.Node) => {
      // Skip test framework calls as they're handled separately
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        TestExtractor.TEST_FRAMEWORK_FUNCTIONS.has(node.expression.text)
      ) {
        return;
      }

      let codeBlock: ExtractedSharedCode | null = null;

      if (ts.isVariableStatement(node)) {
        codeBlock = this.extractVariableDeclaration(node, sourceFile);
      } else if (ts.isFunctionDeclaration(node)) {
        codeBlock = this.extractFunctionDeclaration(node, sourceFile);
      } else if (ts.isClassDeclaration(node)) {
        codeBlock = this.extractClassDeclaration(node, sourceFile);
      } else if (
        includeTypeDefinitions &&
        (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
      ) {
        codeBlock = this.extractTypeDeclaration(node, sourceFile);
      }

      if (codeBlock) {
        sharedCode.push(codeBlock);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return sharedCode;
  }

  /**
   * Extract variable declaration
   */
  private extractVariableDeclaration(
    node: ts.VariableStatement,
    sourceFile: ts.SourceFile
  ): ExtractedSharedCode {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const fullText = node.getText(sourceFile);

    // Try to get variable name from first declaration
    let name: string | undefined;
    if (node.declarationList.declarations.length > 0) {
      const firstDecl = node.declarationList.declarations[0];
      if (ts.isIdentifier(firstDecl.name)) {
        name = firstDecl.name.text;
      }
    }

    return {
      type: 'variable',
      name,
      body: fullText,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Extract function declaration
   */
  private extractFunctionDeclaration(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile
  ): ExtractedSharedCode {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const fullText = node.getText(sourceFile);
    const name = node.name?.text;

    return {
      type: 'function',
      name,
      body: fullText,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Extract class declaration
   */
  private extractClassDeclaration(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile
  ): ExtractedSharedCode {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const fullText = node.getText(sourceFile);
    const name = node.name?.text;

    return {
      type: 'class',
      name,
      body: fullText,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Extract type declaration
   */
  private extractTypeDeclaration(
    node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile
  ): ExtractedSharedCode {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const fullText = node.getText(sourceFile);
    const name = node.name?.text;

    return {
      type: 'type',
      name,
      body: fullText,
      lineNumber: line + 1,
      startPosition: node.getStart(),
      endPosition: node.getEnd(),
      fullText,
    };
  }

  /**
   * Check if a function is async
   */
  private isAsyncFunction(node: ts.FunctionExpression | ts.ArrowFunction): boolean {
    return !!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);
  }

  /**
   * Format a node using TypeScript's built-in formatting (basic)
   */
  private formatNode(node: ts.Node, sourceFile: ts.SourceFile): string {
    // For now, just return the text as-is
    // In the future, we could add more sophisticated formatting
    return node.getText(sourceFile);
  }

  /**
   * Get all suites flattened
   */
  private getAllSuites(testCode: ExtractedTestCode): ExtractedTestSuite[] {
    const allSuites: ExtractedTestSuite[] = [];

    const collectSuites = (suites: ExtractedTestSuite[]) => {
      for (const suite of suites) {
        allSuites.push(suite);
        collectSuites(suite.nestedSuites);
      }
    };

    collectSuites(testCode.testSuites);
    return allSuites;
  }
}

/**
 * Convenience function to extract test code from a file
 * @param filePath Path to the TypeScript file
 * @param options Extraction options
 * @returns Extracted test code
 */
export async function extractTestCodeFromFile(
  filePath: string,
  options?: TestExtractionOptions
): Promise<ExtractedTestCode> {
  const extractor = new TestExtractor();
  return extractor.extractFromFile(filePath, options);
}

/**
 * Convenience function to extract test code from content
 * @param content TypeScript file content
 * @param options Extraction options
 * @returns Extracted test code
 */
export function extractTestCodeFromContent(
  content: string,
  options?: TestExtractionOptions
): ExtractedTestCode {
  const extractor = new TestExtractor();
  return extractor.extractFromContent(content, options);
}
