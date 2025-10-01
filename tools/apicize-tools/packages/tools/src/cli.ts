#!/usr/bin/env node
// CLI entry point for Apicize tools

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exportCommand } from './commands/export';
import { importCommand } from './commands/import';
import { validateCommand } from './commands/validate';
import { createCommand } from './commands/create';
import { runCommand } from './commands/run';
import { createDocsCommand } from './commands/docs';

// Read version from package.json instead of importing entire library
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);
const version = packageJson.version;

const program = new Command();

// Configure main program
program
  .name('apicize-tools')
  .description('CLI tools for working with .apicize API test files')
  .version(version)
  .option('-v, --verbose', 'enable verbose output')
  .option('--no-color', 'disable colored output')
  .hook('preAction', thisCommand => {
    // Set up global options
    const opts = thisCommand.opts();
    if (opts.noColor) {
      chalk.level = 0;
    }
    if (opts.verbose) {
      process.env.APICIZE_VERBOSE = 'true';
    }
  });

// Register commands
exportCommand(program);
importCommand(program);
validateCommand(program);
createCommand(program);
runCommand(program);
program.addCommand(createDocsCommand());

// Error handling
program.configureOutput({
  writeErr: str => process.stderr.write(chalk.red(str)),
  writeOut: str => process.stdout.write(str),
});

// Handle unknown commands
program.on('command:*', operands => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log(chalk.yellow('Use "apicize-tools --help" to see available commands'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
