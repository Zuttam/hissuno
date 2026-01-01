'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatPopup } from './ChatPopup';
import { ChatSidepanel } from './ChatSidepanel';
import { ConversationHistory } from './ConversationHistory';
import { useHissunoChat } from './useHissunoChat';
import type { SessionEntry } from './useHissunoChat';
import type { HissunoWidgetProps, WidgetSettings, WidgetVariant, BubblePosition } from './types';

const DEFAULT_API_URL = '/api/agent';
const WIDGET_SETTINGS_API = '/api/widget-settings';

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
  variant: propVariant,
  fetchDefaults = true,
  userId,
  userMetadata,
  apiUrl = DEFAULT_API_URL,
  theme: propTheme,
  showBubble = true,
  bubblePosition: propBubblePosition,
  bubbleOffset,
  renderTrigger,
  title: propTitle,
  placeholder = 'Ask a question or report an issue...',
  initialMessage: propInitialMessage,
  defaultOpen = false,
  onOpen,
  onClose,
  className,
  headers = {},
}: HissunoWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);

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

  // Fetch widget settings from server if enabled
  const serverSettings = useWidgetSettings(publicKey, fetchDefaults, apiUrl);

  // Merge props with server defaults (props always win)
  const variant: WidgetVariant = propVariant ?? serverSettings?.variant ?? 'popup';
  const theme = propTheme ?? serverSettings?.theme ?? 'light';
  const bubblePosition: BubblePosition = propBubblePosition ?? serverSettings?.position ?? 'bottom-right';
  const title = propTitle ?? serverSettings?.title ?? 'Support';
  const initialMessage = propInitialMessage ?? serverSettings?.initialMessage ?? "Hi! 👋 How can I help you today?";

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    clearHistory,
    closeSession,
    cancelChat,
    currentSessionId,
    loadSession,
    getSessionHistory,
    deleteSession,
  } = useHissunoChat({
    publicKey,
    apiUrl,
    initialMessage,
    headers,
    userId,
    userMetadata,
  });

  // History is only available if userId is provided
  const canShowHistory = !!userId;

  // Handlers for history panel
  const handleOpenHistory = useCallback(() => {
    if (!canShowHistory) return;
    // Refresh session history when opening
    setSessionHistory(getSessionHistory());
    setIsHistoryOpen(true);
  }, [canShowHistory, getSessionHistory]);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    loadSession(sessionId);
    setIsHistoryOpen(false);
  }, [loadSession]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteSession(sessionId);
    // Refresh the list after deletion
    setSessionHistory(getSessionHistory());
  }, [deleteSession, getSessionHistory]);

  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    closeSession(); // Close session and trigger PM review
    onClose?.();
  }, [onClose, closeSession]);

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

  // Inject critical CSS keyframes on mount (ensures animations work without manual style import)
  useEffect(() => {
    const styleId = 'hissuno-widget-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes hissuno-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }
      @keyframes hissuno-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes hissuno-scale-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes hissuno-slide-in-right {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }, []);

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

      {/* Chat popup or sidepanel */}
      {variant === 'sidepanel' ? (
        <ChatSidepanel
          isOpen={isOpen}
          onClose={close}
          messages={messages}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          error={error}
          title={title}
          placeholder={placeholder}
          theme={resolvedTheme}
          onClearHistory={clearHistory}
          onCancelChat={cancelChat}
          onOpenHistory={canShowHistory ? handleOpenHistory : undefined}
          isHistoryOpen={isHistoryOpen}
          sessionHistory={sessionHistory}
          currentSessionId={currentSessionId}
          onCloseHistory={handleCloseHistory}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
      ) : (
        <ChatPopup
          isOpen={isOpen}
          onClose={close}
          messages={messages}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          error={error}
          title={title}
          placeholder={placeholder}
          theme={resolvedTheme}
          position={bubblePosition}
          offset={bubbleOffset}
          onClearHistory={clearHistory}
          onCancelChat={cancelChat}
          onOpenHistory={canShowHistory ? handleOpenHistory : undefined}
          isHistoryOpen={isHistoryOpen}
          sessionHistory={sessionHistory}
          currentSessionId={currentSessionId}
          onCloseHistory={handleCloseHistory}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
      )}
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
 * Hook to fetch widget settings from the server
 */
function useWidgetSettings(
  publicKey: string,
  enabled: boolean,
  apiUrl: string
): WidgetSettings | null {
  const [settings, setSettings] = useState<WidgetSettings | null>(null);

  useEffect(() => {
    if (!enabled || !publicKey) return;

    // Derive the base URL from apiUrl (which defaults to /api/agent)
    // The widget-settings endpoint is at the same base path level
    const baseUrl = apiUrl.replace(/\/agent$/, '');
    const settingsUrl = `${baseUrl}/widget-settings?publicKey=${encodeURIComponent(publicKey)}`;

    const controller = new AbortController();

    fetch(settingsUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          console.warn('[HissunoWidget] Failed to fetch widget settings:', res.status);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setSettings(data as WidgetSettings);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[HissunoWidget] Failed to fetch widget settings:', err);
        }
      });

    return () => controller.abort();
  }, [publicKey, enabled, apiUrl]);

  return settings;
}

/**
 * Alias for HissunoWidget for backward compatibility
 */
export const SupportWidget = HissunoWidget;
