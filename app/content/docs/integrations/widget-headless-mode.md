---
title: "Widget Headless Mode"
description: "Use the Hissuno widget API without the default UI to build fully custom chat interfaces and trigger elements."
---

## What Is Headless Mode

Headless mode lets you use the Hissuno chat backend without rendering any built-in UI. There are two approaches:

1. **Headless trigger with built-in display** -- Replace only the activation button while keeping the default chat panel.
2. **Fully headless** -- Use the `useHissunoChat` hook directly to build an entirely custom interface.

## Headless Trigger with Built-in Display

Set `trigger="headless"` and provide a `renderTrigger` function. The chat panel (sidepanel, popup, or dialog) still renders, but the trigger element is yours.

```tsx
import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

function App() {
  return (
    <HissunoWidget
      projectId="your-project-id"
      trigger="headless"
      display="sidepanel"
      renderTrigger={({ open, close, toggle, isOpen }) => (
        <button onClick={toggle}>
          {isOpen ? 'Close support' : 'Get help'}
        </button>
      )}
    />
  );
}
```

### TriggerRenderProps

| Property | Type         | Description                      |
|----------|--------------|----------------------------------|
| `open`   | `() => void` | Open the chat panel              |
| `close`  | `() => void` | Close the chat panel             |
| `toggle` | `() => void` | Toggle the panel open/close      |
| `isOpen` | `boolean`    | Whether the panel is open        |

## Fully Custom Chat Interface

For complete control, use `useHissunoChat` directly without the `HissunoWidget` component:

```tsx
import { useHissunoChat } from '@hissuno/widget';

function CustomChat() {
  const {
    messages, input, setInput, handleSubmit,
    isLoading, isStreaming, streamingContent,
    error, clearHistory, cancelChat,
  } = useHissunoChat({
    projectId: 'your-project-id',
    userId: 'user-123',
    initialMessage: 'How can I help you today?',
  });

  return (
    <div className="custom-chat">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.senderType === 'human_agent' && <span className="badge">Agent</span>}
            <p>{msg.content}</p>
          </div>
        ))}
        {isStreaming && streamingContent && (
          <div className="message assistant streaming"><p>{streamingContent}</p></div>
        )}
        {isLoading && !streamingContent && <div className="typing">Thinking...</div>}
      </div>
      {error && <div className="error">{error.message}</div>}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading} />
        <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      </form>
      <button onClick={clearHistory}>New conversation</button>
      {isLoading && <button onClick={cancelChat}>Cancel</button>}
    </div>
  );
}
```

## Using Built-in Sub-Components

The widget exports internal components you can use in custom layouts: `ChatMessages`, `ConversationHistory`, `ChatBubble`, `DrawerBadge`, `ChatPopup`, `ChatSidepanel`, and `ChatDialog`.

```tsx
import { ChatMessages, useHissunoChat } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

function HybridChat() {
  const chat = useHissunoChat({ projectId: 'your-project-id' });
  return (
    <div style={{ height: 500, display: 'flex', flexDirection: 'column' }}>
      <ChatMessages
        messages={chat.messages}
        isLoading={chat.isLoading}
        isStreaming={chat.isStreaming}
        streamingContent={chat.streamingContent}
        theme="dark"
      />
      <form onSubmit={chat.handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input value={chat.input} onChange={(e) => chat.setInput(e.target.value)} />
        <button type="submit" disabled={chat.isLoading}>Send</button>
      </form>
    </div>
  );
}
```

## Event Handling

### Programmatic Input Control

Use `onControlsReady` to pre-fill the input from contextual help links:

```tsx
const controlsRef = useRef<{ setInput: (v: string) => void }>();

<button onClick={() => controlsRef.current?.setInput('How do I configure SSO?')}>Help with SSO</button>
<HissunoWidget projectId="..." onControlsReady={(c) => { controlsRef.current = c; }} />
```

### Human Agent Takeover

When a human agent takes over, messages include `senderType: 'human_agent'` or `'system'`. Use these to style agent messages differently in custom UIs.

## Keyboard Shortcut in Headless Mode

The shortcut still works in headless mode. Disable with `shortcut={false}`. When using `useHissunoChat` directly, add shortcut support with the exported `useKeyboardShortcut` hook:

```tsx
import { useHissunoChat, useKeyboardShortcut } from '@hissuno/widget';

const [isOpen, setIsOpen] = useState(false);
const chat = useHissunoChat({ projectId: 'your-project-id' });
useKeyboardShortcut({ shortcut: 'mod+k', onTrigger: () => setIsOpen((prev) => !prev) });
```
