/**
 * Step 2: Sanitize Content
 *
 * Scans analyzed content for sensitive information and redacts it.
 * Uses the security scanner agent on the single source content.
 */

import { createStep } from '@mastra/core/workflows'
import { fetchedContentSchema, sanitizedContentSchema } from '../schemas'
import { stripLLMPreamble } from '../utils'

const REDACTION_PATTERNS = [
  { pattern: /\[REDACTED_AWS_KEY\]/g, type: 'aws_key' },
  { pattern: /\[REDACTED_API_KEY\]/g, type: 'api_key' },
  { pattern: /\[REDACTED_GITHUB_TOKEN\]/g, type: 'github_token' },
  { pattern: /\[REDACTED_DATABASE_URL\]/g, type: 'database_url' },
  { pattern: /\[REDACTED_PASSWORD\]/g, type: 'password' },
  { pattern: /\[REDACTED_PRIVATE_KEY\]/g, type: 'private_key' },
  { pattern: /\[REDACTED_INTERNAL_IP\]/g, type: 'internal_ip' },
  { pattern: /\[REDACTED_SECRET\]/g, type: 'secret' },
  { pattern: /\[REDACTED_TOKEN\]/g, type: 'token' },
  { pattern: /\[REDACTED_CREDENTIAL\]/g, type: 'credential' },
]

function countRedactions(content: string): number {
  let count = 0
  for (const { pattern } of REDACTION_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) count += matches.length
  }
  return count
}

export const sanitizeContent = createStep({
  id: 'sanitize-content',
  description: 'Scan and redact sensitive information from source content',
  inputSchema: fetchedContentSchema,
  outputSchema: sanitizedContentSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { fetchedContent, hasContent } = inputData
    const logger = mastra?.getLogger()

    if (!hasContent || !fetchedContent) {
      return {
        ...inputData,
        sanitizedContent: '',
        redactionCount: 0,
      }
    }

    await writer?.write({ type: 'progress', message: 'Scanning for sensitive information...' })

    const agent = mastra?.getAgent('securityScannerAgent')
    if (!agent) {
      logger?.warn('[sanitize-content] Security scanner agent not found, skipping')
      return {
        ...inputData,
        sanitizedContent: fetchedContent,
        redactionCount: 0,
      }
    }

    try {
      const prompt = `Scan the following knowledge content for sensitive information and redact any secrets, credentials, API keys, or other sensitive data you find. Return the content with all sensitive information replaced by appropriate placeholders.

---
CONTENT TO SCAN:
${fetchedContent.slice(0, 50000)}
---

Return the sanitized content maintaining the exact same structure and formatting. Only replace sensitive values with redaction placeholders.`

      const response = await agent.generate([{ role: 'user', content: prompt }])
      const sanitizedContent = stripLLMPreamble(response.text) || fetchedContent
      const redactionCount = countRedactions(sanitizedContent)

      if (redactionCount > 0) {
        await writer?.write({
          type: 'progress',
          message: `Redacted ${redactionCount} sensitive item(s)`,
        })
      } else {
        await writer?.write({ type: 'progress', message: 'Security scan complete - no sensitive data found' })
      }

      return {
        ...inputData,
        sanitizedContent,
        redactionCount,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[sanitize-content] Error:', { error: message })
      // On error, return original content to avoid data loss
      return {
        ...inputData,
        sanitizedContent: fetchedContent,
        redactionCount: 0,
      }
    }
  },
})
