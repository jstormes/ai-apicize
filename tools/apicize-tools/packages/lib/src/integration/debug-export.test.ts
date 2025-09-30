/**
 * Debug test to examine exported TypeScript files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportPipeline } from '../export/export-pipeline';
import { ApicizeWorkbook } from '../types';

describe('Debug Export Files', () => {
  it('should examine generated TypeScript files', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apicize-debug-'));
    const exportPipeline = new ExportPipeline();

    try {
      // Load demo.apicize
      const demoApicizeFile = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
      const originalContent = await fs.promises.readFile(demoApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      // Export to TypeScript
      const exportOutputDir = path.join(tempDir, 'exported');
      await exportPipeline.exportWorkbook(originalWorkbook, demoApicizeFile, {
        outputDir: exportOutputDir,
      });

      // Read generated test files
      const testsDir = path.join(exportOutputDir, 'tests');
      const files = await fs.promises.readdir(testsDir, { recursive: true });
      console.log('Generated test files:', files);

      // Examine the main test file
      const mainTestFile = path.join(testsDir, 'index.spec.ts');
      if (fs.existsSync(mainTestFile)) {
        const content = await fs.promises.readFile(mainTestFile, 'utf-8');
        console.log('=== index.spec.ts content (first 500 chars) ===');
        console.log(content.substring(0, 500));
        console.log('=== End index.spec.ts ===');
      }

      // Examine suite files
      const suitesDir = path.join(testsDir, 'suites');
      if (fs.existsSync(suitesDir)) {
        const suiteFiles = await fs.promises.readdir(suitesDir);
        console.log('Suite files:', suiteFiles);

        // Read first suite file
        if (suiteFiles.length > 0) {
          const firstSuiteFile = path.join(suitesDir, suiteFiles[0]);
          const suiteContent = await fs.promises.readFile(firstSuiteFile, 'utf-8');
          console.log(`=== ${suiteFiles[0]} content (first 1000 chars) ===`);
          console.log(suiteContent.substring(0, 1000));
          console.log(`=== End ${suiteFiles[0]} ===`);

          // Look for metadata blocks
          const metadataMatches = suiteContent.match(/\/\* @apicize-.*?@apicize-.*?-end \*\//gs);
          if (metadataMatches) {
            console.log('Found metadata blocks:', metadataMatches.length);
            metadataMatches.forEach((block, index) => {
              console.log(`Metadata block ${index + 1}:`);
              console.log(block.substring(0, 300));
              console.log('---');
            });
          }
        }
      }
    } finally {
      // Clean up
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }
  });
});
