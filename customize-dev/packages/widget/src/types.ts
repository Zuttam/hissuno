/**
 * Props for the CustomizeWidget component
 */
export interface CustomizeWidgetProps {
  /**
   * The project ID from your Customize dashboard
   */
  projectId: string;

  /**
   * The public key (pk_live_...) from your Customize dashboard
   * This is safe to expose in frontend code
   */
  publicKey: string;

  /**
   * Optional identifier for the end-user using the widget
   * This helps track sessions per user in your Customize dashboard
   */
  userId?: string;

  /**
   * Optional metadata about the end-user (e.g., name, email, plan)
   * This information will be visible in session details
   */
  userMetadata?: Record<string, string>;

  /**
   * The URL of your Customize API endpoint
   * Defaults to the Customize cloud endpoint
   * @default "https://api.customize.dev/copilotkit"
   */
  apiUrl?: string;

  /**
   * Theme for the chat widget
   * @default "light"
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Position of the chat widget on the page
   * @default "bottom-right"
   */
  position?: 'bottom-right' | 'bottom-left';

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
 * Configuration for the Customize widget
 */
export interface CustomizeConfig {
  projectId: string;
  publicKey: string;
  apiUrl: string;
}

