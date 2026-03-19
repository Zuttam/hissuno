---
title: "Product Specifications"
description: "How Hissuno generates detailed product specs from issues using AI-powered research and analysis."
---

## Overview

Once an issue has gathered enough evidence from customer feedback, Hissuno can generate a comprehensive product specification for it. The Spec Writer Agent researches the issue using the knowledge base, codebase, and web sources, then produces a structured document that bridges user needs with technical implementation. Specs are designed to give engineers enough context to understand scope and requirements without additional back-and-forth.

## Generating a Spec

You can trigger spec generation from the issue detail view by clicking the **Generate Spec** button. The process runs asynchronously and streams progress events in real time, so you can watch each research step as it completes.

### Prerequisites

Spec generation works best when the issue has:

- A clear title and description (written by the PM Agent or refined by your team).
- One or more linked feedback sessions with customer quotes.
- A connected codebase (optional but recommended for technical context).
- Knowledge sources configured for your project (optional but recommended).

### The Generation Process

The Spec Writer Agent follows a structured research process:

1. **Gather context** -- Collects the issue details, all linked feedback sessions with full message histories, and project information.
2. **Search the knowledge base** -- Queries your project's compiled knowledge for relevant product documentation, technical specifications, and existing patterns.
3. **Analyze the codebase** -- If a codebase is connected, the agent explores the project structure, searches for relevant code patterns, reads specific implementations, and reviews database schema and migration files.
4. **Research best practices** -- Performs web searches to find how competitors solve similar problems, discover industry patterns, and gather UX standards.
5. **Write the specification** -- Synthesizes all research into a structured document.
6. **Save the specification** -- Stores the completed spec on the issue record.

## Spec Structure

Every generated specification follows a consistent template with the following sections.

### Executive Summary

A two-to-three sentence overview of the problem and proposed solution direction. This gives readers an immediate understanding of what the spec covers.

### Problem Statement

Detailed description of what users are experiencing, organized into user pain points with direct quotes from feedback sessions, and business impact analysis covering affected user segments, frequency, and severity.

### Evidence Base

The factual foundation for the spec, drawn from three sources:

- **User feedback** -- Direct quotes from linked support sessions, preserving the customer's voice and providing attribution.
- **Technical context** -- Findings from codebase analysis including affected files, existing implementation patterns, and architectural considerations.
- **Market research** -- Best practices and competitor approaches discovered through web search.

### Proposed Solution

The recommended approach, covering:

- **High-level approach** -- Overview of the solution direction without prescribing implementation details.
- **User experience** -- How users will interact with the solution.
- **Technical considerations** -- Architecture implications, dependencies, and potential risks.
- **Database and data changes** -- Schema modifications, new tables or columns, migration requirements, data backfill needs, and index changes.

### Acceptance Criteria

A numbered list of specific, testable criteria using the "When X, then Y" format. Each criterion should be independently verifiable by QA or the engineering team.

### Out of Scope

An explicit list of what the spec does not cover and features deferred to future iterations. This prevents scope creep and sets clear boundaries.

### Open Questions

Unresolved items that need stakeholder or engineering input before implementation can begin. The agent flags these rather than making assumptions.

### Appendix

References to related knowledge base entries, similar implementations in the codebase, and external resources discovered during research.

## Editing a Spec

After generation, the spec is stored as Markdown on the issue record. You can edit it directly from the issue detail view using the built-in Markdown editor.

Common reasons to edit a spec:

- Adding constraints or requirements the agent missed.
- Removing sections that are not relevant.
- Updating acceptance criteria based on team discussion.
- Incorporating engineering feedback on feasibility.

Edits are saved immediately and the updated spec is preserved even if you regenerate later (you must explicitly choose to overwrite).

## Regenerating a Spec

If the issue has changed significantly -- for example, after receiving many new feedback sessions or after a major codebase update -- you can regenerate the spec. Click **Regenerate Spec** in the issue detail view. This runs the full generation process again and replaces the existing spec with fresh output.

Only one spec generation can run at a time per issue. If a generation is already in progress, you must cancel it before starting a new one.

## Spec and Jira Sync

When your project has a Jira integration enabled, spec generation triggers a sync action. After the spec is saved, Hissuno adds a comment to the linked Jira ticket with a link back to the full spec in Hissuno. This keeps your engineering team informed without duplicating the entire spec content in Jira.

## Spec Status and Issue Lifecycle

Spec generation is closely tied to the issue lifecycle:

| Issue Status | Spec Behavior |
|-------------|---------------|
| **Open** | Spec can be generated at any time. |
| **Ready** | Indicates the spec has been reviewed and the issue is ready for engineering. |
| **In Progress** | Spec remains available as a reference during implementation. |
| **Resolved** | Spec is preserved for historical reference. |
| **Closed** | Spec is preserved but the issue is marked as not relevant. |

Moving an issue to **Ready** status signals to your team that the spec has been reviewed and approved for engineering work.
