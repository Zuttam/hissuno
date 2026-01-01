'use client';

import React from 'react';
import type { SessionEntry } from './useHissunoChat';

interface ConversationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionEntry[];
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  currentSessionId?: string | null;
  theme?: 'light' | 'dark' | 'auto';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function ConversationHistory({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onDeleteSession,
  currentSessionId,
  theme = 'light',
}: ConversationHistoryProps) {
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e5e7eb';
  const textColor = isDark ? '#e5e5e5' : '#1f2937';
  const secondaryTextColor = isDark ? '#999999' : '#6b7280';
  const hoverBg = isDark ? '#2a2a2a' : '#f3f4f6';
  const activeBg = isDark ? '#333333' : '#e5e7eb';
  const backdropColor = 'rgba(0, 0, 0, 0.3)';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSessionClick = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: backdropColor,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out',
          zIndex: 1,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '80%',
          maxWidth: 300,
          backgroundColor: bgColor,
          borderRight: `1px solid ${borderColor}`,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease-in-out',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px',
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: textColor,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Conversations
          </h3>
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
            aria-label="Close history"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Session List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {sessions.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: secondaryTextColor,
                fontSize: 14,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              No previous conversations
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.sessionId === currentSessionId;
              return (
                <div
                  key={session.sessionId}
                  onClick={() => handleSessionClick(session.sessionId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? activeBg : 'transparent',
                    borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = hoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: textColor,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {session.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: secondaryTextColor,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        marginTop: 2,
                      }}
                    >
                      {formatDate(session.lastMessageAt)} · {session.messageCount} messages
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, session.sessionId)}
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
                      opacity: 0.6,
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.6';
                      e.currentTarget.style.color = secondaryTextColor;
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function CloseIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// Export HistoryIcon for use in ChatPopup and ChatSidepanel
export function HistoryIcon() {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
