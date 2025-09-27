import { Result } from '../../shared/Result';
import { ValidationError, InfrastructureError } from '../../shared/DomainError';
import { TestSuite } from '../entities/TestSuite';
import { TestBlock } from '../entities/TestBlock';
import { CodeMetadata } from '../entities/CodeMetadata';

/**
 * Repository interface for persisting and retrieving test suites
 * This follows the Repository pattern from Domain-Driven Design
 */
export interface ITestRepository {
  /**
   * Saves a test suite
   */
  save(testSuite: TestSuite): Promise<Result<void, InfrastructureError>>;

  /**
   * Finds a test suite by ID
   */
  findById(id: string): Promise<Result<TestSuite | undefined, InfrastructureError>>;

  /**
   * Finds test suites by name pattern
   */
  findByNamePattern(pattern: string): Promise<Result<TestSuite[], InfrastructureError>>;

  /**
   * Finds all test suites
   */
  findAll(): Promise<Result<TestSuite[], InfrastructureError>>;

  /**
   * Deletes a test suite by ID
   */
  delete(id: string): Promise<Result<boolean, InfrastructureError>>;

  /**
   * Checks if a test suite exists
   */
  exists(id: string): Promise<Result<boolean, InfrastructureError>>;

  /**
   * Gets statistics about stored test suites
   */
  getStatistics(): Promise<Result<RepositoryStatistics, InfrastructureError>>;
}

/**
 * Repository interface for test blocks (if needed separately from suites)
 */
export interface ITestBlockRepository {
  /**
   * Finds test blocks by criteria
   */
  findByCriteria(criteria: TestBlockSearchCriteria): Promise<Result<TestBlock[], InfrastructureError>>;

  /**
   * Finds request-specific test blocks
   */
  findRequestSpecific(): Promise<Result<TestBlock[], InfrastructureError>>;

  /**
   * Finds shared (non-request-specific) test blocks
   */
  findShared(): Promise<Result<TestBlock[], InfrastructureError>>;

  /**
   * Finds test blocks by depth
   */
  findByDepth(depth: number): Promise<Result<TestBlock[], InfrastructureError>>;

  /**
   * Finds test blocks containing specific patterns
   */
  findByPattern(pattern: RegExp): Promise<Result<TestBlock[], InfrastructureError>>;
}

/**
 * Repository interface for code metadata
 */
export interface ICodeMetadataRepository {
  /**
   * Saves code metadata
   */
  save(metadata: CodeMetadata): Promise<Result<void, InfrastructureError>>;

  /**
   * Finds metadata by source file
   */
  findBySourceFile(sourceFile: string): Promise<Result<CodeMetadata | undefined, InfrastructureError>>;

  /**
   * Finds metadata containing specific request IDs
   */
  findByRequestId(requestId: string): Promise<Result<CodeMetadata[], InfrastructureError>>;

  /**
   * Finds all metadata
   */
  findAll(): Promise<Result<CodeMetadata[], InfrastructureError>>;

  /**
   * Deletes metadata for a source file
   */
  deleteBySourceFile(sourceFile: string): Promise<Result<boolean, InfrastructureError>>;
}

/**
 * Search criteria for test blocks
 */
export interface TestBlockSearchCriteria {
  readonly namePattern?: RegExp;
  readonly type?: 'describe' | 'it';
  readonly isRequestSpecific?: boolean;
  readonly minDepth?: number;
  readonly maxDepth?: number;
  readonly hasMetadata?: boolean;
  readonly containsPattern?: RegExp;
  readonly suiteId?: string;
}

/**
 * Repository statistics
 */
export interface RepositoryStatistics {
  readonly totalTestSuites: number;
  readonly totalTestBlocks: number;
  readonly totalMetadataRecords: number;
  readonly averageBlocksPerSuite: number;
  readonly requestSpecificPercentage: number;
  readonly storageSize: number; // in bytes
  readonly lastModified: Date;
}

/**
 * Interface for a unit of work that coordinates multiple repositories
 */
export interface ITestAnalysisUnitOfWork {
  readonly testSuites: ITestRepository;
  readonly testBlocks: ITestBlockRepository;
  readonly metadata: ICodeMetadataRepository;

  /**
   * Begins a transaction
   */
  begin(): Promise<Result<void, InfrastructureError>>;

  /**
   * Commits the current transaction
   */
  commit(): Promise<Result<void, InfrastructureError>>;

  /**
   * Rolls back the current transaction
   */
  rollback(): Promise<Result<void, InfrastructureError>>;

  /**
   * Checks if a transaction is active
   */
  isActive(): boolean;
}

/**
 * Query interface for complex test suite queries
 */
export interface ITestSuiteQuery {
  /**
   * Finds test suites with specific characteristics
   */
  findWithCharacteristics(characteristics: SuiteCharacteristics): Promise<Result<TestSuite[], InfrastructureError>>;

  /**
   * Finds test suites that contain specific test patterns
   */
  findContainingPatterns(patterns: RegExp[]): Promise<Result<TestSuite[], InfrastructureError>>;

  /**
   * Finds test suites by metadata criteria
   */
  findByMetadataCriteria(criteria: MetadataCriteria): Promise<Result<TestSuite[], InfrastructureError>>;

  /**
   * Gets aggregated statistics across multiple test suites
   */
  getAggregatedStatistics(suiteIds: string[]): Promise<Result<AggregatedStatistics, InfrastructureError>>;
}

/**
 * Characteristics for test suite search
 */
export interface SuiteCharacteristics {
  readonly hasAsyncTests?: boolean;
  readonly hasRequestSpecificTests?: boolean;
  readonly minTestCount?: number;
  readonly maxTestCount?: number;
  readonly minDepth?: number;
  readonly maxDepth?: number;
  readonly sourceLanguage?: string;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

/**
 * Criteria for metadata-based search
 */
export interface MetadataCriteria {
  readonly hasRequestMetadata?: boolean;
  readonly hasGroupMetadata?: boolean;
  readonly requestIds?: string[];
  readonly groupIds?: string[];
  readonly customMetadataKeys?: string[];
}

/**
 * Aggregated statistics across multiple test suites
 */
export interface AggregatedStatistics {
  readonly totalSuites: number;
  readonly totalBlocks: number;
  readonly totalItBlocks: number;
  readonly totalDescribeBlocks: number;
  readonly totalRequestSpecificBlocks: number;
  readonly averageDepth: number;
  readonly maxDepth: number;
  readonly asyncTestPercentage: number;
  readonly metadataCoveragePercentage: number;
  readonly distributionByType: Record<string, number>;
  readonly distributionByDepth: Record<number, number>;
}

/**
 * Factory interface for creating repositories
 */
export interface IRepositoryFactory {
  createTestRepository(): ITestRepository;
  createTestBlockRepository(): ITestBlockRepository;
  createCodeMetadataRepository(): ICodeMetadataRepository;
  createUnitOfWork(): ITestAnalysisUnitOfWork;
  createTestSuiteQuery(): ITestSuiteQuery;
}