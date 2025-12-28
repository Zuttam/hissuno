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
export { ChatMessages } from './ChatMessages';

// Hook for custom implementations
export { useHissunoChat } from './useHissunoChat';

// Types
export type {
  HissunoWidgetProps,
  HissunoConfig,
  BubblePosition,
  BubbleOffset,
  TriggerRenderProps,
  ChatMessage,
} from './types';
