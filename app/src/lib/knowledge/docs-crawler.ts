/**
 * Documentation Portal Crawler
 *
 * Crawling strategy:
 * 1. Fetch and parse sitemap.xml if available
 * 2. Fall back to crawling internal links from entry page
 * 3. Respect rate limiting to avoid overwhelming servers
 * 4. Extract text content from each page
 */

import { URL } from 'url'

export interface CrawlResult {
  url: string
  title: string
  content: string
  error?: string
}

export interface CrawlOptions {
  /** Maximum pages to crawl (default: 50) */
  maxPages?: number
  /** Milliseconds between requests (default: 500) */
  rateLimit?: number
  /** User agent string */
  userAgent?: string
  /** Request timeout in ms (default: 10000) */
  timeout?: number
  /** Maximum link crawling depth (default: 3) */
  maxDepth?: number
}

const DEFAULT_OPTIONS: Required<CrawlOptions> = {
  maxPages: 50,
  rateLimit: 500,
  userAgent: 'Mozilla/5.0 (compatible; HissunoBot/1.0; +https://hissuno.com)',
  timeout: 10000,
  maxDepth: 3,
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Normalize a URL by removing hash and trailing slash
 */
function normalizeUrl(url: string, origin: string): string | null {
  try {
    const parsed = new URL(url, origin)

    // Only include same-origin URLs
    if (parsed.origin !== new URL(origin).origin) {
      return null
    }

    // Remove hash
    parsed.hash = ''

    // Remove trailing slash (except for root)
    let normalized = parsed.href
    if (normalized.endsWith('/') && normalized !== parsed.origin + '/') {
      normalized = normalized.slice(0, -1)
    }

    return normalized
  } catch {
    return null
  }
}

/**
 * Parse sitemap.xml and extract URLs
 */
async function parseSitemap(baseUrl: string, options: Required<CrawlOptions>): Promise<string[]> {
  const urls: string[] = []
  const origin = new URL(baseUrl).origin

  // Common sitemap locations
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/docs/sitemap.xml`,
    `${origin}/documentation/sitemap.xml`,
  ]

  for (const sitemapUrl of sitemapUrls) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), options.timeout)

      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': options.userAgent },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) continue

      const xml = await response.text()

      // Check if this is a sitemap index (contains other sitemaps)
      if (xml.includes('<sitemapindex')) {
        const sitemapLocs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
        const childSitemaps: string[] = []
        for (const match of sitemapLocs) {
          if (match[1].endsWith('.xml')) {
            childSitemaps.push(match[1].trim())
          }
        }

        // Parse child sitemaps
        for (const childUrl of childSitemaps.slice(0, 5)) {
          // Limit child sitemaps
          try {
            const childController = new AbortController()
            const childTimeoutId = setTimeout(() => childController.abort(), options.timeout)

            const childResponse = await fetch(childUrl, {
              headers: { 'User-Agent': options.userAgent },
              signal: childController.signal,
            })

            clearTimeout(childTimeoutId)

            if (childResponse.ok) {
              const childXml = await childResponse.text()
              const childUrls = Array.from(childXml.matchAll(/<loc>([^<]+)<\/loc>/g))
              for (const urlMatch of childUrls) {
                const url = urlMatch[1].trim()
                if (url.startsWith(origin) && !url.match(/\.(jpg|png|gif|pdf|zip|xml)$/i)) {
                  urls.push(url)
                }
              }
            }
          } catch {
            // Skip failed child sitemap
          }
        }
      } else {
        // Regular sitemap
        const urlMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
        for (const match of urlMatches) {
          const url = match[1].trim()
          if (url.startsWith(origin) && !url.match(/\.(jpg|png|gif|pdf|zip|xml)$/i)) {
            urls.push(url)
          }
        }
      }

      if (urls.length > 0) {
        console.log(`[docs-crawler] Found ${urls.length} URLs in sitemap: ${sitemapUrl}`)
        break
      }
    } catch {
      // Sitemap not found or failed, continue to next
    }
  }

  return urls
}

/**
 * Extract internal links from HTML content
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: Set<string> = new Set()

  // Match href attributes
  const hrefMatches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))

  for (const match of hrefMatches) {
    const href = match[1]

    // Skip anchors, external links, and non-html resources
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      href.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|ico|woff|woff2|ttf|eot)$/i)
    ) {
      continue
    }

    const normalized = normalizeUrl(href, baseUrl)
    if (normalized) {
      links.add(normalized)
    }
  }

  return Array.from(links)
}

/**
 * Extract text content from HTML
 */
function extractTextContent(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch?.[1]?.trim() ?? ''

  // Remove unwanted elements
  let content = html
    // Remove scripts and styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove navigation elements
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')

  // Try to focus on main content
  const mainMatch =
    content.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    content.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    content.match(/<div[^>]*class="[^"]*(?:content|main|docs|documentation)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)

  if (mainMatch) {
    content = mainMatch[1]
  }

  // Strip remaining HTML tags and decode entities
  content = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim()

  return { title, content }
}

/**
 * Fetch a single page and extract content
 */
async function fetchPage(
  url: string,
  options: Required<CrawlOptions>
): Promise<{ result: CrawlResult; links: string[] }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout)

    const response = await fetch(url, {
      headers: {
        'User-Agent': options.userAgent,
        Accept: 'text/html',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        result: { url, title: '', content: '', error: `HTTP ${response.status}` },
        links: [],
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return {
        result: { url, title: '', content: '', error: 'Not HTML' },
        links: [],
      }
    }

    const html = await response.text()
    const { title, content } = extractTextContent(html)
    const links = extractLinks(html, url)

    return {
      result: { url, title, content },
      links,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      result: { url, title: '', content: '', error: message },
      links: [],
    }
  }
}

/**
 * Crawl a documentation portal
 *
 * @param entryUrl - The entry URL to start crawling from
 * @param options - Crawling options
 * @returns Array of crawl results
 */
export async function crawlDocsPortal(entryUrl: string, options: CrawlOptions = {}): Promise<CrawlResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const results: CrawlResult[] = []
  const visited: Set<string> = new Set()
  const queue: Array<{ url: string; depth: number }> = []

  console.log(`[docs-crawler] Starting crawl of ${entryUrl}`)

  // Normalize entry URL
  const normalizedEntry = normalizeUrl(entryUrl, entryUrl)
  if (!normalizedEntry) {
    return [{ url: entryUrl, title: '', content: '', error: 'Invalid URL' }]
  }

  // First, try to get URLs from sitemap
  const sitemapUrls = await parseSitemap(normalizedEntry, opts)

  if (sitemapUrls.length > 0) {
    // Use sitemap URLs
    console.log(`[docs-crawler] Using ${Math.min(sitemapUrls.length, opts.maxPages)} URLs from sitemap`)
    for (const url of sitemapUrls.slice(0, opts.maxPages)) {
      queue.push({ url, depth: 0 })
    }
  } else {
    // Fall back to crawling from entry URL
    console.log(`[docs-crawler] No sitemap found, crawling from entry URL`)
    queue.push({ url: normalizedEntry, depth: 0 })
  }

  while (queue.length > 0 && results.length < opts.maxPages) {
    const item = queue.shift()!
    const { url, depth } = item

    // Skip if already visited
    if (visited.has(url)) continue
    visited.add(url)

    // Rate limiting
    if (results.length > 0) {
      await sleep(opts.rateLimit)
    }

    const { result, links } = await fetchPage(url, opts)

    // Only add if we got meaningful content
    if (!result.error && result.content.length > 100) {
      results.push(result)
      console.log(`[docs-crawler] Crawled: ${url} (${result.content.length} chars)`)

      // If not using sitemap and within depth limit, queue discovered links
      if (sitemapUrls.length === 0 && depth < opts.maxDepth) {
        for (const link of links) {
          if (!visited.has(link) && !queue.some((q) => q.url === link)) {
            queue.push({ url: link, depth: depth + 1 })
          }
        }
      }
    } else if (result.error) {
      console.log(`[docs-crawler] Skipped: ${url} (${result.error})`)
    }
  }

  console.log(`[docs-crawler] Completed. Crawled ${results.length} pages from ${visited.size} visited`)
  return results
}

/**
 * Combine crawl results into structured content
 */
export function combineCrawlResults(results: CrawlResult[]): string {
  const successfulPages = results.filter((r) => !r.error && r.content)

  if (successfulPages.length === 0) {
    return ''
  }

  return successfulPages.map((page) => `## ${page.title || page.url}\n\nSource: ${page.url}\n\n${page.content}`).join('\n\n---\n\n')
}
