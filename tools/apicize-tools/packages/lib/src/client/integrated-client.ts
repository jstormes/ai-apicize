import { ApicizeClient, ClientConfig, RequestOptions } from './apicize-client';
import { ConfigManager } from '../config/config-manager';
import { VariableEngine } from '../variables/variable-engine';
import { ApicizeResponse, RequestConfig, NameValuePair, Request, BodyType } from '../types';

/**
 * Integrated client that combines HTTP client with configuration and variable management
 */
export class IntegratedApicizeClient {
  private httpClient: ApicizeClient;
  private configManager: ConfigManager;
  private variableEngine: VariableEngine;

  constructor(
    configManager: ConfigManager,
    variableEngine: VariableEngine,
    clientConfig?: ClientConfig
  ) {
    this.configManager = configManager;
    this.variableEngine = variableEngine;
    this.httpClient = new ApicizeClient(clientConfig);
  }

  /**
   * Execute a request using configuration and variable substitution
   */
  async executeRequest(request: Request, options: RequestOptions = {}): Promise<ApicizeResponse> {
    try {
      // Load current configuration
      const config = await this.configManager.loadBaseConfig();

      // Prepare the request config with variable substitution
      const requestConfig = await this.prepareRequestConfig(
        request,
        config.settings.defaultTimeout
      );

      // Merge request options with config defaults
      const finalOptions: RequestOptions = {
        timeout: request.timeout || config.settings.defaultTimeout,
        maxRedirects: request.numberOfRedirects,
        acceptInvalidCerts: request.acceptInvalidCerts,
        keepAlive: request.keepAlive,
        mode: request.mode,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        ...options,
      };

      // Execute the request
      return await this.httpClient.execute(requestConfig, finalOptions);
    } catch (error) {
      // Log error details if verbose logging is enabled
      const config = await this.configManager.loadBaseConfig();
      if (config.settings.verboseLogging) {
        console.error('Request execution failed:', error);
      }
      throw error;
    }
  }

  /**
   * Execute a simple request config (for testing purposes)
   */
  async execute(
    requestConfig: RequestConfig,
    options: RequestOptions = {}
  ): Promise<ApicizeResponse> {
    // Apply variable substitution to the request config
    const processedConfig = this.processRequestConfig(requestConfig);

    return await this.httpClient.execute(processedConfig, options);
  }

  /**
   * Prepare a full Request object for execution
   */
  private async prepareRequestConfig(
    request: Request,
    defaultTimeout: number
  ): Promise<RequestConfig> {
    // Substitute variables in URL
    const url = this.variableEngine.substituteString(request.url);

    // Process headers with variable substitution
    const headers = this.processHeaders(request.headers);

    // Process query parameters with variable substitution
    const queryParams = this.processQueryParams(request.queryStringParams);

    // Append query parameters to URL if they exist
    const finalUrl = this.buildUrlWithQuery(url, queryParams);

    // Process body with variable substitution
    const body = this.processBody(request.body);

    return {
      url: finalUrl,
      method: request.method,
      headers,
      body,
      timeout: request.timeout || defaultTimeout,
    };
  }

  /**
   * Process a RequestConfig with variable substitution
   */
  private processRequestConfig(requestConfig: RequestConfig): RequestConfig {
    const processedConfig = { ...requestConfig };

    // Substitute variables in URL
    if (processedConfig.url) {
      processedConfig.url = this.variableEngine.substituteString(processedConfig.url);
    }

    // Process headers
    if (processedConfig.headers) {
      if (Array.isArray(processedConfig.headers)) {
        processedConfig.headers = this.processHeaders(processedConfig.headers);
      } else {
        // Convert object headers to processed object
        const processedHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(processedConfig.headers)) {
          processedHeaders[key] = this.variableEngine.substituteString(value);
        }
        processedConfig.headers = processedHeaders;
      }
    }

