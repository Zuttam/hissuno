'use client';

import React, { useState, useCallback, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { ChatBubble, DrawerBadge } from './triggers';
import { ChatPopup, ChatSidepanel, ChatDialog } from './displays';
import { ConversationHistory } from './shared';
import { useHissunoChat, useKeyboardShortcut, useResolvedTheme } from './hooks';
import type { SessionEntry } from './hooks';
import type {
  HissunoWidgetProps,
  WidgetSettings,
  WidgetTrigger,
  WidgetDisplay,
  BubblePosition,
} from './types';
import { validateTrigger, validateDisplay, validatePosition, validateTheme } from './utils';

const DEFAULT_API_URL = '/api/integrations/widget/chat';

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
  trigger: propTrigger,
  display: propDisplay,
  shortcut: propShortcut,
  fetchDefaults = true,
  userId,
  userMetadata,
  apiUrl = DEFAULT_API_URL,
  theme: propTheme,
  bubblePosition: propBubblePosition,
  bubbleOffset,
  drawerBadgeLabel: propDrawerBadgeLabel,
  drawerBadgeInitialY: propDrawerBadgeInitialY,
  dialogWidth: propDialogWidth,
  dialogHeight: propDialogHeight,
  renderTrigger,
  title: propTitle,
  placeholder = 'Ask a question or report an issue...',
  initialMessage: propInitialMessage,
  defaultOpen = false,
  onOpen,
  onClose,
  onControlsReady,
  className,
  headers = {},
}: HissunoWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);

  // Fetch widget settings from server if enabled (must be called before any conditional returns)
  const {
    settings: serverSettings,
    blocked,
    loading: settingsLoading,
    error: settingsError,
  } = useWidgetSettings(projectId || '', fetchDefaults && !!projectId, apiUrl ?? DEFAULT_API_URL, widgetToken);

  // Resolve trigger type (props > server > default)
  const resolveTrigger = (): WidgetTrigger => {
    if (propTrigger) return propTrigger;
    if (renderTrigger) return 'headless'; // Custom trigger means headless
    if (serverSettings?.trigger) return serverSettings.trigger;
    return 'bubble';
  };
  const resolvedTrigger = resolveTrigger();

  // Resolve display type (props > server > default)
  const resolveDisplay = (): WidgetDisplay => {
    if (propDisplay) return propDisplay;
    if (serverSettings?.display) return serverSettings.display;
    return 'sidepanel';
  };
  const resolvedDisplay = resolveDisplay();

  // Resolve shortcut (props > server > default)
  const resolvedShortcut = propShortcut !== undefined
    ? propShortcut
    : serverSettings?.shortcut !== undefined
      ? serverSettings.shortcut
      : 'mod+k';

  const resolvedBaseTheme = propTheme ?? serverSettings?.theme ?? 'light';
  const resolvedBubblePosition: BubblePosition =
    propBubblePosition ?? serverSettings?.position ?? 'bottom-right';
  const resolvedTitle = propTitle ?? serverSettings?.title ?? 'Support';
  const resolvedInitialMessage =
    propInitialMessage ?? serverSettings?.initialMessage ?? "Hi! How can I help you today?";
  const resolvedDrawerBadgeLabel =
    propDrawerBadgeLabel ?? serverSettings?.drawerBadgeLabel ?? 'Support';
  const resolvedDialogWidth = propDialogWidth ?? 600;
  const resolvedDialogHeight = propDialogHeight ?? 500;

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

  // Expose chat controls to parent components
  useEffect(() => {
    onControlsReady?.({ setInput });
  }, [onControlsReady, setInput]);

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

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      loadSession(sessionId);
      setIsHistoryOpen(false);
    },
    [loadSession]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
      // Refresh the list after deletion
      setSessionHistory(getSessionHistory());
    },
    [deleteSession, getSessionHistory]
  );

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

  // Keyboard shortcut
  useKeyboardShortcut({
    shortcut: resolvedShortcut,
    onTrigger: toggle,
    enabled: true,
  });

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
    return <div className="hissuno-widget hissuno-widget-loading" />;
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
    console.warn(
      '[HissunoWidget] This project requires a widgetToken for secure authentication. Requests may fail.'
    );
  }

  // Render the appropriate trigger
  const renderWidgetTrigger = () => {
    // Custom trigger takes priority
    if (renderTrigger) {
      return renderTrigger({ open, close, toggle, isOpen });
    }

    switch (resolvedTrigger) {
      case 'bubble':
        return (
          <ChatBubble
            isOpen={isOpen}
            onClick={toggle}
            position={resolvedBubblePosition}
            offset={bubbleOffset}
            theme={resolvedTheme}
          />
        );
      case 'drawer-badge':
        return (
          <DrawerBadge
            isOpen={isOpen}
            onClick={toggle}
            label={resolvedDrawerBadgeLabel}
            theme={resolvedTheme}
            initialY={propDrawerBadgeInitialY}
          />
        );
      case 'headless':
      default:
        return null;
    }
  };

  // Common display props
  const displayProps = {
    isOpen,
    onClose: close,
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    title: resolvedTitle,
    placeholder,
    theme: resolvedTheme,
    onClearHistory: clearHistory,
    onCancelChat: cancelChat,
    onOpenHistory: canShowHistory ? handleOpenHistory : undefined,
    isHistoryOpen,
    sessionHistory,
    currentSessionId,
    onCloseHistory: handleCloseHistory,
    onSelectSession: handleSelectSession,
    onDeleteSession: handleDeleteSession,
  };

  // Render the appropriate display
  const renderDisplay = () => {
    switch (resolvedDisplay) {
      case 'popup':
        return (
          <ChatPopup
            {...displayProps}
            position={resolvedBubblePosition}
            offset={bubbleOffset}
          />
        );
      case 'dialog':
        return (
          <ChatDialog
            {...displayProps}
            width={resolvedDialogWidth}
            height={resolvedDialogHeight}
          />
        );
      case 'sidepanel':
      default:
        return <ChatSidepanel {...displayProps} />;
    }
  };

  return (
    <WidgetErrorBoundary>
      <div className={`hissuno-widget ${className ?? ''}`}>
        {renderWidgetTrigger()}
        {renderDisplay()}
      </div>
    </WidgetErrorBoundary>
  );
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

    // Widget settings endpoint is at /api/integrations/widget (separate from chat API)
    const settingsUrl = `${apiUrl.replace(/\/chat\/?$/, '')}?projectId=${encodeURIComponent(projectId)}`;

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
          // Validate all enum values from server to prevent injection
          const mappedSettings: WidgetSettings = {
            trigger: validateTrigger(data.trigger, 'bubble'),
            display: validateDisplay(data.display, 'sidepanel'),
            shortcut: data.shortcut ?? 'mod+k',
            theme: validateTheme(data.theme, 'light'),
            position: validatePosition(data.position, 'bottom-right'),
            title: typeof data.title === 'string' ? data.title : 'Support',
            initialMessage: typeof data.initialMessage === 'string' ? data.initialMessage : "Hi! How can I help you today?",
            drawerBadgeLabel: typeof data.drawerBadgeLabel === 'string' ? data.drawerBadgeLabel : 'Support',
            tokenRequired: Boolean(data.tokenRequired),
            blocked: Boolean(data.blocked),
          };
          setSettings(mappedSettings);
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

  // Compute effective loading state: true if we should be loading but don't have results yet
  // This handles the case where `enabled` changes from false to true between renders
  const effectiveLoading = loading || (enabled && !settings && !error && !blocked);

  return { settings, blocked, loading: effectiveLoading, error };
}

/**
 * Error boundary to prevent widget errors from crashing the consumer's app
 */
class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[HissunoWidget] Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return null; // Silent failure - don't disrupt the host app
    }
    return this.props.children;
  }
}

