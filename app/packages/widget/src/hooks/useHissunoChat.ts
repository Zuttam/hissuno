'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '@ai-sdk/react';
import type { ChatMessage } from '../types';
import {
  MAX_MESSAGE_LENGTH,
  validateChatSSEEvent,
  validateUpdateSSEEvent,
  validateMessageContent,
  sanitizePageUrl,
} from '../utils';

const STORAGE_KEY_PREFIX = 'hissuno_chat_';
const SESSIONS_REGISTRY_PREFIX = 'hissuno_sessions_';
const DEFAULT_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Session entry for conversation history
 * Stored in localStorage when userId is provided
 */
export interface SessionEntry {
  /** Unique session identifier */
  sessionId: string;
  /** User who owns this session */
  userId: string;
  /** Title derived from first user message */
  title: string;
  /** ISO timestamp of last message */
  lastMessageAt: string;
  /** Total number of messages in session */
  messageCount: number;
}

/**
 * Options for the useHissunoChat hook
 */
export interface UseHissunoChatOptions {
  /** Required: Your Hissuno project ID */
  projectId: string;
  /** JWT token for secure widget authentication */
  widgetToken?: string;
  /** The base URL of your Hissuno instance API */
  apiUrl: string;
  /** Initial assistant message shown when chat opens */
  initialMessage?: string;
  /** Custom headers to include with API requests */
  headers?: Record<string, string>;
  /** End-user identifier for session tracking and history */
  userId?: string;
  /** Additional user metadata (name, email, plan, etc.) */
  userMetadata?: Record<string, string>;
  /** Custom session ID (auto-generated if not provided) */
  sessionId?: string;
  /** Override the knowledge package used for this chat session (for testing) */
  packageId?: string;
  /** Inactivity timeout in ms before auto-closing session (default: 30 minutes) */
  inactivityTimeout?: number;
  /** Callback when session is closed */
  onSessionClose?: () => void;
}

/**
 * Return type for the useHissunoChat hook
 */
export interface UseHissunoChatReturn {
  /** All chat messages in the current session */
  messages: ChatMessage[];
  /** Current input field value */
  input: string;
  /** Update the input field value */
  setInput: (value: string) => void;
  /** Submit the current message */
  handleSubmit: (e?: React.FormEvent) => void;
  /** Whether waiting for a response */
  isLoading: boolean;
  /** Whether response is currently streaming */
  isStreaming: boolean;
  /** Partial content being streamed */
  streamingContent: string;
  /** Last error that occurred */
  error: Error | undefined;
  /** Clear history and start a new conversation */
  clearHistory: () => void;
  /** Current session ID */
  currentSessionId: string | null;
  /** Load a previous session by ID */
  loadSession: (sessionId: string, sessionMessages?: Message[]) => void;
  /** Close current session and trigger PM review */
  closeSession: () => Promise<void>;
  /** Cancel an in-progress streaming response */
  cancelChat: () => Promise<void>;
  /** Get list of past sessions (requires userId) */
  getSessionHistory: () => SessionEntry[];
  /** Delete a session from history (requires userId) */
  deleteSession: (sessionId: string) => void;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

function getStorageKey(projectId: string, sessionId?: string): string {
  if (sessionId) {
    return `${STORAGE_KEY_PREFIX}${projectId}_${sessionId}`;
  }
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  senderType?: 'ai' | 'human_agent' | 'system';
}

function loadMessagesFromStorage(projectId: string, sessionId?: string): (Message & { senderType?: string })[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(getStorageKey(projectId, sessionId));
    if (!stored) return [];

    const parsed = JSON.parse(stored) as StoredMessage[];

    return parsed.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
      senderType: msg.senderType,
    }));
  } catch {
    return [];
  }
}

function saveMessagesToStorage(projectId: string, messages: (Message & { senderType?: string })[], sessionId?: string): void {
  if (typeof window === 'undefined') return;

  try {
    const toStore: StoredMessage[] = messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt?.toISOString(),
      senderType: msg.senderType as 'ai' | 'human_agent' | 'system' | undefined,
    }));
    localStorage.setItem(getStorageKey(projectId, sessionId), JSON.stringify(toStore));
  } catch {
    // Storage might be full or disabled
  }
}

