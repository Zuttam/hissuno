// One-off: apply migrations 0014 and 0015 directly. Drizzle-kit's interactive
// confirmation can't run in this non-TTY shell. Safe — these are the same SQL
// files committed to the migrations/ folder.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')
dotenv.config({ path: path.join(appRoot, '.env.local') })

const { Pool } = pg
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL missing in .env.local')

const pool = new Pool({ connectionString: url })
const migrationsDir = path.join(appRoot, 'src/lib/db/migrations')

const targets = [
  '0014_external_records.sql',
  '0015_drop_legacy_integration_sync.sql',
]

for (const file of targets) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
  try {
    await pool.query(sql)
    console.log(`Applied ${file}`)
  } catch (err) {
    console.error(`Failed ${file}:`, err.message)
    process.exit(1)
  }
}
await pool.end()
console.log('Done.')
