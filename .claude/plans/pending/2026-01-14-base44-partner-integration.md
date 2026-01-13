---
status: pending
created: 2026-01-14
impact: low
summary: Submit Hissuno integration to Base44 catalog using existing signup flow
---

# Plan: Base44 Integration (V1 - No Code Changes)

## Goal
Get Hissuno listed on Base44's integration catalog so their users can add AI support to their apps.

## Approach
Submit a Base44 integration that guides users through Hissuno's existing signup and project creation flow. Zero code changes to Hissuno required.

---

## What to Submit to Base44

### Integration Metadata

| Field | Value |
|-------|-------|
| **Name** | Hissuno - AI Support Agent |
| **Logo** | 256x256 PNG (use existing Hissuno logo) |
| **Description** | Add an AI-powered customer support chat widget to your app. Hissuno learns from your codebase and documentation to answer user questions accurately. |

### Example Prompts (3-5)
1. "Add Hissuno support chat to my app"
2. "Set up AI customer support widget"
3. "Add a help chat for my users"
4. "Connect Hissuno for user feedback"

### Backend Function (Deno)

```typescript
// Hissuno integration for Base44
// This integration helps users add AI customer support to their Base44 app

export default async function hissunoIntegration(context: Context) {
  const { action, projectId } = context.input

  if (action === 'connect') {
    // Guide user to Hissuno signup
    return {
      message: `To add Hissuno support to your app:

1. **Sign up** at https://app.hissuno.com/signup
2. **Create a project** and give it a name
3. **Connect your GitHub** repo (optional, for AI to learn your codebase)
4. **Copy the widget code** from the Integrations tab
5. Come back here and paste your Project ID

Your Project ID will look like: proj_xxxxxxxx`,
      promptForInput: {
        field: 'projectId',
        label: 'Enter your Hissuno Project ID',
        placeholder: 'proj_xxxxxxxx'
      }
    }
  }

  if (action === 'embed' && projectId) {
    // Return widget embed code
    return {
      code: `<!-- Hissuno Support Widget -->
<script
  src="https://cdn.hissuno.com/widget.js"
  data-project-id="${projectId}"
  async
></script>`,
      message: 'Widget code generated! Add this to your app HTML.'
    }
  }

  return {
    error: 'Unknown action. Try "Add Hissuno support chat to my app"'
  }
}
```

### User Flow in Base44

```
User: "Add Hissuno support to my app"
         ↓
Base44 AI: Shows instructions to sign up at Hissuno
         ↓
User: Signs up at app.hissuno.com, creates project, connects GitHub
         ↓
User: Returns to Base44, provides Project ID
         ↓
Base44 AI: Generates widget embed code
         ↓
Base44 AI: Adds widget script to the app
```

---

## Files to Prepare

| File | Purpose |
|------|---------|
| `hissuno-logo-256.png` | Logo for Base44 catalog |
| `integration.ts` | Deno backend function (above) |

---

## Submission Steps

1. Go to Base44 dashboard → Integrations → Create Integration
2. Fill in metadata (name, description, logo)
3. Add example prompts
4. Paste backend function code
5. Enable "Backend function" toggle
6. Test with a new Base44 app
7. Submit for public review (earns 250 credits if approved)

---

## Future Enhancements (V2)

Once this is live and validated, consider:
- Passwordless "quick connect" flow (magic link signup)
- Direct API for project creation (skip manual signup)
- OAuth-style redirect flow (one-click setup)

These can be built later based on user feedback and adoption.

---

## Verification

1. Create the integration in Base44 (private first)
2. Test: "Add Hissuno support to my app"
3. Verify instructions are clear
4. Verify widget embed works in Base44 app
5. Submit for public listing
