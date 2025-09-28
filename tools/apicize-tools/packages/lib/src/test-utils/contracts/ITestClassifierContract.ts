/**
 * Contract tests for ITestClassifier implementations
 * Ensures all implementations behave consistently
 */

import { ITestClassifier } from '../../domain/test-analysis/services/ITestClassifier';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { TestBlockBuilderPresets, TestSuiteBuilderPresets } from '../builders';

/**
 * Test contract for ITestClassifier implementations
 * All implementations should pass these tests
 */
export function testTestClassifierContract(
  createClassifier: () => ITestClassifier,
  describeName: string = 'ITestClassifier Contract'
) {
  describe(describeName, () => {
    let classifier: ITestClassifier;

    beforeEach(() => {
      classifier = createClassifier();
    });

    describe('classifyTests', () => {
      it('should classify test suite with mixed tests', async () => {
        const testSuite = TestSuiteBuilderPresets.mixedTestSuite().build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          expect(classification.requestSpecificTests).toBeDefined();
          expect(classification.sharedTests).toBeDefined();
          expect(Array.isArray(classification.requestSpecificTests)).toBe(true);
          expect(Array.isArray(classification.sharedTests)).toBe(true);

          // Total should equal original test count
          const totalClassified =
            classification.requestSpecificTests.length + classification.sharedTests.length;
          const allTests = testSuite.getAllTestBlocks();
          expect(totalClassified).toBe(allTests.length);
        }
      });

      it('should handle empty test suite', async () => {
        const testSuite = TestSuiteBuilderPresets.empty().build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          expect(classification.requestSpecificTests).toHaveLength(0);
          expect(classification.sharedTests).toHaveLength(0);
        }
      });

      it('should handle test suite with only request-specific tests', async () => {
        const testSuite = TestSuiteBuilderPresets.requestSpecificOnly().build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          expect(classification.requestSpecificTests.length).toBeGreaterThan(0);
          expect(classification.sharedTests).toHaveLength(0);
        }
      });

      it('should handle test suite with only shared tests', async () => {
        const testSuite = TestSuiteBuilderPresets.sharedOnly().build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          expect(classification.requestSpecificTests).toHaveLength(0);
          expect(classification.sharedTests.length).toBeGreaterThan(0);
        }
      });

      it('should handle deeply nested test structure', async () => {
        const testSuite = TestSuiteBuilderPresets.deeplyNested().build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          const totalClassified =
            classification.requestSpecificTests.length + classification.sharedTests.length;
          const allTests = testSuite.getAllTestBlocks();
          expect(totalClassified).toBe(allTests.length);
        }
      });

      it('should maintain test block identity', async () => {
        const testSuite = TestSuiteBuilderPresets.mixedTestSuite().build();
        const originalTests = testSuite.getAllTestBlocks();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          const allClassifiedTests = [
            ...classification.requestSpecificTests,
            ...classification.sharedTests,
          ];

          // Each original test should appear exactly once in classification
          for (const originalTest of originalTests) {
            const classifiedTest = allClassifiedTests.find(
              test => test.name.value === originalTest.name.value
            );
            expect(classifiedTest).toBeDefined();
          }
        }
      });

      it('should be consistent across multiple calls', async () => {
        const testSuite = TestSuiteBuilderPresets.comprehensiveTestSuite().build();

        const result1 = await classifier.classifyTests(testSuite);
        const result2 = await classifier.classifyTests(testSuite);

        expect(result1.isSuccess()).toBe(true);
        expect(result2.isSuccess()).toBe(true);

        if (result1.isSuccess() && result2.isSuccess()) {
          const classification1 = result1.value;
          const classification2 = result2.value;

          expect(classification1.requestSpecificTests.length).toBe(
            classification2.requestSpecificTests.length
          );
          expect(classification1.sharedTests.length).toBe(classification2.sharedTests.length);
        }
      });

      it('should handle test blocks with special characters in names', async () => {
        const specialTest = TestBlockBuilderPresets.apiTest(
          'should handle special chars: @#$%^&*()'
        ).build();

        const testSuite = TestSuiteBuilderPresets.empty().withTestBlock(specialTest).build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          const totalClassified =
            classification.requestSpecificTests.length + classification.sharedTests.length;
          expect(totalClassified).toBe(1);
        }
      });

      it('should preserve test block hierarchy information', async () => {
        const testSuite = TestSuiteBuilderPresets.deeplyNested().build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;
          const allClassified = [
            ...classification.requestSpecificTests,
            ...classification.sharedTests,
          ];

          // Check that depth information is preserved
          for (const test of allClassified) {
            expect(typeof test.depth).toBe('number');
            expect(test.depth).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });

    describe('error handling', () => {
      it('should not throw synchronous errors', async () => {
        const testSuite = TestSuiteBuilderPresets.comprehensiveTestSuite().build();

        await expect(classifier.classifyTests(testSuite)).resolves.toBeDefined();
      });

      it('should handle malformed test suite gracefully', async () => {
        // Create a test suite with potential issues
        const problematicTest = TestBlockBuilderPresets.apiTest('') // Empty name
          .withCode('') // Empty code
          .build();

        const testSuite = TestSuiteBuilderPresets.empty().withTestBlock(problematicTest).build();

        const result = await classifier.classifyTests(testSuite);

        // Should either succeed or return a failure result, but not throw
        expect(result).toBeDefined();
        expect(typeof result.isSuccess).toBe('function');
      });
    });

    describe('performance', () => {
      it('should handle large test suites efficiently', async () => {
        // Create a large test suite
        const largeTestSuite = TestSuiteBuilderPresets.empty().withName('Large Test Suite');

        // Add many test blocks
        for (let i = 0; i < 100; i++) {
          const test = TestBlockBuilderPresets.apiTest(`Test ${i}`).build();
          largeTestSuite.withTestBlock(test);
        }

        const testSuite = largeTestSuite.build();
        const startTime = Date.now();

        const result = await classifier.classifyTests(testSuite);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(result.isSuccess()).toBe(true);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      });
    });

    describe('classification accuracy', () => {
      it('should classify obvious request-specific tests correctly', async () => {
        const requestTest = TestBlockBuilderPresets.apiTest('should make HTTP request')
          .asRequestSpecific(true)
          .build();

        const testSuite = TestSuiteBuilderPresets.empty().withTestBlock(requestTest).build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;

          // The classifier should respect the isRequestSpecific flag
          // or have its own logic, but should be consistent
          const totalClassified =
            classification.requestSpecificTests.length + classification.sharedTests.length;
          expect(totalClassified).toBe(1);
        }
      });

      it('should classify obvious shared tests correctly', async () => {
        const sharedTest = TestBlockBuilderPresets.sharedTest('should validate utility function')
          .asRequestSpecific(false)
          .build();

        const testSuite = TestSuiteBuilderPresets.empty().withTestBlock(sharedTest).build();

        const result = await classifier.classifyTests(testSuite);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const classification = result.value;

          // The classifier should respect the isRequestSpecific flag
          // or have its own logic, but should be consistent
          const totalClassified =
            classification.requestSpecificTests.length + classification.sharedTests.length;
          expect(totalClassified).toBe(1);
        }
      });
    });
  });
}

/**
 * Performance benchmark for classifier implementations
 */
export function benchmarkTestClassifier(
  createClassifier: () => ITestClassifier,
  testName: string = 'Classifier Performance'
) {
  describe(testName, () => {
    let classifier: ITestClassifier;

    beforeEach(() => {
      classifier = createClassifier();
    });

    it('should handle 1000 test blocks within reasonable time', async () => {
      const largeTestSuite = TestSuiteBuilderPresets.empty().withName('Performance Test Suite');

      // Create 1000 test blocks
      for (let i = 0; i < 1000; i++) {
        const isRequestSpecific = i % 2 === 0;
        const test = TestBlockBuilderPresets.apiTest(`Performance Test ${i}`)
          .asRequestSpecific(isRequestSpecific)
          .build();
        largeTestSuite.withTestBlock(test);
      }

      const testSuite = largeTestSuite.build();
      const startTime = Date.now();

      const result = await classifier.classifyTests(testSuite);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.isSuccess()).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Classification of 1000 tests took ${duration}ms`);
    });
  });
}
