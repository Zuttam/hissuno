import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * Fetch content from a URL
 */
export const fetchUrlContentTool = createTool({
  id: 'fetch-url-content',
  description: 'Fetch text content from a URL (website or documentation page)',
  inputSchema: z.object({
    url: z.string().url().describe('URL to fetch'),
    followLinks: z.boolean().optional().describe('Whether to extract and follow links'),
    maxDepth: z.number().optional().describe('Maximum link depth to follow'),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    links: z.array(z.string()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { url, followLinks = false } = context

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HissunoBot/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      if (!response.ok) {
        return {
          url,
          title: '',
          content: '',
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const html = await response.text()

      // Basic HTML to text extraction
      const { title, content, links } = extractTextFromHtml(html, url)

      return {
        url,
        title,
        content,
        links: followLinks ? links : undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch URL'
      return {
        url,
        title: '',
        content: '',
        error: message,
      }
    }
  },
})

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(
  html: string,
  baseUrl: string
): { title: string; content: string; links: string[] } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  // Remove scripts, styles, and other non-content elements
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Convert common elements to text equivalents
  content = content
    .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, ' ')

  // Clean up whitespace
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Extract links
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi
  const links: string[] = []
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    if (href.startsWith('/')) {
      // Relative URL
      try {
        const baseUrlObj = new URL(baseUrl)
        links.push(`${baseUrlObj.origin}${href}`)
      } catch {
        // Invalid URL
      }
    } else if (href.startsWith('http')) {
      links.push(href)
    }
  }

  // Deduplicate links
  const uniqueLinks = [...new Set(links)]

  return { title, content, links: uniqueLinks }
}

/**
 * Crawl a website to extract content from multiple pages
 */
export const crawlWebsiteTool = createTool({
  id: 'crawl-website',
  description: 'Crawl a website to extract content from multiple pages',
  inputSchema: z.object({
    startUrl: z.string().url().describe('Starting URL to crawl'),
    maxPages: z.number().optional().describe('Maximum number of pages to crawl'),
    sameDomainOnly: z.boolean().optional().describe('Only crawl pages on the same domain'),
  }),
  outputSchema: z.object({
    pages: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        content: z.string(),
      })
    ),
    errors: z.array(
      z.object({
        url: z.string(),
        error: z.string(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const { startUrl, maxPages = 10, sameDomainOnly = true } = context

    const visited = new Set<string>()
    const toVisit = [startUrl]
    const pages: Array<{ url: string; title: string; content: string }> = []
    const errors: Array<{ url: string; error: string }> = []

    const startDomain = new URL(startUrl).hostname

    while (toVisit.length > 0 && pages.length < maxPages) {
      const url = toVisit.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      try {
        // Check domain
        if (sameDomainOnly && new URL(url).hostname !== startDomain) {
          continue
        }

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HissunoBot/1.0)',
            Accept: 'text/html,application/xhtml+xml',
          },
        })

        if (!response.ok) {
          errors.push({ url, error: `HTTP ${response.status}` })
          continue
        }

        const html = await response.text()
        const { title, content, links } = extractTextFromHtml(html, url)

        pages.push({ url, title, content })

        // Add new links to visit
        for (const link of links) {
          if (!visited.has(link) && !toVisit.includes(link)) {
            toVisit.push(link)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ url, error: message })
      }
    }

    return { pages, errors }
  },
})
