/**
 * Simple export test to debug export pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportPipeline } from '../export/export-pipeline';
import { ApicizeWorkbook } from '../types';

describe('Simple Export Test', () => {
  let tempDir: string;
  let exportPipeline: ExportPipeline;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apicize-export-test-'));
    exportPipeline = new ExportPipeline();
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up temp directory: ${tempDir}`, error);
    }
  });

  it('should export demo.apicize successfully', async () => {
    // Load demo.apicize
    const demoApicizeFile = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
    console.log('Looking for demo.apicize at:', demoApicizeFile);
    console.log('File exists:', fs.existsSync(demoApicizeFile));

    if (!fs.existsSync(demoApicizeFile)) {
      // Skip if file doesn't exist
      console.warn('Skipping test - demo.apicize not found');
      return;
    }

    const originalContent = await fs.promises.readFile(demoApicizeFile, 'utf-8');
    const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

    console.log('Loaded workbook with', originalWorkbook.requests?.length || 0, 'top-level items');

    // Export to TypeScript
    const exportOutputDir = path.join(tempDir, 'exported');
    console.log('Exporting to:', exportOutputDir);

    const exportResult = await exportPipeline.exportWorkbook(originalWorkbook, demoApicizeFile, {
      outputDir: exportOutputDir,
    });

    console.log('Export result:', {
      success: exportResult.success,
      filesCreated: exportResult.filesCreated.length,
      outputPath: exportResult.outputPath,
      errors: exportResult.errors,
    });

    expect(exportResult.success).toBe(true);
    expect(exportResult.filesCreated.length).toBeGreaterThan(0);

    // Check if directory was created
    console.log('Output directory exists:', fs.existsSync(exportOutputDir));

    // List files created
    if (fs.existsSync(exportOutputDir)) {
      const files = await fs.promises.readdir(exportOutputDir, { recursive: true });
      console.log('Files in output directory:', files);
    }
  });

  it('should export minimal workbook', async () => {
    const minimalWorkbook: ApicizeWorkbook = {
      version: 1.0,
      requests: [
        {
          id: 'test-request-1',
          name: 'Test Request',
          url: 'https://api.example.com/test',
          method: 'GET' as any,
          test: 'expect(response.status).to.equal(200);',
        },
      ],
    };

    const exportOutputDir = path.join(tempDir, 'exported-minimal');
    const exportResult = await exportPipeline.exportWorkbook(minimalWorkbook, 'minimal.apicize', {
      outputDir: exportOutputDir,
    });

    console.log('Minimal export result:', {
      success: exportResult.success,
      filesCreated: exportResult.filesCreated.length,
      errors: exportResult.errors,
    });

    expect(exportResult.success).toBe(true);
    expect(exportResult.filesCreated.length).toBeGreaterThan(0);
  });
});
