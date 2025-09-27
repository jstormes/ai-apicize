import * as fs from 'fs';

/**
 * Represents extracted metadata from a TypeScript test file
 */
export interface ExtractedMetadata {
  fileMetadata?: Record<string, any> | undefined;
  requestMetadata: ExtractedRequestMetadata[];
  groupMetadata: ExtractedGroupMetadata[];
  errors: string[];
  warnings: string[];
}

/**
 * Represents request-level metadata
 */
export interface ExtractedRequestMetadata {
  id: string;
  metadata: Record<string, any>;
  testCode?: string | undefined;
  lineNumber: number;
  blockType: 'request';
}

/**
 * Represents group-level metadata
 */
export interface ExtractedGroupMetadata {
  id: string;
  metadata: Record<string, any>;
  lineNumber: number;
  blockType: 'group';
  children?: Array<ExtractedRequestMetadata | ExtractedGroupMetadata> | undefined;
}

/**
 * Configuration options for metadata extraction
 */
export interface MetadataExtractionOptions {
  strictMode?: boolean | undefined;
  includeWarnings?: boolean | undefined;
  validateJson?: boolean | undefined;
}

/**
 * Error class for metadata extraction issues
 */
export class MetadataExtractionError extends Error {
  constructor(
    message: string,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'MetadataExtractionError';
  }
}

/**
 * MetadataExtractor class for parsing metadata comments from TypeScript test files
 */
export class MetadataExtractor {
  private static readonly FILE_METADATA_START = /\/\*\s*@apicize-file-metadata\s*/;
  private static readonly FILE_METADATA_END = /\s*@apicize-file-metadata-end\s*\*\//;
  private static readonly REQUEST_METADATA_START = /\/\*\s*@apicize-request-metadata\s*/;
  private static readonly REQUEST_METADATA_END = /\s*@apicize-request-metadata-end\s*\*\//;
  private static readonly GROUP_METADATA_START = /\/\*\s*@apicize-group-metadata\s*/;
  private static readonly GROUP_METADATA_END = /\s*@apicize-group-metadata-end\s*\*\//;