function clearMessagesFromStorage(projectId: string, sessionId?: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(getStorageKey(projectId, sessionId));
  } catch {
    // Ignore errors
  }
}

// Session registry functions - for conversation history (requires userId)
function getSessionsRegistryKey(projectId: string, userId: string): string {
  return `${SESSIONS_REGISTRY_PREFIX}${projectId}_${userId}`;
}

function loadSessionsRegistry(projectId: string, userId: string): SessionEntry[] {
  if (typeof window === 'undefined' || !userId) return [];

  try {
    const stored = localStorage.getItem(getSessionsRegistryKey(projectId, userId));
    if (!stored) return [];
    return JSON.parse(stored) as SessionEntry[];
  } catch {
    return [];
  }
}

function saveSessionToRegistry(
  projectId: string,
  userId: string,
  sessionId: string,
  messages: (Message & { senderType?: string })[]
): void {
  if (typeof window === 'undefined' || !userId) return;

  try {
    const registry = loadSessionsRegistry(projectId, userId);

    // Find first user message for title, or use default
    const firstUserMessage = messages.find(m => m.role === 'user');
    const title = firstUserMessage?.content?.slice(0, 50) || 'New conversation';

    // Find last message timestamp
    const lastMessage = messages[messages.length - 1];
    const lastMessageAt = lastMessage?.createdAt?.toISOString() || new Date().toISOString();

    // Update or add session entry
    const existingIndex = registry.findIndex(s => s.sessionId === sessionId);
    const entry: SessionEntry = {
      sessionId,
      userId,
      title: title.length >= 50 ? title + '...' : title,
      lastMessageAt,
      messageCount: messages.length,
    };

    if (existingIndex >= 0) {
      registry[existingIndex] = entry;
    } else {
      registry.unshift(entry); // Add at beginning (newest first)
    }

    // Keep only last 50 sessions
    const trimmed = registry.slice(0, 50);

    localStorage.setItem(getSessionsRegistryKey(projectId, userId), JSON.stringify(trimmed));
  } catch {
    // Storage might be full or disabled
  }
}

function deleteSessionFromRegistry(projectId: string, userId: string, sessionId: string): void {
  if (typeof window === 'undefined' || !userId) return;

  try {
    const registry = loadSessionsRegistry(projectId, userId);
    const filtered = registry.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(getSessionsRegistryKey(projectId, userId), JSON.stringify(filtered));

    // Also delete the session's messages
    clearMessagesFromStorage(projectId, sessionId);
  } catch {
    // Ignore errors
  }
}

/**
 * React hook for managing Hissuno chat functionality
 *
 * Provides complete chat state management including messages, input handling,
 * streaming responses, session management, and conversation history.
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   input,
 *   setInput,
 *   handleSubmit,
 *   isLoading,
 *   isStreaming,
 *   streamingContent,
 * } = useHissunoChat({
 *   projectId: 'your-project-id',
 *   userId: 'user-123',
 * });
 * ```
 *
 * @param options - Hook configuration options
 * @returns Chat state and control functions
 */
