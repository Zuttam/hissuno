import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { input, password, select } from '@inquirer/prompts'
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

  const aiEnvVars: string[] = []

  if (opts) {
    // Non-interactive mode: only add OpenAI if explicitly provided
    if (opts.openaiKey) {
      aiEnvVars.push(`OPENAI_API_KEY=${opts.openaiKey}`)
    }
  } else {
    // Interactive mode: let the user pick a provider
    const provider = await select({
      message: 'Select AI provider:',
      choices: [
        { name: 'OpenAI (default)', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Google', value: 'google' },
        { name: 'Skip', value: 'skip' },
      ],
    })

    if (provider !== 'skip') {
      const providerConfig = {
        openai: {
          keyName: 'OPENAI_API_KEY',
          label: 'OpenAI',
          validate: (val: string) =>
            val.startsWith('sk-') || 'API key should start with sk-',
        },
        anthropic: {
          keyName: 'ANTHROPIC_API_KEY',
          label: 'Anthropic',
          validate: (val: string) =>
            val.startsWith('sk-ant-') || 'API key should start with sk-ant-',
          extraVars: [
            'AI_MODEL=anthropic/claude-sonnet-4-6',
            'AI_MODEL_SMALL=anthropic/claude-haiku-4-5',
          ],
        },
        google: {
          keyName: 'GOOGLE_GENERATIVE_AI_API_KEY',
          label: 'Google',
          validate: (val: string) =>
            val.length > 0 || 'API key cannot be empty',
          extraVars: [
            'AI_MODEL=google/gemini-2.5-pro',
            'AI_MODEL_SMALL=google/gemini-2.5-flash',
          ],
        },
      } as const

      const config = providerConfig[provider]

      const apiKey = await password({
        message: `Enter your ${config.label} API key:`,
        mask: '*',
        validate: config.validate,
      })

      aiEnvVars.push(`${config.keyName}=${apiKey}`)
      if ('extraVars' in config) {
        aiEnvVars.push(...config.extraVars)
      }
    }
  }

  const authSecret = crypto.randomBytes(32).toString('base64')

  const envLines = [
    `DATABASE_URL=${databaseUrl}`,
    `AUTH_SECRET=${authSecret}`,
    `NEXT_PUBLIC_APP_URL=${appUrl}`,
  ]
  envLines.push(...aiEnvVars)
  envLines.push('')

  const envContent = envLines.join('\n')

  const envPath = path.join(appDir, envFile)
  fs.writeFileSync(envPath, envContent, 'utf-8')
  log.success(`${envFile} created`)

  return { appUrl }
}
