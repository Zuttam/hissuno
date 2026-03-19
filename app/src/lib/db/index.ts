import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as authSchema from './schema/auth'
import * as appSchema from './schema/app'
import * as relations from './schema/relations'

// HMR-safe singleton pattern (same as mastra/index.ts)
const globalForDb = globalThis as unknown as { dbPool: pg.Pool | undefined }

const pool =
  globalForDb.dbPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = pool
}

export const db = drizzle(pool, {
  schema: { ...authSchema, ...appSchema, ...relations },
})
