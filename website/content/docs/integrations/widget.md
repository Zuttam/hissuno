---
title: "Widget"
description: "Install the Hissuno support widget via npm and integrate it with React, Next.js, Vue, or vanilla JavaScript."
---

## Prerequisites

The `@hissuno/widget` package requires **React 18+** and **React DOM 18+** as peer dependencies. It targets ES2020 and requires browser support for `EventSource` (Server-Sent Events).

| Widget Version | React   | Node.js | TypeScript |
|----------------|---------|---------|------------|
| 0.1.x          | >= 18.0 | >= 18.0 | >= 5.0     |

## Install via npm

```bash
npm install @hissuno/widget
```

```bash
yarn add @hissuno/widget
```

```bash
pnpm add @hissuno/widget
```

The package ships with CommonJS, ESM, and TypeScript declarations.

## React Integration

Import the widget component and its stylesheet, then render it alongside your application:

```tsx
import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

function App() {
  return (
    <div>
      <YourApp />
      <HissunoWidget
        projectId="your-project-id"
        trigger="bubble"
        display="sidepanel"
      />
    </div>
  );
}
```

The `styles.css` import is required for animations and base layout.

### Next.js App Router

The package includes the `'use client'` directive so you can render it directly in a server component layout:

```tsx
// app/layout.tsx
import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <HissunoWidget projectId="your-project-id" />
      </body>
    </html>
  );
}
```

### Next.js Pages Router

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <HissunoWidget projectId="your-project-id" />
    </>
  );
}
```

## Vue Integration

Since `@hissuno/widget` is a React component, mount it into a dedicated DOM node using React DOM:

```vue
<template>
  <div>
    <YourVueApp />
    <div ref="widgetRoot" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

const widgetRoot = ref(null);
let root = null;

onMounted(() => {
  root = createRoot(widgetRoot.value);
  root.render(createElement(HissunoWidget, { projectId: 'your-project-id' }));
});

onBeforeUnmount(() => {
  root?.unmount();
});
</script>
```

## Vanilla JavaScript

For non-React applications, mount the widget with React DOM directly. You will need a bundler (Vite, webpack, esbuild) to resolve the npm imports:

```html
<div id="hissuno-widget"></div>
<script type="module">
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { HissunoWidget } from '@hissuno/widget';

  const root = createRoot(document.getElementById('hissuno-widget'));
  root.render(React.createElement(HissunoWidget, { projectId: 'your-project-id' }));
</script>
```

## Verifying the Installation

After installing, confirm the widget renders by checking for a floating bubble in the bottom-right corner of your page. Open the browser console and look for `[HissunoWidget]` prefixed messages. If the widget does not appear, verify:

1. The `projectId` prop matches a valid project in your Hissuno dashboard.
2. The `@hissuno/widget/styles.css` stylesheet is imported.
3. Your domain is listed in the project's allowed origins (or the list is empty for development).
