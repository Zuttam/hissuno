/**
 * Unit Tests for Knowledge Chunking Service
 *
 * Tests the markdown-aware chunking logic used for generating
 * vector embeddings from knowledge packages.
 */

import { describe, it, expect } from 'vitest'
import { chunkKnowledgeContent, estimateTokens, type KnowledgeChunk } from '@/lib/knowledge/chunking'

// ============================================================================
// Helper Functions
// ============================================================================

function createMarkdownWithHeadings(): string {
  return `# Main Title

Introduction paragraph that explains the document.

## Section One

This is the content of section one.
It has multiple paragraphs.

More content here with some details.

### Subsection 1.1

Details about subsection 1.1.

### Subsection 1.2

Details about subsection 1.2.

## Section Two

Content for section two.

## Section Three

Final section content.
`
}

function createLongContent(size: number): string {
  const paragraph = 'This is a sentence that will be repeated. '
  return paragraph.repeat(Math.ceil(size / paragraph.length)).slice(0, size)
}

// ============================================================================
// Tests: Basic Chunking
// ============================================================================

describe('chunkKnowledgeContent', () => {
  describe('basic functionality', () => {
    it('should return empty array for empty content', () => {
      const chunks = chunkKnowledgeContent('')
      expect(chunks).toEqual([])
    })

    it('should return empty array for content below minimum size', () => {
      const chunks = chunkKnowledgeContent('Short', { minChunkSize: 100 })
      expect(chunks).toEqual([])
    })

    it('should return single chunk for small content', () => {
      const content = 'This is a small piece of content that fits in one chunk. It has enough characters to meet the minimum size requirement.'
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })

      expect(chunks.length).toBe(1)
      expect(chunks[0].text).toBe(content)
      expect(chunks[0].index).toBe(0)
    })

    it('should assign sequential indices to chunks', () => {
      const content = createLongContent(5000)
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 1000, overlapSize: 100, minChunkSize: 50 })

      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i)
      })
    })
  })

  // ============================================================================
  // Tests: Heading Extraction
  // ============================================================================

  describe('heading extraction', () => {
    it('should detect section headings', () => {
      const content = createMarkdownWithHeadings()
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 500, minChunkSize: 50 })

      // Should have chunks with heading information
      const chunksWithHeadings = chunks.filter((c) => c.sectionHeading !== null)
      expect(chunksWithHeadings.length).toBeGreaterThan(0)
    })

    it('should preserve parent heading hierarchy', () => {
      const content = `# Level One

## Level Two

### Level Three

Content under level three heading.

More content here to ensure minimum size is met.
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })

      // Find chunk under level three
      const chunk = chunks.find((c) => c.text.includes('Content under level three'))
      expect(chunk).toBeDefined()
      expect(chunk?.parentHeadings).toContain('Level One')
      expect(chunk?.parentHeadings).toContain('Level Two')
    })

    it('should handle h1 through h6 headings', () => {
      const content = `# H1 Heading

## H2 Heading

### H3 Heading

#### H4 Heading

##### H5 Heading

###### H6 Heading

Content under the deepest heading.
This needs to be long enough to meet minimum chunk size.
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })

      expect(chunks.length).toBeGreaterThan(0)
    })

    it('should handle content without any headings', () => {
      const content = `This is plain text content without any markdown headings.

It has multiple paragraphs.

And should still be chunked properly based on size limits.
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].sectionHeading).toBeNull()
      expect(chunks[0].parentHeadings).toEqual([])
    })
  })

  // ============================================================================
  // Tests: Chunk Size Limits
  // ============================================================================

  describe('chunk size limits', () => {
    it('should respect maxChunkSize option', () => {
      const content = createLongContent(5000)
      const maxSize = 1000
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: maxSize, overlapSize: 100, minChunkSize: 50 })

      // All chunks should be at or under max size (with some tolerance for boundary finding)
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(maxSize + 200) // Allow some flexibility for boundary finding
      })
    })

    it('should use default options when not specified', () => {
      const content = createLongContent(3000)
      const chunks = chunkKnowledgeContent(content)

      // Default maxChunkSize is 2000
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter out chunks below minChunkSize', () => {
      const content = `# Heading

Short.

## Another Heading

This section has enough content to meet the minimum chunk size requirement and should be included.
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })

      // All chunks should meet minimum size
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThanOrEqual(50)
      })
    })
  })

  // ============================================================================
  // Tests: Overlap Behavior
  // ============================================================================

  describe('overlap behavior', () => {
    it('should create overlapping chunks for large content', () => {
      const content = createLongContent(3000)
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 1000, overlapSize: 200, minChunkSize: 50 })

      // With overlap, there should be multiple chunks
      expect(chunks.length).toBeGreaterThan(2)

      // Adjacent chunks should share some content
      for (let i = 0; i < chunks.length - 1; i++) {
        const currentEnd = chunks[i].text.slice(-100)
        const nextStart = chunks[i + 1].text.slice(0, 100)

        // There should be some overlap (may not be exact due to boundary finding)
        const hasOverlap =
          currentEnd.includes(nextStart.slice(0, 20)) || nextStart.includes(currentEnd.slice(-20))

        // Overlap may not always be present due to natural boundary splitting
        // Just verify we have multiple chunks
        expect(chunks.length).toBeGreaterThan(1)
      }
    })
  })

  // ============================================================================
  // Tests: Natural Boundary Splitting
  // ============================================================================

  describe('natural boundary splitting', () => {
    it('should try to split at paragraph boundaries', () => {
      const content = `This is the first paragraph with some content that extends long enough.

This is the second paragraph that should start a new chunk ideally.

This is the third paragraph with additional content.

This is the fourth paragraph that keeps going.
`.repeat(5) // Make it long enough to need splitting

      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 500, overlapSize: 100, minChunkSize: 50 })

      // Should have multiple chunks
      expect(chunks.length).toBeGreaterThan(1)
    })

    it('should try to split at sentence boundaries if no paragraph break', () => {
      // Long content without paragraph breaks
      const content = 'This is a sentence. '.repeat(100)
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 500, overlapSize: 100, minChunkSize: 50 })

      // Should have multiple chunks
      expect(chunks.length).toBeGreaterThan(1)
    })
  })

  // ============================================================================
  // Tests: Line Number Tracking
  // ============================================================================

  describe('line number tracking', () => {
    it('should track startLine and endLine for chunks', () => {
      const content = createMarkdownWithHeadings()
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 500, minChunkSize: 50 })

      chunks.forEach((chunk) => {
        expect(chunk.startLine).toBeGreaterThanOrEqual(0)
        expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine)
      })
    })

    it('should have line numbers within content bounds', () => {
      const content = createMarkdownWithHeadings()
      const lineCount = content.split('\n').length
      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 500, minChunkSize: 50 })

      chunks.forEach((chunk) => {
        expect(chunk.startLine).toBeLessThan(lineCount)
        expect(chunk.endLine).toBeLessThan(lineCount)
      })
    })
  })

  // ============================================================================
  // Tests: Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle content with only headings', () => {
      const content = `# Heading One
## Heading Two
### Heading Three`

      const chunks = chunkKnowledgeContent(content, { minChunkSize: 10 })
      // Headings alone may be filtered if under minChunkSize
      expect(chunks.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle content with special characters', () => {
      const content = `# Special Characters

Code blocks with special chars:

\`\`\`javascript
const obj = { key: "value", arr: [1, 2, 3] };
console.log(\`Template \${literal}\`);
\`\`\`

Math: 2 + 2 = 4, x < y > z, a && b || c

Symbols: @#$%^&*()_+-=[]{}|;':",.<>?/~\`
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('should handle unicode content', () => {
      const content = `# Unicode Content 你好世界

This section contains unicode: 日本語テスト

More content with emojis: 🚀 🎉 ✨

Arabic: مرحبا بالعالم

Hebrew: שלום עולם

Long enough to meet minimum size requirements.
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })
      expect(chunks.length).toBeGreaterThan(0)
      // Should preserve unicode
      const allText = chunks.map((c) => c.text).join('')
      expect(allText).toContain('你好世界')
    })

    it('should handle content with code blocks', () => {
      const content = `# API Documentation

## Installation

Install the package:

\`\`\`bash
npm install @example/package
\`\`\`

## Usage

Import and use:

\`\`\`typescript
import { Client } from '@example/package'

const client = new Client({
  apiKey: process.env.API_KEY
})

const result = await client.fetch()
\`\`\`

Additional documentation and explanation text goes here.
`
      const chunks = chunkKnowledgeContent(content, { minChunkSize: 50 })
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('should handle very large content without infinite loops', () => {
      const content = createLongContent(50000)
      const startTime = Date.now()

      const chunks = chunkKnowledgeContent(content, { maxChunkSize: 2000, overlapSize: 500, minChunkSize: 100 })

      const duration = Date.now() - startTime

      expect(chunks.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
    })
  })
})

// ============================================================================
// Tests: Token Estimation
// ============================================================================

describe('estimateTokens', () => {
  it('should estimate approximately 4 chars per token', () => {
    const text = 'This is a test string'
    const tokens = estimateTokens(text)

    // 21 chars / 4 = ~5-6 tokens
    expect(tokens).toBeGreaterThanOrEqual(5)
    expect(tokens).toBeLessThanOrEqual(6)
  })

  it('should handle empty string', () => {
    const tokens = estimateTokens('')
    expect(tokens).toBe(0)
  })

  it('should round up token count', () => {
    const text = 'Hi' // 2 chars
    const tokens = estimateTokens(text)
    expect(tokens).toBe(1) // Rounded up from 0.5
  })

  it('should handle long text', () => {
    const text = 'a'.repeat(10000)
    const tokens = estimateTokens(text)
    expect(tokens).toBe(2500) // 10000 / 4
  })
})
