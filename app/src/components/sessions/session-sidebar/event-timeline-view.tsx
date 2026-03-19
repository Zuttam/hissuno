'use client'

import { useRef, useEffect } from 'react'
import type { SessionWithProject, ChatMessage } from '@/types/session'

interface EventTimelineViewProps {
  session: SessionWithProject
  messages: ChatMessage[]
}

function formatEventTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function EventTimelineView({ session: _session, messages }: EventTimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-sm text-[color:var(--text-secondary)]">
          No events recorded for this session.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative p-4 pl-8">
          {/* Vertical connecting line */}
          <div className="absolute bottom-4 left-[21px] top-4 w-px bg-[color:var(--border-subtle)]" />

          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div key={message.id} className="relative flex items-start gap-3">
                {/* Timeline dot */}
                <div className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--accent-primary)] bg-[color:var(--background)]" />

                {/* Event content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[color:var(--foreground)]">
                    {message.content}
                  </p>
                  <span className="mt-0.5 block font-mono text-[10px] text-[color:var(--text-tertiary)]">
                    {formatEventTime(message.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Closed notice */}
      <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
        <div className="rounded-[4px] bg-[color:var(--surface)] p-3 text-center text-sm text-[color:var(--text-secondary)]">
          This is a behavioral event timeline. It cannot be modified.
        </div>
      </div>
    </div>
  )
}
