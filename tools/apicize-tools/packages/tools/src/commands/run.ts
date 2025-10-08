// Run command implementation

import { Command } from 'commander';
import { resolve, basename, extname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createSpinner,
  validateInputFile,
  validateApicizeFile,
  formatDuration,
  success,
  warn,
  error,
  info,
  verbose,
  handleCliError,
  executeCommand,
} from '../utils/cli-utils';

interface RunOptions {
  scenario?: string;
  reporter?: string;
  timeout?: number;
  output?: string;
  cleanup?: boolean;
  verbose?: boolean;
}

export function runCommand(program: Command): void {
  program
    .command('run <file>')
    .description(`Execute .apicize file tests directly

Runs tests from your .apicize file without manual export. Automatically exports
to temp directory, executes with Mocha, and cleans up.

📝 Examples:
  # Run tests with default settings
  apicize-tools run myfile.apicize

  # Run with specific scenario
  apicize-tools run myfile.apicize --scenario production

  # Run with JSON reporter (for CI/CD)
  apicize-tools run myfile.apicize --reporter json

  # Save results to file
  apicize-tools run myfile.apicize --reporter json --output results.json

  # Keep generated test files for debugging
  apicize-tools run myfile.apicize --no-cleanup

  # Custom timeout (60 seconds)
  apicize-tools run myfile.apicize --timeout 60000

Available reporters:
  • spec: Human-readable output (default)
  • json: Machine-readable JSON output
  • tap: TAP protocol output`)
    .option('-s, --scenario <name>', 'use specific scenario for variable substitution')
    .option('-r, --reporter <type>', 'test reporter: spec (default), json, or tap', 'spec')
    .option('-t, --timeout <ms>', 'test timeout in milliseconds (default: 30000)', '30000')
    .option('-o, --output <file>', 'save test results to file')
    .option('--no-cleanup', 'keep generated test files after execution (useful for debugging)')
    .action(async (file: string, options: RunOptions) => {
      await executeCommand(() => runAction(file, options), 'Test execution failed');
    });
}

async function runAction(inputFile: string, options: RunOptions): Promise<void> {
  const startTime = Date.now();
  const spinner = createSpinner('Preparing test execution...');

  let tempDir: string | null = null;

  try {
    // Validate input file
    spinner.start();
    const resolvedInputFile = validateInputFile(inputFile);
    validateApicizeFile(resolvedInputFile);

    verbose(`Input file: ${resolvedInputFile}`);

    // Create temporary directory for test execution
    tempDir = join(tmpdir(), `apicize-run-${Date.now()}`);
    verbose(`Temporary directory: ${tempDir}`);

    // Export to temporary directory (lazy load library only when command runs)
    spinner.text = 'Exporting to TypeScript tests...';
    const { ExportPipeline } = require('@jstormes/apicize-lib');
    const exportPipeline = new ExportPipeline();

    const exportResult = await exportPipeline.exportFromFile(resolvedInputFile, {
      outputDir: tempDir,
    });

    verbose(`Exported to ${exportResult.filesCreated.length} files`);

    // Install dependencies
    spinner.text = 'Installing test dependencies...';
    await runShellCommand('npm', ['install'], tempDir);

    // Run tests
    spinner.text = 'Executing tests...';
    const testResult = await runTests(tempDir, options);

    spinner.succeed('Test execution completed');

    // Report results
    const duration = Date.now() - startTime;
    const baseName = basename(inputFile, extname(inputFile));

    info('Test execution completed');

    if (testResult.success) {
      success(`Tests passed for "${baseName}"`);
    } else {
      error(`Tests failed for "${baseName}"`);
    }

    info(`Tests run: ${testResult.tests}`);
    info(`Passed: ${testResult.passed}`);
    info(`Failed: ${testResult.failed}`);
    info(`Duration: ${formatDuration(duration)}`);

    if (options.scenario) {
      info(`Scenario: ${options.scenario}`);
    }

    // Show test output in verbose mode or if tests failed
    if (process.env.APICIZE_VERBOSE === 'true' || !testResult.success) {
      console.log();
      console.log('Test Output:');
      console.log(testResult.output);
    }

    // Save output to file if requested
    if (options.output) {
      const outputFile = resolve(options.output);
      const { writeFile } = await import('fs/promises');

      const outputData = {
        file: baseName,
        scenario: options.scenario,
        duration,
        results: testResult,
        timestamp: new Date().toISOString(),
      };

      await writeFile(outputFile, JSON.stringify(outputData, null, 2), 'utf8');
      info(`Results saved to: ${outputFile}`);
    }

    // Exit with error code if tests failed
    if (!testResult.success) {
      process.exit(1);
    }
  } catch (err) {
    handleCliError(err, spinner);
  } finally {
    // Cleanup temporary directory
    if (tempDir && options.cleanup !== false) {
      try {
        const { rm } = await import('fs/promises');
        await rm(tempDir, { recursive: true, force: true });
        verbose(`Cleaned up temporary directory: ${tempDir}`);
      } catch (cleanupErr) {
        warn(`Failed to cleanup temporary directory: ${tempDir}`);
      }
    } else if (tempDir) {
      info(`Test files preserved at: ${tempDir}`);
    }
  }
}

