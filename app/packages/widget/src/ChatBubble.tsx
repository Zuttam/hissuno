'use client';

import React from 'react';
import type { BubblePosition, BubbleOffset } from './types';

interface ChatBubbleProps {
  isOpen: boolean;
  onClick: () => void;
  position?: BubblePosition;
  offset?: BubbleOffset;
  theme?: 'light' | 'dark' | 'auto';
}

function getPositionStyles(
  position: BubblePosition,
  offset: BubbleOffset
): React.CSSProperties {
  const x = offset.x ?? 20;
  const y = offset.y ?? 20;

  switch (position) {
    case 'bottom-left':
      return { bottom: y, left: x };
    case 'top-right':
      return { top: y, right: x };
    case 'top-left':
      return { top: y, left: x };
    case 'bottom-right':
    default:
      return { bottom: y, right: x };
  }
}

export function ChatBubble({
  isOpen,
  onClick,
  position = 'bottom-right',
  offset = {},
  theme = 'light',
}: ChatBubbleProps) {
  const positionStyles = getPositionStyles(position, offset);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onClick}
      className="hissuno-bubble"
      style={{
        position: 'fixed',
        ...positionStyles,
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        zIndex: 9998,
        backgroundColor: isDark ? '#1a1a1a' : '#2563eb',
        color: '#ffffff',
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <CloseIcon />
      ) : (
        <ChatIcon />
      )}
    </button>
  );
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
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
