/**
 * Mock implementation of ISourceCodeParser for testing
 * Provides controllable behavior for unit tests
 */

import { ISourceCodeParser } from '../../infrastructure/parsing/ISourceCodeParser';
import { ParsedSource } from '../../infrastructure/parsing/ParsedSource';
import { ParsingOptions } from '../../infrastructure/parsing/ParsingOptions';

/**
 * Mock source code parser with configurable responses
 */
export class MockSourceCodeParser implements ISourceCodeParser {
  private responses = new Map<string, ParsedSource>();
  private validationResults = new Map<string, boolean>();
  private errors: string[] = [];
  private warnings: string[] = [];
  private shouldThrow = false;
  private throwError: Error | null = null;

  /**
   * Configure a mock response for specific content
   * @param content Source code content to match
   * @param result Parsed source to return
   */
  mockParseResponse(content: string, result: ParsedSource): void {
    this.responses.set(content, result);
  }

  /**
   * Configure validation result for specific content
   * @param content Source code content to match
   * @param isValid Whether the content should be considered valid
   */
  mockValidationResult(content: string, isValid: boolean): void {
    this.validationResults.set(content, isValid);
  }

  /**
   * Set mock errors to be returned
   * @param errors Array of error messages
   */
  setMockErrors(errors: string[]): void {
    this.errors = [...errors];
  }

  /**
   * Set mock warnings to be returned
   * @param warnings Array of warning messages
   */
  setMockWarnings(warnings: string[]): void {
    this.warnings = [...warnings];
  }

  /**
   * Configure the parser to throw an error
   * @param error Error to throw, or null to stop throwing
   */
  setShouldThrow(error: Error | null): void {
    this.shouldThrow = !!error;
    this.throwError = error;
  }

  /**
   * Parse source code (mock implementation)
   */
  parseSource(content: string, options?: ParsingOptions): ParsedSource {
    if (this.shouldThrow && this.throwError) {
      throw this.throwError;
    }

    const result = this.responses.get(content);
    if (result) {
      return result;
    }

    // Default empty response
    return new ParsedSource([]);
  }

  /**
   * Validate syntax (mock implementation)
   */
  validateSyntax(content: string): boolean {
    if (this.shouldThrow && this.throwError) {
      throw this.throwError;
    }

    const result = this.validationResults.get(content);
    return result !== undefined ? result : true;
  }

  /**
   * Get parsing errors (mock implementation)
   */
  getParsingErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Get parsing warnings (mock implementation)
   */
  getParsingWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Clear all mock data
   */
  reset(): void {
    this.responses.clear();
    this.validationResults.clear();
    this.errors = [];
    this.warnings = [];
    this.shouldThrow = false;
    this.throwError = null;
  }

  /**
   * Get call history for testing
   */
  getCallHistory(): {
    parseSourceCalls: { content: string; options?: ParsingOptions }[];
    validateSyntaxCalls: string[];
  } {
    // In a real implementation, this would track calls
    return {
      parseSourceCalls: [],
      validateSyntaxCalls: [],
    };
  }
}
