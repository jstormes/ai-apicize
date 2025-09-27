module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'packages/**/*.ts',
    '!packages/**/*.d.ts',
    '!packages/**/index.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  moduleNameMapper: {
    '^@apicize/lib(.*)$': '<rootDir>/packages/lib/src$1',
    '^@apicize/tools(.*)$': '<rootDir>/packages/tools/src$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  // Force exit to prevent hanging processes
  forceExit: true,
  // Detect open handles
  detectOpenHandles: true,
  // Clear mocks and timers after each test
  clearMocks: true,
  restoreMocks: true,
  // Limit number of workers to reduce resource contention
  maxWorkers: 1
};