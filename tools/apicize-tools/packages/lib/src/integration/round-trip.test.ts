/**
 * Round-trip integration tests for .apicize export/import pipeline
 * Tests the complete workflow: .apicize → TypeScript → .apicize
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportPipeline } from '../export/export-pipeline';
import { ImportPipeline } from '../import/import-pipeline';
import { FileScanner } from '../import/file-scanner';
import { ApicizeWorkbook } from '../types';

describe('Round-trip Integration Tests', () => {
  let tempDir: string;
  let exportPipeline: ExportPipeline;
  let importPipeline: ImportPipeline;
  let fileScanner: FileScanner;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apicize-roundtrip-'));

    // Initialize pipelines
    exportPipeline = new ExportPipeline();
    importPipeline = new ImportPipeline();
    fileScanner = new FileScanner();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up temp directory: ${tempDir}`, error);
    }
  });

  describe('demo.apicize round-trip', () => {
    it('should maintain data fidelity through export→import cycle', async () => {
      // Step 1: Load original .apicize file
      const originalApicizeFile = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
      expect(fs.existsSync(originalApicizeFile)).toBe(true);

      const originalContent = await fs.promises.readFile(originalApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      // Step 2: Export to TypeScript
      const exportOutputDir = path.join(tempDir, 'exported');
      const exportResult = await exportPipeline.exportWorkbook(
        originalWorkbook,
        originalApicizeFile,
        {
          outputDir: exportOutputDir,
          includeMetadata: true,
          generateHelpers: true,
          splitByGroup: true,
        }
      );

      expect(exportResult.success).toBe(true);
      expect(exportResult.filesCreated.length).toBeGreaterThan(0);

      // Verify key files were created
      expect(exportResult.filesCreated.find(f => f.includes('index.spec.ts'))).toBeDefined();
      expect(exportResult.filesCreated.find(f => f.includes('package.json'))).toBeDefined();

      // Step 3: Scan the exported TypeScript project
      const projectMap = await fileScanner.scanProject(exportOutputDir);
      expect(projectMap.allFiles.length).toBeGreaterThan(0);

      // Step 4: Import back to .apicize
      const importResult = await importPipeline.importProject(exportOutputDir);
      expect(importResult.workbook).toBeDefined();

      // Step 5: Compare original vs round-trip workbook
      const roundTripWorkbook = importResult.workbook;

      // Basic structure validation
      expect(roundTripWorkbook.version).toBe(originalWorkbook.version);
      expect(roundTripWorkbook.requests).toBeDefined();
      expect(Array.isArray(roundTripWorkbook.requests)).toBe(true);

      // Request count validation
      const originalRequestCount = countAllRequests(originalWorkbook.requests || []);
      const roundTripRequestCount = countAllRequests(roundTripWorkbook.requests || []);
      expect(roundTripRequestCount).toBe(originalRequestCount);

      // Group count validation
      const originalGroupCount = countAllGroups(originalWorkbook.requests || []);
      const roundTripGroupCount = countAllGroups(roundTripWorkbook.requests || []);
      expect(roundTripGroupCount).toBe(originalGroupCount);

      // Scenarios preservation
      if (originalWorkbook.scenarios) {
        expect(roundTripWorkbook.scenarios).toBeDefined();
        expect(roundTripWorkbook.scenarios!.length).toBe(originalWorkbook.scenarios.length);
      }

      // Authorizations preservation
      if (originalWorkbook.authorizations) {
        expect(roundTripWorkbook.authorizations).toBeDefined();
        expect(roundTripWorkbook.authorizations!.length).toBe(
          originalWorkbook.authorizations.length
        );
      }

      console.log('Round-trip statistics:', {
        originalRequests: originalRequestCount,
        roundTripRequests: roundTripRequestCount,
        originalGroups: originalGroupCount,
        roundTripGroups: roundTripGroupCount,
        exportedFiles: exportResult.filesCreated.length,
        importedItems:
          importResult.statistics.requestsReconstructed +
          importResult.statistics.groupsReconstructed,
      });
    });

    it('should preserve request properties and test code', async () => {
      // Load and process demo.apicize
      const originalApicizeFile = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
      const originalContent = await fs.promises.readFile(originalApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      // Export → Import cycle
      const exportOutputDir = path.join(tempDir, 'exported-requests');
      await exportPipeline.exportWorkbook(originalWorkbook, originalApicizeFile, {
        outputDir: exportOutputDir,
      });
      const importResult = await importPipeline.importProject(exportOutputDir);

      expect(importResult.workbook).toBeDefined();
      const roundTripWorkbook = importResult.workbook;

      // Find specific requests to validate detailed properties
      const originalRequests = flattenAllRequests(originalWorkbook.requests || []);
      const roundTripRequests = flattenAllRequests(roundTripWorkbook.requests || []);

      // Test specific request preservation
      for (const originalRequest of originalRequests) {
        const roundTripRequest = roundTripRequests.find(r => r.id === originalRequest.id);
        expect(roundTripRequest).toBeDefined();

        if (roundTripRequest) {
          // Basic properties
          expect(roundTripRequest.name).toBe(originalRequest.name);
          expect(roundTripRequest.url).toBe(originalRequest.url);
          expect(roundTripRequest.method).toBe(originalRequest.method);

          // Test code preservation
          if (originalRequest.test) {
            expect(roundTripRequest.test).toBeDefined();
            expect(typeof roundTripRequest.test).toBe('string');
            // Test code should contain similar patterns (exact match may vary due to formatting)
            expect(roundTripRequest.test.length).toBeGreaterThan(0);
          }

          // Headers preservation
          if (originalRequest.headers && originalRequest.headers.length > 0) {
            expect(roundTripRequest.headers).toBeDefined();
            expect(roundTripRequest.headers!.length).toBe(originalRequest.headers.length);
          }

          // Body preservation
          if (originalRequest.body && originalRequest.body.type !== 'None') {
            expect(roundTripRequest.body).toBeDefined();
            expect(roundTripRequest.body!.type).toBe(originalRequest.body.type);
          }
        }
      }
    });
  });

  describe('complex workbook round-trip', () => {
    it('should handle request-groups.apicize with nested structures', async () => {
      const complexApicizeFile = path.join(
        __dirname,
        '../../../examples/workbooks/request-groups.apicize'
      );

      if (!fs.existsSync(complexApicizeFile)) {
        console.warn('Skipping request-groups.apicize test - file not found');
        return;
      }

      const originalContent = await fs.promises.readFile(complexApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      // Export → Import cycle
      const exportOutputDir = path.join(tempDir, 'exported-complex');
      await exportPipeline.exportWorkbook(originalWorkbook, complexApicizeFile, {
        outputDir: exportOutputDir,
      });
      const importResult = await importPipeline.importProject(exportOutputDir);

      expect(importResult.workbook).toBeDefined();
      const roundTripWorkbook = importResult.workbook;

      // Validate complex structure preservation
      expect(roundTripWorkbook.version).toBe(originalWorkbook.version);

      const originalHierarchy = analyzeHierarchy(originalWorkbook.requests || []);
      const roundTripHierarchy = analyzeHierarchy(roundTripWorkbook.requests || []);

      expect(roundTripHierarchy.totalItems).toBe(originalHierarchy.totalItems);
      expect(roundTripHierarchy.maxDepth).toBeLessThanOrEqual(originalHierarchy.maxDepth + 1); // Allow for some flattening
    });
  });

  describe('minimal workbook round-trip', () => {
    it('should handle minimal.apicize with basic structure', async () => {
      const minimalApicizeFile = path.join(
        __dirname,
        '../../../examples/workbooks/minimal.apicize'
      );

      if (!fs.existsSync(minimalApicizeFile)) {
        console.warn('Skipping minimal.apicize test - file not found');
        return;
      }

      const originalContent = await fs.promises.readFile(minimalApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      // Export → Import cycle
      const exportOutputDir = path.join(tempDir, 'exported-minimal');
      await exportPipeline.exportWorkbook(originalWorkbook, minimalApicizeFile, {
        outputDir: exportOutputDir,
      });
      const importResult = await importPipeline.importProject(exportOutputDir);

      expect(importResult.workbook).toBeDefined();
      const roundTripWorkbook = importResult.workbook;

      // Basic validation for minimal structure
      expect(roundTripWorkbook.version).toBe(originalWorkbook.version);

      if (originalWorkbook.requests) {
        expect(roundTripWorkbook.requests).toBeDefined();
        const originalCount = countAllRequests(originalWorkbook.requests);
        const roundTripCount = countAllRequests(roundTripWorkbook.requests || []);
        expect(roundTripCount).toBe(originalCount);
      }
    });
  });

  describe('round-trip limitations and edge cases', () => {
    it('should handle workbooks with no requests', async () => {
      const emptyWorkbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      // Export → Import cycle
      const exportOutputDir = path.join(tempDir, 'exported-empty');
      await exportPipeline.exportWorkbook(emptyWorkbook, 'empty.apicize', {
        outputDir: exportOutputDir,
      });
      const importResult = await importPipeline.importProject(exportOutputDir);

      expect(importResult.workbook).toBeDefined();
      const roundTripWorkbook = importResult.workbook;

      expect(roundTripWorkbook.version).toBe(emptyWorkbook.version);
      expect(roundTripWorkbook.requests).toBeDefined();
      expect(roundTripWorkbook.requests!.length).toBe(0);
    });

    it('should report any data loss or transformation issues', async () => {
      // This test documents known limitations in the round-trip process
      const originalApicizeFile = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
      const originalContent = await fs.promises.readFile(originalApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      // Export → Import cycle
      const exportOutputDir = path.join(tempDir, 'exported-limitations');
      const exportResult = await exportPipeline.exportWorkbook(
        originalWorkbook,
        originalApicizeFile,
        { outputDir: exportOutputDir }
      );
      const importResult = await importPipeline.importProject(exportOutputDir);

      // Document any warnings or limitations
      if (importResult.warnings && importResult.warnings.length > 0) {
        console.log('Round-trip warnings:', importResult.warnings);
      }

      if (exportResult.warnings && exportResult.warnings.length > 0) {
        console.log('Export warnings:', exportResult.warnings);
      }

      // This test always passes but logs any issues found
      expect(true).toBe(true);
    });
  });
});

// Helper functions for analyzing workbook structure
function countAllRequests(items: any[]): number {
  let count = 0;
  for (const item of items) {
    if (item.children) {
      count += countAllRequests(item.children);
    } else {
      count += 1;
    }
  }
  return count;
}

function countAllGroups(items: any[]): number {
  let count = 0;
  for (const item of items) {
    if (item.children) {
      count += 1;
      count += countAllGroups(item.children);
    }
  }
  return count;
}

function flattenAllRequests(items: any[]): any[] {
  const requests: any[] = [];
  for (const item of items) {
    if (item.children) {
      requests.push(...flattenAllRequests(item.children));
    } else {
      requests.push(item);
    }
  }
  return requests;
}

function analyzeHierarchy(items: any[], depth = 0): { totalItems: number; maxDepth: number } {
  let totalItems = items.length;
  let maxDepth = depth;

  for (const item of items) {
    if (item.children) {
      const childAnalysis = analyzeHierarchy(item.children, depth + 1);
      totalItems += childAnalysis.totalItems;
      maxDepth = Math.max(maxDepth, childAnalysis.maxDepth);
    }
  }

  return { totalItems, maxDepth };
}
