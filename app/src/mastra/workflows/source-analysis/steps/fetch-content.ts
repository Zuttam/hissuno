/**
 * Step 1: Fetch Content
 *
 * Type-specific content fetching and AI extraction for a single knowledge source.
 * Reuses logic from the existing analyze-codebase and analyze-sources steps.
 */

import { createStep } from '@mastra/core/workflows'
import { sourceAnalysisInputSchema, fetchedContentSchema } from '../schemas'
import { prepareCodebaseForWorkflow } from '../../common/prepare-codebase'
import { stripLLMPreamble } from '../utils'

export const fetchContent = createStep({
  id: 'fetch-content',
  description: 'Fetch and extract content from knowledge source',
  inputSchema: sourceAnalysisInputSchema,
  outputSchema: fetchedContentSchema,
  execute: async ({ inputData, mastra, writer, runId }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, sourceId, sourceType, url, storagePath, content, analysisScope } = inputData
    const logger = mastra?.getLogger()

    // Default codebase fields for non-codebase source types
    const codebaseDefaults = { localCodePath: null, codebaseLeaseId: null, codebaseCommitSha: null } as const

    await writer?.write({ type: 'progress', message: `Fetching content for ${sourceType} source...` })

    try {
      switch (sourceType) {
        case 'codebase': {
          // Acquire codebase lease and analyze
          const codebaseResult = await prepareCodebaseForWorkflow({
            projectId,
            runId,
            logger: logger
              ? {
                  info: (msg, data) => logger.info(msg, data),
                  warn: (msg, data) => logger.warn(msg, data),
                  error: (msg, data) => logger.error(msg, data),
                }
              : undefined,
            writer: writer
              ? { write: async (data) => { await writer.write(data) } }
              : undefined,
          })

          if (!codebaseResult.localCodePath) {
            return {
              ...inputData,
              fetchedContent: '',
              hasContent: false,
              localCodePath: null,
              codebaseLeaseId: codebaseResult.codebaseLeaseId,
              codebaseCommitSha: null,
            }
          }

          // Use codebase analyzer agent
          const codebaseAgent = mastra?.getAgent('codebaseAnalyzerAgent')
          if (!codebaseAgent) {
            return {
              ...inputData,
              fetchedContent: '[Codebase analysis skipped: Agent not configured]',
              hasContent: true,
              localCodePath: codebaseResult.localCodePath,
              codebaseLeaseId: codebaseResult.codebaseLeaseId,
              codebaseCommitSha: codebaseResult.codebaseCommitSha,
            }
          }

          const scopeInstruction = analysisScope
            ? `\n\nIMPORTANT: This is a SCOPED analysis. Focus ONLY on path: "${analysisScope}"`
            : ''

          const startPath = analysisScope
            ? `Use prefix "${analysisScope}" when listing files.`
            : '1. First, list files at the root level to understand project structure'

          const prompt = `Analyze the codebase at local path: ${codebaseResult.localCodePath}${scopeInstruction}

Use your tools to explore and understand this codebase:

${startPath}
2. Read key configuration files (package.json, README.md, tsconfig.json)
3. Explore the main source directories (src/, app/, pages/, etc.)
4. Search for important patterns like API routes, components, and data models

Provide a comprehensive analysis covering:
- Product Overview: What does this product do?
- Key Features: Main features and capabilities
- Technical Architecture: Tech stack and structure
- API Reference: Any API endpoints found
- Data Models: Key data structures
- Common Use Cases: How the product is typically used

Be efficient - focus on the most important files that reveal purpose and architecture.`

          await writer?.write({ type: 'progress', message: 'Analyzing codebase with AI agent...' })

          const response = await codebaseAgent.generate([{ role: 'user', content: prompt }], {
            maxSteps: 15,
            onStepFinish: async ({ toolCalls }) => {
              if (toolCalls && toolCalls.length > 0) {
                await writer?.write({ type: 'progress', message: `Using ${toolCalls.length} tool(s)...` })
              }
            },
          })

          return {
            ...inputData,
            fetchedContent: stripLLMPreamble(response.text) || '[No analysis generated]',
            hasContent: true,
            localCodePath: codebaseResult.localCodePath,
            codebaseLeaseId: codebaseResult.codebaseLeaseId,
            codebaseCommitSha: codebaseResult.codebaseCommitSha,
          }
        }

        case 'website': {
          if (!url) {
            return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
          }

          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; HissunoBot/1.0)',
              Accept: 'text/html',
            },
          })

          if (!response.ok) {
            return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
          }

          const html = await response.text()
          const textContent = extractTextFromHtml(html)

          const webAgent = mastra?.getAgent('webScraperAgent')
          if (webAgent) {
            const prompt = `Analyze this website content and extract key information:

URL: ${url}

Content:
${textContent.slice(0, 20000)}

Please extract:
1. Company/Product Overview
2. Key Features and Capabilities
3. Pricing Information (if available)
4. Documentation highlights
5. Support resources`

            const agentResponse = await webAgent.generate([{ role: 'user', content: prompt }])
            return {
              ...codebaseDefaults,
              ...inputData,
              fetchedContent: stripLLMPreamble(agentResponse.text) || textContent,
              hasContent: true,
            }
          }

          return { ...codebaseDefaults, ...inputData, fetchedContent: textContent, hasContent: true }
        }

        case 'docs_portal': {
          if (!url) {
            return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
          }

          await writer?.write({ type: 'progress', message: `Crawling documentation portal: ${url}` })

          const { crawlDocsPortal, combineCrawlResults } = await import('@/lib/knowledge/docs-crawler')
          const crawlResults = await crawlDocsPortal(url, { maxPages: 50, rateLimit: 500 })
          const successfulPages = crawlResults.filter((r) => !r.error && r.content)

          if (successfulPages.length === 0) {
            return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
          }

          await writer?.write({ type: 'progress', message: `Crawled ${successfulPages.length} pages` })

          const combinedContent = combineCrawlResults(crawlResults)
          const webAgent = mastra?.getAgent('webScraperAgent')

          if (webAgent) {
            const prompt = `Analyze this documentation portal content and extract key information:

${combinedContent.slice(0, 30000)}

Please extract and organize:
1. Main product/service overview
2. Key features and capabilities
3. Getting started guides
4. API documentation highlights
5. Common FAQs or troubleshooting
6. Best practices and tutorials`

            const agentResponse = await webAgent.generate([{ role: 'user', content: prompt }])
            return {
              ...codebaseDefaults,
              ...inputData,
              fetchedContent: stripLLMPreamble(agentResponse.text) || combinedContent,
              hasContent: true,
            }
          }

          return { ...codebaseDefaults, ...inputData, fetchedContent: combinedContent, hasContent: true }
        }

        case 'raw_text': {
          return {
            ...codebaseDefaults,
            ...inputData,
            fetchedContent: content || '',
            hasContent: Boolean(content),
          }
        }

        case 'uploaded_doc': {
          // Check if this is a Notion-origin document
          const docOrigin = (inputData as Record<string, unknown>).origin as string | null
          const docNotionPageId = (inputData as Record<string, unknown>).notionPageId as string | null
          if (docOrigin === 'notion' && docNotionPageId) {
            const { getNotionCredentials } = await import('@/lib/integrations/notion')
            const credentials = await getNotionCredentials(projectId)
            if (!credentials) {
              logger?.warn(`[fetch-content] No Notion credentials for project ${projectId}`)
              return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
            }

            const { NotionClient } = await import('@/lib/integrations/notion/client')
            const notionClient = new NotionClient(credentials.accessToken)

            await writer?.write({ type: 'progress', message: 'Fetching Notion page blocks...' })
            const blocks = await notionClient.getAllPageBlocks(docNotionPageId)

            const { blocksToMarkdown } = await import('@/lib/integrations/notion/blocks-to-markdown')
            const markdown = blocksToMarkdown(blocks)

            return {
              ...codebaseDefaults,
              ...inputData,
              fetchedContent: markdown || '[Empty Notion page]',
              hasContent: Boolean(markdown),
            }
          }

          return {
            ...codebaseDefaults,
            ...inputData,
            fetchedContent: `[Uploaded document: ${storagePath}]`,
            hasContent: Boolean(storagePath),
          }
        }

        case 'notion': {
          const notionPageId = (inputData as Record<string, unknown>).notionPageId as string | null
          if (!notionPageId) {
            return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
          }

          const { getNotionCredentials } = await import('@/lib/integrations/notion')
          const credentials = await getNotionCredentials(projectId)
          if (!credentials) {
            logger?.warn(`[fetch-content] No Notion credentials for project ${projectId}`)
            return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
          }

          const { NotionClient } = await import('@/lib/integrations/notion/client')
          const notionClient = new NotionClient(credentials.accessToken)

          await writer?.write({ type: 'progress', message: 'Fetching Notion page blocks...' })
          const blocks = await notionClient.getAllPageBlocks(notionPageId)

          const { blocksToMarkdown } = await import('@/lib/integrations/notion/blocks-to-markdown')
          const markdown = blocksToMarkdown(blocks)

          return {
            ...codebaseDefaults,
            ...inputData,
            fetchedContent: markdown || '[Empty Notion page]',
            hasContent: Boolean(markdown),
          }
        }

        default:
          return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error(`[fetch-content] Error for source ${sourceId}:`, { error: message })
      return { ...codebaseDefaults, ...inputData, fetchedContent: '', hasContent: false }
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
