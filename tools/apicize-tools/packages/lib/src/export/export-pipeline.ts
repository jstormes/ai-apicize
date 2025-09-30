import { ApicizeWorkbook } from '../types';
import {
  ProjectScaffolder,
  ProjectScaffolderOptions,
  ScaffoldedProject,
} from '../generators/project-scaffolder';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export interface ExportOptions {
  outputDir?: string;
  projectName?: string;
  includeExampleData?: boolean;
  includeEnvConfig?: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  typescript?: boolean;
  strict?: boolean;
  splitByGroup?: boolean;
  includeMetadata?: boolean;
  generateHelpers?: boolean;
  scenarios?: string[];
  preserveOriginal?: boolean;
  progressCallback?: (stage: string, progress: number, message: string) => void;
  errorHandler?: (error: Error, stage: string) => void;
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  filesCreated: string[];
  metadata: {
    sourceFile: string;
    exportedAt: string;
    totalFiles: number;
    totalDirectories: number;
    scaffoldedProject: ScaffoldedProject;
    importMappings: ImportMapping[];
  };
  errors?: string[];
  warnings?: string[];
}

export interface ImportMapping {
  originalPath: string;
  exportedPath: string;
  type: 'workbook' | 'request' | 'group' | 'scenario' | 'auth' | 'data';
  id: string;
  metadata: Record<string, any>;
}

/**
 * Complete export pipeline that orchestrates the conversion of .apicize files
 * to fully functional TypeScript test projects.
 *
 * This class integrates the TestGenerator and ProjectScaffolder to provide
 * a complete end-to-end export solution with progress reporting, error handling,
 * and round-trip compatibility.
 */
export class ExportPipeline {
  private projectScaffolder: ProjectScaffolder;

  constructor() {
    this.projectScaffolder = new ProjectScaffolder();
  }

  /**
   * Export a .apicize workbook to a complete TypeScript test project
   */
  public async exportWorkbook(
    workbook: ApicizeWorkbook,
    sourceFilePath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const startTime = new Date();
    const result: ExportResult = {
      success: false,
      outputPath: '',
      filesCreated: [],
      metadata: {
        sourceFile: sourceFilePath,
        exportedAt: startTime.toISOString(),
        totalFiles: 0,
        totalDirectories: 0,
        scaffoldedProject: {
          files: [],
          metadata: { projectName: '', outputDir: '', totalFiles: 0, folders: [], scripts: [] },
        },
        importMappings: [],
      },
    };

    try {
      // Stage 1: Validate input
      this.reportProgress(options, 'validation', 10, 'Validating workbook structure...');
      this.validateWorkbook(workbook);

      // Stage 2: Configure options
      this.reportProgress(options, 'configuration', 20, 'Configuring export options...');
      const exportConfig = this.mergeOptions(options, sourceFilePath);
      result.outputPath = exportConfig.outputDir!;

      // Stage 3: Generate scaffolded project
      this.reportProgress(options, 'scaffolding', 40, 'Generating project structure...');
      const scaffoldedProject = this.projectScaffolder.scaffoldProject(
        workbook,
        sourceFilePath,
        this.createScaffolderOptions(exportConfig)
      );
      result.metadata.scaffoldedProject = scaffoldedProject;

      // Stage 4: Create import mappings
      this.reportProgress(options, 'mapping', 60, 'Creating import mappings...');
      const importMappings = this.generateImportMappings(
        workbook,
        sourceFilePath,
        scaffoldedProject
      );
      result.metadata.importMappings = importMappings;

      // Stage 5: Write files to disk
      this.reportProgress(options, 'writing', 80, 'Writing files to disk...');
      const filesCreated = await this.writeProjectFiles(scaffoldedProject, exportConfig.outputDir!);
      result.filesCreated = filesCreated;

      // Stage 6: Final validation
      this.reportProgress(options, 'finalizing', 95, 'Validating generated project...');
      await this.validateGeneratedProject(exportConfig.outputDir!);

      // Complete
      this.reportProgress(options, 'complete', 100, 'Export completed successfully');
      result.success = true;
      result.metadata.totalFiles = scaffoldedProject.files.length;
      result.metadata.totalDirectories = scaffoldedProject.metadata.folders.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!result.errors) {
        result.errors = [];
      }
      result.errors.push(errorMessage);
      result.success = false;

      if (options.errorHandler) {
        options.errorHandler(error instanceof Error ? error : new Error(errorMessage), 'export');
      }
    }

