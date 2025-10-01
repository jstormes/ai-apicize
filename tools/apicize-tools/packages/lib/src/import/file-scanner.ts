import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface ScannedFile {
  /** Absolute path to the file */
  filePath: string;
  /** Relative path from the project root */
  relativePath: string;
  /** File basename without extension */
  baseName: string;
  /** Directory containing the file */
  directory: string;
  /** Whether this is a main index file */
  isMainFile: boolean;
  /** Whether this is a test suite file */
  isSuiteFile: boolean;
  /** File size in bytes */
  size: number;
  /** Last modification time */
  lastModified: Date;
}

export interface ProjectMap {
  /** Root directory of the project */
  rootPath: string;
  /** Main index test files */
  mainFiles: ScannedFile[];
  /** Test suite files in suites/ directories */
  suiteFiles: ScannedFile[];
  /** All test files found */
  allFiles: ScannedFile[];
  /** Package.json location if found */
  packageJsonPath?: string | undefined;
  /** Apicize config location if found */
  configPath?: string | undefined;
  /** Dependencies between files */
  dependencies: Map<string, string[]>;
}

export interface FileScannerOptions {
  /** Include files matching these patterns (default: .spec.ts and .test.ts files) */
  includePatterns?: string[];
  /** Exclude files matching these patterns */
  excludePatterns?: string[];
  /** Maximum depth to scan (default: 10) */
  maxDepth?: number;
  /** Whether to follow symbolic links (default: false) */
  followSymlinks?: boolean;
  /** Whether to scan for dependencies (default: true) */
  scanDependencies?: boolean;
}

export class FileScannerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly path?: string
  ) {
    super(message);
    this.name = 'FileScannerError';
  }
}

/**
 * Scans TypeScript project and identifies test files for import processing.
 *
 * The FileScanner locates all .spec.ts files in a project, categorizes them
 * as main vs suite files, and builds a dependency graph for proper import ordering.
 */
export class FileScanner {
  private readonly options: Required<FileScannerOptions>;

  constructor(options: FileScannerOptions = {}) {
    this.options = {
      includePatterns: options.includePatterns ?? ['**/*.spec.ts', '**/*.test.ts'],
      excludePatterns: options.excludePatterns ?? ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
      maxDepth: options.maxDepth ?? 10,
      followSymlinks: options.followSymlinks ?? false,
      scanDependencies: options.scanDependencies ?? true,
    };
  }