  /**
   * Extract metadata from a TypeScript file
   * @param filePath Path to the TypeScript file
   * @param options Extraction options
   * @returns Extracted metadata
   */
  async extractFromFile(
    filePath: string,
    options: MetadataExtractionOptions = {}
  ): Promise<ExtractedMetadata> {
    const { strictMode = false, includeWarnings = true, validateJson = true } = options;

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          requestMetadata: [],
          groupMetadata: [],
          errors: [`File not found: ${filePath}`],
          warnings: [],
        };
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.extractFromContent(content, { strictMode, includeWarnings, validateJson });
    } catch (error) {
      return {
        requestMetadata: [],
        groupMetadata: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract metadata from TypeScript content string
   * @param content TypeScript file content
   * @param options Extraction options
   * @returns Extracted metadata
   */
  extractFromContent(content: string, options: MetadataExtractionOptions = {}): ExtractedMetadata {
    const { strictMode = false, includeWarnings = true, validateJson = true } = options;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const lines = content.split('\n');

      // Extract file-level metadata
      const fileMetadata = this.extractFileMetadata(lines, validateJson, errors);

      // Extract request and group metadata
      const { requestMetadata, groupMetadata } = this.extractBlockMetadata(
        lines,
        validateJson,
        errors,
        warnings,
        includeWarnings
      );

      // Check for missing metadata in strict mode
      if (strictMode && requestMetadata.length === 0 && groupMetadata.length === 0) {
        errors.push('No metadata blocks found in strict mode');
      }

      return {
        fileMetadata,
        requestMetadata,
        groupMetadata,
        errors,
        warnings: includeWarnings ? warnings : [],
      };
    } catch (error) {
      return {
        requestMetadata: [],
        groupMetadata: [],
        errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Extract and validate metadata with error throwing
   * @param content TypeScript content or file path
   * @returns Validated metadata
   * @throws MetadataExtractionError if extraction fails
   */
  async extractAndValidate(content: string): Promise<ExtractedMetadata> {
    let result: ExtractedMetadata;

    // Check if content is a file path or actual content
    if (content.includes('\n') || content.includes('describe') || content.includes('/*')) {
      // Looks like content
      result = this.extractFromContent(content, { strictMode: true, validateJson: true });
    } else {
      // Looks like a file path
      result = await this.extractFromFile(content, { strictMode: true, validateJson: true });
    }

    if (result.errors.length > 0) {
      throw new MetadataExtractionError('Failed to extract metadata', result.errors);
    }

    return result;
  }

  /**
   * Find all request metadata in the extracted data
   * @param metadata Extracted metadata
   * @returns Array of all request metadata
   */
  getAllRequests(metadata: ExtractedMetadata): ExtractedRequestMetadata[] {
    const requests: ExtractedRequestMetadata[] = [];

    // Add top-level requests
    requests.push(...metadata.requestMetadata);

    // Recursively find requests in groups
    const findRequestsInGroups = (groups: ExtractedGroupMetadata[]) => {
      for (const group of groups) {
        if (group.children) {
          for (const child of group.children) {
            if (child.blockType === 'request') {
              requests.push(child as ExtractedRequestMetadata);
            } else if (child.blockType === 'group') {
              findRequestsInGroups([child as ExtractedGroupMetadata]);
            }
          }
        }
      }
    };

    findRequestsInGroups(metadata.groupMetadata);
    return requests;
  }

  /**
   * Find all group metadata in the extracted data
   * @param metadata Extracted metadata
   * @returns Array of all group metadata (flattened)
   */
  getAllGroups(metadata: ExtractedMetadata): ExtractedGroupMetadata[] {
    const groups: ExtractedGroupMetadata[] = [];

    const flatten = (groupList: ExtractedGroupMetadata[]) => {
      for (const group of groupList) {
        groups.push(group);
        if (group.children) {
          const childGroups = group.children.filter(
            child => child.blockType === 'group'
          ) as ExtractedGroupMetadata[];
          flatten(childGroups);
        }
      }
    };

    flatten(metadata.groupMetadata);
    return groups;
  }

  /**
   * Find specific metadata by ID
   * @param metadata Extracted metadata
   * @param id The ID to search for
   * @returns The metadata object if found, undefined otherwise
   */
  findMetadataById(
    metadata: ExtractedMetadata,
    id: string
  ): ExtractedRequestMetadata | ExtractedGroupMetadata | undefined {
    // Check requests
    const request = metadata.requestMetadata.find(r => r.id === id);
    if (request) return request;

    // Check groups recursively
    const findInGroups = (
      groups: ExtractedGroupMetadata[]
    ): ExtractedRequestMetadata | ExtractedGroupMetadata | undefined => {
      for (const group of groups) {
        if (group.id === id) return group;

        if (group.children) {
          for (const child of group.children) {
            if (child.id === id) return child;
            if (child.blockType === 'group') {
              const found = findInGroups([child as ExtractedGroupMetadata]);
              if (found) return found;
            }
          }
        }
      }
      return undefined;
    };

    return findInGroups(metadata.groupMetadata);
  }

  /**
   * Get statistics about the extracted metadata
   * @param metadata Extracted metadata
   * @returns Statistics object
   */
  getMetadataStats(metadata: ExtractedMetadata) {
    const allRequests = this.getAllRequests(metadata);
    const allGroups = this.getAllGroups(metadata);

    return {
      hasFileMetadata: !!metadata.fileMetadata,
      totalRequests: allRequests.length,
      totalGroups: allGroups.length,
      requestsWithTests: allRequests.filter(r => r.testCode && r.testCode.trim().length > 0).length,
      totalErrors: metadata.errors.length,
      totalWarnings: metadata.warnings.length,
      metadataBlocks: allRequests.length + allGroups.length + (metadata.fileMetadata ? 1 : 0),
    };
  }

  /**
   * Extract file-level metadata from content lines
   */
  private extractFileMetadata(
    lines: string[],
    validateJson: boolean,
    errors: string[]
  ): Record<string, any> | undefined {
    const metadataBlock = this.findMetadataBlock(
      lines,
      MetadataExtractor.FILE_METADATA_START,
      MetadataExtractor.FILE_METADATA_END
    );

    if (!metadataBlock) {
      return undefined;
    }

    try {
      const metadata = JSON.parse(metadataBlock.content);
      if (validateJson && typeof metadata !== 'object') {
        errors.push(`File metadata is not a valid object at line ${metadataBlock.startLine}`);
        return undefined;
      }
      return metadata;
    } catch (parseError) {
      errors.push(
        `Invalid JSON in file metadata at line ${metadataBlock.startLine}: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
      return undefined;
    }
  }

  /**
   * Extract request and group metadata from content lines
   */
  private extractBlockMetadata(
    lines: string[],
    validateJson: boolean,
    errors: string[],
    warnings: string[],
    includeWarnings: boolean
  ) {
    const requestMetadata: ExtractedRequestMetadata[] = [];
    const groupMetadata: ExtractedGroupMetadata[] = [];

    // Find all request metadata blocks
    let searchIndex = 0;
    while (searchIndex < lines.length) {
      const requestBlock = this.findMetadataBlock(
        lines,
        MetadataExtractor.REQUEST_METADATA_START,
        MetadataExtractor.REQUEST_METADATA_END,
        searchIndex
      );

      if (!requestBlock) break;

      try {
        const metadata = JSON.parse(requestBlock.content);
        if (validateJson && typeof metadata !== 'object') {
          errors.push(`Request metadata is not a valid object at line ${requestBlock.startLine}`);
        } else {
          const id = metadata.id || `request-${requestBlock.startLine}`;

          // Extract test code following the metadata
          const testCode = this.extractTestCode(lines, requestBlock.endLine);

          requestMetadata.push({
            id,
            metadata,
            testCode: testCode || undefined,
            lineNumber: requestBlock.startLine,
            blockType: 'request',
          });
        }
      } catch (parseError) {
        errors.push(
          `Invalid JSON in request metadata at line ${requestBlock.startLine}: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`
        );
      }

      searchIndex = requestBlock.endLine + 1;
    }

    // Find all group metadata blocks
    searchIndex = 0;
    while (searchIndex < lines.length) {
      const groupBlock = this.findMetadataBlock(
        lines,
        MetadataExtractor.GROUP_METADATA_START,
        MetadataExtractor.GROUP_METADATA_END,
        searchIndex
      );

      if (!groupBlock) break;

      try {
        const metadata = JSON.parse(groupBlock.content);
        if (validateJson && typeof metadata !== 'object') {
          errors.push(`Group metadata is not a valid object at line ${groupBlock.startLine}`);
        } else {
          const id = metadata.id || `group-${groupBlock.startLine}`;

          groupMetadata.push({
            id,
            metadata,
            lineNumber: groupBlock.startLine,
            blockType: 'group',
          });
        }
      } catch (parseError) {
        errors.push(
          `Invalid JSON in group metadata at line ${groupBlock.startLine}: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`
        );
      }

      searchIndex = groupBlock.endLine + 1;
    }

    // Check for duplicate IDs
    if (includeWarnings) {
      this.checkForDuplicateIds(requestMetadata, groupMetadata, warnings);
    }

    return { requestMetadata, groupMetadata };
  }

  /**
   * Find a metadata block between start and end patterns
   */
  private findMetadataBlock(
    lines: string[],
    startPattern: RegExp,
    endPattern: RegExp,
    startIndex = 0
  ): { content: string; startLine: number; endLine: number } | null {
    let startLine = -1;
    let endLine = -1;

    // Find start pattern
    for (let i = startIndex; i < lines.length; i++) {
      if (startPattern.test(lines[i])) {
        startLine = i + 1; // Line numbers are 1-based
        break;
      }
    }

    if (startLine === -1) return null;

    // Find end pattern
    for (let i = startLine; i < lines.length; i++) {
      if (endPattern.test(lines[i])) {
        endLine = i + 1; // Line numbers are 1-based
        break;
      }
    }

    if (endLine === -1) return null;

    // Extract content between start and end (exclude start and end lines)
    const contentLines = lines.slice(startLine, endLine - 1);
    const content = contentLines.join('\n').trim();

    return { content, startLine, endLine };
  }

  /**
   * Extract test code following a metadata block
   */
  private extractTestCode(lines: string[], fromLine: number): string | undefined {
    // Look for test code patterns after the metadata block
    const testStartPatterns = [
      /it\s*\(\s*['"`]/, // it('test name'
      /test\s*\(\s*['"`]/, // test('test name'
    ];

    let testStartLine = -1;
    let testEndLine = -1;

    // Find the start of test code (look further than 10 lines for complex files)
    for (let i = fromLine; i < Math.min(lines.length, fromLine + 20); i++) {
      const line = lines[i].trim();
      if (testStartPatterns.some(pattern => pattern.test(line))) {
        testStartLine = i;
        break;
      }
    }

    if (testStartLine === -1) return undefined;

    // Find the end of the test block by matching braces
    let braceCount = 0;
    let inTest = false;
    let parenthesesCount = 0;

    for (let i = testStartLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '(') {
          parenthesesCount++;
        } else if (char === ')') {
          parenthesesCount--;
        } else if (char === '{') {
          if (parenthesesCount === 0) {
            braceCount++;
            inTest = true;
          }
        } else if (char === '}') {
          if (parenthesesCount === 0) {
            braceCount--;
            if (inTest && braceCount === 0) {
              testEndLine = i;
              break;
            }
          }
        }
      }

      if (testEndLine !== -1) break;
    }

    if (testEndLine === -1) {
      // If we can't find the end, include the next reasonable number of lines
      testEndLine = Math.min(lines.length - 1, testStartLine + 30);
    }

    // Extract the test code
    const testLines = lines.slice(testStartLine, testEndLine + 1);
    return testLines.join('\n').trim();
  }

  /**
   * Check for duplicate IDs in metadata
   */
  private checkForDuplicateIds(
    requestMetadata: ExtractedRequestMetadata[],
    groupMetadata: ExtractedGroupMetadata[],
    warnings: string[]
  ) {
    const allIds = new Set<string>();
    const duplicateIds = new Set<string>();

    // Check request IDs
    for (const request of requestMetadata) {
      if (allIds.has(request.id)) {
        duplicateIds.add(request.id);
      } else {
        allIds.add(request.id);
      }
    }

    // Check group IDs
    for (const group of groupMetadata) {
      if (allIds.has(group.id)) {
        duplicateIds.add(group.id);
      } else {
        allIds.add(group.id);
      }
    }

    if (duplicateIds.size > 0) {
      warnings.push(`Duplicate metadata IDs found: ${Array.from(duplicateIds).join(', ')}`);
    }
  }
}

/**
 * Convenience function to extract metadata from a file
 * @param filePath Path to the TypeScript file
 * @param options Extraction options
 * @returns Extracted metadata
 */
export async function extractMetadataFromFile(
  filePath: string,
  options?: MetadataExtractionOptions
): Promise<ExtractedMetadata> {
  const extractor = new MetadataExtractor();
  return extractor.extractFromFile(filePath, options);
}

/**
 * Convenience function to extract metadata from content
 * @param content TypeScript file content
 * @param options Extraction options
 * @returns Extracted metadata
 */
export function extractMetadataFromContent(
  content: string,
  options?: MetadataExtractionOptions
): ExtractedMetadata {
  const extractor = new MetadataExtractor();
  return extractor.extractFromContent(content, options);
}
