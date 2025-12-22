# @hissuno/widget

Embeddable support agent widget for the Hissuno platform. Add AI-powered support to your application in minutes.

## Installation

```bash
npm install @hissuno/widget
# or
yarn add @hissuno/widget
# or
pnpm add @hissuno/widget
```

## Quick Start

```tsx
import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

function App() {
  return (
    <div>
      <YourApp />
      <HissunoWidget 
        projectId="proj_xxx" 
        publicKey="pk_live_xxx"
      />
    </div>
  );
}
```

## Getting Your Keys

1. Go to your [Hissuno Dashboard](https://hissuno.com/dashboard)
2. Select your project
3. Copy the **Project ID** and **Public Key** from the Integration section

> **Note**: Only use the public key (`pk_live_...`) in your frontend code. Never expose the secret key.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project ID from the Hissuno dashboard |
| `publicKey` | `string` | **required** | Your public key (`pk_live_...`) |
| `apiUrl` | `string` | `"https://api.hissuno.com/copilotkit"` | Custom API endpoint (for self-hosted) |
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

If you're self-hosting Hissuno, point the widget to your API:

```tsx
<HissunoWidget 
  projectId="proj_xxx" 
  publicKey="pk_live_xxx"
  apiUrl="https://your-hissuno-instance.com/api/copilotkit"
/>
```

## Allowed Origins

For security, configure your allowed origins in the Hissuno dashboard. The widget will only work on domains you've explicitly allowed.

## TypeScript

This package includes TypeScript definitions. Import types as needed:

```tsx
import type { HissunoWidgetProps } from '@hissuno/widget';
```

## License

MIT
