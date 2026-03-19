import path from 'path'
import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

// Only load env files locally - CI should inject env vars directly
if (!process.env.CI) {
  dotenv.config({ path: '.env.local' })
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/__tests__/**',
        'src/evals/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
