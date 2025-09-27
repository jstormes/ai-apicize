import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * Represents extracted test code with context information
 */
export interface ExtractedTestCode {
  testBlocks: ExtractedTestBlock[];
  imports: ExtractedImport[];
  globalVariables: ExtractedVariable[];
  helperFunctions: ExtractedFunction[];
  errors: string[];
  warnings: string[];
}

/**
 * Represents a single test block (describe or it)
 */
export interface ExtractedTestBlock {
  type: 'describe' | 'it';
  name: string;
  code: string;
  fullCode: string; // Complete block including function declaration
  startPosition: number;
  endPosition: number;
  lineNumber: number;
  depth: number;
  children?: ExtractedTestBlock[];
  metadata?: Record<string, any>;
  isRequestSpecific: boolean;
}

/**
 * Represents an import statement
 */
export interface ExtractedImport {
  source: string;
  imports: string[];
  isTypeImport: boolean;
  fullStatement: string;
}

/**
 * Represents a variable declaration
 */
export interface ExtractedVariable {
  name: string;
  type: string;
  value?: string;
  isConst: boolean;
  lineNumber: number;
}

/**
 * Represents a helper function
 */
export interface ExtractedFunction {
  name: string;
  parameters: string[];
  returnType: string;
  code: string;
  lineNumber: number;
  isAsync: boolean;
}

/**
 * Configuration options for test extraction
 */
