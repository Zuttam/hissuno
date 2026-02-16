---
status: pending
created: 2026-02-16
impact: high
summary: Public documentation portal at /docs with markdown content, sidebar nav, TOC, and full user-facing docs
---

# Docs Portal for Hissuno

## Context

Hissuno needs a public documentation portal so users can reference guides on widget integration, feature usage, agent configuration, and API endpoints. The portal lives at `/docs` inside the existing `(marketing)` route group, inheriting the marketing layout (nav, footer, theme). Content is stored as markdown files read at build time.

## Architecture Decisions

- **Content storage**: Plain `.md` files in `app/content/docs/[category]/[slug].md` with YAML frontmatter, read via `fs` in server components. Reuses existing `react-markdown` + `rehype-highlight` pipeline.
- **Navigation**: Hardcoded TypeScript config object (`docs-nav.ts`) for explicit control over ordering and labels.
- **Table of contents**: Extracted from markdown headings server-side via regex, rendered client-side with `IntersectionObserver` for active heading tracking.
- **Layout**: Three-column -- left sidebar nav, center content, right TOC (on xl+). Mobile: sidebar becomes slide-out overlay.

## New Dependencies

```
rehype-slug    # Auto-generates heading IDs for anchor links
remark-gfm    # GitHub Flavored Markdown (tables, task lists)
```

## File Plan

### 1. Content Files (`app/content/docs/`)

```
getting-started/
  account-setup.md
  first-project.md
  connecting-sources.md
  embedding-widget.md
widget/
  installation.md
  configuration.md
  authentication.md
  headless-mode.md
  custom-hook.md
knowledge/
  sources.md
  packages.md
  analysis.md
feedback/
  overview.md
  sources.md
  review-workflow.md
issues/
  auto-creation.md
  deduplication.md
  priority.md
  specs.md
  jira-sync.md
customers/
  companies-contacts.md
  custom-fields.md
  lifecycle.md
integrations/
  github.md
  slack.md
  intercom.md
  gong.md
  jira.md
agents/
  support-agent.md
  pm-agent.md
api/
  overview.md
  authentication.md
  widget-api.md
```

Each file has YAML frontmatter:
```yaml
---
title: "Page Title"
description: "One-line description for SEO and page subtitle"
---
```

### 2. Nav Config

**New file: `app/src/app/(marketing)/docs/_config/docs-nav.ts`**

Exports `DOCS_NAV: DocNavCategory[]` with `{ title, slug, description, items: { title, slug, href }[] }` for each category. Also exports helper functions `getCategoryTitle()`, `getAdjacentPages()` for prev/next navigation.

### 3. Markdown Utilities

**New file: `app/src/app/(marketing)/docs/_lib/markdown.ts`**

- `getDocContent(category, slug)` -- reads `.md` file, parses frontmatter, returns `{ meta: { title, description }, content: string }`
- `getAllDocSlugs()` -- returns `{ category, slug }[]` for `generateStaticParams`
- Minimal custom frontmatter parser (no `gray-matter` dependency needed)

**New file: `app/src/app/(marketing)/docs/_lib/toc.ts`**

- `extractToc(markdown)` -- regex-based extraction of h2/h3 headings, returns `{ id, title, level }[]`
- IDs generated to match `rehype-slug` output (lowercase, hyphenated)

### 4. Components

All new files in `app/src/components/docs/`:

| File | Type | Purpose |
|------|------|---------|
| `docs-content.tsx` | Server | Renders markdown with `react-markdown` + `rehype-slug` + `rehype-highlight` + `remark-gfm`. Reuses `markdown-viewer.module.css` styles. |
| `docs-sidebar.tsx` | Client | Left nav using `usePathname()` for active link. Uses `Collapsible` (`@/components/ui/collapsible`) for categories. Sticky, scrollable, `w-64`, hidden below `lg`. |
| `docs-mobile-nav.tsx` | Client | Sticky bar on mobile showing current page title + hamburger. Opens overlay with sidebar nav. |
| `docs-toc.tsx` | Client | Right-hand TOC with `IntersectionObserver` active heading tracking. Hidden below `xl`. |
| `docs-page-nav.tsx` | Server | Previous/Next links at bottom of each doc page. |
| `index.ts` | Barrel | Re-exports all components. |

### 5. Routes

**New file: `app/src/app/(marketing)/docs/layout.tsx`**

Nested layout adding the three-column structure:
```
DocsMobileNav (mobile only, sticky)
DocsSidebar (lg+, sticky left) | {children}
```
Inherits marketing layout (MarketingNav, footer, WaterWebGL).

**New file: `app/src/app/(marketing)/docs/page.tsx`**

Docs home (`/docs`). Grid of category cards linking to first page in each category. Static metadata.

**New file: `app/src/app/(marketing)/docs/[category]/[slug]/page.tsx`**

Individual doc page. Server component that:
- Reads markdown via `getDocContent()`
- Extracts TOC via `extractToc()`
- Gets prev/next pages via `getAdjacentPages()`
- Renders: category breadcrumb, title, description, `DocsContent`, `DocsPageNav`, `DocsToc`
- Uses `generateStaticParams` + `generateMetadata` for static generation and SEO

### 6. Existing File Modifications

**Modify: `app/src/components/landing/marketing-nav.tsx`**
- Add "Docs" link in the nav between logo and action buttons
- Style: `text-sm text-[var(--text-secondary)] hover:text-[var(--accent-teal)]`

**Modify: `app/src/app/(marketing)/layout.tsx`**
- Add "Docs" link to footer alongside existing links

## Styling

- Marketing accent colors: `--accent-teal` for links/active states (per CLAUDE.md rules)
- Monospace headings: `font-mono` (matching existing wireframe aesthetic)
- Prose: `prose prose-slate dark:prose-invert` with CSS variable overrides
- Code blocks: reuse `markdown-viewer.module.css` unchanged
- Sidebar active link: left border + teal text
- All colors via CSS variables for light/dark mode support

## Critical Files to Reference

- `app/src/components/ui/markdown-viewer/markdown-viewer.module.css` -- CSS styles to reuse
- `app/src/components/ui/collapsible.tsx` -- sidebar category collapsible
- `app/src/components/landing/marketing-nav.tsx` -- nav to modify
- `app/src/app/(marketing)/layout.tsx` -- parent layout/footer to modify
- `app/src/app/(marketing)/legal/privacy/page.tsx` -- content page pattern reference
- `app/src/components/ui/markdown-content.tsx` -- existing markdown renderer reference
- `app/src/lib/utils/class.ts` -- `cn()` utility

## Implementation Order

1. Install `rehype-slug` and `remark-gfm`
2. Create nav config (`docs-nav.ts`)
3. Create markdown utilities (`markdown.ts`, `toc.ts`)
4. Create components: `DocsContent` -> `DocsToc` -> `DocsSidebar` -> `DocsMobileNav` -> `DocsPageNav` -> barrel
5. Create routes: layout -> index page -> dynamic `[category]/[slug]` page
6. Add Docs link to marketing nav and footer
7. Write all markdown content files (~30 files)

## Verification

1. `cd app && npm run build` -- confirms static generation works, no build errors
2. `npm run dev` -- navigate to `/docs`, verify:
   - Category cards grid renders on index page
   - Sidebar navigation works with collapsible categories
   - Individual doc pages render markdown with syntax highlighting
   - TOC highlights active section on scroll
   - Prev/Next navigation links work
   - Mobile: sidebar toggle works, TOC hidden
   - Light/dark mode theming works
   - Docs link visible in marketing nav header
3. `npm run lint` -- no lint errors
