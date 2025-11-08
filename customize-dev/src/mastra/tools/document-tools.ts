import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import pdfParse from 'pdf-parse'

/**
 * Extract text content from a document
 * Supports: PDF, TXT, MD, and plain text
 */
export const extractDocumentTextTool = createTool({
  id: 'extract-document-text',
  description: 'Extract text content from a document file (PDF, TXT, MD)',
  inputSchema: z.object({
    content: z.string().describe('Base64 encoded file content or plain text'),
    mimeType: z.string().describe('MIME type of the document'),
    filename: z.string().optional().describe('Original filename for context'),
  }),
  outputSchema: z.object({
    text: z.string().describe('Extracted text content'),
    pageCount: z.number().optional().describe('Number of pages (for PDFs)'),
    metadata: z.record(z.string()).optional().describe('Document metadata'),
  }),
  execute: async ({ context }) => {
    const { content, mimeType, filename } = context

    // Handle plain text and markdown
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      // Check if content is base64 encoded
      const text = isBase64(content) ? Buffer.from(content, 'base64').toString('utf-8') : content
      return { text, metadata: { filename: filename ?? 'unknown' } }
    }

    // Handle PDF
    if (mimeType === 'application/pdf') {
      try {
        const pdfText = await extractPdfText(content)
        return pdfText
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return {
          text: `[PDF extraction failed: ${message}. Please ensure pdf-parse is installed.]`,
          metadata: { error: message, filename: filename ?? 'unknown' },
        }
      }
    }

    // Handle Word documents (basic support)
    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return {
        text: '[Word document extraction not yet supported. Please convert to PDF or text.]',
        metadata: { filename: filename ?? 'unknown', unsupported: 'true' },
      }
    }

    // Unknown format
    return {
      text: `[Unsupported document format: ${mimeType}]`,
      metadata: { filename: filename ?? 'unknown', unsupported: 'true' },
    }
  },
})

/**
 * Check if a string is base64 encoded
 */
function isBase64(str: string): boolean {
  if (str.length === 0) return false
  try {
    return Buffer.from(str, 'base64').toString('base64') === str
  } catch {
    return false
  }
}

/**
 * Extract text from PDF using pdf-parse
 */
async function extractPdfText(
  base64Content: string
): Promise<{ text: string; pageCount?: number; metadata?: Record<string, string> }> {
  try {
    const buffer = Buffer.from(base64Content, 'base64')
    const data = await pdfParse(buffer)

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        title: data.info?.Title ?? '',
        author: data.info?.Author ?? '',
        creator: data.info?.Creator ?? '',
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF parsing failed'
    throw new Error(message)
  }
}

/**
 * Analyze document structure and extract key sections
 */
export const analyzeDocumentStructureTool = createTool({
  id: 'analyze-document-structure',
  description: 'Analyze document structure to identify headers, sections, and key content',
  inputSchema: z.object({
    text: z.string().describe('Plain text content of the document'),
    documentType: z.enum(['general', 'technical', 'policy', 'faq', 'guide']).optional(),
  }),
  outputSchema: z.object({
    sections: z.array(
      z.object({
        title: z.string(),
        level: z.number(),
        content: z.string(),
      })
    ),
    summary: z.string(),
    keyTopics: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { text, documentType = 'general' } = context

    // Simple section extraction based on common patterns
    const sections = extractSections(text)
    const keyTopics = extractKeyTopics(text, documentType)
    const summary = generateSummary(text)

    return {
      sections,
      summary,
      keyTopics,
    }
  },
})

/**
 * Extract sections from text based on markdown-like headers
 */
function extractSections(text: string): Array<{ title: string; level: number; content: string }> {
  const lines = text.split('\n')
  const sections: Array<{ title: string; level: number; content: string }> = []
  let currentSection: { title: string; level: number; content: string[] } | null = null

  for (const line of lines) {
    // Check for markdown headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          level: currentSection.level,
          content: currentSection.content.join('\n').trim(),
        })
      }
      // Start new section
      currentSection = {
        title: headerMatch[2],
        level: headerMatch[1].length,
        content: [],
      }
    } else if (currentSection) {
      currentSection.content.push(line)
    } else {
      // Content before first header
      if (!sections.find((s) => s.title === 'Introduction')) {
        currentSection = {
          title: 'Introduction',
          level: 1,
          content: [line],
        }
      }
    }
  }

  // Save last section
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      level: currentSection.level,
      content: currentSection.content.join('\n').trim(),
    })
  }

  return sections.filter((s) => s.content.length > 0)
}

