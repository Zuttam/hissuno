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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