    return result;
  }

  /**
   * Export multiple workbooks to a single project
   */
  public async exportMultipleWorkbooks(
    workbooks: { workbook: ApicizeWorkbook; sourceFilePath: string }[],
    options: ExportOptions = {}
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (let i = 0; i < workbooks.length; i++) {
      const { workbook, sourceFilePath } = workbooks[i];

      // Update progress for multi-file export
      const fileProgress = (i / workbooks.length) * 100;
      this.reportProgress(
        options,
        'multi-export',
        fileProgress,
        `Exporting ${sourceFilePath} (${i + 1}/${workbooks.length})`
      );

      // Adjust output directory for multiple files
      const fileOptions: ExportOptions = {
        ...options,
        outputDir: options.outputDir
          ? join(options.outputDir, `workbook-${i + 1}`)
          : `./workbook-${i + 1}`,
      };

      const result = await this.exportWorkbook(workbook, sourceFilePath, fileOptions);
      results.push(result);
    }

    return results;
  }

  /**
   * Parse a .apicize file and export it
   */
  public async exportFromFile(
    filePath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      this.reportProgress(options, 'reading', 5, `Reading ${filePath}...`);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const workbook: ApicizeWorkbook = JSON.parse(fileContent);

      return await this.exportWorkbook(workbook, filePath, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        outputPath: '',
        filesCreated: [],
        metadata: {
          sourceFile: filePath,
          exportedAt: new Date().toISOString(),
          totalFiles: 0,
          totalDirectories: 0,
          scaffoldedProject: {
            files: [],
            metadata: { projectName: '', outputDir: '', totalFiles: 0, folders: [], scripts: [] },
          },
          importMappings: [],
        },
        errors: [errorMessage],
      };
    }
  }

  /**
   * Validate a workbook structure before export
   */
  private validateWorkbook(workbook: ApicizeWorkbook): void {
    if (!workbook) {
      throw new Error('Workbook is null or undefined');
    }

    if (!workbook.version) {
      throw new Error('Workbook version is required');
    }

    // Initialize requests array if it doesn't exist (for minimal workbooks)
    if (!workbook.requests) {
      workbook.requests = [];
    }

    if (!Array.isArray(workbook.requests)) {
      throw new Error('Workbook requests must be an array');
    }

    // Validate that requests have required fields
    for (const request of workbook.requests) {
      if (!request.id) {
        throw new Error(`Request missing required field: id`);
      }
    }
  }

  /**
   * Merge and validate export options
   */
  private mergeOptions(options: ExportOptions, sourceFilePath: string): Required<ExportOptions> {
    const defaults: Required<ExportOptions> = {
      outputDir: './exported-tests',
      projectName: this.getProjectNameFromPath(sourceFilePath),
      includeExampleData: true,
      includeEnvConfig: true,
      packageManager: 'npm',
      typescript: true,
      strict: true,
      splitByGroup: true,
      includeMetadata: true,
      generateHelpers: true,
      scenarios: [],
      preserveOriginal: true,
      progressCallback: () => {},
      errorHandler: () => {},
    };

    return { ...defaults, ...options };
  }

  /**
   * Extract project name from file path
   */
  private getProjectNameFromPath(filePath: string): string {
    // Extract just the filename (handle both Unix and Windows paths)
    const fileName = filePath.split(/[/\\]/).pop() || 'project';
    // Remove .apicize extension and sanitize
    return fileName.replace(/\.apicize$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
  }

  /**
   * Convert ExportOptions to ProjectScaffolderOptions
   */
  private createScaffolderOptions(options: Required<ExportOptions>): ProjectScaffolderOptions {
    return {
      outputDir: options.outputDir,
      projectName: options.projectName,
      includeExampleData: options.includeExampleData,
      includeEnvConfig: options.includeEnvConfig,
      packageManager: options.packageManager,
      typescript: options.typescript,
      strict: options.strict,
    };
  }

  /**
   * Generate import mappings for round-trip compatibility
   */
  private generateImportMappings(
    workbook: ApicizeWorkbook,
    sourceFilePath: string,
    scaffoldedProject: ScaffoldedProject
  ): ImportMapping[] {
    const mappings: ImportMapping[] = [];

    // Main workbook mapping
    mappings.push({
      originalPath: sourceFilePath,
      exportedPath: join(scaffoldedProject.metadata.outputDir, 'metadata', 'workbook.json'),
      type: 'workbook',
      id: 'root',
      metadata: {
        version: workbook.version,
        requestCount: workbook.requests?.length || 0,
        scenarioCount: workbook.scenarios?.length || 0,
      },
    });

    // Request mappings
    if (workbook.requests) {
      for (const request of workbook.requests) {
        // Check if it's a Request (not a RequestGroup)
        if ('method' in request && 'url' in request) {
          mappings.push({
            originalPath: `${sourceFilePath}#requests[${request.id}]`,
            exportedPath: this.findTestFileForRequest(request.id, scaffoldedProject),
            type: 'request',
            id: request.id,
            metadata: {
              name: request.name,
              method: request.method,
              url: request.url,
            },
          });
        } else {
          // It's a RequestGroup
          mappings.push({
            originalPath: `${sourceFilePath}#requests[${request.id}]`,
            exportedPath: this.findTestFileForRequest(request.id, scaffoldedProject),
            type: 'group',
            id: request.id,
            metadata: {
              name: request.name,
              childrenCount: 'children' in request ? request.children?.length || 0 : 0,
            },
          });
        }
      }
    }

    // Scenario mappings
    if (workbook.scenarios) {
      for (const scenario of workbook.scenarios) {
        mappings.push({
          originalPath: `${sourceFilePath}#scenarios[${scenario.id}]`,
          exportedPath: join(
            scaffoldedProject.metadata.outputDir,
            'config',
            'scenarios',
            `${scenario.name}.json`
          ),
          type: 'scenario',
          id: scenario.id,
          metadata: {
            name: scenario.name,
            variableCount: scenario.variables?.length || 0,
          },
        });
      }
    }

    return mappings;
  }

  /**
   * Find the test file that contains a specific request
   */
  private findTestFileForRequest(requestId: string, scaffoldedProject: ScaffoldedProject): string {
    // Look for the request ID in test file metadata
    const testFiles = scaffoldedProject.files.filter(f => f.type === 'test');

    for (const file of testFiles) {
      if (file.content.includes(requestId)) {
        return file.path;
      }
    }

    // Default to main test file if not found
    return join(scaffoldedProject.metadata.outputDir, 'tests', 'index.spec.ts');
  }

  /**
   * Write all project files to disk
   */
  private async writeProjectFiles(
    scaffoldedProject: ScaffoldedProject,
    outputDir: string
  ): Promise<string[]> {
    const filesCreated: string[] = [];

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Write all files
    for (const file of scaffoldedProject.files) {
      const fullPath = join(outputDir, file.path);

      // Ensure directory exists
      await fs.mkdir(dirname(fullPath), { recursive: true });

      // Write file
      await fs.writeFile(fullPath, file.content, 'utf-8');
      filesCreated.push(fullPath);
    }

    return filesCreated;
  }

  /**
   * Validate the generated project structure
   */
  private async validateGeneratedProject(outputDir: string): Promise<void> {
    const requiredFiles = ['package.json', 'tsconfig.json', '.mocharc.json'];

    for (const file of requiredFiles) {
      const filePath = join(outputDir, file);
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Required file not found: ${file}`);
      }
    }

    // Validate package.json
    const packageJsonPath = join(outputDir, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    if (!packageJson.devDependencies?.mocha) {
      throw new Error('Generated package.json missing required dependency: mocha');
    }

    if (!packageJson.devDependencies?.chai) {
      throw new Error('Generated package.json missing required dependency: chai');
    }

    if (!packageJson.scripts?.test) {
      throw new Error('Generated package.json missing test script');
    }
  }

  /**
   * Report progress to callback if provided
   */
  private reportProgress(
    options: ExportOptions,
    stage: string,
    progress: number,
    message: string
  ): void {
    if (options.progressCallback) {
      options.progressCallback(stage, progress, message);
    }
  }
}
