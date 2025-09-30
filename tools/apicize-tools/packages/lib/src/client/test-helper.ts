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
} from '../types';
import { VariableEngine } from '../variables/variable-engine';
import { ApicizeClient } from './apicize-client';

/**
 * Implementation of TestHelper for use in exported TypeScript test files
 */
export class TestHelperImpl implements ITestHelper {
  private variableEngine: VariableEngine;
  private client: ApicizeClient;
  private outputData: Record<string, unknown> = {};

  constructor() {
    this.variableEngine = new VariableEngine();
    this.client = new ApicizeClient({
      defaultTimeout: 30000,
    });
  }

  /**
   * Setup test context for a specific test
   */
  async setupTest(testName: string): Promise<ApicizeContext> {
    // Create a basic context for the test
    const context = new TestContext(testName, this.variableEngine, this.client, this.outputData);

    return context;
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
    private outputData: Record<string, unknown>
  ) {
    // Initialize $ with current output data
    this.$ = { ...outputData };

    // Basic workbook structure
    this.workbook = {
      version: 1.0,
      requests: [],
      scenarios: [],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
      defaults: {},
    };
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
