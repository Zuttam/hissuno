---
title: "Configuration"
description: "Configure the Hissuno widget appearance, triggers, display modes, theme, and keyboard shortcuts."
---

## Basic Configuration

Every widget instance requires a `projectId`. All other props are optional. When `fetchDefaults` is enabled (the default), the widget fetches your project's saved settings from the Hissuno API. Props you pass explicitly always override fetched defaults.

```tsx
<HissunoWidget
  projectId="your-project-id"
  title="Help Center"
  placeholder="Describe your issue..."
  initialMessage="Welcome! Ask me anything about our product."
  theme="auto"
/>
```

## All Configuration Options

### Required

| Prop        | Type     | Description                           |
|-------------|----------|---------------------------------------|
| `projectId` | `string` | Your project ID from the Hissuno dashboard |

### Trigger, Display, and Content

| Prop              | Type                                          | Default       | Description                           |
|-------------------|-----------------------------------------------|---------------|---------------------------------------|
| `trigger`         | `'bubble' \| 'drawer-badge' \| 'headless'`   | `'bubble'`    | What activates the widget             |
| `display`         | `'popup' \| 'sidepanel' \| 'dialog'`          | `'sidepanel'` | How the chat UI appears               |
| `shortcut`        | `string \| false`                             | `'mod+k'`     | Keyboard shortcut to toggle           |
| `title`           | `string`                                      | `'Support'`   | Chat window header title              |
| `placeholder`     | `string`                                      | `'Ask a question or report an issue...'` | Input placeholder |
| `initialMessage`  | `string`                                      | `'Hi! How can I help you today?'` | First assistant message |
| `defaultOpen`     | `boolean`                                     | `false`       | Open the chat panel on mount          |
| `theme`           | `'light' \| 'dark' \| 'auto'`                | `'light'`     | Color theme                           |
| `className`       | `string`                                      | --            | Additional CSS class on the root      |

### Position and Sizing

| Prop                  | Type                                                       | Default             | Applies to              |
|-----------------------|------------------------------------------------------------|---------------------|--------------------------|
| `bubblePosition`      | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | `trigger='bubble'`      |
| `bubbleOffset`        | `{ x?: number, y?: number }`                              | `{ x: 20, y: 20 }` | `trigger='bubble'`      |
| `drawerBadgeLabel`    | `string`                                                   | `'Support'`         | `trigger='drawer-badge'` |
| `drawerBadgeInitialY` | `number`                                                   | `50`                | `trigger='drawer-badge'` |
| `dialogWidth`         | `number`                                                   | `600`               | `display='dialog'`      |
| `dialogHeight`        | `number`                                                   | `500`               | `display='dialog'`      |

### User, Auth, and Advanced

| Prop            | Type                       | Default                              | Description                              |
|-----------------|----------------------------|--------------------------------------|------------------------------------------|
| `userId`        | `string`                   | --                                   | End-user identifier for session tracking |
| `userMetadata`  | `Record<string, string>`   | --                                   | Additional user info (name, email, plan) |
| `widgetToken`   | `string`                   | --                                   | JWT for authenticated sessions           |
| `apiUrl`        | `string`                   | `'/api/integrations/widget/chat'`    | Custom API endpoint                      |
| `fetchDefaults` | `boolean`                  | `true`                               | Fetch settings from server on mount      |
| `headers`       | `Record<string, string>`   | `{}`                                 | Custom headers sent with every request   |

## Trigger Types

### Bubble (default)

A 56x56px floating circle button positioned at the specified corner:

```tsx
<HissunoWidget projectId="..." trigger="bubble" bubblePosition="bottom-left" bubbleOffset={{ x: 24, y: 24 }} />
```

### Drawer Badge

A vertical tab fixed to the right edge. Users can drag it vertically; position persists in `localStorage`:

```tsx
<HissunoWidget projectId="..." trigger="drawer-badge" drawerBadgeLabel="Need help?" />
```

### Headless

No built-in trigger. Provide your own via `renderTrigger` or use the `useHissunoChat` hook directly:

```tsx
<HissunoWidget
  projectId="..."
  trigger="headless"
  renderTrigger={({ toggle, isOpen }) => (
    <button onClick={toggle}>{isOpen ? 'Close' : 'Help'}</button>
  )}
/>
```

## Display Modes

- **sidepanel** -- Full-height drawer from the right (400px wide).
- **popup** -- Compact floating modal (380x520px) near the trigger.
- **dialog** -- Centered modal with a blurred backdrop overlay.

```tsx
<HissunoWidget projectId="..." display="dialog" dialogWidth={700} dialogHeight={550} />
```

## Theme

The widget supports `'light'`, `'dark'`, and `'auto'`. When set to `'auto'`, it follows the user's OS preference via `prefers-color-scheme` and updates in real time.

```tsx
<HissunoWidget projectId="..." theme="auto" />
```

## Keyboard Shortcuts

The `shortcut` prop accepts a key combination string. The modifier `mod` maps to **Cmd** on macOS and **Ctrl** on Windows/Linux. Supported modifiers: `mod`, `ctrl`, `cmd`, `meta`, `alt`, `option`, `shift`.

```tsx
<HissunoWidget projectId="..." shortcut="ctrl+shift+h" />
<HissunoWidget projectId="..." shortcut={false} /> {/* disable */}
```

## Callbacks

| Prop              | Type                                              | Description                              |
|-------------------|---------------------------------------------------|------------------------------------------|
| `onOpen`          | `() => void`                                      | Called when the chat panel opens          |
| `onClose`         | `() => void`                                      | Called when the chat panel closes         |
| `onControlsReady` | `(controls: { setInput: (v: string) => void }) => void` | Exposes controls for external use |
| `renderTrigger`   | `(props: TriggerRenderProps) => ReactNode`        | Custom trigger render function           |
