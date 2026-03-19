'use client';

import React, { useEffect } from 'react';
import { CloseIcon, ChatIcon } from '../shared/Icons';
import { useDraggable } from '../hooks/useDraggable';

interface DrawerBadgeProps {
  isOpen: boolean;
  onClick: () => void;
  label?: string;
  theme?: 'light' | 'dark';
  initialY?: number;
}

export function DrawerBadge({
  isOpen,
  onClick,
  label = 'Support',
  theme = 'light',
  initialY,
}: DrawerBadgeProps) {
  const isDark = theme === 'dark';

  const { yPercent, isDragging, dragHandlers, shouldSuppressClick, ref } = useDraggable({
    storageKey: 'hissuno-drawer-badge-y',
    defaultY: initialY ?? 50,
    dragThreshold: 5,
    edgePadding: 20,
  });

  // Reset inline styles after drag ends to avoid stale hover state
  useEffect(() => {
    if (!isDragging && ref.current) {
      ref.current.style.transform = 'translateY(-50%)';
      ref.current.style.boxShadow = '-2px 0 8px rgba(0, 0, 0, 0.15)';
    }
  }, [isDragging, ref]);

  return (
    <button
      type="button"
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={(e) => {
        if (shouldSuppressClick()) {
          e.preventDefault();
          return;
        }
        onClick();
      }}
      {...dragHandlers}
      className="hissuno-drawer-badge"
      style={{
        position: 'fixed',
        right: 0,
        top: `${yPercent}%`,
        transform: 'translateY(-50%)',
        width: 40,
        minHeight: 100,
        padding: '16px 8px',
        border: 'none',
        borderRadius: '8px 0 0 8px',
        cursor: isDragging ? 'grabbing' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
        transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
        zIndex: 9998,
        backgroundColor: isDark ? '#1a1a1a' : '#2563eb',
        color: '#ffffff',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '0.02em',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      onMouseEnter={(e) => {
        if (isDragging) return;
        e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)';
        e.currentTarget.style.boxShadow = '-4px 0 12px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={(e) => {
        if (isDragging) return;
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
