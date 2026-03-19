'use client'

import type { ChatMessage } from '@hissuno/widget'
import { MarkdownContent } from '@/components/ui/markdown-content'

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-[4px] px-4 py-3 ${
          isUser
            ? 'bg-[color:var(--accent-selected)] text-white'
            : 'border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)]'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} className="text-sm" />
        )}
      </div>
    </div>
  )
}

export function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--text-tertiary)] [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--text-tertiary)] [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--text-tertiary)]" />
      </div>
    </div>
  )
}
