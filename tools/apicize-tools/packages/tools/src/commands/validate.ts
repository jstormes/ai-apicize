// Validate command implementation

import { Command } from 'commander';
import { resolve, basename } from 'path';
import { statSync } from 'fs';
import {
  createSpinner,
  validateInputFile,
  validateApicizeFile as validateExtension,
  formatFileSize,
  formatDuration,
  success,
  warn,
  error,
  info,
  verbose,
  executeCommand,
} from '../utils/cli-utils';

interface ValidateOptions {
  strict?: boolean;
  format?: 'json' | 'text';
  verbose?: boolean;
  llmFriendly?: boolean;
  autoFix?: boolean;
  output?: string;
}

export function validateCommand(program: Command): void {
  program
    .command('validate <files...>')
    .description(`Validate .apicize file structure and content

🤖 LLM-Friendly Options:
  Use --llm-friendly to get detailed error explanations with examples
  Use --auto-fix to automatically correct common LLM mistakes:
    • Lowercase HTTP methods (get → GET)
    • Missing body type (null → {type: "None"})
    • Missing required fields (timeout, runs, etc.)
    • Missing IDs (auto-generated)
    • Missing test code (generates default test)

📝 Examples:
  # Basic validation
  apicize-tools validate myfile.apicize

  # Get LLM-friendly error messages
  apicize-tools validate myfile.apicize --llm-friendly

  # Auto-fix common errors and save
  apicize-tools validate myfile.apicize --auto-fix --output fixed.apicize

  # Validate multiple files
  apicize-tools validate *.apicize --llm-friendly

  # JSON output for programmatic use
  apicize-tools validate myfile.apicize --format json`)
    .option('--strict', 'enable strict validation mode (no tolerance for warnings)')
    .option('--format <type>', 'output format: "json" for programmatic use, "text" for humans (default: "text")', 'text')
    .option('--llm-friendly', '🤖 show detailed, LLM-friendly error messages with code examples')
    .option('--auto-fix', '🔧 automatically fix common errors (method casing, missing fields, body types, etc.)')
    .option('-o, --output <file>', '💾 save auto-fixed file (requires --auto-fix flag)')
    .action(async (files: string[], options: ValidateOptions) => {
      await executeCommand(() => validateAction(files, options), 'Validation failed');
    });
}

