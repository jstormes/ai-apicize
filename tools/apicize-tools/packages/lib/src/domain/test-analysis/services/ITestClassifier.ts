import { Result } from '../../shared/Result';
import { BusinessRuleError } from '../../shared/DomainError';
import { TestBlock } from '../entities/TestBlock';
import { RequestPattern } from '../value-objects/RequestPattern';
import { SourceCode } from '../value-objects/SourceCode';

/**
 * Domain service interface for classifying tests as request-specific or shared
 */
export interface ITestClassifier {
  /**
   * Classifies a single test block
   */
  classify(
    testBlock: TestBlock,
    context: ClassificationContext
  ): Result<ClassificationResult, BusinessRuleError>;

  /**
   * Classifies multiple test blocks in batch
   */
  classifyBatch(
    testBlocks: TestBlock[],
    context: ClassificationContext
  ): Result<BatchClassificationResult, BusinessRuleError>;

  /**
   * Adds a new classification strategy
   */
  addStrategy(strategy: IClassificationStrategy): void;

  /**
   * Removes a classification strategy
   */
  removeStrategy(strategyName: string): boolean;

  /**
   * Gets all available strategies
   */
  getStrategies(): readonly IClassificationStrategy[];
}

/**
 * Interface for individual classification strategies
 */
export interface IClassificationStrategy {
  readonly name: string;
  readonly description: string;
  readonly priority: number; // Higher priority strategies are evaluated first

  /**
   * Determines if this strategy can classify the given test block
   */
  canClassify(testBlock: TestBlock, context: ClassificationContext): boolean;

  /**
   * Classifies the test block as request-specific or not
   */
  classify(testBlock: TestBlock, context: ClassificationContext): Result<boolean, BusinessRuleError>;
}

/**
 * Context information for classification
 */
export interface ClassificationContext {
  readonly patterns: RequestPattern[];
  readonly sourceCode: SourceCode;
  readonly precedingContent: string;
  readonly followingContent: string;
  readonly options: ClassificationOptions;
}

/**
 * Options for classification behavior
 */
export interface ClassificationOptions {
  readonly propagateToParents: boolean;
  readonly propagateToChildren: boolean;
  readonly respectExistingClassification: boolean;
  readonly enableHeuristics: boolean;
  readonly confidenceThreshold: number; // 0.0 to 1.0
}

/**
 * Result of classifying a single test block
 */
export interface ClassificationResult {
  readonly testBlockId: string;
  readonly isRequestSpecific: boolean;
  readonly confidence: number; // 0.0 to 1.0
  readonly strategyUsed: string;
  readonly reasons: string[];
  readonly wasChanged: boolean;
}

/**
 * Result of batch classification
 */
export interface BatchClassificationResult {
  readonly totalBlocks: number;
  readonly classifiedBlocks: number;
  readonly changedBlocks: number;
  readonly requestSpecificBlocks: number;
  readonly sharedBlocks: number;
  readonly results: ClassificationResult[];
  readonly errors: Array<{ blockId: string; error: string }>;
}

/**
 * Strategy that classifies based on test name patterns
 */
export interface IPatternBasedStrategy extends IClassificationStrategy {
  readonly patterns: readonly RequestPattern[];
  addPattern(pattern: RequestPattern): void;
  removePattern(patternName: string): boolean;
}

/**
 * Strategy that classifies based on metadata comments
 */
export interface IMetadataBasedStrategy extends IClassificationStrategy {
  readonly metadataPatterns: readonly RegExp[];
  addMetadataPattern(pattern: RegExp): void;
}

/**
 * Strategy that classifies based on code content analysis
 */
export interface IContentBasedStrategy extends IClassificationStrategy {
  readonly codePatterns: readonly RegExp[];
  readonly keywords: readonly string[];
  addCodePattern(pattern: RegExp): void;
  addKeyword(keyword: string): void;
}

/**
 * Strategy that classifies based on test structure and hierarchy
 */
export interface IStructureBasedStrategy extends IClassificationStrategy {
  readonly maxDepthForRequestSpecific: number;
  readonly parentInfluenceWeight: number; // 0.0 to 1.0
}

/**
 * Factory interface for creating classification strategies
 */
export interface IClassificationStrategyFactory {
  createPatternBasedStrategy(patterns: RequestPattern[]): IPatternBasedStrategy;
  createMetadataBasedStrategy(metadataPatterns: RegExp[]): IMetadataBasedStrategy;
  createContentBasedStrategy(codePatterns: RegExp[], keywords: string[]): IContentBasedStrategy;
  createStructureBasedStrategy(maxDepth: number, parentWeight: number): IStructureBasedStrategy;
  createDefaultStrategies(): IClassificationStrategy[];
}