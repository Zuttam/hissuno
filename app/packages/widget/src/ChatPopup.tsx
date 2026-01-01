'use client';

import React, { type FormEvent, type KeyboardEvent } from 'react';
import { ChatMessages } from './ChatMessages';
import { ConversationHistory, HistoryIcon } from './ConversationHistory';
import type { SessionEntry } from './useHissunoChat';
import type { ChatMessage, BubblePosition, BubbleOffset } from './types';

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e?: FormEvent) => void;
  isLoading: boolean;
  isStreaming?: boolean;
  streamingContent?: string;
  error?: Error;
  title?: string;
  placeholder?: string;
  theme?: 'light' | 'dark' | 'auto';
  position?: BubblePosition;
  offset?: BubbleOffset;
  onClearHistory?: () => void;
  onCancelChat?: () => void;
  onOpenHistory?: () => void;
  // History panel props
  isHistoryOpen?: boolean;
  sessionHistory?: SessionEntry[];
  currentSessionId?: string | null;
  onCloseHistory?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

function getPopupPositionStyles(
  position: BubblePosition,
  offset: BubbleOffset
): React.CSSProperties {
  const x = offset.x ?? 20;
  const y = offset.y ?? 20;
  const popupOffset = 70; // Space for bubble + gap

  switch (position) {
    case 'bottom-left':
      return { bottom: y + popupOffset, left: x };
    case 'top-right':
      return { top: y + popupOffset, right: x };
    case 'top-left':
      return { top: y + popupOffset, left: x };
    case 'bottom-right':
    default:
      return { bottom: y + popupOffset, right: x };
  }
}

export function ChatPopup({
  isOpen,
  onClose,
  messages,
  input,
  setInput,
  handleSubmit,
  isLoading,
  isStreaming = false,
  streamingContent = '',
  error,
  title = 'Support',
  placeholder = 'Ask a question or report an issue...',
  theme = 'light',
  position = 'bottom-right',
  offset = {},
  onClearHistory,
  onCancelChat,
  onOpenHistory,
  isHistoryOpen = false,
  sessionHistory = [],
  currentSessionId,
  onCloseHistory,
  onSelectSession,
  onDeleteSession,
}: ChatPopupProps) {
  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const positionStyles = getPopupPositionStyles(position, offset);

  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e5e7eb';
  const textColor = isDark ? '#e5e5e5' : '#1f2937';
  const secondaryTextColor = isDark ? '#999999' : '#6b7280';
  const inputBg = isDark ? '#2a2a2a' : '#f9fafb';
  const inputBorder = isDark ? '#444444' : '#d1d5db';

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div
      className="hissuno-popup"
      style={{
        position: 'fixed',
        ...positionStyles,
        width: 380,
        height: 520,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* History Panel */}
      {onCloseHistory && onSelectSession && onDeleteSession && (
        <ConversationHistory
          isOpen={isHistoryOpen}
          onClose={onCloseHistory}
          sessions={sessionHistory}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          currentSessionId={currentSessionId}
          theme={theme}
        />
      )}
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: secondaryTextColor,
                borderRadius: 4,
              }}
              aria-label="Conversation history"
              title="Conversation history"
            >
              <HistoryIcon />
            </button>
          )}
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: textColor,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {title}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: secondaryTextColor,
                borderRadius: 4,
              }}
              aria-label="New conversation"
              title="New conversation"
            >
              <NewThreadIcon />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: secondaryTextColor,
              borderRadius: 4,
            }}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        theme={theme}
      />

      {/* Error */}
      {error && (
        <div
          style={{
            margin: '0 16px 12px',
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: isDark ? '#3b1515' : '#fef2f2',
            border: `1px solid ${isDark ? '#5c2020' : '#fecaca'}`,
            color: isDark ? '#fca5a5' : '#dc2626',
            fontSize: 13,
          }}
        >
          {error.message || 'Something went wrong. Please try again.'}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: 16,
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${inputBorder}`,
            backgroundColor: inputBg,
            color: textColor,
            fontSize: 14,
            outline: 'none',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        />
        {isStreaming && onCancelChat ? (
          <button
            type="button"
            onClick={onCancelChat}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 60,
            }}
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !input.trim() ? 0.5 : 1,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 60,
            }}
          >
            {isLoading ? <SpinnerIcon /> : 'Send'}
          </button>
        )}
      </form>
    </div>
  );
}

function CloseIcon() {
  return (
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
  );
}

function NewThreadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'hissuno-spin 1s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
