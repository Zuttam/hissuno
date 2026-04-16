/**
 * hissuno setup - Infrastructure wizard
 *
 * Full setup flow for new Hissuno instances:
 *   1. check-node    - Check prerequisites (Node.js 20+, git)
 *   2. clone         - Clone repository
 *   3. install       - Install dependencies
 *   4. build         - Build widget
 *   5. postgres      - Detect/install PostgreSQL
 *   6. env           - Configure .env.local
 *   7. database      - Push database schema
 *   8. seed          - Seed demo data (optional)
 *   9. config        - Auto-configure CLI (optional, if seed produced an API key)
 *  10. start         - Start server or print next steps
 *
 * Subcommands:
 *   hissuno setup oauth [platform] - Configure OAuth credentials for an integration
 *
 * Options:
 *   --from <step>   Resume from a specific step
 *   --only <steps>  Run only the specified steps (comma-separated)
 */

import fs from 'node:fs'
import path from 'node:path'
import { Command } from 'commander'
import { log } from '../lib/log.js'
import { checkNode } from './setup/check-node.js'
import { cloneRepo } from './setup/clone.js'
import { installDeps, buildWidget } from './setup/install.js'
import { detectPostgres } from './setup/detect-postgres.js'
import { configureEnv } from './setup/configure-env.js'
import { setupDatabase } from './setup/setup-database.js'
import { seedDatabase } from './setup/seed.js'
import { createConfig } from './setup/create-config.js'
import { startServer } from './setup/start.js'
import { setupOAuth, OAUTH_PLATFORM_NAMES } from './setup/setup-oauth.js'

export const STEP_NAMES = [
  'check-node',
  'clone',
  'install',
  'build',
  'postgres',
  'env',
  'database',
  'seed',
  'config',
  'start',
] as const

export type StepName = (typeof STEP_NAMES)[number]

function resolveAppDir(): string {
  return path.join(path.resolve('hissuno'), 'app')
}

