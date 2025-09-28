/**
 * Mock implementations module exports
 * Provides all mock implementations for testing
 */

export { MockSourceCodeParser } from './MockSourceCodeParser';
export { MockTestClassifier } from './MockTestClassifier';
export { MockMetadataAnalyzer } from './MockMetadataAnalyzer';

// Mock factory functions for convenience
export const createMocks = {
  sourceCodeParser: () => new MockSourceCodeParser(),
  testClassifier: () => new MockTestClassifier(),
  metadataAnalyzer: () => new MockMetadataAnalyzer(),

  // Preconfigured mocks
  allRequestSpecificClassifier: () => MockTestClassifier.allRequestSpecific(),
  allSharedClassifier: () => MockTestClassifier.allShared(),
  emptyMetadataAnalyzer: () => MockMetadataAnalyzer.emptyMetadata(),
  richMetadataAnalyzer: () => MockMetadataAnalyzer.richMetadata(),
};
