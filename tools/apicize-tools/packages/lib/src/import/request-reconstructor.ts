import * as fs from 'fs/promises';
import {
  Request,
  RequestGroup,
  HttpMethod,
  BodyType,
  ExecutionMode,
  NameValuePair,
} from '../types';
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
  /** Whether to skip files with size limits (default: true) */
  skipSizeChecks?: boolean;
}

/**
 * Custom error class for request reconstruction failures.
 */
export class RequestReconstructorError extends Error {
  constructor(
    message: string,
    public code: string,
    public file?: string,
    public line?: number
  ) {
    super(message);
    this.name = 'RequestReconstructorError';
  }
}

/**
 * Reconstructs .apicize Request and RequestGroup structures from TypeScript test files.
 *
 * This class handles:
 * - Parsing TypeScript test files for embedded metadata
 * - Extracting request/group data from @apicize-metadata comments
 * - Rebuilding the hierarchical structure based on describe blocks
 * - Validating and sanitizing reconstructed data
 */
export class RequestReconstructor {
  private options: Required<RequestReconstructorOptions>;

  constructor(options: RequestReconstructorOptions = {}) {
    this.options = {
      validateRequests: options.validateRequests ?? true,
      preserveUnknownFields: options.preserveUnknownFields ?? true,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      skipErrorFiles: options.skipErrorFiles ?? false,
      skipSizeChecks: options.skipSizeChecks ?? true,
    };
  }

