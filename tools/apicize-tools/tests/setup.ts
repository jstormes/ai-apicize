// Jest setup file
// Global test configuration and utilities

import { ConsoleManager } from '../packages/lib/src/test-utils/console';

// Extend Jest matchers if needed
// import './custom-matchers';

// Global test timeout
jest.setTimeout(10000);

// Global console manager
const consoleManager = new ConsoleManager();

// Store original global objects for cleanup
const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

// Track active timers and intervals for cleanup
const activeTimers = new Set<NodeJS.Timeout>();
const activeIntervals = new Set<NodeJS.Timeout>();

// Override timer functions to track them
global.setTimeout = ((callback: any, delay?: number, ...args: any[]) => {
  const timer = originalSetTimeout(callback, delay, ...args);
  activeTimers.add(timer);
  return timer;
}) as typeof setTimeout;

global.setInterval = ((callback: any, delay?: number, ...args: any[]) => {
  const interval = originalSetInterval(callback, delay, ...args);
  activeIntervals.add(interval);
  return interval;
}) as typeof setInterval;

global.clearTimeout = (timer: string | number | NodeJS.Timeout | undefined) => {
  if (timer && typeof timer === 'object') {
    activeTimers.delete(timer);
    originalClearTimeout(timer);
  } else if (timer) {
    originalClearTimeout(timer as any);
  }
};

global.clearInterval = (interval: string | number | NodeJS.Timeout | undefined) => {
  if (interval && typeof interval === 'object') {
    activeIntervals.delete(interval);
    originalClearInterval(interval);
  } else if (interval) {
    originalClearInterval(interval as any);
  }
};

// Mock console methods for testing
beforeEach(() => {
  // Mock error and warn by default, but allow tests to override
  consoleManager.mock('error', 'warn');
});

afterEach(() => {
  // Check for unexpected console errors/warnings
  const errorCalls = (console.error as jest.MockedFunction<typeof console.error>).mock.calls;
  const warnCalls = (console.warn as jest.MockedFunction<typeof console.warn>).mock.calls;

  // Clean up any remaining timers and intervals
  activeTimers.forEach(timer => {
    originalClearTimeout(timer);
  });
  activeTimers.clear();

  activeIntervals.forEach(interval => {
    originalClearInterval(interval);
  });
  activeIntervals.clear();

  // Only restore fetch if it hasn't been mocked by the test
  // Check if fetch is a Jest mock function, if so, leave it alone
  if (
    global.fetch &&
    typeof global.fetch === 'function' &&
    !(global.fetch as any)._isMockFunction
  ) {
    global.fetch = originalFetch;
  }

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

// Global cleanup when all tests are done
afterAll(() => {
  // Final cleanup of any remaining resources
  activeTimers.forEach(timer => originalClearTimeout(timer));
  activeTimers.clear();

  activeIntervals.forEach(interval => originalClearInterval(interval));
  activeIntervals.clear();

  // Restore original global functions
  global.setTimeout = originalSetTimeout;
  global.setInterval = originalSetInterval;
  global.clearTimeout = originalClearTimeout;
  global.clearInterval = originalClearInterval;
  global.fetch = originalFetch;
});

// Export for use in tests if needed
export { consoleManager };
