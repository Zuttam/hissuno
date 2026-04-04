import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils/class'
import styles from '@/components/ui/markdown-viewer/markdown-viewer.module.css'
import { DocsCodeBlock } from './docs-code-block'

interface DocsContentProps {
  content: string
  className?: string
}

export function DocsContent({ content, className }: DocsContentProps) {
  if (!content) {
    return null
  }

  return (
    <div className={cn(styles.markdownViewer, 'prose prose-slate dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        rehypePlugins={[rehypeSlug, rehypeHighlight]}
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children, ...props }) => <DocsCodeBlock {...props}>{children}</DocsCodeBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
