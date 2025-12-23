/**
 * Step 3: Compile Knowledge
 *
 * Compiles all analysis results into categorized knowledge packages:
 * - Business knowledge
 * - Product knowledge
 * - Technical knowledge
 */

import { createStep } from '@mastra/core/workflows'
import { analyzeSourcesOutputSchema, compiledKnowledgeSchema } from '../schemas'

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

    const { analysisResults, codebaseAnalysis, hasCodebase } = inputData
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
        business: '# Business Knowledge Base\n\nNo content available for analysis.',
        product: '# Product Knowledge Base\n\nNo content available for analysis.',
        technical: '# Technical Knowledge Base\n\nNo content available for analysis.',
      }
    }

    const combinedContent = allContent.join('\n\n---\n\n')

    if (!agent) {
      // Fallback: simple categorization without agent
      return {
        business: `# Business Knowledge Base\n\n${combinedContent}`,
        product: `# Product Knowledge Base\n\n${combinedContent}`,
        technical: `# Technical Knowledge Base\n\n${codebaseAnalysis || combinedContent}`,
      }
    }

    await writer?.write({ type: 'progress', message: 'Categorizing into business, product, and technical...' })

    // Use agent to compile and categorize with structured output
    const prompt = `You have the following analyzed content from multiple sources. 
Please compile this into THREE separate knowledge packages:

1. BUSINESS KNOWLEDGE - Company info, pricing, policies, contact info
2. PRODUCT KNOWLEDGE - Features, use cases, how-to guides, tips
3. TECHNICAL KNOWLEDGE - API reference, architecture, data models, integration

---
SOURCE CONTENT:
${combinedContent.slice(0, 50000)}
---

For each category, provide a complete markdown document.`

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
          schema: compiledKnowledgeSchema,
        },
      })

      await writer?.write({ type: 'progress', message: 'Knowledge packages compiled successfully' })

      return (
        response.object ?? {
          business: '# Business Knowledge Base\n\nNo business knowledge extracted.',
          product: '# Product Knowledge Base\n\nNo product knowledge extracted.',
          technical: '# Technical Knowledge Base\n\nNo technical knowledge extracted.',
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[compile-knowledge] Error:', message)
      return {
        business: `# Business Knowledge Base\n\nCompilation error: ${message}`,
        product: `# Product Knowledge Base\n\nCompilation error: ${message}`,
        technical: `# Technical Knowledge Base\n\nCompilation error: ${message}`,
      }
    }
  },
})
