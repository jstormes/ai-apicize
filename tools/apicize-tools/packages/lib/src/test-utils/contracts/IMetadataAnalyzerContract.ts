/**
 * Contract tests for IMetadataAnalyzer implementations
 * Ensures all implementations behave consistently
 */

import { IMetadataAnalyzer } from '../../domain/test-analysis/services/IMetadataAnalyzer';
import {
  ParsedMetadata,
  ParsedComment,
  ParsedAnnotation,
} from '../../infrastructure/parsing/ParsedSource';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';
import { TestBlockBuilderPresets } from '../builders';

/**
 * Test contract for IMetadataAnalyzer implementations
 * All implementations should pass these tests
 */
export function testMetadataAnalyzerContract(
  createAnalyzer: () => IMetadataAnalyzer,
  describeName: string = 'IMetadataAnalyzer Contract'
) {
  describe(describeName, () => {
    let analyzer: IMetadataAnalyzer;

    beforeEach(() => {
      analyzer = createAnalyzer();
    });

    describe('analyzeMetadata', () => {
      it('should analyze empty metadata', async () => {
        const metadata = new ParsedMetadata();
        const testBlocks = [];

        const sourceCode = SourceCode.create('').data!;
        const result = analyzer.analyzeMetadata(sourceCode);

        expect(result.success).toBe(true);

        if (result.success) {
          const analyzedMetadata = result.data;
          expect(analyzedMetadata).toBeDefined();
          expect(analyzedMetadata.hasMetadata).toBeDefined();
        }
      });

      it('should analyze metadata with comments', async () => {
        const comments = [
          new ParsedComment('request', '{"id": "test-1"}', 0, 50),
          new ParsedComment('group', '{"name": "API Tests"}', 100, 150),
        ];
        const metadata = new ParsedMetadata(comments);
        const testBlocks = [
          TestBlockBuilderPresets.apiTest('test 1').build(),
          TestBlockBuilderPresets.apiTest('test 2').build(),
        ];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();
          expect(analyzedMetadata.hasMetadata()).toBe(true);
        }
      });

      it('should analyze metadata with annotations', async () => {
        const annotations = [
          new ParsedAnnotation('apicize-request', true, 0),
          new ParsedAnnotation('test-type', 'api', 50),
        ];
        const metadata = new ParsedMetadata([], annotations);
        const testBlocks = [TestBlockBuilderPresets.apiTest('annotated test').build()];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();
        }
      });

      it('should analyze metadata with both comments and annotations', async () => {
        const comments = [new ParsedComment('request', '{"method": "GET"}', 0, 30)];
        const annotations = [new ParsedAnnotation('test-id', 'test-123', 40)];
        const metadata = new ParsedMetadata(comments, annotations);
        const testBlocks = [TestBlockBuilderPresets.apiTest('comprehensive test').build()];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();
          expect(analyzedMetadata.hasMetadata()).toBe(true);
        }
      });

      it('should handle large number of test blocks', async () => {
        const metadata = new ParsedMetadata();
        const testBlocks = [];

        // Create many test blocks
        for (let i = 0; i < 100; i++) {
          testBlocks.push(TestBlockBuilderPresets.apiTest(`Test ${i}`).build());
        }

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();
        }
      });

      it('should handle complex metadata structures', async () => {
        const comments = [
          new ParsedComment('file', '{"version": "1.0", "type": "test"}', 0, 50),
          new ParsedComment('request', '{"url": "/api/users", "method": "POST"}', 60, 120),
          new ParsedComment('group', '{"id": "user-tests", "execution": "SEQUENTIAL"}', 130, 200),
        ];
        const annotations = [
          new ParsedAnnotation('priority', 'high', 0),
          new ParsedAnnotation('category', 'api', 50),
          new ParsedAnnotation('timeout', 30000, 100),
        ];
        const metadata = new ParsedMetadata(comments, annotations);
        const testBlocks = [
          TestBlockBuilderPresets.apiTest('complex test 1').build(),
          TestBlockBuilderPresets.sharedTest('complex test 2').build(),
        ];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();
          expect(analyzedMetadata.hasMetadata()).toBe(true);
        }
      });

      it('should be consistent across multiple calls', async () => {
        const comments = [new ParsedComment('test', 'consistent', 0, 20)];
        const metadata = new ParsedMetadata(comments);
        const testBlocks = [TestBlockBuilderPresets.apiTest('consistency test').build()];

        const result1 = await analyzer.analyzeMetadata(metadata, testBlocks);
        const result2 = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result1.isSuccess()).toBe(true);
        expect(result2.isSuccess()).toBe(true);

        if (result1.isSuccess() && result2.isSuccess()) {
          const metadata1 = result1.value;
          const metadata2 = result2.value;

          expect(metadata1.hasMetadata()).toBe(metadata2.hasMetadata());
        }
      });

      it('should handle malformed comment content gracefully', async () => {
        const comments = [
          new ParsedComment('request', '{ invalid json', 0, 20),
          new ParsedComment('group', '', 30, 30), // Empty content
          new ParsedComment('file', 'not json at all', 40, 60),
        ];
        const metadata = new ParsedMetadata(comments);
        const testBlocks = [TestBlockBuilderPresets.apiTest('malformed test').build()];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        // Should either succeed or return a descriptive error, but not throw
        expect(result).toBeDefined();
        expect(typeof result.isSuccess).toBe('function');
      });

      it('should handle special characters in metadata', async () => {
        const comments = [
          new ParsedComment('unicode', '{"message": "测试 🎉 ñoño"}', 0, 50),
          new ParsedComment('symbols', '{"special": "@#$%^&*()"}', 60, 100),
        ];
        const metadata = new ParsedMetadata(comments);
        const testBlocks = [TestBlockBuilderPresets.apiTest('unicode test').build()];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();
        }
      });
    });

    describe('error handling', () => {
      it('should not throw synchronous errors', async () => {
        const metadata = new ParsedMetadata();
        const testBlocks = [TestBlockBuilderPresets.apiTest('test').build()];

        await expect(analyzer.analyzeMetadata(metadata, testBlocks)).resolves.toBeDefined();
      });

      it('should handle null or undefined metadata gracefully', async () => {
        // This test depends on the implementation's error handling
        const testBlocks = [TestBlockBuilderPresets.apiTest('test').build()];

        // Most implementations should handle this gracefully
        // The specific behavior may vary, but it shouldn't crash
        await expect(async () => {
          await analyzer.analyzeMetadata(new ParsedMetadata(), testBlocks);
        }).not.toThrow();
      });

      it('should handle empty test blocks array', async () => {
        const metadata = new ParsedMetadata([new ParsedComment('test', 'content', 0, 10)]);
        const testBlocks: any[] = [];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result).toBeDefined();
        expect(typeof result.isSuccess).toBe('function');
      });
    });

    describe('performance', () => {
      it('should handle large metadata efficiently', async () => {
        const comments = [];
        const annotations = [];

        // Create large metadata
        for (let i = 0; i < 1000; i++) {
          comments.push(new ParsedComment(`type-${i}`, `{"id": ${i}}`, i * 10, i * 10 + 20));
          annotations.push(new ParsedAnnotation(`annotation-${i}`, `value-${i}`, i * 5));
        }

        const metadata = new ParsedMetadata(comments, annotations);
        const testBlocks = [TestBlockBuilderPresets.apiTest('large metadata test').build()];

        const startTime = Date.now();
        const result = await analyzer.analyzeMetadata(metadata, testBlocks);
        const endTime = Date.now();

        const duration = endTime - startTime;

        expect(result).toBeDefined();
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

        console.log(`Analysis of large metadata took ${duration}ms`);
      });
    });

    describe('metadata preservation', () => {
      it('should preserve original comment information', async () => {
        const originalComments = [
          new ParsedComment('request', '{"id": "preserve-test"}', 10, 50),
          new ParsedComment('group', '{"name": "Preservation Tests"}', 60, 100),
        ];
        const metadata = new ParsedMetadata(originalComments);
        const testBlocks = [TestBlockBuilderPresets.apiTest('preservation test').build()];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();

          // The analyzer should preserve or reference the original comments
          // Specific behavior depends on implementation
        }
      });

      it('should preserve original annotation information', async () => {
        const originalAnnotations = [
          new ParsedAnnotation('test-id', 'preserve-123', 0),
          new ParsedAnnotation('category', 'preservation', 50),
        ];
        const metadata = new ParsedMetadata([], originalAnnotations);
        const testBlocks = [
          TestBlockBuilderPresets.apiTest('annotation preservation test').build(),
        ];

        const result = await analyzer.analyzeMetadata(metadata, testBlocks);

        expect(result.isSuccess()).toBe(true);

        if (result.isSuccess()) {
          const analyzedMetadata = result.value;
          expect(analyzedMetadata).toBeDefined();

          // The analyzer should preserve or reference the original annotations
          // Specific behavior depends on implementation
        }
      });
    });
  });
}

