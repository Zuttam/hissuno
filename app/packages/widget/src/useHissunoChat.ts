'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '@ai-sdk/react';
import type { ChatMessage } from './types';

const STORAGE_KEY_PREFIX = 'hissuno_chat_';
const DEFAULT_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

interface ChatSSEEvent {
  type: 'connected' | 'message-start' | 'message-chunk' | 'message-complete' | 'error';
  content?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface UseHissunoChatOptions {
  publicKey: string;
  apiUrl?: string;
  initialMessage?: string;
  headers?: Record<string, string>;
  userId?: string;
  userMetadata?: Record<string, string>;
  sessionId?: string;
  inactivityTimeout?: number;
  onSessionClose?: () => void;
}

interface UseHissunoChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: Error | undefined;
  clearHistory: () => void;
  currentSessionId: string | null;
  loadSession: (sessionId: string, sessionMessages: Message[]) => void;
  closeSession: () => Promise<void>;
  cancelChat: () => Promise<void>;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `session_${timestamp}_${random}`;
}

function getStorageKey(publicKey: string, sessionId?: string): string {
  if (sessionId) {
    return `${STORAGE_KEY_PREFIX}${publicKey}_${sessionId}`;
  }
  return `${STORAGE_KEY_PREFIX}${publicKey}`;
}

function loadMessagesFromStorage(publicKey: string, sessionId?: string): Message[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(getStorageKey(publicKey, sessionId));
    if (!stored) return [];

    const parsed = JSON.parse(stored) as Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt?: string;
    }>;

    return parsed.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveMessagesToStorage(publicKey: string, messages: Message[], sessionId?: string): void {
  if (typeof window === 'undefined') return;

  try {
    const toStore = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt?.toISOString(),
    }));
    localStorage.setItem(getStorageKey(publicKey, sessionId), JSON.stringify(toStore));
  } catch {
    // Storage might be full or disabled
  }
}

function clearMessagesFromStorage(publicKey: string, sessionId?: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(getStorageKey(publicKey, sessionId));
  } catch {
    // Ignore errors
  }
}

export function useHissunoChat({
  publicKey,
  apiUrl = '/api/agent',
  initialMessage,
  headers = {},
  userId,
  userMetadata,
  sessionId: providedSessionId,
  inactivityTimeout = DEFAULT_INACTIVITY_TIMEOUT,
  onSessionClose,
}: UseHissunoChatOptions): UseHissunoChatReturn {
  const hasInitialized = useRef(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionClosedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  // Generate or use provided session ID
  const [currentSessionId] = useState(() => providedSessionId || generateSessionId());
  const sessionId = currentSessionId;

  // State for messages, input, and streaming
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadMessagesFromStorage(publicKey, sessionId);
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

  // Capture page context
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const pageTitle = typeof window !== 'undefined' ? document.title : '';

  // Save messages to storage whenever they change
  useEffect(() => {
    if (hasInitialized.current && messages.length > 0) {
      saveMessagesToStorage(publicKey, messages, sessionId);
    }
    hasInitialized.current = true;
  }, [messages, publicKey, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStreamingContent('');
    setIsStreaming(true);

    const streamUrl = `${apiUrl}/stream?publicKey=${encodeURIComponent(publicKey)}&sessionId=${encodeURIComponent(sessionId)}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as ChatSSEEvent;

        if (data.type === 'message-chunk' && data.content) {
          setStreamingContent((prev) => prev + data.content);
        }

        if (data.type === 'message-complete') {
          eventSource.close();
          eventSourceRef.current = null;

          // Add complete message to messages array
          setStreamingContent((currentContent) => {
            if (currentContent && mountedRef.current) {
              setMessages((prev) => [
                ...prev,
                {
                  id: generateMessageId(),
                  role: 'assistant' as const,
                  content: currentContent,
                  createdAt: new Date(),
                },
              ]);
            }
            return '';
          });

          setIsStreaming(false);
          setIsLoading(false);
        }

        if (data.type === 'error') {
          eventSource.close();
          eventSourceRef.current = null;
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
        if (mountedRef.current) {
          setIsStreaming(false);
          setIsLoading(false);
        }
      }
    };
  }, [apiUrl, publicKey, sessionId]);

  // Check for running chat on mount
  useEffect(() => {
    const checkRunningChat = async () => {
      try {
        const statusUrl = `${apiUrl}?publicKey=${encodeURIComponent(publicKey)}&sessionId=${encodeURIComponent(sessionId)}`;
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
  }, [apiUrl, publicKey, sessionId, connectToStream]);

  // Convert messages to ChatMessage format
  const chatMessages: ChatMessage[] = useMemo(() => {
    return messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  }, [messages]);

  const clearHistory = useCallback(() => {
    clearMessagesFromStorage(publicKey, sessionId);

    // Reset to initial message if provided
    if (initialMessage) {
      setMessages([
        {
          id: generateMessageId(),
          role: 'assistant',
          content: initialMessage,
          createdAt: new Date(),
        },
      ]);
    } else {
      setMessages([]);
    }
    setError(undefined);
    setStreamingContent('');
  }, [publicKey, initialMessage, sessionId]);

  const loadSession = useCallback((newSessionId: string, sessionMessages: Message[]) => {
    setMessages(sessionMessages);
    setError(undefined);
    setStreamingContent('');
    // Save the loaded messages to localStorage for this session
    saveMessagesToStorage(publicKey, sessionMessages, newSessionId);
  }, [publicKey]);

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
      // Derive the base URL from apiUrl (e.g., /api/agent -> /api)
      const baseUrl = apiUrl.replace(/\/agent$/, '');
      await fetch(`${baseUrl}/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Key': publicKey,
          ...headers,
        },
        body: JSON.stringify({ triggerPMReview: true }),
      });
      onSessionClose?.();
    } catch (error) {
      console.error('[HissunoWidget] Failed to close session:', error);
    }
  }, [sessionId, apiUrl, publicKey, headers, onSessionClose]);

  // Cancel ongoing chat
  const cancelChat = useCallback(async () => {
    try {
      const cancelUrl = `${apiUrl}/cancel`;
      const response = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          publicKey,
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

      setIsLoading(false);
      setIsStreaming(false);
      setStreamingContent('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel';
      setError(new Error(message));
    }
  }, [apiUrl, publicKey, sessionId, headers]);

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
      const baseUrl = apiUrl.replace(/\/agent$/, '');
      const url = `${baseUrl}/sessions/${sessionId}/close`;
      const data = JSON.stringify({ triggerPMReview: true });
      navigator.sendBeacon(url, data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, apiUrl]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      const messageContent = input.trim();
      if (!messageContent) return;

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
            publicKey,
            userId,
            userMetadata,
            pageUrl,
            pageTitle,
            sessionId,
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

        // Connect to SSE stream
        connectToStream();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(new Error(message));
        setIsLoading(false);
      }
    },
    [input, messages, apiUrl, headers, publicKey, userId, userMetadata, pageUrl, pageTitle, sessionId, connectToStream]
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
    }),
    [chatMessages, input, setInput, handleSubmit, isLoading, isStreaming, streamingContent, error, clearHistory, sessionId, loadSession, closeSession, cancelChat]
  );
}
