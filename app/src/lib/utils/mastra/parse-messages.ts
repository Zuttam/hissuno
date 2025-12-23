import type { ChatMessage } from '@/types/session'

/**
 * Mastra message format (simplified type based on storage schema)
 * threadId is optional as some Mastra versions may not include it
 */
interface MastraMessage {
  id: string
  threadId?: string
  role: string
  content: unknown
  resourceId?: string
  createdAt?: Date | string
}

/**
 * Transforms Mastra's internal message format to a clean frontend-friendly format.
 * Filters to only user and assistant messages, normalizes content, and sorts chronologically.
 */
export function parseMastraMessages(mastraMessages: MastraMessage[]): ChatMessage[] {
  if (!Array.isArray(mastraMessages)) {
    return []
  }

  return mastraMessages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: extractContent(msg.content),
      createdAt: normalizeDate(msg.createdAt),
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Extracts string content from various Mastra content formats.
 * Mastra stores content in different formats depending on the source.
 */
function extractContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    // Content might be an array of content parts
    return content
      .map(part => {
        if (typeof part === 'string') return part
        if (typeof part === 'object' && part !== null) {
          if ('text' in part) return String(part.text)
          if ('content' in part) return String(part.content)
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  if (typeof content === 'object' && content !== null) {
    // Try common content field names
    const obj = content as Record<string, unknown>
    if ('content' in obj && typeof obj.content === 'string') {
      return obj.content
    }
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text
    }
    if ('message' in obj && typeof obj.message === 'string') {
      return obj.message
    }
    // Last resort: stringify the object
    try {
      return JSON.stringify(content)
    } catch {
      return '[Unable to parse content]'
    }
  }

  return String(content ?? '')
}

/**
 * Normalizes a date to ISO string format.
 */
function normalizeDate(date: Date | string | undefined): string {
  if (!date) {
    return new Date().toISOString()
  }
  if (date instanceof Date) {
    return date.toISOString()
  }
  // Try to parse string date
  try {
    return new Date(date).toISOString()
  } catch {
    return new Date().toISOString()
  }
}
