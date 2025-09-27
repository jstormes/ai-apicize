import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * Represents extracted test code from a TypeScript test file
 */
export interface ExtractedTestCode {
  requestTests: ExtractedRequestTest[];
  sharedCode: ExtractedSharedCode[];
  imports: ExtractedImport[];
  errors: string[];
  warnings: string[];
}

/**
 * Represents test code for a specific request
 */
export interface ExtractedRequestTest {
  id: string;
  testCode: string;
  describe: string;
  itBlocks: ExtractedItBlock[];
  lineNumber: number;
  formatting: {
    indentation: string;
    preservedComments: string[];
  };
}

/**
 * Represents an individual it() test block
 */
export interface ExtractedItBlock {
  name: string;
  code: string;
  lineNumber: number;
  isAsync: boolean;
}

/**
 * Represents shared code (beforeEach, afterEach, etc.)
 */
export interface ExtractedSharedCode {
  type: 'beforeEach' | 'afterEach' | 'before' | 'after' | 'helper';
  code: string;
  lineNumber: number;
  scope: 'file' | 'describe' | 'request';
}

/**
 * Represents an import statement
 */
export interface ExtractedImport {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string | undefined;
  namespaceImport?: string | undefined;
  typeOnly: boolean;
  lineNumber: number;
}

/**
 * Configuration options for test code extraction
 */
export interface TestExtractionOptions {
  preserveComments?: boolean;
  preserveFormatting?: boolean;
  includeSharedCode?: boolean;
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
  private sourceFile?: ts.SourceFile;
  private sourceText?: string;
  private options: Required<TestExtractionOptions>;

  constructor(options: TestExtractionOptions = {}) {
    this.options = {
      preserveComments: options.preserveComments ?? true,
      preserveFormatting: options.preserveFormatting ?? true,
      includeSharedCode: options.includeSharedCode ?? true,
      strictMode: options.strictMode ?? false,
    };
  }

