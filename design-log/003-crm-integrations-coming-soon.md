# Design Log #003: CRM Integrations Coming Soon Section

## Background
The Customers page currently supports manual entry and CSV import. Users who use HubSpot or Salesforce as their CRM would benefit from direct integrations to sync customer data automatically. These integrations aren't built yet, so we need a "Coming Soon" section that signals the intent and collects interest.

## Problem
There's no visibility on the Customers page that CRM integrations are planned. Users may think CSV/manual is the only way to get data in and churn before integrations ship.

## Design

### Proposed Solution
Add a dedicated "Data Sources" section below the AnalyticsStrip and above the Companies/Contacts tabs on the Customers page. This section shows:

1. **HubSpot**: Coming Soon card with HubSpot logo
2. **Salesforce**: Coming Soon card with Salesforce logo

Each integration card is a compact horizontal card showing:
- Integration logo (inline SVG)
- Integration name
- "Coming Soon" badge
- Brief description (e.g., "Sync companies and contacts from HubSpot")

The section is a single horizontal row of 2 cards inside a subtle container, keeping it compact and non-intrusive above the main data tables.

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/src/components/customers/data-sources-section.tsx` | Create | New component with integration cards |
| `app/src/app/(authenticated)/projects/[id]/customers/page.tsx` | Modify | Import and render DataSourcesSection below AnalyticsStrip |

### Component: DataSourcesSection

```
┌─────────────────────────────────────────────────────────────┐
│  DATA SOURCES                                               │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐               │
│  │  HubSpot          │  │  Salesforce        │               │
│  │  Coming Soon      │  │  Coming Soon       │               │
│  │  Sync from        │  │  Sync from         │               │
│  │  HubSpot CRM      │  │  Salesforce CRM    │               │
│  └───────────────────┘  └───────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

- Cards use existing `Badge` component for status indicators
- Active source gets `--accent-success` badge
- Coming soon sources get `--accent-info` badge
- HubSpot brand color: #FF7A59
- Salesforce brand color: #00A1E0
- Logos as inline SVGs for reliability (no external fetches at runtime)

## Implementation Plan

### Phase 1: Create DataSourcesSection component
- [ ] Create `data-sources-section.tsx` with 3 integration cards
- [ ] Use inline SVG logos for HubSpot and Salesforce
- [ ] Style with existing CSS variables and Badge component

### Phase 2: Integrate into Customers page
- [ ] Import DataSourcesSection in customers page
- [ ] Render below AnalyticsStrip, above Tabs

## Trade-offs

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Inline SVG logos | External image URLs | No runtime fetches, works offline, no CORS issues |
| Section above tabs | New tab | Tabs are for data views; sources are meta-information |
| Static "Coming Soon" | Email capture form | Keep it simple, avoid premature data collection |
| No click action | Link to waitlist | Can be added later when integrations are closer |

---

## Implementation Results
<!-- APPEND ONLY - added during/after implementation -->
