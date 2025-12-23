'use client'

import { useState, type ReactNode } from 'react'

interface ProductSpecViewProps {
  spec: string
  generatedAt: string | null
}

export function ProductSpecView({ spec, generatedAt }: ProductSpecViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="space-y-2">
      {generatedAt && (
        <p className="text-xs text-[color:var(--text-secondary)]">
          Generated {formatDateTime(generatedAt)}
        </p>
      )}

      <div
        className={`relative overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] ${
          isExpanded ? '' : 'max-h-96'
        }`}
      >
        <div className="p-4">
          <MarkdownContent content={spec} />
        </div>

        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[color:var(--surface)] to-transparent" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
      >
        {isExpanded ? 'Collapse' : 'Expand Full Spec'}
      </button>
    </div>
  )
}

/**
 * Simple markdown renderer for product specs
 * Handles headers, lists, blockquotes, and code blocks
 */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let currentList: string[] = []
  let currentBlockquote: string[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="mb-3 list-inside list-disc space-y-1 pl-4">
          {currentList.map((item, i) => (
            <li key={i} className="text-sm text-[color:var(--foreground)]">
              {item}
            </li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  const flushBlockquote = () => {
    if (currentBlockquote.length > 0) {
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="mb-3 border-l-4 border-[color:var(--accent-primary)] bg-[color:var(--surface-hover)] py-2 pl-4 pr-2 italic"
        >
          {currentBlockquote.map((line, i) => (
            <p key={i} className="text-sm text-[color:var(--foreground)]">
              {line}
            </p>
          ))}
        </blockquote>
      )
      currentBlockquote = []
    }
  }

  const flushCodeBlock = () => {
    if (codeBlockContent.length > 0) {
      elements.push(
        <pre
          key={`code-${elements.length}`}
          className="mb-3 overflow-x-auto rounded-[4px] bg-[color:var(--surface-hover)] p-3 font-mono text-xs"
        >
          {codeBlockContent.join('\n')}
        </pre>
      )
      codeBlockContent = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        flushList()
        flushBlockquote()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Headers
    if (line.startsWith('# ')) {
      flushList()
      flushBlockquote()
      elements.push(
        <h1 key={`h1-${i}`} className="mb-2 mt-4 text-xl font-bold text-[color:var(--foreground)]">
          {line.slice(2)}
        </h1>
      )
      continue
    }

    if (line.startsWith('## ')) {
      flushList()
      flushBlockquote()
      elements.push(
        <h2 key={`h2-${i}`} className="mb-2 mt-3 text-lg font-semibold text-[color:var(--foreground)]">
          {line.slice(3)}
        </h2>
      )
      continue
    }

    if (line.startsWith('### ')) {
      flushList()
      flushBlockquote()
      elements.push(
        <h3 key={`h3-${i}`} className="mb-1 mt-2 font-semibold text-[color:var(--foreground)]">
          {line.slice(4)}
        </h3>
      )
      continue
    }

    // List items
    if (line.match(/^[-*]\s/)) {
      flushBlockquote()
      currentList.push(line.slice(2))
      continue
    }

    if (line.match(/^\d+\.\s/)) {
      flushBlockquote()
      currentList.push(line.replace(/^\d+\.\s/, ''))
      continue
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      flushList()
      currentBlockquote.push(line.slice(2))
      continue
    }

    // Paragraphs
    if (line.trim() === '') {
      flushList()
      flushBlockquote()
      continue
    }

    flushList()
    flushBlockquote()

    // Bold/italic text handling
    const formattedLine = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="rounded bg-[color:var(--surface-hover)] px-1 font-mono text-xs">$1</code>')

    elements.push(
      <p
        key={`p-${i}`}
        className="mb-2 text-sm text-[color:var(--foreground)]"
        dangerouslySetInnerHTML={{ __html: formattedLine }}
      />
    )
  }

  // Flush remaining content
  flushList()
  flushBlockquote()
  flushCodeBlock()

  return <div className="prose-sm">{elements}</div>
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
