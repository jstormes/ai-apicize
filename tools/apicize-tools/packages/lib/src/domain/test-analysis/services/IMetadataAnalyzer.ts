import { Result } from '../../shared/Result';
import { ValidationError, BusinessRuleError } from '../../shared/DomainError';
import {
  CodeMetadata,
  RequestMetadata,
  GroupMetadata,
  TestMetadata,
} from '../entities/CodeMetadata';
import { SourceCode } from '../value-objects/SourceCode';
import { SourcePosition } from '../value-objects/SourcePosition';

/**
 * Domain service interface for analyzing and extracting metadata from source code
 */
export interface IMetadataAnalyzer {
  /**
   * Analyzes source code and extracts all metadata
   */
  analyze(sourceCode: SourceCode, options?: AnalysisOptions): Result<CodeMetadata, ValidationError>;

  /**
   * Legacy method - analyzes metadata (for compatibility)
   */
  analyzeMetadata(sourceCode: SourceCode): Result<CodeMetadata, ValidationError>;

  /**
   * Extracts only request metadata from source code
   */
  extractRequestMetadata(sourceCode: SourceCode): Result<RequestMetadata[], ValidationError>;

  /**
   * Extracts only group metadata from source code
   */
  extractGroupMetadata(sourceCode: SourceCode): Result<GroupMetadata[], ValidationError>;

  /**
   * Extracts only test metadata from source code
   */
  extractTestMetadata(sourceCode: SourceCode): Result<TestMetadata[], ValidationError>;

  /**
   * Validates metadata consistency and completeness
   */
  validateMetadata(metadata: CodeMetadata): Result<MetadataValidationReport, BusinessRuleError>;

  /**
   * Finds metadata that affects a specific source position
   */
  findMetadataAtPosition(
    metadata: CodeMetadata,
    position: SourcePosition
  ): Result<PositionalMetadata, ValidationError>;
}

/**
 * Options for metadata analysis
 */
export interface AnalysisOptions {
  readonly includeComments: boolean;
  readonly includeAnnotations: boolean;
  readonly includeJSDoc: boolean;
  readonly validateStructure: boolean;
  readonly extractCustomMetadata: boolean;
  readonly metadataPatterns: readonly RegExp[];
  readonly maxDepthForSearch: number;
}

/**
 * Metadata found at a specific position
 */
export interface PositionalMetadata {
  readonly position: SourcePosition;
  readonly requestMetadata: RequestMetadata[];
  readonly groupMetadata: GroupMetadata[];
  readonly testMetadata: TestMetadata[];
  readonly customMetadata: Record<string, unknown>;
  readonly isRequestSpecific: boolean;
}

/**
 * Report of metadata validation
 */
export interface MetadataValidationReport {
  readonly isValid: boolean;
  readonly errors: MetadataValidationError[];
  readonly warnings: MetadataValidationWarning[];
  readonly statistics: MetadataStatistics;
  readonly recommendations: string[];
}

/**
 * Metadata validation error
 */
export interface MetadataValidationError {
  readonly type: 'missing_required' | 'invalid_format' | 'duplicate_id' | 'orphaned_reference';
  readonly message: string;
  readonly position?: SourcePosition;
  readonly context: Record<string, unknown>;
}

/**
 * Metadata validation warning
 */
export interface MetadataValidationWarning {
  readonly type:
    | 'unused_metadata'
    | 'deprecated_format'
    | 'inconsistent_naming'
    | 'missing_optional';
  readonly message: string;
  readonly position?: SourcePosition;
  readonly context: Record<string, unknown>;
}

/**
 * Statistics about extracted metadata
 */
export interface MetadataStatistics {
  readonly totalMetadataBlocks: number;
  readonly requestMetadataCount: number;
  readonly groupMetadataCount: number;
  readonly testMetadataCount: number;
  readonly customMetadataCount: number;
  readonly averageMetadataPerTest: number;
  readonly metadataCoveragePercentage: number;
  readonly duplicateIdCount: number;
  readonly orphanedReferenceCount: number;
}

/**
 * Interface for metadata extractors that handle specific formats
 */
export interface IMetadataExtractor {
  readonly name: string;
  readonly supportedFormats: readonly string[];

  /**
   * Checks if this extractor can handle the given content
   */
  canExtract(content: string): boolean;

  /**
   * Extracts metadata from the content
   */
  extract(content: string, position: SourcePosition): Result<ExtractedMetadata, ValidationError>;
}

/**
 * Raw extracted metadata before processing
 */
export interface ExtractedMetadata {
  readonly type: 'request' | 'group' | 'test' | 'custom';
  readonly content: Record<string, unknown>;
  readonly position: SourcePosition;
  readonly format: string;
  readonly confidence: number; // 0.0 to 1.0
}

/**
 * Interface for Apicize-specific metadata extractor
 */
export interface IApicizeMetadataExtractor extends IMetadataExtractor {
  /**
   * Extracts Apicize request metadata
   */
  extractRequestMetadata(content: string): Result<RequestMetadata[], ValidationError>;

  /**
   * Extracts Apicize group metadata
   */
  extractGroupMetadata(content: string): Result<GroupMetadata[], ValidationError>;

  /**
   * Validates Apicize metadata format
   */
  validateApicizeFormat(content: string): Result<FormatValidationResult, ValidationError>;
}

/**
 * Result of format validation
 */
export interface FormatValidationResult {
  readonly isValid: boolean;
  readonly version?: string;
  readonly errors: string[];
  readonly warnings: string[];
  readonly recommendations: string[];
}

/**
 * Interface for JSDoc metadata extractor
 */
export interface IJSDocMetadataExtractor extends IMetadataExtractor {
  /**
   * Extracts JSDoc tags
   */
  extractTags(content: string): Result<JSDocTag[], ValidationError>;

  /**
   * Extracts parameter documentation
   */
  extractParameters(content: string): Result<ParameterDoc[], ValidationError>;
}

/**
 * JSDoc tag information
 */
export interface JSDocTag {
  readonly tag: string;
  readonly value: string;
  readonly description?: string;
  readonly position: SourcePosition;
}

/**
 * Parameter documentation
 */
export interface ParameterDoc {
  readonly name: string;
  readonly type?: string;
  readonly description?: string;
  readonly optional: boolean;
  readonly defaultValue?: string;
}

/**
 * Interface for custom metadata extractor
 */
export interface ICustomMetadataExtractor extends IMetadataExtractor {
  /**
   * Adds a custom pattern for metadata extraction
   */
  addPattern(name: string, pattern: RegExp, processor: MetadataProcessor): void;

  /**
   * Removes a custom pattern
   */
  removePattern(name: string): boolean;

  /**
   * Gets all registered patterns
   */
  getPatterns(): readonly CustomMetadataPattern[];
}

/**
 * Custom metadata pattern
 */
export interface CustomMetadataPattern {
  readonly name: string;
  readonly pattern: RegExp;
  readonly processor: MetadataProcessor;
  readonly priority: number;
}

/**
 * Function type for processing extracted metadata
 */
export type MetadataProcessor = (
  match: RegExpMatchArray,
  position: SourcePosition
) => Result<Record<string, unknown>, ValidationError>;

/**
 * Factory interface for creating metadata analyzers
 */
export interface IMetadataAnalyzerFactory {
  createAnalyzer(extractors: IMetadataExtractor[]): IMetadataAnalyzer;
  createApicizeExtractor(): IApicizeMetadataExtractor;
  createJSDocExtractor(): IJSDocMetadataExtractor;
  createCustomExtractor(): ICustomMetadataExtractor;
  createDefaultAnalyzer(): IMetadataAnalyzer;
}
