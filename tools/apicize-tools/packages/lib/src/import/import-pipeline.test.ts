import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { ImportPipeline, ImportPipelineError } from './import-pipeline';

describe('ImportPipeline', () => {
  let tempDir: string;
  let testProjectDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = join(tmpdir(), 'apicize-import-test-' + randomUUID());
    await fs.mkdir(tempDir, { recursive: true });

    testProjectDir = join(tempDir, 'test-project');
    await fs.mkdir(testProjectDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create pipeline with default options', () => {
      const pipeline = new ImportPipeline();
      expect(pipeline).toBeInstanceOf(ImportPipeline);
    });

    it('should create pipeline with custom options', () => {
      const options = {
        skipValidation: true,
        maxFileSize: 1024 * 1024,
        autoGenerateIds: true,
      };
      const pipeline = new ImportPipeline(options);
      expect(pipeline).toBeInstanceOf(ImportPipeline);
    });
  });

  describe('importProject', () => {
    it('should fail with non-existent project path', async () => {
      const nonExistentPath = join(tempDir, 'non-existent');
      const pipeline = new ImportPipeline();

      await expect(pipeline.importProject(nonExistentPath)).rejects.toThrow(ImportPipelineError);
    });

    it('should fail with file instead of directory', async () => {
      const filePath = join(tempDir, 'file.txt');
      await fs.writeFile(filePath, 'content');

      const pipeline = new ImportPipeline();

      await expect(pipeline.importProject(filePath)).rejects.toThrow(ImportPipelineError);
    });

    it('should handle empty project gracefully', async () => {
      // Create empty project directory
      await createEmptyProject(testProjectDir);

      const pipeline = new ImportPipeline();
      const result = await pipeline.importProject(testProjectDir);

      expect(result.workbook).toBeDefined();
      expect(result.workbook.version).toBe(1.0);
      expect(result.workbook.requests).toHaveLength(0);
      expect(result.statistics.requestsReconstructed).toBe(0);
    });

    it('should import basic TypeScript project with metadata', async () => {
      // Create a basic test project structure
      await createBasicTestProject(testProjectDir);

      const pipeline = new ImportPipeline();
      const result = await pipeline.importProject(testProjectDir);

      expect(result.workbook).toBeDefined();
      expect(result.workbook.version).toBe(1.0);

      // Debug: Let's see what's happening
      if (result.workbook.requests.length === 0) {
        console.log('No requests found. Warnings:', result.warnings);
        console.log('Statistics:', result.statistics);

        // Check if files were actually scanned
        const files = await fs.readdir(testProjectDir);
        console.log('Files in test project:', files);

        // Check if test file exists and has content
        const testFilePath = join(testProjectDir, 'test.spec.ts');
        if (await fs.stat(testFilePath).catch(() => false)) {
          const content = await fs.readFile(testFilePath, 'utf-8');
          console.log('Test file content length:', content.length);
          console.log(
            'Contains @apicize-request-metadata:',
            content.includes('@apicize-request-metadata')
          );
        }
      }

      expect(result.workbook.requests).toHaveLength(1);
      expect(result.statistics.requestsReconstructed).toBe(1);
    });
  });

  describe('importFromFiles', () => {
    it('should import from specific files', async () => {
      const testFile = join(testProjectDir, 'test.spec.ts');
      await createTestFile(testFile);

      const pipeline = new ImportPipeline();
      const result = await pipeline.importFromFiles([testFile]);

      // Debug output
      if (result.workbook.requests.length === 0) {
        console.log('ImportFromFiles - No requests found. Warnings:', result.warnings);
        console.log('Statistics:', result.statistics);
      }

      expect(result.workbook.requests).toHaveLength(1);
      expect(result.statistics.filesScanned).toBe(1);
    });

    it('should handle non-existent files gracefully', async () => {
      const existingFile = join(testProjectDir, 'existing.spec.ts');
      const nonExistentFile = join(testProjectDir, 'non-existent.spec.ts');
      await createTestFile(existingFile);

      const pipeline = new ImportPipeline();
      const result = await pipeline.importFromFiles([existingFile, nonExistentFile]);

      expect(result.workbook.requests).toHaveLength(1);
      expect(result.warnings.some(w => w.message.includes('Could not read file'))).toBe(true);
    });
  });

  // ============= Test Helper Functions =============

  async function createEmptyProject(dir: string): Promise<void> {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
    };

    await fs.writeFile(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));
  }

  async function createBasicTestProject(dir: string): Promise<void> {
    await createEmptyProject(dir);
    // Make sure file is created in the correct location with .spec.ts extension
    const testFilePath = join(dir, 'test.spec.ts');
    await createTestFile(testFilePath);

    // Verify the file was created
    const exists = await fs
      .stat(testFilePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      throw new Error(`Test file was not created at ${testFilePath}`);
    }
  }

  async function createTestFile(filePath: string, requestId = 'request-1'): Promise<void> {
    const content = `import { describe, it } from 'mocha';
import { expect } from 'chai';

/* @apicize-request-metadata
{
  "id": "${requestId}",
  "name": "Test Request",
  "url": "https://api.example.com/test",
  "method": "GET",
  "headers": [
    {"name": "Content-Type", "value": "application/json"}
  ],
  "body": {
    "type": "None"
  },
  "timeout": 5000
}
@apicize-request-metadata-end */

describe('Test Request', () => {
  it('should return 200', () => {
    expect(response.status).to.equal(200);
  });
});`;

    await fs.writeFile(filePath, content);

    // Verify the file was written with content
    const writtenContent = await fs.readFile(filePath, 'utf-8');
    if (!writtenContent.includes('@apicize-request-metadata')) {
      throw new Error('Test file content was not written correctly');
    }
  }
});
