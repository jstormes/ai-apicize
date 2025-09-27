/**
 * Test doubles (stubs, mocks, fakes) for comprehensive testing
 * Part of Phase 3: Testing Improvements
 */

import { jest } from '@jest/globals';

/**
 * File system operations fake for testing
 */
export class FakeFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  /**
   * Add a file to the fake filesystem
   */
  addFile(path: string, content: string): void {
    this.files.set(path, content);
    // Add parent directories
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      this.directories.add(dir);
    }
  }

  /**
   * Add a directory to the fake filesystem
   */
  addDirectory(path: string): void {
    this.directories.add(path);
  }

  /**
   * Check if file exists
   */
  existsSync(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  /**
   * Read file content
   */
  readFileSync(path: string, _encoding?: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  /**
   * Write file content
   */
  writeFileSync(path: string, content: string): void {
    this.files.set(path, content);
    // Add parent directory
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      this.directories.add(dir);
    }
  }

  /**
   * List directory contents
   */
  readdirSync(path: string): string[] {
    const contents: string[] = [];

    // Add files in this directory
    for (const filePath of this.files.keys()) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dir === path) {
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        contents.push(fileName);
      }
    }

    // Add subdirectories
    for (const dirPath of this.directories) {
      const parentDir = dirPath.substring(0, dirPath.lastIndexOf('/'));
      if (parentDir === path) {
        const dirName = dirPath.substring(dirPath.lastIndexOf('/') + 1);
        contents.push(dirName);
      }
    }

    return contents;
  }

  /**
   * Clear all files and directories
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
  }

  /**
   * Get all files for inspection
   */
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }
}

/**
 * HTTP client stub with configurable responses
 */
export class HttpClientStub {
  private responses: Map<string, any> = new Map();
  private defaultResponse: any = {
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('{"success": true}'),
  };

  /**
   * Configure response for a specific URL pattern
   */
  whenUrl(pattern: string | RegExp, response: any): void {
    this.responses.set(pattern.toString(), response);
  }

  /**
   * Mock successful response
   */
  mockSuccess(url: string, data: any, status: number = 200): void {
    this.whenUrl(url, {
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  }

  /**
   * Mock error response
   */
  mockError(url: string, status: number, message: string): void {
    this.whenUrl(url, {
      status,
      headers: new Headers(),
      json: () => Promise.reject(new Error('Response not JSON')),
      text: () => Promise.resolve(message),
    });
  }

  /**
   * Mock network failure
   */
  mockNetworkError(url: string): void {
    this.whenUrl(url, () => Promise.reject(new Error('Network error')));
  }

  /**
   * Fetch implementation that checks for configured responses
   */
  async fetch(url: string, _init?: RequestInit): Promise<Response> {
    // Find matching response
    for (const [pattern, response] of this.responses) {
      const regex = new RegExp(pattern);
      if (regex.test(url)) {
        if (typeof response === 'function') {
          return response();
        }
        return response as Response;
      }
    }

    // Return default response
    return this.defaultResponse;
  }

  /**
   * Reset all configured responses
   */
  reset(): void {
    this.responses.clear();
  }

  /**
   * Get request history (requires wrapping with jest.fn)
   */
  getCallHistory(): any[] {
    if (jest.isMockFunction(this.fetch)) {
      return (this.fetch as jest.MockedFunction<any>).mock.calls;
    }
    return [];
  }
}

/**
 * Console spy for capturing log output
 */
export class ConsoleSpy {
  private logs: Array<{ level: string; args: any[] }> = [];
  private originalConsole: any;

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  /**
   * Start spying on console
   */
  start(): void {
    console.log = (...args) => this.capture('log', args);
    console.error = (...args) => this.capture('error', args);
    console.warn = (...args) => this.capture('warn', args);
    console.info = (...args) => this.capture('info', args);
    console.debug = (...args) => this.capture('debug', args);
  }

  /**
   * Stop spying and restore original console
   */
  stop(): void {
    Object.assign(console, this.originalConsole);
  }

  /**
   * Capture console output
   */
  private capture(level: string, args: any[]): void {
    this.logs.push({ level, args });
    // Still call original console for debugging
    this.originalConsole[level](...args);
  }

  /**
   * Get all captured logs
   */
  getLogs(): Array<{ level: string; args: any[] }> {
    return [...this.logs];
  }

  /**
   * Get logs of specific level
   */
  getLogsOfLevel(level: string): Array<{ level: string; args: any[] }> {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Check if specific message was logged
   */
  hasMessage(message: string, level?: string): boolean {
    return this.logs.some(log => {
      if (level && log.level !== level) return false;
      return log.args.some(arg => String(arg).includes(message));
    });
  }

  /**
   * Clear captured logs
   */
  clear(): void {
    this.logs = [];
  }
}

/**
 * Time provider for deterministic testing
 */
export class FakeTimeProvider {
  private currentTime: number;
  private timers: Map<number, { callback: Function; time: number }> = new Map();
  private nextTimerId = 1;

  constructor(initialTime: number = Date.now()) {
    this.currentTime = initialTime;
  }

  /**
   * Get current time
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Advance time by specified milliseconds
   */
  advance(ms: number): void {
    this.currentTime += ms;
    this.processTimers();
  }

  /**
   * Set absolute time
   */
  setTime(time: number): void {
    this.currentTime = time;
    this.processTimers();
  }

  /**
   * Create a timer
   */
  setTimeout(callback: Function, delay: number): number {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      callback,
      time: this.currentTime + delay,
    });
    return id;
  }

  /**
   * Clear a timer
   */
  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  /**
   * Process any timers that should fire
   */
  private processTimers(): void {
    const expiredTimers: number[] = [];

    for (const [id, timer] of this.timers) {
      if (timer.time <= this.currentTime) {
        expiredTimers.push(id);
      }
    }

    expiredTimers.forEach(id => {
      const timer = this.timers.get(id);
      if (timer) {
        this.timers.delete(id);
        timer.callback();
      }
    });
  }

  /**
   * Get Date object with fake time
   */
  getDate(): Date {
    return new Date(this.currentTime);
  }
}

/**
 * Configuration provider fake
 */
export class FakeConfigProvider {
  private configs: Map<string, any> = new Map();

