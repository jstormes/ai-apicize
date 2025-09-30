import { ApicizeWorkbook, Request, RequestGroup, BodyType, HttpMethod } from '../types';
import { TemplateEngine } from '../templates/template-engine';

export interface TestGeneratorOptions {
  outputDir?: string;
  includeMetadata?: boolean;
  splitByGroup?: boolean;
  generateHelpers?: boolean;
  indent?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'test' | 'config' | 'metadata';
}

export interface GenerationResult {
  files: GeneratedFile[];
  metadata: {
    sourceFile: string;
    generatedAt: string;
    totalFiles: number;
    totalTests: number;
  };
}

/**
 * Converts .apicize workbooks to TypeScript test files using the TemplateEngine.
 *
 * This class orchestrates the conversion process, determining which templates to use
 * for different parts of the workbook and organizing the output file structure.
 */
export class TestGenerator {
  private templateEngine: TemplateEngine;

  constructor() {
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate a complete TypeScript test project from an .apicize workbook
   */
  public generateTestProject(
    workbook: ApicizeWorkbook,
    sourceFileName: string = 'workbook.apicize',
    options: TestGeneratorOptions = {}
  ): GenerationResult {
    const opts = this.mergeOptions(options);
    const files: GeneratedFile[] = [];
    let totalTests = 0;

    // Generate main index.spec.ts file
    const mainIndexContent = this.templateEngine.generateMainIndex(workbook, {
      includeMetadata: opts.includeMetadata,
      indent: opts.indent,
    });
    files.push({
      path: 'tests/index.spec.ts',
      content: mainIndexContent,
      type: 'test',
    });

    // Count and generate individual request groups if splitting
    if (opts.splitByGroup && workbook.requests) {
      workbook.requests.forEach((item, index) => {
        if (this.isRequestGroup(item)) {
          const groupFile = this.generateRequestGroupFile(item, workbook, index, opts);
          files.push(groupFile);
          totalTests += this.countTestsInGroup(item);
        } else {
          // Individual request at top level
          const requestFile = this.generateIndividualRequestFile(item, workbook, index, opts);
          files.push(requestFile);
          totalTests += 1;
        }
      });
    } else {
      // Count tests for metadata
      totalTests = this.countTotalTests(workbook);
    }

    // Generate supporting configuration files
    if (opts.generateHelpers) {
      files.push({
        path: 'package.json',
        content: this.templateEngine.generatePackageJson(workbook),
        type: 'config',
      });

      files.push({
        path: 'tsconfig.json',
        content: this.templateEngine.generateTsConfig(),
        type: 'config',
      });

      files.push({
        path: '.mocharc.json',
        content: this.templateEngine.generateMochaConfig(),
        type: 'config',
      });
    }

    // Generate metadata file for import compatibility
    if (opts.includeMetadata) {
      files.push({
        path: 'metadata/workbook.json',
        content: JSON.stringify(workbook, null, 2),
        type: 'metadata',
      });
    }

    return {
      files,
      metadata: {
        sourceFile: sourceFileName,
        generatedAt: new Date().toISOString(),
        totalFiles: files.length,
        totalTests,
      },
    };
  }

  /**
   * Generate TypeScript test content for a single request group
   */
  public generateRequestGroupTests(
    group: RequestGroup,
    workbook: ApicizeWorkbook,
    options: TestGeneratorOptions = {}
  ): string {
    const opts = this.mergeOptions(options);
    return this.templateEngine.generateRequestGroup(group, workbook, {
      includeMetadata: opts.includeMetadata,
      indent: opts.indent,
    });
  }

  /**
   * Generate TypeScript test content for a single request
   */
  public generateIndividualRequestTest(
    request: Request,
    workbook: ApicizeWorkbook,
    options: TestGeneratorOptions = {}
  ): string {
    const opts = this.mergeOptions(options);
    return this.templateEngine.generateIndividualRequest(request, workbook, {
      includeMetadata: opts.includeMetadata,
      indent: opts.indent,
    });
  }

  /**
   * Convert request groups to describe blocks with nested structure
   */
  public convertGroupToDescribeBlock(
    group: RequestGroup,
    _workbook: ApicizeWorkbook,
    depth: number = 0
  ): string {
    const indent = '    '.repeat(depth);
    const innerIndent = '    '.repeat(depth + 1);

    let result = `${indent}describe('${this.escapeString(group.name)}', function() {\n`;

    // Add metadata comment with ALL fields for round-trip accuracy
    // Note: children are handled separately by recursion, not included in metadata
    const groupMetadata: any = {
      id: group.id,
      name: group.name,
      execution: group.execution,
      runs: group.runs,
      multiRunExecution: group.multiRunExecution,
      selectedScenario: group.selectedScenario,
      selectedData: group.selectedData,
    };

    result += `${innerIndent}/* @apicize-group-metadata\n`;
    result += `${innerIndent}${JSON.stringify(groupMetadata, null, 4)
      .split('\n')
      .join(`\n${innerIndent}`)}\n`;
    result += `${innerIndent}@apicize-group-metadata-end */\n\n`;

    // Process children
    if (group.children) {
      group.children.forEach(child => {
        if (this.isRequestGroup(child)) {
          result += this.convertGroupToDescribeBlock(child, _workbook, depth + 1);
        } else {
          result += this.convertRequestToTestCase(child, _workbook, depth + 1);
        }
        result += '\n';
      });
    }

    result += `${indent}});\n`;
    return result;
  }

  /**
   * Convert individual requests to test cases with beforeEach hooks
   */
  public convertRequestToTestCase(
    request: Request,
    _workbook: ApicizeWorkbook,
    depth: number = 0
  ): string {
    const indent = '    '.repeat(depth);
    const innerIndent = '    '.repeat(depth + 1);

    let result = `${indent}describe('${this.escapeString(request.name)}', function() {\n`;

    // Add metadata comment with ALL fields for round-trip accuracy
    const requestMetadata: any = {
      id: request.id,
      name: request.name,
      url: request.url,
      method: request.method,
    };

    // Include optional fields only if they exist
    if (request.test !== undefined) requestMetadata.test = request.test;
    if (request.headers !== undefined) requestMetadata.headers = request.headers;
    if (request.body !== undefined) requestMetadata.body = request.body;
    if (request.queryStringParams !== undefined)
      requestMetadata.queryStringParams = request.queryStringParams;
    if (request.timeout !== undefined) requestMetadata.timeout = request.timeout;
    if (request.numberOfRedirects !== undefined)
      requestMetadata.numberOfRedirects = request.numberOfRedirects;
    if (request.runs !== undefined) requestMetadata.runs = request.runs;
    if (request.multiRunExecution !== undefined)
      requestMetadata.multiRunExecution = request.multiRunExecution;
    if (request.keepAlive !== undefined) requestMetadata.keepAlive = request.keepAlive;
    if (request.acceptInvalidCerts !== undefined)
      requestMetadata.acceptInvalidCerts = request.acceptInvalidCerts;
    if (request.mode !== undefined) requestMetadata.mode = request.mode;
    if (request.referrer !== undefined) requestMetadata.referrer = request.referrer;
    if (request.referrerPolicy !== undefined)
      requestMetadata.referrerPolicy = request.referrerPolicy;
    if (request.duplex !== undefined) requestMetadata.duplex = request.duplex;

    result += `${innerIndent}/* @apicize-request-metadata\n`;
    result += `${innerIndent}${JSON.stringify(requestMetadata, null, 4)
      .split('\n')
      .join(`\n${innerIndent}`)}\n`;
    result += `${innerIndent}@apicize-request-metadata-end */\n\n`;

    // Add timeout if specified
    if (request.timeout) {
      result += `${innerIndent}this.timeout(${request.timeout});\n\n`;
    }

    // Generate beforeEach hook for request execution
    result += this.generateBeforeEachHook(request, _workbook, depth + 1);

    // Embed original test code
    result += this.embedTestCode(request, depth + 1);

    result += `${indent}});\n`;
    return result;
  }

  /**
   * Generate beforeEach hooks for request execution
   */
  private generateBeforeEachHook(
    request: Request,
    _workbook: ApicizeWorkbook,
    depth: number
  ): string {
    const indent = '    '.repeat(depth);
    const innerIndent = '    '.repeat(depth + 1);

    let result = `${indent}beforeEach(async function() {\n`;
    result += `${innerIndent}// Execute the HTTP request\n`;
    result += `${innerIndent}response = await context.execute({\n`;
    result += `${innerIndent}    url: context.substituteVariables('${request.url || ''}'),\n`;
    result += `${innerIndent}    method: '${request.method || HttpMethod.GET}',\n`;

    // Add headers if present
    if (request.headers && request.headers.length > 0) {
      result += `${innerIndent}    headers: [\n`;
      request.headers.forEach(header => {
        result += `${innerIndent}        { name: '${this.escapeString(header.name)}', value: '${this.escapeString(header.value)}' },\n`;
      });
      result += `${innerIndent}    ],\n`;
    }

    // Add query parameters if present
    if (request.queryStringParams && request.queryStringParams.length > 0) {
      result += `${innerIndent}    queryStringParams: [\n`;
      request.queryStringParams.forEach(param => {
        result += `${innerIndent}        { name: '${this.escapeString(param.name)}', value: '${this.escapeString(param.value)}' },\n`;
      });
      result += `${innerIndent}    ],\n`;
    }

    // Add body if present
    if (request.body && request.body.type !== BodyType.None) {
      result += `${innerIndent}    body: {\n`;
      result += `${innerIndent}        type: BodyType.${request.body.type},\n`;
      if (request.body.data !== undefined) {
        if (request.body.type === BodyType.JSON) {
          result += `${innerIndent}        data: ${JSON.stringify(request.body.data)}\n`;
        } else {
          result += `${innerIndent}        data: ${JSON.stringify(request.body.data)}\n`;
        }
      }
      result += `${innerIndent}    },\n`;
    }

    // Add timeout if specified
    if (request.timeout) {
      result += `${innerIndent}    timeout: ${request.timeout}\n`;
    }

    result += `${innerIndent}});\n`;
    result += `${innerIndent}$ = context.$; // Update variables for test code\n`;
    result += `${indent}});\n\n`;

    return result;
  }

  /**
   * Embed original test code with proper context
   */
  private embedTestCode(request: Request, depth: number): string {
    const indent = '    '.repeat(depth);
    const innerIndent = '    '.repeat(depth + 1);

    let result = '';

    if (request.test && request.test.trim()) {
      // Use the original test code directly
      const testCode = request.test.trim();

      // Check if the test code already contains describe/it blocks
      if (testCode.includes('describe(') || testCode.includes('it(')) {
        // Test code contains its own structure, use it as-is but indent properly
        const indentedCode = this.indentCode(testCode, depth);
        result += indentedCode;
      } else {
        // Wrap simple test code in an it block
        result += `${indent}it('should pass', function() {\n`;
        const indentedCode = this.indentCode(testCode, depth + 1);
        result += indentedCode;
        result += `${indent}});\n`;
      }
    } else {
      // No test code provided, generate a basic test
      result += `${indent}it('should pass', function() {\n`;
      result += `${innerIndent}expect(response.status).to.be.oneOf([200, 201, 204]);\n`;
      result += `${indent}});\n`;
    }

    return result;
  }

  // Helper methods

  private generateRequestGroupFile(
    group: RequestGroup,
    workbook: ApicizeWorkbook,
    index: number,
    options: TestGeneratorOptions
  ): GeneratedFile {
    const sanitizedName = this.sanitizeFileName(group.name);
    const content = this.templateEngine.generateRequestGroup(group, workbook, {
      includeMetadata: options.includeMetadata ?? true,
      indent: options.indent || '    ',
    });

    return {
      path: `tests/suites/${index}-${sanitizedName}.spec.ts`,
      content,
      type: 'test',
    };
  }

  private generateIndividualRequestFile(
    request: Request,
    workbook: ApicizeWorkbook,
    index: number,
    options: TestGeneratorOptions
  ): GeneratedFile {
    const sanitizedName = this.sanitizeFileName(request.name);
    const content = this.templateEngine.generateIndividualRequest(request, workbook, {
      includeMetadata: options.includeMetadata ?? true,
      indent: options.indent || '    ',
    });

    return {
      path: `tests/suites/${index}-${sanitizedName}.spec.ts`,
      content,
      type: 'test',
    };
  }

  private isRequestGroup(item: Request | RequestGroup): item is RequestGroup {
    return 'children' in item;
  }

  private countTestsInGroup(group: RequestGroup): number {
    let count = 0;
    if (group.children) {
      group.children.forEach(child => {
        if (this.isRequestGroup(child)) {
          count += this.countTestsInGroup(child);
        } else {
          count += 1;
        }
      });
    }
    return count;
  }

  private countTotalTests(workbook: ApicizeWorkbook): number {
    let count = 0;
    if (workbook.requests) {
      workbook.requests.forEach(item => {
        if (this.isRequestGroup(item)) {
          count += this.countTestsInGroup(item);
        } else {
          count += 1;
        }
      });
    }
    return count;
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  private indentCode(code: string, depth: number): string {
    const indent = '    '.repeat(depth);
    return (
      code
        .split('\n')
        .map(line => {
          return line.trim() ? `${indent}${line}` : line;
        })
        .join('\n') + '\n'
    );
  }

  private mergeOptions(options: TestGeneratorOptions): Required<TestGeneratorOptions> {
    return {
      outputDir: options.outputDir || './tests',
      includeMetadata: options.includeMetadata ?? true,
      splitByGroup: options.splitByGroup ?? true,
      generateHelpers: options.generateHelpers ?? true,
      indent: options.indent || '    ',
    };
  }
}
