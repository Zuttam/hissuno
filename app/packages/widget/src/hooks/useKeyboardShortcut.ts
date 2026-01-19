'use client';

import { useCallback, useEffect } from 'react';

/**
 * Parse a shortcut string into its component parts
 * Supports: 'mod+k', 'ctrl+shift+p', 'alt+enter', etc.
 * 'mod' = cmd on Mac, ctrl on Windows/Linux
 */
interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  const mac = isMac();

  return {
    key,
    ctrl: modifiers.includes('ctrl') || (!mac && modifiers.includes('mod')),
    meta: modifiers.includes('cmd') || modifiers.includes('meta') || (mac && modifiers.includes('mod')),
    alt: modifiers.includes('alt') || modifiers.includes('option'),
    shift: modifiers.includes('shift'),
  };
}

function matchesShortcut(event: KeyboardEvent, parsed: ParsedShortcut): boolean {
  const keyMatch = event.key.toLowerCase() === parsed.key.toLowerCase();
  const ctrlMatch = event.ctrlKey === parsed.ctrl;
  const metaMatch = event.metaKey === parsed.meta;
  const altMatch = event.altKey === parsed.alt;
  const shiftMatch = event.shiftKey === parsed.shift;

  return keyMatch && ctrlMatch && metaMatch && altMatch && shiftMatch;
}

interface UseKeyboardShortcutOptions {
  /**
   * Shortcut string (e.g., 'mod+k', 'ctrl+shift+p')
   * Set to false or undefined to disable
   */
  shortcut?: string | false;
  /**
   * Callback when shortcut is triggered
   */
  onTrigger: () => void;
  /**
   * Whether the shortcut is enabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook to register a keyboard shortcut
 *
 * @example
 * useKeyboardShortcut({
 *   shortcut: 'mod+k',
 *   onTrigger: () => setIsOpen(true),
 * });
 */
export function useKeyboardShortcut({
  shortcut,
  onTrigger,
  enabled = true,
}: UseKeyboardShortcutOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!shortcut || !enabled) return;

      const parsed = parseShortcut(shortcut);

      if (matchesShortcut(event, parsed)) {
        event.preventDefault();
        event.stopPropagation();
        onTrigger();
      }
    },
    [shortcut, enabled, onTrigger]
  );

  useEffect(() => {
    if (!shortcut || !enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, enabled, handleKeyDown]);
}

/**
 * Format a shortcut string for display
 * Converts 'mod+k' to 'Cmd+K' on Mac or 'Ctrl+K' on Windows
 */
export function formatShortcut(shortcut: string): string {
  const mac = isMac();
  const parts = shortcut.split('+');

  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      switch (lower) {
        case 'mod':
          return mac ? '\u2318' : 'Ctrl'; // Command symbol or Ctrl
        case 'ctrl':
          return mac ? '\u2303' : 'Ctrl'; // Control symbol or Ctrl
        case 'cmd':
        case 'meta':
          return mac ? '\u2318' : 'Win'; // Command symbol or Win
        case 'alt':
        case 'option':
          return mac ? '\u2325' : 'Alt'; // Option symbol or Alt
        case 'shift':
          return mac ? '\u21E7' : 'Shift'; // Shift symbol
        default:
          return part.toUpperCase();
      }
    })
    .join(mac ? '' : '+');
}
