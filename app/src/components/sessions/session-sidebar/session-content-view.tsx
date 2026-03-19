'use client'

import type { SessionWithProject, ChatMessage } from '@/types/session'
import { MessagesView } from './messages-view'
import { TranscriptView } from './transcript-view'
import { EventTimelineView } from './event-timeline-view'

interface SessionContentViewProps {
  session: SessionWithProject
  messages: ChatMessage[]
  onMessageSent?: () => void
}

/**
 * Routes session content to the correct view based on session_type.
 */
export function SessionContentView({ session, messages, onMessageSent }: SessionContentViewProps) {
  switch (session.session_type) {
    case 'meeting':
      return <TranscriptView session={session} messages={messages} />
    case 'behavioral':
      return <EventTimelineView session={session} messages={messages} />
    case 'chat':
    default:
      return <MessagesView session={session} messages={messages} onMessageSent={onMessageSent} />
  }
}
