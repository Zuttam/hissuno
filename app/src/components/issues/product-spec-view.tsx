'use client'

import { useState } from 'react'
import { Dialog, MarkdownContent } from '@/components/ui'

interface ProductSpecViewProps {
  spec: string
  generatedAt: string | null
  issueTitle?: string
}

export function ProductSpecView({ spec, generatedAt, issueTitle }: ProductSpecViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[product-spec-view] failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([spec], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spec-${issueTitle?.toLowerCase().replace(/\s+/g, '-') || 'product'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        {/* Action buttons toolbar */}
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
            title="Copy to clipboard"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
            title="Download as Markdown"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Expand/collapse button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Open in dialog button */}
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
            title="Open in full view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>

        <div className="p-4 pr-32">
          <MarkdownContent content={spec} className="text-sm" />
        </div>

        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[color:var(--surface)] to-transparent" />
        )}
      </div>

      {/* Full view dialog */}
      <SpecDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        spec={spec}
        issueTitle={issueTitle}
      />
    </div>
  )
}

interface SpecDialogProps {
  open: boolean
  onClose: () => void
  spec: string
  issueTitle?: string
}

function SpecDialog({ open, onClose, spec, issueTitle }: SpecDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[product-spec-view] failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([spec], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spec-${issueTitle?.toLowerCase().replace(/\s+/g, '-') || 'product'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Product Specification" size="2xl">
      <div className="flex justify-end gap-2 border-b border-[color:var(--border-subtle)] pb-3 mb-4">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <MarkdownContent content={spec} className="text-sm" />
      </div>
    </Dialog>
  )
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
