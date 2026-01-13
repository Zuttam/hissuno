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
 *         projectId="your-project-id"
 *         widgetToken={generatedToken} // Optional: generated on your backend
 *         userId={currentUser.id}
 *         userMetadata={{ name: currentUser.name, email: currentUser.email }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function HissunoWidget({
  projectId,
  widgetToken,
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

  // Fetch widget settings from server if enabled (must be called before any conditional returns)
  const { settings: serverSettings, blocked, loading: settingsLoading, error: settingsError } = useWidgetSettings(projectId || '', fetchDefaults && !!projectId, apiUrl, widgetToken);

  // Debug: log settings
  console.log('[HissunoWidget] serverSettings:', serverSettings, 'propVariant:', propVariant);

  // Merge props with server defaults (props always win)
  const resolvedVariant: WidgetVariant = propVariant ?? serverSettings?.variant ?? 'popup';
  console.log('[HissunoWidget] resolvedVariant:', resolvedVariant);
  const resolvedBaseTheme = propTheme ?? serverSettings?.theme ?? 'light';
  const resolvedBubblePosition: BubblePosition = propBubblePosition ?? serverSettings?.position ?? 'bottom-right';
  const resolvedTitle = propTitle ?? serverSettings?.title ?? 'Support';
  const resolvedInitialMessage = propInitialMessage ?? serverSettings?.initialMessage ?? "Hi! 👋 How can I help you today?";

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
    projectId: projectId || '',
    widgetToken,
    apiUrl,
    initialMessage: resolvedInitialMessage,
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
  const resolvedTheme = useResolvedTheme(resolvedBaseTheme);

  // Validate required props (after all hooks)
  if (!projectId) {
    console.error('[HissunoWidget] projectId is required');
    return null;
  }

  // Don't render until settings are loaded (when fetchDefaults is enabled)
  if (settingsLoading) {
    return null;
  }

  // If origin is blocked, don't render the widget
  if (blocked) {
    console.warn('[HissunoWidget] Widget blocked: origin not allowed for this project');
    return null;
  }

  // Don't render if settings fetch failed and we have no settings
  if (settingsError && !serverSettings) {
    console.warn('[HissunoWidget] Widget not rendered: failed to fetch settings');
    return null;
  }

  // Warn if token is required but not provided
  if (serverSettings?.tokenRequired && !widgetToken) {
    console.warn('[HissunoWidget] This project requires a widgetToken for secure authentication. Requests may fail.');
  }

  return (
    <div className={`hissuno-widget ${className ?? ''}`}>
      {/* Custom trigger or default bubble */}
      {renderTrigger ? (
        renderTrigger({ open, close, toggle, isOpen })
      ) : showBubble ? (
        <ChatBubble
          isOpen={isOpen}
          onClick={toggle}
          position={resolvedBubblePosition}
          offset={bubbleOffset}
          theme={resolvedTheme}
        />
      ) : null}

      {/* Chat popup or sidepanel */}
      {resolvedVariant === 'sidepanel' ? (
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
          title={resolvedTitle}
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
          title={resolvedTitle}
          placeholder={placeholder}
          theme={resolvedTheme}
          position={resolvedBubblePosition}
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
 * Returns settings, blocked flag, and loading state
 */
function useWidgetSettings(
  projectId: string,
  enabled: boolean,
  apiUrl: string,
  widgetToken?: string
): { settings: WidgetSettings | null; blocked: boolean; loading: boolean; error: boolean } {
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    // Widget settings endpoint is under /api/agent/widget
    const settingsUrl = `${apiUrl}/widget?projectId=${encodeURIComponent(projectId)}`;

    const controller = new AbortController();

    fetch(settingsUrl, {
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 403) {
          // Origin blocked
          console.warn('[HissunoWidget] Origin not allowed for this project');
          setBlocked(true);
          return null;
        }
        if (!res.ok) {
          console.warn('[HissunoWidget] Failed to fetch widget settings:', res.status);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          console.log('[HissunoWidget] Fetched settings:', data);
          setSettings(data as WidgetSettings);
          if (data.blocked) {
            setBlocked(true);
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[HissunoWidget] Failed to fetch widget settings:', err);
          setError(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [projectId, enabled, apiUrl]);

  return { settings, blocked, loading, error };
}

/**
 * Alias for HissunoWidget for backward compatibility
 */
export const SupportWidget = HissunoWidget;
