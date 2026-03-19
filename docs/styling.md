# Styling

CSS variables, theming, and Tailwind conventions.

## CSS Variables (Theming)

```css
:root {
  --background: #ffffff;
  --foreground: #1a1a1a;
  --border: #2a2a2a;
  --accent-primary: #3a3a3a;
  --accent-selected: #2563eb;
}
.dark {
  --background: #0f0f0f;
  --foreground: #e5e5e5;
}
```

## Marketing-Only Accent Colors

The following CSS variables are reserved for marketing pages only:
- `--accent-teal` / `--accent-teal-hover`
- `--accent-warm`
- `--accent-coral`

**Rule**: These colors must ONLY be used in:
- `app/src/app/(marketing)/` routes
- `app/src/components/landing/` components

For app pages (authenticated, auth), use the standard accent colors:
- `--accent-primary` / `--accent-primary-hover` - primary actions
- `--accent-selected` / `--accent-selected-hover` - selected states
- `--accent-success` / `--accent-warning` / `--accent-danger` / `--accent-info` - semantic states

## Tailwind with CSS Variables

```tsx
<div className="bg-[color:var(--background)] text-[color:var(--foreground)]">
```

## Class Name Utility

```typescript
export function cn(...inputs: ClassValue[]): string {
  return inputs.flat().filter((x) => typeof x === 'string' && x.length > 0).join(' ').trim()
}
```
