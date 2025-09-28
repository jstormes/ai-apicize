/**
 * Data Transfer Object for test extraction results
 * Contains all information extracted from source code analysis
 */

import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { CodeMetadata } from '../../domain/test-analysis/entities/CodeMetadata';
import {
  ParsedImport,
  ParsedVariable,
  ParsedFunction,
} from '../../infrastructure/parsing/ParsedSource';

/**
 * Result of test extraction operation
 * Contains categorized tests and extracted components
 */
export class TestExtractionResult {
  constructor(
    public readonly testSuite: TestSuite,
    public readonly requestSpecificTests: TestBlock[],
    public readonly sharedTests: TestBlock[],
    public readonly imports: ParsedImport[],
    public readonly globalVariables: ParsedVariable[],
    public readonly helperFunctions: ParsedFunction[],
    public readonly metadata: CodeMetadata,
    public readonly warnings: string[] = []
  ) {}

  /**
   * Get all test blocks regardless of classification
   * @returns Array of all test blocks
   */
  getAllTests(): TestBlock[] {
    return [...this.requestSpecificTests, ...this.sharedTests];
  }

  /**
   * Get extraction statistics
   * @returns Object containing various counts and metrics
   */
  getStatistics() {
    return {
      totalTests: this.getAllTests().length,
      requestSpecificCount: this.requestSpecificTests.length,
      sharedTestsCount: this.sharedTests.length,
      importsCount: this.imports.length,
      globalVariablesCount: this.globalVariables.length,
      helperFunctionsCount: this.helperFunctions.length,
      warningsCount: this.warnings.length,
      hasMetadata: this.metadata.hasMetadata,
      testSuiteId: this.testSuite.id.value,
    };
  }

  /**
   * Check if the extraction was successful
   * @returns True if tests were found and no critical issues occurred
   */
  isSuccessful(): boolean {
    return this.getAllTests().length > 0;
  }

  /**
   * Get a summary of the extraction results
   * @returns Human-readable summary
   */
  getSummary(): string {
    const stats = this.getStatistics();
    const lines = [
      `Test Extraction Summary:`,
      `- Total tests found: ${stats.totalTests}`,
      `- Request-specific tests: ${stats.requestSpecificCount}`,
      `- Shared tests: ${stats.sharedTestsCount}`,
      `- Imports: ${stats.importsCount}`,
      `- Global variables: ${stats.globalVariablesCount}`,
      `- Helper functions: ${stats.helperFunctionsCount}`,
    ];

    if (stats.warningsCount > 0) {
      lines.push(`- Warnings: ${stats.warningsCount}`);
    }

    if (stats.hasMetadata) {
      lines.push(`- Metadata found: Yes`);
    }

    return lines.join('\n');
  }

  /**
   * Find tests by name pattern
   * @param pattern String or regex pattern to match
   * @returns Array of matching test blocks
   */
  findTestsByName(pattern: string | RegExp): TestBlock[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.getAllTests().filter(test => regex.test(test.name.value));
  }

  /**
   * Group tests by their depth level
   * @returns Map of depth level to test blocks at that level
   */
  groupTestsByDepth(): Map<number, TestBlock[]> {
    const grouped = new Map<number, TestBlock[]>();

    for (const test of this.getAllTests()) {
      const depth = test.depth;
      if (!grouped.has(depth)) {
        grouped.set(depth, []);
      }
      grouped.get(depth)!.push(test);
    }

    return grouped;
  }

  /**
   * Get imports of a specific type
   * @param type Type of import to filter ('module', 'type', etc.)
   * @returns Array of matching imports
   */
  getImportsByType(type: 'type' | 'value'): ParsedImport[] {
    return this.imports.filter(imp => {
      if (type === 'type') {
        return imp.isTypeImport;
      } else {
        return !imp.isTypeImport;
      }
    });
  }

  /**
   * Get test blocks that contain specific patterns
   * @param pattern Pattern to search for in test code
   * @returns Array of test blocks containing the pattern
   */
  getTestsContaining(pattern: string | RegExp): TestBlock[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.getAllTests().filter(test => regex.test(test.code.value));
  }

  /**
   * Export to a plain object for serialization
   * @returns Plain object representation
   */
  toPlainObject() {
    return {
      testSuite: {
        id: this.testSuite.id.value,
        name: this.testSuite.name,
        testBlocks: this.testSuite.testBlocks.length,
      },
      requestSpecificTests: this.requestSpecificTests.map(test => ({
        type: test.type,
        name: test.name.value,
        depth: test.depth,
        lineNumber: test.position.lineNumber,
      })),
      sharedTests: this.sharedTests.map(test => ({
        type: test.type,
        name: test.name.value,
        depth: test.depth,
        lineNumber: test.position.lineNumber,
      })),
      imports: this.imports.map(imp => ({
        source: imp.source,
        imports: imp.imports,
        isTypeImport: imp.isTypeImport,
      })),
      globalVariables: this.globalVariables.map(variable => ({
        name: variable.name,
        type: variable.type,
        isConst: variable.isConst,
        lineNumber: variable.lineNumber,
      })),
      helperFunctions: this.helperFunctions.map(func => ({
        name: func.name,
        parameters: func.parameters,
        returnType: func.returnType,
        isAsync: func.isAsync,
        lineNumber: func.lineNumber,
      })),
      metadata: {
        hasMetadata: this.metadata.hasMetadata,
      },
      statistics: this.getStatistics(),
      warnings: this.warnings,
    };
  }
}
