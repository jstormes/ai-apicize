/**
 * Integration test helpers for testing component interactions
 * Part of Phase 3: Testing Improvements
 */

import { ApicizeWorkbook, RequestConfig } from '../types';
import { TestDoubleFactory } from './test-doubles';
import { TestDataFactory } from './builders';

/**
 * Integration test environment setup
 */
export class IntegrationTestEnvironment {
  private testDoubles: any;
  private cleanupFunctions: Array<() => void> = [];

  constructor() {
    this.testDoubles = TestDoubleFactory.createFullSuite();
  }

  /**
   * Setup the test environment
   */
  async setup(): Promise<void> {
    // Start console spy
    this.testDoubles.console.start();
    this.cleanupFunctions.push(() => this.testDoubles.console.stop());

    // Configure default test data
    this.setupDefaultFileSystem();
    this.setupDefaultHttpResponses();
    this.setupDefaultConfiguration();
  }

  /**
   * Cleanup the test environment
   */
  async cleanup(): Promise<void> {
    // Run all cleanup functions
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];

    // Clear all test doubles
    Object.values(this.testDoubles).forEach((testDouble: any) => {
      if (typeof testDouble.clear === 'function') {
        testDouble.clear();
      }
      if (typeof testDouble.reset === 'function') {
        testDouble.reset();
      }
    });
  }

  /**
   * Get test doubles for configuration
   */
  getTestDoubles(): any {
    return this.testDoubles;
  }

  /**
   * Setup default file system with common test files
   */
  private setupDefaultFileSystem(): void {
    const fs = this.testDoubles.fileSystem;

    // Add sample workbook
    const sampleWorkbook = TestDataFactory.createTestWorkbook();
    fs.addFile('/test/sample.apicize', JSON.stringify(sampleWorkbook, null, 2));

    // Add sample CSV data
    fs.addFile(
      '/test/users.csv',
      'id,name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com'
    );

    // Add sample JSON data
    fs.addFile('/test/config.json', '{"baseUrl": "https://api.test.com", "timeout": 5000}');

    // Add configuration files
    fs.addFile('/config/test.json', '{"environment": "test", "debug": true}');
  }

  /**
   * Setup default HTTP responses for common endpoints
   */
  private setupDefaultHttpResponses(): void {
    const http = this.testDoubles.httpClient;

    // Mock common API responses
    http.mockSuccess('https://api.example.com/users', { users: [] });
    http.mockSuccess('https://api.example.com/test', { success: true });
    http.mockError('https://api.example.com/error', 500, 'Internal Server Error');
  }

  /**
   * Setup default configuration
   */
  private setupDefaultConfiguration(): void {
    const config = this.testDoubles.configProvider;

    config.loadFrom({
      'test.timeout': 5000,
      'test.retries': 3,
      'test.environment': 'test',
      'api.baseUrl': 'https://api.test.com',
    });
  }
}

/**
 * Helper for testing complete workflows
 */
export class WorkflowTestHelper {
  private environment: IntegrationTestEnvironment;
  private results: any[] = [];

  constructor() {
    this.environment = new IntegrationTestEnvironment();
  }

  /**
   * Initialize the workflow test
   */
  async initialize(): Promise<void> {
    await this.environment.setup();
  }

  /**
   * Cleanup after workflow test
   */
  async cleanup(): Promise<void> {
    await this.environment.cleanup();
    this.results = [];
  }

  /**
   * Execute a request workflow
   */
  async executeRequestWorkflow(requests: RequestConfig[]): Promise<any[]> {
    const results: any[] = [];

    for (const request of requests) {
      try {
        // Simulate request execution with test doubles
        const response = await this.simulateRequest(request);
        results.push({ request, response, success: true });
      } catch (error) {
        results.push({ request, error, success: false });
      }
    }

    this.results.push(...results);
    return results;
  }

