# @customize/widget

Embeddable support agent widget for the Customize platform. Add AI-powered support to your application in minutes.

## Installation

```bash
npm install @customize/widget
# or
yarn add @customize/widget
# or
pnpm add @customize/widget
```

## Quick Start

```tsx
import { CustomizeWidget } from '@customize/widget';
import '@customize/widget/styles.css';

function App() {
  return (
    <div>
      <YourApp />
      <CustomizeWidget 
        projectId="proj_xxx" 
        publicKey="pk_live_xxx"
      />
    </div>
  );
}
```

## Getting Your Keys

1. Go to your [Customize Dashboard](https://customize.dev/dashboard)
2. Select your project
3. Copy the **Project ID** and **Public Key** from the Integration section

> **Note**: Only use the public key (`pk_live_...`) in your frontend code. Never expose the secret key.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project ID from the Customize dashboard |
| `publicKey` | `string` | **required** | Your public key (`pk_live_...`) |
| `apiUrl` | `string` | `"https://api.customize.dev/copilotkit"` | Custom API endpoint (for self-hosted) |
| `theme` | `"light" \| "dark" \| "auto"` | `"light"` | Color theme |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Widget position |
| `title` | `string` | `"Support"` | Chat window title |
| `placeholder` | `string` | `"Ask a question..."` | Input placeholder |
| `initialMessage` | `string` | `"Hi! 👋 How can I help?"` | Welcome message |
| `defaultOpen` | `boolean` | `false` | Open chat on load |
| `onOpen` | `() => void` | - | Callback when chat opens |
| `onClose` | `() => void` | - | Callback when chat closes |
| `className` | `string` | - | Custom CSS class |
| `headers` | `Record<string, string>` | - | Additional headers |

## Self-Hosting

If you're self-hosting Customize, point the widget to your API:

```tsx
<CustomizeWidget 
  projectId="proj_xxx" 
  publicKey="pk_live_xxx"
  apiUrl="https://your-customize-instance.com/api/copilotkit"
/>
```

## Allowed Origins

For security, configure your allowed origins in the Customize dashboard. The widget will only work on domains you've explicitly allowed.

## TypeScript

This package includes TypeScript definitions. Import types as needed:

```tsx
import type { CustomizeWidgetProps } from '@customize/widget';
```

## License

MIT