  /**
   * Scans a TypeScript project directory for test files.
   *
   * @param projectPath - Root directory of the TypeScript project
   * @returns Promise resolving to a ProjectMap with discovered files
   * @throws FileScannerError if the directory doesn't exist or can't be read
   */
  async scanProject(projectPath: string): Promise<ProjectMap> {
    const resolvedPath = path.resolve(projectPath);

    // Validate project directory exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new FileScannerError(
          `Path is not a directory: ${resolvedPath}`,
          'NOT_DIRECTORY',
          resolvedPath
        );
      }
    } catch (error) {
      if (error instanceof FileScannerError) {
        throw error;
      }
      throw new FileScannerError(
        `Cannot access directory: ${resolvedPath}`,
        'ACCESS_ERROR',
        resolvedPath
      );
    }

    // Find all test files
    const testFiles = await this.findTestFiles(resolvedPath);

    // Categorize files
    const { mainFiles, suiteFiles } = this.categorizeFiles(testFiles);

    // Find configuration files
    const packageJsonPath = await this.findFile(resolvedPath, 'package.json');
    const configPath = await this.findConfigFile(resolvedPath);

    // Build dependency graph if requested
    const dependencies = this.options.scanDependencies
      ? await this.buildDependencyGraph(testFiles)
      : new Map<string, string[]>();

    return {
      rootPath: resolvedPath,
      mainFiles,
      suiteFiles,
      allFiles: testFiles,
      packageJsonPath,
      configPath,
      dependencies,
    };
  }

  /**
   * Finds all test files matching the configured patterns.
   */
  private async findTestFiles(rootPath: string): Promise<ScannedFile[]> {
    const allMatches: string[] = [];

    // Find files for each include pattern
    for (const pattern of this.options.includePatterns) {
      try {
        const matches = await glob(pattern, {
          cwd: rootPath,
          absolute: false,
          ignore: this.options.excludePatterns,
          nodir: true,
        });
        allMatches.push(...matches);
      } catch (error) {
        throw new FileScannerError(
          `Error scanning pattern "${pattern}": ${error}`,
          'GLOB_ERROR',
          rootPath
        );
      }
    }

    // Remove duplicates and convert to ScannedFile objects
    const uniquePaths = [...new Set(allMatches)];
    const scannedFiles: ScannedFile[] = [];

    for (const relativePath of uniquePaths) {
      const filePath = path.resolve(rootPath, relativePath);

      try {
        const stats = await fs.stat(filePath);
        const directory = path.dirname(filePath);
        const baseName = path.basename(relativePath, path.extname(relativePath));

        scannedFiles.push({
          filePath,
          relativePath,
          baseName,
          directory,
          isMainFile: this.isMainFile(relativePath),
          isSuiteFile: this.isSuiteFile(relativePath),
          size: stats.size,
          lastModified: stats.mtime,
        });
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }

    return scannedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  /**
   * Categorizes files into main files and suite files.
   */
  private categorizeFiles(files: ScannedFile[]): {
    mainFiles: ScannedFile[];
    suiteFiles: ScannedFile[];
  } {
    const mainFiles: ScannedFile[] = [];
    const suiteFiles: ScannedFile[] = [];

    for (const file of files) {
      if (file.isSuiteFile) {
        suiteFiles.push(file);
      } else {
        // All other files are treated as main files (including index files and regular test files)
        mainFiles.push(file);
      }
    }

    return { mainFiles, suiteFiles };
  }

  /**
   * Determines if a file is a main index file.
   */
  private isMainFile(relativePath: string): boolean {
    const fileName = path.basename(relativePath);

    // Main files are specifically named index.spec.ts or index.test.ts
    return fileName === 'index.spec.ts' || fileName === 'index.test.ts';
  }

  /**
   * Determines if a file is a suite file.
   */
  private isSuiteFile(relativePath: string): boolean {
    const directory = path.dirname(relativePath);

    // Suite files are in suites/ or suite/ directories
    return (
      directory.includes('suites') ||
      directory.includes('suite') ||
      directory.includes('/suites/') ||
      directory.includes('/suite/')
    );
  }

  /**
   * Finds a specific file in the project directory.
   */
  private async findFile(rootPath: string, fileName: string): Promise<string | undefined> {
    const filePath = path.join(rootPath, fileName);

    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return undefined;
    }
  }

  /**
   * Finds Apicize configuration file.
   */
  private async findConfigFile(rootPath: string): Promise<string | undefined> {
    const configNames = ['apicize.config.json', 'apicize.json', '.apicizerc.json', '.apicizerc'];

    for (const configName of configNames) {
      const configPath = await this.findFile(rootPath, configName);
      if (configPath) {
        return configPath;
      }
    }

    return undefined;
  }

  /**
   * Builds dependency graph by analyzing import statements.
   */
  private async buildDependencyGraph(files: ScannedFile[]): Promise<Map<string, string[]>> {
    const dependencies = new Map<string, string[]>();

    for (const file of files) {
      try {
        const content = await fs.readFile(file.filePath, 'utf-8');
        const deps = this.extractImports(content, file.directory);
        dependencies.set(file.filePath, deps);
      } catch {
        // If we can't read a file, just skip its dependencies
        dependencies.set(file.filePath, []);
      }
    }

    return dependencies;
  }

  /**
   * Extracts import statements from TypeScript file content.
   */
  private extractImports(content: string, fileDirectory: string): string[] {
    const imports: string[] = [];

    // Match import statements (simplified regex)
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Skip node_modules and built-in imports
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      // Resolve relative paths
      try {
        const resolvedPath = path.resolve(fileDirectory, importPath);
        imports.push(resolvedPath);
      } catch {
        // Skip invalid paths
      }
    }

    return imports;
  }

  /**
   * Validates that a scanned project looks like an exported Apicize project.
   */
  static async validateApicizeProject(
    projectMap: ProjectMap
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for package.json
    if (!projectMap.packageJsonPath) {
      issues.push('No package.json found in project root');
    }

    // Check for test files
    if (projectMap.allFiles.length === 0) {
      issues.push('No test files found');
    }

    // Check for typical Apicize structure by checking if directories exist
    try {
      const libPath = path.join(projectMap.rootPath, 'lib');
      const configPath = path.join(projectMap.rootPath, 'config');

      let hasLibDirectory = false;
      let hasConfigDirectory = false;

      try {
        const libStat = await fs.stat(libPath);
        hasLibDirectory = libStat.isDirectory();
      } catch {
        // Directory doesn't exist
      }

      try {
        const configStat = await fs.stat(configPath);
        hasConfigDirectory = configStat.isDirectory();
      } catch {
        // Directory doesn't exist
      }

      if (!hasLibDirectory && !hasConfigDirectory) {
        issues.push(
          'Project does not appear to have Apicize library structure (missing lib/ or config/ directories)'
        );
      }
    } catch (error) {
      issues.push('Error checking project structure');
    }

    // Check for metadata in files (basic check)
    if (projectMap.allFiles.length > 0) {
      // This would be expanded to actually check file contents for metadata
      // For now, just check that we have files to potentially scan
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// Convenience functions for direct usage
export async function scanProject(
  projectPath: string,
  options?: FileScannerOptions
): Promise<ProjectMap> {
  const scanner = new FileScanner(options);
  return scanner.scanProject(projectPath);
}

export async function findTestFiles(
  projectPath: string,
  patterns?: string[]
): Promise<ScannedFile[]> {
  const options: FileScannerOptions = {
    scanDependencies: false, // Skip expensive dependency scanning for simple file finding
  };

  if (patterns) {
    options.includePatterns = patterns;
  }

  const scanner = new FileScanner(options);
  const projectMap = await scanner.scanProject(projectPath);
  return projectMap.allFiles;
}
