/**
 * Configuration options for source code parsing
 * Provides fine-grained control over the parsing process
 */

/**
 * Options for configuring the source code parsing process
 */
export interface ParsingOptions {
  /**
   * Whether to preserve original code formatting
   * @default true
   */
  preserveFormatting?: boolean;

  /**
   * Whether to include comments in the parsed output
   * @default true
   */
  includeComments?: boolean;

  /**
   * Whether to extract helper functions
   * @default true
   */
  extractHelpers?: boolean;

  /**
   * Patterns to identify request-specific test blocks
   * @default DEFAULT_REQUEST_PATTERNS
   */
  requestIdentifierPatterns?: RegExp[];

  /**
   * Whether to include detailed position information
   * @default true
   */
  includePositions?: boolean;

  /**
   * Whether to extract metadata from comments
   * @default true
   */
  extractMetadata?: boolean;

  /**
   * Maximum depth for nested test block extraction
   * @default 10
   */
  maxNestingDepth?: boolean;

  /**
   * Whether to validate TypeScript syntax during parsing
   * @default false
   */
  validateSyntax?: boolean;

  /**
   * Custom TypeScript compiler options
   */
  compilerOptions?: {
    target?: string;
    module?: string;
    strict?: boolean;
  };
}

/**
 * Default patterns for identifying request-specific test blocks
 */
export const DEFAULT_REQUEST_PATTERNS = [
  /describe\s*\(\s*['"`][^'"`]*request[^'"`]*['"`]/i,
  /describe\s*\(\s*['"`][^'"`]*API[^'"`]*['"`]/i,
  /describe\s*\(\s*['"`][^'"`]*endpoint[^'"`]*['"`]/i,
  /it\s*\(\s*['"`][^'"`]*should\s*(make|send|call)[^'"`]*['"`]/i,
];

/**
 * Default parsing options
 */
export const DEFAULT_PARSING_OPTIONS: Required<ParsingOptions> = {
  preserveFormatting: true,
  includeComments: true,
  extractHelpers: true,
  requestIdentifierPatterns: DEFAULT_REQUEST_PATTERNS,
  includePositions: true,
  extractMetadata: true,
  maxNestingDepth: false,
  validateSyntax: false,
  compilerOptions: {
    target: 'ES2020',
    module: 'CommonJS',
    strict: true,
  },
};
