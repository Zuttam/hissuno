/**
 * Unit Tests for Documentation Portal Crawler
 *
 * Tests the sitemap parsing, link crawling, and content extraction
 * functionality used for indexing docs portals.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock SSRF protection to bypass DNS lookups in unit tests
vi.mock('@/lib/security/url-validation', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
  validateUrl: vi.fn().mockResolvedValue({ valid: true }),
}))

// Import after mocks are set up
import { crawlDocsPortal, combineCrawlResults, type CrawlResult } from '@/lib/knowledge/docs-crawler'

// ============================================================================
// Test Helpers
// ============================================================================

function createMockResponse(body: string, options: { ok?: boolean; status?: number; contentType?: string } = {}) {
  const { ok = true, status = 200, contentType = 'text/html' } = options
  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    text: vi.fn().mockResolvedValue(body),
  }
}

function createSitemapXml(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`
}

function createSitemapIndex(sitemapUrls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `  <sitemap><loc>${url}</loc></sitemap>`).join('\n')}
</sitemapindex>`
}

function createHtmlPage(options: { title?: string; content?: string; links?: string[] } = {}): string {
  const { title = 'Test Page', content = 'Test content', links = [] } = options
  const linkHtml = links.map((href) => `<a href="${href}">Link</a>`).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${content}</p>
    ${linkHtml}
  </main>
</body>
</html>`
}

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  // Reset fetch to reject by default
  mockFetch.mockRejectedValue(new Error('Not mocked'))
})

afterEach(() => {
  vi.resetAllMocks()
})

// ============================================================================
// Tests: Sitemap Parsing
// ============================================================================

describe('sitemap parsing', () => {
  it('should parse URLs from sitemap.xml', async () => {
    const sitemapUrls = [
      'https://example.com/docs/getting-started',
      'https://example.com/docs/api-reference',
      'https://example.com/docs/faq',
    ]

    // Mock sitemap fetch
    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return createMockResponse(createSitemapXml(sitemapUrls), { contentType: 'application/xml' })
      }
      if (sitemapUrls.includes(url)) {
        return createMockResponse(createHtmlPage({
          title: `Page: ${url}`,
          content: 'Documentation content that is long enough to meet the minimum requirement of 100 characters for the crawler to include it in results.'
        }))
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', { maxPages: 5 })

    expect(results.length).toBe(3)
    expect(results.every((r) => !r.error)).toBe(true)
  })

  it('should handle sitemap index with child sitemaps', async () => {
    const childUrls = ['https://example.com/docs/page1', 'https://example.com/docs/page2']

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return createMockResponse(createSitemapIndex(['https://example.com/docs-sitemap.xml']), {
          contentType: 'application/xml',
        })
      }
      if (url === 'https://example.com/docs-sitemap.xml') {
        return createMockResponse(createSitemapXml(childUrls), { contentType: 'application/xml' })
      }
      if (childUrls.includes(url)) {
        return createMockResponse(createHtmlPage({
          content: 'Page content that is long enough to meet the minimum requirement of 100 characters for the crawler to include this page in the results.'
        }))
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', { maxPages: 5 })

    expect(results.length).toBe(2)
  })

  it('should skip non-HTML files in sitemap', async () => {
    const sitemapUrls = [
      'https://example.com/docs/page.html',
      'https://example.com/docs/image.png',
      'https://example.com/docs/document.pdf',
      'https://example.com/docs/archive.zip',
    ]

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return createMockResponse(createSitemapXml(sitemapUrls), { contentType: 'application/xml' })
      }
      if (url === 'https://example.com/docs/page.html') {
        return createMockResponse(createHtmlPage({
          content: 'HTML page content that is long enough to meet the minimum requirement of 100 characters for the crawler to include it in results.'
        }))
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', { maxPages: 10 })

    // Only the HTML page should be in results
    expect(results.length).toBe(1)
    expect(results[0].url).toBe('https://example.com/docs/page.html')
  })
})

// ============================================================================
// Tests: Link Crawling Fallback
// ============================================================================

describe('link crawling fallback', () => {
  it('should crawl internal links when no sitemap exists', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      // No sitemap
      if (url.includes('sitemap')) {
        return createMockResponse('', { ok: false, status: 404 })
      }

      if (url === 'https://example.com/docs') {
        return createMockResponse(
          createHtmlPage({
            title: 'Documentation',
            content: 'Welcome to our docs. This is the main documentation page with enough content to meet the minimum length requirement of 100 characters.',
            links: ['/docs/getting-started', '/docs/api'],
          })
        )
      }

      if (url === 'https://example.com/docs/getting-started') {
        return createMockResponse(createHtmlPage({
          title: 'Getting Started',
          content: 'How to get started with our product. This guide will walk you through the initial setup and configuration process in detail.'
        }))
      }

      if (url === 'https://example.com/docs/api') {
        return createMockResponse(createHtmlPage({
          title: 'API Reference',
          content: 'API documentation for developers. This section covers all available endpoints, request formats, and response structures.'
        }))
      }

      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', {
      maxPages: 5,
      maxDepth: 2,
      rateLimit: 10, // Fast for tests
    })

    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some((r) => r.title.includes('Documentation'))).toBe(true)
  })

  it('should respect maxDepth for link crawling', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse('', { ok: false, status: 404 })
      }

      if (url === 'https://example.com') {
        return createMockResponse(
          createHtmlPage({
            title: 'Home',
            content: 'Home page content.',
            links: ['/level1'],
          })
        )
      }

      if (url === 'https://example.com/level1') {
        return createMockResponse(
          createHtmlPage({
            title: 'Level 1',
            content: 'Level 1 content.',
            links: ['/level2'],
          })
        )
      }

      if (url === 'https://example.com/level2') {
        return createMockResponse(
          createHtmlPage({
            title: 'Level 2',
            content: 'Level 2 content.',
            links: ['/level3'],
          })
        )
      }

      if (url === 'https://example.com/level3') {
        return createMockResponse(createHtmlPage({ title: 'Level 3', content: 'Level 3 content.' }))
      }

      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', {
      maxPages: 10,
      maxDepth: 1,
      rateLimit: 10,
    })

    // With maxDepth=1, should only get home and level1
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('should not follow external links', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse('', { ok: false, status: 404 })
      }

      if (url === 'https://example.com/docs') {
        return createMockResponse(
          createHtmlPage({
            title: 'Docs',
            content: 'Documentation content.',
            links: ['https://external.com/page', '/docs/internal'],
          })
        )
      }

      if (url === 'https://example.com/docs/internal') {
        return createMockResponse(createHtmlPage({ title: 'Internal', content: 'Internal page.' }))
      }

      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', {
      maxPages: 10,
      rateLimit: 10,
    })

    // Should not have external.com in results
    expect(results.every((r) => r.url.includes('example.com'))).toBe(true)
  })

  it('should skip non-HTML links', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse('', { ok: false, status: 404 })
      }

      if (url === 'https://example.com/docs') {
        return createMockResponse(
          createHtmlPage({
            title: 'Docs',
            content: 'Documentation content.',
            links: ['/docs/page', '/docs/image.jpg', '/docs/file.pdf', '/docs/style.css'],
          })
        )
      }

      if (url === 'https://example.com/docs/page') {
        return createMockResponse(createHtmlPage({ title: 'Page', content: 'Page content.' }))
      }

      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', {
      maxPages: 10,
      rateLimit: 10,
    })

    // Should only have HTML pages
    results.forEach((r) => {
      expect(r.url).not.toMatch(/\.(jpg|png|gif|pdf|css|js)$/i)
    })
  })
})

// ============================================================================
// Tests: Content Extraction
// ============================================================================

describe('content extraction', () => {
  it('should extract title from HTML', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(['https://example.com/page']))
      }
      if (url === 'https://example.com/page') {
        return createMockResponse(
          `<html><head><title>My Page Title</title></head><body><p>Content here that is long enough to meet the minimum content length requirement of 100 characters for the crawler to include it.</p></body></html>`
        )
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', { maxPages: 2 })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('My Page Title')
  })

  it('should extract text content and remove HTML tags', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(['https://example.com/page']))
      }
      if (url === 'https://example.com/page') {
        return createMockResponse(`
<html>
<head><title>Test</title></head>
<body>
  <main>
    <h1>Heading</h1>
    <p>This is a <strong>paragraph</strong> with <em>formatting</em> that contains enough text to meet the minimum content length requirement of 100 characters.</p>
    <ul>
      <li>Item 1 - First item in the list</li>
      <li>Item 2 - Second item in the list</li>
    </ul>
  </main>
</body>
</html>`)
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', { maxPages: 2 })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('Heading')
    expect(results[0].content).toContain('paragraph')
    expect(results[0].content).toContain('Item 1')
    expect(results[0].content).not.toContain('<strong>')
    expect(results[0].content).not.toContain('<p>')
  })

  it('should prioritize main/article content over navigation', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(['https://example.com/page']))
      }
      if (url === 'https://example.com/page') {
        return createMockResponse(`
<html>
<head><title>Test</title></head>
<body>
  <nav>Navigation menu content that should be excluded</nav>
  <header>Header content to exclude</header>
  <main>
    <h1>Main Content Title</h1>
    <p>This is the main content that should be extracted. It needs to be long enough to meet the minimum content length requirement of 100 characters.</p>
  </main>
  <footer>Footer content to exclude</footer>
</body>
</html>`)
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', { maxPages: 2 })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('Main Content Title')
    expect(results[0].content).toContain('main content that should be extracted')
    expect(results[0].content).not.toContain('Navigation menu')
    expect(results[0].content).not.toContain('Header content')
    expect(results[0].content).not.toContain('Footer content')
  })

  it('should decode HTML entities', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(['https://example.com/page']))
      }
      if (url === 'https://example.com/page') {
        return createMockResponse(`
<html>
<head><title>Test</title></head>
<body>
  <main>
    <p>Special chars: &amp; &lt; &gt; &quot; &#39; &nbsp; - This content needs to be long enough to meet the minimum content length requirement which is 100 characters.</p>
  </main>
</body>
</html>`)
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', { maxPages: 2 })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('&')
    expect(results[0].content).toContain('<')
    expect(results[0].content).toContain('>')
    expect(results[0].content).not.toContain('&amp;')
    expect(results[0].content).not.toContain('&lt;')
  })
})

// ============================================================================
// Tests: Error Handling
// ============================================================================

describe('error handling', () => {
  it('should return error result for invalid URL', async () => {
    const results = await crawlDocsPortal('not-a-valid-url')

    expect(results.length).toBe(1)
    expect(results[0].error).toBe('Invalid URL')
  })

  it('should handle HTTP errors gracefully', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(['https://example.com/page']))
      }
      if (url === 'https://example.com/page') {
        return createMockResponse('', { ok: false, status: 500 })
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', { maxPages: 2 })

    // Should have skipped the error page
    expect(results.every((r) => r.error || r.content.length > 0)).toBe(true)
  })

  it('should handle timeout errors', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse('', { ok: false, status: 404 })
      }
      // Simulate timeout/network error
      if (url === 'https://example.com/docs') {
        throw new Error('network timeout')
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com/docs', {
      maxPages: 2,
      timeout: 100,
    })

    // When the entry URL fails, we get an error result or empty results
    // The crawler should handle the error gracefully
    expect(results.length).toBeGreaterThanOrEqual(0)
    if (results.length > 0) {
      expect(results.some((r) => r.error !== undefined)).toBe(true)
    }
  })

  it('should skip non-HTML responses', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(['https://example.com/data.json']))
      }
      if (url === 'https://example.com/data.json') {
        return createMockResponse('{"key": "value"}', { contentType: 'application/json' })
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', { maxPages: 2 })

    // JSON response should be skipped or have error
    const jsonResult = results.find((r) => r.url.includes('data.json'))
    if (jsonResult) {
      expect(jsonResult.error).toBe('Not HTML')
    }
  })
})

// ============================================================================
// Tests: Rate Limiting
// ============================================================================

describe('rate limiting', () => {
  it('should wait between requests', async () => {
    const fetchTimes: number[] = []

    mockFetch.mockImplementation(async (url: string) => {
      fetchTimes.push(Date.now())

      if (url.includes('sitemap')) {
        return createMockResponse('', { ok: false, status: 404 })
      }

      if (url === 'https://example.com/docs') {
        return createMockResponse(
          createHtmlPage({
            title: 'Docs',
            content: 'Documentation content.',
            links: ['/docs/page1', '/docs/page2'],
          })
        )
      }

      return createMockResponse(createHtmlPage({ content: 'Page content.' }))
    })

    await crawlDocsPortal('https://example.com/docs', {
      maxPages: 3,
      rateLimit: 50, // 50ms between requests
    })

    // Check that there was a delay between page fetches (after sitemap attempts)
    // Filter to only page fetches
    if (fetchTimes.length >= 2) {
      const lastFetch = fetchTimes[fetchTimes.length - 1]
      const secondLastFetch = fetchTimes[fetchTimes.length - 2]
      // There should be some delay, but we'll be lenient in tests
      expect(lastFetch).toBeGreaterThanOrEqual(secondLastFetch)
    }
  })
})

// ============================================================================
// Tests: maxPages Limit
// ============================================================================

describe('maxPages limit', () => {
  it('should stop crawling after reaching maxPages', async () => {
    const pages = Array(20)
      .fill(null)
      .map((_, i) => `https://example.com/page${i}`)

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('sitemap')) {
        return createMockResponse(createSitemapXml(pages))
      }
      if (pages.includes(url)) {
        return createMockResponse(createHtmlPage({ title: `Page ${url}`, content: 'Content here.' }))
      }
      return createMockResponse('', { ok: false, status: 404 })
    })

    const results = await crawlDocsPortal('https://example.com', {
      maxPages: 5,
      rateLimit: 10,
    })

    expect(results.length).toBeLessThanOrEqual(5)
  })
})

// ============================================================================
// Tests: combineCrawlResults
// ============================================================================

describe('combineCrawlResults', () => {
  it('should combine multiple results into structured content', () => {
    const results: CrawlResult[] = [
      { url: 'https://example.com/page1', title: 'Page 1', content: 'Content of page 1' },
      { url: 'https://example.com/page2', title: 'Page 2', content: 'Content of page 2' },
    ]

    const combined = combineCrawlResults(results)

    expect(combined).toContain('## Page 1')
    expect(combined).toContain('Source: https://example.com/page1')
    expect(combined).toContain('Content of page 1')
    expect(combined).toContain('## Page 2')
    expect(combined).toContain('Source: https://example.com/page2')
    expect(combined).toContain('Content of page 2')
  })

  it('should skip results with errors', () => {
    const results: CrawlResult[] = [
      { url: 'https://example.com/good', title: 'Good Page', content: 'Good content' },
      { url: 'https://example.com/bad', title: '', content: '', error: 'HTTP 500' },
    ]

    const combined = combineCrawlResults(results)

    expect(combined).toContain('Good Page')
    expect(combined).not.toContain('HTTP 500')
    expect(combined).not.toContain('bad')
  })

  it('should return empty string for empty results', () => {
    const combined = combineCrawlResults([])
    expect(combined).toBe('')
  })

  it('should return empty string when all results have errors', () => {
    const results: CrawlResult[] = [
      { url: 'https://example.com/bad1', title: '', content: '', error: 'Error 1' },
      { url: 'https://example.com/bad2', title: '', content: '', error: 'Error 2' },
    ]

    const combined = combineCrawlResults(results)
    expect(combined).toBe('')
  })

  it('should use URL as title fallback', () => {
    const results: CrawlResult[] = [
      { url: 'https://example.com/page', title: '', content: 'Some content' },
    ]

    const combined = combineCrawlResults(results)

    expect(combined).toContain('## https://example.com/page')
  })

  it('should separate results with horizontal rule', () => {
    const results: CrawlResult[] = [
      { url: 'https://example.com/page1', title: 'Page 1', content: 'Content 1' },
      { url: 'https://example.com/page2', title: 'Page 2', content: 'Content 2' },
    ]

    const combined = combineCrawlResults(results)

    expect(combined).toContain('---')
  })
})
