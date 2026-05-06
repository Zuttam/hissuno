/**
 * hissuno sanitize <type> <id> — Trigger sanitization on a resource
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, resolveKnowledgeScope, buildPath } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'

export const sanitizeCommand = new Command('sanitize')
  .description('Sanitize a resource (currently: knowledge sources only)')
  .argument('<type>', 'Resource type: knowledge')
  .argument('<id>', 'Resource ID')
  .option('--scope <id>', 'Scope ID (knowledge only; defaults to the project root scope)')
  .action(async (type: string, id: string, opts: { scope?: string }, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    if (type !== 'knowledge') {
      error(`Invalid type "${type}". Sanitizable types: knowledge`)
      process.exit(1)
    }

    const projectId = await resolveProjectId(config)
    const scopeId = await resolveKnowledgeScope(config, projectId, opts.scope)

    const result = await apiCall<Record<string, unknown>>(
      config,
      'POST',
      buildPath(`/api/product-scopes/${scopeId}/knowledge/${id}/sanitize`, { projectId }),
    )

    if (!result.ok) {
      const data = result.data as { error?: string }
      error(`Failed: ${data.error || `HTTP ${result.status}`}`)
      process.exit(1)
    }

    if (jsonMode) {
      console.log(renderJson(result.data))
    } else {
      const data = result.data as { redactions?: number; changed?: boolean; chunksEmbedded?: number }
      if (data.changed) {
        success(`Redacted ${data.redactions ?? 0} item(s); re-embedded ${data.chunksEmbedded ?? 0} chunks.`)
      } else {
        success('No sensitive content found.')
      }
    }
  })