  /**
   * Reconstructs requests and groups from a project map.
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
    const allFiles = [...projectMap.mainFiles, ...projectMap.suiteFiles, ...projectMap.allFiles];
    const uniqueFiles = Array.from(new Set(allFiles.map(f => f.filePath))).map(
      filePath => allFiles.find(f => f.filePath === filePath)!
    );

    for (const file of uniqueFiles) {
      try {
        await this.processFile(file, result);
      } catch (error) {
        if (this.options.skipErrorFiles) {
          result.errors.push({
            file: file.filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        } else {
          throw error;
        }
      }
    }

    // Rebuild complete hierarchy
    result.requests = this.organizeHierarchy(result.requests);

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

        // Don't reconstruct hierarchy here - just return the raw extracted data
        // The hierarchy reconstruction was causing issues with matching
        result.requests.push(...extractedData);
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
   * Organizes flat list of requests into hierarchical structure.
   *
   * For round-trip accuracy, we rely on the metadata/workbook.json file
   * which contains the original structure. The TypeScript files with metadata
   * are used to verify/update the structure but the original hierarchy should
   * be preserved from the metadata file.
   *
   * Since the ImportPipeline loads original metadata and merges it with
   * reconstructed requests, this method just returns items as-is. The actual
   * hierarchy is preserved in the originalMetadata that gets restored in
   * rebuildWorkbook().
   */
  private organizeHierarchy(
    items: Array<ReconstructedRequest | ReconstructedRequestGroup>
  ): Array<ReconstructedRequest | ReconstructedRequestGroup> {
    // Return items as-is - the hierarchy is rebuilt from original metadata
    // in the ImportPipeline.rebuildWorkbook() method
    return items;
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
      if (
        line.includes('@apicize-request-metadata') &&
        !line.includes('@apicize-request-metadata-end')
      ) {
        const metadata = this.extractMetadataBlock(lines, i, '@apicize-request-metadata-end');
        if (metadata) {
          try {
            const request = this.buildRequestFromMetadata(
              metadata.data,
              filePath,
              metadata.startLine
            );
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
      } else if (
        line.includes('@apicize-group-metadata') &&
        !line.includes('@apicize-group-metadata-end')
      ) {
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
        lines[startIndex],
        startLine
      );
    }

    try {
      const data = JSON.parse(jsonContent);
      return { data, startLine };
    } catch (error) {
      throw new RequestReconstructorError(
        `Invalid JSON in metadata block at line ${startLine}: ${error}`,
        'INVALID_JSON',
        lines[startIndex],
        startLine
      );
    }
  }

  /**
   * Builds a ReconstructedRequest from metadata.
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
      const body = this.buildRequestBody(metadata.body);
      if (body !== undefined) {
        request.body = body;
      }
    }

    if (metadata.queryStringParams && Array.isArray(metadata.queryStringParams)) {
      request.queryStringParams = this.validateNameValuePairs(
        metadata.queryStringParams,
        'queryStringParams'
      );
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

    if (
      metadata.multiRunExecution &&
      Object.values(ExecutionMode).includes(metadata.multiRunExecution)
    ) {
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

    return request;
  }

  /**
   * Builds a ReconstructedRequestGroup from metadata.
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
      children: [],
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

    if (
      metadata.multiRunExecution &&
      Object.values(ExecutionMode).includes(metadata.multiRunExecution)
    ) {
      group.multiRunExecution = metadata.multiRunExecution as ExecutionMode;
    }

    if (metadata.selectedScenario && typeof metadata.selectedScenario === 'object') {
      group.selectedScenario = metadata.selectedScenario;
    }

    if (metadata.selectedData && typeof metadata.selectedData === 'object') {
      group.selectedData = metadata.selectedData;
    }

    return group;
  }

  /**
   * Builds a request body from metadata.
   */
  private buildRequestBody(bodyData: any): Request['body'] {
    if (!bodyData || typeof bodyData !== 'object') {
      return undefined;
    }

    const bodyType = bodyData.type;
    if (!bodyType || !Object.values(BodyType).includes(bodyType)) {
      throw new Error(`Invalid body type: ${bodyType}`);
    }

    switch (bodyType) {
      case BodyType.None:
        return { type: BodyType.None };

      case BodyType.Text:
      case BodyType.XML:
        if (typeof bodyData.data !== 'string') {
          throw new Error(`Body data for ${bodyType} must be a string`);
        }
        return {
          type: bodyType,
          data: bodyData.data,
          formatted: bodyData.formatted,
        };

      case BodyType.JSON:
        if (typeof bodyData.data !== 'object') {
          throw new Error('Body data for JSON must be an object');
        }
        return {
          type: BodyType.JSON,
          data: bodyData.data,
          formatted: bodyData.formatted,
        };

      case BodyType.Form:
        if (!Array.isArray(bodyData.data)) {
          throw new Error('Body data for Form must be an array of name-value pairs');
        }
        return {
          type: BodyType.Form,
          data: this.validateNameValuePairs(bodyData.data, 'form data'),
          formatted: bodyData.formatted,
        };

      case BodyType.Raw: {
        // For reconstruction, Raw data might come as base64 or array
        let rawData: Uint8Array;
        if (typeof bodyData.data === 'string') {
          // Assume base64 encoded
          rawData = Uint8Array.from(Buffer.from(bodyData.data, 'base64'));
        } else if (Array.isArray(bodyData.data)) {
          rawData = new Uint8Array(bodyData.data);
        } else if (bodyData.data instanceof Uint8Array) {
          rawData = bodyData.data;
        } else {
          throw new Error('Body data for Raw must be Uint8Array, array, or base64 string');
        }
        return {
          type: BodyType.Raw,
          data: rawData,
          formatted: bodyData.formatted,
        };
      }

      default:
        throw new Error(`Unsupported body type: ${bodyType}`);
    }
  }

  /**
   * Validates and normalizes name-value pairs.
   */
  private validateNameValuePairs(pairs: any[], fieldName: string): NameValuePair[] {
    if (!Array.isArray(pairs)) {
      throw new Error(`${fieldName} must be an array`);
    }

    return pairs.map((pair, index) => {
      if (!pair || typeof pair !== 'object') {
        throw new Error(`${fieldName}[${index}] must be an object`);
      }
      if (typeof pair.name !== 'string') {
        throw new Error(`${fieldName}[${index}].name must be a string`);
      }
      if (typeof pair.value !== 'string') {
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
   * Validates the reconstructed requests and groups.
   */
  private validateReconstructedRequests(result: ReconstructionResult): void {
    const validateItem = (
      item: ReconstructedRequest | ReconstructedRequestGroup,
      path: string
    ): void => {
      if (!item.id) {
        const warning = {
          file: item.sourceFile,
          warning: `Missing ID at ${path}`,
        } as { file: string; line?: number; warning: string };
        if (item.metadataLine !== undefined) {
          warning.line = item.metadataLine;
        }
        result.warnings.push(warning);
      }

      if (!item.name) {
        const warning = {
          file: item.sourceFile,
          warning: `Missing name at ${path}`,
        } as { file: string; line?: number; warning: string };
        if (item.metadataLine !== undefined) {
          warning.line = item.metadataLine;
        }
        result.warnings.push(warning);
      }

      if ('url' in item) {
        // It's a request
        if (!item.url) {
          const error = {
            file: item.sourceFile,
            error: `Missing URL at ${path}`,
          } as { file: string; line?: number; error: string };
          if (item.metadataLine !== undefined) {
            error.line = item.metadataLine;
          }
          result.errors.push(error);
        }
        if (!item.method) {
          const error = {
            file: item.sourceFile,
            error: `Missing method at ${path}`,
          } as { file: string; line?: number; error: string };
          if (item.metadataLine !== undefined) {
            error.line = item.metadataLine;
          }
          result.errors.push(error);
        }
      } else if ('children' in item) {
        // It's a group
        item.children.forEach((child, index) => {
          validateItem(child, `${path}.children[${index}]`);
        });
      }
    };

    result.requests.forEach((item, index) => {
      validateItem(item, `requests[${index}]`);
    });
  }
}

// ============= Convenience Functions =============

/**
 * Reconstruct requests from a TypeScript project map.
 */
export async function reconstructFromProject(
  projectMap: ProjectMap,
  options?: RequestReconstructorOptions
): Promise<ReconstructionResult> {
  const reconstructor = new RequestReconstructor(options);
  return reconstructor.reconstructFromProject(projectMap);
}

/**
 * Reconstruct requests from specific TypeScript files.
 */
export async function reconstructFromFiles(
  files: ScannedFile[],
  rootPath: string,
  options?: RequestReconstructorOptions
): Promise<ReconstructionResult> {
  const projectMap: ProjectMap = {
    rootPath,
    mainFiles: [],
    suiteFiles: [],
    allFiles: files,
    dependencies: new Map(),
  };

  const reconstructor = new RequestReconstructor(options);
  return reconstructor.reconstructFromProject(projectMap);
}
