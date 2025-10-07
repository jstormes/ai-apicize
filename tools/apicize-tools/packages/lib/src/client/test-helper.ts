import {
  ITestHelper,
  ApicizeContext,
  ApicizeResponse,
  ApicizeWorkbook,
  Scenario,
  RequestConfig,
  NameValuePair,
  RequestBody,
  BodyType,
  HttpMethod,
  Variable,
} from '../types';
import { VariableEngine } from '../variables/variable-engine';
import { ApicizeClient } from './apicize-client';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Implementation of TestHelper for use in exported TypeScript test files
 */
export class TestHelperImpl implements ITestHelper {
  private variableEngine: VariableEngine;
  private client: ApicizeClient;
  private outputData: Record<string, unknown> = {};
  private workbookCache: Map<string, ApicizeWorkbook> = new Map();

  constructor() {
    this.variableEngine = new VariableEngine();
    this.client = new ApicizeClient({
      defaultTimeout: 30000,
    });
  }

  /**
   * Setup test context for an entire workbook
   * This is the main method called by generated tests
   */
  async setupWorkbook(workbookName: string): Promise<ApicizeContext> {
    // 1. Load workbook metadata from metadata/workbook.json
    const workbook = await this.loadWorkbookMetadata(workbookName);

    // 2. Load default scenario (if exists)
    const scenario = workbook.defaults?.selectedScenario
      ? await this.loadScenario(workbook.defaults.selectedScenario.id)
      : undefined;

    // 3. Initialize variables from scenario
    const variables = scenario?.variables
      ? this.initializeVariables(scenario.variables)
      : {};

    // 4. Create context with workbook and scenario
    const context = new TestContext(
      workbookName,
      this.variableEngine,
      this.client,
      this.outputData,
      workbook,
      scenario
    );

    // 5. Initialize $ with scenario variables
    context.$ = { ...variables };

    return context;
  }

  /**
   * Setup test context for a specific test
   * Kept for backward compatibility - delegates to setupWorkbook
   */
  async setupTest(testName: string): Promise<ApicizeContext> {
    return this.setupWorkbook(testName);
  }

  /**
   * Setup test context for a specific request
   * Similar to setupWorkbook but focused on a single request
   */
  async setupRequest(requestId: string): Promise<ApicizeContext> {
    // Load workbook to get request metadata
    const workbook = await this.loadWorkbookMetadata(requestId);

    // Find the request in the workbook (could be nested in groups)
    // For now, use the same setup as setupWorkbook
    const scenario = workbook.defaults?.selectedScenario
      ? await this.loadScenario(workbook.defaults.selectedScenario.id)
      : undefined;

    const variables = scenario?.variables
      ? this.initializeVariables(scenario.variables)
      : {};

    const context = new TestContext(
      requestId,
      this.variableEngine,
      this.client,
      this.outputData,
      workbook,
      scenario
    );

    context.$ = { ...variables };

    return context;
  }

  /**
   * Load workbook metadata from exported project
   */
  private async loadWorkbookMetadata(workbookName: string): Promise<ApicizeWorkbook> {
    // Check cache first
    if (this.workbookCache.has(workbookName)) {
      return this.workbookCache.get(workbookName)!;
    }

    // Load from metadata/workbook.json
    const metadataPath = path.join(process.cwd(), 'metadata', 'workbook.json');

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const workbook: ApicizeWorkbook = JSON.parse(content);
      this.workbookCache.set(workbookName, workbook);
      return workbook;
    } catch (error) {
      // Fallback: create minimal workbook
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        scenarios: [],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
        defaults: {},
      };
      return workbook;
    }
  }

  /**
   * Initialize variables from scenario
   */
  private initializeVariables(variables: Variable[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const variable of variables) {
      if (!variable.disabled) {
        result[variable.name] = this.parseVariableValue(variable);
      }
    }

    return result;
  }

  /**
   * Parse variable value based on type
   */
  private parseVariableValue(variable: Variable): unknown {
    switch (variable.type) {
      case 'TEXT':
        return variable.value;
      case 'JSON':
        try {
          return JSON.parse(variable.value);
        } catch {
          return variable.value;
        }
      case 'FILE-JSON':
      case 'FILE-CSV':
        // Load from file (to be implemented in future phase)
        return variable.value;
      default:
        return variable.value;
    }
  }

  /**
   * Load scenario by ID (placeholder implementation)
   */
  async loadScenario(scenarioId: string): Promise<Scenario> {
    // This would typically load from configuration files
    // For now, return a basic scenario
    return {
      id: scenarioId,
      name: `Scenario ${scenarioId}`,
      variables: [],
    };
  }

  /**
   * Load data by ID (placeholder implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async loadData(_dataId: string): Promise<unknown> {
    // This would typically load from data files
    // For now, return empty object
    return {};
  }
}

/**
 * Implementation of ApicizeContext for test execution
 */
