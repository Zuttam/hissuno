'use client';

import React from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import type { HissunoWidgetProps } from './types';

const DEFAULT_API_URL = 'https://api.hissuno.com/copilotkit';
const COPILOTKIT_PUBLIC_KEY = 'ck_pub_b890d279409a8d1feb8207c8b3a12837';

/**
 * HissunoWidget - Embeddable support agent widget
 * 
 * Add this component to your app to enable AI-powered support.
 * 
 * @example
 * ```tsx
 * import { HissunoWidget } from '@hissuno/widget';
 * 
 * function App() {
 *   return (
 *     <div>
 *       <YourApp />
 *       <HissunoWidget 
 *         projectId="proj_xxx" 
 *         publicKey="pk_live_xxx"
 *         userId={currentUser.id}
 *         userMetadata={{ name: currentUser.name, email: currentUser.email }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function HissunoWidget({
  projectId,
  publicKey,
  userId,
  userMetadata,
  apiUrl = DEFAULT_API_URL,
  theme = 'light',
  position = 'bottom-right',
  title = 'Support',
  placeholder = 'Ask a question or report an issue...',
  initialMessage = "Hi! 👋 How can I help you today?",
  defaultOpen = false,
  onOpen,
  onClose,
  className,
  headers = {},
}: HissunoWidgetProps) {
  // Validate required props
  if (!projectId) {
    console.error('[HissunoWidget] projectId is required');
    return null;
  }

  if (!publicKey) {
    console.error('[HissunoWidget] publicKey is required');
    return null;
  }

  if (!publicKey.startsWith('pk_')) {
    console.warn('[HissunoWidget] publicKey should start with "pk_". Make sure you\'re using the public key, not the secret key.');
  }

  // Capture page context
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const pageTitle = typeof window !== 'undefined' ? document.title : '';

  // Merge custom headers with required auth headers and session context
  const requestHeaders = {
    ...headers,
    'X-Public-Key': publicKey,
    'X-Project-ID': projectId,
    ...(userId && { 'X-User-ID': userId }),
    ...(userMetadata && { 'X-User-Metadata': JSON.stringify(userMetadata) }),
    ...(pageUrl && { 'X-Page-URL': pageUrl }),
    ...(pageTitle && { 'X-Page-Title': pageTitle }),
  };

  return (
    <CopilotKit
      runtimeUrl={apiUrl}
      headers={requestHeaders}
      agent="supportAgent"
      publicApiKey={COPILOTKIT_PUBLIC_KEY}
    >
      <CopilotPopup
        labels={{
          title,
          initial: initialMessage,
          placeholder,
        }}
        defaultOpen={defaultOpen}
        onSetOpen={(open) => {
          if (open) {
            onOpen?.();
          } else {
            onClose?.();
          }
        }}
        className={className}
      />
    </CopilotKit>
  );
}

/**
 * Alias for HissunoWidget for backward compatibility
 */
export const SupportWidget = HissunoWidget;
