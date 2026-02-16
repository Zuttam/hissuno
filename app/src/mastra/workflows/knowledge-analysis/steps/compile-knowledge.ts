/**
 * Step 3: Compile Knowledge
 *
 * Compiles all analysis results into categorized knowledge packages:
 * - Business knowledge
 * - Product knowledge
 * - Technical knowledge
 * - FAQ
 * - How-To/Guides
 */

import { createStep } from '@mastra/core/workflows'
import { analyzeSourcesOutputSchema, compiledKnowledgeSchema, compiledKnowledgeContentSchema } from '../schemas'

export const compileKnowledge = createStep({
  id: 'compile-knowledge',
  description: 'Compile all analysis into categorized knowledge packages',
  inputSchema: analyzeSourcesOutputSchema,
  outputSchema: compiledKnowledgeSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    await writer?.write({ type: 'progress', message: 'Compiling knowledge packages...' })

    const { projectId, namedPackageId, analysisResults, codebaseAnalysis, hasCodebase, localCodePath, codebaseLeaseId, codebaseCommitSha } = inputData
    const agent = mastra?.getAgent('knowledgeCompilerAgent')

    // Combine all analysis content
    const allContent: string[] = []

    if (hasCodebase && codebaseAnalysis) {
      allContent.push(`## Codebase Analysis\n\n${codebaseAnalysis}`)
    }

    for (const result of analysisResults) {
      if (result.content && !result.error) {
        allContent.push(`## ${result.type} Analysis\n\n${result.content}`)
      }
    }

    if (allContent.length === 0) {
      return {
        projectId,
        namedPackageId,
        business: '# Business Knowledge Base\n\nNo content available for analysis.',
        product: '# Product Knowledge Base\n\nNo content available for analysis.',
        technical: '# Technical Knowledge Base\n\nNo content available for analysis.',
        faq: '# FAQ\n\nNo content available for analysis.',
        how_to: '# How-To Guides\n\nNo content available for analysis.',
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }

    const combinedContent = allContent.join('\n\n---\n\n')

    if (!agent) {
      // Fallback: simple categorization without agent
      return {
        projectId,
        namedPackageId,
        business: `# Business Knowledge Base\n\n${combinedContent}`,
        product: `# Product Knowledge Base\n\n${combinedContent}`,
        technical: `# Technical Knowledge Base\n\n${codebaseAnalysis || combinedContent}`,
        faq: `# FAQ\n\n${combinedContent}`,
        how_to: `# How-To Guides\n\n${combinedContent}`,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }

    await writer?.write({ type: 'progress', message: 'Categorizing into business, product, technical, faq, and how-to...' })

    // Use agent to compile and categorize with structured output
    const prompt = `You have the following analyzed content from multiple sources.
Please compile this into FIVE separate knowledge packages:

1. BUSINESS KNOWLEDGE (business) - Company info, pricing, policies, contact info
2. PRODUCT KNOWLEDGE (product) - Features, use cases, capabilities, limitations
3. TECHNICAL KNOWLEDGE (technical) - API reference, architecture, data models, integration
4. FAQ (faq) - Frequently asked questions and answers, organized by topic
5. HOW-TO GUIDES (how_to) - Step-by-step tutorials, getting started guides, best practices

---
SOURCE CONTENT:
${combinedContent.slice(0, 50000)}
---

For each category, provide a complete markdown document. Return the result as a JSON object with keys: business, product, technical, faq, how_to.`

    try {
      const response = await agent.generate([{ role: 'user', content: prompt }], {
        onStepFinish: ({ text, toolCalls, finishReason }) => {
          logger?.info('[compile-knowledge] Agent step finished', {
            hasText: !!text,
            toolCallCount: toolCalls?.length ?? 0,
            finishReason,
          })
        },
        structuredOutput: {
          schema: compiledKnowledgeContentSchema,
        },
      })

      await writer?.write({ type: 'progress', message: 'Knowledge packages compiled successfully' })

      const defaultKnowledge = {
        business: '# Business Knowledge Base\n\nNo business knowledge extracted.',
        product: '# Product Knowledge Base\n\nNo product knowledge extracted.',
        technical: '# Technical Knowledge Base\n\nNo technical knowledge extracted.',
        faq: '# FAQ\n\nNo FAQ content extracted.',
        how_to: '# How-To Guides\n\nNo how-to content extracted.',
      }

      // Extract only the knowledge content fields from the result
      const result = response.object ?? defaultKnowledge

      return {
        projectId,
        namedPackageId,
        business: result.business ?? defaultKnowledge.business,
        product: result.product ?? defaultKnowledge.product,
        technical: result.technical ?? defaultKnowledge.technical,
        faq: result.faq ?? defaultKnowledge.faq,
        how_to: result.how_to ?? defaultKnowledge.how_to,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[compile-knowledge] Error:', message)
      return {
        projectId,
        namedPackageId,
        business: `# Business Knowledge Base\n\nCompilation error: ${message}`,
        product: `# Product Knowledge Base\n\nCompilation error: ${message}`,
        technical: `# Technical Knowledge Base\n\nCompilation error: ${message}`,
        faq: `# FAQ\n\nCompilation error: ${message}`,
        how_to: `# How-To Guides\n\nCompilation error: ${message}`,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }
  },
})