  /**
   * Execute a workbook workflow
   */
  async executeWorkbookWorkflow(workbook: ApicizeWorkbook): Promise<any> {
    const results = {
      workbook,
      requestResults: [] as any[],
      validationResults: [] as any[],
      executionTime: 0,
    };

    const startTime = this.environment.getTestDoubles().timeProvider.now();

    try {
      // Validate workbook structure
      results.validationResults = this.validateWorkbook(workbook);

      // Execute requests if validation passes
      if (results.validationResults.every((r: any) => r.valid)) {
        const requests = this.extractRequests(workbook);
        results.requestResults = await this.executeRequestWorkflow(requests);
      }
    } catch (error) {
      results.requestResults.push({ error, success: false });
    }

    results.executionTime = this.environment.getTestDoubles().timeProvider.now() - startTime;
    return results;
  }

  /**
   * Simulate request execution
   */
  private async simulateRequest(request: RequestConfig): Promise<any> {
    const http = this.environment.getTestDoubles().httpClient;
    const variables = this.environment.getTestDoubles().variableEngine;

    // Substitute variables in URL
    const url = variables.substitute(request.url);

    // Execute request through test double
    const response = await http.fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body
        ? typeof request.body === 'object' && 'data' in request.body
          ? JSON.stringify((request.body as any).data)
          : JSON.stringify(request.body)
        : undefined,
    });

    return {
      status: response.status,
      headers: response.headers,
      body: await response.json().catch(() => response.text()),
    };
  }

  /**
   * Validate workbook structure
   */
  private validateWorkbook(workbook: ApicizeWorkbook): any[] {
    const results: any[] = [];

    // Basic structure validation
    if (typeof workbook.version !== 'number') {
      results.push({ type: 'version', valid: false, message: 'Version must be a number' });
    } else {
      results.push({ type: 'version', valid: true });
    }

    // Requests validation
    if (workbook.requests && Array.isArray(workbook.requests)) {
      results.push({ type: 'requests', valid: true });
    } else {
      results.push({ type: 'requests', valid: false, message: 'Requests must be an array' });
    }

    return results;
  }

  /**
   * Extract requests from workbook for execution
   */
  private extractRequests(workbook: ApicizeWorkbook): RequestConfig[] {
    const requests: RequestConfig[] = [];

    const processItems = (items: any[]) => {
      for (const item of items) {
        if (item.url && item.method) {
          // This is a request
          requests.push({
            url: item.url,
            method: item.method,
            headers: item.headers || [],
            body: item.body,
            timeout: item.timeout,
          });
        } else if (item.children) {
          // This is a group, process children
          processItems(item.children);
        }
      }
    };

    if (workbook.requests) {
      processItems(workbook.requests);
    }

    return requests;
  }

  /**
   * Get all execution results
   */
  getResults(): any[] {
    return [...this.results];
  }

  /**
   * Get console logs from execution
   */
  getConsoleLogs(): any[] {
    return this.environment.getTestDoubles().console.getLogs();
  }
}

/**
 * Helper for testing component interactions
 */
export class ComponentInteractionHelper {
  private components: Map<string, any> = new Map();
  private interactions: Array<{ from: string; to: string; method: string; args: any[] }> = [];

  /**
   * Register a component for interaction testing
   */
  registerComponent(name: string, component: any): void {
    // Wrap component methods to track interactions
    const wrappedComponent = this.wrapComponentMethods(name, component);
    this.components.set(name, wrappedComponent);
  }

  /**
   * Get a registered component
   */
  getComponent(name: string): any {
    return this.components.get(name);
  }

  /**
   * Get all recorded interactions
   */
  getInteractions(): Array<{ from: string; to: string; method: string; args: any[] }> {
    return [...this.interactions];
  }

  /**
   * Clear interaction history
   */
  clearInteractions(): void {
    this.interactions = [];
  }

  /**
   * Verify specific interaction occurred
   */
  verifyInteraction(from: string, to: string, method: string): boolean {
    return this.interactions.some(
      interaction =>
        interaction.from === from && interaction.to === to && interaction.method === method
    );
  }

  /**
   * Get interactions between specific components
   */
  getInteractionsBetween(from: string, to: string): Array<{ method: string; args: any[] }> {
    return this.interactions
      .filter(interaction => interaction.from === from && interaction.to === to)
      .map(({ method, args }) => ({ method, args }));
  }

