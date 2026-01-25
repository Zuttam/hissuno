/**
 * Step 1: Analyze Codebase
 *
 * Uses the codebaseAnalyzerAgent with local filesystem tools to intelligently explore
 * and analyze the codebase cloned from GitHub into an ephemeral local directory.
 */

import { createStep } from '@mastra/core/workflows'
import { workflowContextWithCodebaseSchema, analyzeCodebaseOutputSchema } from '../schemas'

export const analyzeCodebase = createStep({
  id: 'analyze-codebase',
  description: 'Analyze source code to extract product and technical knowledge using agent tools',
  inputSchema: workflowContextWithCodebaseSchema,
  outputSchema: analyzeCodebaseOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, sources, localCodePath, analysisScope, codebaseLeaseId, codebaseCommitSha } = inputData
    logger?.info('[analyze-codebase] Starting', { projectId, localCodePath, analysisScope })

    // Emit progress event
    await writer?.write({ type: 'progress', message: 'Starting codebase analysis...' })

    // No codebase to analyze
    if (!localCodePath) {
      logger?.info('[analyze-codebase] No localCodePath, skipping')
      await writer?.write({ type: 'progress', message: 'No codebase configured, skipping...' })
      return {
        projectId,
        sources,
        codebaseAnalysis: '',
        hasCodebase: false,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }

    const agent = mastra?.getAgent('codebaseAnalyzerAgent')
    if (!agent) {
      logger?.warn('[analyze-codebase] Agent not found, skipping codebase analysis')
      await writer?.write({ type: 'progress', message: 'Codebase analyzer not configured' })
      return {
        projectId,
        sources,
        codebaseAnalysis: '[Codebase analysis skipped: Agent not configured]',
        hasCodebase: true,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }

    try {
      logger?.debug('[analyze-codebase] Calling agent.generate')
      const scopeMessage = analysisScope 
        ? `Exploring scoped path: ${analysisScope}...` 
        : 'Exploring project structure...'
      await writer?.write({ type: 'progress', message: scopeMessage })
      
      // Build scope instruction for the prompt
      const scopeInstruction = analysisScope
        ? `\n\nIMPORTANT: This is a SCOPED analysis. Focus your analysis ONLY on the path: "${analysisScope}"
When listing files, start with this path as the prefix. Ignore files outside this path.
This project is part of a larger repository (monorepo), so only analyze the specified subdirectory.`
        : ''
      
      // The agent now uses tools to intelligently explore the codebase
      const startPath = analysisScope 
        ? `Use prefix "${analysisScope}" when listing files to start from the scoped directory.`
        : '1. First, list the files at the root level to understand the project structure'
      
      const prompt = `Analyze the codebase at local path: ${localCodePath}${scopeInstruction}

Use your tools to explore and understand this codebase:

${startPath}
2. Read key configuration files (package.json, README.md, tsconfig.json)
3. Explore the main source directories (src/, app/, pages/, etc.)
4. Search for important patterns like API routes, components, and data models

After exploring, provide a comprehensive analysis covering:
- Product Overview: What does this product do?
- Key Features: Main features and capabilities
- Technical Architecture: Tech stack and structure
- API Reference: Any API endpoints found
- Data Models: Key data structures
- Common Use Cases: How the product is typically used

Be efficient with your tool usage - you don't need to read every file. Focus on the most important ones that reveal the product's purpose and architecture.`

      const response = await agent.generate([{ role: 'user', content: prompt }], {
        maxSteps: 15, // Allow multiple tool iterations for thorough analysis
        onStepFinish: async ({ text, toolCalls, finishReason }) => {
          logger?.info('[analyze-codebase] Agent step finished', {
            hasText: !!text,
            toolCallCount: toolCalls?.length ?? 0,
            finishReason,
          })
          // Emit progress for each agent step
          if (toolCalls && toolCalls.length > 0) {
            await writer?.write({ type: 'progress', message: `Using ${toolCalls.length} tool(s)...` })
          }
        },
      })

      const analysis = response.text || '[No analysis generated]'
      logger?.info('[analyze-codebase] Completed', { analysisLength: analysis.length })
      await writer?.write({ type: 'progress', message: 'Codebase analysis complete' })

      return {
        projectId,
        sources,
        codebaseAnalysis: analysis,
        hasCodebase: true,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[analyze-codebase] Error', { error: message })
      return {
        projectId,
        sources,
        codebaseAnalysis: `[Codebase analysis error: ${message}]`,
        hasCodebase: true,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }
  },
})