export interface TestExtractionOptions {
  preserveFormatting?: boolean;
  includeComments?: boolean;
  extractHelpers?: boolean;
  requestIdentifierPatterns?: RegExp[];
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
 * TestExtractor class for parsing TypeScript test files and extracting test code
 */
export class TestExtractor {
  private static readonly DEFAULT_REQUEST_PATTERNS = [
    /describe\s*\(\s*['"`][^'"`]*request[^'"`]*['"`]/i,
    /describe\s*\(\s*['"`][^'"`]*API[^'"`]*['"`]/i,
  ];

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
          testBlocks: [],
          imports: [],
          globalVariables: [],
          helperFunctions: [],
          errors: [`File not found: ${filePath}`],
          warnings: [],
        };
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.extractFromContent(content, options);
    } catch (error) {
      return {
        testBlocks: [],
        imports: [],
        globalVariables: [],
        helperFunctions: [],
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
      preserveFormatting = true,
      includeComments = true,
      extractHelpers = true,
      requestIdentifierPatterns = TestExtractor.DEFAULT_REQUEST_PATTERNS,
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Create TypeScript source file
      const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

      // Extract different components
      const imports = this.extractImports(sourceFile, content);
      const globalVariables = this.extractGlobalVariables(sourceFile, content);
      const helperFunctions = extractHelpers
        ? this.extractHelperFunctions(sourceFile, content)
        : [];
      const testBlocks = this.extractTestBlocks(
        sourceFile,
        content,
        preserveFormatting,
        includeComments,
        requestIdentifierPatterns
      );

      return {
        testBlocks,
        imports,
        globalVariables,
        helperFunctions,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        testBlocks: [],
        imports: [],
        globalVariables: [],
        helperFunctions: [],
        errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract test code and validate structure
   * @param content TypeScript content or file path
   * @returns Validated extracted test code
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
   * Get statistics about the extracted test code
   * @param extracted Extracted test code
   * @returns Statistics object
   */
  getTestStats(extracted: ExtractedTestCode) {
    const allBlocks = this.flattenTestBlocks(extracted.testBlocks);
    const describeBlocks = allBlocks.filter(block => block.type === 'describe');
    const itBlocks = allBlocks.filter(block => block.type === 'it');
    const requestSpecificBlocks = allBlocks.filter(block => block.isRequestSpecific);

    return {
      totalBlocks: allBlocks.length,
      describeBlocks: describeBlocks.length,
      itBlocks: itBlocks.length,
      requestSpecificBlocks: requestSpecificBlocks.length,
      sharedBlocks: allBlocks.length - requestSpecificBlocks.length,
      importsCount: extracted.imports.length,
      globalVariablesCount: extracted.globalVariables.length,
      helperFunctionsCount: extracted.helperFunctions.length,
      totalErrors: extracted.errors.length,
      totalWarnings: extracted.warnings.length,
      maxDepth: Math.max(0, ...allBlocks.map(block => block.depth)),
    };
  }

  /**
   * Find test blocks by name or pattern
   * @param extracted Extracted test code
   * @param namePattern Pattern to match against test names
   * @returns Matching test blocks
   */
  findTestBlocks(extracted: ExtractedTestCode, namePattern: string | RegExp): ExtractedTestBlock[] {
    const allBlocks = this.flattenTestBlocks(extracted.testBlocks);
    const pattern = typeof namePattern === 'string' ? new RegExp(namePattern, 'i') : namePattern;

    return allBlocks.filter(block => pattern.test(block.name));
  }

  /**
   * Extract request-specific test blocks
   * @param extracted Extracted test code
   * @returns Request-specific test blocks
   */
  getRequestSpecificTests(extracted: ExtractedTestCode): ExtractedTestBlock[] {
    const allBlocks = this.flattenTestBlocks(extracted.testBlocks);
    return allBlocks.filter(block => block.isRequestSpecific);
  }

  /**
   * Extract shared/helper test blocks
   * @param extracted Extracted test code
   * @returns Shared test blocks
   */
  getSharedTests(extracted: ExtractedTestCode): ExtractedTestBlock[] {
    const allBlocks = this.flattenTestBlocks(extracted.testBlocks);
    return allBlocks.filter(block => !block.isRequestSpecific);
  }

  /**
   * Extract imports from the TypeScript AST
   */
  private extractImports(sourceFile: ts.SourceFile, content: string): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text;
          const importClause = node.importClause;
          const isTypeImport = !!node.importClause?.isTypeOnly;
          const fullStatement = content.substring(node.getStart(), node.getEnd());

          const importNames: string[] = [];

          if (importClause) {
            // Default import
            if (importClause.name) {
              importNames.push(importClause.name.text);
            }

            // Named imports
            if (importClause.namedBindings) {
              if (ts.isNamespaceImport(importClause.namedBindings)) {
                importNames.push(`* as ${importClause.namedBindings.name.text}`);
              } else if (ts.isNamedImports(importClause.namedBindings)) {
                importClause.namedBindings.elements.forEach(element => {
                  const name = element.propertyName
                    ? `${element.propertyName.text} as ${element.name.text}`
                    : element.name.text;
                  importNames.push(name);
                });
              }
            }
          }

          imports.push({
            source,
            imports: importNames,
            isTypeImport,
            fullStatement,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  /**
   * Extract global variable declarations
   */
  private extractGlobalVariables(sourceFile: ts.SourceFile, _content: string): ExtractedVariable[] {
    const variables: ExtractedVariable[] = [];

    // Visit only top-level statements
    for (const statement of sourceFile.statements) {
      if (ts.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach(declaration => {
          if (ts.isIdentifier(declaration.name)) {
            const name = declaration.name.text;
            const isConst = statement.declarationList.flags === ts.NodeFlags.Const;
            const type = declaration.type ? declaration.type.getText() : 'any';
            const value = declaration.initializer ? declaration.initializer.getText() : undefined;
            const lineNumber =
              sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1;

            variables.push({
              name,
              type,
              value,
              isConst,
              lineNumber,
            });
          }
        });
      }
    }

    return variables;
  }

  /**
   * Extract helper functions (only top-level functions)
   */
  private extractHelperFunctions(sourceFile: ts.SourceFile, content: string): ExtractedFunction[] {
    const functions: ExtractedFunction[] = [];

    // Visit only top-level statements
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        const name = statement.name.text;
        const isAsync = !!statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);
        const parameters = statement.parameters.map(param => param.getText());
        const returnType = statement.type ? statement.type.getText() : 'void';
        const code = content.substring(statement.getStart(), statement.getEnd());
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(statement.getStart()).line + 1;

        functions.push({
          name,
          parameters,
          returnType,
          code,
          lineNumber,
          isAsync,
        });
      }
    }

    return functions;
  }

  /**
   * Extract test blocks (describe and it)
   */
  private extractTestBlocks(
    sourceFile: ts.SourceFile,
    content: string,
    preserveFormatting: boolean,
    includeComments: boolean,
    requestIdentifierPatterns: RegExp[]
  ): ExtractedTestBlock[] {
    const allBlocks: ExtractedTestBlock[] = [];

    // First pass: collect all test blocks without nesting
    const visit = (node: ts.Node, depth = 0) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        if (ts.isIdentifier(expression)) {
          const functionName = expression.text;

          if (
            (functionName === 'describe' || functionName === 'it') &&
            node.arguments.length >= 2
          ) {
            const nameArg = node.arguments[0];
            const callbackArg = node.arguments[1];

            if (ts.isStringLiteral(nameArg)) {
              const name = nameArg.text;
              const startPosition = node.getStart();
              const endPosition = node.getEnd();
              const lineNumber = sourceFile.getLineAndCharacterOfPosition(startPosition).line + 1;

              // Extract the callback function body
              let code = '';
              const fullCode = content.substring(startPosition, endPosition);

              if (ts.isArrowFunction(callbackArg) || ts.isFunctionExpression(callbackArg)) {
                const body = (callbackArg as ts.ArrowFunction | ts.FunctionExpression).body;
                if (body) {
                  if (ts.isBlock(body)) {
                    code = content
                      .substring(
                        body.getStart() + 1, // Skip opening brace
                        body.getEnd() - 1 // Skip closing brace
                      )
                      .trim();
                  } else {
                    code = content.substring(body.getStart(), body.getEnd());
                  }
                }
              }

              // Determine if this is request-specific
              const isRequestSpecific = this.isRequestSpecific(
                content,
                startPosition,
                name,
                requestIdentifierPatterns
              );

              const testBlock: ExtractedTestBlock = {
                type: functionName as 'describe' | 'it',
                name,
                code,
                fullCode,
                startPosition,
                endPosition,
                lineNumber,
                depth: 0, // Will be calculated in hierarchy building
                isRequestSpecific,
              };

              allBlocks.push(testBlock);
            }
          }
        }
      }

      ts.forEachChild(node, child => visit(child, depth + 1));
    };

    visit(sourceFile);

    // Second pass: build hierarchy
    return this.buildTestBlockHierarchy(allBlocks);
  }

