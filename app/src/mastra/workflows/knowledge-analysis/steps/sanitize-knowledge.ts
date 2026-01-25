/**
 * Step 3.5: Sanitize Knowledge
 *
 * Scans compiled knowledge packages for sensitive information and redacts it
 * before saving. Uses an AI agent to detect and replace secrets, credentials,
 * and other sensitive data with descriptive placeholders.
 */

import { createStep } from '@mastra/core/workflows'
import { compiledKnowledgeSchema, sanitizedKnowledgeSchema } from '../schemas'

// Common patterns for detecting redactions in the output
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

/**
 * Count redactions in a piece of content and extract the types found
 */
function countRedactions(content: string): { count: number; types: Set<string> } {
  let count = 0
  const types = new Set<string>()

  for (const { pattern, type } of REDACTION_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      count += matches.length
      types.add(type)
    }
  }

  return { count, types }
}

export const sanitizeKnowledge = createStep({
  id: 'sanitize-knowledge',
  description: 'Scan and redact sensitive information from knowledge packages',
  inputSchema: compiledKnowledgeSchema,
  outputSchema: sanitizedKnowledgeSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    await writer?.write({ type: 'progress', message: 'Scanning for sensitive information...' })

    const { business, product, technical, faq, how_to, localCodePath, codebaseLeaseId, codebaseCommitSha } = inputData
    const agent = mastra?.getAgent('securityScannerAgent')

    // Track redaction stats
    const redactionStats = {
      business: 0,
      product: 0,
      technical: 0,
      faq: 0,
      how_to: 0,
    }
    const allTypes = new Set<string>()

    // If no agent, pass through without modification but log warning
    if (!agent) {
      logger?.warn('[sanitize-knowledge] Security scanner agent not found, skipping sanitization')
      await writer?.write({ type: 'progress', message: 'Security scanner not configured, skipping...' })
      return {
        business,
        product,
        technical,
        faq,
        how_to,
        redactionSummary: {
          totalRedactions: 0,
          byCategory: { business: 0, product: 0, technical: 0, faq: 0, how_to: 0 },
          types: [],
        },
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }

    /**
     * Scan and sanitize a single category of knowledge
     */
    async function sanitizeCategory(
      category: 'business' | 'product' | 'technical' | 'faq' | 'how_to',
      content: string
    ): Promise<string> {
      if (!content || content.trim().length === 0) {
        return content
      }

      try {
        const prompt = `Scan the following ${category} knowledge content for sensitive information and redact any secrets, credentials, API keys, or other sensitive data you find. Return the content with all sensitive information replaced by appropriate placeholders.

---
CONTENT TO SCAN:
${content.slice(0, 50000)}
---

Return the sanitized content maintaining the exact same structure and formatting. Only replace sensitive values with redaction placeholders.`

        const response = await agent.generate([{ role: 'user', content: prompt }], {
          onStepFinish: ({ text, toolCalls, finishReason }) => {
            logger?.debug('[sanitize-knowledge] Agent step finished', {
              category,
              hasText: !!text,
              toolCallCount: toolCalls?.length ?? 0,
              finishReason,
            })
          },
        })

        const sanitizedContent = response.text || content

        // Count redactions made
        const { count, types } = countRedactions(sanitizedContent)
        redactionStats[category] = count
        types.forEach((t) => allTypes.add(t))

        if (count > 0) {
          logger?.info(`[sanitize-knowledge] Redacted ${count} sensitive items in ${category}`)
        }

        return sanitizedContent
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger?.error(`[sanitize-knowledge] Error scanning ${category}:`, { error: message })
        // On error, return original content to avoid data loss
        return content
      }
    }

    // Sanitize categories sequentially to avoid WritableStream lock issues
    // (parallel writes to the same stream cause "WritableStream is locked" errors)
    await writer?.write({ type: 'progress', message: 'Scanning business knowledge...' })
    const sanitizedBusiness = await sanitizeCategory('business', business)

    await writer?.write({ type: 'progress', message: 'Scanning product knowledge...' })
    const sanitizedProduct = await sanitizeCategory('product', product)

    await writer?.write({ type: 'progress', message: 'Scanning technical knowledge...' })
    const sanitizedTechnical = await sanitizeCategory('technical', technical)

    await writer?.write({ type: 'progress', message: 'Scanning FAQ...' })
    const sanitizedFaq = await sanitizeCategory('faq', faq)

    await writer?.write({ type: 'progress', message: 'Scanning how-to guides...' })
    const sanitizedHowTo = await sanitizeCategory('how_to', how_to)

    const totalRedactions =
      redactionStats.business + redactionStats.product + redactionStats.technical +
      redactionStats.faq + redactionStats.how_to

    if (totalRedactions > 0) {
      await writer?.write({
        type: 'progress',
        message: `Redacted ${totalRedactions} sensitive item(s) across all packages`,
      })
      logger?.info('[sanitize-knowledge] Completed with redactions', {
        total: totalRedactions,
        byCategory: redactionStats,
        types: Array.from(allTypes),
      })
    } else {
      await writer?.write({ type: 'progress', message: 'Security scan complete - no sensitive data found' })
    }

    return {
      business: sanitizedBusiness,
      product: sanitizedProduct,
      technical: sanitizedTechnical,
      faq: sanitizedFaq,
      how_to: sanitizedHowTo,
      redactionSummary: {
        totalRedactions,
        byCategory: redactionStats,
        types: Array.from(allTypes),
      },
      // Pass through codebase lease fields
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
    }
  },
})
