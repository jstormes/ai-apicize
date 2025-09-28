/**
 * Classification strategies for test analysis
 * Implements the Strategy pattern for flexible test classification approaches
 *
 * NOTE: Strategy implementations temporarily disabled to resolve build issues
 * TODO: Re-enable after resolving interface compatibility
 */

// Minimal interface exports to maintain compatibility
export interface IClassificationStrategy {
  readonly name: string;
  readonly description: string;
  readonly priority: number;
}

export interface ClassificationContext {
  readonly patterns: any[];
  readonly sourceCode: any;
  readonly precedingContent: string;
  readonly followingContent: string;
  readonly options: any;
}

export interface TestClassificationResult {
  readonly testBlockId: string;
  readonly isRequestSpecific: boolean;
  readonly confidence: number;
  readonly strategyUsed: string;
  readonly reasons: string[];
  readonly wasChanged: boolean;
}

// TODO: Re-enable strategy exports after compatibility fixes
// export { RequestPatternStrategy, RequestPatternConfig } from './RequestPatternStrategy';
// export { MetadataCommentStrategy, MetadataCommentConfig } from './MetadataCommentStrategy';
// export { CodeContentStrategy, CodeContentConfig } from './CodeContentStrategy';
// export {
//   CompositeClassificationStrategy,
//   CompositeClassificationConfig,
// } from './CompositeClassificationStrategy';

// /**
//  * Factory function to create a default composite strategy
//  */
// export function createDefaultClassificationStrategy(): CompositeClassificationStrategy {
//   const strategies = [
//     new MetadataCommentStrategy(), // Highest priority - explicit metadata
//     new RequestPatternStrategy(), // High priority - naming patterns
//     new CodeContentStrategy(), // Medium priority - code analysis
//   ];

//   return new CompositeClassificationStrategy({
//     strategies,
//     decisionMode: 'WEIGHTED_VOTE',
//     minimumConfidence: 0.5,
//     enableFallback: true,
//     fallbackStrategy: strategies[2], // Use CodeContentStrategy as fallback
//   });
// }

// /**
//  * Factory function to create a high-precision strategy (conservative)
//  */
// export function createConservativeClassificationStrategy(): CompositeClassificationStrategy {
//   const strategies = [
//     new MetadataCommentStrategy({ trustLevel: 0.95 }),
//     new RequestPatternStrategy({ minConfidence: 0.8 }),
//     new CodeContentStrategy({ minIndicatorCount: 2 }),
//   ];

//   return new CompositeClassificationStrategy({
//     strategies,
//     decisionMode: 'UNANIMOUS',
//     minimumConfidence: 0.8,
//     enableFallback: false,
//   });
// }

// /**
//  * Factory function to create a permissive strategy (aggressive)
//  */
// export function createAggressiveClassificationStrategy(): CompositeClassificationStrategy {
//   const strategies = [
//     new MetadataCommentStrategy({ trustLevel: 0.7 }),
//     new RequestPatternStrategy({ minConfidence: 0.3 }),
//     new CodeContentStrategy({ minIndicatorCount: 1 }),
//   ];

//   return new CompositeClassificationStrategy({
//     strategies,
//     decisionMode: 'MAJORITY',
//     minimumConfidence: 0.3,
//     enableFallback: true,
//     fallbackStrategy: strategies[1], // Use RequestPatternStrategy as fallback
//   });
// }
