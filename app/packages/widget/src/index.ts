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
 */

export { HissunoWidget, SupportWidget } from './HissunoWidget';
export type { HissunoWidgetProps, HissunoConfig } from './types';
