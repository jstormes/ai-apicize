/**
 * Test helpers module exports
 * Provides all testing utilities and helpers
 */

export { TestEnvironment } from './TestEnvironment';

export {
  TestCategory,
  TestType,
  TestDescriptor,
  TestCategorizer,
  TestSuiteOrganizer,
  commonTestDescriptors,
} from './TestCategories';

export {
  TestBlockAssertions,
  TestSuiteAssertions,
  ExtractionResultAssertions,
  ResultAssertions,
  PerformanceAssertions,
  createCustomMatchers,
} from './AssertionHelpers';

// Convenience exports for common patterns
export const testHelpers = {
  // Environment helpers
  unitTestEnvironment: () => TestEnvironment.forUnitTests(),
  integrationTestEnvironment: () => TestEnvironment.forIntegrationTests(),
  performanceTestEnvironment: () => TestEnvironment.forPerformanceTests(),

  // Assertion helpers
  assertions: {
    testBlock: TestBlockAssertions,
    testSuite: TestSuiteAssertions,
    extractionResult: ExtractionResultAssertions,
    result: ResultAssertions,
    performance: PerformanceAssertions,
  },

  // Common test descriptors
  descriptors: commonTestDescriptors,
};
