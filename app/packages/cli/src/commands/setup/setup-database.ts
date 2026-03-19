import path from 'node:path'
import { exec, execStream } from '../../lib/exec.js'
import { log } from '../../lib/log.js'
import type { PostgresResult } from './detect-postgres.js'

export interface SetupDatabaseOptions {
  databaseUrl: string
  needsCreateDb?: boolean
  isDocker?: boolean
}

export async function setupDatabase(appDir: string, opts: SetupDatabaseOptions | PostgresResult): Promise<void> {
  const { databaseUrl, needsCreateDb = false, isDocker = false } = opts as SetupDatabaseOptions

  // Create database if needed
  if (needsCreateDb) {
    const dbName = extractDbName(databaseUrl)
    log.info(`Creating database "${dbName}"...`)
    try {
      await exec('createdb', [dbName])
      log.success(`Database "${dbName}" created`)
    } catch (err: any) {
      if (err.stderr?.includes('already exists')) {
        log.info(`Database "${dbName}" already exists`)
      } else {
        throw err
      }
    }
  }

  // Enable pgvector extension
  log.info('Enabling pgvector extension...')
  if (isDocker) {
    await exec('docker', [
      'exec', 'hissuno-postgres',
      'psql', '-U', 'hissuno', '-d', 'hissuno',
      '-c', 'CREATE EXTENSION IF NOT EXISTS vector;',
    ])
  } else {
    await exec('psql', [databaseUrl, '-c', 'CREATE EXTENSION IF NOT EXISTS vector;'])
  }

  // Verify pgvector
  let hasVector = false
  try {
    let stdout: string
    if (isDocker) {
      const result = await exec('docker', [
        'exec', 'hissuno-postgres',
        'psql', '-U', 'hissuno', '-d', 'hissuno',
        '-tAc', "SELECT 1 FROM pg_extension WHERE extname = 'vector';",
      ])
      stdout = result.stdout
    } else {
      const result = await exec('psql', [
        databaseUrl, '-tAc', "SELECT 1 FROM pg_extension WHERE extname = 'vector';",
      ])
      stdout = result.stdout
    }
    hasVector = stdout.trim() === '1'
  } catch {
    // verification query failed
  }

  if (!hasVector) {
    throw new Error(
      'pgvector extension could not be enabled. ' +
      'Install pgvector for your PostgreSQL version: https://github.com/pgvector/pgvector#installation'
    )
  }
  log.success('pgvector enabled')

  // Run drizzle-kit migrate
  log.info('Applying database migrations...')
  const drizzleKit = path.join(appDir, 'node_modules', '.bin', 'drizzle-kit')
  await execStream(drizzleKit, ['migrate'], {
    cwd: appDir,
    env: { DATABASE_URL: databaseUrl },
  })
  log.success('Database migrations applied')
}

function extractDbName(url: string): string {
  const parsed = new URL(url)
  return parsed.pathname.slice(1) // remove leading /
}
