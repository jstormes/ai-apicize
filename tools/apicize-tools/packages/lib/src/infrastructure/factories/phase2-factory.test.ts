/**
 * Test file to verify Phase 2 implementation works
 */

import { TestExtractorFactory, createTestExtractor } from './TestExtractorFactory';

describe('Phase 2 Test Extractor Implementation', () => {
  const sampleTestCode = `
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

describe('API Tests', () => {
  let response: any;

  describe('User Management', () => {
    it('should create a user', () => {
      expect(response.status).to.equal(201);
      expect(response.body.data.id).to.exist;
    });

    it('should get user by id', () => {
      expect(response.status).to.equal(200);
      expect(response.body.data.name).to.equal('John Doe');
    });
  });

  describe('General Tests', () => {
    it('should validate input', () => {
      expect(true).to.be.true;
    });
  });
});
`;

  it('should create default test extractor', () => {
    const extractor = TestExtractorFactory.createDefault();
    expect(extractor).toBeDefined();
  });

  it('should create performance optimized extractor', () => {
    const extractor = TestExtractorFactory.createPerformanceOptimized();
    expect(extractor).toBeDefined();
  });

  it('should create analysis enabled extractor', () => {
    const extractor = TestExtractorFactory.createAnalysisEnabled();
    expect(extractor).toBeDefined();
  });

  it('should create minimal extractor', () => {
    const extractor = TestExtractorFactory.createMinimal();
    expect(extractor).toBeDefined();
  });

  it('should extract tests from sample code', async () => {
    const extractor = createTestExtractor();
    const result = await extractor.extractTests(sampleTestCode, {
      enableAnalysis: true,
      enableValidation: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    if (result.data) {
      const stats = result.data.getStatistics();
      expect(stats.totalTests).toBeGreaterThan(0);
      expect(stats.requestSpecificCount).toBeGreaterThanOrEqual(0);
      expect(stats.sharedTestsCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('should validate source code', async () => {
    const extractor = createTestExtractor();
    const result = await extractor.validateSource(sampleTestCode);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should get source statistics', async () => {
    const extractor = createTestExtractor();
    const result = await extractor.getStatistics(sampleTestCode);

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();

    if (result.stats) {
      expect(result.stats.totalBlocks).toBeGreaterThan(0);
      expect(result.stats.describeBlocks).toBeGreaterThan(0);
      expect(result.stats.itBlocks).toBeGreaterThan(0);
    }
  });

  it('should handle invalid source code', async () => {
    const extractor = createTestExtractor();
    const invalidCode = 'this is not valid typescript';

    const result = await extractor.extractTests(invalidCode);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should create extractor with custom patterns', () => {
    const customPatterns = [/describe\s*\(\s*['"`][^'"`]*custom[^'"`]*['"`]/i];

    const extractor = TestExtractorFactory.createWithPatterns(customPatterns);
    expect(extractor).toBeDefined();
  });

  it('should use builder pattern', () => {
    const extractor = TestExtractorFactory.builder()
      .withAnalysis(true)
      .withValidation(true)
      .withParsingOptions({
        preserveFormatting: true,
        includeComments: true,
        extractHelpers: true,
      });

    expect(extractor).toBeDefined();
  });
});
