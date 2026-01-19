# @hissuno/widget

Embeddable AI-powered support chat widget for the Hissuno platform.

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
        projectId="your-project-id"
        userId={currentUser?.id}
        userMetadata={{ name: currentUser?.name, email: currentUser?.email }}
      />
    </div>
  );
}
```

## Props

### Required

| Prop | Type | Description |
|------|------|-------------|
| `projectId` | `string` | Your Hissuno project ID from the dashboard |

### Optional

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `widgetToken` | `string` | - | JWT token for secure authentication (required if token auth is enabled) |
| `trigger` | `'bubble' \| 'drawer-badge' \| 'headless'` | `'bubble'` | Widget activation trigger type |
| `display` | `'popup' \| 'sidepanel' \| 'dialog'` | `'sidepanel'` | Chat UI display mode |
| `shortcut` | `string \| false` | `'mod+k'` | Keyboard shortcut (`mod` = Cmd on Mac, Ctrl on Windows) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | Color theme (`auto` follows system preference) |
| `userId` | `string` | - | End-user identifier for session tracking |
| `userMetadata` | `Record<string, string>` | - | Additional user info (name, email, plan, etc.) |
| `apiUrl` | `string` | `'/api/agent'` | Custom API endpoint URL |
| `title` | `string` | `'Support'` | Chat window title |
| `placeholder` | `string` | `'Ask a question...'` | Input field placeholder |
| `initialMessage` | `string` | `'Hi! How can I help?'` | First message shown to users |
| `defaultOpen` | `boolean` | `false` | Start with widget open |
| `fetchDefaults` | `boolean` | `true` | Fetch settings from server |

### Position & Sizing

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bubblePosition` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Bubble position |
| `bubbleOffset` | `{ x?: number, y?: number }` | `{ x: 20, y: 20 }` | Offset from edge (px) |
| `drawerBadgeLabel` | `string` | `'Support'` | Drawer badge label |
| `dialogWidth` | `number` | `600` | Dialog width (px) |
| `dialogHeight` | `number` | `500` | Dialog height (px) |

### Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onOpen` | `() => void` | Called when widget opens |
| `onClose` | `() => void` | Called when widget closes |
| `renderTrigger` | `(props: TriggerRenderProps) => ReactNode` | Custom trigger component |

## Trigger Types

### Bubble (default)
```tsx
<HissunoWidget projectId="..." trigger="bubble" bubblePosition="bottom-right" />
```

### Drawer Badge
```tsx
<HissunoWidget projectId="..." trigger="drawer-badge" drawerBadgeLabel="Help" />
```

### Headless (custom trigger)
```tsx
<HissunoWidget
  projectId="..."
  trigger="headless"
  renderTrigger={({ open, isOpen }) => (
    <button onClick={open}>{isOpen ? 'Close' : 'Need help?'}</button>
  )}
/>
```

## Display Types

- **sidepanel** (default): Full-height drawer from the right (400px)
- **popup**: Compact corner modal (380x520px)
- **dialog**: Centered modal with backdrop blur

```tsx
<HissunoWidget projectId="..." display="dialog" dialogWidth={700} />
```

## Custom Hook

For advanced integrations:

```tsx
import { useHissunoChat } from '@hissuno/widget';

function CustomChat() {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    clearHistory,
  } = useHissunoChat({
    projectId: 'your-project-id',
    userId: 'user-123',
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### Hook Return Values

| Value | Type | Description |
|-------|------|-------------|
| `messages` | `ChatMessage[]` | All chat messages |
| `input` | `string` | Current input value |
| `setInput` | `(value: string) => void` | Update input |
| `handleSubmit` | `(e?: FormEvent) => void` | Send message |
| `isLoading` | `boolean` | Waiting for response |
| `isStreaming` | `boolean` | Response streaming |
| `streamingContent` | `string` | Current streaming text |
| `error` | `Error \| undefined` | Last error |
| `clearHistory` | `() => void` | Start new conversation |
| `currentSessionId` | `string \| null` | Active session ID |
| `getSessionHistory` | `() => SessionEntry[]` | Past sessions (requires userId) |

## Conversation History

Enable with `userId` for automatic localStorage persistence:

```tsx
<HissunoWidget projectId="..." userId={user.id} />
```

## Keyboard Shortcuts

```tsx
// Custom shortcut
<HissunoWidget projectId="..." shortcut="ctrl+shift+h" />

// Disable
<HissunoWidget projectId="..." shortcut={false} />
```

## Security Features

- Input validation with 4KB message limit
- SSE event validation
- URL sanitization (strips sensitive query params)
- Server settings validation

## Accessibility

- Semantic HTML with ARIA roles
- `aria-live` regions for streaming content
- Focus trap in dialog mode
- Keyboard navigation support
- Screen reader announcements

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires `EventSource` (SSE) support
- ES2020 target

## TypeScript

```tsx
import type {
  HissunoWidgetProps,
  ChatMessage,
  WidgetTrigger,
  WidgetDisplay,
  UseHissunoChatReturn,
} from '@hissuno/widget';
```

## License

MIT
