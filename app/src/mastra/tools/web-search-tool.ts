/**
 * Web Search Tool for Mastra Agents
 *
 * Uses Tavily API to search the web for best practices, competitor approaches,
 * and industry standards. Useful for product spec generation and research tasks.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * Search the web using Tavily API
 */
export const webSearchTool = createTool({
  id: 'web-search',
  description: `Search the web for best practices, competitor approaches, and industry standards.
Use this to research solutions, find similar products, or gather market context.
Returns search results with titles, URLs, content snippets, and relevance scores.`,
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    searchDepth: z
      .enum(['basic', 'advanced'])
      .optional()
      .default('basic')
      .describe('Search depth: basic (faster) or advanced (more comprehensive)'),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum number of results to return (1-10)'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
        score: z.number(),
      })
    ),
    answer: z.string().optional(),
    searchQuery: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { query, searchDepth = 'basic', maxResults = 5 } = context

    const tavilyApiKey = process.env.TAVILY_API_KEY
    if (!tavilyApiKey) {
      return {
        results: [],
        searchQuery: query,
        error: 'Web search not configured. TAVILY_API_KEY is not set.',
      }
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: searchDepth,
          max_results: Math.min(maxResults, 10),
          include_answer: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          results: [],
          searchQuery: query,
          error: `Tavily API error (${response.status}): ${errorText}`,
        }
      }

      const data = await response.json()

      return {
        results: (data.results ?? []).map((r: { title?: string; url?: string; content?: string; score?: number }) => ({
          title: r.title ?? '',
          url: r.url ?? '',
          content: r.content ?? '',
          score: r.score ?? 0,
        })),
        answer: data.answer,
        searchQuery: query,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        results: [],
        searchQuery: query,
        error: `Failed to perform web search: ${message}`,
      }
    }
  },
})
