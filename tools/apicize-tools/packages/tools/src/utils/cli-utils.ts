// Utility functions for CLI operations

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { existsSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { createReadStream } from 'fs';

export interface CliOptions {
  verbose?: boolean;
  noColor?: boolean;
}

/**
 * Create a progress spinner with consistent styling
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: 'dots',
    color: 'blue',
  });
}

/**
 * Log verbose messages if verbose mode is enabled
 */
export function verbose(message: string): void {
  if (process.env.APICIZE_VERBOSE === 'true') {
    console.log(chalk.gray(`[VERBOSE] ${message}`));
  }
}

/**
 * Log informational messages
 */
export function info(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

/**
 * Log success messages
 */
export function success(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Log warning messages
 */
export function warn(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Log error messages
 */
export function error(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

/**
 * Validate that a file exists and is readable
 */
export function validateInputFile(filePath: string): string {
  const resolvedPath = resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Input file does not exist: ${filePath}`);
  }

  const stats = statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }

  try {
    // Test if file is readable
    createReadStream(resolvedPath, { start: 0, end: 0 }).destroy();
  } catch (err) {
    throw new Error(`Cannot read input file: ${filePath}`);
  }

  return resolvedPath;
}

/**
 * Validate that a directory exists or can be created
 */
export function validateOutputDirectory(dirPath: string): string {
  const resolvedPath = resolve(dirPath);

  if (existsSync(resolvedPath)) {
    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Output path exists but is not a directory: ${dirPath}`);
    }
  }

  return resolvedPath;
}

/**
 * Validate .apicize file extension
 */
export function validateApicizeFile(filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.apicize') {
    throw new Error(`Expected .apicize file, got: ${ext}`);
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Handle CLI errors consistently
 */
export function handleCliError(err: any, spinner?: Ora): never {
  if (spinner) {
    spinner.fail('Operation failed');
  }

  if (err instanceof Error) {
    error(err.message);
    verbose(`Stack trace: ${err.stack}`);
  } else {
    error('An unknown error occurred');
    verbose(`Error details: ${JSON.stringify(err)}`);
  }

  process.exit(1);
}

/**
 * Wrap async command execution with error handling
 */
export async function executeCommand<T>(
  command: () => Promise<T>,
  errorMessage: string = 'Command failed'
): Promise<T> {
  try {
    return await command();
  } catch (err) {
    error(errorMessage);
    verbose(`Error details: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
