/**
 * Shared Mastra PostgresStore singleton.
 *
 * Cached on globalThis so we don't re-open the pg pool on every Next.js HMR
 * reload. `disableInit: true` keeps build workers from racing to create the
 * `mastra.*` tables in parallel - run scripts/init-mastra-schema.ts once after
 * adding the schema (or before rolling this out to a new environment).
 */

import { PostgresStore } from '@mastra/pg'

const globalForMastra = globalThis as unknown as {
  mastraStorage: PostgresStore | undefined
}

export const storage =
  globalForMastra.mastraStorage ??
  new PostgresStore({
    id: 'mastra-pg',
    connectionString: process.env.DATABASE_URL!,
    schemaName: 'mastra',
    disableInit: true,
    max: 5,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForMastra.mastraStorage = storage
}
