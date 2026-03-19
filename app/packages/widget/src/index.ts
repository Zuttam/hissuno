/**
 * @hissuno/widget
 *
 * Embeddable support agent widget for the Hissuno platform.
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
 *         projectId="proj_xxx"
 *         trigger="bubble"
 *         display="sidepanel"
 *       />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Custom trigger
 * ```tsx
 * <HissunoWidget
 *   projectId="proj_xxx"
 *   trigger="headless"
 *   renderTrigger={({ open, isOpen }) => (
 *     <button onClick={open}>Need help?</button>
 *   )}
 * />
 * ```
 *
 * @example Drawer badge trigger
 * ```tsx
 * <HissunoWidget
 *   projectId="proj_xxx"
 *   trigger="drawer-badge"
 *   drawerBadgeLabel="Help"
 *   display="dialog"
 * />
 * ```
 */

// Main widget component
export { HissunoWidget } from './HissunoWidget';
// Alias for backwards compatibility
export { HissunoWidget as SupportWidget } from './HissunoWidget';

// Trigger components for advanced usage
export { ChatBubble, DrawerBadge } from './triggers';

// Display components for advanced usage
export { ChatPopup, ChatSidepanel, ChatDialog } from './displays';

// Shared components for advanced usage
export { ChatMessages, ConversationHistory, HistoryIcon } from './shared';

// Hooks for custom implementations
export { useHissunoChat, useKeyboardShortcut, formatShortcut, useResolvedTheme, useFocusTrap } from './hooks';
export type { SessionEntry, UseHissunoChatOptions, UseHissunoChatReturn } from './hooks';

// Re-export Message type from ai-sdk for loadSession usage
export type { Message } from '@ai-sdk/react';

// Types
export type {
  HissunoWidgetProps,
  HissunoConfig,
  BubblePosition,
  BubbleOffset,
  TriggerRenderProps,
  ChatMessage,
  WidgetTrigger,
  WidgetDisplay,
  WidgetSettings,
} from './types';
