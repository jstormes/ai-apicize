/**
 * Parsing domain bounded context
 * Contains all parsing-related domain models, interfaces, and business logic
 */

import { ApicizeWorkbook, RequestOrGroup } from '../../types';
import { Result } from '../../infrastructure/result';
import { ApicizeError } from '../../infrastructure/errors';

/**
 * Parsing options for different scenarios
 */
export interface ParsingOptions {
  readonly validateOnLoad?: boolean;
  readonly strictMode?: boolean;
  readonly includeWarnings?: boolean;
  readonly maxFileSize?: number;
  readonly encoding?: BufferEncoding;
  readonly preserveComments?: boolean;
  readonly transformVariables?: boolean;
}

/**
 * Parse result with detailed information
 */
export interface ParseResult<T = ApicizeWorkbook> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors: ParseError[];
  readonly warnings: ParseWarning[];
  readonly metadata: ParseMetadata;
}

/**
 * Parse error with location information
 */
export interface ParseError {
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly path?: string;
  readonly severity: 'error' | 'warning';
  readonly suggestions?: string[];
}

/**
 * Parse warning
 */
export interface ParseWarning {
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly path?: string;
  readonly suggestions?: string[];
}

/**
 * Parse metadata
 */
export interface ParseMetadata {
  readonly sourceFile?: string;
  readonly sourceSize?: number;
  readonly parseTime?: number;
  readonly validationTime?: number;
  readonly elementCount?: number;
  readonly version?: string | number;
}

/**
 * File reader interface
 */
export interface FileReader {
  /**
   * Check if file exists
   */
  exists(path: string): Promise<Result<boolean, ApicizeError>>;

  /**
   * Read file content
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<Result<string, ApicizeError>>;

  /**
   * Read file with metadata
   */
  readFileWithMetadata(
    path: string,
    encoding?: BufferEncoding
  ): Promise<
    Result<
      {
        content: string;
        metadata: {
          size: number;
          modified: Date;
          path: string;
        };
      },
      ApicizeError
    >
  >;

  /**
   * Get file stats
   */
  getStats(path: string): Promise<
    Result<
      {
        size: number;
        isFile: boolean;
        isDirectory: boolean;
        modified: Date;
      },
      ApicizeError
    >
  >;
}

/**
 * JSON parser interface
 */
export interface JsonParser {
  /**
   * Parse JSON string
   */
  parse<T = unknown>(content: string): Result<T, ApicizeError>;

  /**
   * Parse JSON with location information
   */
  parseWithLocation<T = unknown>(
    content: string
  ): Result<
    {
      data: T;
      locations: Record<string, { line: number; column: number }>;
    },
    ApicizeError
  >;

  /**
   * Validate JSON syntax
   */
  validateSyntax(content: string): Result<boolean, ApicizeError>;

  /**
   * Stringify with formatting
   */
  stringify(
    data: unknown,
    options?: {
      indent?: number;
      sortKeys?: boolean;
    }
  ): Result<string, ApicizeError>;
}

/**
 * Structure validator interface
 */
export interface StructureValidator {
  /**
   * Validate workbook structure
   */
  validateWorkbook(data: unknown): Result<ApicizeWorkbook, ApicizeError>;

  /**
   * Validate partial structure
   */
  validatePartial(data: unknown, schema: string): Result<boolean, ApicizeError>;

  /**
   * Get validation schema
   */
  getSchema(schemaName: string): Result<object, ApicizeError>;

  /**
   * Custom validation rules
   */
  addCustomRule(name: string, rule: (data: unknown) => Result<boolean, ApicizeError>): void;
}

/**
 * Content extractor interface
 */
export interface ContentExtractor {
  /**
   * Extract requests from workbook
   */
  extractRequests(workbook: ApicizeWorkbook): Result<RequestOrGroup[], ApicizeError>;

  /**
   * Extract metadata from content
   */
  extractMetadata(content: string): Result<Record<string, unknown>, ApicizeError>;

  /**
   * Extract test code from requests
   */
  extractTestCode(workbook: ApicizeWorkbook): Result<
    Array<{
      requestId: string;
      testCode: string;
      language: string;
    }>,
    ApicizeError
  >;

  /**
   * Extract variables from workbook
   */
  extractVariables(workbook: ApicizeWorkbook): Result<Record<string, unknown>, ApicizeError>;
}

/**
 * Parser interface combining all parsing operations
 */
export interface Parser {
  /**
   * Parse content from string
   */
  parseContent(content: string, options?: ParsingOptions): Promise<ParseResult>;

  /**
   * Parse file
   */
  parseFile(filePath: string, options?: ParsingOptions): Promise<ParseResult>;

  /**
   * Parse and validate
   */
  parseAndValidate(data: unknown, options?: ParsingOptions): Result<ApicizeWorkbook, ApicizeError>;

