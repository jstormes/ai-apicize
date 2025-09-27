import { jest } from '@jest/globals';

export interface ConsoleMock {
  error: jest.MockedFunction<typeof console.error>;
  warn: jest.MockedFunction<typeof console.warn>;
  info: jest.MockedFunction<typeof console.info>;
  log: jest.MockedFunction<typeof console.log>;
  debug: jest.MockedFunction<typeof console.debug>;
}

export class ConsoleManager {
  private originalConsole: {
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    log: typeof console.log;
    debug: typeof console.debug;
  };

  private mocks: ConsoleMock;

  constructor() {
    this.originalConsole = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      log: console.log,
      debug: console.debug,
    };

    this.mocks = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    };
  }

  /**
   * Mock all console methods
   */
  mockAll(): ConsoleMock {
    console.error = this.mocks.error;
    console.warn = this.mocks.warn;
    console.info = this.mocks.info;
    console.log = this.mocks.log;
    console.debug = this.mocks.debug;
    return this.mocks;
  }

  /**
   * Mock specific console methods
   */
  mock(...methods: Array<keyof ConsoleMock>): Partial<ConsoleMock> {
    const result: Partial<ConsoleMock> = {};
    for (const method of methods) {
      console[method] = this.mocks[method];
      result[method] = this.mocks[method];
    }
    return result;
  }

  /**
   * Restore all console methods
   */
  restoreAll(): void {
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.log = this.originalConsole.log;
    console.debug = this.originalConsole.debug;
  }

  /**
   * Restore specific console methods
   */
  restore(...methods: Array<keyof ConsoleMock>): void {
    for (const method of methods) {
      console[method] = this.originalConsole[method];
    }
  }

  /**
   * Clear all mock calls
   */
  clearAll(): void {
    this.mocks.error.mockClear();
    this.mocks.warn.mockClear();
    this.mocks.info.mockClear();
    this.mocks.log.mockClear();
    this.mocks.debug.mockClear();
  }

  /**
   * Get all console calls of a specific type
   */
  getCalls(method: keyof ConsoleMock): any[][] {
    return this.mocks[method].mock.calls;
  }

  /**
   * Assert no console errors were logged
   */
  assertNoErrors(): void {
    const errorCalls = this.mocks.error.mock.calls;
    if (errorCalls.length > 0) {
      throw new Error(
        `Expected no console errors but found ${errorCalls.length}:\n` +
        errorCalls.map(args => args.join(' ')).join('\n')
      );
    }
  }

  /**
   * Assert no console warnings were logged
   */
  assertNoWarnings(): void {
    const warnCalls = this.mocks.warn.mock.calls;
    if (warnCalls.length > 0) {
      throw new Error(
        `Expected no console warnings but found ${warnCalls.length}:\n` +
        warnCalls.map(args => args.join(' ')).join('\n')
      );
    }
  }

  /**
   * Assert specific console output
   */
  assertOutput(method: keyof ConsoleMock, expectedOutput: any): void {
    const calls = this.mocks[method].mock.calls;
    const found = calls.some(args =>
      args.some(arg => {
        if (typeof expectedOutput === 'string' && typeof arg === 'string') {
          return arg.includes(expectedOutput);
        }
        return arg === expectedOutput;
      })
    );

    if (!found) {
      throw new Error(
        `Expected console.${method} to be called with "${expectedOutput}" but it was not found.\n` +
        `Actual calls: ${JSON.stringify(calls)}`
      );
    }
  }
}

/**
 * Create a console manager instance for use in tests
 */
export function createConsoleManager(): ConsoleManager {
  return new ConsoleManager();
}

/**
 * Suppress console output during test execution
 */
export function suppressConsole(): () => void {
  const manager = new ConsoleManager();
  manager.mockAll();
  return () => manager.restoreAll();
}

/**
 * Capture console output during test execution
 */
export function captureConsole() {
  const manager = new ConsoleManager();
  const mocks = manager.mockAll();

  return {
    mocks,
    restore: () => manager.restoreAll(),
    getOutput: () => ({
      errors: mocks.error.mock.calls,
      warnings: mocks.warn.mock.calls,
      info: mocks.info.mock.calls,
      logs: mocks.log.mock.calls,
      debug: mocks.debug.mock.calls,
    }),
    assertNoErrors: () => manager.assertNoErrors(),
    assertNoWarnings: () => manager.assertNoWarnings(),
  };
}