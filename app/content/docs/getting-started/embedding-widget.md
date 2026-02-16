---
title: "Embedding the Widget"
description: "Add the Hissuno support widget to your React application with the npm package."
---

## Overview

The Hissuno widget is an embeddable support chat that you can add to any React application. It connects your customers directly to the AI support agent, which uses your project's knowledge sources to answer questions accurately. Every conversation through the widget is automatically captured as a feedback session.

## Prerequisites

Before embedding the widget, make sure you have:

- A Hissuno account with an active project.
- Your **Project ID**, found on the **Integrations** page by clicking the Widget card and then **Configure**.
- At least one knowledge source configured so the AI agent can provide useful responses.

## Installation

Install the widget package from npm:

```bash
npm install @hissuno/widget
```

Import the required stylesheet and the React component in your application:

```typescript
import '@hissuno/widget/styles.css'
import { HissunoWidget } from '@hissuno/widget'
```

Then render the component in your layout or app shell:

```tsx
<HissunoWidget projectId="YOUR_PROJECT_ID" />
```

This renders a floating chat bubble in the bottom-right corner of your page and handles all communication with the Hissuno API.

## Configuration Options

Pass configuration as props to the `<HissunoWidget>` component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | -- | Required. Your Hissuno project ID. |
| `trigger` | `string` | `"bubble"` | How the widget is activated. Options: `"bubble"`, `"drawer-badge"`, `"headless"`. |
| `display` | `string` | `"popup"` | How the chat panel is rendered. Options: `"popup"`, `"sidepanel"`, `"dialog"`. |
| `bubblePosition` | `string` | `"bottom-right"` | Bubble placement. Options: `"bottom-right"`, `"bottom-left"`, `"top-right"`, `"top-left"`. |
| `theme` | `string` | `"auto"` | Color scheme. Options: `"light"`, `"dark"`, `"auto"`. |
| `initialMessage` | `string` | `"Hi! How can I help?"` | The first message displayed when a customer opens the widget. |
| `userId` | `string` | -- | Unique identifier for the customer, used to link conversations to a customer profile. |
| `userMetadata` | `Record<string, string>` | -- | Additional metadata about the customer (e.g., email, name, plan). |
| `keyboardShortcut` | `string` | `"mod+k"` | Keyboard shortcut to open the widget. |
| `onControlsReady` | `function` | -- | Callback that receives control methods when the widget mounts. |

### Example with All Options

```tsx
import '@hissuno/widget/styles.css'
import { HissunoWidget } from '@hissuno/widget'

function App() {
  return (
    <HissunoWidget
      projectId="YOUR_PROJECT_ID"
      trigger="bubble"
      display="popup"
      bubblePosition="bottom-right"
      theme="auto"
      initialMessage="Welcome! Ask us anything about the product."
      userId={user.id}
      userMetadata={{
        email: user.email,
        name: user.name,
        plan: user.plan,
      }}
      keyboardShortcut="mod+k"
    />
  )
}
```

## Identifying Customers

When you pass `userId` and `userMetadata`, Hissuno automatically links the conversation to a customer profile in your project. This enables you to:

- View all feedback sessions from a specific customer in one place.
- Track which customers are reporting the same issues.
- Enrich customer profiles with metadata from your application.

If no customer information is provided, the widget creates an anonymous session. You can still view these sessions in the feedback list, but they will not be linked to a named profile.

## Controlling the Widget Programmatically

There are two ways to control the widget from your code.

### onControlsReady Callback

The `onControlsReady` prop receives an object with control methods when the widget mounts:

```tsx
import { HissunoWidget } from '@hissuno/widget'

function App() {
  return (
    <HissunoWidget
      projectId="YOUR_PROJECT_ID"
      onControlsReady={(controls) => {
        // Store controls for later use
        window.hissunoControls = controls

        // Available methods:
        // controls.open()   - Open the chat panel
        // controls.close()  - Close the chat panel
        // controls.toggle() - Toggle the chat panel
      }}
    />
  )
}
```

### useHissunoChat Hook

For deeper integration within React components, use the `useHissunoChat` hook:

```tsx
import { useHissunoChat } from '@hissuno/widget'

function HelpButton() {
  const { open, close, isOpen } = useHissunoChat()

  return (
    <button onClick={() => (isOpen ? close() : open())}>
      {isOpen ? 'Close Help' : 'Get Help'}
    </button>
  )
}
```

This is useful for triggering the widget from a custom button in your navigation or help menu instead of relying on the default floating bubble.

## Verifying the Integration

After embedding the widget:

1. Load your application in a browser and confirm the widget bubble appears.
2. Click the bubble to open the chat panel.
3. Send a test message and verify the AI agent responds.
4. Check **Feedback** in the Hissuno dashboard sidebar to confirm the conversation was recorded as a new feedback session.

If the widget does not appear, open your browser's developer console and check for errors. Common issues include an incorrect project ID or a missing `styles.css` import.

## Next Steps

With the widget embedded, your customers can start conversations that flow directly into your feedback pipeline. Explore the [Knowledge Sources](/docs/knowledge/overview) documentation to improve the AI agent's responses, or visit [Issues](/docs/issues/overview) to learn how feedback is converted into actionable work.
