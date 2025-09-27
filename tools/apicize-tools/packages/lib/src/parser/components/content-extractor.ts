/**
 * Content Extractor - Responsible for extracting content from parsed workbook data
 */

import { ApicizeWorkbook } from '../../types';
import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';

/**
 * Content extractor configuration
 */
export interface ContentExtractorConfig {
  extractTestCode?: boolean;
  extractMetadata?: boolean;
  extractVariables?: boolean;
  validateReferences?: boolean;
  includeDisabledItems?: boolean;
  maxDepth?: number;
}

/**
 * Extracted request information
 */
export interface ExtractedRequest {
  id: string;
  name: string;
  url: string;
  method: string;
  test?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: {
    type: string;
    data?: unknown;
    formatted?: string;
  };
  queryStringParams?: Array<{ name: string; value: string }>;
  timeout?: number;
  path: string[];
  parentId?: string;
}

/**
 * Extracted group information
 */
export interface ExtractedGroup {
  id: string;
  name: string;
  children: string[];
  execution?: string;
  runs?: number;
  multiRunExecution?: string;
  selectedScenario?: { id: string; name: string };
  selectedData?: { id: string; name: string };
  path: string[];
  parentId?: string;
}

/**
 * Extracted metadata information
 */
export interface ExtractedMetadata {
  version: number;
  scenarios: Array<{
    id: string;
    name: string;
    variables: Array<{
      name: string;
      value: string;
      type: string;
      disabled?: boolean;
    }>;
  }>;
  authorizations: Array<{
    id: string;
    name: string;
    type: string;
    [key: string]: unknown;
  }>;
  certificates: unknown[];
  proxies: unknown[];
  data: Array<{
    id: string;
    name: string;
    type: string;
    source?: string;
    validation_errors?: unknown;
  }>;
  defaults?: {
    selectedAuthorization?: { id: string; name: string };
    selectedCertificate?: { id: string; name: string };
    selectedProxy?: { id: string; name: string };
    selectedScenario?: { id: string; name: string };
  };
}

/**
 * Extracted variables collection
 */
export interface ExtractedVariables {
  scenarios: Record<string, Record<string, string>>;
  global: Record<string, string>;
  environment: Record<string, string>;
  references: Array<{
    path: string;
    variable: string;
    context: string;
  }>;
}

/**
 * Complete extraction result
 */
export interface ExtractionResult {
  requests: ExtractedRequest[];
  groups: ExtractedGroup[];
  metadata: ExtractedMetadata;
  variables: ExtractedVariables;
  hierarchy: {
    id: string;
    type: 'request' | 'group';
    children?: any[];
  }[];
}

/**
 * Content extractor implementation
 */
export class ApicizeContentExtractor /* implements IContentExtractor */ {
  private config: ContentExtractorConfig;

  constructor(config: ContentExtractorConfig = {}) {
    this.config = {
      extractTestCode: true,
      extractMetadata: true,
      extractVariables: true,
      validateReferences: true,
      includeDisabledItems: false,
      maxDepth: 50,
      ...config,
    };
  }

