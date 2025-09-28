/**
 * Test utilities module exports
 * Provides comprehensive testing infrastructure for Phase 3 architecture
 */

// Phase 3: New testing architecture components
export * from './builders';
export * from './mocks';
export * from './contracts';
export * from './helpers';

// Legacy Phase 3 utilities (maintained for compatibility)
export * from './console';
export * from './matchers';
export * from './test-doubles';
export * from './integration-helpers';
export * from './dependency-interfaces';
export * from './test-config';
export * from './time-abstraction';
export * from './fixtures';
export * from './property-testing';

// Convenience exports for common testing patterns
export { builders, presets } from './builders';
export { createMocks } from './mocks';
export { contractTests, benchmarks, testData } from './contracts';
export { testHelpers } from './helpers';

/**
 * Complete testing toolkit for Apicize components
 * Provides everything needed for comprehensive testing
 */
export const testingToolkit = {
  // Data builders
  builders: {
    testBlock: () => import('./builders').then(m => m.testBlock()),
    testSuite: () => import('./builders').then(m => m.testSuite()),
    codeMetadata: () => import('./builders').then(m => m.codeMetadata()),
    parsedSource: () => import('./builders').then(m => m.parsedSource()),
  },

  // Mock factories
  mocks: {
    sourceCodeParser: () => import('./mocks').then(m => m.createMocks.sourceCodeParser()),
    testClassifier: () => import('./mocks').then(m => m.createMocks.testClassifier()),
    metadataAnalyzer: () => import('./mocks').then(m => m.createMocks.metadataAnalyzer()),
  },

  // Test environments
  environments: {
    unit: () => import('./helpers').then(m => m.testHelpers.unitTestEnvironment()),
    integration: () => import('./helpers').then(m => m.testHelpers.integrationTestEnvironment()),
    performance: () => import('./helpers').then(m => m.testHelpers.performanceTestEnvironment()),
  },

  // Contract test runners
  contracts: {
    sourceCodeParser: (createParser: any) =>
      import('./contracts').then(m => m.contractTests.sourceCodeParser(createParser)),
    testClassifier: (createClassifier: any) =>
      import('./contracts').then(m => m.contractTests.testClassifier(createClassifier)),
    metadataAnalyzer: (createAnalyzer: any) =>
      import('./contracts').then(m => m.contractTests.metadataAnalyzer(createAnalyzer)),
  },
};
