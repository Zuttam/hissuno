# Plan: Draggable DrawerBadge Vertical Positioning

## Context

The widget's DrawerBadge trigger is fixed at the vertical center of the right viewport edge (`top: 50%`). Users embedding the widget have no way to reposition it, which means it can overlap with their own UI elements (navbars, FABs, cookie banners, etc.). This change lets end-users drag the badge up/down to a position that works for them, with the position persisted in localStorage.

## Files to Change

| File | Action |
|------|--------|
| `app/packages/widget/src/hooks/useDraggable.ts` | **Create** - Core drag interaction hook |
| `app/packages/widget/src/hooks/index.ts` | **Edit** - Export new hook |
| `app/packages/widget/src/types.ts` | **Edit** - Add `drawerBadgeInitialY` prop |
| `app/packages/widget/src/triggers/DrawerBadge.tsx` | **Edit** - Integrate drag hook, dynamic positioning, drag handle |
| `app/packages/widget/src/HissunoWidget.tsx` | **Edit** - Wire new prop through |

## Implementation

### Step 1: Create `useDraggable` hook

**New file:** `app/packages/widget/src/hooks/useDraggable.ts`

A self-contained hook using Pointer Events API (unified mouse/touch/pen):

- **State:** `yPercent` (0-100), `isDragging` (boolean)
- **Refs (non-rendering):** `startY`, `startPercent`, `hasDragged`, `pointerId`, `suppressClickRef`
- **Init:** Read from `localStorage.getItem('hissuno-drawer-badge-y')`, fall back to `defaultY` param (default 50). Use `typeof window === 'undefined'` guard + try/catch (matching pattern from `useHissunoChat.ts`)
- **onPointerDown:** Record start position, call `setPointerCapture`, add `pointermove`/`pointerup` listeners to the element (pointer capture routes events to captured element)
- **pointermove:** If `|deltaY| >= 5px` threshold, set `hasDragged=true`, `isDragging=true`, compute new percent, clamp to `[edgePadding, viewportHeight - edgePadding]` (20px default), update state
- **pointerup:** Release capture, remove listeners. If dragged: persist to localStorage, set `isDragging=false`, set `suppressClickRef=true`. If not dragged: no-op (click fires normally)
- **shouldSuppressClick():** One-shot gate that reads and resets `suppressClickRef` - prevents click from firing after a drag
- **Cleanup:** `useEffect` return removes any lingering listeners on unmount
- **Resize handler:** Re-clamp position on window resize

Returns: `{ yPercent, isDragging, dragHandlers: { onPointerDown }, shouldSuppressClick, ref }`

### Step 2: Export from hooks barrel

Add to `app/packages/widget/src/hooks/index.ts`:
```
export { useDraggable } from './useDraggable';
```

### Step 3: Add type to `HissunoWidgetProps`

In `app/packages/widget/src/types.ts`, add:
```typescript
drawerBadgeInitialY?: number;  // 0-100, default vertical position
```

### Step 4: Update DrawerBadge component

Key changes to `app/packages/widget/src/triggers/DrawerBadge.tsx`:

1. **Add `initialY` prop**, use `useDraggable` hook
2. **Replace fixed positioning** - `top: '50%'` becomes `top: `${yPercent}%``
3. **Disable transitions during drag** - `transition: isDragging ? 'none' : '...'`
4. **Add `touchAction: 'none'` and `userSelect: 'none'`** for mobile support
5. **Wrap onClick** to call `shouldSuppressClick()` first
6. **Suppress hover effects during drag** - early return in `onMouseEnter`/`onMouseLeave` if `isDragging`
7. **Reset styles on drag end** via `useEffect` watching `isDragging`
8. **Add drag handle affordance** - two subtle horizontal lines (12px wide, `currentColor`, `opacity: 0.4`) at top of badge, `aria-hidden="true"`

### Step 5: Wire prop in HissunoWidget

In `app/packages/widget/src/HissunoWidget.tsx`:
- Destructure `drawerBadgeInitialY` from props
- Pass as `initialY={drawerBadgeInitialY}` to `<DrawerBadge />`

## Key Design Decisions

- **Pointer Events over mouse+touch:** Unified API, cleaner code, supported by all modern browsers
- **5px drag threshold:** Prevents accidental drags from clicks, works for both mouse and touch
- **localStorage persistence:** Keyed as `hissuno-drawer-badge-y`, survives page reloads. Prop `drawerBadgeInitialY` only used when no stored value exists
- **Percentage-based positioning:** Adapts to different viewport sizes naturally
- **Edge padding in pixels (20px):** Prevents badge from going off-screen regardless of viewport height

## Verification

1. Build the widget: `cd app && npm run build` (or `cd app/packages/widget && npm run build` if available)
2. Run dev server: `cd app && npm run dev`
3. Manual testing on a page using `trigger="drawer-badge"`:
   - Drag badge up/down - should follow pointer smoothly
   - Release - should stay in position
   - Refresh page - should restore position from localStorage
   - Click without dragging - should open/close chat normally
   - Hover without dragging - should show the slide-out hover effect
   - Test on mobile viewport (responsive mode) - touch drag should work
   - Resize viewport - badge should stay within bounds
4. Run tests: `cd app && npm run test`
