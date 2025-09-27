// Jest setup file
// Global test configuration and utilities

import { ConsoleManager } from '../packages/lib/src/test-utils/console';

// Extend Jest matchers if needed
// import './custom-matchers';

// Global test timeout
jest.setTimeout(10000);

// Global console manager
const consoleManager = new ConsoleManager();

// Mock console methods for testing
beforeEach(() => {
  // Mock error and warn by default, but allow tests to override
  consoleManager.mock('error', 'warn');
});

afterEach(() => {
  // Check for unexpected console errors/warnings
  const errorCalls = (console.error as jest.MockedFunction<typeof console.error>).mock.calls;
  const warnCalls = (console.warn as jest.MockedFunction<typeof console.warn>).mock.calls;

  // Restore console methods
  consoleManager.restoreAll();

  // Report unexpected console output after restoration
  if (errorCalls.length > 0 && process.env.NODE_ENV !== 'test:quiet') {
    const errors = errorCalls.map(args => args.join(' ')).join('\n');
    console.error(`⚠️  Test produced ${errorCalls.length} console error(s):\n${errors}`);
  }

  if (warnCalls.length > 0 && process.env.NODE_ENV !== 'test:quiet') {
    const warnings = warnCalls.map(args => args.join(' ')).join('\n');
    console.warn(`⚠️  Test produced ${warnCalls.length} console warning(s):\n${warnings}`);
  }

  // Clear all mocks for next test
  consoleManager.clearAll();
});

// Export for use in tests if needed
export { consoleManager };
