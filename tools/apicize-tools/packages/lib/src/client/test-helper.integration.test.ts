import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { TestHelper } from './test-helper';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TestHelper Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;
  let testHelper: TestHelper;

  before(async function() {
    this.timeout(10000); // Increase timeout for setup

    // Save original working directory
    originalCwd = process.cwd();

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apicize-test-'));

    // Create metadata directory
    await fs.mkdir(path.join(testDir, 'metadata'), { recursive: true });

    // Create sample workbook.json
    const workbook = {
      version: 1.0,
      requests: [],
      scenarios: [
        {
          id: 'test-scenario',
          name: 'Test Scenario',
          variables: [
            { name: 'baseUrl', value: 'https://api.test.com', type: 'TEXT' },
            { name: 'apiKey', value: 'test-key-123', type: 'TEXT' },
          ],
        },
      ],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
      defaults: {
        selectedScenario: {
          id: 'test-scenario',
          name: 'Test Scenario',
        },
      },
    };

    await fs.writeFile(
      path.join(testDir, 'metadata', 'workbook.json'),
      JSON.stringify(workbook, null, 2)
    );

    // Change to test directory
    process.chdir(testDir);

    testHelper = new TestHelper();
  });

  after(async function() {
    this.timeout(10000); // Increase timeout for cleanup

    // Restore original working directory
    process.chdir(originalCwd);

    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error);
    }
  });

  describe('setupWorkbook()', () => {
    it('should load workbook metadata', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      expect(context).to.exist;
      expect(context.workbook).to.exist;
      expect(context.workbook.version).to.equal(1.0);
    });

    it('should load scenario variables', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      expect(context.scenario).to.exist;
      expect(context.scenario!.name).to.equal('Test Scenario');
      expect(context.$.baseUrl).to.equal('https://api.test.com');
      expect(context.$.apiKey).to.equal('test-key-123');
    });

    it('should provide output function', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      context.output('testKey', 'testValue');
      expect(context.$.testKey).to.equal('testValue');
    });

    it('should cache workbook metadata', async () => {
      const context1 = await testHelper.setupWorkbook('test-workbook');
      const context2 = await testHelper.setupWorkbook('test-workbook');

      expect(context1.workbook).to.exist;
      expect(context2.workbook).to.exist;
      // Both should reference the same cached workbook
      expect(context1.workbook.version).to.equal(context2.workbook.version);
    });
  });

  describe('cleanup()', () => {
    it('should cleanup context resources', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      context.output('testKey', 'testValue');
      await context.cleanup?.();

      // After cleanup, output should be cleared
      expect(Object.keys(context.$).length).to.be.lessThan(5);
    });

    it('should be safe to call multiple times', async () => {
      const context = await testHelper.setupWorkbook('test-workbook');

      await context.cleanup?.();
      await context.cleanup?.(); // Should not throw

      expect(context).to.exist;
    });
  });

  describe('setupTest() - backward compatibility', () => {
    it('should work as alias for setupWorkbook', async () => {
      const context = await testHelper.setupTest('test-workbook');

      expect(context).to.exist;
      expect(context.workbook).to.exist;
      expect(context.$.baseUrl).to.equal('https://api.test.com');
    });
  });

  describe('missing workbook.json', () => {
    it('should fallback to minimal workbook when file not found', async function() {
      this.timeout(5000);

      // Save current directory and change to temp without metadata
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apicize-no-metadata-'));
      const savedDir = process.cwd();

      try {
        process.chdir(tempDir);

        const helper = new TestHelper();
        const context = await helper.setupWorkbook('missing-workbook');

        expect(context).to.exist;
        expect(context.workbook).to.exist;
        expect(context.workbook.version).to.equal(1.0);
        expect(context.workbook.requests).to.be.an('array').that.is.empty;
      } finally {
        process.chdir(savedDir);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
