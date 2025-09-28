/**
 * TypeScript implementation of the ISourceCodeParser interface
 * Handles parsing of TypeScript source code using the TypeScript compiler API
 */

import * as ts from 'typescript';
import { ISourceCodeParser } from './ISourceCodeParser';
import {
  ParsedSource,
  ParsedImport,
  ParsedVariable,
  ParsedFunction,
  ParsedMetadata,
  ParsedComment,
} from './ParsedSource';
import { ParsingOptions, DEFAULT_PARSING_OPTIONS } from './ParsingOptions';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { TestName } from '../../domain/test-analysis/value-objects/TestName';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';
import { SourcePosition } from '../../domain/test-analysis/value-objects/SourcePosition';
import { AstNavigator } from './AstNavigator';
import { SyntaxAnalyzer } from './SyntaxAnalyzer';

/**
 * TypeScript-specific implementation of source code parsing
 * Uses the TypeScript compiler API for robust parsing
 */
export class TypeScriptParser implements ISourceCodeParser {
  private errors: string[] = [];
  private warnings: string[] = [];
  private astNavigator: AstNavigator;
  private syntaxAnalyzer: SyntaxAnalyzer;

  constructor(astNavigator?: AstNavigator, syntaxAnalyzer?: SyntaxAnalyzer) {
    this.astNavigator = astNavigator || new AstNavigator();
    this.syntaxAnalyzer = syntaxAnalyzer || new SyntaxAnalyzer();
  }

  /**
   * Parse TypeScript source code and extract structured information
   */
  parseSource(content: string, options: ParsingOptions = {}): ParsedSource {
    this.clearErrors();
    const effectiveOptions = { ...DEFAULT_PARSING_OPTIONS, ...options };

    try {
      // Create TypeScript source file
      const sourceFile = this.createSourceFile(content, effectiveOptions);

      // Validate syntax if requested
      if (effectiveOptions.validateSyntax && !this.validateSyntaxInternal(sourceFile)) {
        return this.createEmptyParsedSource(content);
      }

      // Extract different components
      const imports = this.extractImports(sourceFile, content);
      const globalVariables = this.extractGlobalVariables(sourceFile);
      const helperFunctions = effectiveOptions.extractHelpers
        ? this.extractHelperFunctions(sourceFile, content)
        : [];
      const metadata = effectiveOptions.extractMetadata
        ? this.extractMetadata(sourceFile, content)
        : new ParsedMetadata();
      const testBlocks = this.extractTestBlocks(sourceFile, content, effectiveOptions);

      return new ParsedSource(
        testBlocks,
        imports,
        globalVariables,
        helperFunctions,
        new SourceCode(content),
        metadata
      );
    } catch (error) {
      this.addError(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
      return this.createEmptyParsedSource(content);
    }
  }

  /**
   * Validate that the source code is syntactically correct
   */
  validateSyntax(content: string): boolean {
    try {
      const sourceFile = this.createSourceFile(content);
      return this.validateSyntaxInternal(sourceFile);
    } catch {
      return false;
    }
  }

  /**
   * Get parsing errors if any occurred during parsing
   */
  getParsingErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Get parsing warnings if any were generated during parsing
   */
  getParsingWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Create TypeScript source file from content
   */
  private createSourceFile(content: string, options?: ParsingOptions): ts.SourceFile {
    const compilerOptions = options?.compilerOptions || DEFAULT_PARSING_OPTIONS.compilerOptions;
    const target = this.getScriptTarget(compilerOptions.target || 'ES2020');

    return ts.createSourceFile(
      'temp.ts',
      content,
      target,
      true // setParentNodes
    );
  }

  /**
   * Convert string target to TypeScript ScriptTarget
   */
  private getScriptTarget(target: string): ts.ScriptTarget {
    switch (target.toUpperCase()) {
      case 'ES5':
        return ts.ScriptTarget.ES5;
      case 'ES2015':
      case 'ES6':
        return ts.ScriptTarget.ES2015;
      case 'ES2016':
        return ts.ScriptTarget.ES2016;
      case 'ES2017':
        return ts.ScriptTarget.ES2017;
      case 'ES2018':
        return ts.ScriptTarget.ES2018;
      case 'ES2019':
        return ts.ScriptTarget.ES2019;
      case 'ES2020':
        return ts.ScriptTarget.ES2020;
      case 'ES2021':
        return ts.ScriptTarget.ES2021;
      case 'ES2022':
        return ts.ScriptTarget.ES2022;
      case 'ESNEXT':
        return ts.ScriptTarget.ESNext;
      default:
        return ts.ScriptTarget.ES2020;
    }
  }

  /**
   * Validate syntax of the parsed source file
   */
  private validateSyntaxInternal(sourceFile: ts.SourceFile): boolean {
    // Check for parsing errors
    const diagnostics = (sourceFile as any).parseDiagnostics || [];

    if (diagnostics.length > 0) {
      diagnostics.forEach((diagnostic: ts.Diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        this.addError(`Syntax error: ${message}`);
      });
      return false;
    }

    return true;
  }

  /**
   * Extract imports from the TypeScript AST
   */
  private extractImports(sourceFile: ts.SourceFile, content: string): ParsedImport[] {
    const imports: ParsedImport[] = [];

    this.astNavigator.visitImportDeclarations(sourceFile, node => {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const source = moduleSpecifier.text;
        const importClause = node.importClause;
        const isTypeImport = !!node.importClause?.isTypeOnly;
        const fullStatement = content.substring(node.getStart(), node.getEnd());

        const importNames = this.extractImportNames(importClause);

        imports.push(new ParsedImport(source, importNames, isTypeImport, fullStatement));
      }
    });

    return imports;
  }

