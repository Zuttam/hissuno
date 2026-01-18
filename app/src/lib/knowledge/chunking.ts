/**
 * Markdown-aware chunking for knowledge packages
 *
 * Strategy:
 * 1. Parse markdown to extract heading hierarchy
 * 2. Split content into semantic sections based on headings
 * 3. Further split large sections with overlap
 * 4. Preserve heading context for each chunk
 */

export interface KnowledgeChunk {
  index: number
  text: string
  startLine: number
  endLine: number
  sectionHeading: string | null
  parentHeadings: string[]
}

export interface ChunkingOptions {
  /** Max characters per chunk (default 2000, ~512 tokens) */
  maxChunkSize?: number
  /** Overlap characters between chunks (default 500, ~128 tokens) */
  overlapSize?: number
  /** Minimum chunk size to keep (default 100) */
  minChunkSize?: number
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 2000,
  overlapSize: 500,
  minChunkSize: 100,
}

interface HeadingNode {
  level: number
  text: string
  lineNumber: number
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(content: string): HeadingNode[] {
  const lines = content.split('\n')
  const headings: HeadingNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        lineNumber: i,
      })
    }
  }

  return headings
}

/**
 * Get parent headings for a given line number
 * Returns headings in hierarchical order (h1 first)
 */
function getParentHeadings(headings: HeadingNode[], lineNumber: number): string[] {
  const parents: string[] = []
  let lastLevel = 7 // Start higher than any heading level

  // Find headings before this line, working backwards
  const relevantHeadings = headings.filter((h) => h.lineNumber < lineNumber).reverse()

  for (const heading of relevantHeadings) {
    if (heading.level < lastLevel) {
      parents.unshift(heading.text)
      lastLevel = heading.level
      if (lastLevel === 1) break
    }
  }

  return parents
}

/**
 * Find the nearest heading above a given line
 */
function getNearestHeading(headings: HeadingNode[], lineNumber: number): string | null {
  const above = headings.filter((h) => h.lineNumber <= lineNumber).sort((a, b) => b.lineNumber - a.lineNumber)

  return above[0]?.text ?? null
}

/**
 * Split text into chunks with overlap, trying to respect natural boundaries
 */
function splitWithOverlap(text: string, maxSize: number, overlapSize: number): string[] {
  if (text.length <= maxSize) return [text]

  const chunks: string[] = []
  let start = 0
  let prevStart = -1

  while (start < text.length) {
    // Prevent infinite loops - if start hasn't moved forward, break
    if (start <= prevStart) {
      // Force progress by moving to the end of the current chunk
      start = prevStart + maxSize
      if (start >= text.length) break
    }
    prevStart = start

    let end = Math.min(start + maxSize, text.length)
    const originalEnd = end

    // If we're not at the end, try to split at a natural boundary
    if (end < text.length) {
      // Look for paragraph boundary within the last 200 chars
      const searchStart = Math.max(start, end - 200)
      const searchEnd = Math.min(text.length, end + 200)
      const searchText = text.slice(searchStart, searchEnd)
      const paraBreak = searchText.indexOf('\n\n')

      if (paraBreak !== -1 && searchStart + paraBreak > start && searchStart + paraBreak < end + 200) {
        end = searchStart + paraBreak + 2
      } else {
        // Fall back to sentence boundary
        const sentenceSearchStart = Math.max(start, end - 100)
        const sentenceSearchEnd = Math.min(text.length, end + 100)
        const sentenceText = text.slice(sentenceSearchStart, sentenceSearchEnd)
        const sentenceMatch = sentenceText.match(/[.!?]\s/)
        if (sentenceMatch && sentenceMatch.index !== undefined) {
          const newEnd = sentenceSearchStart + sentenceMatch.index + 2
          if (newEnd > start) {
            end = newEnd
          }
        }
      }
    }

    // Ensure end is always after start
    if (end <= start) {
      end = originalEnd
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Move start forward, accounting for overlap
    // But ensure we always make forward progress
    const nextStart = end - overlapSize
    if (nextStart <= start) {
      start = end // No overlap, just continue from end
    } else {
      start = nextStart
    }
  }

  return chunks
}

/**
 * Main chunking function for knowledge packages
 *
 * @param content - The markdown content to chunk
 * @param options - Chunking options
 * @returns Array of chunks with metadata
 */
export function chunkKnowledgeContent(content: string, options: ChunkingOptions = {}): KnowledgeChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chunks: KnowledgeChunk[] = []
  const headings = extractHeadings(content)
  const lines = content.split('\n')

  // Define sections by splitting on headings
  interface Section {
    startLine: number
    endLine: number
    content: string
    heading: string | null
  }

  const sections: Section[] = []
  let currentStart = 0

  // Create sections based on headings
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]

    // Add content before this heading as a section (if any)
    if (heading.lineNumber > currentStart) {
      const sectionContent = lines.slice(currentStart, heading.lineNumber).join('\n').trim()
      if (sectionContent.length >= opts.minChunkSize) {
        sections.push({
          startLine: currentStart,
          endLine: heading.lineNumber - 1,
          content: sectionContent,
          heading: getNearestHeading(headings, currentStart),
        })
      }
    }
    currentStart = heading.lineNumber
  }

  // Add final section (from last heading to end)
  if (currentStart < lines.length) {
    const sectionContent = lines.slice(currentStart).join('\n').trim()
    if (sectionContent.length >= opts.minChunkSize) {
      sections.push({
        startLine: currentStart,
        endLine: lines.length - 1,
        content: sectionContent,
        heading: getNearestHeading(headings, currentStart),
      })
    }
  }

  // If no sections created, treat entire content as one section
  if (sections.length === 0 && content.trim().length >= opts.minChunkSize) {
    sections.push({
      startLine: 0,
      endLine: lines.length - 1,
      content: content.trim(),
      heading: null,
    })
  }

  // Process each section into chunks
  let chunkIndex = 0
  for (const section of sections) {
    const subChunks = splitWithOverlap(section.content, opts.maxChunkSize, opts.overlapSize)

    for (const subChunk of subChunks) {
      if (subChunk.trim().length < opts.minChunkSize) continue

      chunks.push({
        index: chunkIndex++,
        text: subChunk.trim(),
        startLine: section.startLine,
        endLine: section.endLine,
        sectionHeading: section.heading,
        parentHeadings: getParentHeadings(headings, section.startLine),
      })
    }
  }

  return chunks
}

/**
 * Estimate token count for text (rough approximation)
 * OpenAI models use ~4 chars per token on average for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
