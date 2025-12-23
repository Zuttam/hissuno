'use client'

import { useRef, useEffect } from 'react'
import { KnowledgeViewer } from '@/components/projects/project-detail/knowledge-viewer'
import type { ChatMessage } from '@/types/session'

interface SessionChatProps {
  messages: ChatMessage[]
}

export function SessionChat({ messages }: SessionChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-sm text-[color:var(--text-secondary)]">
          No messages in this conversation yet.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex h-full flex-col gap-4 overflow-y-auto p-4"
    >
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}

interface ChatMessageBubbleProps {
  message: ChatMessage
}

function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-[4px] px-4 py-3 ${
          isUser
            ? 'bg-[color:var(--accent-primary)] text-white'
            : 'border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)]'
        }`}
      >
        {/* Role label */}
        <div
          className={`mb-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
            isUser ? 'text-white/70' : 'text-[color:var(--text-secondary)]'
          }`}
        >
          {isUser ? 'User' : 'Assistant'}
        </div>

        {/* Message content */}
        <div className={`text-sm ${isUser ? '' : 'prose-sm'}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <KnowledgeViewer content={message.content} />
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`mt-2 text-[10px] ${
            isUser ? 'text-white/60' : 'text-[color:var(--text-tertiary)]'
          }`}
        >
          {formatMessageTime(message.createdAt)}
        </div>
      </div>
    </div>
  )
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}
