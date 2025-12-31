import type { ReactNode } from 'react';

/**
 * Position options for the bubble
 */
export type BubblePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Widget display variant
 */
export type WidgetVariant = 'popup' | 'sidepanel';

/**
 * Offset configuration for bubble positioning
 */
export interface BubbleOffset {
  x?: number;
  y?: number;
}

/**
 * Props passed to the custom trigger render function
 */
export interface TriggerRenderProps {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

/**
 * Props for the HissunoWidget component
 */
export interface HissunoWidgetProps {
  /**
   * The public key (pk_live_...) from your Hissuno dashboard
   * This is safe to expose in frontend code and uniquely identifies your project
   */
  publicKey: string;

  /**
   * Widget display variant
   * @default "popup"
   */
  variant?: WidgetVariant;

  /**
   * Whether to fetch default settings from the server
   * When true, the widget will fetch settings using the publicKey and use them as defaults.
   * Explicit props will always override fetched defaults.
   * @default true
   */
  fetchDefaults?: boolean;

  /**
   * Optional identifier for the end-user using the widget
   * This helps track sessions per user in your Hissuno dashboard
   */
  userId?: string;

  /**
   * Optional metadata about the end-user (e.g., name, email, plan)
   * This information will be visible in session details
   */
  userMetadata?: Record<string, string>;

  /**
   * The URL of your Hissuno API endpoint
   * @default "/api/agent"
   */
  apiUrl?: string;

  /**
   * Theme for the chat widget
   * @default "light"
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Whether to show the floating bubble trigger
   * Set to false when using a custom trigger
   * @default true
   */
  showBubble?: boolean;

  /**
   * Position of the floating bubble on the page
   * @default "bottom-right"
   */
  bubblePosition?: BubblePosition;

  /**
   * Offset from the edge of the screen in pixels
   * @default { x: 20, y: 20 }
   */
  bubbleOffset?: BubbleOffset;

  /**
   * Custom render function for the trigger element
   * Use this to provide your own button/component to open the chat
   */
  renderTrigger?: (props: TriggerRenderProps) => ReactNode;

  /**
   * Custom title for the chat window
   * @default "Support"
   */
  title?: string;

  /**
   * Custom placeholder text for the input field
   * @default "Ask a question or report an issue..."
   */
  placeholder?: string;

  /**
   * Initial message shown when the chat opens
   * @default "Hi! 👋 How can I help you today?"
   */
  initialMessage?: string;

  /**
   * Whether the chat window should be open by default
   * @default false
   */
  defaultOpen?: boolean;

  /**
   * Callback when the chat window opens
   */
  onOpen?: () => void;

  /**
   * Callback when the chat window closes
   */
  onClose?: () => void;

  /**
   * Additional CSS class name for custom styling
   */
  className?: string;

  /**
   * Custom headers to send with each request
   */
  headers?: Record<string, string>;
}

/**
 * Configuration for the Hissuno widget
 */
export interface HissunoConfig {
  publicKey: string;
  apiUrl: string;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

/**
 * Widget settings fetched from server
 */
export interface WidgetSettings {
  variant: WidgetVariant;
  theme: 'light' | 'dark' | 'auto';
  position: BubblePosition;
  title: string;
  initialMessage: string;
}