export function useHissunoChat({
  projectId,
  widgetToken,
  apiUrl,
  initialMessage,
  headers = {},
  userId,
  userMetadata,
  sessionId: providedSessionId,
  packageId,
  inactivityTimeout = DEFAULT_INACTIVITY_TIMEOUT,
  onSessionClose,
}: UseHissunoChatOptions): UseHissunoChatReturn {
  const hasInitialized = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionClosedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const updatesEventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const isConnectingRef = useRef(false);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const streamingContentRef = useRef<string>('');
  const pendingMessageRef = useRef<string | null>(null);

  // Generate or use provided session ID - includes setter for session regeneration
  const [currentSessionId, setCurrentSessionId] = useState(() => providedSessionId || generateSessionId());
  const sessionId = currentSessionId;

  // Extended message type with senderType
  type ExtendedMessage = Message & { senderType?: string };

  // State for messages, input, and streaming
  const [messages, setMessages] = useState<ExtendedMessage[]>(() => {
    const stored = loadMessagesFromStorage(projectId, sessionId);
    if (stored.length > 0) {
      return stored;
    }

    // If no stored messages and we have an initial message, add it
    if (initialMessage) {
      return [
        {
          id: generateMessageId(),
          role: 'assistant' as const,
          content: initialMessage,
          createdAt: new Date(),
          senderType: 'ai',
        },
      ];
    }

    return [];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<Error | undefined>(undefined);

  // Capture page context with sensitive data stripped
  const pageUrl = typeof window !== 'undefined' ? sanitizePageUrl(window.location.href) : '';
  const pageTitle = typeof window !== 'undefined' ? document.title : '';

  // Save messages to storage whenever they change
  useEffect(() => {
    if (hasInitialized.current && messages.length > 0) {
      saveMessagesToStorage(projectId, messages, sessionId);
    }
    hasInitialized.current = true;
  }, [messages, projectId, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (updatesEventSourceRef.current) {
        updatesEventSourceRef.current.close();
        updatesEventSourceRef.current = null;
      }
    };
  }, []);

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    // Prevent duplicate connections
    if (isConnectingRef.current || eventSourceRef.current) {
      return;
    }
    isConnectingRef.current = true;

    // Reset streaming state
    streamingContentRef.current = '';
    pendingMessageRef.current = null;
    setStreamingContent('');
    setIsStreaming(true);

    const streamUrl = `${apiUrl}/stream?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const rawData = JSON.parse(event.data);
        const data = validateChatSSEEvent(rawData);

        // Skip invalid events
        if (!data) {
          console.warn('[useHissunoChat] Received invalid SSE event, skipping');
          return;
        }

        if (data.type === 'message-chunk' && data.content) {
          // Validate content length to prevent DoS
          const newContent = streamingContentRef.current + data.content;
          if (new TextEncoder().encode(newContent).length <= MAX_MESSAGE_LENGTH * 10) {
            streamingContentRef.current = newContent;
            setStreamingContent(streamingContentRef.current);
          }
        }

        if (data.type === 'message-complete') {
          eventSource.close();
          eventSourceRef.current = null;
          isConnectingRef.current = false;

          // Capture content from ref and clear immediately to prevent duplicates
          const completedContent = streamingContentRef.current;
          streamingContentRef.current = '';
          setStreamingContent('');

          // Guard against duplicate message additions
          if (completedContent && mountedRef.current && pendingMessageRef.current !== completedContent) {
            pendingMessageRef.current = completedContent;
            setMessages((prev) => [
              ...prev,
              {
                id: generateMessageId(),
                role: 'assistant' as const,
                content: completedContent,
                createdAt: new Date(),
              },
            ]);
          }

          setIsStreaming(false);
          setIsLoading(false);
        }

        if (data.type === 'error') {
          eventSource.close();
          eventSourceRef.current = null;
          isConnectingRef.current = false;
          setError(new Error(data.message ?? 'Chat failed'));
          setIsStreaming(false);
          setIsLoading(false);
          setStreamingContent('');
        }
      } catch (err) {
        console.error('[useHissunoChat] Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
        isConnectingRef.current = false;
        if (mountedRef.current) {
          setIsStreaming(false);
          setIsLoading(false);
        }
      }
    };
  }, [apiUrl, projectId, sessionId]);

  // Check for running chat on mount
  useEffect(() => {
    const checkRunningChat = async () => {
      try {
        const statusUrl = `${apiUrl}?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`;
        const response = await fetch(statusUrl);
        if (!response.ok) return;

        const status = await response.json();
        if (status.isRunning) {
          setIsLoading(true);
          connectToStream();
        }
      } catch (err) {
        console.error('[useHissunoChat] Failed to check running chat:', err);
      }
    };

    checkRunningChat();
  }, [apiUrl, projectId, sessionId, connectToStream]);

  // Connect to updates SSE for human agent messages
  useEffect(() => {
    if (sessionClosedRef.current || !sessionId) return;

    const updatesUrl = `${apiUrl}/updates?sessionId=${encodeURIComponent(sessionId)}&projectId=${encodeURIComponent(projectId)}`;

    const connectUpdates = () => {
      if (updatesEventSourceRef.current) return;

      const eventSource = new EventSource(updatesUrl);
      updatesEventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const rawData = JSON.parse(event.data);
          const data = validateUpdateSSEEvent(rawData);

          // Skip invalid events
          if (!data) {
            console.warn('[useHissunoChat] Received invalid updates SSE event, skipping');
            return;
          }

          if (data.type === 'message' && data.message) {
            // Validate message content length
            const validContent = validateMessageContent(data.message.content);
            if (!validContent) {
              console.warn('[useHissunoChat] Message content invalid or too long, skipping');
              return;
            }

            // Only add if we haven't seen this message before
            if (!seenMessageIds.current.has(data.message.id)) {
              seenMessageIds.current.add(data.message.id);
              setMessages((prev) => [
                ...prev,
                {
                  id: data.message!.id,
                  role: data.message!.role,
                  content: validContent,
                  createdAt: new Date(data.message!.createdAt),
                  senderType: data.message!.senderType || 'human_agent',
                },
              ]);
            }
          }

          if (data.type === 'status-change' && data.status === 'human_takeover') {
            // Human takeover activated - inject system message
            const takeoverId = `system_takeover_${Date.now()}`;
            if (!seenMessageIds.current.has(takeoverId)) {
              seenMessageIds.current.add(takeoverId);
              setMessages((prev) => [
                ...prev,
                {
                  id: takeoverId,
                  role: 'assistant' as const,
                  content: 'A human agent will be with you shortly.',
                  createdAt: new Date(),
                  senderType: 'system',
                },
              ]);
            }
          }

          if (data.type === 'status-change' && data.status === 'closed') {
            // Session was closed, cleanup
            sessionClosedRef.current = true;
            eventSource.close();
            updatesEventSourceRef.current = null;
            onSessionClose?.();
          }
        } catch (err) {
          console.error('[useHissunoChat] Failed to parse updates SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        // Reconnect after a delay on error
        if (eventSource.readyState === EventSource.CLOSED && mountedRef.current && !sessionClosedRef.current) {
          updatesEventSourceRef.current = null;
          setTimeout(connectUpdates, 5000);
        }
      };
    };

    // Start listening for updates after first message is sent
    if (messages.length > 1) {
      connectUpdates();
    }

    return () => {
      if (updatesEventSourceRef.current) {
        updatesEventSourceRef.current.close();
        updatesEventSourceRef.current = null;
      }
    };
  }, [apiUrl, projectId, sessionId, messages.length, onSessionClose]);

  // Convert messages to ChatMessage format
  const chatMessages: ChatMessage[] = useMemo(() => {
    return messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt,
      senderType: msg.senderType as ChatMessage['senderType'],
    }));
  }, [messages]);

  const clearHistory = useCallback(() => {
    // Save current session to registry before clearing (only if userId is provided and has messages)
    if (userId && messages.length > 0) {
      // Check if there's at least one user message (not just initial message)
      const hasUserMessages = messages.some(m => m.role === 'user');
      if (hasUserMessages) {
        saveSessionToRegistry(projectId, userId, sessionId, messages);
      }
    }

    // Generate a new session ID for the new conversation
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);

    // Reset session state
    sessionClosedRef.current = false;
    seenMessageIds.current = new Set();

    // Close existing SSE connections
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (updatesEventSourceRef.current) {
      updatesEventSourceRef.current.close();
      updatesEventSourceRef.current = null;
    }

    // Reset to initial message if provided
    if (initialMessage) {
      setMessages([
        {
          id: generateMessageId(),
          role: 'assistant',
          content: initialMessage,
          createdAt: new Date(),
          senderType: 'ai',
        },
      ]);
    } else {
      setMessages([]);
    }
    setError(undefined);
    setStreamingContent('');
  }, [projectId, userId, initialMessage, sessionId, messages]);

  const loadSession = useCallback((newSessionId: string, sessionMessages?: Message[]) => {
    // Reset session state
    sessionClosedRef.current = false;
    seenMessageIds.current = new Set();

    // Close existing SSE connections
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (updatesEventSourceRef.current) {
      updatesEventSourceRef.current.close();
      updatesEventSourceRef.current = null;
    }

    // Update current session ID
    setCurrentSessionId(newSessionId);

    // Use provided messages or load from storage
    if (sessionMessages && sessionMessages.length > 0) {
      setMessages(sessionMessages);
      // Save to storage for persistence
      saveMessagesToStorage(projectId, sessionMessages, newSessionId);
    } else {
      // Load from localStorage
      const storedMessages = loadMessagesFromStorage(projectId, newSessionId);
      if (storedMessages.length > 0) {
        setMessages(storedMessages);
      } else if (initialMessage) {
        setMessages([
          {
            id: generateMessageId(),
            role: 'assistant',
            content: initialMessage,
            createdAt: new Date(),
            senderType: 'ai',
          },
        ]);
      } else {
        setMessages([]);
      }
    }

    setError(undefined);
    setStreamingContent('');
  }, [projectId, initialMessage]);

  // Get session history for current user (only if userId is provided)
  const getSessionHistory = useCallback((): SessionEntry[] => {
    if (!userId) return [];
    return loadSessionsRegistry(projectId, userId);
  }, [projectId, userId]);

  // Delete a session from history
  const deleteSession = useCallback((sessionIdToDelete: string) => {
    if (!userId) return;
    deleteSessionFromRegistry(projectId, userId, sessionIdToDelete);
  }, [projectId, userId]);

  // Close session function - calls the backend to close the session and trigger PM review
  const closeSession = useCallback(async () => {
    if (!sessionId || sessionClosedRef.current) return;
    sessionClosedRef.current = true;

    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    try {
      await fetch(`${apiUrl}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ sessionId, projectId }),
      });
      onSessionClose?.();
    } catch (error) {
      console.error('[HissunoWidget] Failed to close session:', error);
    }
  }, [sessionId, apiUrl, projectId, headers, onSessionClose]);

  // Cancel ongoing chat
  const cancelChat = useCallback(async () => {
    try {
      const cancelUrl = `${apiUrl}/stream/cancel`;
      const response = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          projectId,
          sessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to cancel');
      }

      // Close EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Reset connecting flag so new messages can be sent
      isConnectingRef.current = false;

      setIsLoading(false);
      setIsStreaming(false);
      setStreamingContent('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel';
      setError(new Error(message));
    }
  }, [apiUrl, projectId, sessionId, headers]);

  // Inactivity timeout - reset on new messages
  useEffect(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Only set timer if we have messages and session isn't closed
    if (messages.length > 0 && !sessionClosedRef.current && inactivityTimeout > 0) {
      inactivityTimerRef.current = setTimeout(() => {
        closeSession();
      }, inactivityTimeout);
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [messages, inactivityTimeout, closeSession]);

  // Handle page unload - use sendBeacon for reliable delivery
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!sessionId || sessionClosedRef.current) return;

      // Use sendBeacon for reliable delivery on page unload
      const url = `${apiUrl}/close`;
      const data = JSON.stringify({ sessionId, projectId });
      navigator.sendBeacon(url, data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, apiUrl, projectId]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      const messageContent = input.trim();
      if (!messageContent) return;

      // Validate message length to prevent DoS
      const validatedContent = validateMessageContent(messageContent);
      if (!validatedContent) {
        setError(new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} bytes allowed.`));
        return;
      }

      setError(undefined);
      setIsLoading(true);
      setInput('');

      // Add user message immediately
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: messageContent,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Build messages array for API
        const allMessages = [...messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            messages: allMessages,
            projectId,
            userId,
            userMetadata,
            pageUrl,
            pageTitle,
            sessionId,
            widgetToken,
            packageId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 409) {
            // Already running - connect to stream
            connectToStream();
            return;
          }
          throw new Error(data.error ?? 'Failed to send message');
        }

        const result = await response.json();

        // If human takeover is active, skip AI stream
        if (result.status === 'human_takeover') {
          setIsLoading(false);
          return;
        }

        // Connect to SSE stream
        connectToStream();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(new Error(message));
        setIsLoading(false);
      }
    },
    [input, messages, apiUrl, headers, projectId, widgetToken, userId, userMetadata, pageUrl, pageTitle, sessionId, packageId, connectToStream]
  );

  return useMemo(
    () => ({
      messages: chatMessages,
      input,
      setInput,
      handleSubmit,
      isLoading,
      isStreaming,
      streamingContent,
      error,
      clearHistory,
      currentSessionId: sessionId || null,
      loadSession,
      closeSession,
      cancelChat,
      getSessionHistory,
      deleteSession,
    }),
    [chatMessages, input, setInput, handleSubmit, isLoading, isStreaming, streamingContent, error, clearHistory, sessionId, loadSession, closeSession, cancelChat, getSessionHistory, deleteSession]
  );
}
