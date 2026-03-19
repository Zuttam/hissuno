import path from 'node:path'
import { confirm } from '@inquirer/prompts'
import { execCapture } from '../../lib/exec.js'
import { log } from '../../lib/log.js'

export async function seedDatabase(appDir: string, envFile = '.env.local'): Promise<{ seeded: boolean; apiKey?: string }> {
  const shouldSeed = await confirm({
    message: 'Seed with demo data? (admin user + project with sample sessions, issues, companies, and contacts)',
    default: true,
  })

  if (!shouldSeed) {
    log.info('Skipping seed')
    return { seeded: false }
  }

  try {
    log.info('Seeding database...')
    const tsx = path.join(appDir, 'node_modules', '.bin', 'tsx')
    const { stdout } = await execCapture(
      tsx,
      ['--tsconfig', 'tsconfig.json', '--env-file', envFile, 'src/scripts/seed.ts', '--demo', '--output-api-key'],
      { cwd: appDir },
    )
    log.success('Demo data seeded')

    // Surface seed output to the user
    const passwordMatch = stdout.match(/\[seed\] Generated admin password: (\S+)/)
    if (passwordMatch) {
      log.info(`Admin email: admin@hissuno.com`)
      log.info(`Admin password: ${passwordMatch[1]}`)
    }
    const projectMatch = stdout.match(/\[seed\] Created demo project: (.+) \((.+)\)/)
    if (projectMatch) {
      log.info(`Demo project: ${projectMatch[1]} (${projectMatch[2]})`)
    }

    // Extract API key from seed output
    const apiKeyMatch = stdout.match(/HISSUNO_API_KEY=(\S+)/)
    return { seeded: true, apiKey: apiKeyMatch?.[1] }
  } catch (err: any) {
    log.warn(`Seed failed: ${err.message}`)
    log.warn('You can run it manually later: npm run seed')
    return { seeded: false }
  }
}
