---
name: design-log
description: Use when implementing new features, significant architectural changes, or adding new functionality. Enforces design-before-implementation methodology with version-controlled design logs. Triggers on "add feature", "implement", "build", "create new", "refactor", or any substantial code changes.
---

# Design Log Methodology

A systematic approach to feature development that ensures architectural decisions are documented, reviewed, and traceable. Design logs live in `./design-log/` as version-controlled markdown files.

## When to Apply This Methodology

**Always create a design log for:**
- New features or capabilities
- Significant architectural changes
- Refactoring that affects multiple files
- API changes (new endpoints, contracts, interfaces)
- Integration with external services
- Changes that require user input on approach

**Skip design logs for:**
- Bug fixes with obvious solutions
- Typo corrections
- Single-line changes
- Documentation updates

## The Four Pillars

### 1. Read Before You Write
Before making ANY change:
- Check `./design-log/` for existing designs related to this area
- Read related logs to understand context and constraints
- Reference existing patterns and decisions

### 2. Design Before You Implement
- Create the design log FIRST
- Get explicit user approval before writing production code
- "Code" the logic in English before TypeScript

### 3. Immutable History
- Once implementation starts, the Design section is FROZEN
- All changes, deviations, and discoveries go in "Implementation Results"
- Never edit the original design retroactively

### 4. The Socratic Method
- Missing information? Add questions to the log
- Wait for answers before proceeding
- Answers become permanent record in the log

## Workflow

### Step 1: Check Existing Logs
```
Read ./design-log/ directory
Look for related designs
Note relevant log numbers for reference
```

### Step 2: Create Design Log
Determine the next log number and create: `./design-log/[NUMBER]-[feature-name].md`

### Step 3: Fill Out Design Log
Use this structure:

```markdown
# Design Log #[NUMBER]: [Feature Name]

## Background
[Why are we doing this? What's the context?]

## Problem
[What specific problem are we solving?]

## Questions and Answers
[List uncertainties - STOP and ask user before proceeding]

- Q: [Question about unclear requirement or approach]
  A: [Leave blank until answered]

## Design

### Proposed Solution
[High-level approach]

### API Design
[Type signatures, interfaces, file paths]

### File Changes
[List files to create/modify]

## Implementation Plan

### Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name]
- [ ] Task 3
- [ ] Task 4

## Examples

### Good Pattern
[Show correct usage]

### Bad Pattern
[Show what to avoid and why]

## Trade-offs
[Decisions made and alternatives considered]

---

## Implementation Results
[APPEND ONLY - added during/after implementation]

### Deviations from Design
[Document any changes from original plan and why]

### Test Results
[X/Y tests passing, coverage notes]

### Summary
[Final notes after implementation complete]
```

### Step 4: Get Approval

**STOP and present the design log to the user.**

Say: "I've created Design Log #[N] for [feature]. Please review the design before I proceed with implementation."

Do NOT write production code until the user explicitly approves.

### Step 5: Implement
- Follow the implementation plan phases
- Write tests first when applicable
- Append to "Implementation Results" as you go
- Document any deviations immediately

### Step 6: Finalize
- Add summary of deviations
- Record test results
- The log becomes permanent project history

## Rules During Implementation

1. **No silent changes** - Every deviation from the design must be documented
2. **Reference by number** - When discussing designs, use "See Design Log #50"
3. **Keep it brief** - Short explanations, only what's relevant
4. **Use diagrams** - Mermaid diagrams for complex flows
5. **Show types** - Include TypeScript type signatures
6. **Consider compatibility** - Default to non-breaking changes

## Example: Starting a New Feature

User: "Add user authentication to the app"

Claude should:
1. Check `./design-log/` for existing auth-related logs
2. Create `./design-log/[NEXT]-user-authentication.md`
3. Fill out Background, Problem, Questions
4. STOP and ask clarifying questions (OAuth vs JWT? Session storage?)
5. Complete the Design section with answers
6. Present to user for approval
7. Only after approval: begin implementation
