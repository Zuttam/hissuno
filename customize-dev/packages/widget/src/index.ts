/**
 * @customize/widget
 * 
 * Embeddable support agent widget for the Customize platform.
 * 
 * @example
 * ```tsx
 * import { CustomizeWidget } from '@customize/widget';
 * import '@customize/widget/styles.css';
 * 
 * function App() {
 *   return (
 *     <div>
 *       <YourApp />
 *       <CustomizeWidget 
 *         projectId="proj_xxx" 
 *         publicKey="pk_live_xxx"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

export { CustomizeWidget, SupportWidget } from './CustomizeWidget';
export type { CustomizeWidgetProps, CustomizeConfig } from './types';

