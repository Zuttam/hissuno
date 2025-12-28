'use client'

import type { ChatMessage } from '@/types/session'
import { SessionChat } from './session-chat'

interface MessagesPanelProps {
  messages: ChatMessage[]
  onClose: () => void
}

export function MessagesPanel({ messages, onClose }: MessagesPanelProps) {
  return (
    <>
      {/* Backdrop - offset to not cover session sidebar */}
      <div
        className="fixed inset-0 right-[512px] z-50 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - positioned to the left of session sidebar */}
      <aside className="fixed right-[512px] top-0 z-50 flex h-full w-full max-w-lg flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] p-4">
          <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
            Conversation
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          <SessionChat messages={messages} />
        </div>
      </aside>
    </>
  )
}
