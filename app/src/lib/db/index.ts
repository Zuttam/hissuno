import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as authSchema from './schema/auth'
import * as appSchema from './schema/app'
import * as relations from './schema/relations'

// HMR-safe singleton pattern (same as mastra/index.ts)
const globalForDb = globalThis as unknown as { dbPool: pg.Pool | undefined }

function createPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
  })
  // Force every connection to UTC so `defaultNow()` and JS `new Date()` writes
  // both land as UTC wall-clock values in naked-timestamp columns. Without
  // this, `now()` records the postgres session's local time, which Drizzle's
  // mode:'date' reads back as if it were UTC.
  pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'UTC'").catch((err) => {
      console.error('[db] failed to set session TZ to UTC', err)
    })
  })
  return pool
}

const pool = globalForDb.dbPool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = pool
}

export const db = drizzle(pool, {
  schema: { ...authSchema, ...appSchema, ...relations },
})
