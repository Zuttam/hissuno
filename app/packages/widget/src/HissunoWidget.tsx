'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatPopup } from './ChatPopup';
import { useHissunoChat } from './useHissunoChat';
import type { HissunoWidgetProps } from './types';

const DEFAULT_API_URL = '/api/agent';

/**
 * HissunoWidget - Embeddable support agent widget
 *
 * Add this component to your app to enable AI-powered support.
 *
 * @example
 * ```tsx
 * import { HissunoWidget } from '@hissuno/widget';
 * import '@hissuno/widget/styles.css';
 *
 * function App() {
 *   return (
 *     <div>
 *       <YourApp />
 *       <HissunoWidget
 *         publicKey="pk_live_xxx"
 *         userId={currentUser.id}
 *         userMetadata={{ name: currentUser.name, email: currentUser.email }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function HissunoWidget({
  publicKey,
  userId,
  userMetadata,
  apiUrl = DEFAULT_API_URL,
  theme = 'light',
  showBubble = true,
  bubblePosition = 'bottom-right',
  bubbleOffset,
  renderTrigger,
  title = 'Support',
  placeholder = 'Ask a question or report an issue...',
  initialMessage = "Hi! 👋 How can I help you today?",
  defaultOpen = false,
  onOpen,
  onClose,
  className,
  headers = {},
}: HissunoWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Validate required props
  if (!publicKey) {
    console.error('[HissunoWidget] publicKey is required');
    return null;
  }

  if (!publicKey.startsWith('pk_')) {
    console.warn(
      '[HissunoWidget] publicKey should start with "pk_". Make sure you\'re using the public key, not the secret key.'
    );
  }

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    clearHistory,
  } = useHissunoChat({
    publicKey,
    apiUrl,
    initialMessage,
    headers,
    userId,
    userMetadata,
  });

  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Handle defaultOpen changes
  useEffect(() => {
    if (defaultOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  // Resolve theme based on system preference if 'auto'
  const resolvedTheme = useResolvedTheme(theme);

  return (
    <div className={`hissuno-widget ${className ?? ''}`}>
      {/* Custom trigger or default bubble */}
      {renderTrigger ? (
        renderTrigger({ open, close, toggle, isOpen })
      ) : showBubble ? (
        <ChatBubble
          isOpen={isOpen}
          onClick={toggle}
          position={bubblePosition}
          offset={bubbleOffset}
          theme={resolvedTheme}
        />
      ) : null}

      {/* Chat popup */}
      <ChatPopup
        isOpen={isOpen}
        onClose={close}
        messages={messages}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        title={title}
        placeholder={placeholder}
        theme={resolvedTheme}
        position={bubblePosition}
        offset={bubbleOffset}
        onClearHistory={clearHistory}
      />
    </div>
  );
}

/**
 * Hook to resolve 'auto' theme to 'light' or 'dark' based on system preference
 */
function useResolvedTheme(theme: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => {
    if (theme !== 'auto') return theme;
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    if (theme !== 'auto') {
      setResolved(theme);
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setResolved(e.matches ? 'dark' : 'light');
    };

    setResolved(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return resolved;
}

/**
 * Alias for HissunoWidget for backward compatibility
 */
export const SupportWidget = HissunoWidget;
