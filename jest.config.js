module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2020'
      },
      module: { type: 'commonjs' }
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Coverage thresholds - can be enforced when more files are tested
  coverageThreshold: {
    // Uncomment when ready to enforce coverage
    // global: {
    //   branches: 50,
    //   functions: 50,
    //   lines: 50,
    //   statements: 50
    // },
    // Specific thresholds for tested files
    'src/io.ts': {
      branches: 85,
      functions: 100,
      lines: 94,
      statements: 94
    }
  },
  // CI environment optimization
  maxWorkers: process.env.CI ? 1 : '50%',
  verbose: true
};
