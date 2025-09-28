import * as fs from 'fs/promises';
import * as path from 'path';
import { Request, RequestGroup, HttpMethod, BodyType, ExecutionMode, NameValuePair } from '../types';
import { ScannedFile, ProjectMap } from './file-scanner';

export interface ReconstructedRequest extends Request {
  /** File path where this request was found */
  sourceFile: string;
  /** Line number where metadata starts */
  metadataLine?: number;
}

export interface ReconstructedRequestGroup extends RequestGroup {
  /** File path where this group was found */
  sourceFile: string;
  /** Line number where metadata starts */
  metadataLine?: number;
  children: Array<ReconstructedRequest | ReconstructedRequestGroup>;
}

export interface ReconstructionResult {
  /** Root path of the project */
  rootPath: string;
  /** Successfully reconstructed requests and groups */
  requests: Array<ReconstructedRequest | ReconstructedRequestGroup>;
  /** Files that contained metadata */
  processedFiles: string[];
  /** Errors encountered during reconstruction */
  errors: Array<{
    file: string;
    line?: number;
    error: string;
  }>;
  /** Warnings about potential data loss */
  warnings: Array<{
    file: string;
    line?: number;
    warning: string;
  }>;
}

export interface RequestReconstructorOptions {
  /** Whether to validate reconstructed requests (default: true) */
  validateRequests?: boolean;
  /** Whether to preserve unknown metadata fields (default: true) */
  preserveUnknownFields?: boolean;
  /** Maximum file size to process in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Whether to skip files with parsing errors (default: false) */
  skipErrorFiles?: boolean;
}

interface DescribeBlock {
  name: string;
  startLine: number;
  endLine: number;
  indentLevel: number;
  children: DescribeBlock[];
  metadataLine?: number | undefined;
}

export class RequestReconstructorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly filePath?: string,
    public readonly lineNumber?: number
  ) {
    super(message);
    this.name = 'RequestReconstructorError';
  }
}

/**
 * Reconstructs .apicize request structures from TypeScript test files.
 *
 * The RequestReconstructor analyzes exported TypeScript test files,
 * extracts embedded metadata, and rebuilds the original .apicize
 * request and request group structures.
 */
export class RequestReconstructor {
  private readonly options: Required<RequestReconstructorOptions>;

  constructor(options: RequestReconstructorOptions = {}) {
    this.options = {
      validateRequests: options.validateRequests ?? true,
      preserveUnknownFields: options.preserveUnknownFields ?? true,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      skipErrorFiles: options.skipErrorFiles ?? false,
    };
  }

  /**
   * Reconstructs requests from a scanned TypeScript project.
   *
   * @param projectMap - Project map from FileScanner
   * @returns Promise resolving to reconstruction results
   * @throws RequestReconstructorError if critical errors occur
   */
  async reconstructFromProject(projectMap: ProjectMap): Promise<ReconstructionResult> {
    const result: ReconstructionResult = {
      rootPath: projectMap.rootPath,
      requests: [],
      processedFiles: [],
      errors: [],
      warnings: [],
    };

    // Process all test files
    for (const file of projectMap.allFiles) {
      try {
        await this.processFile(file, result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          file: file.filePath,
          error: errorMessage,
        });

        if (!this.options.skipErrorFiles) {
          throw new RequestReconstructorError(
            `Failed to process file: ${file.filePath}: ${errorMessage}`,
            'FILE_PROCESSING_ERROR',
            file.filePath
          );
        }
      }
    }

    // Validate the reconstructed structure
    if (this.options.validateRequests) {
      this.validateReconstructedRequests(result);
    }

