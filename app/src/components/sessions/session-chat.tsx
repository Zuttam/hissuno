'use client'

import { useRef, useEffect } from 'react'
import { KnowledgeViewer } from '@/components/knowledge/knowledge-viewer'
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
  const isHumanAgent = message.senderType === 'human_agent'

  // Determine the label and styling based on message type
  const getLabel = () => {
    if (isUser) return 'User'
    if (isHumanAgent) return 'Human Agent'
    return 'Assistant'
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-[4px] px-4 py-3 ${
          isUser
            ? 'bg-[color:var(--user-message-bg)] text-white'
            : isHumanAgent
            ? 'border-2 border-purple-500/50 bg-purple-500/10 text-[color:var(--foreground)]'
            : 'border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)]'
        }`}
      >
        {/* Role label */}
        <div
          className={`mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider ${
            isUser
              ? 'text-white/70'
              : isHumanAgent
              ? 'text-purple-600'
              : 'text-[color:var(--text-secondary)]'
          }`}
        >
          {isHumanAgent && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
          {getLabel()}
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
            isUser
              ? 'text-white/60'
              : isHumanAgent
              ? 'text-purple-500/60'
              : 'text-[color:var(--text-tertiary)]'
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
