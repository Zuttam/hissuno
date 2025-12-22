/**
 * Step 2: Analyze Sources
 *
 * Analyzes websites, documentation portals, and other knowledge sources
 * to extract relevant information.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  sourceInputSchema,
  analyzeCodebaseOutputSchema,
  analyzeSourcesOutputSchema,
  type AnalysisResult,
} from '../schemas'

export const analyzeSources = createStep({
  id: 'analyze-sources',
  description: 'Analyze websites, docs, and other knowledge sources',
  inputSchema: analyzeCodebaseOutputSchema,
  outputSchema: analyzeSourcesOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sources, codebaseAnalysis, hasCodebase } = inputData
    const results: AnalysisResult[] = []

    await writer?.write({ type: 'progress', message: `Analyzing ${sources.length} knowledge source(s)...` })

    const webAgent = mastra?.getAgent('webScraperAgent')
    let processedCount = 0

    for (const source of sources) {
      processedCount++
      await writer?.write({ 
        type: 'progress', 
        message: `Processing source ${processedCount}/${sources.length}: ${source.type}` 
      })
      try {
        switch (source.type) {
          case 'website':
          case 'docs_portal': {
            if (!source.url) {
              results.push({
                sourceId: source.id,
                type: source.type,
                content: '',
                error: 'No URL provided',
              })
              break
            }

            // Fetch and analyze website content
            const response = await fetch(source.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; HissunoBot/1.0)',
                Accept: 'text/html',
              },
            })

            if (!response.ok) {
              results.push({
                sourceId: source.id,
                type: source.type,
                content: '',
                error: `HTTP ${response.status}`,
              })
              break
            }

            const html = await response.text()
            const textContent = extractTextFromHtml(html)

            if (webAgent) {
              const prompt = `Analyze this ${source.type === 'docs_portal' ? 'documentation portal' : 'website'} content and extract key information:

URL: ${source.url}

Content:
${textContent.slice(0, 20000)}

Please extract:
1. Company/Product Overview
2. Key Features and Capabilities
3. Pricing Information (if available)
4. Documentation highlights
5. Support resources`

              const agentResponse = await webAgent.generate([{ role: 'user', content: prompt }])
              results.push({
                sourceId: source.id,
                type: source.type,
                content: agentResponse.text || textContent,
              })
            } else {
              results.push({
                sourceId: source.id,
                type: source.type,
                content: textContent,
              })
            }
            break
          }

          case 'raw_text': {
            results.push({
              sourceId: source.id,
              type: source.type,
              content: source.content || '',
            })
            break
          }

          case 'uploaded_doc': {
            // For uploaded docs, we'd need to download and parse
            // This requires the storage path to be accessible
            results.push({
              sourceId: source.id,
              type: source.type,
              content: `[Uploaded document: ${source.storagePath}]`,
            })
            break
          }

          default:
            results.push({
              sourceId: source.id,
              type: source.type,
              content: '',
              error: `Unknown source type: ${source.type}`,
            })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          sourceId: source.id,
          type: source.type,
          content: '',
          error: message,
        })
      }
    }

    const successCount = results.filter(r => !r.error).length
    await writer?.write({ 
      type: 'progress', 
      message: `Completed analyzing ${successCount}/${sources.length} sources` 
    })

    return {
      analysisResults: results,
      codebaseAnalysis,
      hasCodebase,
    }
  },
})

/**
 * Basic HTML to text extraction
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
