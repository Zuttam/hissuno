import type { ReactNode } from 'react';

/**
 * Position options for the bubble trigger
 */
export type BubblePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Widget trigger types - what activates the widget
 */
export type WidgetTrigger = 'bubble' | 'drawer-badge' | 'headless';

/**
 * Widget display types - how the chat UI appears
 */
export type WidgetDisplay = 'popup' | 'sidepanel' | 'dialog';

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
   * The project ID from your Hissuno dashboard
   * This uniquely identifies your project
   */
  projectId: string;

  /**
   * JWT token for secure widget authentication (optional)
   * Generated on your backend using your project's secret key
   * Required if widget_token_required is enabled on the project
   */
  widgetToken?: string;

  /**
   * Widget trigger type - what activates the widget
   * - 'bubble': Floating 56x56 button at configurable corner position
   * - 'drawer-badge': Vertical tab fixed to right edge with rotated label
   * - 'headless': No visual element, keyboard-only activation
   * @default "bubble"
   */
  trigger?: WidgetTrigger;

  /**
   * Widget display type - how the chat UI appears
   * - 'popup': Corner modal (380x520px)
   * - 'sidepanel': Full-height right drawer (400px)
   * - 'dialog': Centered modal with blur backdrop
   * @default "sidepanel"
   */
  display?: WidgetDisplay;

  /**
   * Keyboard shortcut to open/toggle the widget
   * Supports 'mod+k' (cmd on Mac, ctrl on Windows/Linux), 'ctrl+shift+p', etc.
   * Set to false to disable keyboard activation
   * @default "mod+k"
   */
  shortcut?: string | false;

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
   * Optional: The URL of your Hissuno API endpoint
   */
  apiUrl?: string;

  /**
   * Theme for the chat widget
   * @default "light"
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Position of the floating bubble on the page
   * Only applies when trigger='bubble'
   * @default "bottom-right"
   */
  bubblePosition?: BubblePosition;

  /**
   * Offset from the edge of the screen in pixels
   * Only applies when trigger='bubble'
   * @default { x: 20, y: 20 }
   */
  bubbleOffset?: BubbleOffset;

  /**
   * Label text for the drawer badge trigger
   * Only applies when trigger='drawer-badge'
   * @default "Support"
   */
  drawerBadgeLabel?: string;

  /**
   * Width of the dialog display
   * Only applies when display='dialog'
   * @default 600
   */
  dialogWidth?: number;

  /**
   * Height of the dialog display
   * Only applies when display='dialog'
   * @default 500
   */
  dialogHeight?: number;

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
   * @default "Hi! How can I help you today?"
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
   * Callback that exposes chat controls for external manipulation
   * Useful for programmatically setting input values
   */
  onControlsReady?: (controls: { setInput: (value: string) => void }) => void;

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
  projectId: string;
  apiUrl: string;
  widgetToken?: string;
}

/**
 * Sender type for messages
 */
export type MessageSenderType = 'ai' | 'human_agent' | 'system';

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  senderType?: MessageSenderType; // 'ai' for AI, 'human_agent' for human takeover
}

/**
 * Widget settings fetched from server
 */
export interface WidgetSettings {
  trigger: WidgetTrigger;
  display: WidgetDisplay;
  shortcut: string | false;
  theme: 'light' | 'dark' | 'auto';
  position: BubblePosition;
  title: string;
  initialMessage: string;
  drawerBadgeLabel?: string;
  tokenRequired?: boolean;
  blocked?: boolean;
}