async function validateAction(files: string[], options: ValidateOptions): Promise<void> {
  const startTime = Date.now();
  const results: ValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  if (options.format === 'json') {
    // In JSON mode, suppress console output during validation
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
  }

  for (const file of files) {
    const spinner =
      options.format === 'text' ? createSpinner(`Validating ${basename(file)}...`) : null;

    try {
      spinner?.start();

      // Validate file exists and is readable
      const resolvedFile = validateInputFile(file);
      validateExtension(resolvedFile);

      const stats = statSync(resolvedFile);
      verbose(`Validating: ${resolvedFile}`);
      verbose(`File size: ${formatFileSize(stats.size)}`);

      // Read and parse the file
      const fileContent = await require('fs').promises.readFile(resolvedFile, 'utf8');
      const data = JSON.parse(fileContent);

      // Apply auto-fix if requested
      let fixedData = data;
      let fixResults = null;

      if (options.autoFix) {
        const { AutoFixer } = require('@jstormes/apicize-lib');
        const fixer = new AutoFixer();
        fixResults = fixer.fix(data);
        fixedData = fixResults.fixed;

        if (options.format === 'text') {
          console.log(fixer.formatResults(fixResults));
        }

        // Save fixed file if output specified
        if (options.output) {
          const fs = require('fs').promises;
          await fs.writeFile(
            options.output,
            JSON.stringify(fixedData, null, 2),
            'utf8'
          );
          if (options.format === 'text') {
            success(`Saved fixed file to: ${options.output}`);
          }
        }
      }

      // Perform validation (lazy load library only when command runs)
      const { validateApicizeFile, LLMFriendlyFormatter } = require('@jstormes/apicize-lib');
      const validation = validateApicizeFile(fixedData);

      // Use LLM-friendly formatting if requested
      if (options.llmFriendly && !validation.valid && options.format === 'text') {
        const formatter = new LLMFriendlyFormatter();
        console.log('\n' + formatter.formatErrors(validation.errors));
      }

      const result: ValidationResult = {
        file: resolvedFile,
        isValid: validation.valid,
        errors: validation.errors.map((err: any) => ({
          message: err.message,
          path: err.path,
          code: err.keyword,
        })),
        warnings: [],
        stats: {
          fileSize: stats.size,
          requests: data.requests?.length || 0,
          groups: 0,
          scenarios: data.scenarios?.length || 0,
          authConfigs: data.authorizations?.length || 0,
        },
      };

      results.push(result);
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      if (options.format === 'text') {
        if (result.isValid) {
          spinner?.succeed(`${basename(file)} is valid`);
          if (result.warnings.length > 0) {
            warn(`${result.warnings.length} warning(s) found`);
          }
        } else {
          spinner?.fail(`${basename(file)} has ${result.errors.length} error(s)`);
        }

        // Show errors and warnings in text mode
        if (result.errors.length > 0) {
          result.errors.forEach(err => {
            error(`  ${err.message} ${err.path ? `at ${err.path}` : ''}`);
          });
        }

        if (result.warnings.length > 0 && process.env.APICIZE_VERBOSE === 'true') {
          result.warnings.forEach(warning => {
            warn(`  ${warning.message} ${warning.path ? `at ${warning.path}` : ''}`);
          });
        }
      }
    } catch (err) {
      const result: ValidationResult = {
        file: resolve(file),
        isValid: false,
        errors: [
          {
            message: err instanceof Error ? err.message : String(err),
            path: '',
            code: 'FILE_ERROR',
          },
        ],
        warnings: [],
        stats: {
          fileSize: 0,
          requests: 0,
          groups: 0,
          scenarios: 0,
          authConfigs: 0,
        },
      };

      results.push(result);
      totalErrors += 1;

      if (options.format === 'text') {
        spinner?.fail(`Failed to validate ${basename(file)}`);
        error(`  ${result.errors[0].message}`);
      }
    }
  }

  const duration = Date.now() - startTime;

  if (options.format === 'json') {
    // Restore console functions
    console.log = process.stdout.write.bind(process.stdout);
    console.warn = process.stderr.write.bind(process.stderr);
    console.error = process.stderr.write.bind(process.stderr);

    const output = {
      summary: {
        totalFiles: files.length,
        validFiles: results.filter(r => r.isValid).length,
        totalErrors,
        totalWarnings,
        duration,
      },
      results,
    };

    console.log(JSON.stringify(output, null, 2));
  } else {
    // Text summary
    console.log();
    const validFiles = results.filter(r => r.isValid).length;

    if (totalErrors === 0) {
      success(`All ${files.length} file(s) are valid`);
      info(`Valid files: ${validFiles}`);
    } else {
      error(`${files.length - validFiles} of ${files.length} file(s) have errors`);
      info(`Invalid files: ${files.length - validFiles}`);
    }

    if (totalWarnings > 0) {
      warn(`Total warnings: ${totalWarnings}`);
    }

    info(`Validation completed in ${formatDuration(duration)}`);

    // Show detailed stats in verbose mode
    if (process.env.APICIZE_VERBOSE === 'true') {
      console.log();
      verbose('File statistics:');
      results.forEach(result => {
        verbose(`  ${basename(result.file)}:`);
        verbose(`    Requests: ${result.stats.requests}`);
        verbose(`    Groups: ${result.stats.groups}`);
        verbose(`    Scenarios: ${result.stats.scenarios}`);
        verbose(`    Auth configs: ${result.stats.authConfigs}`);
      });
    }
  }

  // Exit with error code if there are validation errors
  if (totalErrors > 0) {
    process.exit(1);
  }
}

interface ValidationResult {
  file: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    fileSize: number;
    requests: number;
    groups: number;
    scenarios: number;
    authConfigs: number;
  };
}

interface ValidationError {
  message: string;
  path: string;
  code: string;
}

interface ValidationWarning {
  message: string;
  path: string;
  code: string;
}
