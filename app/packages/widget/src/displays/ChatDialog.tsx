'use client';

import React, { type FormEvent, type KeyboardEvent, useEffect, useCallback } from 'react';
import { ChatMessages } from '../shared/ChatMessages';
import { ConversationHistory } from '../shared/ConversationHistory';
import { CloseIcon, NewThreadIcon, SpinnerIcon, HistoryIcon } from '../shared/Icons';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { SessionEntry } from '../hooks/useHissunoChat';
import type { ChatMessage } from '../types';

interface ChatDialogProps {
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
  theme?: 'light' | 'dark';
  width?: number;
  height?: number;
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

export function ChatDialog({
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
  width = 600,
  height = 500,
  onClearHistory,
  onCancelChat,
  onOpenHistory,
  isHistoryOpen = false,
  sessionHistory = [],
  currentSessionId,
  onCloseHistory,
  onSelectSession,
  onDeleteSession,
}: ChatDialogProps) {
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e5e7eb';
  const textColor = isDark ? '#e5e5e5' : '#1f2937';
  const secondaryTextColor = isDark ? '#999999' : '#6b7280';
  const inputBg = isDark ? '#2a2a2a' : '#f9fafb';
  const inputBorder = isDark ? '#444444' : '#d1d5db';

  // Focus trap for accessibility - keeps focus inside dialog
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Handle Escape key to close
  const handleEscapeKey = useCallback((e: globalThis.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [handleEscapeKey]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="hissuno-dialog-backdrop"
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
        }}
      >
        {/* Dialog */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hissuno-dialog-title"
          className="hissuno-dialog"
          style={{
            width,
            height,
            maxWidth: 'calc(100vw - 40px)',
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 16,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            overflow: 'hidden',
            animation: 'hissuno-dialog-scale-in 0.2s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
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
              padding: '16px 24px',
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
                id="hissuno-dialog-title"
                style={{
                  margin: 0,
                  fontSize: 18,
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
              role="alert"
              aria-live="assertive"
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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              autoFocus
              aria-label="Type your message"
              rows={1}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                backgroundColor: inputBg,
                color: textColor,
                fontSize: 14,
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                resize: 'none',
                minHeight: 44,
                maxHeight: 120,
                overflow: 'auto',
                lineHeight: '20px',
              }}
            />
            {isStreaming && onCancelChat ? (
              <button
                type="button"
                onClick={onCancelChat}
                style={{
                  padding: '12px 20px',
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
                  minWidth: 70,
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                style={{
                  padding: '12px 20px',
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
                  minWidth: 70,
                }}
              >
                {isLoading ? <SpinnerIcon /> : 'Send'}
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Inject dialog-specific keyframes */}
      <style>{`
        @keyframes hissuno-dialog-scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
