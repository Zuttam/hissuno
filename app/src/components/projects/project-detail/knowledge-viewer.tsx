'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils/class'
import { Button, Textarea } from '@/components/ui'

interface KnowledgeViewerProps {
  content: string
  className?: string
  isEditing?: boolean
  isSaving?: boolean
  onSave?: (content: string) => void
  onCancel?: () => void
}

/**
 * Renders markdown content for knowledge packages with proper styling.
 * Supports inline editing mode with a textarea.
 */
export function KnowledgeViewer({
  content,
  className,
  isEditing = false,
  isSaving = false,
  onSave,
  onCancel,
}: KnowledgeViewerProps) {
  const [editedContent, setEditedContent] = useState(content)

  // Sync edited content when content prop changes or entering edit mode
  useEffect(() => {
    setEditedContent(content)
  }, [content, isEditing])

  if (!content && !isEditing) {
    return (
      <div className="text-center text-[color:var(--text-secondary)] py-12">
        No knowledge content available
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className={cn(
            'min-h-[400px] resize-y font-mono text-sm',
            className
          )}
          disabled={isSaving}
          placeholder="Enter markdown content..."
        />
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave?.(editedContent)}
            loading={isSaving}
            disabled={isSaving || editedContent === content}
          >
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'max-h-[400px] overflow-y-auto',
        // Custom styling for knowledge documents
        'prose-headings:font-mono prose-headings:uppercase prose-headings:tracking-tight',
        'prose-h1:text-2xl prose-h1:border-b prose-h1:border-[color:var(--border-subtle)] prose-h1:pb-4',
        'prose-h2:text-xl prose-h2:text-[color:var(--foreground)]',
        'prose-h3:text-lg prose-h3:text-[color:var(--text-secondary)]',
        'prose-p:text-[color:var(--foreground)] prose-p:leading-relaxed',
        'prose-li:text-[color:var(--foreground)]',
        'prose-strong:text-[color:var(--foreground)]',
        'prose-code:text-[color:var(--accent-selected)] prose-code:bg-[color:var(--surface)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
        'prose-pre:bg-[color:var(--surface)] prose-pre:border prose-pre:border-[color:var(--border-subtle)]',
        'prose-a:text-[color:var(--accent-selected)] prose-a:no-underline hover:prose-a:underline',
        'prose-blockquote:border-l-[color:var(--accent-selected)] prose-blockquote:text-[color:var(--text-secondary)]',
        'prose-table:border-collapse',
        'prose-th:bg-[color:var(--surface)] prose-th:font-mono prose-th:uppercase prose-th:text-xs prose-th:tracking-wide',
        'prose-td:border prose-td:border-[color:var(--border-subtle)] prose-td:p-2',
        className
      )}
    >
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{content}</ReactMarkdown>
    </div>
  )
}
