'use client';

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming?: boolean;
  streamingContent?: string;
  theme?: 'light' | 'dark';
}

interface MessageBubbleProps {
  message: ChatMessage;
  theme?: 'light' | 'dark';
}

function MessageBubble({ message, theme = 'light' }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isHumanAgent = message.senderType === 'human_agent';
  const isDark = theme === 'dark';

  const userBg = '#2563eb';
  const userColor = '#ffffff';
  const assistantBg = isDark ? '#2a2a2a' : '#f3f4f6';
  const assistantColor = isDark ? '#e5e5e5' : '#1f2937';
  const humanAgentBg = isDark ? '#4c1d95' : '#ede9fe'; // Purple tint for human agent
  const humanAgentColor = isDark ? '#e5e5e5' : '#1f2937';
  const humanAgentBorder = '#8b5cf6';

  // Determine the sender label for screen readers
  const senderLabel = isUser ? 'You' : isHumanAgent ? 'Support agent' : 'Assistant';

  return (
    <article
      role="article"
      aria-label={`Message from ${senderLabel}`}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: 12,
          backgroundColor: isUser ? userBg : isHumanAgent ? humanAgentBg : assistantBg,
          color: isUser ? userColor : isHumanAgent ? humanAgentColor : assistantColor,
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          border: isHumanAgent ? `1px solid ${humanAgentBorder}` : 'none',
        }}
      >
        {/* Human Agent indicator */}
        {isHumanAgent && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
              fontSize: 11,
              fontWeight: 600,
              color: '#8b5cf6',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Human Agent
          </div>
        )}
        {message.content}
      </div>
    </article>
  );
}

function LoadingIndicator({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  const dotColor = isDark ? '#666666' : '#9ca3af';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Assistant is typing"
      style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '10px 14px',
          borderRadius: 12,
          backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
        }}
      >
        <span
          className="hissuno-loading-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            animation: 'hissuno-bounce 1s infinite',
            animationDelay: '-0.3s',
          }}
        />
        <span
          className="hissuno-loading-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            animation: 'hissuno-bounce 1s infinite',
            animationDelay: '-0.15s',
          }}
        />
        <span
          className="hissuno-loading-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            animation: 'hissuno-bounce 1s infinite',
          }}
        />
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  isStreaming = false,
  streamingContent = '',
  theme = 'light',
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

  // Show loading dots when waiting for response OR when streaming started but no content yet
  const showLoading =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'user' &&
    !streamingContent; // Hide loading only when actual content starts appearing

  // Show streaming content as a live message bubble
  const showStreamingBubble = isStreaming && streamingContent;

  return (
    <div
      className="hissuno-messages"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-relevant="additions"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
      }}
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} theme={theme} />
      ))}
      {showLoading && <LoadingIndicator theme={theme} />}
      {showStreamingBubble && (
        <div aria-live="polite" aria-atomic="false">
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
            }}
            theme={theme}
          />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
