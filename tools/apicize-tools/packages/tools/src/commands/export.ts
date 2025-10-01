// Export command implementation

import { Command } from 'commander';
import { resolve, basename, extname } from 'path';
import { existsSync, statSync } from 'fs';
import {
  createSpinner,
  validateInputFile,
  validateApicizeFile,
  formatFileSize,
  formatDuration,
  success,
  warn,
  info,
  verbose,
  handleCliError,
  executeCommand,
} from '../utils/cli-utils';

interface ExportOptions {
  output?: string;
  scenario?: string;
  split?: boolean;
  overwrite?: boolean;
  verbose?: boolean;
}

export function exportCommand(program: Command): void {
  program
    .command('export <file>')
    .description('Export .apicize file to TypeScript Mocha/Chai tests')
    .option('-o, --output <directory>', 'output directory for generated tests (default: ./tests)')
    .option('-s, --scenario <name>', 'specific scenario to use for export')
    .option('--split', 'split large request groups into separate files')
    .option('--overwrite', 'overwrite existing output directory')
    .action(async (file: string, options: ExportOptions) => {
      await executeCommand(() => exportAction(file, options), 'Export failed');
    });
}

async function exportAction(inputFile: string, options: ExportOptions): Promise<void> {
  const startTime = Date.now();
  const spinner = createSpinner('Preparing export...');

  try {
    // Validate input file
    spinner.start();
    const resolvedInputFile = validateInputFile(inputFile);
    validateApicizeFile(resolvedInputFile);

    const inputStats = statSync(resolvedInputFile);
    verbose(`Input file: ${resolvedInputFile}`);
    verbose(`File size: ${formatFileSize(inputStats.size)}`);

    // Determine output directory
    const outputDir = options.output ? resolve(options.output) : resolve('./tests');

    verbose(`Output directory: ${outputDir}`);

    // Check if output directory exists
    if (existsSync(outputDir)) {
      if (!options.overwrite) {
        const stats = statSync(outputDir);
        if (stats.isDirectory()) {
          spinner.fail('Output directory already exists');
          warn('Use --overwrite to replace existing directory');
          process.exit(1);
        }
      } else {
        verbose('Overwriting existing output directory');
      }
    }

    // Create export pipeline (lazy load library only when command runs)
    spinner.text = 'Initializing export pipeline...';
    const { ExportPipeline } = require('@jstormes/apicize-lib');
    const pipeline = new ExportPipeline();

    // Execute export
    spinner.text = 'Parsing .apicize file...';
    const result = await pipeline.exportFromFile(resolvedInputFile, {
      outputDir,
      splitByGroup: options.split || false,
    });

    spinner.succeed('Export completed successfully');

    // Report results
    const duration = Date.now() - startTime;
    const baseName = basename(inputFile, extname(inputFile));

    success(`Exported "${baseName}" to TypeScript tests`);
    info(`Output directory: ${outputDir}`);
    info(`Generated files: ${result.filesCreated.length}`);
    info(`Output path: ${result.outputPath}`);

    if (options.scenario) {
      info(`Using scenario: ${options.scenario}`);
    }

    info(`Duration: ${formatDuration(duration)}`);

    // Show generated files in verbose mode
    if (process.env.APICIZE_VERBOSE === 'true') {
      verbose('Generated files:');
      result.filesCreated.forEach((file: string) => {
        verbose(`  ${file}`);
      });
    }

    // Show next steps
    console.log();
    info('Next steps:');
    console.log(`  cd ${outputDir}`);
    console.log('  npm install');
    console.log('  npm test');
  } catch (err) {
    handleCliError(err, spinner);
  }
}