async function runShellCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    verbose(`Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd,
      stdio: process.env.APICIZE_VERBOSE === 'true' ? 'inherit' : 'pipe',
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      }
    });

    child.on('error', err => {
      reject(new Error(`Failed to run command: ${err.message}`));
    });
  });
}

async function runTests(testDir: string, options: RunOptions): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const mochaArgs = ['--recursive', '--reporter', options.reporter || 'spec'];

    if (options.timeout) {
      mochaArgs.push('--timeout', options.timeout.toString());
    }

    // Add test files
    mochaArgs.push('**/*.spec.ts');

    verbose(`Running Mocha with args: ${mochaArgs.join(' ')}`);

    const child = spawn('npx', ['mocha', ...mochaArgs], {
      cwd: testDir,
      stdio: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', data => {
      output += data.toString();
    });

    child.stderr?.on('data', data => {
      errorOutput += data.toString();
    });

    child.on('close', code => {
      const fullOutput = output + (errorOutput ? `\n\nErrors:\n${errorOutput}` : '');

      // Parse test results from output
      const testResult = parseTestOutput(fullOutput, options.reporter || 'spec');
      testResult.output = fullOutput;
      testResult.success = code === 0;

      resolve(testResult);
    });

    child.on('error', err => {
      reject(new Error(`Failed to run tests: ${err.message}`));
    });
  });
}

function parseTestOutput(output: string, reporter: string): TestResult {
  const result: TestResult = {
    success: false,
    tests: 0,
    passed: 0,
    failed: 0,
    output: output,
  };

  try {
    if (reporter === 'json') {
      // Parse JSON reporter output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const testData = JSON.parse(jsonMatch[0]);
        result.tests = testData.tests?.length || 0;
        result.passed = testData.passes?.length || 0;
        result.failed = testData.failures?.length || 0;
      }
    } else {
      // Parse spec reporter output with regex
      const testMatch = output.match(/(\d+) passing/);
      const failMatch = output.match(/(\d+) failing/);

      result.passed = testMatch ? parseInt(testMatch[1]) : 0;
      result.failed = failMatch ? parseInt(failMatch[1]) : 0;
      result.tests = result.passed + result.failed;
    }
  } catch (err) {
    verbose(`Failed to parse test output: ${err}`);

    // Fallback: count basic patterns
    const passingLines = (output.match(/✓|√/g) || []).length;
    const failingLines = (output.match(/✗|×|\d+\)\s/g) || []).length;

    result.passed = passingLines;
    result.failed = failingLines;
    result.tests = passingLines + failingLines;
  }

  return result;
}

interface TestResult {
  success: boolean;
  tests: number;
  passed: number;
  failed: number;
  output: string;
}
