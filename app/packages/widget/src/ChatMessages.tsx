'use client';

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from './types';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

interface MessageBubbleProps {
  message: ChatMessage;
  theme?: 'light' | 'dark' | 'auto';
}

function MessageBubble({ message, theme = 'light' }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isDark = theme === 'dark';

  const userBg = '#2563eb';
  const userColor = '#ffffff';
  const assistantBg = isDark ? '#2a2a2a' : '#f3f4f6';
  const assistantColor = isDark ? '#e5e5e5' : '#1f2937';

  return (
    <div
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
          backgroundColor: isUser ? userBg : assistantBg,
          color: isUser ? userColor : assistantColor,
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

function LoadingIndicator({ theme = 'light' }: { theme?: 'light' | 'dark' | 'auto' }) {
  const isDark = theme === 'dark';
  const dotColor = isDark ? '#666666' : '#9ca3af';

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
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

export function ChatMessages({ messages, isLoading, theme = 'light' }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const showLoading =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'user';

  return (
    <div
      className="hissuno-messages"
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
      <div ref={messagesEndRef} />
    </div>
  );
}
