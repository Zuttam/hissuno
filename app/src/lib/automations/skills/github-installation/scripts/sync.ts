/**
 * GitHub installation skill — records what landed. Issue/PR processing is
 * left to the github-feedback / github-codebase skills.
 */

import { writeFileSync } from 'node:fs'

interface RunInput {
  pluginId?: string
  connectionId?: string
  externalAccountId?: string
  payload?: {
    action?: string
    installation?: { id?: number; account?: { login?: string } }
    repository?: { full_name?: string }
    sender?: { login?: string }
  }
}

const raw = process.env.HISSUNO_RUN_INPUT
const input: RunInput = raw ? safeJsonParse(raw) : {}
const p = input.payload ?? {}

const summary = {
  pluginId: input.pluginId ?? 'github',
  connectionId: input.connectionId ?? null,
  installationId: p.installation?.id ?? input.externalAccountId ?? null,
  account: p.installation?.account?.login ?? null,
  action: p.action ?? null,
  repository: p.repository?.full_name ?? null,
  sender: p.sender?.login ?? null,
}

writeFileSync('output.json', JSON.stringify(summary, null, 2))
console.log('[github-installation]', JSON.stringify(summary))

function safeJsonParse(text: string): RunInput {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as RunInput) : {}
  } catch {
    return {}
  }
}
