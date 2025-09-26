import * as fs from 'fs';
import {
  ApicizeWorkbook,
  Request,
  RequestGroup,
  Scenario,
  Authorization,
  Certificate,
  Proxy,
  ExternalData,
  Defaults,
  RequestOrGroup,
  isRequest,
  isRequestGroup,
} from '../types';
import { ApicizeValidator } from '../validation/validator';

export interface ParseResult {
  success: boolean;
  workbook?: ApicizeWorkbook;
  errors: string[];
  warnings: string[];
}

export interface ParseOptions {
  validateOnLoad?: boolean;
  strictMode?: boolean;
  includeWarnings?: boolean;
}

export class ApicizeParseError extends Error {
  constructor(
    message: string,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'ApicizeParseError';
  }
}

export class ApicizeParser {
  private validator: ApicizeValidator;

  constructor() {
    this.validator = new ApicizeValidator();
  }

  /**
   * Parse an .apicize file from a file path
   * @param filePath Path to the .apicize file
   * @param options Parse options
   * @returns ParseResult containing the parsed workbook or errors
   */
  async parseFile(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    const { validateOnLoad = true, strictMode = false, includeWarnings = true } = options;

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          errors: [`File not found: ${filePath}`],
          warnings: [],
        };
      }

      // Check file extension
      if (!filePath.endsWith('.apicize')) {
        const warning = `File does not have .apicize extension: ${filePath}`;
        if (strictMode) {
          return {
            success: false,
            errors: [warning],
            warnings: [],
          };
        }
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.parseContent(content, { validateOnLoad, strictMode, includeWarnings });
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Parse .apicize content from a string
   * @param content JSON string content of the .apicize file
   * @param options Parse options
   * @returns ParseResult containing the parsed workbook or errors
   */
  parseContent(content: string, options: ParseOptions = {}): ParseResult {
    const { validateOnLoad = true, strictMode = false, includeWarnings = true } = options;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        return {
          success: false,
          errors: [
            `Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          ],
          warnings: [],
        };
      }

      // Validate if requested
      if (validateOnLoad) {
        const validationResult = this.validator.validateApicizeFile(data);
        if (!validationResult.valid) {
          const validationErrors = validationResult.errors.map(e => e.message);
          if (strictMode) {
            return {
              success: false,
              errors: ['Validation failed:', ...validationErrors],
              warnings: [],
            };
          } else {
            warnings.push('Validation warnings found:', ...validationErrors);
          }
        }
      }

      // Type assert the data as ApicizeWorkbook
      const workbook = data as ApicizeWorkbook;

      // Perform additional parsing checks
      const parseChecks = this.performParseChecks(workbook, includeWarnings);
      errors.push(...parseChecks.errors);
      warnings.push(...parseChecks.warnings);

      // Fail if there are critical errors (always) or any errors in strict mode
      const hasCriticalErrors = errors.some(
        e =>
          e.includes('Missing version field') ||
          e.includes('Missing requests array') ||
          e.includes('Requests must be an array')
      );

      if (hasCriticalErrors || (errors.length > 0 && strictMode)) {
        return {
          success: false,
          errors,
          warnings,
        };
      }

      return {
        success: true,
        workbook,
        errors,
        warnings: includeWarnings ? warnings : [],
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Parse and validate .apicize data, throwing on errors
   * @param data Raw data to parse
   * @returns Validated ApicizeWorkbook
   * @throws ApicizeParseError if parsing fails
   */
  parseAndValidate(data: unknown): ApicizeWorkbook {
    if (typeof data === 'string') {
      const result = this.parseContent(data, { validateOnLoad: true, strictMode: true });
      if (!result.success) {
        throw new ApicizeParseError('Failed to parse .apicize content', result.errors);
      }
      return result.workbook!;
    }

    // Validate the data structure
    const validationResult = this.validator.validateApicizeFile(data);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => e.message);
      throw new ApicizeParseError('Invalid .apicize data structure', errorMessages);
    }

    return data as ApicizeWorkbook;
  }

  /**
   * Get all requests from the workbook (flattened)
   * @param workbook The parsed workbook
   * @returns Array of all requests
   */
  getRequests(workbook: ApicizeWorkbook): Request[] {
    const requests: Request[] = [];

    const traverse = (items: RequestOrGroup[]) => {
      for (const item of items) {
        if (isRequest(item)) {
          requests.push(item);
        } else if (isRequestGroup(item)) {
          traverse(item.children);
        }
      }
    };

    traverse(workbook.requests);
    return requests;
  }

  /**
   * Get all request groups from the workbook (flattened)
   * @param workbook The parsed workbook
   * @returns Array of all request groups
   */
  getRequestGroups(workbook: ApicizeWorkbook): RequestGroup[] {
    const groups: RequestGroup[] = [];

    const traverse = (items: RequestOrGroup[]) => {
      for (const item of items) {
        if (isRequestGroup(item)) {
          groups.push(item);
          traverse(item.children);
        }
      }
    };

    traverse(workbook.requests);
    return groups;
  }

  /**
   * Get scenarios from the workbook
   * @param workbook The parsed workbook
   * @returns Array of scenarios (empty array if none)
   */
  getScenarios(workbook: ApicizeWorkbook): Scenario[] {
    return workbook.scenarios || [];
  }

  /**
   * Get authorizations from the workbook
   * @param workbook The parsed workbook
   * @returns Array of authorizations (empty array if none)
   */
  getAuthorizations(workbook: ApicizeWorkbook): Authorization[] {
    return workbook.authorizations || [];
  }

  /**
   * Get certificates from the workbook
   * @param workbook The parsed workbook
   * @returns Array of certificates (empty array if none)
   */
  getCertificates(workbook: ApicizeWorkbook): Certificate[] {
    return workbook.certificates || [];
  }

  /**
   * Get proxies from the workbook
   * @param workbook The parsed workbook
   * @returns Array of proxies (empty array if none)
   */
  getProxies(workbook: ApicizeWorkbook): Proxy[] {
    return workbook.proxies || [];
  }

  /**
   * Get external data from the workbook
   * @param workbook The parsed workbook
   * @returns Array of external data (empty array if none)
   */
  getExternalData(workbook: ApicizeWorkbook): ExternalData[] {
    return workbook.data || [];
  }

  /**
   * Get defaults from the workbook
   * @param workbook The parsed workbook
   * @returns Defaults object (empty object if none)
   */
  getDefaults(workbook: ApicizeWorkbook): Defaults {
    return workbook.defaults || {};
  }

  /**
   * Find a request by ID
   * @param workbook The parsed workbook
   * @param id The request ID to find
   * @returns The request if found, undefined otherwise
   */
  findRequest(workbook: ApicizeWorkbook, id: string): Request | undefined {
    const traverse = (items: RequestOrGroup[]): Request | undefined => {
      for (const item of items) {
        if (isRequest(item) && item.id === id) {
          return item;
        } else if (isRequestGroup(item)) {
          const found = traverse(item.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    return traverse(workbook.requests);
  }

  /**
   * Find a request group by ID
   * @param workbook The parsed workbook
   * @param id The group ID to find
   * @returns The request group if found, undefined otherwise
   */
  findRequestGroup(workbook: ApicizeWorkbook, id: string): RequestGroup | undefined {
    const traverse = (items: RequestOrGroup[]): RequestGroup | undefined => {
      for (const item of items) {
        if (isRequestGroup(item)) {
          if (item.id === id) {
            return item;
          }
          const found = traverse(item.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    return traverse(workbook.requests);
  }

  /**
   * Find a scenario by ID
   * @param workbook The parsed workbook
   * @param id The scenario ID to find
   * @returns The scenario if found, undefined otherwise
   */
  findScenario(workbook: ApicizeWorkbook, id: string): Scenario | undefined {
    return this.getScenarios(workbook).find(scenario => scenario.id === id);
  }

  /**
   * Get workbook statistics
   * @param workbook The parsed workbook
   * @returns Statistics about the workbook content
   */
  getWorkbookStats(workbook: ApicizeWorkbook) {
    const requests = this.getRequests(workbook);
    const requestGroups = this.getRequestGroups(workbook);

    return {
      version: workbook.version,
      totalRequests: requests.length,
      totalGroups: requestGroups.length,
      totalScenarios: this.getScenarios(workbook).length,
      totalAuthorizations: this.getAuthorizations(workbook).length,
      totalCertificates: this.getCertificates(workbook).length,
      totalProxies: this.getProxies(workbook).length,
      totalExternalData: this.getExternalData(workbook).length,
      hasDefaults: Object.keys(this.getDefaults(workbook)).length > 0,
      requestsWithTests: requests.filter(r => r.test && r.test.trim().length > 0).length,
    };
  }

  /**
   * Perform additional parse checks beyond schema validation
   * @param workbook The parsed workbook
   * @param includeWarnings Whether to include warning messages
   * @returns Object with errors and warnings arrays
   */
  private performParseChecks(workbook: ApicizeWorkbook, includeWarnings: boolean) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check version
    if (!workbook.version) {
      errors.push('Missing version field');
    } else if (workbook.version !== 1.0) {
      if (includeWarnings) {
        warnings.push(`Unexpected version: ${workbook.version}, expected 1.0`);
      }
    }

    // Check requests array exists
    if (!workbook.requests) {
      errors.push('Missing requests array');
    } else if (!Array.isArray(workbook.requests)) {
      errors.push('Requests must be an array');
    }

    // Check for duplicate IDs
    if (includeWarnings) {
      const allIds = new Set<string>();
      const duplicateIds = new Set<string>();

      const checkIds = (items: RequestOrGroup[]) => {
        for (const item of items) {
          if (allIds.has(item.id)) {
            duplicateIds.add(item.id);
          } else {
            allIds.add(item.id);
          }

          if (isRequestGroup(item)) {
            checkIds(item.children);
          }
        }
      };

      if (workbook.requests) {
        checkIds(workbook.requests);
      }

      // Check other sections for duplicate IDs
      [
        ...(workbook.scenarios || []),
        ...(workbook.authorizations || []),
        ...(workbook.certificates || []),
        ...(workbook.proxies || []),
        ...(workbook.data || []),
      ].forEach(item => {
        if (allIds.has(item.id)) {
          duplicateIds.add(item.id);
        } else {
          allIds.add(item.id);
        }
      });

      if (duplicateIds.size > 0) {
        warnings.push(`Duplicate IDs found: ${Array.from(duplicateIds).join(', ')}`);
      }
    }

    return { errors, warnings };
  }
}

/**
 * Convenience function to parse an .apicize file
 * @param filePath Path to the .apicize file
 * @param options Parse options
 * @returns ParseResult
 */
export async function parseApicizeFile(
  filePath: string,
  options?: ParseOptions
): Promise<ParseResult> {
  const parser = new ApicizeParser();
  return parser.parseFile(filePath, options);
}

/**
 * Convenience function to parse .apicize content
 * @param content JSON string content
 * @param options Parse options
 * @returns ParseResult
 */
export function parseApicizeContent(content: string, options?: ParseOptions): ParseResult {
  const parser = new ApicizeParser();
  return parser.parseContent(content, options);
}