function resolveDatabaseUrl(appDir: string, envFile: string): string | undefined {
  // 1. Check environment variable
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  // 2. Read from env file
  const envPath = path.join(appDir, envFile)
  try {
    const content = fs.readFileSync(envPath, 'utf-8')
    const match = content.match(/^DATABASE_URL=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    // env file doesn't exist
  }

  return undefined
}

function shouldRun(
  step: StepName,
  from: StepName | undefined,
  only: Set<StepName> | undefined,
): boolean {
  if (only) return only.has(step)
  if (!from) return true
  return STEP_NAMES.indexOf(step) >= STEP_NAMES.indexOf(from)
}

function parseSteps(raw: string): Set<StepName> {
  const steps = new Set<StepName>()
  for (const s of raw.split(',')) {
    const trimmed = s.trim() as StepName
    if (!STEP_NAMES.includes(trimmed)) {
      throw new Error(`Unknown step "${trimmed}". Valid steps: ${STEP_NAMES.join(', ')}`)
    }
    steps.add(trimmed)
  }
  return steps
}

export const setupCommand = new Command('setup')
  .description('Set up a new Hissuno instance (clone, install, configure)')
  .option('--from <step>', `Resume from a step: ${STEP_NAMES.join(', ')}`)
  .option('--only <steps>', 'Run only specific steps (comma-separated)')
  .option('--app-dir <dir>', 'Path to the app directory (default: ./hissuno/app)')
  .option('--env <environment>', 'Target environment (determines env file: .env.<environment>)')
  .option('--database-url <url>', 'PostgreSQL connection URL')
  .option('--postgres-method <method>', 'How to set up PostgreSQL: brew, apt, docker, manual')
  .option('--app-url <url>', 'Application URL (default: http://localhost:3000)')
  .option('--openai-key <key>', 'OpenAI API key (omit to skip)')
  .option('--seed', 'Seed with demo data')
  .option('--no-seed', 'Skip seeding with demo data')
  .option('--auto-config', 'Auto-configure CLI with generated API key')
  .option('--no-auto-config', 'Skip auto-configuring CLI')
  .option('--start', 'Start server after setup')
  .option('--no-start', 'Skip starting server after setup')

// --- oauth subcommand ---
setupCommand
  .command('oauth')
  .argument('[platform]', `Integration: ${OAUTH_PLATFORM_NAMES.join(', ')}`)
  .description('Configure OAuth credentials for an integration')
  .option('--client-id <id>', 'OAuth client ID')
  .option('--client-secret <secret>', 'OAuth client secret')
  .option('--app-slug <slug>', 'GitHub App slug')
  .option('--app-id <id>', 'GitHub App ID')
  .option('--private-key <key>', 'GitHub private key (base64)')
  .option('--app-dir <dir>', 'Path to the app directory (default: ./hissuno/app)')
  .action(async (platformArg, opts) => {
    log.banner()
    try {
      const appDir = opts.appDir || resolveAppDir()
      await setupOAuth(appDir, platformArg, {
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        appSlug: opts.appSlug,
        appId: opts.appId,
        privateKey: opts.privateKey,
      })
    } catch (err: any) {
      log.fatal(err.message)
      process.exit(1)
    }
  })

// --- main setup action ---
setupCommand.action(async (opts) => {
  log.banner()

  const from = opts.from as StepName | undefined
  const only = opts.only ? parseSteps(opts.only) : undefined

  if (from && !STEP_NAMES.includes(from)) {
    log.fatal(`Unknown step "${from}". Valid steps: ${STEP_NAMES.join(', ')}`)
    process.exit(1)
  }

  const run = (step: StepName) => shouldRun(step, from, only)

  try {
    let appDir = opts.appDir ? path.resolve(opts.appDir) : path.join(path.resolve('hissuno'), 'app')
    let projectDir = path.dirname(appDir)
    const envFile = opts.env ? `.env.${opts.env}` : '.env.local'
    let databaseUrl = ''
    let appUrl = 'http://localhost:3000'
    let seeded = false
    let apiKey: string | undefined

    // 1. Check prerequisites
    if (run('check-node')) {
      await checkNode()
    }

    // 2. Clone repository
    if (run('clone')) {
      projectDir = await cloneRepo()
      appDir = path.join(projectDir, 'app')
    }

    // 3. Install dependencies
    if (run('install')) {
      await installDeps(appDir)
    }

    // 4. Build widget
    if (run('build')) {
      await buildWidget(appDir)
    }

    // 5. Detect/install PostgreSQL
    if (run('postgres')) {
      const pgResult = await detectPostgres({ databaseUrl: opts.databaseUrl, postgresMethod: opts.postgresMethod })
      databaseUrl = pgResult.databaseUrl

      // 6. Configure environment (depends on postgres result)
      if (run('env')) {
        const envResult = await configureEnv(appDir, databaseUrl, envFile, { appUrl: opts.appUrl, openaiKey: opts.openaiKey })
        appUrl = envResult.appUrl
      }

      // 7. Set up database (depends on postgres result)
      if (run('database')) {
        await setupDatabase(appDir, pgResult)
      }
    } else {
      // Run env/database independently if postgres was skipped
      if (run('env')) {
        const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/hissuno'
        const envResult = await configureEnv(appDir, url, envFile, { appUrl: opts.appUrl, openaiKey: opts.openaiKey })
        appUrl = envResult.appUrl
      }
      if (run('database')) {
        const url = resolveDatabaseUrl(appDir, envFile)
        if (!url) {
          throw new Error(
            'No DATABASE_URL found. Either run the postgres step first, ' +
            'set DATABASE_URL in your environment, or configure it in ' + envFile,
          )
        }
        databaseUrl = url
        await setupDatabase(appDir, { databaseUrl })
      }
    }

    // 8. Seed (optional)
    if (run('seed')) {
      const seedResult = await seedDatabase(appDir, envFile, opts.seed)
      seeded = seedResult.seeded
      apiKey = seedResult.apiKey
    }

    // 9. Auto-configure CLI if we got an API key from seed
    if (run('config') && apiKey) {
      await createConfig(apiKey, appUrl, opts.autoConfig)
    }

    // 10. Start server or print next steps
    if (run('start')) {
      await startServer(appDir, seeded, opts.start)
    }
  } catch (err: any) {
    log.fatal(err.message)
    process.exit(1)
  }
})
