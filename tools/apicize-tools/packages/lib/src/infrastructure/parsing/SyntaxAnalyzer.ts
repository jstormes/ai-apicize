/**
 * Syntax analysis utility for determining test block characteristics
 * Provides methods for analyzing code patterns and metadata
 */

import { DEFAULT_REQUEST_PATTERNS } from './ParsingOptions';

/**
 * Utility class for analyzing TypeScript syntax and patterns
 * Focuses on test-specific analysis and classification
 */
export class SyntaxAnalyzer {
  /**
   * Determine if a test block is request-specific based on various criteria
   * @param content The full source code content
   * @param startPosition The start position of the test block
   * @param testName The name of the test block
   * @param patterns Custom patterns to identify request-specific tests
   * @returns True if the test is determined to be request-specific
   */
  isRequestSpecific(
    content: string,
    startPosition: number,
    testName: string,
    patterns: RegExp[] = DEFAULT_REQUEST_PATTERNS
  ): boolean {
    // Check test name patterns
    if (this.matchesRequestPatterns(testName, patterns)) {
      return true;
    }

    // Look for metadata comments before this test block
    if (this.hasRequestMetadata(content, startPosition)) {
      return true;
    }

    // Check for request-related code patterns within the test
    if (this.containsRequestPatterns(content, startPosition)) {
      return true;
    }

    return false;
  }

  /**
   * Check if test name matches request-specific patterns
   * @param testName The name of the test
   * @param patterns Array of regex patterns to match
   * @returns True if any pattern matches
   */
  private matchesRequestPatterns(testName: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(testName));
  }

  /**
   * Check for metadata comments indicating request-specific tests
   * @param content The source code content
   * @param startPosition The position to search before
   * @returns True if request metadata is found
   */
  private hasRequestMetadata(content: string, startPosition: number): boolean {
    // Look for metadata comments before this test block (within reasonable distance)
    const searchStart = Math.max(0, startPosition - 500);
    const beforeText = content.substring(searchStart, startPosition);

    // Check for Apicize metadata comments
    const metadataPatterns = [
      /\/\*\s*@apicize-request-metadata\s*/,
      /\/\*\s*@apicize-group-metadata\s*/,
      /\/\/\s*@apicize-request:/,
      /\/\/\s*@request-specific/,
    ];

    return metadataPatterns.some(pattern => pattern.test(beforeText));
  }

  /**
   * Check for request-related code patterns within the test block
   * @param content The source code content
   * @param startPosition The start position of the test block
   * @returns True if request patterns are found
   */
  private containsRequestPatterns(content: string, startPosition: number): boolean {
    // Find the end of this test block (simplified approach)
    const testBlock = this.extractTestBlock(content, startPosition);

    const requestIndicators = [
      /response\./,
      /\.status/,
      /\.body/,
      /\.headers/,
      /expect\(response/,
      /request\./,
      /\.url/,
      /\.method/,
      /\.send\(/,
      /\.get\(/,
      /\.post\(/,
      /\.put\(/,
      /\.delete\(/,
      /\.patch\(/,
    ];

    return requestIndicators.some(pattern => pattern.test(testBlock));
  }

  /**
   * Extract the content of a test block starting from a position
   * @param content The source code content
   * @param startPosition The start position
   * @returns The extracted test block content
   */
  private extractTestBlock(content: string, startPosition: number): string {
    // Simple brace matching to find the end of the test block
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let i = startPosition;

    // Find the opening brace
    while (i < content.length && content[i] !== '{') {
      i++;
    }

    if (i >= content.length) {
      return '';
    }

    const blockStart = i;
    braceCount = 1;
    i++;

    // Find the matching closing brace
    while (i < content.length && braceCount > 0) {
      const char = content[i];

      if (inString) {
        if (char === stringChar && content[i - 1] !== '\\') {
          inString = false;
        }
      } else {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
      }

      i++;
    }

    return content.substring(blockStart, i);
  }

  /**
   * Analyze the complexity of a test block
   * @param testContent The content of the test block
   * @returns Object with complexity metrics
   */
  analyzeComplexity(testContent: string): {
    lineCount: number;
    statementCount: number;
    nestingDepth: number;
    hasAsyncOperations: boolean;
    hasLoops: boolean;
    hasConditionals: boolean;
  } {
    const lines = testContent.split('\n');
    const lineCount = lines.filter(line => line.trim().length > 0).length;

    // Count statements (simplified)
    const statementCount = (testContent.match(/;/g) || []).length;

    // Check for async operations
    const hasAsyncOperations = /await\s+|\.then\(|\.catch\(|async\s+/.test(testContent);

    // Check for loops
    const hasLoops = /\b(for|while|do)\s*\(/.test(testContent);

    // Check for conditionals
    const hasConditionals = /\b(if|switch|case)\s*\(/.test(testContent);

    // Calculate nesting depth (simplified)
    const nestingDepth = this.calculateNestingDepth(testContent);

    return {
      lineCount,
      statementCount,
      nestingDepth,
      hasAsyncOperations,
      hasLoops,
      hasConditionals,
    };
  }

  /**
   * Calculate the maximum nesting depth in a code block
   * @param code The code to analyze
   * @returns The maximum nesting depth
   */
  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (inString) {
        if (char === stringChar && code[i - 1] !== '\\') {
          inString = false;
        }
      } else {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === '}') {
          currentDepth--;
        }
      }
    }

    return maxDepth;
  }

  /**
   * Extract variable references from test code
   * @param testContent The content of the test
   * @returns Array of variable names referenced in the test
   */
  extractVariableReferences(testContent: string): string[] {
    const variables = new Set<string>();

    // Look for variable references like response, $, expect, etc.
    const variablePatterns = [
      /\b(response|req|request)\b/g,
      /\$\.(\w+)/g,
      /\b(expect|assert|should)\b/g,
      /\b(console)\.\w+/g,
    ];

    variablePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(testContent)) !== null) {
        if (match[1]) {
          variables.add(match[1]);
        } else {
          variables.add(match[0]);
        }
      }
    });

    return Array.from(variables);
  }

  /**
   * Check if a test block contains assertion statements
   * @param testContent The content of the test
   * @returns True if assertions are found
   */
  containsAssertions(testContent: string): boolean {
    const assertionPatterns = [
      /expect\(/,
      /assert\./,
      /should\./,
      /\.to\./,
      /\.equal\(/,
      /\.be\./,
      /\.have\./,
    ];

    return assertionPatterns.some(pattern => pattern.test(testContent));
  }
}
