/**
 * Core interface for source code parsing functionality
 * This interface defines the contract for parsing TypeScript source code
 * and is part of the hexagonal architecture's port definition
 */

import { ParsedSource } from './ParsedSource';
import { ParsingOptions } from './ParsingOptions';

/**
 * Interface for source code parsing capabilities
 * Defines the core contract for parsing TypeScript source files
 */
export interface ISourceCodeParser {
  /**
   * Parse TypeScript source code and extract structured information
   * @param content The TypeScript source code to parse
   * @param options Optional parsing configuration
   * @returns Parsed source code structure
   */
  parseSource(content: string, options?: ParsingOptions): ParsedSource;

  /**
   * Validate that the source code is syntactically correct
   * @param content The TypeScript source code to validate
   * @returns True if the source is valid, false otherwise
   */
  validateSyntax(content: string): boolean;

  /**
   * Get parsing errors if any occurred during parsing
   * @returns Array of error messages
   */
  getParsingErrors(): string[];

  /**
   * Get parsing warnings if any were generated during parsing
   * @returns Array of warning messages
   */
  getParsingWarnings(): string[];
}
