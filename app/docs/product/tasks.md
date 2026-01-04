# Tasks

## 1. Test Widget and Agent Dialog with Stream Functionality
**Test Suite:** `packages/widget/__tests__/useHissunoChat.test.ts`
- [] Verify widget initialization with public key authentication
- [] Test SSE connection via `useHissunoChat` hook to `/api/agent/stream`
- [] Verify `message-chunk` events render in real-time in ChatMessages
- [] Test cancel button calls `/api/agent/cancel` and stops streaming
- [] Test reconnection logic when connection drops mid-stream
- [] Verify inactivity timeout (30 min) auto-closes session
- [] Test localStorage message persistence across page refreshes
- [] Test custom user metadata passed to agent
- [] Verify CORS headers work for cross-origin embedding

**Test Suite:** `src/app/api/agent/__tests__/agent-api.test.ts`
- [] Unit test POST `/api/agent` creates chat_run record
- [] Unit test GET `/api/agent/stream` emits correct SSE events
- [] Unit test POST `/api/agent/cancel` stops active stream

## 2. Test Session Close Logic and Automatic session analysis trigger
**Test Suite:** `src/app/api/sessions/__tests__/session-close.test.ts`
- [] Test POST `/api/sessions/{id}/close` marks session as closed
- [] Test that session analysis and PM review is fire-and-forget (doesn't block close response)
- [] Test race condition: concurrent close requests (unique constraint)
- [] Verify runId is returned when PM review is triggered
- [] Test session close on widget unmount triggers close API

## 3. Test Session Analysis and PM Review with Stream (Including Cancel)
**Test Suite:** `src/app/api/sessions/__tests__/session-analysis.test.ts`
- [] Test POST `/api/sessions/{id}/pm-review` creates session_reviews record with status='running'
- [] Verify SSE connection to `/api/sessions/{id}/pm-review/stream`
- [] Test step progression: `get-context` → `analyze` → `completion`
- [] Verify `review-finish` event contains correct PMReviewResult
- [] Test actions: 'created' (new issue), 'upvoted' (existing), 'skipped'
- [] Test cancel mid-review updates session_reviews status to 'cancelled'
- [] Test reconnection: close sidebar, reopen, and see review still running
- [] Verify `session.pm_reviewed_at` updated on completion
- [] Test concurrent PM review prevention (unique constraint on running)

**Test Suite:** `src/hooks/__tests__/use-pm-review.test.ts`
- [] Test hook auto-reconnects on mount if status='running'
- [] Test hook cleanup on unmount
- [] Test error state handling

## 4. Test Spec Generation with Stream (Including Cancel)
**Test Suite:** `src/app/api/projects/__tests__/spec-generation.test.ts`
- [] Test POST `/api/projects/{id}/issues/{issueId}/generate-spec` creates issue_spec_runs record
- [] Verify SSE connection to `/generate-spec/stream` endpoint
- [] Test step progression: `gather-context` → `generate-spec` → `save-spec`
- [] Verify spec saved to `issues.product_spec` on completion
- [] Test cancel via POST `/generate-spec/cancel` stops streaming
- [] Test concurrent spec generation prevention (unique constraint)

**Test Suite:** `src/hooks/__tests__/use-spec-generation.test.ts`
- [] Test hook reconnects on mount if status='running'
- [] Test completion callback fires with correct metadata
- [] Test cleanup and cancellation

**Test Suite:** `src/components/issues/__tests__/spec-generation-progress.test.tsx`
- [] Test `SpecGenerationProgress` component shows 3-step progress bar
- [] Test expandable details view in progress component
- [] Test cancel button behavior

## 5. Open Support Widget as Full Side Panel (Add Variant)
⚠️ **REQUIRES PLANNING** - Use `/plan` before implementation

### Planning Phase
- [] Design panel variant layout (full height right side)
- [] Define props interface for variant configuration
- [] Plan responsive breakpoints and mobile behavior

### Implementation Phase
- [] Add `variant` prop to HissunoWidget: 'popup' | 'panel'
- [] Create `ChatPanel.tsx` component for full-height layout
- [] Update `getPopupPositionStyles()` for panel positioning
- [] Make panel width configurable (default: 400px)
- [] Add collapse/expand toggle for panel
- [] Handle responsive behavior on mobile (full screen)
- [] Update widget package exports for new variant

### Testing Phase
**Test Suite:** `packages/widget/__tests__/ChatPanel.test.tsx`
- [] Test panel renders at full height
- [] Test collapse/expand toggle
- [] Test theme switching in panel variant
- [] Test responsive behavior

## 6. Connect Lemon Squeezy and Add Metering
⚠️ **REQUIRES PLANNING** - Use `/plan` before implementation

### Planning Phase
- [] Design subscription model and pricing tiers
- [] Define metering metrics (sessions, issues, API calls)
- [] Plan database schema for subscriptions and events
- [] Design webhook event handling flow

### Setup Phase
- [] Create Lemon Squeezy account and configure product/plans
- [] Add environment variables: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`

### Database Phase
- [] Create database migration for subscriptions table:
  - [] `subscriptions` table (id, project_id, customer_id, status, plan, current_period_end)
  - [] `subscription_events` table for webhook audit trail

### Implementation Phase
- [] Create `/app/src/lib/payment/lemonsqueezy.ts` service
- [] Implement webhook handler at `/api/webhooks/lemonsqueezy/route.ts`:
  - [] Handle `subscription_created` event
  - [] Handle `subscription_updated` event
  - [] Handle `subscription_cancelled` event
  - [] Handle `subscription_payment_success` event
- [] Add subscription check middleware for protected API routes
- [] Create metering logic to track usage (sessions, issues, etc.)
- [] Add billing portal link for subscription management
- [] Create pricing page component

### Testing Phase
**Test Suite:** `src/lib/payment/__tests__/lemonsqueezy.test.ts`
- [] Test webhook signature verification
- [] Test subscription lifecycle: create → update → cancel
- [] Test metering calculations

**Test Suite:** `src/app/api/webhooks/__tests__/lemonsqueezy-webhook.test.ts`
- [] Test each webhook event handler
- [] Test invalid signature rejection
- [] Test idempotency (duplicate events)
