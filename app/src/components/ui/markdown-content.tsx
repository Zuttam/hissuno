'use client'

import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils/class'
import styles from './markdown-viewer/markdown-viewer.module.css'

interface MarkdownContentProps {
  content: string
  className?: string
}

/**
 * Renders markdown content inline without fetching from a URL.
 * Use this for rendering markdown strings directly (e.g., issue descriptions).
 * For fetching and rendering markdown from URLs, use MarkdownViewer instead.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) {
    return null
  }

  return (
    <div className={cn(styles.markdownViewer, 'prose prose-slate dark:prose-invert max-w-none', className)}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{content}</ReactMarkdown>
    </div>
  )
}