  /**
   * Extract import names from import clause
   */
  private extractImportNames(importClause: ts.ImportClause | undefined): string[] {
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

    return importNames;
  }

  /**
   * Extract global variable declarations
   */
  private extractGlobalVariables(sourceFile: ts.SourceFile): ParsedVariable[] {
    const variables: ParsedVariable[] = [];

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

            variables.push(new ParsedVariable(name, type, value, isConst, lineNumber));
          }
        });
      }
    }

    return variables;
  }

  /**
   * Extract helper functions (only top-level functions)
   */
  private extractHelperFunctions(sourceFile: ts.SourceFile, content: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];

    // Visit only top-level statements
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        const name = statement.name.text;
        const isAsync = !!statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);
        const parameters = statement.parameters.map(param => param.getText());
        const returnType = statement.type ? statement.type.getText() : 'void';
        const code = content.substring(statement.getStart(), statement.getEnd());
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(statement.getStart()).line + 1;

        functions.push(new ParsedFunction(name, parameters, returnType, code, lineNumber, isAsync));
      }
    }

    return functions;
  }

  /**
   * Extract metadata from comments
   */
  private extractMetadata(sourceFile: ts.SourceFile, content: string): ParsedMetadata {
    const comments: ParsedComment[] = [];

    // Extract metadata comments using regex patterns
    const metadataPattern =
      /\/\*\s*@apicize-([^-\s]+)-metadata\s*([\s\S]*?)\s*@apicize-[^-\s]+-metadata-end\s*\*\//g;

    let match;
    while ((match = metadataPattern.exec(content)) !== null) {
      const [fullMatch, type, metadataContent] = match;
      const startPosition = match.index;
      const endPosition = match.index + fullMatch.length;

      comments.push(new ParsedComment(type, metadataContent.trim(), startPosition, endPosition));
    }

    return new ParsedMetadata(comments);
  }

  /**
   * Extract test blocks (describe and it)
   */
  private extractTestBlocks(
    sourceFile: ts.SourceFile,
    content: string,
    options: ParsingOptions
  ): TestBlock[] {
    const allBlocks: {
      node: ts.CallExpression;
      testBlock: TestBlock;
    }[] = [];

    // First pass: collect all test blocks without nesting
    this.astNavigator.visitCallExpressions(sourceFile, node => {
      const testBlock = this.parseTestBlock(node, sourceFile, content, options);
      if (testBlock) {
        allBlocks.push({ node, testBlock });
      }
    });

    // Second pass: build hierarchy
    return this.buildTestBlockHierarchy(allBlocks.map(item => item.testBlock));
  }

  /**
   * Parse a single test block from a call expression
   */
  private parseTestBlock(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    content: string,
    options: ParsingOptions
  ): TestBlock | null {
    const expression = node.expression;

    if (!ts.isIdentifier(expression)) {
      return null;
    }

    const functionName = expression.text;

    if ((functionName !== 'describe' && functionName !== 'it') || node.arguments.length < 2) {
      return null;
    }

    const nameArg = node.arguments[0];
    const callbackArg = node.arguments[1];

    if (!ts.isStringLiteral(nameArg)) {
      return null;
    }

    const name = new TestName(nameArg.text);
    const startPosition = node.getStart();
    const endPosition = node.getEnd();
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(startPosition).line + 1;
    const position = new SourcePosition(startPosition, endPosition, lineNumber);

    // Extract the callback function body
    const code = this.extractCallbackCode(callbackArg, content);
    const sourceCode = new SourceCode(code);

    // Determine if this is request-specific
    const isRequestSpecific = this.syntaxAnalyzer.isRequestSpecific(
      content,
      startPosition,
      name.value,
      options.requestIdentifierPatterns || []
    );

    return new TestBlock(
      functionName as 'describe' | 'it',
      name,
      sourceCode,
      position,
      0, // depth will be calculated later
      [],
      isRequestSpecific
    );
  }

  /**
   * Extract code from callback function
   */
  private extractCallbackCode(callbackArg: ts.Node, content: string): string {
    if (ts.isArrowFunction(callbackArg) || ts.isFunctionExpression(callbackArg)) {
      const body = (callbackArg as ts.ArrowFunction | ts.FunctionExpression).body;
      if (body) {
        if (ts.isBlock(body)) {
          return content
            .substring(
              body.getStart() + 1, // Skip opening brace
              body.getEnd() - 1 // Skip closing brace
            )
            .trim();
        } else {
          return content.substring(body.getStart(), body.getEnd());
        }
      }
    }
    return '';
  }

  /**
   * Build hierarchy from flat list of test blocks
   */
  private buildTestBlockHierarchy(allBlocks: TestBlock[]): TestBlock[] {
    const rootBlocks: TestBlock[] = [];

    // Sort by start position to ensure proper nesting
    allBlocks.sort((a, b) => a.position.start - b.position.start);

    for (const block of allBlocks) {
      // Find parent block (the nearest block that contains this one)
      let parent: TestBlock | undefined;

      for (let i = allBlocks.length - 1; i >= 0; i--) {
        const candidate = allBlocks[i];
        if (
          candidate !== block &&
          candidate.type === 'describe' &&
          candidate.position.start < block.position.start &&
          candidate.position.end > block.position.end
        ) {
          if (!parent || candidate.position.start > parent.position.start) {
            parent = candidate;
          }
        }
      }

      if (parent) {
        // Add to parent's children
        parent.addChild(block);
        // Set depth based on parent depth
        block.setDepth(parent.depth + 1);
      } else {
        // Top-level block
        rootBlocks.push(block);
        block.setDepth(0);
      }
    }

    return rootBlocks;
  }

  /**
   * Create empty parsed source for error cases
   */
  private createEmptyParsedSource(content: string): ParsedSource {
    return new ParsedSource([], [], [], [], new SourceCode(content), new ParsedMetadata());
  }

  /**
   * Clear errors and warnings
   */
  private clearErrors(): void {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Add an error message
   */
  private addError(message: string): void {
    this.errors.push(message);
  }

  /**
   * Add a warning message
   */
  private addWarning(message: string): void {
    this.warnings.push(message);
  }
}
