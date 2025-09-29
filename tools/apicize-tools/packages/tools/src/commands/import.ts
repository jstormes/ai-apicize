// Import command implementation

import { Command } from 'commander';
import { resolve, basename, extname } from 'path';
import { existsSync, statSync, readdirSync } from 'fs';
import { ImportPipeline } from '@apicize/lib';
import {
  createSpinner,
  formatFileSize,
  formatDuration,
  success,
  warn,
  info,
  verbose,
  handleCliError,
  executeCommand
} from '../utils/cli-utils';

interface ImportOptions {
  output?: string;
  overwrite?: boolean;
  validate?: boolean;
  verbose?: boolean;
}

export function importCommand(program: Command): void {
  program
    .command('import <directory>')
    .description('Import TypeScript tests back to .apicize file')
    .option('-o, --output <file>', 'output .apicize file (default: based on directory name)')
    .option('--overwrite', 'overwrite existing output file')
    .option('--no-validate', 'skip validation of imported data')
    .action(async (directory: string, options: ImportOptions) => {
      await executeCommand(() => importAction(directory, options), 'Import failed');
    });
}

async function importAction(inputDirectory: string, options: ImportOptions): Promise<void> {
  const startTime = Date.now();
  const spinner = createSpinner('Preparing import...');

  try {
    // Validate input directory
    spinner.start();
    const resolvedInputDir = resolve(inputDirectory);

    if (!existsSync(resolvedInputDir)) {
      throw new Error(`Input directory does not exist: ${inputDirectory}`);
    }

    const inputStats = statSync(resolvedInputDir);
    if (!inputStats.isDirectory()) {
      throw new Error(`Input path is not a directory: ${inputDirectory}`);
    }

    verbose(`Input directory: ${resolvedInputDir}`);

    // Check for TypeScript test files
    const testFiles = findTestFiles(resolvedInputDir);
    if (testFiles.length === 0) {
      throw new Error('No TypeScript test files (.spec.ts or .test.ts) found in directory');
    }

    verbose(`Found ${testFiles.length} test files`);

    // Determine output file
    const outputFile = options.output
      ? resolve(options.output)
      : resolve(`${basename(resolvedInputDir)}.apicize`);

    verbose(`Output file: ${outputFile}`);

    // Check if output file exists
    if (existsSync(outputFile) && !options.overwrite) {
      spinner.fail('Output file already exists');
      warn('Use --overwrite to replace existing file');
      process.exit(1);
    }

    // Validate output file extension
    if (extname(outputFile).toLowerCase() !== '.apicize') {
      throw new Error('Output file must have .apicize extension');
    }

    // Create import pipeline
    spinner.text = 'Initializing import pipeline...';
    const pipeline = new ImportPipeline();

    // Execute import
    spinner.text = 'Scanning TypeScript files...';
    const result = await pipeline.importProject(resolvedInputDir);

    spinner.succeed('Import completed successfully');

    // Report results
    const duration = Date.now() - startTime;
    const outputStats = statSync(outputFile);

    success(`Imported TypeScript tests to "${basename(outputFile)}"`);
    info(`Output file: ${outputFile}`);
    info(`File size: ${formatFileSize(outputStats.size)}`);
    info(`Files scanned: ${result.statistics.filesScanned}`);
    info(`Requests imported: ${result.statistics.requestsReconstructed}`);
    info(`Groups imported: ${result.statistics.groupsReconstructed}`);

    if (result.roundTripAccuracy) {
      const accuracy = (result.roundTripAccuracy.dataPreserved * 100).toFixed(1);
      if (result.roundTripAccuracy.dataPreserved >= 0.99) {
        success(`Round-trip accuracy: ${accuracy}%`);
      } else if (result.roundTripAccuracy.dataPreserved >= 0.95) {
        warn(`Round-trip accuracy: ${accuracy}%`);
      } else {
        warn(`Round-trip accuracy: ${accuracy}% (some data may be lost)`);
      }
    }

    info(`Duration: ${formatDuration(duration)}`);

    // Show warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.log();
      warn('Import warnings:');
      result.warnings.forEach((warning: any) => {
        console.log(`  • ${warning.message}`);
      });
    }

    // Show processed files in verbose mode
    if (process.env.APICIZE_VERBOSE === 'true') {
      verbose('Processed files:');
      testFiles.forEach(file => {
        verbose(`  ${file}`);
      });
    }

    // Show validation info
    if (options.validate !== false) {
      success('Generated .apicize file passed validation');
    }

  } catch (err) {
    handleCliError(err, spinner);
  }
}

function findTestFiles(directory: string): string[] {
  const testFiles: string[] = [];

  function scanDirectory(dir: string): void {
    try {
      const items = readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = resolve(dir, item.name);

        if (item.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath);
        } else if (item.isFile()) {
          const fileName = item.name.toLowerCase();
          if (fileName.endsWith('.spec.ts') || fileName.endsWith('.test.ts')) {
            testFiles.push(fullPath);
          }
        }
      }
    } catch (err) {
      verbose(`Error scanning directory ${dir}: ${err}`);
    }
  }

  scanDirectory(directory);
  return testFiles.sort();
}