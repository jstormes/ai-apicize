/**
 * Composite strategy that combines multiple classification strategies
 * Uses weighted voting and confidence aggregation to make final decisions
 */

import {
  IClassificationStrategy,
  ClassificationContext,
  TestClassificationResult,
} from './IClassificationStrategy';
import { TestBlock } from '../../entities/TestBlock';
import { Result } from '../../../shared/Result';
import { DomainError } from '../../../shared/DomainError';

/**
 * Configuration for the composite strategy
 */
export interface CompositeClassificationConfig {
  strategies: IClassificationStrategy[];
  decisionMode: 'HIGHEST_CONFIDENCE' | 'WEIGHTED_VOTE' | 'UNANIMOUS' | 'MAJORITY';
  minimumConfidence: number;
  enableFallback: boolean;
  fallbackStrategy?: IClassificationStrategy;
}

/**
 * Individual strategy result with metadata
 */
interface StrategyResult {
  strategy: IClassificationStrategy;
  result: TestClassificationResult;
  executionTime: number;
  error?: DomainError;
}

/**
 * Aggregated classification result
 */
interface AggregatedResult {
  finalDecision: boolean;
  confidence: number;
  reasoning: string;
  strategyResults: StrategyResult[];
  consensusLevel: number;
}

/**
 * Composite classification strategy that combines multiple approaches
 */
export class CompositeClassificationStrategy implements IClassificationStrategy {
  readonly name = 'CompositeClassificationStrategy';
  readonly priority = 1000; // Highest priority - this is the master strategy

  private config: CompositeClassificationConfig;

  constructor(config: CompositeClassificationConfig) {
    this.config = { ...config };
    this.validateConfiguration();
  }

