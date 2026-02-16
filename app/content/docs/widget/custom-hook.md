---
title: "useHissunoChat Hook"
description: "Access full chat state, streaming responses, session management, and conversation history with the useHissunoChat React hook."
---

## Overview

The `useHissunoChat` hook provides the complete chat engine that powers the Hissuno widget. Use it to build a custom chat interface or integrate conversations into an existing UI component.

```tsx
import { useHissunoChat } from '@hissuno/widget';
```

It handles message state, SSE streaming, session persistence in `localStorage`, conversation history, inactivity timeouts, and human agent takeover.

## Basic Usage

```tsx
import { useHissunoChat } from '@hissuno/widget';

function SupportPanel() {
  const { messages, input, setInput, handleSubmit, isLoading, isStreaming, streamingContent, error } =
    useHissunoChat({ projectId: 'your-project-id' });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role}>{msg.content}</div>
      ))}
      {isStreaming && <div className="streaming">{streamingContent}</div>}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading} />
        <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      </form>
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

## Hook Options

| Option              | Type                       | Default                              | Description                                      |
|---------------------|----------------------------|--------------------------------------|--------------------------------------------------|
| `projectId`         | `string`                   | **required**                         | Your Hissuno project ID                          |
| `widgetToken`       | `string`                   | --                                   | JWT for authenticated sessions                   |
| `userId`            | `string`                   | --                                   | End-user identifier (enables session history)    |
| `userMetadata`      | `Record<string, string>`   | --                                   | User info visible in the dashboard               |
| `apiUrl`            | `string`                   | `'/api/integrations/widget/chat'`    | Chat API endpoint                                |
| `initialMessage`    | `string`                   | --                                   | First assistant message on new sessions          |
| `headers`           | `Record<string, string>`   | `{}`                                 | Custom headers included in API requests          |
| `sessionId`         | `string`                   | auto-generated                       | Custom session ID                                |
| `inactivityTimeout` | `number`                   | `1800000` (30 min)                   | Ms before auto-closing the session               |
| `onSessionClose`    | `() => void`               | --                                   | Callback when session closes                     |

## Return Values

### Message State

| Property           | Type                      | Description                                    |
|--------------------|---------------------------|------------------------------------------------|
| `messages`         | `ChatMessage[]`           | All messages in the current conversation       |
| `input`            | `string`                  | Current input field text                       |
| `setInput`         | `(value: string) => void` | Update the input value                         |
| `handleSubmit`     | `(e?: FormEvent) => void` | Submit the current message                     |
| `isLoading`        | `boolean`                 | Waiting for a response                         |
| `isStreaming`      | `boolean`                 | Response is actively streaming                 |
| `streamingContent` | `string`                  | Partial response text received so far          |
| `error`            | `Error \| undefined`      | Most recent error                              |

### Session Management

| Property            | Type                                                | Description                                     |
|---------------------|-----------------------------------------------------|-------------------------------------------------|
| `currentSessionId`  | `string \| null`                                    | Active session identifier                       |
| `clearHistory`      | `() => void`                                        | End current session and start a new one         |
| `closeSession`      | `() => Promise<void>`                               | Close session and trigger backend review        |
| `cancelChat`        | `() => Promise<void>`                               | Cancel an in-progress streaming response        |
| `loadSession`       | `(sessionId: string, messages?: Message[]) => void` | Load a previous session                         |
| `getSessionHistory` | `() => SessionEntry[]`                              | List past sessions (requires `userId`)          |
| `deleteSession`     | `(sessionId: string) => void`                       | Remove a session from local history             |

## ChatMessage Type

```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
  senderType?: 'ai' | 'human_agent' | 'system';
}
```

The `senderType` field distinguishes AI responses, human agent messages, and system notifications.

## Streaming Responses

While `isStreaming` is `true`, `streamingContent` updates progressively. Once complete, the full message is appended to `messages` and `streamingContent` resets.

```tsx
{messages.map((msg) => <div key={msg.id}>{msg.content}</div>)}
{isStreaming && streamingContent && <div className="partial">{streamingContent}</div>}
{isLoading && !streamingContent && <div>Thinking...</div>}
```

## Programmatic Message Sending

Pre-fill and submit messages from external UI elements:

```tsx
const chat = useHissunoChat({ projectId: 'your-project-id' });

const askQuestion = (question: string) => {
  chat.setInput(question);
  setTimeout(() => chat.handleSubmit(), 0);
};
```

## Conversation History

When `userId` is provided, sessions persist to `localStorage` (up to 50 per user). Use `getSessionHistory()` to list them, `loadSession()` to restore one, and `deleteSession()` to remove one.

```tsx
const chat = useHissunoChat({ projectId: 'your-project-id', userId: 'user-123' });
const sessions = chat.getSessionHistory();
// sessions: SessionEntry[] with { sessionId, userId, title, lastMessageAt, messageCount }
```

## Session Lifecycle

Sessions close automatically via inactivity timeout (default: 30 minutes), page unload (`navigator.sendBeacon`), or an explicit `closeSession()` call. When closed, the backend triggers a review workflow.

## TypeScript Exports

```tsx
import type {
  ChatMessage,
  UseHissunoChatOptions,
  UseHissunoChatReturn,
  SessionEntry,
} from '@hissuno/widget';
```