  /**
   * Set configuration value
   */
  set(key: string, value: any): void {
    this.configs.set(key, value);
  }

  /**
   * Get configuration value
   */
  get(key: string, defaultValue?: any): any {
    return this.configs.get(key) ?? defaultValue;
  }

  /**
   * Check if configuration exists
   */
  has(key: string): boolean {
    return this.configs.has(key);
  }

  /**
   * Clear all configurations
   */
  clear(): void {
    this.configs.clear();
  }

  /**
   * Load configurations from object
   */
  loadFrom(config: Record<string, any>): void {
    for (const [key, value] of Object.entries(config)) {
      this.configs.set(key, value);
    }
  }
}

/**
 * Variable engine fake for testing variable substitution
 */
export class FakeVariableEngine {
  private variables: Map<string, string> = new Map();

  /**
   * Set variable value
   */
  setVariable(name: string, value: string): void {
    this.variables.set(name, value);
  }

  /**
   * Set multiple variables
   */
  setVariables(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      this.variables.set(name, value);
    }
  }

  /**
   * Substitute variables in text
   */
  substitute(text: string): string {
    let result = text;
    for (const [name, value] of this.variables) {
      const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
    return result;
  }

  /**
   * Clear all variables
   */
  clear(): void {
    this.variables.clear();
  }

  /**
   * Get all variables
   */
  getAllVariables(): Record<string, string> {
    return Object.fromEntries(this.variables);
  }
}

/**
 * Auth provider mock
 */
export class MockAuthProvider {
  private tokens: Map<string, string> = new Map();
  private shouldFail = false;

  /**
   * Configure to return specific token for credentials
   */
  mockToken(identifier: string, token: string): void {
    this.tokens.set(identifier, token);
  }

  /**
   * Configure authentication to fail
   */
  mockFailure(): void {
    this.shouldFail = true;
  }

  /**
   * Reset to success mode
   */
  mockSuccess(): void {
    this.shouldFail = false;
  }

  /**
   * Get authentication headers (mock implementation)
   */
  async getHeaders(credentials: any): Promise<Record<string, string>> {
    if (this.shouldFail) {
      throw new Error('Authentication failed');
    }

    const token = this.tokens.get(credentials.identifier) || 'mock-token';
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Clear all tokens
   */
  clear(): void {
    this.tokens.clear();
    this.shouldFail = false;
  }
}

/**
 * Factory for creating test doubles
 */
export class TestDoubleFactory {
  /**
   * Create a complete set of test doubles for integration testing
   */
  static createFullSuite() {
    return {
      fileSystem: new FakeFileSystem(),
      httpClient: new HttpClientStub(),
      console: new ConsoleSpy(),
      timeProvider: new FakeTimeProvider(),
      configProvider: new FakeConfigProvider(),
      variableEngine: new FakeVariableEngine(),
      authProvider: new MockAuthProvider(),
    };
  }

  /**
   * Create minimal set for unit testing
   */
  static createMinimal() {
    return {
      httpClient: new HttpClientStub(),
      timeProvider: new FakeTimeProvider(),
    };
  }
}