  /**
   * Classify test using all configured strategies
   */
  async classify(
    testBlock: TestBlock,
    context: ClassificationContext
  ): Promise<Result<TestClassificationResult, DomainError>> {
    try {
      if (!this.canClassify(testBlock, context)) {
        return Result.failure(
          new DomainError(
            'CLASSIFICATION_NOT_APPLICABLE',
            'Composite strategy cannot classify this test block',
            { testBlockName: testBlock.name.value }
          )
        );
      }

      // Execute all applicable strategies
      const strategyResults = await this.executeStrategies(testBlock, context);

      // Check if we have any successful results
      const successfulResults = strategyResults.filter(r => !r.error);
      if (successfulResults.length === 0) {
        return this.handleNoSuccessfulResults(strategyResults, testBlock);
      }

      // Aggregate results using configured decision mode
      const aggregatedResult = this.aggregateResults(successfulResults);

      // Build final result
      const result: TestClassificationResult = {
        testBlock,
        isRequestSpecific: aggregatedResult.finalDecision,
        confidence: aggregatedResult.confidence,
        reasoning: aggregatedResult.reasoning,
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new DomainError('CLASSIFICATION_ERROR', 'Error during composite classification', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if this strategy can classify the test block
   */
  canClassify(testBlock: TestBlock, context: ClassificationContext): boolean {
    // Can classify if at least one strategy can handle it
    return this.config.strategies.some(strategy => strategy.canClassify(testBlock, context));
  }

  /**
   * Get current strategy configuration
   */
  getConfiguration(): Record<string, any> {
    return {
      decisionMode: this.config.decisionMode,
      minimumConfidence: this.config.minimumConfidence,
      enableFallback: this.config.enableFallback,
      strategiesCount: this.config.strategies.length,
      strategies: this.config.strategies.map(s => ({
        name: s.name,
        priority: s.priority,
      })),
    };
  }

  /**
   * Update strategy configuration
   */
  configure(config: Record<string, any>): void {
    if (config.decisionMode) {
      this.config.decisionMode =
        config.decisionMode as CompositeClassificationConfig['decisionMode'];
    }
    if (config.minimumConfidence !== undefined) {
      this.config.minimumConfidence = config.minimumConfidence;
    }
    if (config.enableFallback !== undefined) {
      this.config.enableFallback = config.enableFallback;
    }
  }

  /**
   * Execute all applicable strategies
   */
  private async executeStrategies(
    testBlock: TestBlock,
    context: ClassificationContext
  ): Promise<StrategyResult[]> {
    const results: StrategyResult[] = [];

    // Sort strategies by priority (highest first)
    const sortedStrategies = [...this.config.strategies].sort((a, b) => b.priority - a.priority);

    for (const strategy of sortedStrategies) {
      if (!strategy.canClassify(testBlock, context)) {
        continue;
      }

      const startTime = performance.now();
      try {
        const result = await strategy.classify(testBlock, context);
        const executionTime = performance.now() - startTime;

        if (result.success) {
          results.push({
            strategy,
            result: result.value,
            executionTime,
          });
        } else {
          results.push({
            strategy,
            result: {
              testBlock,
              isRequestSpecific: false,
              confidence: 0,
              reasoning: 'Strategy failed',
            },
            executionTime,
            error: result.error,
          });
        }
      } catch (error) {
        const executionTime = performance.now() - startTime;
        results.push({
          strategy,
          result: {
            testBlock,
            isRequestSpecific: false,
            confidence: 0,
            reasoning: 'Strategy threw error',
          },
          executionTime,
          error: new DomainError(
            'STRATEGY_EXECUTION_ERROR',
            `Strategy ${strategy.name} threw an error`,
            { error: error instanceof Error ? error.message : String(error) }
          ),
        });
      }
    }

    return results;
  }

  /**
   * Aggregate results from multiple strategies
   */
  private aggregateResults(strategyResults: StrategyResult[]): AggregatedResult {
    switch (this.config.decisionMode) {
      case 'HIGHEST_CONFIDENCE':
        return this.aggregateByHighestConfidence(strategyResults);
      case 'WEIGHTED_VOTE':
        return this.aggregateByWeightedVote(strategyResults);
      case 'UNANIMOUS':
        return this.aggregateByUnanimous(strategyResults);
      case 'MAJORITY':
        return this.aggregateByMajority(strategyResults);
      default:
        return this.aggregateByHighestConfidence(strategyResults);
    }
  }

  /**
   * Aggregate by highest confidence score
   */
  private aggregateByHighestConfidence(strategyResults: StrategyResult[]): AggregatedResult {
    const highestConfidenceResult = strategyResults.reduce((best, current) =>
      current.result.confidence > best.result.confidence ? current : best
    );

    const avgConfidence =
      strategyResults.reduce((sum, r) => sum + r.result.confidence, 0) / strategyResults.length;
    const consensus = this.calculateConsensus(strategyResults);

    return {
      finalDecision: highestConfidenceResult.result.isRequestSpecific,
      confidence: Math.min(
        highestConfidenceResult.result.confidence * (0.8 + consensus * 0.2),
        1.0
      ),
      reasoning: this.buildAggregatedReasoning(
        'HIGHEST_CONFIDENCE',
        strategyResults,
        highestConfidenceResult
      ),
      strategyResults,
      consensusLevel: consensus,
    };
  }

  /**
   * Aggregate by weighted vote based on strategy priority and confidence
   */
  private aggregateByWeightedVote(strategyResults: StrategyResult[]): AggregatedResult {
    let weightedTrueVotes = 0;
    let weightedFalseVotes = 0;
    let totalWeight = 0;

    for (const strategyResult of strategyResults) {
      const weight = strategyResult.strategy.priority * strategyResult.result.confidence;
      totalWeight += weight;

      if (strategyResult.result.isRequestSpecific) {
        weightedTrueVotes += weight;
      } else {
        weightedFalseVotes += weight;
      }
    }

    const finalDecision = weightedTrueVotes > weightedFalseVotes;
    const confidence = Math.max(weightedTrueVotes, weightedFalseVotes) / totalWeight;
    const consensus = this.calculateConsensus(strategyResults);

    return {
      finalDecision,
      confidence: Math.min(confidence * (0.7 + consensus * 0.3), 1.0),
      reasoning: this.buildAggregatedReasoning('WEIGHTED_VOTE', strategyResults),
      strategyResults,
      consensusLevel: consensus,
    };
  }

  /**
   * Aggregate by unanimous decision (all strategies must agree)
   */
  private aggregateByUnanimous(strategyResults: StrategyResult[]): AggregatedResult {
    const decisions = strategyResults.map(r => r.result.isRequestSpecific);
    const allTrue = decisions.every(d => d === true);
    const allFalse = decisions.every(d => d === false);
    const unanimous = allTrue || allFalse;

    const avgConfidence =
      strategyResults.reduce((sum, r) => sum + r.result.confidence, 0) / strategyResults.length;

    let finalDecision = false;
    let confidence = 0;

    if (unanimous) {
      finalDecision = allTrue;
      confidence = avgConfidence;
    } else if (this.config.enableFallback && this.config.fallbackStrategy) {
      // Use fallback strategy for non-unanimous results
      const fallbackResult = strategyResults.find(r => r.strategy === this.config.fallbackStrategy);
      if (fallbackResult) {
        finalDecision = fallbackResult.result.isRequestSpecific;
        confidence = fallbackResult.result.confidence * 0.5; // Reduced confidence for fallback
      }
    }

    return {
      finalDecision,
      confidence,
      reasoning: this.buildAggregatedReasoning('UNANIMOUS', strategyResults),
      strategyResults,
      consensusLevel: unanimous ? 1.0 : 0.0,
    };
  }

  /**
   * Aggregate by majority vote
   */
  private aggregateByMajority(strategyResults: StrategyResult[]): AggregatedResult {
    const trueVotes = strategyResults.filter(r => r.result.isRequestSpecific).length;
    const falseVotes = strategyResults.length - trueVotes;

    const finalDecision = trueVotes > falseVotes;
    const majoritySize = Math.max(trueVotes, falseVotes);
    const majorityRatio = majoritySize / strategyResults.length;

    // Calculate confidence based on majority size and individual confidences
    const majorityResults = strategyResults.filter(
      r => r.result.isRequestSpecific === finalDecision
    );
    const avgMajorityConfidence =
      majorityResults.reduce((sum, r) => sum + r.result.confidence, 0) / majorityResults.length;

    const confidence = avgMajorityConfidence * majorityRatio;
    const consensus = this.calculateConsensus(strategyResults);

    return {
      finalDecision,
      confidence: Math.min(confidence * (0.6 + consensus * 0.4), 1.0),
      reasoning: this.buildAggregatedReasoning('MAJORITY', strategyResults),
      strategyResults,
      consensusLevel: consensus,
    };
  }

  /**
   * Calculate consensus level among strategies
   */
  private calculateConsensus(strategyResults: StrategyResult[]): number {
    if (strategyResults.length <= 1) return 1.0;

    const trueCount = strategyResults.filter(r => r.result.isRequestSpecific).length;
    const falseCount = strategyResults.length - trueCount;

    const majoritySize = Math.max(trueCount, falseCount);
    return majoritySize / strategyResults.length;
  }

  /**
   * Build aggregated reasoning string
   */
  private buildAggregatedReasoning(
    mode: string,
    strategyResults: StrategyResult[],
    primaryResult?: StrategyResult
  ): string {
    const successCount = strategyResults.filter(r => !r.error).length;
    const trueCount = strategyResults.filter(r => r.result.isRequestSpecific).length;

    let baseSummary = `Composite decision using ${mode} from ${successCount} strategies: `;
    baseSummary += `${trueCount} classified as request-specific, ${successCount - trueCount} as shared`;

    if (primaryResult) {
      baseSummary += `; Primary: ${primaryResult.strategy.name} (${(primaryResult.result.confidence * 100).toFixed(1)}%)`;
    }

    const strategyDetails = strategyResults
      .filter(r => !r.error)
      .map(
        r =>
          `${r.strategy.name}: ${r.result.isRequestSpecific ? 'Request' : 'Shared'} (${(r.result.confidence * 100).toFixed(1)}%)`
      )
      .join(', ');

    return `${baseSummary}; Details: ${strategyDetails}`;
  }

  /**
   * Handle case when no strategies succeeded
   */
  private handleNoSuccessfulResults(
    strategyResults: StrategyResult[],
    testBlock: TestBlock
  ): Promise<Result<TestClassificationResult, DomainError>> {
    const errors = strategyResults.filter(r => r.error).map(r => r.error!);

    // Try fallback strategy if enabled
    if (this.config.enableFallback && this.config.fallbackStrategy) {
      const fallbackResult = strategyResults.find(r => r.strategy === this.config.fallbackStrategy);
      if (fallbackResult && !fallbackResult.error) {
        const result: TestClassificationResult = {
          testBlock,
          isRequestSpecific: fallbackResult.result.isRequestSpecific,
          confidence: fallbackResult.result.confidence * 0.3, // Very low confidence
          reasoning: `Fallback classification: ${fallbackResult.result.reasoning}`,
        };
        return Promise.resolve(Result.success(result));
      }
    }

    return Promise.resolve(
      Result.failure(
        new DomainError('ALL_STRATEGIES_FAILED', 'All classification strategies failed', {
          testBlockName: testBlock.name.value,
          errors: errors.map(e => e.message),
        })
      )
    );
  }

  /**
   * Validate the configuration
   */
  private validateConfiguration(): void {
    if (!this.config.strategies || this.config.strategies.length === 0) {
      throw new Error('CompositeClassificationStrategy requires at least one strategy');
    }

    if (this.config.minimumConfidence < 0 || this.config.minimumConfidence > 1) {
      throw new Error('minimumConfidence must be between 0 and 1');
    }

    const validModes = ['HIGHEST_CONFIDENCE', 'WEIGHTED_VOTE', 'UNANIMOUS', 'MAJORITY'];
    if (!validModes.includes(this.config.decisionMode)) {
      throw new Error(`Invalid decision mode: ${this.config.decisionMode}`);
    }

    if (this.config.enableFallback && !this.config.fallbackStrategy) {
      throw new Error('fallbackStrategy is required when enableFallback is true');
    }
  }

  /**
   * Add a strategy to the composite
   */
  addStrategy(strategy: IClassificationStrategy): void {
    if (!this.config.strategies.includes(strategy)) {
      this.config.strategies.push(strategy);
      // Re-sort by priority
      this.config.strategies.sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * Remove a strategy from the composite
   */
  removeStrategy(strategy: IClassificationStrategy): void {
    const index = this.config.strategies.indexOf(strategy);
    if (index >= 0) {
      this.config.strategies.splice(index, 1);
    }
  }

  /**
   * Get statistics about the composite strategy
   */
  getCompositeStatistics(): {
    strategyCount: number;
    decisionMode: string;
    minimumConfidence: number;
    strategies: Array<{ name: string; priority: number }>;
  } {
    return {
      strategyCount: this.config.strategies.length,
      decisionMode: this.config.decisionMode,
      minimumConfidence: this.config.minimumConfidence,
      strategies: this.config.strategies.map(s => ({
        name: s.name,
        priority: s.priority,
      })),
    };
  }
}
