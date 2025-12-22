'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { Spinner } from '@/components/ui'
import { cn } from '@/lib/utils/class'
import styles from './markdown-viewer.module.css'

interface MarkdownViewerProps {
  url: string
  title?: string
}

export function MarkdownViewer({ url, title }: MarkdownViewerProps) {
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMarkdown() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch markdown: ${response.statusText}`)
        }
        const text = await response.text()
        setContent(text)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load markdown')
      } finally {
        setIsLoading(false)
      }
    }

    if (url) {
      fetchMarkdown()
    }
  }, [url])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        <p className="font-medium">Failed to load documentation</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400 py-12">
        {title ? `No ${title} available` : 'No content available'}
      </div>
    )
  }

  return (
    <div className={cn(styles.markdownViewer, "prose prose-slate dark:prose-invert max-w-none")}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{content}</ReactMarkdown>
    </div>
  )
}

