import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { confirm, input, password } from '@inquirer/prompts'
import { log } from '../../lib/log.js'

export async function configureEnv(
  appDir: string,
  databaseUrl: string,
  envFile = '.env.local',
  opts?: { appUrl?: string; openaiKey?: string },
): Promise<{ appUrl: string }> {
  const appUrl = opts?.appUrl ?? await input({
    message: 'App URL:',
    default: 'http://localhost:3000',
  })

  let openaiKey: string | undefined
  if (opts) {
    // Non-interactive mode: only add OpenAI if explicitly provided
    openaiKey = opts.openaiKey
  } else {
    // Interactive mode: ask the user
    const wantsOpenai = await confirm({
      message: 'Add an OpenAI API key? (enables AI analysis & semantic search)',
      default: true,
    })

    if (wantsOpenai) {
      openaiKey = await password({
        message: 'Enter your OpenAI API key:',
        mask: '*',
        validate: (val) => {
          if (!val.startsWith('sk-')) {
            return 'API key should start with sk-'
          }
          return true
        },
      })
    }
  }

  const authSecret = crypto.randomBytes(32).toString('base64')

  const envLines = [
    `DATABASE_URL=${databaseUrl}`,
    `AUTH_SECRET=${authSecret}`,
    `NEXT_PUBLIC_APP_URL=${appUrl}`,
  ]
  if (openaiKey) {
    envLines.push(`OPENAI_API_KEY=${openaiKey}`)
  }
  envLines.push('')

  const envContent = envLines.join('\n')

  const envPath = path.join(appDir, envFile)
  fs.writeFileSync(envPath, envContent, 'utf-8')
  log.success(`${envFile} created`)

  return { appUrl }
}
