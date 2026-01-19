/**
 * Security and validation utilities for @hissuno/widget
 */

// Maximum message length in bytes (4KB)
export const MAX_MESSAGE_LENGTH = 4096;

// Sensitive query parameters that should be stripped from URLs
const SENSITIVE_PARAMS = [
  'token',
  'access_token',
  'api_key',
  'apikey',
  'key',
  'secret',
  'password',
  'pwd',
  'auth',
  'authorization',
  'session',
  'sessionid',
  'session_id',
  'jwt',
  'bearer',
  'refresh_token',
  'code',
  'state',
  'nonce',
];

/**
 * Sanitize text content for safe rendering
 * While React's JSX escapes content automatically, this provides
 * defense-in-depth and explicit sanitization for sensitive content.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text safe for display
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  // Replace potentially dangerous characters with HTML entities
  // This is redundant with React's escaping but provides defense-in-depth
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate and sanitize message content
 * Returns sanitized content or null if invalid
 *
 * @param content - The message content to validate
 * @returns Validated content or null
 */
export function validateMessageContent(content: unknown): string | null {
  if (typeof content !== 'string') {
    return null;
  }

  // Check length (in bytes for accurate size limiting)
  const byteLength = new TextEncoder().encode(content).length;
  if (byteLength > MAX_MESSAGE_LENGTH) {
    return null;
  }

  return content;
}

/**
 * SSE Event types that we expect from the server
 */
export type ChatSSEEventType = 'connected' | 'message-start' | 'message-chunk' | 'message-complete' | 'error';
export type UpdateSSEEventType = 'connected' | 'message' | 'status-change' | 'error' | 'heartbeat';

/**
 * Validated chat SSE event structure
 */
export interface ValidatedChatSSEEvent {
  type: ChatSSEEventType;
  content?: string;
  message?: string;
  timestamp: string;
}

/**
 * Validated update SSE event structure
 */
export interface ValidatedUpdateSSEEvent {
  type: UpdateSSEEventType;
  message?: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    senderType?: 'ai' | 'human_agent' | 'system';
  };
  status?: string;
  timestamp: string;
}

const VALID_CHAT_SSE_TYPES: ChatSSEEventType[] = ['connected', 'message-start', 'message-chunk', 'message-complete', 'error'];
const VALID_UPDATE_SSE_TYPES: UpdateSSEEventType[] = ['connected', 'message', 'status-change', 'error', 'heartbeat'];
const VALID_MESSAGE_ROLES = ['user', 'assistant'] as const;
const VALID_SENDER_TYPES = ['ai', 'human_agent', 'system'] as const;

/**
 * Validate a chat SSE event from the server
 * Returns validated event or null if invalid
 *
 * @param data - Raw parsed JSON data from SSE
 * @returns Validated event or null
 */
export function validateChatSSEEvent(data: unknown): ValidatedChatSSEEvent | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Validate type field
  if (typeof obj.type !== 'string' || !VALID_CHAT_SSE_TYPES.includes(obj.type as ChatSSEEventType)) {
    return null;
  }

  // Validate content if present
  if (obj.content !== undefined && typeof obj.content !== 'string') {
    return null;
  }

  // Validate message if present
  if (obj.message !== undefined && typeof obj.message !== 'string') {
    return null;
  }

  // Validate timestamp
  if (typeof obj.timestamp !== 'string') {
    // Allow missing timestamp, use current time
    return {
      type: obj.type as ChatSSEEventType,
      content: obj.content as string | undefined,
      message: obj.message as string | undefined,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    type: obj.type as ChatSSEEventType,
    content: obj.content as string | undefined,
    message: obj.message as string | undefined,
    timestamp: obj.timestamp,
  };
}

/**
 * Validate an update SSE event from the server
 * Returns validated event or null if invalid
 *
 * @param data - Raw parsed JSON data from SSE
 * @returns Validated event or null
 */
