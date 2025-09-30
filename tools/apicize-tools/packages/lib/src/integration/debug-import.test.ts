/**
 * Debug test to examine import pipeline issues
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportPipeline } from '../export/export-pipeline';
import { ImportPipeline } from '../import/import-pipeline';
import { FileScanner } from '../import/file-scanner';
import { ApicizeWorkbook } from '../types';

describe('Debug Import Pipeline', () => {
  it('should debug import errors step by step', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apicize-debug-import-'));
    const exportPipeline = new ExportPipeline();
    const importPipeline = new ImportPipeline();
    const fileScanner = new FileScanner();

    try {
      // Export first
      const demoApicizeFile = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
      const originalContent = await fs.promises.readFile(demoApicizeFile, 'utf-8');
      const originalWorkbook: ApicizeWorkbook = JSON.parse(originalContent);

      const exportOutputDir = path.join(tempDir, 'exported');
      await exportPipeline.exportWorkbook(originalWorkbook, demoApicizeFile, {
        outputDir: exportOutputDir,
      });

      console.log('Export completed, files created in:', exportOutputDir);

      // Scan the project manually
      console.log('Scanning project...');
      const projectMap = await fileScanner.scanProject(exportOutputDir);
      console.log('Project scan completed:');
      console.log('- Main files:', projectMap.mainFiles.length);
      console.log('- Suite files:', projectMap.suiteFiles.length);
      console.log('- All files:', projectMap.allFiles.length);

      // List the files found
      console.log('\\nFiles found:');
      projectMap.allFiles.forEach(file => {
        console.log(`- ${file.relativePath} (${file.size} bytes)`);
      });

      // Try to import and catch the specific error
      console.log('\\nAttempting import...');
      try {
        const importResult = await importPipeline.importProject(exportOutputDir);
        console.log('Import successful!');
        console.log('- Requests reconstructed:', importResult.statistics.requestsReconstructed);
        console.log('- Groups reconstructed:', importResult.statistics.groupsReconstructed);
      } catch (error: any) {
        console.error('Import failed:', error.message);

        // If it's a JSON parsing error, let's find the problematic file
        if (error.message.includes('Invalid JSON in metadata block')) {
          console.log('\nLooking for the problematic file...');

          // Try to find the file with line 41 mentioned in error
          for (const file of projectMap.allFiles) {
            if (file.relativePath.endsWith('.spec.ts')) {
              try {
                const content = await fs.promises.readFile(file.filePath, 'utf-8');
                const lines = content.split('\n');
                console.log(`\n=== ${file.relativePath} around line 41 ===`);

                const startLine = Math.max(0, 40 - 5); // Show 5 lines before line 41
                const endLine = Math.min(lines.length, 40 + 5); // Show 5 lines after

                for (let i = startLine; i < endLine; i++) {
                  const lineNum = i + 1;
                  const prefix = lineNum === 41 ? '>>> ' : '    ';
                  console.log(`${prefix}${lineNum}: ${lines[i]}`);
                }

                // Look for metadata blocks in this file
                const metadataRegex = /\/\* @apicize-.*?@apicize-.*?-end \*\//gs;
                const matches = content.match(metadataRegex);
                if (matches) {
                  console.log(`\nFound ${matches.length} metadata blocks in ${file.relativePath}`);
                  matches.forEach((block, index) => {
                    console.log(`\nMetadata block ${index + 1}:`);
                    console.log(block);

                    // Try to parse the JSON part
                    const jsonMatch = block.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      try {
                        JSON.parse(jsonMatch[0]);
                        console.log('✓ JSON is valid');
                      } catch (jsonError: any) {
                        console.log('✗ JSON parse error:', jsonError.message);
                        console.log('Problematic JSON:');
                        console.log(jsonMatch[0]);
                      }
                    }
                  });
                }
              } catch (fileError: any) {
                console.log(`Error reading ${file.relativePath}:`, fileError.message);
              }
            }
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
