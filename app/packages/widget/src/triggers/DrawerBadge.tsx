'use client';

import React from 'react';
import { CloseIcon, ChatIcon } from '../shared/Icons';

interface DrawerBadgeProps {
  isOpen: boolean;
  onClick: () => void;
  label?: string;
  theme?: 'light' | 'dark';
}

export function DrawerBadge({
  isOpen,
  onClick,
  label = 'Support',
  theme = 'light',
}: DrawerBadgeProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onClick}
      className="hissuno-drawer-badge"
      style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 40,
        minHeight: 100,
        padding: '16px 8px',
        border: 'none',
        borderRadius: '8px 0 0 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        zIndex: 9998,
        backgroundColor: isDark ? '#1a1a1a' : '#2563eb',
        color: '#ffffff',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '0.02em',
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)';
        e.currentTarget.style.boxShadow = '-4px 0 12px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(-50%)';
        e.currentTarget.style.boxShadow = '-2px 0 8px rgba(0, 0, 0, 0.15)';
      }}
    >
      {isOpen ? (
        <CloseIcon size={16} />
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0 }}>
            <ChatIcon size={16} />
          </span>
          {label}
        </span>
      )}
    </button>
  );
}
