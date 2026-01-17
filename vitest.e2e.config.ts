import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/e2e/setup.ts'],
    include: ['tests/e2e/**/*.test.ts', 'tests/e2e/**/*.spec.ts'],
    testTimeout: 120000, // E2E tests need more time
    hookTimeout: 60000,
    bail: 1, // Stop on first error for e2e tests
    sequence: {
      shuffle: false // Run e2e tests in order
    }
  },
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer/src'),
      '@': path.resolve(__dirname, './src')
    }
  }
})
