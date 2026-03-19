'use client'

import { useRef, useEffect, useMemo } from 'react'
import type { SessionWithProject, ChatMessage } from '@/types/session'

interface TranscriptViewProps {
  session: SessionWithProject
  messages: ChatMessage[]
}

interface TranscriptEntry {
  id: string
  speakerName: string
  content: string
  timestamp: string
  offsetLabel: string
  isExternal: boolean
}

/**
 * Parse a Gong-style message with "[SpeakerName]: content" format.
 * Falls back gracefully if the format doesn't match.
 */
function parseTranscriptMessage(message: ChatMessage, callStartTime: Date | null): TranscriptEntry {
  const match = message.content.match(/^\[([^\]]+)\]:\s*([\s\S]*)$/)

  const speakerName = match ? match[1] : message.role === 'user' ? 'Customer' : 'Agent'
  const content = match ? match[2] : message.content

  // Determine if this is an external (customer) speaker
  const isExternal = message.role === 'user'

  // Calculate offset from call start
  let offsetLabel = ''
  if (callStartTime) {
    const msgTime = new Date(message.createdAt)
    const diffMs = msgTime.getTime() - callStartTime.getTime()
    if (diffMs >= 0) {
      const totalSeconds = Math.floor(diffMs / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      offsetLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  return {
    id: message.id,
    speakerName,
    content,
    timestamp: message.createdAt,
    offsetLabel,
    isExternal,
  }
}

/**
 * Get call start time from first message or session metadata
 */
function getCallStartTime(session: SessionWithProject, messages: ChatMessage[]): Date | null {
  if (session.first_message_at) {
    return new Date(session.first_message_at)
  }
  if (messages.length > 0) {
    return new Date(messages[0].createdAt)
  }
  return null
}

/**
 * Format call duration from metadata
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hours}h ${remainMins}m`
  }
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function TranscriptView({ session, messages }: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const callStartTime = useMemo(() => getCallStartTime(session, messages), [session, messages])

  const entries = useMemo(
    () => messages.map((msg) => parseTranscriptMessage(msg, callStartTime)),
    [messages, callStartTime]
  )

  // Extract metadata for the header
  const metadata = session.user_metadata as Record<string, unknown> | null
  const duration = metadata?.gong_duration_seconds as number | undefined
  const participantsCount = metadata?.gong_participants_count as number | undefined

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-sm text-[color:var(--text-secondary)]">
          No transcript available for this session.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Call metadata bar */}
      {(duration || participantsCount) && (
        <div className="flex items-center gap-4 border-b border-[color:var(--border-subtle)] px-4 py-2 text-xs text-[color:var(--text-secondary)]">
          {duration && (
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatDuration(duration)}
            </span>
          )}
          {participantsCount && (
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {participantsCount} participants
            </span>
          )}
        </div>
      )}

      {/* Transcript entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 p-4">
          {entries.map((entry, i) => {
            const prevEntry = i > 0 ? entries[i - 1] : null
            const showSpeakerLabel = !prevEntry || prevEntry.speakerName !== entry.speakerName

            return (
              <div key={entry.id} className={showSpeakerLabel && i > 0 ? 'mt-3' : ''}>
                {showSpeakerLabel && (
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold ${
                        entry.isExternal
                          ? 'text-[color:var(--accent-info)]'
                          : 'text-[color:var(--text-secondary)]'
                      }`}
                    >
                      {entry.speakerName}
                    </span>
                    {entry.offsetLabel && (
                      <span className="font-mono text-[10px] text-[color:var(--text-tertiary)]">
                        {entry.offsetLabel}
                      </span>
                    )}
                  </div>
                )}
                <div className="pl-0 text-sm leading-relaxed text-[color:var(--foreground)]">
                  {entry.content}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Closed notice */}
      <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
        <div className="rounded-[4px] bg-[color:var(--surface)] p-3 text-center text-sm text-[color:var(--text-secondary)]">
          This is a recorded transcript. It cannot be modified.
        </div>
      </div>
    </div>
  )
}
