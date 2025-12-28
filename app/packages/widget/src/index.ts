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
 *         publicKey="pk_live_xxx"
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
 *   publicKey="pk_live_xxx"
 *   showBubble={false}
 *   renderTrigger={({ open, isOpen }) => (
 *     <button onClick={open}>Need help?</button>
 *   )}
 * />
 * ```
 */

// Main widget component
export { HissunoWidget, SupportWidget } from './HissunoWidget';

// Sub-components for advanced usage
export { ChatBubble } from './ChatBubble';
export { ChatPopup } from './ChatPopup';
export { ChatSidepanel } from './ChatSidepanel';
export { ChatMessages } from './ChatMessages';

// Hook for custom implementations
export { useHissunoChat } from './useHissunoChat';

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
  WidgetVariant,
  WidgetSettings,
} from './types';