  /**
   * Wrap component methods to track interactions
   */
  private wrapComponentMethods(componentName: string, component: any): any {
    const wrapped = { ...component };

    // Find all methods on the component
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(component)).filter(
      name => typeof component[name] === 'function' && name !== 'constructor'
    );

    methods.forEach(methodName => {
      const originalMethod = component[methodName];
      wrapped[methodName] = (...args: any[]) => {
        // Record the interaction
        this.interactions.push({
          from: 'test',
          to: componentName,
          method: methodName,
          args: [...args],
        });

        // Call the original method
        return originalMethod.apply(component, args);
      };
    });

    return wrapped;
  }
}

/**
 * Helper for testing async operations and timing
 */
export class AsyncTestHelper {
  private timeProvider: any;
  private pendingPromises: Array<{ promise: Promise<any>; resolve: Function; reject: Function }> =
    [];

  constructor(timeProvider?: any) {
    this.timeProvider = timeProvider || TestDoubleFactory.createMinimal().timeProvider;
  }

  /**
   * Create a controllable promise
   */
  createControllablePromise<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
  } {
    let resolve: (value: T) => void;
    let reject: (error: any) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const controller = {
      promise,
      resolve: resolve!,
      reject: reject!,
    };

    this.pendingPromises.push(controller as any);
    return controller;
  }

  /**
   * Wait for all pending promises to resolve
   */
  async waitForPendingPromises(): Promise<void> {
    await Promise.allSettled(this.pendingPromises.map(p => p.promise));
    this.pendingPromises = [];
  }

  /**
   * Advance time and process timers
   */
  advanceTime(ms: number): void {
    this.timeProvider.advance(ms);
  }

  /**
   * Create a delayed promise that resolves after specified time
   */
  createDelayedPromise<T>(value: T, delay: number): Promise<T> {
    return new Promise(resolve => {
      this.timeProvider.setTimeout(() => resolve(value), delay);
    });
  }

  /**
   * Test race conditions by creating competing promises
   */
  createRaceCondition<T>(values: T[], delays: number[]): Promise<T>[] {
    return values.map((value, index) => this.createDelayedPromise(value, delays[index] || 0));
  }
}

/**
 * Main integration test suite factory
 */
export class IntegrationTestSuite {
  private environment: IntegrationTestEnvironment;
  private workflowHelper: WorkflowTestHelper;
  private componentHelper: ComponentInteractionHelper;
  private asyncHelper: AsyncTestHelper;

  constructor() {
    this.environment = new IntegrationTestEnvironment();
    this.workflowHelper = new WorkflowTestHelper();
    this.componentHelper = new ComponentInteractionHelper();
    this.asyncHelper = new AsyncTestHelper();
  }

  /**
   * Initialize the complete test suite
   */
  async initialize(): Promise<void> {
    await this.environment.setup();
    await this.workflowHelper.initialize();
  }

  /**
   * Cleanup the complete test suite
   */
  async cleanup(): Promise<void> {
    await this.workflowHelper.cleanup();
    await this.environment.cleanup();
    this.componentHelper.clearInteractions();
  }

  /**
   * Get all test helpers
   */
  getHelpers() {
    return {
      environment: this.environment,
      workflow: this.workflowHelper,
      components: this.componentHelper,
      async: this.asyncHelper,
    };
  }

  /**
   * Run a complete integration test scenario
   */
  async runScenario(name: string, scenario: (helpers: any) => Promise<void>): Promise<any> {
    const startTime = Date.now();
    const helpers = this.getHelpers();

    try {
      await scenario(helpers);

      return {
        name,
        success: true,
        duration: Date.now() - startTime,
        interactions: this.componentHelper.getInteractions(),
        consoleLogs: this.environment.getTestDoubles().console.getLogs(),
      };
    } catch (error) {
      return {
        name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        interactions: this.componentHelper.getInteractions(),
        consoleLogs: this.environment.getTestDoubles().console.getLogs(),
      };
    }
  }
}