export function validateUpdateSSEEvent(data: unknown): ValidatedUpdateSSEEvent | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Validate type field
  if (typeof obj.type !== 'string' || !VALID_UPDATE_SSE_TYPES.includes(obj.type as UpdateSSEEventType)) {
    return null;
  }

  // Validate message object if present
  let validatedMessage: ValidatedUpdateSSEEvent['message'] | undefined;
  if (obj.message !== undefined) {
    if (typeof obj.message !== 'object' || obj.message === null) {
      return null;
    }

    const msg = obj.message as Record<string, unknown>;

    // Validate required message fields
    if (typeof msg.id !== 'string' || !msg.id) {
      return null;
    }
    if (typeof msg.role !== 'string' || !VALID_MESSAGE_ROLES.includes(msg.role as 'user' | 'assistant')) {
      return null;
    }
    if (typeof msg.content !== 'string') {
      return null;
    }
    if (typeof msg.createdAt !== 'string') {
      return null;
    }

    // Validate optional senderType
    if (msg.senderType !== undefined) {
      if (typeof msg.senderType !== 'string' || !VALID_SENDER_TYPES.includes(msg.senderType as 'ai' | 'human_agent' | 'system')) {
        return null;
      }
    }

    validatedMessage = {
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt,
      senderType: msg.senderType as 'ai' | 'human_agent' | 'system' | undefined,
    };
  }

  // Validate status if present
  if (obj.status !== undefined && typeof obj.status !== 'string') {
    return null;
  }

  // Validate timestamp
  const timestamp = typeof obj.timestamp === 'string' ? obj.timestamp : new Date().toISOString();

  return {
    type: obj.type as UpdateSSEEventType,
    message: validatedMessage,
    status: obj.status as string | undefined,
    timestamp,
  };
}

/**
 * Sanitize a URL by removing sensitive query parameters
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL string
 */
export function sanitizePageUrl(url: string): string {
  if (typeof url !== 'string' || !url) {
    return '';
  }

  try {
    const parsed = new URL(url);

    // Remove sensitive parameters
    for (const param of SENSITIVE_PARAMS) {
      parsed.searchParams.delete(param);
      // Also check case-insensitive versions
      parsed.searchParams.delete(param.toLowerCase());
      parsed.searchParams.delete(param.toUpperCase());
    }

    // Also remove any parameter that contains sensitive keywords
    const paramsToRemove: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_PARAMS.some(p => lowerKey.includes(p))) {
        paramsToRemove.push(key);
      }
    });
    for (const key of paramsToRemove) {
      parsed.searchParams.delete(key);
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, return empty string for safety
    return '';
  }
}

/**
 * Valid widget trigger types
 */
export const VALID_TRIGGERS = ['bubble', 'drawer-badge', 'headless'] as const;
export type WidgetTrigger = (typeof VALID_TRIGGERS)[number];

/**
 * Valid widget display types
 */
export const VALID_DISPLAYS = ['popup', 'sidepanel', 'dialog'] as const;
export type WidgetDisplay = (typeof VALID_DISPLAYS)[number];

/**
 * Valid widget positions
 */
export const VALID_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;
export type BubblePosition = (typeof VALID_POSITIONS)[number];

/**
 * Valid theme values
 */
export const VALID_THEMES = ['light', 'dark', 'auto'] as const;
export type WidgetTheme = (typeof VALID_THEMES)[number];

/**
 * Validate a trigger value from server settings
 *
 * @param value - The value to validate
 * @param fallback - Fallback value if invalid
 * @returns Valid trigger value
 */
export function validateTrigger(value: unknown, fallback: WidgetTrigger = 'bubble'): WidgetTrigger {
  if (typeof value === 'string' && VALID_TRIGGERS.includes(value as WidgetTrigger)) {
    return value as WidgetTrigger;
  }
  return fallback;
}

/**
 * Validate a display value from server settings
 *
 * @param value - The value to validate
 * @param fallback - Fallback value if invalid
 * @returns Valid display value
 */
export function validateDisplay(value: unknown, fallback: WidgetDisplay = 'sidepanel'): WidgetDisplay {
  if (typeof value === 'string' && VALID_DISPLAYS.includes(value as WidgetDisplay)) {
    return value as WidgetDisplay;
  }
  return fallback;
}

/**
 * Validate a position value from server settings
 *
 * @param value - The value to validate
 * @param fallback - Fallback value if invalid
 * @returns Valid position value
 */
export function validatePosition(value: unknown, fallback: BubblePosition = 'bottom-right'): BubblePosition {
  if (typeof value === 'string' && VALID_POSITIONS.includes(value as BubblePosition)) {
    return value as BubblePosition;
  }
  return fallback;
}

/**
 * Validate a theme value from server settings
 *
 * @param value - The value to validate
 * @param fallback - Fallback value if invalid
 * @returns Valid theme value
 */
export function validateTheme(value: unknown, fallback: WidgetTheme = 'light'): WidgetTheme {
  if (typeof value === 'string' && VALID_THEMES.includes(value as WidgetTheme)) {
    return value as WidgetTheme;
  }
  return fallback;
}
