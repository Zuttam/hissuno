'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChat, type Message } from '@ai-sdk/react';
import type { ChatMessage } from './types';

const STORAGE_KEY_PREFIX = 'hissuno_chat_';

interface UseHissunoChatOptions {
  publicKey: string;
  apiUrl?: string;
  initialMessage?: string;
  headers?: Record<string, string>;
  userId?: string;
  userMetadata?: Record<string, string>;
}

interface UseHissunoChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  error: Error | undefined;
  clearHistory: () => void;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getStorageKey(publicKey: string): string {
  return `${STORAGE_KEY_PREFIX}${publicKey}`;
}

function loadMessagesFromStorage(publicKey: string): Message[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(getStorageKey(publicKey));
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

function saveMessagesToStorage(publicKey: string, messages: Message[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const toStore = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt?.toISOString(),
    }));
    localStorage.setItem(getStorageKey(publicKey), JSON.stringify(toStore));
  } catch {
    // Storage might be full or disabled
  }
}

function clearMessagesFromStorage(publicKey: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(getStorageKey(publicKey));
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
}: UseHissunoChatOptions): UseHissunoChatReturn {
  const hasInitialized = useRef(false);
  
  // Load initial messages from storage or create initial assistant message
  const getInitialMessages = useCallback((): Message[] => {
    const stored = loadMessagesFromStorage(publicKey);
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
  }, [publicKey, initialMessage]);
  
  // Capture page context
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const pageTitle = typeof window !== 'undefined' ? document.title : '';
  
  const {
    messages: aiMessages,
    input,
    setInput,
    handleSubmit: aiHandleSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: apiUrl,
    streamProtocol: 'text',
    initialMessages: getInitialMessages(),
    body: {
      publicKey,
      ...(userId && { userId }),
      ...(userMetadata && { userMetadata }),
      ...(pageUrl && { pageUrl }),
      ...(pageTitle && { pageTitle }),
    },
    headers: {
      ...headers,
      'X-Public-Key': publicKey,
    },
  });
  
  // Save messages to storage whenever they change
  useEffect(() => {
    if (hasInitialized.current && aiMessages.length > 0) {
      saveMessagesToStorage(publicKey, aiMessages);
    }
    hasInitialized.current = true;
  }, [aiMessages, publicKey]);
  
  // Convert AI SDK messages to our ChatMessage format
  const messages: ChatMessage[] = useMemo(() => {
    return aiMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  }, [aiMessages]);
  
  const clearHistory = useCallback(() => {
    clearMessagesFromStorage(publicKey);
    
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
  }, [publicKey, initialMessage, setMessages]);
  
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      if (!input.trim()) return;
      aiHandleSubmit(e);
    },
    [input, aiHandleSubmit]
  );
  
  return useMemo(
    () => ({
      messages,
      input,
      setInput,
      handleSubmit,
      isLoading,
      error,
      clearHistory,
    }),
    [messages, input, setInput, handleSubmit, isLoading, error, clearHistory]
  );
}