class TestContext implements ApicizeContext {
  public $: Record<string, unknown> = {};
  public workbook: ApicizeWorkbook;
  public scenario?: Scenario;
  public variables: Record<string, unknown> = {};
  public headers?: NameValuePair[];
  public body?: RequestBody;

  constructor(
    _testName: string,
    _variableEngine: VariableEngine,
    private client: ApicizeClient,
    private outputData: Record<string, unknown>,
    workbook?: ApicizeWorkbook,
    scenario?: Scenario
  ) {
    // Initialize $ with current output data
    this.$ = { ...outputData };

    // Use provided workbook or create basic structure
    this.workbook = workbook || {
      version: 1.0,
      requests: [],
      scenarios: [],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
      defaults: {},
    };

    // Set scenario if provided
    if (scenario !== undefined) {
      this.scenario = scenario;
    }
  }

  /**
   * Execute an HTTP request and return response
   */
  async execute(request: RequestConfig): Promise<ApicizeResponse> {
    try {
      // Convert request to client format
      const clientRequest: any = {
        url: request.url,
        method: request.method as HttpMethod,
        headers: this.normalizeHeaders(request.headers),
        timeout: request.timeout,
      };

      // Only add body if it exists
      if (request.body !== undefined) {
        clientRequest.body = request.body;
      }

      // Execute request using the ApicizeClient
      const response = await this.client.execute(clientRequest);

      // Convert response to ApicizeResponse format
      const result: ApicizeResponse = {
        status: response.status,
        statusText: response.statusText || 'OK',
        headers: response.headers || {},
        body: {
          type: this.detectBodyType(response.body),
          data: response.body,
          text: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
          size: this.calculateBodySize(response.body),
        },
      };

      // Only add timing if it exists
      if (response.timing) {
        result.timing = response.timing;
      }

      return result;
    } catch (error) {
      // Return error response
      return {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        body: {
          type: BodyType.Text,
          data: error instanceof Error ? error.message : String(error),
          text: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Substitute variables in text
   */
  substituteVariables(text: string): string {
    // Use the variable engine to substitute variables
    // For now, just return the text as-is since we need proper integration
    return text;
  }

  /**
   * Output data for use in subsequent tests
   */
  output = (key: string, value: unknown): void => {
    this.outputData[key] = value;
    this.$[key] = value;
  };

  /**
   * Cleanup resources after test execution
   */
  async cleanup(): Promise<void> {
    // Close any open connections
    if (this.client && typeof (this.client as any).close === 'function') {
      await (this.client as any).close();
    }

    // Clear output data
    this.outputData = {};
    this.$ = {};

    // Clear variable cache (if any cleanup is needed in the future)
  }

  /**
   * Normalize headers to NameValuePair array
   */
  private normalizeHeaders(headers?: NameValuePair[] | Record<string, string>): NameValuePair[] {
    if (!headers) return [];

    if (Array.isArray(headers)) {
      return headers;
    }

    return Object.entries(headers).map(([name, value]) => ({ name, value }));
  }

  /**
   * Detect body type from response
   */
  private detectBodyType(body: unknown): BodyType {
    if (body === null || body === undefined) {
      return BodyType.None;
    }

    if (typeof body === 'string') {
      try {
        JSON.parse(body);
        return BodyType.JSON;
      } catch {
        return BodyType.Text;
      }
    }

    if (typeof body === 'object') {
      return BodyType.JSON;
    }

    if (body instanceof Uint8Array || body instanceof Buffer) {
      return BodyType.Raw;
    }

    return BodyType.Text;
  }

  /**
   * Calculate body size
   */
  private calculateBodySize(body: unknown): number {
    if (body === null || body === undefined) return 0;

    if (typeof body === 'string') {
      return body.length;
    }

    if (body instanceof Uint8Array || body instanceof Buffer) {
      return body.length;
    }

    // For objects, estimate size based on JSON string
    try {
      return JSON.stringify(body).length;
    } catch {
      return 0;
    }
  }
}

// Export as TestHelper for backwards compatibility
export { TestHelperImpl as TestHelper };
