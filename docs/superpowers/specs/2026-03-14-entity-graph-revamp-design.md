# Entity Graph Revamp: Card Nodes + Chord Lines

## Problem
The current ReactFlow-based entity graph looks like a graph editor, not a premium dashboard widget. Messy edge crossings, awkward node size scaling by count, cluttered edge labels, and unnecessary library overhead (ReactFlow + dagre).

## Solution
Drop ReactFlow entirely. Replace with a custom component using an SVG layer for bezier connections behind absolutely-positioned HTML card nodes.

## Design

### Node Cards
- Compact info card: white bg, 1.5px border, 8px border-radius
- Left: icon in tinted square (8px radius, 8% opacity category color bg)
- Right: uppercase monospace label (9px) + count number (20px bold)
- Uniform size across all nodes (no scaling by entity count)
- Hover: border transitions to category color, subtle colored box-shadow
- Click: navigates to entity list page (`/projects/{id}/customers`, `/sessions`, etc.)

### SVG Connection Layer
- Positioned behind nodes via absolute positioning + pointer-events:none
- Quadratic bezier curves between node center points
- Linear gradient per edge blending source/target category colors at 20-30% opacity
- Stroke width scales with relationship count (1.5px weak to 4px strong)
- No arrows, no edge count labels
- Round stroke-linecap

### Hover Preview Card
- 240px floating card, white bg, subtle shadow
- Above for bottom-row nodes (Sessions, Knowledge), below for top/middle
- Up to 5 recent entities: icon + truncated label + sublabel
- Footer: "View all {Category} ->" in category color
- 150ms debounced show/hide
- Preview card shares mouse handlers with node (prevents flicker)

### Hover Edge Highlighting
- Connected curves brighten to ~50% opacity
- Unconnected curves fade to ~5% opacity
- 200ms CSS transition

### Layout
- 6 nodes in hexagonal arrangement, ~700x400 viewport
- Top: Companies (left), Contacts (right)
- Middle: Product Areas (far left), Issues (far right)
- Bottom: Knowledge (left), Sessions (right)
- Responsive via SVG viewBox

### Dark Mode
- Card bg: var(--surface), border: var(--border-subtle)
- Text: var(--foreground) / var(--text-secondary)
- Gradient opacities unchanged (work on dark backgrounds)

### Removed
- @xyflow/react (ReactFlow) import and usage
- dagre dependency usage
- ReactFlowProvider, Handle, Position, nodeTypes, fitView config
- @xyflow/react/dist/style.css import

## Files Changed

| File | Action |
|---|---|
| `entity-graph.tsx` | Remove ReactFlowProvider, pass data directly |
| `entity-graph-overview.tsx` | Rewrite: custom SVG + positioned card nodes |
| `nodes.tsx` | Rewrite: card-style node with hover preview + edge highlight support |

## Data Contract
No backend changes needed. The existing API already returns:
- `overview.categories[]` with `{ category, count }`
- `overview.edges[]` with `{ source, target, count }`
- `overview.recentEntities` with `Record<category, EntityGraphEntityNode[]>`
