/**
 * Contract tests module exports
 * Provides contract tests for all interfaces
 */

export { testSourceCodeParserContract, contractTestData } from './ISourceCodeParserContract';

export { testTestClassifierContract, benchmarkTestClassifier } from './ITestClassifierContract';

export {
  testMetadataAnalyzerContract,
  metadataAnalyzerTestData,
} from './IMetadataAnalyzerContract';

// Contract test runner utility
export const contractTests = {
  sourceCodeParser: testSourceCodeParserContract,
  testClassifier: testTestClassifierContract,
  metadataAnalyzer: testMetadataAnalyzerContract,
};

// Benchmark utilities
export const benchmarks = {
  testClassifier: benchmarkTestClassifier,
};

// Test data utilities
export const testData = {
  sourceCodeParser: contractTestData,
  metadataAnalyzer: metadataAnalyzerTestData,
};
