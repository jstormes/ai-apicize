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
    '^@apicize/tools(.*)$': '<rootDir>/packages/tools/src$1',
    '^@apicize/examples(.*)$': '<rootDir>/packages/examples/src$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  // Test project specific configuration
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/packages/**/__tests__/**/*.ts',
        '<rootDir>/packages/**/?(*.)+(spec|test).ts'
      ],
      testTimeout: 10000
    },
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.ts'
      ],
      testTimeout: 120000, // 2 minutes for integration tests
      maxWorkers: 1, // Run integration tests sequentially
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'performance',
      testMatch: [
        '<rootDir>/tests/performance/**/*.test.ts'
      ],
      testTimeout: 300000, // 5 minutes for performance tests
      maxWorkers: 1, // Run performance tests sequentially
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    }
  ]
};