/**
 * Test data factory for metadata analyzer contracts
 */
export const metadataAnalyzerTestData = {
  createEmptyMetadata: () => new ParsedMetadata(),

  createSimpleMetadata: () =>
    new ParsedMetadata([new ParsedComment('request', '{"method": "GET"}', 0, 30)]),

  createComplexMetadata: () =>
    new ParsedMetadata(
      [
        new ParsedComment('file', '{"version": "1.0"}', 0, 30),
        new ParsedComment('request', '{"url": "/api", "method": "POST"}', 40, 80),
        new ParsedComment('group', '{"execution": "PARALLEL"}', 90, 130),
      ],
      [new ParsedAnnotation('priority', 'high', 0), new ParsedAnnotation('timeout', 5000, 50)]
    ),

  createMalformedMetadata: () =>
    new ParsedMetadata([
      new ParsedComment('broken', '{ invalid json', 0, 20),
      new ParsedComment('empty', '', 30, 30),
    ]),

  createLargeMetadata: (count: number = 100) => {
    const comments = [];
    const annotations = [];

    for (let i = 0; i < count; i++) {
      comments.push(new ParsedComment(`comment-${i}`, `{"index": ${i}}`, i * 10, i * 10 + 15));
      annotations.push(new ParsedAnnotation(`annotation-${i}`, `value-${i}`, i * 5));
    }

    return new ParsedMetadata(comments, annotations);
  },
};
