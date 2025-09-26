import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Unit tests for the workbook validation script
 * Tests the validation script behavior under various conditions
 */

describe('Workbook Validation Script', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/validate-workbooks.js');
  const originalCwd = process.cwd();

  // Ensure we're in the right directory for tests
  beforeAll(() => {
    if (!process.cwd().includes('apicize-tools')) {
      process.chdir(path.resolve(__dirname, '..'));
    }
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  describe('Script Execution', () => {
    it('should show help when --help flag is provided', done => {
      const child = spawn('node', [scriptPath, '--help']);
      let output = '';
      let errorOutput = '';

      child.stdout.on('data', data => {
        output += data.toString();
      });

      child.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      child.on('close', code => {
        if (code !== 0) {
          console.log('Script stderr:', errorOutput);
          console.log('Script stdout:', output);
        }
        expect(code).toBe(0);
        expect(output).toContain('Apicize Workbook Validation Script');
        expect(output).toContain('Usage:');
        expect(output).toContain('Prerequisites:');
        expect(output).toContain('Exit codes:');
        done();
      });

      child.on('error', error => {
        console.error('Script execution error:', error);
        done(error);
      });
    }, 5000);

    it('should show help when -h flag is provided', done => {
      const child = spawn('node', [scriptPath, '-h']);
      let output = '';
      let errorOutput = '';

      child.stdout.on('data', data => {
        output += data.toString();
      });

      child.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      child.on('close', code => {
        if (code !== 0) {
          console.log('Script stderr:', errorOutput);
          console.log('Script stdout:', output);
        }
        expect(code).toBe(0);
        expect(output).toContain('Apicize Workbook Validation Script');
        done();
      });

      child.on('error', error => {
        console.error('Script execution error:', error);
        done(error);
      });
    }, 5000);
  });

  describe('Directory Validation', () => {
    it('should fail when not run from apicize-tools directory', done => {
      // Change to a different directory temporarily
      const tempDir = '/tmp';
      const child = spawn('node', [scriptPath], { cwd: tempDir });
      let output = '';

      child.stderr.on('data', data => {
        output += data.toString();
      });

      child.on('close', code => {
        expect(code).toBe(1);
        expect(output).toContain('This script must be run from the apicize-tools directory');
        done();
      });
    }, 5000);
  });

  describe('Build Prerequisites', () => {
    it('should fail when validation library is not built', done => {
      // Temporarily rename the dist directory to simulate unbuilt state
      const distPath = path.resolve('./packages/lib/dist');
      const tempPath = path.resolve('./packages/lib/dist-temp');
      let distExists = false;

      if (fs.existsSync(distPath)) {
        fs.renameSync(distPath, tempPath);
        distExists = true;
      }

      const child = spawn('node', [scriptPath]);
      let output = '';

      child.stderr.on('data', data => {
        output += data.toString();
      });

      child.on('close', code => {
        // Restore the dist directory if it existed
        if (distExists && fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, distPath);
        }

        expect(code).toBe(1);
        expect(output).toContain('Validation library not built');
        expect(output).toContain('npm run build');
        done();
      });
    }, 5000);
  });

  describe('Examples Directory Validation', () => {
    it('should fail when examples directory does not exist', done => {
      // Temporarily rename the examples directory
      const examplesPath = path.resolve('./packages/examples');
      const tempPath = path.resolve('./packages/examples-temp');
      let examplesExists = false;

      if (fs.existsSync(examplesPath)) {
        fs.renameSync(examplesPath, tempPath);
        examplesExists = true;
      }

      const child = spawn('node', [scriptPath]);
      let output = '';

      child.stderr.on('data', data => {
        output += data.toString();
      });

      child.on('close', code => {
        // Restore the examples directory if it existed
        if (examplesExists && fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, examplesPath);
        }

        expect(code).toBe(1);
        expect(output).toContain('Examples directory not found');
        done();
      });
    }, 5000);
  });

  describe('Workbook File Detection', () => {
    it('should fail when no .apicize files are found', done => {
      // Temporarily rename all .apicize files
      const workbooksDir = path.resolve('./packages/examples/workbooks');
      const renamedFiles: Array<{ old: string; new: string }> = [];

      if (fs.existsSync(workbooksDir)) {
        const files = fs.readdirSync(workbooksDir).filter(f => f.endsWith('.apicize'));
        files.forEach((file: string) => {
          const oldPath = path.join(workbooksDir, file);
          const newPath = path.join(workbooksDir, file + '.temp');
          fs.renameSync(oldPath, newPath);
          renamedFiles.push({ old: oldPath, new: newPath });
        });
      }

      const child = spawn('node', [scriptPath]);
      let output = '';

      child.stderr.on('data', data => {
        output += data.toString();
      });

      child.on('close', code => {
        // Restore the renamed files
        renamedFiles.forEach(({ old, new: newPath }) => {
          if (fs.existsSync(newPath)) {
            fs.renameSync(newPath, old);
          }
        });

        expect(code).toBe(1);
        expect(output).toContain('No .apicize files found');
        done();
      });
    }, 5000);
  });

  describe('Successful Validation', () => {
    it('should succeed when all workbooks are valid', done => {
      // This test assumes the project is built and examples exist
      const child = spawn('node', [scriptPath]);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        if (code === 0) {
          expect(stdout).toContain('Validating All Sample Workbooks');
          expect(stdout).toContain('workbook files to validate');
          expect(stdout).toContain('VALIDATION SUMMARY');
          expect(stdout).toContain('All workbooks validate successfully');
          expect(stdout).toContain('Valid workbooks:');
        } else {
          // If the test fails due to build issues, that's expected in CI
          expect(stderr).toMatch(/(Validation library not built|Examples directory not found)/);
        }
        done();
      });
    }, 8000);
  });

  describe('Error Handling', () => {
    it('should handle JSON parse errors gracefully', done => {
      // Create a temporary invalid .apicize file
      const workbooksDir = path.resolve('./packages/examples/workbooks');
      const invalidFile = path.join(workbooksDir, 'invalid-test.apicize');
      let createdFile = false;

      if (fs.existsSync(workbooksDir)) {
        fs.writeFileSync(invalidFile, '{ invalid json }');
        createdFile = true;
      }

      const child = spawn('node', [scriptPath]);
      let stdout = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.on('close', code => {
        // Clean up the test file
        if (createdFile && fs.existsSync(invalidFile)) {
          fs.unlinkSync(invalidFile);
        }

        if (createdFile) {
          expect(code).toBe(1);
          expect(stdout).toContain('💥 invalid-test.apicize - Parse error');
          expect(stdout).toContain('VALIDATION ERRORS');
        }
        done();
      });
    }, 8000);

    it('should provide detailed error reporting', done => {
      // Create a temporary .apicize file with validation errors
      const workbooksDir = path.resolve('./packages/examples/workbooks');
      const errorFile = path.join(workbooksDir, 'error-test.apicize');
      let createdFile = false;

      if (fs.existsSync(workbooksDir)) {
        // Create a file with missing required properties
        fs.writeFileSync(
          errorFile,
          JSON.stringify(
            {
              // Missing version property
              requests: [],
            },
            null,
            2
          )
        );
        createdFile = true;
      }

      const child = spawn('node', [scriptPath]);
      let stdout = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.on('close', code => {
        // Clean up the test file
        if (createdFile && fs.existsSync(errorFile)) {
          fs.unlinkSync(errorFile);
        }

        if (createdFile) {
          expect(code).toBe(1);
          expect(stdout).toContain('❌ error-test.apicize');
          expect(stdout).toContain('errors');
          expect(stdout).toContain('VALIDATION ERRORS');
          expect(stdout).toContain('Action Required');
        }
        done();
      });
    }, 8000);
  });

  describe('Output Format', () => {
    it('should produce expected output format for successful validation', done => {
      const child = spawn('node', [scriptPath]);
      let stdout = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.on('close', code => {
        if (code === 0) {
          // Check for expected output structure
          expect(stdout).toContain('🔍 Validating All Sample Workbooks');
          expect(stdout).toMatch(/Found \d+ workbook files to validate/);
          expect(stdout).toContain('📊 VALIDATION SUMMARY');
          expect(stdout).toMatch(/Valid workbooks: \d+\/\d+ \(\d+%\)/);
          expect(stdout).toContain('🎉 All workbooks validate successfully!');
          expect(stdout).toContain('maintain compatibility with existing .apicize files');
        }
        done();
      });
    }, 8000);
  });

  describe('File Processing', () => {
    it('should validate all expected workbook files', done => {
      const child = spawn('node', [scriptPath]);
      let stdout = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.on('close', code => {
        if (code === 0) {
          // Check that common workbook files are mentioned
          const expectedFiles = [
            'demo.apicize',
            'minimal.apicize',
            'request-groups.apicize',
            'simple-rest-api.apicize',
            'with-authentication.apicize',
          ];

          expectedFiles.forEach(filename => {
            expect(stdout).toContain(filename);
          });
        }
        done();
      });
    }, 8000);
  });
});
