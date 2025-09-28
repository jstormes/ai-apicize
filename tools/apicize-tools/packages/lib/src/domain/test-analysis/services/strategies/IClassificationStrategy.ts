/**
 * Strategy interface for test classification
 * Defines the contract for different classification approaches
 */

import { TestBlock } from '../../entities/TestBlock';
import { Result } from '../../../shared/Result';
import { DomainError } from '../../../shared/DomainError';

/**
 * Context information for test classification
 */
export interface ClassificationContext {
  sourceCode: string;
  precedingContent: string;
  testHierarchy: TestBlock[];
  requestPatterns: RegExp[];
  metadata?: Record<string, any>;
}

/**
 * Classification result for a single test block
 */
export interface TestClassificationResult {
  testBlock: TestBlock;
  isRequestSpecific: boolean;
  confidence: number; // 0-1 scale
  reasoning: string;
}

/**
 * Strategy interface for test classification algorithms
 */
export interface IClassificationStrategy {
  /**
   * Get the name of this classification strategy
   */
  readonly name: string;

  /**
   * Get the priority of this strategy (higher = more important)
   * Used when combining multiple strategies
   */
  readonly priority: number;

  /**
   * Classify a single test block
   * @param testBlock Test block to classify
   * @param context Classification context
   * @returns Classification result with confidence and reasoning
   */
  classify(
    testBlock: TestBlock,
    context: ClassificationContext
  ): Promise<Result<TestClassificationResult, DomainError>>;

  /**
   * Check if this strategy can handle the given test block and context
   * @param testBlock Test block to check
   * @param context Classification context
   * @returns True if this strategy can classify the test block
   */
  canClassify(testBlock: TestBlock, context: ClassificationContext): boolean;

  /**
   * Get configuration for this strategy
   * @returns Strategy configuration object
   */
  getConfiguration(): Record<string, any>;

  /**
   * Update strategy configuration
   * @param config New configuration
   */
  configure(config: Record<string, any>): void;
}
