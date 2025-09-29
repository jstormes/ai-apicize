// Run command implementation

import { Command } from 'commander';
import { resolve, basename, extname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { ExportPipeline } from '@apicize/lib';
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
  executeCommand
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
    .description('Execute .apicize file tests directly')
    .option('-s, --scenario <name>', 'scenario to use for execution')
    .option('-r, --reporter <type>', 'test reporter (spec|json|tap)', 'spec')
    .option('-t, --timeout <ms>', 'test timeout in milliseconds', '30000')
    .option('-o, --output <file>', 'output file for test results')
    .option('--no-cleanup', 'keep generated test files after execution')
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

    // Export to temporary directory
    spinner.text = 'Exporting to TypeScript tests...';
    const exportPipeline = new ExportPipeline();

    const exportResult = await exportPipeline.exportFromFile(resolvedInputFile, {
      outputDir: tempDir
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
        timestamp: new Date().toISOString()
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
      stdio: process.env.APICIZE_VERBOSE === 'true' ? 'inherit' : 'pipe'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run command: ${err.message}`));
    });
  });
}

async function runTests(testDir: string, options: RunOptions): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const mochaArgs = [
      '--recursive',
      '--reporter', options.reporter || 'spec'
    ];

    if (options.timeout) {
      mochaArgs.push('--timeout', options.timeout.toString());
    }

    // Add test files
    mochaArgs.push('**/*.spec.ts');

    verbose(`Running Mocha with args: ${mochaArgs.join(' ')}`);

    const child = spawn('npx', ['mocha', ...mochaArgs], {
      cwd: testDir,
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      const fullOutput = output + (errorOutput ? `\n\nErrors:\n${errorOutput}` : '');

      // Parse test results from output
      const testResult = parseTestOutput(fullOutput, options.reporter || 'spec');
      testResult.output = fullOutput;
      testResult.success = code === 0;

      resolve(testResult);
    });

    child.on('error', (err) => {
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
    output: output
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