  /**
   * Extract test code from a TypeScript file
   * @param filePath Path to the TypeScript file
   * @returns Extracted test code
   */
  async extractFromFile(filePath: string): Promise<ExtractedTestCode> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          requestTests: [],
          sharedCode: [],
          imports: [],
          errors: [`File not found: ${filePath}`],
          warnings: [],
        };
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.extractFromContent(content, filePath);
    } catch (error) {
      return {
        requestTests: [],
        sharedCode: [],
        imports: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract test code from TypeScript content string
   * @param content TypeScript file content
   * @param fileName Optional filename for better error reporting
   * @returns Extracted test code
   */
  extractFromContent(content: string, fileName = 'source.ts'): ExtractedTestCode {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.sourceText = content;

      // Parse TypeScript source using the compiler API
      this.sourceFile = ts.createSourceFile(
        fileName,
        content,
        ts.ScriptTarget.Latest,
        true, // setParentNodes - needed for proper AST traversal
        ts.ScriptKind.TS
      );

      const result: ExtractedTestCode = {
        requestTests: [],
        sharedCode: [],
        imports: [],
        errors,
        warnings,
      };

      // Extract imports
      result.imports = this.extractImports();

      // Extract test code using AST traversal
      this.extractTestNodes(this.sourceFile, result);

      // Validate extracted code in strict mode
      if (this.options.strictMode) {
        this.validateExtractedCode(result);
      }

      return result;
    } catch (error) {
      return {
        requestTests: [],
        sharedCode: [],
        imports: [],
        errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract and validate test code with error throwing
   * @param content TypeScript content or file path
   * @returns Validated test code
   * @throws TestExtractionError if extraction fails
   */
  async extractAndValidate(content: string): Promise<ExtractedTestCode> {
    let result: ExtractedTestCode;

    // Check if content is a file path or actual content
    if (content.includes('\n') || content.includes('describe') || content.includes('import')) {
      // Looks like content
      result = this.extractFromContent(content);
    } else {
      // Looks like a file path
      result = await this.extractFromFile(content);
    }

    if (result.errors.length > 0) {
      throw new TestExtractionError('Failed to extract test code', result.errors);
    }

    return result;
  }

  /**
   * Extract import statements from the source file
   */
  private extractImports(): ExtractedImport[] {
    if (!this.sourceFile) return [];

    const imports: ExtractedImport[] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const importDecl = node as ts.ImportDeclaration;
        const moduleSpecifier = (importDecl.moduleSpecifier as ts.StringLiteral).text;
        const lineNumber = this.getLineNumber(node);
        // Check if this is a type-only import by examining the source text
        const nodeText = this.getNodeText(importDecl);
        const typeOnly = nodeText.includes('import type');

        let defaultImport: string | undefined;
        let namespaceImport: string | undefined;
        const namedImports: string[] = [];

        if (importDecl.importClause) {
          const importClause = importDecl.importClause;

          // Default import
          if (importClause.name) {
            defaultImport = importClause.name.text;
          }

          // Named imports or namespace import
          if (importClause.namedBindings) {
            if (ts.isNamespaceImport(importClause.namedBindings)) {
              namespaceImport = importClause.namedBindings.name.text;
            } else if (ts.isNamedImports(importClause.namedBindings)) {
              for (const element of importClause.namedBindings.elements) {
                namedImports.push(element.name.text);
              }
            }
          }
        }

        const importEntry: ExtractedImport = {
          moduleSpecifier,
          namedImports,
          typeOnly,
          lineNumber,
        };

        if (defaultImport) {
          importEntry.defaultImport = defaultImport;
        }

        if (namespaceImport) {
          importEntry.namespaceImport = namespaceImport;
        }

        imports.push(importEntry);
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(this.sourceFile);
    return imports;
  }

  /**
   * Extract test nodes using AST traversal
   */
  private extractTestNodes(node: ts.Node, result: ExtractedTestCode) {
    const visitNode = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callExpr = node as ts.CallExpression;

        if (ts.isIdentifier(callExpr.expression)) {
          const functionName = callExpr.expression.text;

          switch (functionName) {
            case 'describe':
              this.handleDescribeBlock(callExpr, result);
              break;
            case 'beforeEach':
            case 'afterEach':
            case 'before':
            case 'after':
              this.handleHookFunction(callExpr, functionName as any, result);
              break;
          }
        }
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(node);
  }

  /**
   * Handle describe blocks and extract test code
   */
  private handleDescribeBlock(node: ts.CallExpression, result: ExtractedTestCode) {
    if (node.arguments.length < 2) return;

    const nameArg = node.arguments[0];
    const callbackArg = node.arguments[1];

    if (!ts.isStringLiteral(nameArg) || !ts.isFunctionExpression(callbackArg) && !ts.isArrowFunction(callbackArg)) {
      return;
    }

    const describeName = nameArg.text;
    const lineNumber = this.getLineNumber(node);

    // Check if this describe block has request metadata by looking for comments before it
    const requestId = this.findRequestIdFromMetadata(node);

    if (requestId) {
      // This is a request-specific describe block
      const itBlocks = this.extractItBlocks(callbackArg);
      const testCode = this.getNodeText(callbackArg);
      const formatting = this.extractFormatting(node);

      result.requestTests.push({
        id: requestId,
        testCode,
        describe: describeName,
        itBlocks,
        lineNumber,
        formatting,
      });
    }

    // Continue processing nested describe blocks
    if (ts.isFunctionExpression(callbackArg) || ts.isArrowFunction(callbackArg)) {
      if (callbackArg.body && ts.isBlock(callbackArg.body)) {
        for (const statement of callbackArg.body.statements) {
          this.extractTestNodes(statement, result);
        }
      }
    }
  }

  /**
   * Handle hook functions (beforeEach, afterEach, etc.)
   */
  private handleHookFunction(
    node: ts.CallExpression,
    hookType: 'beforeEach' | 'afterEach' | 'before' | 'after',
    result: ExtractedTestCode
  ) {
    if (node.arguments.length < 1) return;

    const callbackArg = node.arguments[0];
    if (!ts.isFunctionExpression(callbackArg) && !ts.isArrowFunction(callbackArg)) {
      return;
    }

    const code = this.getNodeText(callbackArg);
    const lineNumber = this.getLineNumber(node);

    result.sharedCode.push({
      type: hookType,
      code,
      lineNumber,
      scope: 'describe', // Can be refined to detect actual scope
    });
  }

  /**
   * Extract it() blocks from a function body
   */
  private extractItBlocks(functionNode: ts.FunctionExpression | ts.ArrowFunction): ExtractedItBlock[] {
    const itBlocks: ExtractedItBlock[] = [];

    if (!functionNode.body || !ts.isBlock(functionNode.body)) {
      return itBlocks;
    }

    const visitStatement = (statement: ts.Statement) => {
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
        const callExpr = statement.expression;

        if (ts.isIdentifier(callExpr.expression) &&
            (callExpr.expression.text === 'it' || callExpr.expression.text === 'test')) {

          if (callExpr.arguments.length >= 2) {
            const nameArg = callExpr.arguments[0];
            const callbackArg = callExpr.arguments[1];

            if (ts.isStringLiteral(nameArg) &&
                (ts.isFunctionExpression(callbackArg) || ts.isArrowFunction(callbackArg))) {

              const name = nameArg.text;
              const code = this.getNodeText(callbackArg);
              const lineNumber = this.getLineNumber(statement);
              const isAsync = this.isAsyncFunction(callbackArg);

              itBlocks.push({
                name,
                code,
                lineNumber,
                isAsync,
              });
            }
          }
        }
      }
    };

    for (const statement of functionNode.body.statements) {
      visitStatement(statement);
    }

    return itBlocks;
  }

  /**
   * Find request ID from metadata comments preceding a node
   */
  private findRequestIdFromMetadata(node: ts.Node): string | undefined {
    if (!this.sourceFile || !this.sourceText) return undefined;

    const nodeStart = node.getFullStart();
    const precedingText = this.sourceText.substring(0, nodeStart);

    // Look for request metadata in the preceding text
    const metadataMatch = precedingText.match(/\/\*\s*@apicize-request-metadata\s*([\s\S]*?)\s*@apicize-request-metadata-end\s*\*\//);

    if (metadataMatch) {
      try {
        const metadata = JSON.parse(metadataMatch[1].trim());
        return metadata.id;
      } catch {
        // Invalid JSON in metadata
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Extract formatting information (indentation, comments)
   */
  private extractFormatting(node: ts.Node): { indentation: string; preservedComments: string[] } {
    const indentation = this.getNodeIndentation(node);
    const comments = this.options.preserveComments ? this.getNodeComments(node) : [];

    return {
      indentation,
      preservedComments: comments,
    };
  }

  /**
   * Get the text content of a node with preserved formatting
   */
  private getNodeText(node: ts.Node): string {
    if (!this.sourceFile || !this.sourceText) return '';

    const start = node.getFullStart();
    const end = node.getEnd();
    return this.sourceText.substring(start, end);
  }

  /**
   * Get line number for a node
   */
  private getLineNumber(node: ts.Node): number {
    if (!this.sourceFile) return 0;

    const { line } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return line + 1; // Convert to 1-based line numbers
  }

  /**
   * Get indentation for a node
   */
  private getNodeIndentation(node: ts.Node): string {
    if (!this.sourceFile || !this.sourceText) return '';

    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const lineStart = this.sourceFile.getPositionOfLineAndCharacter(line, 0);
    const lineText = this.sourceText.substring(lineStart, lineStart + character);

    return lineText.match(/^\s*/)?.[0] || '';
  }

  /**
   * Get comments associated with a node
   */
  private getNodeComments(node: ts.Node): string[] {
    if (!this.sourceFile) return [];

    const comments: string[] = [];
    const nodeStart = node.getFullStart();
    // const nodePos = node.getStart(); // Remove unused variable

    // Get leading comments
    const leadingComments = ts.getLeadingCommentRanges(this.sourceText!, nodeStart);
    if (leadingComments) {
      for (const comment of leadingComments) {
        const commentText = this.sourceText!.substring(comment.pos, comment.end);
        comments.push(commentText);
      }
    }

    return comments;
  }

  /**
   * Check if a function is async
   */
  private isAsyncFunction(node: ts.FunctionExpression | ts.ArrowFunction): boolean {
    return !!(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword));
  }

  /**
   * Validate extracted code in strict mode
   */
  private validateExtractedCode(result: ExtractedTestCode) {
    if (result.requestTests.length === 0) {
      result.errors.push('No request tests found in strict mode');
    }

    // Check for tests without proper it() blocks
    for (const requestTest of result.requestTests) {
      if (requestTest.itBlocks.length === 0) {
        result.warnings.push(`Request test '${requestTest.describe}' has no it() blocks`);
      }
    }

    // Check for missing imports
    const hasRequiredImports = result.imports.some(imp =>
      imp.moduleSpecifier.includes('mocha') ||
      imp.moduleSpecifier.includes('chai') ||
      imp.namedImports.includes('describe') ||
      imp.namedImports.includes('it') ||
      imp.namedImports.includes('expect')
    );

    if (!hasRequiredImports) {
      result.warnings.push('No Mocha/Chai imports found - this may not be a test file');
    }
  }

  /**
   * Get statistics about extracted test code
   */
  getExtractionStats(result: ExtractedTestCode) {
    const totalItBlocks = result.requestTests.reduce((sum, test) => sum + test.itBlocks.length, 0);
    const asyncTests = result.requestTests.reduce(
      (sum, test) => sum + test.itBlocks.filter(it => it.isAsync).length,
      0
    );

    return {
      totalRequestTests: result.requestTests.length,
      totalItBlocks,
      asyncTests,
      totalSharedCode: result.sharedCode.length,
      totalImports: result.imports.length,
      totalErrors: result.errors.length,
      totalWarnings: result.warnings.length,
    };
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
  const extractor = new TestExtractor(options);
  return extractor.extractFromFile(filePath);
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
  const extractor = new TestExtractor(options);
  return extractor.extractFromContent(content);
}