  /**
   * Extract all content from workbook
   */
  extractContent(workbook: ApicizeWorkbook): Result<ExtractionResult, ApicizeError> {
    try {
      const requests: ExtractedRequest[] = [];
      const groups: ExtractedGroup[] = [];
      const hierarchy: any[] = [];

      // Extract requests and groups
      if (workbook.requests && Array.isArray(workbook.requests)) {
        this.extractRequestsAndGroups(workbook.requests, [], requests, groups, hierarchy);
      }

      // Extract metadata
      let metadata: ExtractedMetadata;
      if (this.config.extractMetadata) {
        const metadataResult = this.extractMetadata(workbook);
        if (metadataResult.isFailure()) {
          return metadataResult as any;
        }
        metadata = metadataResult.data;
      } else {
        metadata = this.createEmptyMetadata();
      }

      // Extract variables
      let variables: ExtractedVariables;
      if (this.config.extractVariables) {
        const variablesResult = this.extractVariables(workbook, requests);
        if (variablesResult.isFailure()) {
          return variablesResult as any;
        }
        variables = variablesResult.data;
      } else {
        variables = this.createEmptyVariables();
      }

      // Validate references if enabled
      if (this.config.validateReferences) {
        const validationResult = this.validateReferences(requests, groups, metadata);
        if (validationResult.isFailure()) {
          return validationResult as any;
        }
      }

      const result: ExtractionResult = {
        requests,
        groups,
        metadata,
        variables,
        hierarchy,
      };

      return success(result);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to extract content from workbook', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Extract specific requests by ID
   */
  extractRequests(
    workbook: ApicizeWorkbook,
    requestIds: string[]
  ): Result<ExtractedRequest[], ApicizeError> {
    try {
      const allRequests: ExtractedRequest[] = [];
      const groups: ExtractedGroup[] = [];
      const hierarchy: any[] = [];

      if (workbook.requests && Array.isArray(workbook.requests)) {
        this.extractRequestsAndGroups(workbook.requests, [], allRequests, groups, hierarchy);
      }

      const filteredRequests = allRequests.filter(req => requestIds.includes(req.id));

      if (filteredRequests.length !== requestIds.length) {
        const foundIds = filteredRequests.map(r => r.id);
        const missingIds = requestIds.filter(id => !foundIds.includes(id));
        return failure(
          new ApicizeError(
            ApicizeErrorCode.NOT_FOUND,
            `Some requests not found: ${missingIds.join(', ')}`,
            { context: { requestIds, foundIds, missingIds } }
          )
        );
      }

      return success(filteredRequests);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to extract specific requests', {
          cause: error as Error,
          context: { requestIds },
        })
      );
    }
  }

  /**
   * Extract test code from requests
   */
  extractTestCode(workbook: ApicizeWorkbook): Result<Record<string, string>, ApicizeError> {
    if (!this.config.extractTestCode) {
      return success({});
    }

    try {
      const testCode: Record<string, string> = {};
      const requests: ExtractedRequest[] = [];
      const groups: ExtractedGroup[] = [];
      const hierarchy: any[] = [];

      if (workbook.requests && Array.isArray(workbook.requests)) {
        this.extractRequestsAndGroups(workbook.requests, [], requests, groups, hierarchy);
      }

      for (const request of requests) {
        if (request.test && request.test.trim()) {
          testCode[request.id] = request.test;
        }
      }

      return success(testCode);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to extract test code', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Extract variables from workbook
   */
  extractVariables(
    workbook: ApicizeWorkbook,
    requests?: ExtractedRequest[]
  ): Result<ExtractedVariables, ApicizeError> {
    try {
      const variables: ExtractedVariables = {
        scenarios: {},
        global: {},
        environment: {},
        references: [],
      };

      // Extract scenario variables
      if (workbook.scenarios && Array.isArray(workbook.scenarios)) {
        for (const scenario of workbook.scenarios) {
          if (scenario.id && scenario.variables && Array.isArray(scenario.variables)) {
            const scenarioVars: Record<string, string> = {};
            for (const variable of scenario.variables) {
              if (variable.name && variable.value !== undefined) {
                if (!this.config.includeDisabledItems && variable.disabled) {
                  continue;
                }
                scenarioVars[variable.name] = String(variable.value);
              }
            }
            variables.scenarios[scenario.id] = scenarioVars;
          }
        }
      }

      // Extract variable references
      if (requests) {
        this.extractVariableReferences(requests, variables.references);
      }

      return success(variables);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to extract variables', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Extract metadata from workbook
   */
  extractMetadata(workbook: ApicizeWorkbook): Result<ExtractedMetadata, ApicizeError> {
    try {
      const metadata: ExtractedMetadata = {
        version: workbook.version || 1.0,
        scenarios: [],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
      };

      // Extract scenarios
      if (workbook.scenarios && Array.isArray(workbook.scenarios)) {
        metadata.scenarios = workbook.scenarios.map(scenario => ({
          id: scenario.id,
          name: scenario.name,
          variables: scenario.variables || [],
        }));
      }

      // Extract authorizations
      if (workbook.authorizations && Array.isArray(workbook.authorizations)) {
        metadata.authorizations = workbook.authorizations.map(auth => ({
          ...auth,
        }));
      }

      // Extract data sources
      if (workbook.data && Array.isArray(workbook.data)) {
        metadata.data = workbook.data.map(dataSource => ({
          id: dataSource.id,
          name: dataSource.name,
          type: dataSource.type,
          source: dataSource.source,
          validation_errors: dataSource.validation_errors,
        }));
      }

      // Extract other sections
      metadata.certificates = workbook.certificates || [];
      metadata.proxies = workbook.proxies || [];

      // Extract defaults
      if (workbook.defaults) {
        metadata.defaults = { ...workbook.defaults };
      }

      return success(metadata);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to extract metadata', {
          cause: error as Error,
        })
      );
    }
  }

  // Private helper methods

  private extractRequestsAndGroups(
    items: any[],
    path: string[],
    requests: ExtractedRequest[],
    groups: ExtractedGroup[],
    hierarchy: any[],
    parentId?: string,
    depth = 0
  ): void {
    if (depth > this.config.maxDepth!) {
      throw new Error(`Maximum extraction depth (${this.config.maxDepth}) exceeded`);
    }

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const currentPath = [...path, item.name || item.id || 'unnamed'];

      if (this.isRequest(item)) {
        const request: ExtractedRequest = {
          id: item.id,
          name: item.name,
          url: item.url,
          method: item.method,
          path: currentPath,
          parentId,
        };

        // Extract optional fields
        if (this.config.extractTestCode && item.test) {
          request.test = item.test;
        }
        if (item.headers) request.headers = item.headers;
        if (item.body) request.body = item.body;
        if (item.queryStringParams) request.queryStringParams = item.queryStringParams;
        if (item.timeout) request.timeout = item.timeout;

        requests.push(request);
        hierarchy.push({ id: item.id, type: 'request' as const });
      } else if (this.isGroup(item)) {
        const group: ExtractedGroup = {
          id: item.id,
          name: item.name,
          children: [],
          path: currentPath,
          parentId,
        };

        // Extract optional group fields
        if (item.execution) group.execution = item.execution;
        if (item.runs) group.runs = item.runs;
        if (item.multiRunExecution) group.multiRunExecution = item.multiRunExecution;
        if (item.selectedScenario) group.selectedScenario = item.selectedScenario;
        if (item.selectedData) group.selectedData = item.selectedData;

        groups.push(group);

        const groupHierarchy = { id: item.id, type: 'group' as const, children: [] };
        hierarchy.push(groupHierarchy);

        // Recursively extract children
        if (item.children && Array.isArray(item.children)) {
          this.extractRequestsAndGroups(
            item.children,
            currentPath,
            requests,
            groups,
            groupHierarchy.children,
            item.id,
            depth + 1
          );

          // Update group children IDs
          group.children = groupHierarchy.children.map((child: any) => child.id);
        }
      }
    }
  }

  private isRequest(item: any): boolean {
    return item && typeof item === 'object' && 'url' in item && 'method' in item;
  }

  private isGroup(item: any): boolean {
    return item && typeof item === 'object' && 'children' in item && Array.isArray(item.children);
  }

  private extractVariableReferences(requests: ExtractedRequest[], references: any[]): void {
    for (const request of requests) {
      // Check URL for variables
      this.findVariableReferences(request.url, `${request.path.join('/')}/url`, references);

      // Check headers
      if (request.headers) {
        for (const header of request.headers) {
          this.findVariableReferences(
            header.value,
            `${request.path.join('/')}/headers/${header.name}`,
            references
          );
        }
      }

      // Check query parameters
      if (request.queryStringParams) {
        for (const param of request.queryStringParams) {
          this.findVariableReferences(
            param.value,
            `${request.path.join('/')}/params/${param.name}`,
            references
          );
        }
      }

      // Check body (if it's a string)
      if (request.body && typeof request.body.data === 'string') {
        this.findVariableReferences(
          request.body.data,
          `${request.path.join('/')}/body`,
          references
        );
      }
    }
  }

  private findVariableReferences(text: string, path: string, references: any[]): void {
    if (!text || typeof text !== 'string') {
      return;
    }

    const variablePattern = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(text)) !== null) {
      references.push({
        path,
        variable: match[1].trim(),
        context: match[0],
      });
    }
  }

  private validateReferences(
    requests: ExtractedRequest[],
    groups: ExtractedGroup[],
    metadata: ExtractedMetadata
  ): Result<void, ApicizeError> {
    try {
      const allIds = new Set<string>();

      // Collect all IDs
      requests.forEach(r => allIds.add(r.id));
      groups.forEach(g => allIds.add(g.id));
      metadata.scenarios.forEach(s => allIds.add(s.id));
      metadata.authorizations.forEach(a => allIds.add(a.id));
      metadata.data.forEach(d => allIds.add(d.id));

      // Check group child references
      for (const group of groups) {
        for (const childId of group.children) {
          if (!allIds.has(childId)) {
            return failure(
              new ApicizeError(
                ApicizeErrorCode.VALIDATION_ERROR,
                `Group '${group.name}' references non-existent child: ${childId}`,
                { context: { groupId: group.id, childId } }
              )
            );
          }
        }
      }

      // Check default references
      if (metadata.defaults) {
        const checkReference = (ref: any, type: string) => {
          if (ref && ref.id && !allIds.has(ref.id)) {
            return failure(
              new ApicizeError(
                ApicizeErrorCode.VALIDATION_ERROR,
                `Default ${type} references non-existent ID: ${ref.id}`,
                { context: { type, referenceId: ref.id } }
              )
            );
          }
          return success(undefined);
        };

        const checks = [
          checkReference(metadata.defaults.selectedAuthorization, 'authorization'),
          checkReference(metadata.defaults.selectedCertificate, 'certificate'),
          checkReference(metadata.defaults.selectedProxy, 'proxy'),
          checkReference(metadata.defaults.selectedScenario, 'scenario'),
        ];

        for (const check of checks) {
          if (check.isFailure()) {
            return check;
          }
        }
      }

      return success(undefined);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.VALIDATION_ERROR, 'Failed to validate references', {
          cause: error as Error,
        })
      );
    }
  }

  private createEmptyMetadata(): ExtractedMetadata {
    return {
      version: 1.0,
      scenarios: [],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
    };
  }

  private createEmptyVariables(): ExtractedVariables {
    return {
      scenarios: {},
      global: {},
      environment: {},
      references: [],
    };
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<ContentExtractorConfig>): ApicizeContentExtractor {
    return new ApicizeContentExtractor({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): ContentExtractorConfig {
    return { ...this.config };
  }
}