  /**
   * Build hierarchy from flat list of test blocks
   */
  private buildTestBlockHierarchy(allBlocks: ExtractedTestBlock[]): ExtractedTestBlock[] {
    const rootBlocks: ExtractedTestBlock[] = [];

    // Sort by start position to ensure proper nesting
    allBlocks.sort((a, b) => a.startPosition - b.startPosition);

    for (const block of allBlocks) {
      // Find parent block (the nearest block that contains this one)
      let parent: ExtractedTestBlock | undefined;

      for (let i = allBlocks.length - 1; i >= 0; i--) {
        const candidate = allBlocks[i];
        if (
          candidate !== block &&
          candidate.type === 'describe' &&
          candidate.startPosition < block.startPosition &&
          candidate.endPosition > block.endPosition
        ) {
          if (!parent || candidate.startPosition > parent.startPosition) {
            parent = candidate;
          }
        }
      }

      if (parent) {
        // Add to parent's children
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(block);
        // Set depth based on parent depth
        block.depth = parent.depth + 1;
      } else {
        // Top-level block
        rootBlocks.push(block);
        block.depth = 0;
      }
    }

    return rootBlocks;
  }

  /**
   * Determine if a test block is request-specific
   */
  private isRequestSpecific(
    content: string,
    startPosition: number,
    testName: string,
    patterns: RegExp[]
  ): boolean {
    // Check test name patterns
    for (const pattern of patterns) {
      if (pattern.test(testName)) {
        return true;
      }
    }

    // Look for metadata comments before this test block (within reasonable distance)
    const beforeText = content.substring(Math.max(0, startPosition - 500), startPosition);
    const hasRequestMetadata = /\/\*\s*@apicize-request-metadata\s*/.test(beforeText);

    return hasRequestMetadata;
  }

  /**
   * Flatten nested test blocks into a single array
   */
  private flattenTestBlocks(testBlocks: ExtractedTestBlock[]): ExtractedTestBlock[] {
    const flattened: ExtractedTestBlock[] = [];

    const flatten = (blocks: ExtractedTestBlock[]) => {
      for (const block of blocks) {
        flattened.push(block);
        if (block.children) {
          flatten(block.children);
        }
      }
    };

    flatten(testBlocks);
    return flattened;
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
