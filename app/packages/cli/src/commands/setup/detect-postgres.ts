import { select, input } from '@inquirer/prompts'
import { commandExists, exec, execStream } from '../../lib/exec.js'
import { log } from '../../lib/log.js'

export interface PostgresResult {
  databaseUrl: string
  needsCreateDb: boolean
  isDocker: boolean
}

export async function detectPostgres(): Promise<PostgresResult> {
  const hasPsql = await commandExists('psql')

  if (hasPsql) {
    return handleExistingPostgres()
  }

  return handleMissingPostgres()
}

async function handleExistingPostgres(): Promise<PostgresResult> {
  log.success('PostgreSQL found')

  const choice = await select({
    message: 'How would you like to connect to PostgreSQL?',
    choices: [
      { name: 'Use local PostgreSQL (default)', value: 'local' },
      { name: 'Enter DATABASE_URL manually', value: 'manual' },
    ],
  })

  if (choice === 'manual') {
    return promptManualUrl()
  }

  const databaseUrl = await input({
    message: 'DATABASE_URL:',
    default: 'postgresql://localhost:5432/hissuno',
  })

  return { databaseUrl, needsCreateDb: true, isDocker: false }
}

async function handleMissingPostgres(): Promise<PostgresResult> {
  log.warn('PostgreSQL not found on PATH')

  const choices: Array<{ name: string; value: string }> = []

  const hasBrew = await commandExists('brew')
  const hasApt = await commandExists('apt-get')
  const hasDocker = await commandExists('docker')

  if (hasBrew) {
    choices.push({ name: 'Install via Homebrew (macOS)', value: 'brew' })
  }
  if (hasApt) {
    choices.push({ name: 'Install via apt-get (Linux)', value: 'apt' })
  }
  if (hasDocker) {
    choices.push({ name: 'Run via Docker', value: 'docker' })
  }
  choices.push({ name: 'Enter DATABASE_URL manually', value: 'manual' })

  const choice = await select({
    message: 'How would you like to set up PostgreSQL?',
    choices,
  })

  switch (choice) {
    case 'brew':
      return installViaBrew()
    case 'apt':
      return installViaApt()
    case 'docker':
      return installViaDocker()
    default:
      return promptManualUrl()
  }
}

async function installViaBrew(): Promise<PostgresResult> {
  log.info('Installing PostgreSQL via Homebrew...')
  await execStream('brew', ['install', 'postgresql@15'])
  await execStream('brew', ['install', 'pgvector'])
  await execStream('brew', ['services', 'start', 'postgresql@15'])
  log.success('PostgreSQL installed and started')

  const databaseUrl = await input({
    message: 'DATABASE_URL:',
    default: 'postgresql://localhost:5432/hissuno',
  })

  return { databaseUrl, needsCreateDb: true, isDocker: false }
}

async function installViaApt(): Promise<PostgresResult> {
  log.info('Installing PostgreSQL via apt-get...')
  await execStream('sudo', ['apt-get', 'install', '-y', 'postgresql-15', 'postgresql-15-pgvector'])
  log.success('PostgreSQL installed')

  const databaseUrl = await input({
    message: 'DATABASE_URL:',
    default: 'postgresql://localhost:5432/hissuno',
  })

  return { databaseUrl, needsCreateDb: true, isDocker: false }
}

async function installViaDocker(): Promise<PostgresResult> {
  log.info('Starting PostgreSQL via Docker...')

  // Check if container already exists
  try {
    const { stdout } = await exec('docker', ['ps', '-a', '--filter', 'name=hissuno-postgres', '--format', '{{.Names}}'])
    if (stdout.trim() === 'hissuno-postgres') {
      log.info('Container "hissuno-postgres" already exists, starting it...')
      await execStream('docker', ['start', 'hissuno-postgres'])
    } else {
      await execStream('docker', ['run', '-d',
        '--name', 'hissuno-postgres',
        '-e', 'POSTGRES_USER=hissuno',
        '-e', 'POSTGRES_PASSWORD=hissuno',
        '-e', 'POSTGRES_DB=hissuno',
        '-p', '5432:5432',
        'pgvector/pgvector:pg16',
      ])
    }
  } catch {
    await execStream('docker', ['run', '-d',
      '--name', 'hissuno-postgres',
      '-e', 'POSTGRES_USER=hissuno',
      '-e', 'POSTGRES_PASSWORD=hissuno',
      '-e', 'POSTGRES_DB=hissuno',
      '-p', '5432:5432',
      'pgvector/pgvector:pg16',
    ])
  }

  log.success('PostgreSQL running in Docker')

  return {
    databaseUrl: 'postgresql://hissuno:hissuno@localhost:5432/hissuno',
    needsCreateDb: false,
    isDocker: true,
  }
}

async function promptManualUrl(): Promise<PostgresResult> {
  const databaseUrl = await input({
    message: 'Enter your DATABASE_URL:',
    validate: (val) => {
      if (!val.startsWith('postgresql://') && !val.startsWith('postgres://')) {
        return 'URL must start with postgresql:// or postgres://'
      }
      return true
    },
  })

  return { databaseUrl, needsCreateDb: false, isDocker: false }
}