/**
 * Extract key topics based on document type
 */
function extractKeyTopics(text: string, documentType: string): string[] {
  const lowerText = text.toLowerCase()
  const topics: string[] = []

  // Common topic patterns by type
  const patterns: Record<string, RegExp[]> = {
    general: [/\b(?:important|key|main|primary)\b/gi],
    technical: [/\b(?:api|endpoint|function|method|class|interface)\b/gi],
    policy: [/\b(?:policy|rule|requirement|compliance|regulation)\b/gi],
    faq: [/\b(?:question|answer|how to|what is|why)\b/gi],
    guide: [/\b(?:step|guide|tutorial|instructions|how to)\b/gi],
  }

  // Extract sentences containing pattern matches
  const sentences = text.split(/[.!?]+/)
  const typePatterns = patterns[documentType] || patterns.general

  for (const sentence of sentences.slice(0, 50)) {
    // Limit to first 50 sentences
    for (const pattern of typePatterns) {
      if (pattern.test(sentence)) {
        const trimmed = sentence.trim()
        if (trimmed.length > 10 && trimmed.length < 200) {
          topics.push(trimmed)
          break
        }
      }
    }
  }

  return topics.slice(0, 10) // Limit to 10 topics
}

/**
 * Generate a brief summary of the text
 */
function generateSummary(text: string): string {
  // Simple extractive summary: first paragraph or first 500 chars
  const paragraphs = text.split(/\n\n+/)
  const firstParagraph = paragraphs.find((p) => p.trim().length > 50) || ''

  if (firstParagraph.length <= 500) {
    return firstParagraph.trim()
  }

  // Truncate to sentence boundary
  const truncated = firstParagraph.slice(0, 500)
  const lastPeriod = truncated.lastIndexOf('.')
  if (lastPeriod > 200) {
    return truncated.slice(0, lastPeriod + 1)
  }

  return truncated + '...'
}

/**
 * Read codebase files from a directory
 */
export const readCodebaseFilesTool = createTool({
  id: 'read-codebase-files',
  description: 'Read source code files from a directory path',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the codebase directory'),
    extensions: z
      .array(z.string())
      .optional()
      .describe('File extensions to include (e.g., [".ts", ".tsx"])'),
    maxFiles: z.number().optional().describe('Maximum number of files to read'),
    maxFileSize: z.number().optional().describe('Maximum file size in bytes'),
  }),
  outputSchema: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        content: z.string(),
        size: z.number(),
      })
    ),
    totalFiles: z.number(),
    skipped: z.number(),
  }),
  execute: async ({ context }) => {
    const {
      path: basePath,
      extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', '.yml'],
      maxFiles = 100,
      maxFileSize = 100000, // 100KB
    } = context

    try {
      const fs = await import('fs/promises')
      const pathModule = await import('path')

      const files: Array<{ path: string; content: string; size: number }> = []
      let skipped = 0

      async function walkDir(dir: string) {
        if (files.length >= maxFiles) return

        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          if (files.length >= maxFiles) break

          const fullPath = pathModule.join(dir, entry.name)
          const relativePath = pathModule.relative(basePath, fullPath)

          // Skip common non-source directories
          if (
            entry.isDirectory() &&
            ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)
          ) {
            continue
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath)
          } else if (entry.isFile()) {
            const ext = pathModule.extname(entry.name).toLowerCase()
            if (!extensions.includes(ext)) {
              skipped++
              continue
            }

            const stats = await fs.stat(fullPath)
            if (stats.size > maxFileSize) {
              skipped++
              continue
            }

            try {
              const content = await fs.readFile(fullPath, 'utf-8')
              files.push({
                path: relativePath,
                content,
                size: stats.size,
              })
            } catch {
              skipped++
            }
          }
        }
      }

      await walkDir(basePath)

      return {
        files,
        totalFiles: files.length,
        skipped,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read codebase'
      return {
        files: [],
        totalFiles: 0,
        skipped: 0,
      }
    }
  },
})