    return result;
  }

  /**
   * Processes a single TypeScript test file.
   */
  private async processFile(file: ScannedFile, result: ReconstructionResult): Promise<void> {
    // Check file size
    if (file.size > this.options.maxFileSize) {
      result.warnings.push({
        file: file.filePath,
        warning: `File size (${file.size} bytes) exceeds maximum (${this.options.maxFileSize} bytes), skipping`,
      });
      return;
    }

    try {
      const content = await fs.readFile(file.filePath, 'utf-8');
      const extractedData = this.extractMetadataFromContent(content, file.filePath);

      if (extractedData.length > 0) {
        result.processedFiles.push(file.filePath);

        // Reconstruct hierarchy from describe nesting
        const hierarchicalData = this.reconstructHierarchy(content, extractedData, file.filePath);
        result.requests.push(...hierarchicalData);
      }
    } catch (error) {
      throw new RequestReconstructorError(
        `Error reading file: ${error}`,
        'FILE_READ_ERROR',
        file.filePath
      );
    }
  }

  /**
   * Reconstructs the hierarchical structure from describe blocks and metadata.
   */
  private reconstructHierarchy(
    content: string,
    extractedData: Array<ReconstructedRequest | ReconstructedRequestGroup>,
    filePath: string
  ): Array<ReconstructedRequest | ReconstructedRequestGroup> {
    const lines = content.split('\n');
    const describeBlocks = this.parseDescribeBlocks(lines);

    // Create a map of metadata by line number for quick lookup
    const metadataByLine = new Map<number, ReconstructedRequest | ReconstructedRequestGroup>();
    for (const item of extractedData) {
      if (item.metadataLine) {
        metadataByLine.set(item.metadataLine, item);
      }
    }

    // Build hierarchy by matching describe blocks with metadata
    return this.buildHierarchyFromDescribeBlocks(describeBlocks, metadataByLine, filePath);
  }

  /**
   * Parses describe blocks from TypeScript file lines.
   */
  private parseDescribeBlocks(lines: string[]): DescribeBlock[] {
    const blocks: DescribeBlock[] = [];
    const stack: DescribeBlock[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Look for describe statements - handle both function() and arrow function syntax
      const describeMatch = line.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:function\s*\(\)|\(\))\s*(?:=>)?\s*\{?/);
      if (describeMatch) {
          const metadataLine = this.findMetadataLineBeforeDescribe(lines, i);
        const block: DescribeBlock = {
          name: describeMatch[1],
          startLine: lineNumber,
          endLine: -1, // Will be set when we find the closing brace
          indentLevel: this.getIndentLevel(lines[i]),
          children: [],
          metadataLine: metadataLine,
        };

        // Determine parent relationship based on indentation
        while (stack.length > 0 && stack[stack.length - 1].indentLevel >= block.indentLevel) {
          const completedBlock = stack.pop()!;
          completedBlock.endLine = lineNumber - 1;
        }

        if (stack.length > 0) {
          stack[stack.length - 1].children.push(block);
        } else {
          blocks.push(block);
        }

        stack.push(block);
      }
    }

    // Close any remaining blocks
    while (stack.length > 0) {
      const completedBlock = stack.pop()!;
      completedBlock.endLine = lines.length;
    }

    return blocks;
  }

  /**
   * Finds metadata comment block before a describe statement.
   */
  private findMetadataLineBeforeDescribe(lines: string[], describeLineIndex: number): number | undefined {
    // Look backwards for metadata blocks
    for (let i = describeLineIndex - 1; i >= Math.max(0, describeLineIndex - 10); i--) {
      const line = lines[i];
      if (line.includes('@apicize-request-metadata') || line.includes('@apicize-group-metadata')) {
        return i + 1; // Line numbers are 1-based
      }
      // Stop looking if we hit another describe or function
      if (line.includes('describe(') || line.includes('it(') || line.includes('function ')) {
        break;
      }
    }
    return undefined;
  }

  /**
   * Gets indentation level of a line.
   */
  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Builds hierarchy from parsed describe blocks and metadata.
   */
  private buildHierarchyFromDescribeBlocks(
    describeBlocks: DescribeBlock[],
    metadataByLine: Map<number, ReconstructedRequest | ReconstructedRequestGroup>,
    filePath: string
  ): Array<ReconstructedRequest | ReconstructedRequestGroup> {
    const result: Array<ReconstructedRequest | ReconstructedRequestGroup> = [];

    for (const block of describeBlocks) {
      const item = this.buildItemFromDescribeBlock(block, metadataByLine, filePath);
      if (item) {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Builds a request or group item from a describe block.
   */
  private buildItemFromDescribeBlock(
    block: DescribeBlock,
    metadataByLine: Map<number, ReconstructedRequest | ReconstructedRequestGroup>,
    filePath: string
  ): ReconstructedRequest | ReconstructedRequestGroup | null {
    // Look for metadata associated with this block
    let metadata: ReconstructedRequest | ReconstructedRequestGroup | undefined;

    if (block.metadataLine) {
      metadata = metadataByLine.get(block.metadataLine);
    }

    // If no direct metadata, check if this is a group with children
    if (!metadata && block.children.length > 0) {
      // This is likely a group without explicit metadata
      const group: ReconstructedRequestGroup = {
        id: this.generateId(),
        name: block.name,
        children: [],
        sourceFile: filePath,
        metadataLine: block.startLine,
      };

      // Process children
      for (const childBlock of block.children) {
        const child = this.buildItemFromDescribeBlock(childBlock, metadataByLine, filePath);
        if (child) {
          group.children.push(child);
        }
      }

      return group;
    }

    if (metadata) {
      // Update the name to match the describe block if different
      metadata.name = block.name;

      // If this is a group, process children
      if ('children' in metadata) {
        const group = metadata as ReconstructedRequestGroup;
        group.children = [];

        for (const childBlock of block.children) {
          const child = this.buildItemFromDescribeBlock(childBlock, metadataByLine, filePath);
          if (child) {
            group.children.push(child);
          }
        }
      }

      return metadata;
    }

    // No metadata found and no children - might be a test block without metadata
    return null;
  }

  /**
   * Generates a unique ID for items without metadata.
   */
  private generateId(): string {
    return 'generated-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Extracts metadata from TypeScript file content.
   */
  private extractMetadataFromContent(
    content: string,
    filePath: string
  ): Array<ReconstructedRequest | ReconstructedRequestGroup> {
    const results: Array<ReconstructedRequest | ReconstructedRequestGroup> = [];
    const lines = content.split('\n');

    // Look for metadata blocks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for different metadata types - be more specific with matching
      if (line.includes('@apicize-request-metadata') && !line.includes('@apicize-request-metadata-end')) {
        const metadata = this.extractMetadataBlock(lines, i, '@apicize-request-metadata-end');
        if (metadata) {
          try {
            const request = this.buildRequestFromMetadata(metadata.data, filePath, metadata.startLine);
            results.push(request);
          } catch (error) {
            throw new RequestReconstructorError(
              `Failed to build request from metadata: ${error}`,
              'METADATA_PARSE_ERROR',
              filePath,
              metadata.startLine
            );
          }
        }
      } else if (line.includes('@apicize-group-metadata') && !line.includes('@apicize-group-metadata-end')) {
        const metadata = this.extractMetadataBlock(lines, i, '@apicize-group-metadata-end');
        if (metadata) {
          try {
            const group = this.buildGroupFromMetadata(metadata.data, filePath, metadata.startLine);
            results.push(group);
          } catch (error) {
            throw new RequestReconstructorError(
              `Failed to build group from metadata: ${error}`,
              'METADATA_PARSE_ERROR',
              filePath,
              metadata.startLine
            );
          }
        }
      }
    }

    return results;
  }

  /**
   * Extracts a metadata block from the file lines.
   */
  private extractMetadataBlock(
    lines: string[],
    startIndex: number,
    endMarker: string
  ): { data: any; startLine: number } | null {
    const startLine = startIndex + 1; // Line numbers are 1-based
    let jsonContent = '';
    let foundEnd = false;

    // Find the end of the metadata block and collect JSON content
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes(endMarker)) {
        foundEnd = true;
        break;
      }

      // Remove comment markers and add to JSON content
      const cleanLine = line.replace(/^\s*\*?\s?/, '').trim();
      if (cleanLine && !cleanLine.startsWith('/*') && !cleanLine.startsWith('*/')) {
        jsonContent += cleanLine + '\n';
      }
    }

    if (!foundEnd) {
      throw new RequestReconstructorError(
        `Incomplete metadata block starting at line ${startLine}`,
        'INCOMPLETE_METADATA',
        undefined,
        startLine
      );
    }

    try {
      const data = JSON.parse(jsonContent.trim());
      return { data, startLine };
    } catch (error) {
      throw new RequestReconstructorError(
        `Invalid JSON in metadata block at line ${startLine}: ${error}`,
        'INVALID_JSON',
        undefined,
        startLine
      );
    }
  }

  /**
   * Builds a Request object from extracted metadata.
   */
  private buildRequestFromMetadata(
    metadata: any,
    sourceFile: string,
    metadataLine: number
  ): ReconstructedRequest {
    // Validate required fields
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new Error('Missing or invalid "id" field');
    }
    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new Error('Missing or invalid "name" field');
    }
    if (!metadata.url || typeof metadata.url !== 'string') {
      throw new Error('Missing or invalid "url" field');
    }
    if (!metadata.method || !Object.values(HttpMethod).includes(metadata.method)) {
      throw new Error('Missing or invalid "method" field');
    }

    const request: ReconstructedRequest = {
      id: metadata.id,
      name: metadata.name,
      url: metadata.url,
      method: metadata.method as HttpMethod,
      sourceFile,
      metadataLine,
    };

    // Optional fields
    if (metadata.test && typeof metadata.test === 'string') {
      request.test = metadata.test;
    }

    if (metadata.headers && Array.isArray(metadata.headers)) {
      request.headers = this.validateNameValuePairs(metadata.headers, 'headers');
    }

    if (metadata.body) {
      request.body = this.buildRequestBody(metadata.body);
    }

    if (metadata.queryStringParams && Array.isArray(metadata.queryStringParams)) {
      request.queryStringParams = this.validateNameValuePairs(metadata.queryStringParams, 'queryStringParams');
    }

    if (metadata.timeout && typeof metadata.timeout === 'number') {
      request.timeout = metadata.timeout;
    }

    if (metadata.numberOfRedirects && typeof metadata.numberOfRedirects === 'number') {
      request.numberOfRedirects = metadata.numberOfRedirects;
    }

    if (metadata.runs && typeof metadata.runs === 'number') {
      request.runs = metadata.runs;
    }

    if (metadata.multiRunExecution && Object.values(ExecutionMode).includes(metadata.multiRunExecution)) {
      request.multiRunExecution = metadata.multiRunExecution as ExecutionMode;
    }

    if (typeof metadata.keepAlive === 'boolean') {
      request.keepAlive = metadata.keepAlive;
    }

    if (typeof metadata.acceptInvalidCerts === 'boolean') {
      request.acceptInvalidCerts = metadata.acceptInvalidCerts;
    }

    if (metadata.mode && typeof metadata.mode === 'string') {
      request.mode = metadata.mode as any; // RequestMode type
    }

    if (metadata.referrer && typeof metadata.referrer === 'string') {
      request.referrer = metadata.referrer;
    }

    if (metadata.referrerPolicy && typeof metadata.referrerPolicy === 'string') {
      request.referrerPolicy = metadata.referrerPolicy;
    }

    if (metadata.duplex && typeof metadata.duplex === 'string') {
      request.duplex = metadata.duplex;
    }

    // Preserve unknown fields if requested
    if (this.options.preserveUnknownFields) {
      const knownFields = new Set([
        'id', 'name', 'url', 'method', 'test', 'headers', 'body',
        'queryStringParams', 'timeout', 'numberOfRedirects', 'runs',
        'multiRunExecution', 'keepAlive', 'acceptInvalidCerts', 'mode',
        'referrer', 'referrerPolicy', 'duplex'
      ]);

      for (const [key, value] of Object.entries(metadata)) {
        if (!knownFields.has(key)) {
          (request as any)[key] = value;
        }
      }
    }

    return request;
  }

  /**
   * Builds a RequestGroup object from extracted metadata.
   */
  private buildGroupFromMetadata(
    metadata: any,
    sourceFile: string,
    metadataLine: number
  ): ReconstructedRequestGroup {
    // Validate required fields
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new Error('Missing or invalid "id" field');
    }
    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new Error('Missing or invalid "name" field');
    }

    const group: ReconstructedRequestGroup = {
      id: metadata.id,
      name: metadata.name,
      children: [], // Will be populated when building hierarchy
      sourceFile,
      metadataLine,
    };

    // Optional fields
    if (metadata.execution && Object.values(ExecutionMode).includes(metadata.execution)) {
      group.execution = metadata.execution as ExecutionMode;
    }

    if (metadata.runs && typeof metadata.runs === 'number') {
      group.runs = metadata.runs;
    }

    if (metadata.multiRunExecution && Object.values(ExecutionMode).includes(metadata.multiRunExecution)) {
      group.multiRunExecution = metadata.multiRunExecution as ExecutionMode;
    }

    if (metadata.selectedScenario && typeof metadata.selectedScenario === 'object') {
      group.selectedScenario = metadata.selectedScenario;
    }

    if (metadata.selectedData && typeof metadata.selectedData === 'object') {
      group.selectedData = metadata.selectedData;
    }

    // Preserve unknown fields if requested
    if (this.options.preserveUnknownFields) {
      const knownFields = new Set([
        'id', 'name', 'children', 'execution', 'runs', 'multiRunExecution',
        'selectedScenario', 'selectedData'
      ]);

      for (const [key, value] of Object.entries(metadata)) {
        if (!knownFields.has(key)) {
          (group as any)[key] = value;
        }
      }
    }

    return group;
  }

  /**
   * Builds request body from metadata.
   */
  private buildRequestBody(bodyMetadata: any): any {
    if (!bodyMetadata.type || !Object.values(BodyType).includes(bodyMetadata.type)) {
      throw new Error('Invalid or missing body type');
    }

    const body: any = {
      type: bodyMetadata.type as BodyType,
    };

    // Handle different body types
    switch (body.type) {
      case BodyType.None:
        // No data for None type
        break;
      case BodyType.Text:
      case BodyType.XML:
        if (bodyMetadata.data && typeof bodyMetadata.data === 'string') {
          body.data = bodyMetadata.data;
        }
        break;
      case BodyType.JSON:
        if (bodyMetadata.data && typeof bodyMetadata.data === 'object') {
          body.data = bodyMetadata.data;
        }
        break;
      case BodyType.Form:
        if (bodyMetadata.data && Array.isArray(bodyMetadata.data)) {
          body.data = this.validateNameValuePairs(bodyMetadata.data, 'form data');
        }
        break;
      case BodyType.Raw:
        if (bodyMetadata.data) {
          // Handle Uint8Array data - could be serialized as array or base64
          if (Array.isArray(bodyMetadata.data)) {
            body.data = new Uint8Array(bodyMetadata.data);
          } else if (typeof bodyMetadata.data === 'string') {
            // Assume base64 encoded
            body.data = new Uint8Array(Buffer.from(bodyMetadata.data, 'base64'));
          }
        }
        break;
    }

    if (bodyMetadata.formatted && typeof bodyMetadata.formatted === 'string') {
      body.formatted = bodyMetadata.formatted;
    }

    return body;
  }

  /**
   * Validates name-value pair arrays.
   */
  private validateNameValuePairs(pairs: any[], fieldName: string): NameValuePair[] {
    if (!Array.isArray(pairs)) {
      throw new Error(`${fieldName} must be an array`);
    }

    return pairs.map((pair, index) => {
      if (!pair || typeof pair !== 'object') {
        throw new Error(`${fieldName}[${index}] must be an object`);
      }
      if (!pair.name || typeof pair.name !== 'string') {
        throw new Error(`${fieldName}[${index}].name must be a string`);
      }
      if (!pair.value || typeof pair.value !== 'string') {
        throw new Error(`${fieldName}[${index}].value must be a string`);
      }

      const result: NameValuePair = {
        name: pair.name,
        value: pair.value,
      };

      if (typeof pair.disabled === 'boolean') {
        result.disabled = pair.disabled;
      }

      return result;
    });
  }

  /**
   * Validates reconstructed requests for completeness and consistency.
   */
  private validateReconstructedRequests(result: ReconstructionResult): void {
    for (const item of result.requests) {
      this.validateItem(item, result);
    }
  }

  /**
   * Validates a single request or group item.
   */
  private validateItem(
    item: ReconstructedRequest | ReconstructedRequestGroup,
    result: ReconstructionResult
  ): void {
    // Basic validation
    if (!item.id || !item.name) {
      const warning = {
        file: item.sourceFile,
        warning: 'Item missing required id or name field',
      } as any;
      if (item.metadataLine !== undefined) {
        warning.line = item.metadataLine;
      }
      result.warnings.push(warning);
    }

    // Request-specific validation
    if ('url' in item) {
      const request = item as ReconstructedRequest;
      if (!request.url || !request.method) {
        const warning = {
          file: item.sourceFile,
          warning: 'Request missing required url or method field',
        } as any;
        if (item.metadataLine !== undefined) {
          warning.line = item.metadataLine;
        }
        result.warnings.push(warning);
      }
    }

    // Group-specific validation
    if ('children' in item) {
      const group = item as ReconstructedRequestGroup;
      for (const child of group.children) {
        this.validateItem(child, result);
      }
    }
  }
}