    // Process body
    if (processedConfig.body) {
      if (typeof processedConfig.body === 'string') {
        // Handle string bodies directly
        processedConfig.body = this.variableEngine.substituteString(processedConfig.body);
      } else if (typeof processedConfig.body === 'object' && 'type' in processedConfig.body) {
        // Handle structured bodies
        processedConfig.body = this.processBody(processedConfig.body);
      } else if (typeof processedConfig.body === 'object') {
        // Handle plain object bodies
        processedConfig.body = this.variableEngine.substitute(processedConfig.body) as Record<
          string,
          unknown
        >;
      }
    }

    return processedConfig;
  }

  /**
   * Process headers with variable substitution
   */
  private processHeaders(headers?: NameValuePair[]): NameValuePair[] {
    if (!headers) return [];

    return headers.map(header => ({
      ...header,
      name: this.variableEngine.substituteString(header.name),
      value: this.variableEngine.substituteString(header.value),
    }));
  }

  /**
   * Process query parameters with variable substitution
   */
  private processQueryParams(queryParams?: NameValuePair[]): NameValuePair[] {
    if (!queryParams) return [];

    return queryParams
      .filter(param => !param.disabled)
      .map(param => ({
        ...param,
        name: this.variableEngine.substituteString(param.name),
        value: this.variableEngine.substituteString(param.value),
      }));
  }

  /**
   * Build URL with query parameters
   */
  private buildUrlWithQuery(url: string, queryParams: NameValuePair[]): string {
    if (queryParams.length === 0) return url;

    const urlObj = new URL(url);
    queryParams.forEach(param => {
      urlObj.searchParams.append(param.name, param.value);
    });

    return urlObj.toString();
  }

  /**
   * Process request body with variable substitution
   */
  private processBody(body?: any): any {
    if (!body) return undefined;

    // If it's not a structured body type, try to substitute as unknown
    if (typeof body !== 'object' || !('type' in body)) {
      return this.variableEngine.substitute(body);
    }

    // Process structured body types
    const processedBody = { ...body };

    switch (processedBody.type) {
      case BodyType.None:
        return processedBody;

      case BodyType.Text:
        if (processedBody.data) {
          processedBody.data = this.variableEngine.substituteString(processedBody.data);
        }
        break;

      case BodyType.JSON:
        if (processedBody.data) {
          processedBody.data = this.variableEngine.substitute(processedBody.data);
        }
        break;

      case BodyType.XML:
        if (processedBody.data) {
          processedBody.data = this.variableEngine.substituteString(processedBody.data);
        }
        break;

      case BodyType.Form:
        if (processedBody.data && Array.isArray(processedBody.data)) {
          processedBody.data = processedBody.data.map((pair: NameValuePair) => ({
            ...pair,
            name: this.variableEngine.substituteString(pair.name),
            value: this.variableEngine.substituteString(pair.value),
          }));
        }
        break;

      case BodyType.Raw:
        // Raw data (Uint8Array) typically doesn't need variable substitution
        break;

      default:
        // For unknown types, try generic substitution
        if (processedBody.data) {
          processedBody.data = this.variableEngine.substitute(processedBody.data);
        }
    }

    return processedBody;
  }

  /**
   * Get the underlying HTTP client
   */
  getHttpClient(): ApicizeClient {
    return this.httpClient;
  }

  /**
   * Get the configuration manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get the variable engine
   */
  getVariableEngine(): VariableEngine {
    return this.variableEngine;
  }

  /**
   * Update the variable engine context
   */
  updateVariables(variables: Record<string, unknown>): void {
    this.variableEngine.setOutputs(variables);
  }

  /**
   * Add a single output variable
   */
  addOutput(key: string, value: unknown): void {
    this.variableEngine.addOutput(key, value);
  }

  /**
   * Get all warnings from variable substitution
   */
  getWarnings(): string[] {
    return this.variableEngine.getWarnings();
  }

  /**
   * Clear all warnings
   */
  clearWarnings(): void {
    this.variableEngine.clearWarnings();
  }

  /**
   * Create a new integrated client with different configuration
   */
  withConfig(clientConfig: Partial<ClientConfig>): IntegratedApicizeClient {
    const newHttpClient = this.httpClient.withConfig(clientConfig);
    const newIntegratedClient = new IntegratedApicizeClient(
      this.configManager,
      this.variableEngine,
      newHttpClient.getConfig()
    );
    return newIntegratedClient;
  }
}
