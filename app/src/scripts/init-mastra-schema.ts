/**
 * One-shot script to create the `mastra.*` tables used by the Mastra
 * memory/working-memory + workflow store.
 *
 * Run locally with:
 *   npx tsx src/scripts/init-mastra-schema.ts
 *
 * The PostgresStore is configured with `disableInit: true` so build workers
 * do not race on table creation. This script bypasses that by calling
 * `init()` once. After it succeeds, the chat-agent Memory wiring will read
 * and write `mastra.threads`, `mastra.messages`, `mastra.resources`, etc.
 */

import { PostgresStore } from '@mastra/pg'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set')
  }

  const storage = new PostgresStore({
    id: 'mastra-init',
    connectionString: process.env.DATABASE_URL,
    schemaName: 'mastra',
    max: 2,
  })

  await storage.init()
  console.log('Mastra schema initialized.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to init Mastra schema:', err)
  process.exit(1)
})