// Convenience functions for direct usage
export async function reconstructFromProject(
  projectMap: ProjectMap,
  options?: RequestReconstructorOptions
): Promise<ReconstructionResult> {
  const reconstructor = new RequestReconstructor(options);
  return reconstructor.reconstructFromProject(projectMap);
}

export async function reconstructFromFiles(
  filePaths: string[],
  options?: RequestReconstructorOptions
): Promise<ReconstructionResult> {
  const reconstructor = new RequestReconstructor(options);

  // Create a minimal ProjectMap for the given files
  const projectMap: ProjectMap = {
    rootPath: path.dirname(filePaths[0]) || process.cwd(),
    mainFiles: [],
    suiteFiles: [],
    allFiles: [],
    dependencies: new Map(),
  };

  // Convert file paths to ScannedFile objects
  for (const filePath of filePaths) {
    try {
      const stats = await fs.stat(filePath);
      const absolutePath = path.resolve(filePath);
      const relativePath = path.relative(projectMap.rootPath, absolutePath);

      projectMap.allFiles.push({
        filePath: absolutePath,
        relativePath,
        baseName: path.basename(filePath, path.extname(filePath)),
        directory: path.dirname(absolutePath),
        isMainFile: path.basename(filePath).includes('index'),
        isSuiteFile: relativePath.includes('suite'),
        size: stats.size,
        lastModified: stats.mtime,
      });
    } catch (error) {
      // Skip files that can't be accessed
    }
  }

  return reconstructor.reconstructFromProject(projectMap);
}