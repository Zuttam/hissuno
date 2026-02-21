'use client';

import React, { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { ChatMessages } from '../shared/ChatMessages';
import { ConversationHistory } from '../shared/ConversationHistory';
import { CloseIcon, NewThreadIcon, SpinnerIcon, HistoryIcon } from '../shared/Icons';
import type { SessionEntry } from '../hooks/useHissunoChat';
import type { ChatMessage } from '../types';

interface ChatSidepanelProps {
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
  layout?: 'overlay' | 'push';
  onWidthChange?: (width: number) => void;
}

export function ChatSidepanel({
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
  onClearHistory,
  onCancelChat,
  onOpenHistory,
  isHistoryOpen = false,
  sessionHistory = [],
  currentSessionId,
  onCloseHistory,
  onSelectSession,
  onDeleteSession,
  layout = 'overlay',
  onWidthChange,
}: ChatSidepanelProps) {
  const STORAGE_KEY = 'hissuno-sidepanel-width';
  const MIN_WIDTH = 360;
  const MAX_WIDTH = 800;
  const DEFAULT_WIDTH = 480;

  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) return parsed;
      }
    } catch { /* noop */ }
    return DEFAULT_WIDTH;
  });
  const widthRef = useRef(panelWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Notify host of initial width on mount
  useEffect(() => {
    onWidthChange?.(panelWidth);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      widthRef.current = newWidth;
      setPanelWidth(newWidth);
      onWidthChange?.(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizing(false);
      try {
        localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      } catch { /* noop */ }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onWidthChange]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const isPush = layout === 'push';

  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e5e7eb';
  const textColor = isDark ? '#e5e5e5' : '#1f2937';
  const secondaryTextColor = isDark ? '#999999' : '#6b7280';
  const inputBg = isDark ? '#2a2a2a' : '#f9fafb';
  const inputBorder = isDark ? '#444444' : '#d1d5db';

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

  return (
    <>
      {/* Backdrop */}
      {!isPush && (
        <div
          className="hissuno-backdrop"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
          }}
        />
      )}

      {/* Sidepanel */}
      <div
        className="hissuno-sidepanel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: panelWidth,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: bgColor,
          borderLeft: `1px solid ${borderColor}`,
          boxShadow: isPush ? 'none' : '-4px 0 20px rgba(0, 0, 0, 0.15)',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'hissuno-slide-in-right 0.25s ease-out',
        }}
      >
        {/* Resize handle */}
        <div
          className="hissuno-resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 2,
              height: 40,
              borderRadius: 1,
              backgroundColor: isResizing
                ? (isDark ? '#666666' : '#9ca3af')
                : 'transparent',
              transition: isResizing ? 'none' : 'background-color 0.15s',
            }}
            className="hissuno-resize-indicator"
          />
        </div>
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
            aria-label="Type your message"
            rows={1}
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
              resize: 'none',
              minHeight: 40,
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
    </>
  );
}
