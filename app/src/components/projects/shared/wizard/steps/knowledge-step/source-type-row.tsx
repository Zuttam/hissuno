'use client'

import { useState } from 'react'
import { Button, Input, Textarea } from '@/components/ui'
import type { KnowledgeSourceType } from '@/lib/knowledge/types'
import type { KnowledgeSourceInput } from '../types'

const SOURCE_CONFIG: Record<
  Exclude<KnowledgeSourceType, 'codebase'>,
  { icon: string; name: string; description: string; placeholder: string }
> = {
  website: {
    icon: '🌐',
    name: 'Website',
    description: 'Add website URLs for your agent to learn from',
    placeholder: 'https://example.com',
  },
  docs_portal: {
    icon: '📚',
    name: 'Documentation',
    description: 'Add documentation portals for product knowledge',
    placeholder: 'https://docs.example.com',
  },
  uploaded_doc: {
    icon: '📄',
    name: 'Documents',
    description: 'Upload PDF, TXT, or markdown files',
    placeholder: '',
  },
  raw_text: {
    icon: '📝',
    name: 'Custom Text',
    description: 'Add custom Q&A, notes, or any text content',
    placeholder: 'Enter custom content...',
  },
}

interface SourceTypeRowProps {
  type: Exclude<KnowledgeSourceType, 'codebase'>
  sources: KnowledgeSourceInput[]
  onAddSource: (data: Partial<KnowledgeSourceInput>) => void
  onRemoveSource: (id: string) => void
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function SourceTypeRow({
  type,
  sources,
  onAddSource,
  onRemoveSource,
}: SourceTypeRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)

  const config = SOURCE_CONFIG[type]
  const itemCount = sources.length

  const handleAdd = () => {
    if (type === 'uploaded_doc') {
      if (file) {
        onAddSource({ file })
        setFile(null)
      }
    } else if (type === 'raw_text') {
      if (inputValue.trim()) {
        onAddSource({ content: inputValue.trim() })
        setInputValue('')
      }
    } else {
      // URL validation for website and docs_portal
      const url = inputValue.trim()
      if (!url) return

      if (!isValidUrl(url)) {
        setUrlError('Please enter a valid URL (e.g., https://example.com)')
        return
      }

      setUrlError(null)
      onAddSource({ url })
      setInputValue('')
    }
  }

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    if (urlError) setUrlError(null)
  }

  const getSourceDisplay = (source: KnowledgeSourceInput) => {
    if (source.url) return source.url
    if (source.file) return source.file.name
    if (source.content) return source.content.slice(0, 50) + (source.content.length > 50 ? '...' : '')
    return 'Unknown'
  }

  return (
    <div>
      {/* Row Header */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[color:var(--foreground)]">{config.name}</span>
              {itemCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--accent-primary)] text-white">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-sm text-[color:var(--text-secondary)]">{config.description}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Close' : itemCount > 0 ? 'Configure' : 'Add'}
        </Button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 pl-8 space-y-3 pb-3">
          {/* Existing items */}
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-2 rounded border border-[color:var(--border)] bg-[color:var(--background-secondary)]"
            >
              <span className="text-sm text-[color:var(--foreground)] truncate max-w-[300px]">
                {getSourceDisplay(source)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveSource(source.id)}
              >
                Remove
              </Button>
            </div>
          ))}

          {/* Add input */}
          {type === 'uploaded_doc' ? (
            <div className="flex gap-2 items-center">
              <input
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm"
              />
              <Button onClick={handleAdd} disabled={!file} size="sm">
                Add
              </Button>
            </div>
          ) : type === 'raw_text' ? (
            <div className="space-y-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={config.placeholder}
                rows={3}
              />
              <Button onClick={handleAdd} disabled={!inputValue.trim()} size="sm">
                Add
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={handleUrlInputChange}
                  placeholder={config.placeholder}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputValue.trim()) {
                      handleAdd()
                    }
                  }}
                />
                <Button onClick={handleAdd} disabled={!inputValue.trim()} size="sm">
                  Add
                </Button>
              </div>
              {urlError && (
                <p className="text-xs text-red-500">{urlError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
