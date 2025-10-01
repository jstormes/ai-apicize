// Jest setup file
// Global test configuration and utilities

// Extend Jest matchers if needed
// import './custom-matchers';

// Global test timeout - 30 seconds default
jest.setTimeout(30000);

// Mock console methods for testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset console mocks before each test
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