  /**
   * Get parser statistics
   */
  getStats(): {
    filesProcessed: number;
    errorsEncountered: number;
    averageParseTime: number;
  };
}

/**
 * Workbook transformer interface
 */
export interface WorkbookTransformer {
  /**
   * Transform workbook to different version
   */
  transform(
    workbook: ApicizeWorkbook,
    targetVersion: string
  ): Result<ApicizeWorkbook, ApicizeError>;

  /**
   * Apply transformations
   */
  applyTransformations(
    workbook: ApicizeWorkbook,
    transformations: Transformation[]
  ): Result<ApicizeWorkbook, ApicizeError>;

  /**
   * Validate transformation compatibility
   */
  canTransform(fromVersion: string, toVersion: string): boolean;
}

/**
 * Transformation interface
 */
export interface Transformation {
  readonly name: string;
  readonly description: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  apply(workbook: ApicizeWorkbook): Result<ApicizeWorkbook, ApicizeError>;
}

/**
 * Parsing repository interface
 */
export interface ParsingRepository {
  /**
   * Store parsed workbook
   */
  store(key: string, workbook: ApicizeWorkbook): Promise<Result<void, ApicizeError>>;

  /**
   * Retrieve parsed workbook
   */
  retrieve(key: string): Promise<Result<ApicizeWorkbook | null, ApicizeError>>;

  /**
   * Remove cached workbook
   */
  remove(key: string): Promise<Result<void, ApicizeError>>;

  /**
   * List cached workbooks
   */
  list(): Promise<Result<string[], ApicizeError>>;

  /**
   * Clear all cached data
   */
  clear(): Promise<Result<void, ApicizeError>>;
}

/**
 * Parsing service interface
 */
export interface ParsingService {
  /**
   * Parse workbook with caching
   */
  parseWorkbook(source: string | object, options?: ParsingOptions): Promise<ParseResult>;

  /**
   * Validate workbook
   */
  validateWorkbook(workbook: ApicizeWorkbook): Result<boolean, ApicizeError>;

  /**
   * Get workbook metadata
   */
  getWorkbookMetadata(workbook: ApicizeWorkbook): Result<
    {
      version: string | number;
      requestCount: number;
      groupCount: number;
      scenarioCount: number;
      hasTests: boolean;
    },
    ApicizeError
  >;

  /**
   * Transform workbook
   */
  transformWorkbook(
    workbook: ApicizeWorkbook,
    options: {
      targetVersion?: string;
      transformations?: string[];
    }
  ): Result<ApicizeWorkbook, ApicizeError>;
}

/**
 * Parsing domain events
 */
export enum ParsingDomainEvent {
  PARSE_STARTED = 'parse.started',
  PARSE_COMPLETED = 'parse.completed',
  PARSE_FAILED = 'parse.failed',
  VALIDATION_STARTED = 'validation.started',
  VALIDATION_COMPLETED = 'validation.completed',
  VALIDATION_FAILED = 'validation.failed',
  TRANSFORMATION_APPLIED = 'transformation.applied',
  CACHE_HIT = 'cache.hit',
  CACHE_MISS = 'cache.miss',
}

/**
 * Parsing domain event data
 */
export interface ParsingDomainEventData {
  type: ParsingDomainEvent;
  timestamp: Date;
  source?: string;
  parseTime?: number;
  errorCount?: number;
  warningCount?: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Parse error codes
 */
export enum ParseErrorCode {
  INVALID_JSON = 'INVALID_JSON',
  MISSING_VERSION = 'MISSING_VERSION',
  INVALID_VERSION = 'INVALID_VERSION',
  MISSING_REQUESTS = 'MISSING_REQUESTS',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_STRUCTURE = 'INVALID_STRUCTURE',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  ENCODING_ERROR = 'ENCODING_ERROR',
  TRANSFORMATION_FAILED = 'TRANSFORMATION_FAILED',
}

/**
 * Workbook analyzer interface
 */
export interface WorkbookAnalyzer {
  /**
   * Analyze workbook complexity
   */
  analyzeComplexity(workbook: ApicizeWorkbook): Result<
    {
      score: number;
      factors: Array<{
        name: string;
        impact: number;
        description: string;
      }>;
    },
    ApicizeError
  >;

  /**
   * Detect potential issues
   */
  detectIssues(workbook: ApicizeWorkbook): Result<
    Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      location?: string;
      suggestions?: string[];
    }>,
    ApicizeError
  >;

  /**
   * Get usage statistics
   */
  getUsageStats(workbook: ApicizeWorkbook): Result<
    {
      totalRequests: number;
      requestsByMethod: Record<string, number>;
      bodyTypes: Record<string, number>;
      authMethods: Record<string, number>;
      testCoverage: number;
    },
    ApicizeError
  >;
}
